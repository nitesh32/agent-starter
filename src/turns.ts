// Makes date conversations feel like real chat: varied message lengths, occasional (not constant)
// scene actions, and a natural opening and wind-down. Pure functions, seeded so a date is reproducible.

export interface Shape { key: string; ask: string; maxTokens: number; weight: number }

const SHAPES: Shape[] = [
  { key: "blip", ask: "a quick reaction of 2 to 8 words (like a text reply)", maxTokens: 40, weight: 22 },
  { key: "short", ask: "one short sentence, about 8 to 16 words", maxTokens: 70, weight: 33 },
  { key: "medium", ask: "two short sentences, about 18 to 32 words", maxTokens: 110, weight: 30 },
  { key: "long", ask: "a fuller reply, about 35 to 55 words, because you have something real to say", maxTokens: 170, weight: 15 },
];
const byKey = (k: string) => SHAPES.find((s) => s.key === k)!;

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TurnPlan { shape: Shape; allowAction: boolean; phase: "open" | "middle" | "close" }

export function planTurn(dateId: number, idx: number, total: number, prevShape?: string): TurnPlan {
  const r = rng(dateId * 7919 + idx * 104729);
  const phase = idx === 0 ? "open" : idx >= total - 2 ? "close" : "middle";
  let pool = SHAPES;
  if (phase === "open") pool = SHAPES.filter((s) => s.key === "short" || s.key === "medium");
  if (phase === "close") pool = SHAPES.filter((s) => s.key !== "long");
  if (prevShape === "long") pool = pool.filter((s) => s.key !== "long"); // never two speeches in a row
  if (prevShape && prevShape === "blip") pool = pool.filter((s) => s.key !== "blip");
  const total_w = pool.reduce((s, p) => s + p.weight, 0);
  let pick = r() * total_w;
  const shape = pool.find((p) => (pick -= p.weight) < 0) ?? pool[0];
  return { shape, allowAction: idx > 0 && r() < 0.22, phase };
}

export function turnInstruction(plan: TurnPlan, otherName: string): string {
  const phase = {
    open: "This is the very first line of the date: a natural, low-key opener (a greeting or a comment on the place). Do not interview them yet.",
    middle: "",
    close: "The date is winding down. Be natural about it: share an honest feeling about how it went or what you would do next, without summarising the whole conversation.",
  }[plan.phase];
  return [
    `For THIS turn write ${plan.shape.ask}.`,
    phase,
    plan.allowAction ? "You may include one tiny scene action in *italics* (max 5 words), never as the first words." : "No *actions* or stage directions this turn. Plain speech only.",
    `Sound like a real person talking, not a speech: contractions, fragments, an occasional "haha" or "honestly" if it fits their voice. Ask a question only if it is natural (most turns should not end in one). React to what ${otherName} actually said instead of repeating it back. It is fine to tease, disagree, joke, or change the subject. Never open by praising what they said.`,
  ].filter(Boolean).join(" ");
}

/** Clean model output: strip speaker labels/quotes, enforce the action rule, never end mid-sentence. */
export function finalizeLine(raw: string, name: string, plan: TurnPlan): string {
  let t = raw.trim().replace(new RegExp(`^\\**${name.split(" ")[0]}\\**\\s*:\\s*`, "i"), "").replace(/^"(.*)"$/s, "$1").trim();
  if (!plan.allowAction) t = t.replace(/\*[^*]+\*/g, "").replace(/\s{2,}/g, " ").trim();
  else t = t.replace(/^\*[^*]+\*\s*/, "").trim() || t; // an action may follow speech, not lead it
  // If the token cap cut the line off, keep only complete sentences.
  if (t && !/[.!?…"')\]\u{1F300}-\u{1FAFF}*]$/u.test(t)) {
    const cut = Math.max(t.lastIndexOf(". "), t.lastIndexOf("? "), t.lastIndexOf("! "));
    if (cut > 12) t = t.slice(0, cut + 1);
  }
  return t || raw.trim();
}
