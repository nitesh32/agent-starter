import { beamDiagram, type BeamNode } from "./beams.js";
import { icon } from "./icons.js";
import { alertError, avatar, badge, bar, bubble, button, chips, emptyState, esc, field, layout, skeleton, type Who } from "./ui.js";

// ---------- small composition helpers ----------
const H1 = "text-3xl font-semibold leading-tight tracking-tight md:text-5xl";
const MUTED = "text-muted-foreground";
const section = (title: string, body: string, id = "") =>
  `<section class="border-t py-8"${id ? ` id="${id}"` : ""}><h2 class="mb-5 text-2xl font-semibold tracking-tight">${esc(title)}</h2>${body}</section>`;
const cols = (...cells: string[]) => `<div class="grid gap-x-12 gap-y-8 md:grid-cols-2">${cells.join("")}</div>`;
const col = (title: string, body: string) => `<div class="grid content-start gap-3"><h3 class="font-medium">${esc(title)}</h3>${body}</div>`;
const source = (s: string) => `<span class="badge" data-variant="outline">${s === "linkedin" ? "LinkedIn" : "Instagram"}</span>`;
const evidence = (ev: { source: string; quote: string }[] = []) =>
  ev.map((e) => `<p class="ev">${source(e.source)}<q>${esc(e.quote)}</q></p>`).join("");
const item = (k: string, v: string) => (v ? `<div class="grid gap-0.5 py-3 not-first:border-t"><b class="font-medium">${esc(k)}</b><span class="${MUTED}">${esc(v)}</span></div>` : "");
const externalLink = (href: string, label: string, ic: "linkedin" | "instagram") =>
  `<a class="btn" data-variant="link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icon(ic)}${label}${icon("external", 14)}<span class="sr-only">(opens in a new tab)</span></a>`;
const table = (head: (string | [string, string])[], rows: string[], caption: string) =>
  `<div class="table-container"><table class="table"><caption class="sr-only">${esc(caption)}</caption><thead><tr>${head.map((h) => (Array.isArray(h) ? `<th class="${h[1]}">${h[0]}</th>` : `<th>${h}</th>`)).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const scoreCell = (n: number | null) => `<span class="text-lg font-semibold tabular-nums">${n != null ? Math.round(n) : "–"}</span>`;

// ---------------- home ----------------
export function homePage(people: any[]): string {
  const cards = people.map((p) => `
    <li><a class="card h-full transition-colors hover:border-primary" href="/person/${p.id}" data-person="${p.id}"><section class="grid gap-3">
      <div class="flex items-center gap-3">${avatar(p)}<div class="min-w-0 grow"><h3 class="truncate font-medium">${esc(p.name)}</h3>${badge(p.status)}</div></div>
      <p class="line-clamp-2 text-sm ${MUTED}">${esc(p.tagline || (p.status === "failed" ? p.error : "The agent is still getting to know them."))}</p>
    </section></a></li>`).join("");
  return layout("People", `
  <section class="pb-10">
    <h1 class="max-w-[16ch] ${H1}">Agents date so you don't have to</h1>
    <p class="mt-3 max-w-[60ch] ${MUTED}">Add a LinkedIn and a public Instagram. Their agent reads them, goes on first dates with other people's agents, and ranks who fits best.</p>
    <form id="add" class="mt-6 grid max-w-4xl items-end gap-3 md:grid-cols-[1fr_1fr_auto]" novalidate>
      ${field("li", "LinkedIn URL", '<input class="input" id="li" type="text" name="linkedin_url" placeholder="linkedin.com/in/username" autocomplete="off" required>')}
      ${field("ig", "Instagram URL or handle", '<input class="input" id="ig" type="text" name="instagram_url" placeholder="@username" autocomplete="off" required>')}
      <button class="btn" type="submit">${icon("users")}Create agent</button>
    </form>
    <p id="formmsg" class="mt-2 min-h-6 text-sm text-destructive" role="alert"></p>
  </section>
  <section class="border-t py-8">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 class="text-2xl font-semibold tracking-tight">People <span class="${MUTED} font-normal">${people.length}</span></h2>
      <div class="flex flex-wrap gap-2">${button("Run dating round", { id: "run-round", ic: "heart" })}${button("Rankings", { href: "/rankings", variant: "outline", ic: "trophy" })}${button("Watch live", { href: "/live", variant: "outline", ic: "radio" })}</div></div>
    ${cards ? `<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" id="people">${cards}</ul>` : emptyState("No one here yet", "Add a LinkedIn and Instagram above to create the first agent.")}
  </section>`, "home", 'data-page="home"');
}

// ---------------- person ----------------
function steps(p: any): string {
  const pr = p.progress ?? {};
  const li = (label: string, v: string | undefined) =>
    `<li class="flex items-center gap-2 ${v === "done" ? "text-success" : v === "failed" ? "text-destructive" : MUTED}">${icon(v === "done" ? "check" : v === "failed" ? "x" : "refresh", 16)}<span>${label}${v === "failed" ? " failed" : v === "done" ? "" : "…"}</span></li>`;
  const readDone = pr.linkedin === "done" && pr.instagram === "done";
  return `<ol class="mb-6 grid gap-2" aria-live="polite">
    ${p.status === "queued" ? `<li class="flex items-center gap-2 ${MUTED}">${icon("refresh", 16)}<span>Waiting in the queue…</span></li>` : ""}
    ${li("Scraping LinkedIn", pr.linkedin)}${li("Scraping Instagram", pr.instagram)}
    ${readDone ? li("Reading personality, needs and voice", p.status === "analyzing" ? "running" : p.status === "ready" ? "done" : undefined) : ""}</ol>`;
}

const tabs = (id: string, items: [string, string][]) => `
  <div class="tabs" id="${id}" data-variant="line">
    <nav role="tablist" aria-orientation="horizontal">${items.map(([label], i) => `<button type="button" role="tab" id="${id}-tab-${i}" aria-controls="${id}-panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${label}</button>`).join("")}</nav>
    ${items.map(([, body], i) => `<div role="tabpanel" id="${id}-panel-${i}" tabindex="-1" aria-labelledby="${id}-tab-${i}" class="pt-6"${i === 0 ? "" : " hidden"}>${body}</div>`).join("")}
  </div>`;

export function personPage(p: any, dates: any[], ranking: any[]): string {
  const head = `<header class="flex flex-wrap items-center gap-6 pb-8">${avatar(p, "xl")}<div class="min-w-0 grow">
      <h1 class="${H1}">${esc(p.name)}</h1>
      <div class="mt-2 flex flex-wrap items-center gap-3">${badge(p.status)}<span class="${MUTED}">${esc(p.linkedin?.headline || "")}</span></div>
      <div class="mt-2 -ml-3 flex flex-wrap">${externalLink(p.linkedin_url, "LinkedIn", "linkedin")}${externalLink(p.instagram_url, "Instagram", "instagram")}</div>
    </div></header>`;
  const attrs = `data-page="person" data-id="${p.id}" data-status="${esc(p.status)}"`;
  if (p.status === "failed") {
    return layout(p.name, `${head}${alertError("We couldn't build this agent", p.error ?? "Unknown error", button("Try again", { id: "retry", ic: "refresh" }))}`, "", attrs);
  }
  const a = p.analysis;
  if (!a) return layout(p.name, `${head}${section("Building this agent", steps(p) + skeleton(4))}`, "", attrs);

  const li = a.lifestyle, car = a.career, pe = a.personality;
  const overview = `
    <div class="mb-8 grid max-w-3xl gap-3"><p class="text-2xl font-semibold leading-tight tracking-tight">${esc(a.headline_tagline)}</p><p>${esc(a.summary)}</p>
      <p class="text-sm ${MUTED}">Agent confidence ${Math.round(a.confidence * 100)}%</p></div>
    ${cols(
      col("Personality", chips(pe.traits) + bar("Introvert to extrovert", pe.introvert_extrovert) + bar("Adventurous", pe.adventurous) + bar("Ambition", pe.ambition) + `<p class="text-sm ${MUTED}">Humor: ${esc(pe.humor_style)}</p>`),
      col("Lifestyle", item("Pace", li.pace) + item("Social life", li.social_life) + item("Travel", li.travel) + item("Fitness", li.fitness) + item("City", li.city)),
      col("Values", chips(a.values)),
      col("Career", item(`${car.field} · ${car.stage}`, car.ambition_notes)),
      col("Looking for", `<p>${esc(a.looking_for)}</p>`),
      col("Green flags and dealbreakers", chips(a.green_flags, "good") + chips(a.dealbreakers, "bad")),
    )}`;
  const evidenceTab = cols(
    col("Needs", a.needs.map((n: any) => `<div class="grid gap-1 py-3 not-first:border-t"><b class="font-medium">${esc(n.need)}</b><span class="${MUTED}">${esc(n.why)}</span>${evidence(n.evidence)}</div>`).join("") || `<p class="${MUTED}">None found.</p>`),
    col("Hobbies and interests", [...a.hobbies, ...a.interests].map((h: any) => `<div class="grid gap-1 py-3 not-first:border-t"><b class="font-medium">${esc(h.name)}</b>${evidence(h.evidence)}</div>`).join("") || `<p class="${MUTED}">None found.</p>`),
    col("How they talk", `<p class="text-sm ${MUTED}">${esc(a.voice.tone)} · ${esc(a.voice.vocabulary)} · emoji: ${esc(a.voice.emoji_use)}</p>${a.voice.sample_lines.map((l: string) => `<p class="ev"><q>${esc(l)}</q></p>`).join("")}`),
    col("Ideal first date", `<p>${esc(a.ideal_first_date)}</p>${a.data_gaps.length ? `<h4 class="mt-2 text-sm font-medium">What the agent couldn't tell</h4>${chips(a.data_gaps)}` : ""}`),
  );
  const fits = `<h3 class="mb-3 font-medium">Best fits</h3>${ranking.length
    ? table(["#", "Partner", ["Why", "hidden md:table-cell"], "Score"], ranking.map((r, i) => rankRow(r, i + 1)), "Best fits ranked by match score")
    : emptyState("No finished dates yet", "Run a dating round to see who fits best.", button("Run dating round", { id: "run-round", ic: "heart" }), "heart")}
    <h3 class="mb-3 mt-8 font-medium">All dates</h3>${dates.length
    ? table(["Partner", ["Date", "hidden md:table-cell"], "Status", "Score"], dates.map(dateRow), "All dates for this person")
    : emptyState("No dates yet", "Dates appear here once this agent is paired with someone.", "", "users")}`;

  return layout(p.name, `${head}${tabs("person-tabs", [["Overview", overview], ["Evidence", evidenceTab], ["Fits and dates", fits]])}`, "", attrs, `${p.name}: ${a.headline_tagline}`);
}

const rankRow = (r: any, n: number, withWhy = true) => `<tr>
  <td class="w-10 text-muted-foreground tabular-nums">${n}</td>
  <td><a class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 hover:underline" href="/date/${r.date_id}">${avatar({ id: r.partner_id, name: r.partner_name, has_photo: r.partner_has_photo }, "sm")}<span class="truncate font-medium">${esc(r.partner_name)}</span>${r.mutual ? '<span class="badge" data-variant="outline">Mutual match</span>' : ""}</a></td>
  ${withWhy ? `<td class="hidden max-w-md text-sm text-muted-foreground md:table-cell"><span class="line-clamp-2">${esc(r.my_verdict?.why || r.partner_tagline || "")}</span></td>` : ""}
  <td class="text-right">${scoreCell(r.match_score)}</td></tr>`;

const dateRow = (d: any) => `<tr>
  <td><a class="flex min-w-0 items-center gap-3 hover:underline" href="/date/${d.id}">${avatar({ id: d.partner_id, name: d.partner_name, has_photo: d.partner_has_photo }, "sm")}<span class="truncate font-medium">${esc(d.partner_name)}</span></a></td>
  <td class="hidden max-w-md text-sm text-muted-foreground md:table-cell"><span class="line-clamp-2">${esc(d.setting?.activity || "Planning the date…")}</span></td>
  <td>${badge(d.status)}</td><td class="text-right">${scoreCell(d.match_score)}</td></tr>`;

// ---------------- date ----------------
const DIM: Record<string, string> = { values: "Values", lifestyle: "Lifestyle", interests: "Interests", communication: "Communication", life_goals: "Life goals", chemistry: "Chemistry" };

function debrief(p: Who, v: any): string {
  const head = `<div class="flex items-center gap-3">${avatar(p, "sm")}<h3 class="grow font-medium">${esc(p.name)}'s agent</h3>`;
  if (!v) return `<div class="card"><section class="grid gap-4">${head}</div><p class="${MUTED}">Debrief pending.</p>${skeleton(3)}</section></div>`;
  return `<div class="card"><section class="grid gap-4">${head}<span class="text-xl font-semibold tabular-nums">${v.overall}/10</span></div>
    <div><span class="badge" data-variant="${v.want_second_date ? "default" : "destructive"}">${v.want_second_date ? "Wants a second date" : "Passes"}</span></div>
    ${Object.keys(DIM).map((k) => bar(DIM[k], v.scores?.[k] ?? 0)).join("")}
    <p class="ev"><b class="block text-xs uppercase tracking-wide text-foreground">Best moment</b><q>${esc(v.best_moment)}</q></p>
    ${v.concerns?.length ? `<h4 class="text-sm font-medium">Concerns</h4>${chips(v.concerns, "bad")}` : ""}
    <p>${esc(v.why)}</p></section></div>`;
}

const intentBlock = (p: Who, i: any) => i ? `<details class="border-t py-1"><summary class="flex min-h-11 cursor-pointer items-center font-medium">${esc(p.name)}'s private intent</summary>
  <div class="grid gap-3 pb-3"><h4 class="text-sm font-medium">Wants to find out</h4>${chips(i.find_out)}<h4 class="text-sm font-medium">Questions</h4>${i.questions.map((q: string) => `<p class="ev">${esc(q)}</p>`).join("")}
  <h4 class="text-sm font-medium">Dealbreakers</h4>${chips(i.dealbreakers, "bad")}</div></details>` : "";

export function datePage(d: any, a: Who, b: Who, turns: any[]): string {
  const live = d.status !== "done" && d.status !== "failed";
  const bubbles = turns.map((t) => bubble(t.speaker_id === a.id ? a : b, t.text, t.speaker_id === a.id ? "l" : "r")).join("");
  const waiting = live && !turns.length ? `<div id="chat-wait" class="mt-4">${skeleton(3)}</div>` : "";
  const body = `
  <header class="flex flex-wrap items-center gap-6 pb-8">
    <div class="avatar-group"><a href="/person/${a.id}" aria-label="${esc(a.name)}">${avatar(a)}</a><a href="/person/${b.id}" aria-label="${esc(b.name)}">${avatar(b)}</a></div>
    <div class="min-w-0 grow"><h1 class="${H1}">${esc(a.name)} and ${esc(b.name)}</h1>
    <p class="mt-2 max-w-[70ch] ${MUTED}">${d.setting ? `${d.setting.activity.length <= 80 ? `<b class="font-medium text-foreground">${esc(d.setting.activity)}</b> — ` : ""}${esc(d.setting.venue)}. ${esc(d.setting.scene)}` : "The agents are planning the date."}</p></div>
  </header>
  ${d.status === "failed" ? alertError("This date failed", d.error ?? "Unknown error") : ""}
  <div class="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_320px]">
    <section class="border-t py-8" aria-label="Transcript">
      <div class="flex items-center justify-between"><h2 class="text-2xl font-semibold tracking-tight">Transcript</h2>${button("Replay", { id: "replay", variant: "outline", ic: "play", disabled: !turns.length })}</div>
      <div class="chat" id="chat" role="log" aria-live="${live ? "polite" : "off"}" data-a="${a.id}">${bubbles}</div>${waiting}
    </section>
    <aside class="border-t py-8 max-lg:order-first" aria-label="Result">
      ${d.status === "done" ? `<div class="mb-6 grid gap-2"><div class="text-5xl font-semibold leading-none tracking-tight tabular-nums">${Math.round(d.match_score)}</div>
        <p>match score${d.mutual ? ' <span class="badge ml-1" data-variant="outline">Mutual match</span>' : ""}</p>
        <p class="text-sm ${MUTED}">50% geometric mean of both overall scores, 30% dimension average, 20% pre-date compatibility, +5 if both want a second date.</p></div>` : `<p class="mb-6 ${MUTED}">${live ? "The match score appears when both agents finish their debriefs." : ""}</p>`}
      <h3 class="mb-1 font-medium">Private intents</h3>${intentBlock(a, d.intent_a)}${intentBlock(b, d.intent_b)}
    </aside>
  </div>
  ${section("Private debriefs", cols(debrief(a, d.verdict_a), debrief(b, d.verdict_b)))}`;
  const people = { [a.id]: { name: a.name, photo: !!a.has_photo }, [b.id]: { name: b.name, photo: !!b.has_photo } };
  return layout(`${a.name} and ${b.name}`, body + `<script>window.PEOPLE=${JSON.stringify(people).replace(/</g, "\\u003c")}</script>`, "", `data-page="date" data-id="${d.id}" data-status="${esc(d.status)}"`);
}

// ---------------- live ----------------
export function livePage(dates: any[], people: Record<number, { name: string; photo: boolean }>): string {
  const cards = dates.map((d) => `
    <li class="card" data-date="${d.id}" data-a="${d.a.id}"><section class="grid gap-2">
      <div class="flex items-center justify-between"><div class="flex items-center gap-2">${avatar(d.a, "sm")}${icon("heart", 16, "text-primary")}${avatar(d.b, "sm")}</div>${badge(d.status)}</div>
      <a class="font-medium hover:underline" href="/date/${d.id}">${esc(d.a.name)} and ${esc(d.b.name)}</a>
      <p class="text-sm ${MUTED}">${esc(d.setting?.activity || "Planning…")}</p>
      <div class="chat" role="log" aria-live="polite">${d.turns.map((t: any) => bubble(t.speaker_id === d.a.id ? d.a : d.b, t.text, t.speaker_id === d.a.id ? "l" : "r")).join("")}</div>
    </section></li>`).join("");
  return layout("Live", `
  <header class="mb-8 flex flex-wrap items-end justify-between gap-4"><div><h1 class="${H1}">Live dating floor</h1><p class="mt-2 ${MUTED}">Dates in progress stream in here as they happen.</p></div>
    ${button("Run dating round", { id: "run-round", ic: "heart" })}</header>
  <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" id="floor">${cards}</ul>
  <div id="floor-empty" ${cards ? "hidden" : ""}>${emptyState("No dates in progress", "Start a dating round and the conversations will appear here live.", "", "radio")}</div>
  <script>window.PEOPLE=${JSON.stringify(people).replace(/</g, "\\u003c")}</script>`, "live", 'data-page="live"');
}

// ---------------- rankings ----------------
export function rankingsPage(rows: { person: any; top: any[] }[]): string {
  const cards = rows.map(({ person: p, top }) => `
    <li class="card"><header><a class="flex min-h-11 items-center gap-3" href="/person/${p.id}">${avatar(p)}<div class="min-w-0"><h2 class="truncate">${esc(p.name)}</h2><p class="line-clamp-1">${esc(p.tagline || "")}</p></div></a></header>
      <section>${top.length ? table(["#", "Partner", "Score"], top.map((r, i) => rankRow(r, i + 1, false)), `Top matches for ${p.name}`) : `<p class="text-sm ${MUTED}">No finished dates yet.</p>`}</section></li>`).join("");
  return layout("Rankings", `<header class="mb-8"><h1 class="${H1}">Best fits</h1><p class="mt-2 ${MUTED}">Each person's top matches, scored by both agents after the date.</p></header>
    ${cards ? `<ul class="grid gap-4 lg:grid-cols-2">${cards}</ul>` : emptyState("No people yet", "Add someone on the People page to start.", button("Add a person", { href: "/" }))}`, "rankings");
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
  <header class="mb-8"><h1 class="${H1}">How it works</h1><p class="mt-2 ${MUTED}">Two profiles in, a ranked list of best fits out.</p></header>
  <div class="card"><section>${beamDiagram(FLOW_NODES, FLOW_EDGES, { w: 720, h: 250 }, "LinkedIn and Instagram feed an analysis agent, then agents date each other, then a ranking is produced")}</section></div>
  <ol class="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">${STEPS.map(([t, d], i) => `<li class="grid content-start gap-3"><span class="inline-flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">${i + 1}</span><div><h3 class="font-medium">${t}</h3><p class="mt-1 text-sm ${MUTED}">${d}</p></div></li>`).join("")}</ol>
  ${section("Under the hood", cols(
    col("Models, via OpenRouter", item("Reading people", models.analysis) + item("Running dates", models.date) + item("Backup", models.fallback)),
    col("The match score", `<p>Mostly how both agents rated the date, plus how well their dimensions line up, with a small bonus if both want a second date. It is an AI opinion, not a fact.</p><p class="text-sm ${MUTED}">Scraping runs on Apify. Private Instagram accounts are skipped.</p>`),
  ))}`, "about");
}
