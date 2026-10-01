import { beamDiagram, type BeamNode } from "./beams.js";
import { avatar, badge, bar, bubble, esc, layout, type Who } from "./ui.js";

const chips = (xs: string[], cls = "") => `<div class="chips">${xs.map((x) => `<span class="chip ${cls}">${esc(x)}</span>`).join("")}</div>`;
const evidence = (ev: { source: string; quote: string }[] = []) =>
  ev.map((e) => `<div class="ev"><span class="src ${esc(e.source)}">${esc(e.source)}</span><q>${esc(e.quote)}</q></div>`).join("");
const empty = (msg: string) => `<div class="empty">${msg}</div>`;

// ---------------- home ----------------
export function homePage(people: any[]): string {
  const cards = people.map((p) => `
    <a class="card pcard" href="/person/${p.id}" data-person="${p.id}">
      <div class="row">${avatar(p)}<div><h3>${esc(p.name)}</h3>${badge(p.status)}</div></div>
      <div class="tag">${esc(p.tagline || (p.status === "failed" ? p.error : "The agent is getting to know them…"))}</div>
    </a>`).join("");
  return layout("People", `
  <section class="hero">
    <h1>Agents date <span class="grad">so you don't have to</span></h1>
    <p>Paste a LinkedIn and a public Instagram. An AI agent reads them, goes on dates with other agents on their behalf, and comes back with a ranking of best fits.</p>
  </section>
  <form id="add" class="form">
    <input type="text" name="linkedin_url" placeholder="LinkedIn URL (linkedin.com/in/…)" required>
    <input type="text" name="instagram_url" placeholder="Instagram URL or @handle" required>
    <button class="btn" type="submit">Create agent</button>
  </form>
  <div id="formmsg" class="msgline"></div>
  <div class="actions">
    <button class="btn" id="run-round">♥ Run dating round</button>
    <a class="btn ghost" href="/rankings">View rankings</a>
    <a class="btn ghost" href="/live">Watch live</a>
  </div>
  <div class="grid" id="people">${cards || empty("No one here yet — add the first person above.")}</div>`, "home", 'data-page="home"');
}

// ---------------- person ----------------
function steps(p: any): string {
  const pr = p.progress ?? {};
  const s = (label: string, v: string | undefined) => `<li class="${v === "done" ? "ok" : v === "failed" ? "bad" : "run"}">${label}${v === "done" ? "" : v === "failed" ? " — failed" : "…"}</li>`;
  const liDone = pr.linkedin === "done", igDone = pr.instagram === "done";
  return `<div class="card"><h3>Building this agent</h3><ul class="steps">
    ${p.status === "queued" ? '<li class="run">Waiting in queue…</li>' : ""}
    ${s("Scraping LinkedIn", pr.linkedin)}${s("Scraping Instagram", pr.instagram)}
    ${liDone && igDone ? s("Analyzing personality, needs and voice", p.status === "analyzing" ? "running" : p.status === "ready" ? "done" : undefined) : ""}
  </ul></div>`;
}

export function personPage(p: any, dates: any[], ranking: any[]): string {
  const head = `<div class="profile-head">${avatar(p, "xl")}<div>
      <h1>${esc(p.name)}</h1>
      <div class="row" style="margin:6px 0">${badge(p.status)}<span style="color:var(--muted)">${esc(p.linkedin?.headline || "")}</span></div>
      <div class="links"><a href="${esc(p.linkedin_url)}" target="_blank" rel="noopener">LinkedIn ↗</a><a href="${esc(p.instagram_url)}" target="_blank" rel="noopener">Instagram ↗</a></div>
    </div></div>`;
  const attrs = `data-page="person" data-id="${p.id}" data-status="${esc(p.status)}"`;
  if (p.status === "failed") {
    return layout(p.name, `${head}<div class="card"><h3>Something went wrong</h3><p>${esc(p.error)}</p><button class="btn" id="retry">Retry</button></div>`, "", attrs);
  }
  const a = p.analysis;
  if (!a) return layout(p.name, `${head}${steps(p)}`, "", attrs);

  const li = a.lifestyle, car = a.career, pe = a.personality;
  const body = `${head}
  <div class="card"><h3>${esc(a.headline_tagline)}</h3><p style="margin:0">${esc(a.summary)}</p>
    <p class="sub" style="color:var(--muted);font-size:13px;margin:10px 0 0">Agent confidence ${Math.round(a.confidence * 100)}%</p></div>

  <h2 class="sec">How the agent read this person</h2>
  <div class="cols">
    <div class="card"><h3>Needs</h3>${a.needs.map((n: any) => `<div class="item"><b>${esc(n.need)}</b><span>${esc(n.why)}</span>${evidence(n.evidence)}</div>`).join("") || "—"}</div>
    <div class="stack">
      <div class="card"><h3>Hobbies</h3>${a.hobbies.map((h: any) => `<div class="item"><b>${esc(h.name)}</b>${evidence(h.evidence)}</div>`).join("") || "—"}</div>
      <div class="card"><h3>Interests</h3>${a.interests.map((h: any) => `<div class="item"><b>${esc(h.name)}</b>${evidence(h.evidence)}</div>`).join("") || "—"}</div>
    </div>
  </div>

  <div class="cols" style="margin-top:16px">
    <div class="card"><h3>Personality</h3>${chips(pe.traits)}
      ${bar("Introvert ↔ Extrovert", pe.introvert_extrovert)}${bar("Adventurous", pe.adventurous)}${bar("Ambition", pe.ambition)}
      <p style="margin:10px 0 0;color:var(--muted)">Humor: ${esc(pe.humor_style)}</p></div>
    <div class="card"><h3>Values</h3>${chips(a.values)}
      <h3 style="margin-top:18px">Lifestyle</h3>
      <div class="item"><b>Pace</b>${esc(li.pace)}</div><div class="item"><b>Social life</b>${esc(li.social_life)}</div>
      <div class="item"><b>Travel</b>${esc(li.travel)}</div><div class="item"><b>Fitness</b>${esc(li.fitness)}</div><div class="item"><b>City</b>${esc(li.city)}</div></div>
  </div>

  <div class="cols" style="margin-top:16px">
    <div class="card"><h3>Career</h3><div class="item"><b>${esc(car.field)} · ${esc(car.stage)}</b>${esc(car.ambition_notes)}</div>
      <h3 style="margin-top:18px">Communication</h3><p style="margin:0">${esc(a.communication_style)}</p>
      <p style="color:var(--muted);margin:8px 0 0">Love language guess: ${esc(a.love_language_guess)}</p></div>
    <div class="card"><h3>Looking for</h3><p style="margin-top:0">${esc(a.looking_for)}</p>
      <h3>Green flags</h3>${chips(a.green_flags, "green")}<h3 style="margin-top:14px">Dealbreakers</h3>${chips(a.dealbreakers, "red")}</div>
  </div>

  <div class="cols" style="margin-top:16px">
    <div class="card"><h3>Voice</h3><p style="margin-top:0;color:var(--muted)">${esc(a.voice.tone)} · ${esc(a.voice.vocabulary)} · emoji: ${esc(a.voice.emoji_use)}</p>
      ${a.voice.sample_lines.map((l: string) => `<div class="ev"><q>${esc(l)}</q></div>`).join("")}</div>
    <div class="card"><h3>Ideal first date</h3><p style="margin-top:0">${esc(a.ideal_first_date)}</p>
      <h3>Conversation starters</h3>${a.conversation_starters.map((c: string) => `<div class="ev">${esc(c)}</div>`).join("")}
      ${a.data_gaps.length ? `<h3 style="margin-top:14px">Data gaps</h3>${chips(a.data_gaps)}` : ""}</div>
  </div>

  <h2 class="sec">Best fits</h2>
  <div class="card">${ranking.length ? ranking.map((r, i) => rankRow(r, i + 1)).join("") : empty("No finished dates yet. Run a dating round to see who fits best.")}</div>

  <h2 class="sec">Dates</h2>
  <div class="card">${dates.length ? dates.map(dateRow).join("") : empty("No dates yet.")}</div>`;
  return layout(p.name, body, "", attrs);
}

const rankRow = (r: any, n: number) => `
  <a class="listrow" href="/date/${r.date_id}"><span class="rank">${n}</span>${avatar({ id: r.partner_id, name: r.partner_name, has_photo: r.partner_has_photo }, "sm")}
    <div class="grow"><b>${esc(r.partner_name)}</b> ${r.mutual ? '<span class="mutual">Mutual match</span>' : ""}<div class="sub">${esc(r.my_verdict?.why || r.partner_tagline || "")}</div></div>
    <div class="score">${Math.round(r.match_score)}</div></a>`;

const dateRow = (d: any) => `
  <a class="listrow" href="/date/${d.id}">${avatar({ id: d.partner_id, name: d.partner_name, has_photo: d.partner_has_photo }, "sm")}
    <div class="grow"><b>${esc(d.partner_name)}</b><div class="sub">${esc(d.setting?.activity || "Planning the date…")}</div></div>
    ${badge(d.status)}<div class="score">${d.match_score != null ? Math.round(d.match_score) : "–"}</div></a>`;

// ---------------- date ----------------
const DIM: Record<string, string> = { values: "Values", lifestyle: "Lifestyle", interests: "Interests", communication: "Communication", life_goals: "Life goals", chemistry: "Chemistry" };

function debrief(p: Who, v: any, intent: any): string {
  if (!v) return `<div class="card"><div class="row">${avatar(p, "sm")}<h3 style="margin:0">${esc(p.name)}'s agent</h3></div><p class="empty">Debrief pending…</p></div>`;
  return `<div class="card"><div class="row" style="margin-bottom:10px">${avatar(p, "sm")}<div><h3 style="margin:0">${esc(p.name)}'s agent</h3>
      <span class="badge ${v.want_second_date ? "b-ready" : "b-failed"}">${v.want_second_date ? "Wants a second date" : "Passes"}</span></div><div class="score" style="margin-left:auto">${v.overall}/10</div></div>
    ${Object.keys(DIM).map((k) => bar(DIM[k], v.scores?.[k] ?? 0)).join("")}
    <div class="ev"><b>Best moment</b><q>${esc(v.best_moment)}</q></div>
    ${v.concerns?.length ? `<h3 style="margin-top:14px">Concerns</h3>${chips(v.concerns, "red")}` : ""}
    <p style="margin:14px 0 0">${esc(v.why)}</p></div>`;
}

const intentBlock = (p: Who, i: any) => i ? `<details class="card"><summary>${esc(p.name)}'s private intent</summary>
  <h3 style="margin-top:12px">Wants to find out</h3>${chips(i.find_out)}<h3 style="margin-top:12px">Questions</h3>${i.questions.map((q: string) => `<div class="ev">${esc(q)}</div>`).join("")}
  <h3 style="margin-top:12px">Dealbreakers</h3>${chips(i.dealbreakers, "red")}</details>` : "";

export function datePage(d: any, a: Who, b: Who, turns: any[]): string {
  const done = d.status === "done";
  const bubbles = turns.map((t) => bubble(t.speaker_id === a.id ? a : b, t.text, t.speaker_id === a.id ? "l" : "r")).join("");
  const body = `
  <div class="versus">
    <a href="/person/${a.id}" class="row">${avatar(a, "lg")}<div><h2 style="margin:0">${esc(a.name)}</h2></div></a><div class="x grad">♥</div>
    <a href="/person/${b.id}" class="row">${avatar(b, "lg")}<div><h2 style="margin:0">${esc(b.name)}</h2></div></a>
  </div>
  <div class="scene">${d.setting ? `<b>${esc(d.setting.activity)}</b>${esc(d.setting.venue)} — ${esc(d.setting.scene)}` : "The agents are planning the date…"}</div>
  ${d.status === "failed" ? `<div class="card"><h3>This date failed</h3><p>${esc(d.error)}</p></div>` : ""}
  <div class="stack" style="max-width:760px;margin:0 auto 24px">${intentBlock(a, d.intent_a)}${intentBlock(b, d.intent_b)}</div>
  <div class="actions" style="margin-top:0"><button class="btn ghost" id="replay" ${turns.length ? "" : "disabled"}>▶ Replay</button></div>
  <div class="chat" id="chat" data-a="${a.id}">${bubbles}</div>
  <h2 class="sec">Private debriefs</h2>
  <div class="cols">${debrief(a, d.verdict_a, d.intent_a)}${debrief(b, d.verdict_b, d.intent_b)}</div>
  ${done ? `<div class="card final" style="margin-top:16px"><div class="big grad">${Math.round(d.match_score)}</div><div>match score ${d.mutual ? '<span class="mutual">Mutual match</span>' : ""}</div>
    <p class="sub" style="color:var(--muted);font-size:13px">50% geometric mean of overall scores · 30% dimension average · 20% pre-date compatibility · +5 if both want a second date</p></div>` : ""}`;
  const people = { [a.id]: { name: a.name, photo: !!a.has_photo }, [b.id]: { name: b.name, photo: !!b.has_photo } };
  return layout(`${a.name} & ${b.name}`, body + `<script>window.PEOPLE=${JSON.stringify(people).replace(/</g, "\\u003c")}</script>`, "", `data-page="date" data-id="${d.id}" data-status="${esc(d.status)}"`);
}

// ---------------- live ----------------
export function livePage(dates: any[], people: Record<number, { name: string; photo: boolean }>): string {
  const cards = dates.map((d) => `
    <div class="card livecard" data-date="${d.id}" data-a="${d.a.id}">
      <div class="row spread" style="margin-bottom:10px"><div class="row">${avatar(d.a, "sm")}<span class="grad">♥</span>${avatar(d.b, "sm")}</div>${badge(d.status)}</div>
      <a href="/date/${d.id}"><b>${esc(d.a.name)} & ${esc(d.b.name)}</b></a>
      <div class="sub" style="color:var(--muted);font-size:13px;margin-bottom:8px">${esc(d.setting?.activity || "Planning…")}</div>
      <div class="chat">${d.turns.map((t: any) => bubble(t.speaker_id === d.a.id ? d.a : d.b, t.text, t.speaker_id === d.a.id ? "l" : "r")).join("")}</div>
    </div>`).join("");
  return layout("Live", `
  <div class="row spread" style="margin-bottom:18px"><div><h1 style="margin:0">Live dating floor</h1><span style="color:var(--muted)">Dates in progress stream in here.</span></div>
    <button class="btn" id="run-round">♥ Run dating round</button></div>
  <div class="livegrid" id="floor">${cards}</div>
  <div id="floor-empty" class="empty" ${cards ? "hidden" : ""}>No dates in progress right now.</div>
  <script>window.PEOPLE=${JSON.stringify(people).replace(/</g, "\\u003c")}</script>`, "live", 'data-page="live"');
}

// ---------------- rankings ----------------
export function rankingsPage(rows: { person: any; top: any[] }[]): string {
  const cards = rows.map(({ person: p, top }) => `
    <div class="card"><a class="row" href="/person/${p.id}" style="margin-bottom:6px">${avatar(p)}<div><h3 style="margin:0">${esc(p.name)}</h3><span class="sub" style="color:var(--muted);font-size:13px">${esc(p.tagline || "")}</span></div></a>
      ${top.length ? top.map((r, i) => rankRow(r, i + 1)).join("") : '<div class="empty" style="padding:18px">No finished dates yet</div>'}</div>`).join("");
  return layout("Rankings", `<h1>Best fits</h1><p style="color:var(--muted)">Each person's top matches, scored by both agents after the date.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${cards || empty("No people yet.")}</div>`, "rankings");
}

// ---------------- about ----------------
const FLOW_NODES: BeamNode[] = [
  { id: "li", label: "LinkedIn", sub: "work + skills", cx: 90, cy: 85, shape: "chip", w: 130, h: 44, tone: "#0a66c2" },
  { id: "ig", label: "Instagram", sub: "posts + vibe", cx: 90, cy: 215, shape: "chip", w: 130, h: 44, tone: "#d6249f" },
  { id: "read", label: "Reads them", sub: "analysis agent", cx: 270, cy: 130, shape: "hub", glyph: "🔍" },
  { id: "date", label: "Dates", sub: "agent vs agent", cx: 460, cy: 130, shape: "hub", glyph: "♥" },
  { id: "rank", label: "Best fits", sub: "your ranking", cx: 640, cy: 130, shape: "chip", w: 120, h: 44, tone: "#16a34a" },
];
const FLOW_EDGES = [
  { from: "li", to: "read" }, { from: "ig", to: "read" }, { from: "read", to: "date" }, { from: "date", to: "rank" },
];

const STEPS: [string, string, string][] = [
  ["1", "We read two public pages", "Only a person's LinkedIn and public Instagram. Nothing else is searched."],
  ["2", "An agent figures them out", "It writes down what they need, enjoy and value, and how they talk, with a quote as proof for each claim."],
  ["3", "Agents go on dates", "Each person's agent chats with another agent as that person, on a made-up first date."],
  ["4", "Each agent gives honest feedback", "After the date, both agents score the fit and say whether they would meet again."],
  ["5", "You get a ranking", "Everyone's dates are sorted by score, so you see who fits best and why."],
];

export function aboutPage(models: { analysis: string; date: string; fallback: string }): string {
  return layout("How it works", `
  <h1>How it works</h1>
  <p style="color:var(--muted);max-width:640px">Two profiles in, a ranked list of best fits out. Here is the whole idea.</p>
  <div class="card diagram-card">${beamDiagram(FLOW_NODES, FLOW_EDGES, { w: 720, h: 260 })}</div>
  <div class="steps-grid">${STEPS.map(([n, t, d]) => `<div class="card step"><span class="stepnum">${n}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
  <h2 class="sec">Under the hood</h2>
  <div class="cols">
    <div class="card"><h3>Models (via OpenRouter)</h3>
      <div class="item"><b>Reading people</b>${esc(models.analysis)}</div><div class="item"><b>Running dates</b>${esc(models.date)}</div><div class="item"><b>Backup</b>${esc(models.fallback)}</div></div>
    <div class="card"><h3>The match score</h3><p style="margin:0">Mostly how both agents rated the date, plus how well their dimensions line up and a small bonus if both want a second date. It is an AI opinion, not a fact.</p>
      <p style="margin:10px 0 0;color:var(--muted)">Scraping: Apify. Private Instagram accounts are skipped.</p></div>
  </div>`, "about");
}
