import { beamDiagram, type BeamNode } from "./beams.js";
import { icon } from "./icons.js";
import type { DatingSummary } from "../dating.js";
import { alertError, avatar, badge, bar, bubble, button, chips, fitLabel, fitBadge, fitMeter, notes, emptyState, esc, field, layout, skeleton, type Who } from "./ui.js";

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
function personResult(p: any): string {
  if (p.status === "failed") return "Couldn't read this profile. Open it to see why and try again.";
  if (p.status !== "ready") return p.tagline || "The agent is still getting to know them.";
  return p.dates_done ? `${p.dates_done} ${p.dates_done === 1 ? "date" : "dates"} · best fit ${Math.round(p.best_score)}` : "No dates yet";
}

/** One place that says what "dating" means, what is waiting, and what the button will do. */
function datingPanel(s: DatingSummary): string {
  const stat = (n: number, label: string) => `<div><div class="text-2xl font-semibold tabular-nums">${n}</div><div class="text-sm ${MUTED}">${label}</div></div>`;
  let action: string, hint: string;
  if (s.ready < 2) {
    action = button("Start dates", { id: "run-round", ic: "heart", disabled: true });
    hint = "Add at least two people and wait until both show Ready.";
  } else if (s.running) {
    action = button("Watch dates live", { href: "/live", ic: "radio" });
    hint = `${s.running} ${s.running === 1 ? "date is" : "dates are"} happening now.`;
  } else if (s.pending === 0) {
    action = button("See rankings", { href: "/rankings", variant: "outline", ic: "trophy" });
    hint = "Every planned pair has already been on a date. Add someone new to start more.";
  } else {
    action = button(`Start ${s.pending} ${s.pending === 1 ? "date" : "dates"}`, { id: "run-round", ic: "heart" });
    hint = "Each pair of agents goes on a first date, then both score how it went.";
  }
  return `<section class="border-t py-8" id="dating"><h2 class="text-2xl font-semibold tracking-tight">Dates</h2>
    <p class="mt-1 max-w-[60ch] ${MUTED}">Agents are paired by how much their people have in common. Each pair chats for a few turns on a made-up first date, then both agents privately score the fit.</p>
    <div class="mt-5 flex flex-wrap items-end justify-between gap-6">
      <div class="flex gap-8">${stat(s.ready, "people ready")}${stat(s.done, "dates done")}${stat(s.mutual, "mutual matches")}${stat(s.pending, "waiting to start")}</div>
      <div class="grid justify-items-start gap-2 sm:justify-items-end">${action}<p class="max-w-[40ch] text-sm ${MUTED} sm:text-right">${hint}</p></div>
    </div></section>`;
}

/** The people grid (or its empty state): rendered by the page and re-fetched as a fragment for live updates. */
export function peopleBlock(people: any[]): string {
  if (!people.length) return emptyState("No one here yet", "Add a LinkedIn and Instagram above to create the first agent.");
  const cards = people.map((p) => `
    <li><a class="card h-full transition-colors hover:border-primary" href="/person/${p.id}" data-person="${p.id}"><section class="grid gap-3">
      <div class="flex items-center gap-3">${avatar(p)}<div class="min-w-0 grow"><h3 class="truncate font-medium">${esc(p.name)}</h3>${badge(p.status)}</div></div>
      <p class="line-clamp-2 text-sm ${MUTED}">${esc(p.tagline && p.status === "ready" ? p.tagline : "")}</p>
      <p class="text-sm font-medium ${p.status === "failed" ? "text-destructive" : ""}">${esc(personResult(p))}</p>
    </section></a></li>`).join("");
  return `<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" id="people">${cards}</ul>`;
}

/** Everything on the home page that changes while agents work, as one payload for in-place refresh. */
export const homeFragments = (people: any[], summary: DatingSummary) => ({
  count: people.length,
  block: peopleBlock(people),
  panel: datingPanel(summary),
});

export function homePage(people: any[], summary: DatingSummary): string {
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
  <div id="dating-panel">${datingPanel(summary)}</div>
  <section class="border-t py-8">
    <h2 class="mb-5 text-2xl font-semibold tracking-tight">People <span id="people-count" class="${MUTED} font-normal">${people.length}</span></h2>
    <div id="people-block">${peopleBlock(people)}</div>
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

export function personPage(p: any, dates: any[], ranking: any[], others = 0): string {
  const head = `<header class="flex flex-wrap items-center gap-6 pb-8">${avatar(p, "xl")}<div class="min-w-0 grow">
      <h1 class="${H1}">${esc(p.name)}</h1>
      <div class="mt-2 flex flex-wrap items-center gap-3">${badge(p.status)}<span class="${MUTED}">${esc(p.linkedin?.headline || "")}</span></div>
      <div class="mt-2 -ml-3 flex flex-wrap">${externalLink(p.linkedin_url, "LinkedIn", "linkedin")}${externalLink(p.instagram_url, "Instagram", "instagram")}</div>
    </div></header>`;
  const attrs = `data-page="person" data-id="${p.id}" data-status="${esc(p.status)}"`;
  if (p.status === "failed") {
    return layout(p.name, `${head}${alertError("We couldn't build this agent", p.error ?? "Unknown error")}
      <form id="relink" class="mt-8 grid max-w-4xl items-end gap-3 md:grid-cols-[1fr_1fr_auto]" novalidate>
        ${field("rl-li", "LinkedIn URL", `<input class="input" id="rl-li" type="text" name="linkedin_url" value="${esc(p.linkedin_url)}" autocomplete="off" required>`)}
        ${field("rl-ig", "Instagram URL or handle", `<input class="input" id="rl-ig" type="text" name="instagram_url" value="${esc(p.ig_username ? "@" + p.ig_username : "")}" autocomplete="off" required>`)}
        <button class="btn" type="submit">${icon("refresh")}Fix and try again</button>
      </form>
      <p id="relink-msg" class="mt-2 min-h-6 text-sm text-destructive" role="alert"></p>`, "", attrs);
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
      col("Green flags", notes(a.green_flags, "good")) + col("Dealbreakers", notes(a.dealbreakers, "bad")),
    )}`;
  const evidenceTab = cols(
    col("Needs", a.needs.map((n: any) => `<div class="grid gap-1 py-3 not-first:border-t"><b class="font-medium">${esc(n.need)}</b><span class="${MUTED}">${esc(n.why)}</span>${evidence(n.evidence)}</div>`).join("") || `<p class="${MUTED}">None found.</p>`),
    col("Hobbies and interests", [...a.hobbies, ...a.interests].map((h: any) => `<div class="grid gap-1 py-3 not-first:border-t"><b class="font-medium">${esc(h.name)}</b>${evidence(h.evidence)}</div>`).join("") || `<p class="${MUTED}">None found.</p>`),
    col("How they talk", `<p class="text-sm ${MUTED}">${esc(a.voice.tone)} · ${esc(a.voice.vocabulary)} · emoji: ${esc(a.voice.emoji_use)}</p>${a.voice.sample_lines.map((l: string) => `<p class="ev"><q>${esc(l)}</q></p>`).join("")}`),
    col("Ideal first date", `<p>${esc(a.ideal_first_date)}</p>${a.data_gaps.length ? `<h4 class="mt-2 text-sm font-medium">What the agent couldn't tell</h4>${notes(a.data_gaps)}` : ""}`),
  );
  const first = esc(String(p.name).split(" ")[0]);
  const unfinished = dates.filter((d) => d.status !== "done");
  const undated = Math.max(0, others - dates.length);
  const fits = ranking.length
    ? `<div class="grid max-w-3xl gap-1 pb-5"><h3 class="font-medium">Dates ranked by match score</h3>
        <p class="text-sm ${MUTED}">${first} has been on ${ranking.length} ${ranking.length === 1 ? "date" : "dates"}${others ? ` out of ${others} other ${others === 1 ? "person" : "people"} on AgentDate` : ""}. ${undated ? "People who haven't dated yet aren't ranked." : ""}</p></div>
      <div class="mb-6 max-w-xl">${fitMeter()}</div>
      ${table(["#", "Partner", "Fit", ["Why, according to " + first + "'s agent", "hidden md:table-cell"], "Score"], ranking.map((r, i) => rankRow(r, i + 1)), "Dates ranked by match score")}
      <p class="mt-3 text-sm ${MUTED}">The score (0 to 100) combines what both agents thought of the date, so it's the same from either side. <b class="font-medium text-foreground">Mutual match</b> means both agents want a second date. <a class="underline" href="/about#score">How scoring works</a></p>`
    : emptyState("No finished dates yet", dates.length ? "Dates are still running. Check the live floor." : "Start the dates from the People page and the results will show up here.", dates.length ? button("Watch live", { href: "/live", ic: "radio" }) : button("Go to People", { href: "/#dating", ic: "users" }), "heart");
  const fitsTab = `${fits}${unfinished.length ? `<h3 class="mb-3 mt-10 font-medium">Not finished</h3>${table(["Partner", "Status"], unfinished.map((d) => `<tr><td><a class="flex min-w-0 items-center gap-3 hover:underline" href="/date/${d.id}">${avatar({ id: d.partner_id, name: d.partner_name, has_photo: d.partner_has_photo }, "sm")}<span class="truncate font-medium">${esc(d.partner_name)}</span></a></td><td>${badge(d.status)}</td></tr>`), "Dates that are not finished")}` : ""}`;

  return layout(p.name, `${head}${tabs("person-tabs", [["Overview", overview], ["Evidence", evidenceTab], ["Dates and fit", fitsTab]])}`, "", attrs, `${p.name}: ${a.headline_tagline}`);
}

const rankRow = (r: any, n: number, compact = false) => `<tr>
  <td class="w-10 text-muted-foreground tabular-nums">${n}</td>
  <td><a class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 hover:underline" href="/date/${r.date_id}">${avatar({ id: r.partner_id, name: r.partner_name, has_photo: r.partner_has_photo }, "sm")}<span class="truncate font-medium">${esc(r.partner_name)}</span>${r.mutual ? '<span class="badge" data-variant="outline">Mutual match</span>' : ""}</a></td>
  <td>${fitBadge(r.match_score)}</td>
  ${compact ? "" : `<td class="hidden max-w-md whitespace-normal text-sm text-muted-foreground md:table-cell"><span class="line-clamp-2">${esc(r.my_verdict?.why || r.partner_tagline || "")}</span></td>`}
  <td class="text-right">${scoreCell(r.match_score)}</td></tr>`;

// ---------------- date ----------------
const DIM: Record<string, string> = { values: "Values", lifestyle: "Lifestyle", interests: "Interests", communication: "Communication", life_goals: "Life goals", chemistry: "Chemistry" };

function debrief(p: Who, v: any): string {
  const head = `<div class="flex items-center gap-3">${avatar(p, "sm")}<h3 class="grow font-medium">${esc(p.name)}'s agent</h3>`;
  if (!v) return `<div class="card"><section class="grid gap-4">${head}</div><p class="${MUTED}">Debrief pending.</p>${skeleton(3)}</section></div>`;
  return `<div class="card"><section class="grid gap-4">${head}<span class="text-xl font-semibold tabular-nums">${v.overall}/10</span></div>
    <div><span class="badge"${v.want_second_date ? "" : ' data-variant="destructive"'}>${v.want_second_date ? "Wants a second date" : "Passes"}</span></div>
    ${Object.keys(DIM).map((k) => bar(DIM[k], v.scores?.[k] ?? 0)).join("")}
    <p class="ev"><b class="block text-xs uppercase tracking-wide text-foreground">Best moment</b><q>${esc(v.best_moment)}</q></p>
    ${v.concerns?.length ? `<h4 class="text-sm font-medium">Concerns</h4>${notes(v.concerns, "bad")}` : ""}
    <p>${esc(v.why)}</p></section></div>`;
}

const intentBlock = (p: Who, i: any) => i ? `<details class="border-t py-1"><summary class="flex min-h-11 cursor-pointer items-center font-medium">${esc(p.name)}'s private intent</summary>
  <div class="grid gap-3 pb-3"><h4 class="text-sm font-medium">Wants to find out</h4>${notes(i.find_out)}<h4 class="text-sm font-medium">Questions</h4>${i.questions.map((q: string) => `<p class="ev">${esc(q)}</p>`).join("")}
  <h4 class="text-sm font-medium">Dealbreakers</h4>${notes(i.dealbreakers, "bad")}</div></details>` : "";

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
        <p>match score · ${fitLabel(d.match_score)}${d.mutual ? ' <span class="badge ml-1" data-variant="outline">Mutual match</span>' : ""}</p>
        ${fitMeter(d.match_score)}
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
const pairRow = (r: any, n: number) => `<li><a class="flex min-h-14 items-center gap-4 py-3 hover:bg-muted/50" href="/date/${r.id}">
  <span class="w-6 text-muted-foreground tabular-nums">${n}</span>
  <span class="flex shrink-0 -space-x-2">${avatar({ id: r.a_id, name: r.a_name, has_photo: r.a_has_photo })}${avatar({ id: r.b_id, name: r.b_name, has_photo: r.b_has_photo })}</span>
  <span class="min-w-0 grow"><span class="block truncate font-medium">${esc(r.a_name)} and ${esc(r.b_name)}</span>
    <span class="flex flex-wrap items-center gap-2 text-sm ${MUTED}">${fitBadge(r.match_score)}${r.mutual ? '<span class="badge" data-variant="outline">Mutual match</span>' : "<span>One-sided</span>"}</span></span>
  ${scoreCell(r.match_score)}</a></li>`;

export function rankingsPage(pairs: any[], rows: { person: any; top: any[] }[]): string {
  const cards = rows.map(({ person: p, top }) => `
    <li class="card"><header><a class="flex min-h-11 items-center gap-3" href="/person/${p.id}">${avatar(p)}<div class="min-w-0"><h2 class="truncate">${esc(p.name)}</h2><p>${p.dates_done} ${p.dates_done === 1 ? "date" : "dates"}</p></div></a></header>
      <section>${top.length ? table(["#", "Partner", "Fit", "Score"], top.map((r, i) => rankRow(r, i + 1, true)), `Top matches for ${p.name}`) : `<p class="text-sm ${MUTED}">No finished dates yet.</p>`}</section>
      ${p.dates_done > top.length ? `<footer><a class="text-sm underline" href="/person/${p.id}">See all ${p.dates_done} dates</a></footer>` : ""}</li>`).join("");
  return layout("Rankings", `<header class="mb-8"><h1 class="${H1}">Rankings</h1>
    <p class="mt-2 max-w-[62ch] ${MUTED}">Every score belongs to a pair. It combines what both agents thought of their date, so it reads the same from either side. Only people who have been on a date are ranked.</p>
    <div class="mt-5 max-w-xl">${fitMeter()}</div></header>
    ${pairs.length ? `${section("Top matches overall", `<ol class="divide-y">${pairs.map((r, i) => pairRow(r, i + 1)).join("")}</ol>`)}
      ${section("Each person's best dates", `<ul class="grid gap-4 lg:grid-cols-2">${cards}</ul>`)}`
      : emptyState("No finished dates yet", "Rankings appear once agents have been on their first dates.", button("Go to People", { href: "/#dating", ic: "users" }), "trophy")}`, "rankings");
}

// ---------------- about ----------------
// Two people in -> one persona agent each -> the date harness -> ranking.
const FLOW_NODES: BeamNode[] = [
  { id: "a-li", label: "LinkedIn", sub: "Person A", cx: 70, cy: 30, shape: "dot", icon: "linkedin" },
  { id: "a-ig", label: "Instagram", sub: "Person A", cx: 70, cy: 118, shape: "dot", icon: "instagram" },
  { id: "b-li", label: "LinkedIn", sub: "Person B", cx: 70, cy: 208, shape: "dot", icon: "linkedin" },
  { id: "b-ig", label: "Instagram", sub: "Person B", cx: 70, cy: 296, shape: "dot", icon: "instagram" },
  { id: "agent-a", label: "Agent A", sub: "reads Person A", cx: 250, cy: 74, shape: "hub", icon: "bot" },
  { id: "agent-b", label: "Agent B", sub: "reads Person B", cx: 250, cy: 252, shape: "hub", icon: "bot" },
  { id: "harness", label: "Date harness", sub: "agents date each other", cx: 450, cy: 163, shape: "hub", icon: "heart" },
  { id: "rank", label: "Ranking", sub: "best fits for both", cx: 660, cy: 163, shape: "hub", icon: "trophy" },
];
const FLOW_EDGES = [
  { from: "a-li", to: "agent-a" }, { from: "a-ig", to: "agent-a" },
  { from: "b-li", to: "agent-b" }, { from: "b-ig", to: "agent-b" },
  { from: "agent-a", to: "harness" }, { from: "agent-b", to: "harness" },
  { from: "harness", to: "rank" },
];

const CONCEPTS = ["Persona agents", "Agentic harness", "Multi-agent simulation", "LLM-as-judge", "Grounded generation", "Structured outputs"];

interface Stage { title: string; what: string; term: string; how: string }
const stages = (m: { analysis: string; date: string }): Stage[] => [
  { title: "Ingest", what: "Paste a LinkedIn URL and a public Instagram for each person.", term: "Parallel scraping", how: "Apify actors fetch both profiles at once. Private Instagram accounts are rejected. Raw and normalized JSON are stored in Postgres." },
  { title: "Build the persona", what: "A reader agent writes down each person's needs, hobbies, interests, values, personality and how they talk.", term: "Grounded generation", how: `${m.analysis} reads the profile text and recent post images. The output is a structured object validated with Zod, and every claim must quote its source.` },
  { title: "Plan the date", what: "Each agent privately decides what it wants to find out, and a first-date setting is picked from shared interests.", term: "Planning step", how: "A cheap pre-score on shared tags, values and lifestyle decides which pairs are worth spending model calls on." },
  { title: "Run the date", what: "The two agents talk for 8 turns, each speaking as its person, asking questions and reacting to the other.", term: "Multi-agent simulation", how: `The harness loops over turns. Each turn gets the persona, voice, private intent and transcript so far (${m.date}). Turns are saved and streamed live over SSE.` },
  { title: "Debrief and rank", what: "After the date each agent privately scores the fit and says whether it wants a second date. Scores become rankings.", term: "LLM-as-judge", how: "A six-dimension rubric per agent is blended with the pre-score into a 0 to 100 match score. Both agents wanting a second date makes it a mutual match." },
];

const GUARDRAILS = [
  "Only two sources per person: their LinkedIn and public Instagram. No web search, nothing else.",
  "Every claim in a profile must quote the source it came from.",
  "Agents must not invent facts about the person they represent.",
  "Scores are AI opinions from a simulation, not facts about compatibility.",
];

export function aboutPage(models: { analysis: string; date: string; fallback: string }): string {
  return layout("How it works", `
  <header class="mb-8"><h1 class="${H1}">How AgentDate works</h1>
    <p class="mt-3 max-w-[64ch] ${MUTED}">Paste two people's LinkedIn and public Instagram. Each person gets an AI agent that reads them, dates the other person's agent in a multi-agent simulation, and ranks who fits best.</p>
    <ul class="mt-4 flex flex-wrap gap-2">${CONCEPTS.map((c) => `<li class="badge" data-variant="secondary">${c}</li>`).join("")}</ul></header>
  <div class="card max-w-3xl"><section class="diagram-scroll" tabindex="0" aria-label="Flow diagram (scrollable)">${beamDiagram(FLOW_NODES, FLOW_EDGES, { w: 760, h: 365 }, "Two people, each with a LinkedIn and an Instagram, feed one persona agent each. The two agents meet in the date harness, and the results become a ranking.")}</section></div>
  <p class="mt-3 max-w-3xl text-sm ${MUTED}">Two people in. One persona agent each. The agents meet inside the date harness, and the scores become rankings.</p>

  <section class="mt-12">
    <h2 class="mb-2 text-2xl font-semibold tracking-tight">Step by step</h2>
    <ol>${stages(models).map((st, i) => `<li class="grid gap-3 border-t py-6 md:grid-cols-2 md:gap-12">
      <div class="flex gap-4"><span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">${i + 1}</span>
        <div><h3 class="font-medium">${st.title}</h3><p class="mt-1">${st.what}</p></div></div>
      <div class="grid content-start gap-2 md:pt-1"><span class="badge w-fit" data-variant="outline">${st.term}</span><p class="text-sm ${MUTED}">${st.how}</p></div></li>`).join("")}</ol>
  </section>

  ${section("Guardrails", notes(GUARDRAILS, "good"))}
  ${section("Under the hood", cols(
    col("Models, via OpenRouter", item("Reading people", models.analysis) + item("Running dates", models.date) + item("Backup if a call fails", models.fallback) + `<p class="text-sm ${MUTED}">Calls retry with backoff, then fall back to the backup model. Outputs are validated before they are saved.</p>`),
    col("The match score", `<div id="score"></div><p>Mostly how both agents rated the date, plus how well their dimensions line up, with a small bonus if both want a second date.</p><div class="my-3">${fitMeter()}</div><p class="text-sm"><b class="font-medium">Mutual match</b> means both agents want a second date.</p>`),
  ))}`, "about");
}
