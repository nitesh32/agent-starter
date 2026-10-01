import { beamDiagram, type BeamNode } from "./beams.js";
import { icon } from "./icons.js";
import { avatar, badge, bar, bubble, chips, emptyState, esc, layout, skeleton, type Who } from "./ui.js";

const section = (title: string, body: string, id = "") =>
  `<section class="block"${id ? ` id="${id}"` : ""}><h2>${esc(title)}</h2>${body}</section>`;
const col = (title: string, body: string) => `<div class="col"><h3>${esc(title)}</h3>${body}</div>`;
const source = (s: string) => `<span class="src">${s === "linkedin" ? "LinkedIn" : "Instagram"}</span>`;
const evidence = (ev: { source: string; quote: string }[] = []) =>
  ev.map((e) => `<p class="ev">${source(e.source)}<q>${esc(e.quote)}</q></p>`).join("");
const externalLink = (href: string, label: string, ic: "linkedin" | "instagram") =>
  `<a class="link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icon(ic)}${label}${icon("external", 14)}<span class="sr">(opens in a new tab)</span></a>`;

// ---------------- home ----------------
export function homePage(people: any[]): string {
  const cards = people.map((p) => `
    <li><a class="card pcard" href="/person/${p.id}" data-person="${p.id}">
      <div class="row">${avatar(p)}<div class="grow"><h3 class="trunc">${esc(p.name)}</h3>${badge(p.status)}</div></div>
      <p class="clamp muted">${esc(p.tagline || (p.status === "failed" ? p.error : "The agent is still getting to know them."))}</p>
    </a></li>`).join("");
  return layout("People", `
  <section class="hero">
    <h1>Agents date so you don't have to</h1>
    <p class="lede">Add a LinkedIn and a public Instagram. Their agent reads them, goes on first dates with other people's agents, and ranks who fits best.</p>
    <form id="add" class="form" novalidate>
      <div class="field"><label for="li">LinkedIn URL</label><input id="li" type="text" name="linkedin_url" placeholder="linkedin.com/in/username" autocomplete="off" required></div>
      <div class="field"><label for="ig">Instagram URL or handle</label><input id="ig" type="text" name="instagram_url" placeholder="@username" autocomplete="off" required></div>
      <button class="btn" type="submit">Create agent</button>
    </form>
    <p id="formmsg" class="formmsg" role="alert"></p>
  </section>
  <section class="block">
    <div class="row spread wrapx"><h2>People <span class="count">${people.length}</span></h2>
      <div class="row wrapx"><button class="btn" id="run-round" type="button">${icon("heart")}Run dating round</button>
        <a class="btn secondary" href="/rankings">${icon("trophy")}Rankings</a><a class="btn secondary" href="/live">${icon("radio")}Watch live</a></div></div>
    ${cards ? `<ul class="grid" id="people">${cards}</ul>` : emptyState("No one here yet", "Add a LinkedIn and Instagram above to create the first agent.")}
  </section>`, "home", 'data-page="home"');
}

// ---------------- person ----------------
function steps(p: any): string {
  const pr = p.progress ?? {};
  const li = (label: string, v: string | undefined) =>
    `<li class="${v === "done" ? "ok" : v === "failed" ? "bad" : "run"}">${icon(v === "done" ? "check" : v === "failed" ? "x" : "refresh", 16)}<span>${label}${v === "failed" ? " failed" : v === "done" ? "" : "…"}</span></li>`;
  const readDone = pr.linkedin === "done" && pr.instagram === "done";
  return `<ol class="steps" aria-live="polite">
    ${p.status === "queued" ? `<li class="run">${icon("refresh", 16)}<span>Waiting in the queue…</span></li>` : ""}
    ${li("Scraping LinkedIn", pr.linkedin)}${li("Scraping Instagram", pr.instagram)}
    ${readDone ? li("Reading personality, needs and voice", p.status === "analyzing" ? "running" : p.status === "ready" ? "done" : undefined) : ""}</ol>`;
}

export function personPage(p: any, dates: any[], ranking: any[]): string {
  const head = `<header class="profile-head">${avatar(p, "xl")}<div class="grow">
      <h1>${esc(p.name)}</h1>
      <p class="row wrapx" style="margin:0">${badge(p.status)}<span class="muted">${esc(p.linkedin?.headline || "")}</span></p>
      <p class="links">${externalLink(p.linkedin_url, "LinkedIn", "linkedin")}${externalLink(p.instagram_url, "Instagram", "instagram")}</p>
    </div></header>`;
  const attrs = `data-page="person" data-id="${p.id}" data-status="${esc(p.status)}"`;
  if (p.status === "failed") {
    return layout(p.name, `${head}${section("Something went wrong", `<p>${esc(p.error)}</p><button class="btn" id="retry" type="button">${icon("refresh")}Try again</button>`)}`, "", attrs);
  }
  const a = p.analysis;
  if (!a) return layout(p.name, `${head}${section("Building this agent", steps(p) + skeleton(4))}`, "", attrs);

  const li = a.lifestyle, car = a.career, pe = a.personality;
  const item = (k: string, v: string) => (v ? `<div class="item"><b>${k}</b>${esc(v)}</div>` : "");
  const body = `${head}
  <section class="block lead"><p class="tagline">${esc(a.headline_tagline)}</p><p>${esc(a.summary)}</p>
    <p class="muted small">Agent confidence ${Math.round(a.confidence * 100)}%</p></section>

  ${section("How the agent read this person", `<div class="cols">
    ${col("Needs", a.needs.map((n: any) => `<div class="item"><b>${esc(n.need)}</b>${esc(n.why)}${evidence(n.evidence)}</div>`).join("") || '<p class="muted">None found.</p>')}
    ${col("Hobbies and interests", [...a.hobbies, ...a.interests].map((h: any) => `<div class="item"><b>${esc(h.name)}</b>${evidence(h.evidence)}</div>`).join("") || '<p class="muted">None found.</p>')}</div>`)}

  ${section("Personality and lifestyle", `<div class="cols">
    ${col("Personality", chips(pe.traits) + bar("Introvert to extrovert", pe.introvert_extrovert) + bar("Adventurous", pe.adventurous) + bar("Ambition", pe.ambition) + `<p class="muted">Humor: ${esc(pe.humor_style)}</p>`)}
    ${col("Lifestyle", item("Pace", li.pace) + item("Social life", li.social_life) + item("Travel", li.travel) + item("Fitness", li.fitness) + item("City", li.city))}</div>
    <div class="cols">${col("Values", chips(a.values))}${col("Career", item(`${car.field} · ${car.stage}`, car.ambition_notes))}</div>`)}

  ${section("What they're looking for", `<div class="cols">
    ${col("Looking for", `<p>${esc(a.looking_for)}</p>`)}
    ${col("Green flags", chips(a.green_flags, "good"))}${col("Dealbreakers", chips(a.dealbreakers, "bad"))}</div>`)}

  ${section("Voice and first date", `<div class="cols">
    ${col("How they talk", `<p class="muted">${esc(a.voice.tone)} · ${esc(a.voice.vocabulary)} · emoji: ${esc(a.voice.emoji_use)}</p>${a.voice.sample_lines.map((l: string) => `<p class="ev"><q>${esc(l)}</q></p>`).join("")}`)}
    ${col("Ideal first date", `<p>${esc(a.ideal_first_date)}</p>${a.data_gaps.length ? `<h3>What the agent couldn't tell</h3>${chips(a.data_gaps)}` : ""}`)}</div>`)}

  ${section("Best fits", ranking.length ? `<ol class="list">${ranking.map((r, i) => rankRow(r, i + 1)).join("")}</ol>` : emptyState("No finished dates yet", "Run a dating round to see who fits best.", `<button class="btn" id="run-round" type="button">${icon("heart")}Run dating round</button>`), "fits")}
  ${section("Dates", dates.length ? `<ul class="list">${dates.map(dateRow).join("")}</ul>` : emptyState("No dates yet", "Dates appear here once this agent is paired with someone."))}`;
  return layout(p.name, body, "", attrs, `${p.name}: ${a.headline_tagline}`);
}

const rankRow = (r: any, n: number) => `
  <li><a class="listrow" href="/date/${r.date_id}"><span class="rank">${n}</span>${avatar({ id: r.partner_id, name: r.partner_name, has_photo: r.partner_has_photo }, "sm")}
    <div class="grow"><b class="trunc">${esc(r.partner_name)}</b>${r.mutual ? '<span class="badge b-mutual">Mutual match</span>' : ""}<div class="sub clamp">${esc(r.my_verdict?.why || r.partner_tagline || "")}</div></div>
    <span class="score" aria-label="Match score ${Math.round(r.match_score)}">${Math.round(r.match_score)}</span></a></li>`;

const dateRow = (d: any) => `
  <li><a class="listrow" href="/date/${d.id}">${avatar({ id: d.partner_id, name: d.partner_name, has_photo: d.partner_has_photo }, "sm")}
    <div class="grow"><b class="trunc">${esc(d.partner_name)}</b><div class="sub clamp">${esc(d.setting?.activity || "Planning the date…")}</div></div>
    ${badge(d.status)}<span class="score">${d.match_score != null ? Math.round(d.match_score) : "–"}</span></a></li>`;

// ---------------- date ----------------
const DIM: Record<string, string> = { values: "Values", lifestyle: "Lifestyle", interests: "Interests", communication: "Communication", life_goals: "Life goals", chemistry: "Chemistry" };

function debrief(p: Who, v: any): string {
  const head = `<div class="row">${avatar(p, "sm")}<h3 class="grow">${esc(p.name)}'s agent</h3>`;
  if (!v) return `<div class="col">${head}</div><p class="muted">Debrief pending.</p>${skeleton(3)}</div>`;
  return `<div class="col">${head}<span class="score">${v.overall}/10</span></div>
    <p><span class="badge ${v.want_second_date ? "b-ready" : "b-failed"}">${v.want_second_date ? "Wants a second date" : "Passes"}</span></p>
    ${Object.keys(DIM).map((k) => bar(DIM[k], v.scores?.[k] ?? 0)).join("")}
    <p class="ev"><b>Best moment</b><q>${esc(v.best_moment)}</q></p>
    ${v.concerns?.length ? `<h4>Concerns</h4>${chips(v.concerns, "bad")}` : ""}
    <p>${esc(v.why)}</p></div>`;
}

const intentBlock = (p: Who, i: any) => i ? `<details class="disclosure"><summary>${esc(p.name)}'s private intent</summary>
  <h4>Wants to find out</h4>${chips(i.find_out)}<h4>Questions</h4>${i.questions.map((q: string) => `<p class="ev">${esc(q)}</p>`).join("")}
  <h4>Dealbreakers</h4>${chips(i.dealbreakers, "bad")}</details>` : "";

export function datePage(d: any, a: Who, b: Who, turns: any[]): string {
  const live = d.status !== "done" && d.status !== "failed";
  const bubbles = turns.map((t) => bubble(t.speaker_id === a.id ? a : b, t.text, t.speaker_id === a.id ? "l" : "r")).join("");
  const waiting = live && !turns.length ? `<div id="chat-wait">${skeleton(3)}</div>` : "";
  const body = `
  <header class="date-head">
    <div class="pair"><a href="/person/${a.id}" aria-label="${esc(a.name)}">${avatar(a, "lg")}</a><a href="/person/${b.id}" aria-label="${esc(b.name)}">${avatar(b, "lg")}</a></div>
    <div><h1>${esc(a.name)} and ${esc(b.name)}</h1>
    <p class="lede">${d.setting ? `${d.setting.activity.length <= 80 ? `<b>${esc(d.setting.activity)}</b> — ` : ""}${esc(d.setting.venue)}. ${esc(d.setting.scene)}` : "The agents are planning the date."}</p></div>
  </header>
  ${d.status === "failed" ? section("This date failed", `<p>${esc(d.error)}</p>`) : ""}
  <div class="date-layout">
    <section class="block" aria-label="Transcript">
      <div class="row spread"><h2>Transcript</h2><button class="btn secondary" id="replay" type="button" ${turns.length ? "" : "disabled"}>${icon("play")}Replay</button></div>
      <div class="chat" id="chat" role="log" aria-live="${live ? "polite" : "off"}" data-a="${a.id}">${bubbles}</div>${waiting}
    </section>
    <aside class="block side" aria-label="Result">
      ${d.status === "done" ? `<div class="final"><div class="big">${Math.round(d.match_score)}</div><p>match score${d.mutual ? ' <span class="badge b-mutual">Mutual match</span>' : ""}</p>
        <p class="muted small">50% geometric mean of both overall scores, 30% dimension average, 20% pre-date compatibility, +5 if both want a second date.</p></div>` : `<p class="muted">${live ? "The match score appears when both agents finish their debriefs." : ""}</p>`}
      <h3>Private intents</h3>${intentBlock(a, d.intent_a)}${intentBlock(b, d.intent_b)}
    </aside>
  </div>
  ${section("Private debriefs", `<div class="cols">${debrief(a, d.verdict_a)}${debrief(b, d.verdict_b)}</div>`)}`;
  const people = { [a.id]: { name: a.name, photo: !!a.has_photo }, [b.id]: { name: b.name, photo: !!b.has_photo } };
  return layout(`${a.name} and ${b.name}`, body + `<script>window.PEOPLE=${JSON.stringify(people).replace(/</g, "\\u003c")}</script>`, "", `data-page="date" data-id="${d.id}" data-status="${esc(d.status)}"`);
}

// ---------------- live ----------------
export function livePage(dates: any[], people: Record<number, { name: string; photo: boolean }>): string {
  const cards = dates.map((d) => `
    <li class="card livecard" data-date="${d.id}" data-a="${d.a.id}">
      <div class="row spread"><div class="row">${avatar(d.a, "sm")}${icon("heart", 16, "accent")}${avatar(d.b, "sm")}</div>${badge(d.status)}</div>
      <a href="/date/${d.id}"><b>${esc(d.a.name)} and ${esc(d.b.name)}</b></a>
      <p class="sub muted">${esc(d.setting?.activity || "Planning…")}</p>
      <div class="chat" role="log" aria-live="polite">${d.turns.map((t: any) => bubble(t.speaker_id === d.a.id ? d.a : d.b, t.text, t.speaker_id === d.a.id ? "l" : "r")).join("")}</div>
    </li>`).join("");
  return layout("Live", `
  <header class="row spread wrapx page-head"><div><h1>Live dating floor</h1><p class="lede">Dates in progress stream in here as they happen.</p></div>
    <button class="btn" id="run-round" type="button">${icon("heart")}Run dating round</button></header>
  <ul class="livegrid" id="floor">${cards}</ul>
  <div id="floor-empty" ${cards ? "hidden" : ""}>${emptyState("No dates in progress", "Start a dating round and the conversations will appear here live.")}</div>
  <script>window.PEOPLE=${JSON.stringify(people).replace(/</g, "\\u003c")}</script>`, "live", 'data-page="live"');
}

// ---------------- rankings ----------------
export function rankingsPage(rows: { person: any; top: any[] }[]): string {
  const cards = rows.map(({ person: p, top }) => `
    <li class="card"><a class="row" href="/person/${p.id}">${avatar(p)}<div class="grow"><h2 class="trunc">${esc(p.name)}</h2><p class="sub muted clamp">${esc(p.tagline || "")}</p></div></a>
      ${top.length ? `<ol class="list">${top.map((r, i) => rankRow(r, i + 1)).join("")}</ol>` : '<p class="muted">No finished dates yet.</p>'}</li>`).join("");
  return layout("Rankings", `<header class="page-head"><h1>Best fits</h1><p class="lede">Each person's top matches, scored by both agents after the date.</p></header>
    ${cards ? `<ul class="grid wide">${cards}</ul>` : emptyState("No people yet", "Add someone on the People page to start.")}`, "rankings");
}

// ---------------- about ----------------
const FLOW_NODES: BeamNode[] = [
  { id: "li", label: "LinkedIn", sub: "work and skills", cx: 90, cy: 85, shape: "chip", w: 136, h: 48, tone: "var(--muted-foreground)" },
  { id: "ig", label: "Instagram", sub: "posts and tone", cx: 90, cy: 215, shape: "chip", w: 136, h: 48, tone: "var(--muted-foreground)" },
  { id: "read", label: "Reads them", sub: "analysis agent", cx: 280, cy: 130, shape: "hub", icon: "search" },
  { id: "date", label: "Dates", sub: "agent with agent", cx: 460, cy: 130, shape: "hub", icon: "heart" },
  { id: "rank", label: "Best fits", sub: "your ranking", cx: 640, cy: 130, shape: "hub", icon: "trophy" },
];
const FLOW_EDGES = [{ from: "li", to: "read" }, { from: "ig", to: "read" }, { from: "read", to: "date" }, { from: "date", to: "rank" }];

const STEPS: [string, string][] = [
  ["We read two public pages", "Only a person's LinkedIn and public Instagram. Nothing else is searched."],
  ["An agent works out who they are", "It writes down what they need, enjoy and value, and how they talk, with a quote as proof for each claim."],
  ["Agents go on dates", "Each person's agent chats with another agent, speaking as that person, on a first date."],
  ["Each agent gives honest feedback", "Afterwards both agents score the fit and say whether they'd meet again."],
  ["You get a ranking", "Everyone's dates are sorted by score, so you see who fits best and why."],
];

export function aboutPage(models: { analysis: string; date: string; fallback: string }): string {
  return layout("How it works", `
  <header class="page-head"><h1>How it works</h1><p class="lede">Two profiles in, a ranked list of best fits out.</p></header>
  <div class="diagram">${beamDiagram(FLOW_NODES, FLOW_EDGES, { w: 720, h: 250 }, "LinkedIn and Instagram feed an analysis agent, then agents date each other, then a ranking is produced")}</div>
  <ol class="steps-list">${STEPS.map(([t, d], i) => `<li><span class="stepnum">${i + 1}</span><div><h3>${t}</h3><p class="muted">${d}</p></div></li>`).join("")}</ol>
  ${section("Under the hood", `<div class="cols">
    ${col("Models, via OpenRouter", `<div class="item"><b>Reading people</b>${esc(models.analysis)}</div><div class="item"><b>Running dates</b>${esc(models.date)}</div><div class="item"><b>Backup</b>${esc(models.fallback)}</div>`)}
    ${col("The match score", `<p>Mostly how both agents rated the date, plus how well their dimensions line up, with a small bonus if both want a second date. It is an AI opinion, not a fact.</p><p class="muted">Scraping runs on Apify. Private Instagram accounts are skipped.</p>`)}</div>`)}`, "about");
}
