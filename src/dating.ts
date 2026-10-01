import pLimit from "p-limit";
import { z } from "zod";
import { config } from "./config.js";
import { query } from "./db.js";
import { readyPeople as loadReady } from "./repo.js";
import { publish } from "./events.js";
import { chat, chatJSON, type ChatMessage } from "./llm.js";
import type { Analysis } from "./analyze.js";

export interface Person {
  id: number;
  name: string;
  tags: string[];
  analysis: Analysis;
  linkedin: any;
  instagram: any;
}

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a.map((s) => s.toLowerCase()));
  const B = new Set(b.map((s) => s.toLowerCase()));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((x) => B.has(x) && inter++);
  return inter / (A.size + B.size - inter);
};
const words = (s: string) => s.toLowerCase().split(/\W+/).filter((w) => w.length > 3);

/** Cheap 0..1 compatibility estimate: tag overlap, shared values, lifestyle similarity. */
export function preScore(a: Person, b: Person): number {
  const x = a.analysis;
  const y = b.analysis;
  const tags = jaccard(a.tags, b.tags);
  const values = jaccard(x.values, y.values);
  const sliders = (["introvert_extrovert", "adventurous", "ambition"] as const)
    .map((k) => 1 - Math.abs(x.personality[k] - y.personality[k]) / 10)
    .reduce((s, v) => s + v, 0) / 3;
  const life = (k: keyof Analysis["lifestyle"]) => jaccard(words(x.lifestyle[k]), words(y.lifestyle[k]));
  const lifestyle = 0.5 * sliders + 0.5 * ((life("pace") + life("social_life") + life("travel") + life("fitness") + life("city")) / 5);
  return Math.min(1, 0.5 * tags + 0.2 * values + 0.3 * lifestyle);
}

export interface Pair { a: Person; b: Person; pre: number }

/** Each person dates their top-N; pairs are deduped. If onlyFor is set, only pairs involving that person. */
export function planPairs(people: Person[], onlyFor?: number): Pair[] {
  const seen = new Map<string, Pair>();
  for (const p of people) {
    if (onlyFor && p.id !== onlyFor) continue;
    people
      .filter((o) => o.id !== p.id)
      .map((o) => ({ o, pre: preScore(p, o) }))
      .sort((m, n) => n.pre - m.pre)
      .slice(0, config.datesPerPerson)
      .forEach(({ o, pre }) => {
        const [a, b] = p.id < o.id ? [p, o] : [o, p];
        seen.set(`${a.id}-${b.id}`, { a, b, pre });
      });
  }
  return [...seen.values()];
}

// ---------- prompts ----------

function card(p: Person) {
  const a = p.analysis;
  return {
    name: p.name, tagline: a.headline_tagline, summary: a.summary,
    interests: a.interests.map((i) => i.name), hobbies: a.hobbies.map((h) => h.name),
  };
}

function privateProfile(p: Person) {
  const a = p.analysis;
  return JSON.stringify({
    name: p.name,
    facts: { headline: p.linkedin?.headline, location: p.linkedin?.location, instagram_bio: p.instagram?.bio },
    summary: a.summary, needs: a.needs.map((n) => `${n.need} — ${n.why}`),
    hobbies: a.hobbies.map((h) => h.name), interests: a.interests.map((i) => i.name), values: a.values,
    personality: a.personality, lifestyle: a.lifestyle, career: a.career,
    communication_style: a.communication_style, looking_for: a.looking_for,
    dealbreakers: a.dealbreakers, green_flags: a.green_flags, conversation_starters: a.conversation_starters,
  });
}

const intentSchema = z.object({
  find_out: z.array(z.string()).catch([]),
  questions: z.array(z.string()).catch([]),
  dealbreakers: z.array(z.string()).catch([]),
});
const settingSchema = z.object({ venue: z.string(), activity: z.string(), scene: z.string() });
const dims = ["values", "lifestyle", "interests", "communication", "life_goals", "chemistry"] as const;
const score = z.coerce.number().min(0).max(10);
const verdictSchema = z.object({
  scores: z.object(Object.fromEntries(dims.map((d) => [d, score.catch(5)])) as Record<(typeof dims)[number], z.ZodCatch<z.ZodCoercedNumber>>),
  overall: score,
  want_second_date: z.coerce.boolean().catch(false),
  best_moment: z.string().catch(""),
  concerns: z.array(z.string()).catch([]),
  why: z.string().catch(""),
});
export type Verdict = z.output<typeof verdictSchema>;

async function makeIntent(me: Person, other: Person) {
  return chatJSON(config.models.date, [
    { role: "system", content: `You are the AI dating agent for ${me.name}. You know them well and represent them honestly.\nYour person: ${privateProfile(me)}` },
    { role: "user", content: `You're about to go on a first date with someone. Here is their public card only:\n${JSON.stringify(card(other))}\n\nReturn JSON {"find_out": [what you most want to find out about them for ${me.name}'s sake], "questions": [exactly 3 specific questions you'd ask], "dealbreakers": [what would be a dealbreaker for ${me.name} on this date]}.` },
  ], intentSchema, { label: "intent", maxTokens: 500 });
}

async function makeSetting(a: Person, b: Person) {
  const shared = a.tags.filter((t) => b.tags.includes(t)).slice(0, 8);
  return chatJSON(config.models.date, [
    { role: "system", content: "You plan realistic, specific first dates." },
    { role: "user", content: `Pick one concrete first date for these two people, based on shared interests.\nA: ${JSON.stringify(card(a))}\nB: ${JSON.stringify(card(b))}\nShared tags: ${shared.join(", ") || "none"}; A city: ${a.analysis.lifestyle.city}; B city: ${b.analysis.lifestyle.city}.\nReturn JSON {"venue": "...", "activity": "e.g. bouldering then ramen in Bandra", "scene": "one-line scene setting"}.` },
  ], settingSchema, { label: "setting", temperature: 0.9, maxTokens: 300 });
}

function systemFor(me: Person, other: Person, intent: unknown, setting: z.output<typeof settingSchema>) {
  const v = me.analysis.voice;
  return `You are the AI dating agent speaking AS ${me.name} (first person, in their voice) on a first date with ${other.name}. Your job is to honestly test whether this is a good fit for ${me.name}.

About ${me.name}: ${privateProfile(me)}
Their voice: tone=${v.tone}; vocabulary=${v.vocabulary}; emoji use=${v.emoji_use}; sample lines: ${v.sample_lines.join(" | ")}
Your private intent (never reveal it as a list): ${JSON.stringify(intent)}
Setting: ${setting.activity} at ${setting.venue}. ${setting.scene}

Rules: stay in character; 1-3 sentences per turn; natural spoken/texting tone; ask questions and react to what ${other.name} just said; probe needs and dealbreakers; reference real details from your own profile; no generic small talk; never invent facts about ${me.name}. Occasionally (not every turn) include a short scene action in *italics*, e.g. *orders the spicy ramen*. Output only your next line.`;
}

function turnMessages(transcript: { speaker: number; text: string }[], meId: number): ChatMessage[] {
  const msgs: ChatMessage[] = transcript.length && transcript[0].speaker !== meId ? [] : [{ role: "user", content: "(The date begins. You speak first.)" }];
  for (const t of transcript) msgs.push({ role: t.speaker === meId ? "assistant" : "user", content: t.text });
  return msgs;
}

const cleanLine = (s: string, name: string) =>
  s.trim().replace(new RegExp(`^\\**${name.split(" ")[0]}\\**\\s*:\\s*`, "i"), "").replace(/^"(.*)"$/s, "$1").trim();

async function makeVerdict(me: Person, other: Person, transcript: { speaker: number; text: string }[], setting: z.output<typeof settingSchema>) {
  const text = transcript.map((t) => `${t.speaker === me.id ? me.name : other.name}: ${t.text}`).join("\n");
  return chatJSON(config.models.date, [
    { role: "system", content: `You are ${me.name}'s dating agent, writing a private, honest debrief after a first date. Be critical, not polite: only recommend a second date if it genuinely suits ${me.name}.\nYour person: ${privateProfile(me)}` },
    { role: "user", content: `Date: ${setting.activity} at ${setting.venue}.\nTranscript:\n${text}\n\nReturn JSON {"scores": {"values":0-10,"lifestyle":0-10,"interests":0-10,"communication":0-10,"life_goals":0-10,"chemistry":0-10}, "overall": 0-10, "want_second_date": true|false, "best_moment": "a verbatim quote from the transcript", "concerns": ["..."], "why": "2 sentences from ${me.name}'s point of view"}.` },
  ], verdictSchema, { label: "debrief", maxTokens: 600 });
}

export function matchScore(a: Verdict, b: Verdict, pre: number) {
  const dimAvg = (v: Verdict) => dims.reduce((s, d) => s + v.scores[d], 0) / dims.length;
  const mutual = a.want_second_date && b.want_second_date;
  const raw = 0.5 * Math.sqrt(a.overall * b.overall) * 10 + 0.3 * ((dimAvg(a) + dimAvg(b)) / 2) * 10 + 0.2 * pre * 100 + (mutual ? 5 : 0);
  return { score: Math.round(Math.min(100, raw) * 10) / 10, mutual };
}

// ---------- the date ----------

async function runDate(dateId: number, a: Person, b: Person, pre: number) {
  publish({ type: "date_started", dateId, aId: a.id, bId: b.id });
  try {
    await query(`delete from date_turns where date_id=$1`, [dateId]);
    await query(`update dates set status='planning', error=null, pre_score=$2 where id=$1`, [dateId, pre]);
    const [intentA, intentB] = await Promise.all([makeIntent(a, b), makeIntent(b, a)]);
    const setting = await makeSetting(a, b);
    await query(`update dates set intent_a=$2, intent_b=$3, setting=$4, status='dating' where id=$1`, [dateId, JSON.stringify(intentA), JSON.stringify(intentB), JSON.stringify(setting)]);

    const transcript: { speaker: number; text: string }[] = [];
    const sys = { [a.id]: systemFor(a, b, intentA, setting), [b.id]: systemFor(b, a, intentB, setting) };
    for (let i = 0; i < config.dateTurns; i++) {
      const [me, other] = i % 2 === 0 ? [a, b] : [b, a];
      const raw = await chat(config.models.date, [{ role: "system", content: sys[me.id] }, ...turnMessages(transcript, me.id)], { label: `turn${i}`, maxTokens: 200, temperature: 0.9 });
      const text = cleanLine(raw, me.name);
      transcript.push({ speaker: me.id, text });
      await query(`insert into date_turns (date_id, idx, speaker_id, text) values ($1,$2,$3,$4)`, [dateId, i, me.id, text]);
      publish({ type: "turn", dateId, idx: i, speakerId: me.id, text });
    }

    await query(`update dates set status='debrief' where id=$1`, [dateId]);
    const [va, vb] = await Promise.all([makeVerdict(a, b, transcript, setting), makeVerdict(b, a, transcript, setting)]);
    const { score, mutual } = matchScore(va, vb, pre);
    await query(`update dates set verdict_a=$2, verdict_b=$3, match_score=$4, mutual=$5, status='done' where id=$1`, [dateId, JSON.stringify(va), JSON.stringify(vb), score, mutual]);
    publish({ type: "date_finished", dateId, matchScore: score, mutual });
  } catch (e) {
    console.error(`[date ${dateId}] failed:`, e);
    await query(`update dates set status='failed', error=$2 where id=$1`, [dateId, (e as Error).message]).catch(() => {});
    publish({ type: "date_finished", dateId, matchScore: null, mutual: false, failed: true });
  }
}

const dateQueue = pLimit(config.concurrency);
const running = new Set<number>();

/** Create date rows for the pairs (skipping finished ones unless force) and run them. Returns the number scheduled. */
export async function runPairs(pairs: Pair[], force = false): Promise<number> {
  let scheduled = 0;
  for (const { a, b, pre } of pairs) {
    const rows = await query(
      `insert into dates (a_id, b_id, pre_score) values ($1,$2,$3)
       on conflict (a_id, b_id) do update set pre_score=excluded.pre_score returning id, status`,
      [a.id, b.id, pre],
    );
    const { id, status } = rows[0];
    if (running.has(id) || (!force && status === "done")) continue;
    running.add(id);
    scheduled++;
    dateQueue(() => runDate(id, a, b, pre)).finally(() => running.delete(id));
  }
  return scheduled;
}
export async function runRound(force = false): Promise<number> {
  const people = await loadReady() as unknown as Person[];
  return runPairs(planPairs(people), force);
}

export async function runDatesFor(personId: number): Promise<number> {
  const people = await loadReady() as unknown as Person[];
  return runPairs(planPairs(people, personId));
}

/** After a restart: resume dates that were interrupted mid-flight. */
export async function resumeInterrupted() {
  const stuck = await query<{ id: number }>(`select id from dates where status in ('queued','planning','dating','debrief')`);
  if (!stuck.length) return;
  const people = await loadReady() as unknown as Person[];
  const byId = new Map(people.map((p) => [p.id, p]));
  const rows = await query<{ id: number; a_id: number; b_id: number; pre_score: number }>(`select id, a_id, b_id, pre_score from dates where id = any($1)`, [stuck.map((s) => s.id)]);
  const pairs = rows.flatMap((r) => (byId.has(r.a_id) && byId.has(r.b_id) ? [{ a: byId.get(r.a_id)!, b: byId.get(r.b_id)!, pre: r.pre_score }] : []));
  await runPairs(pairs, true);
}
