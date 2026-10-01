import { icon } from "./icons.js";

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Escape, then render *scene actions* in italics. */
export const fmt = (s: string): string => esc(s).replace(/\*([^*]+)\*/g, '<em class="act">$1</em>');

export interface Who { id: number; name: string; has_photo?: boolean }

export const avatar = (p: Who, cls = ""): string => {
  const initials = esc((p.name || "?").replace(/^@/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase());
  const hue = (p.id * 47) % 360;
  return p.has_photo
    ? `<img class="avatar ${cls}" src="/photo/${p.id}" alt="" width="48" height="48" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="avatar ${cls}" aria-hidden="true" style="--h:${hue}">${initials}</span>`;
};

const LABELS: Record<string, string> = {
  queued: "Queued", scraping: "Scraping", analyzing: "Analyzing", ready: "Ready", failed: "Failed",
  planning: "Planning", dating: "On a date", debrief: "Debriefing", done: "Done",
};
export const badge = (status: string): string => `<span class="badge b-${esc(status)}" data-status>${LABELS[status] ?? esc(status)}</span>`;

export const chips = (xs: string[], tone: "" | "bad" | "good" = ""): string =>
  xs.length ? `<ul class="chips">${xs.map((x) => `<li class="chip ${tone}">${esc(x)}</li>`).join("")}</ul>` : '<p class="muted">None noted.</p>';

/** Accessible 0..max meter. */
export const bar = (label: string, value: number, max = 10): string => {
  const v = Math.round(value * 10) / 10;
  return `<div class="bar"><div class="bar-top"><span>${esc(label)}</span><b>${v}</b></div>
    <div class="bar-track" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></div></div></div>`;
};

export const bubble = (p: Who, text: string, side: "l" | "r"): string =>
  `<div class="msg ${side}" data-sid="${p.id}">${avatar(p, "sm")}<div class="bubble"><div class="who">${esc(p.name)}</div>${fmt(text)}</div></div>`;

export const skeleton = (lines = 3): string =>
  `<div class="skeleton-group" aria-hidden="true">${Array.from({ length: lines }, (_, i) => `<div class="skeleton" style="width:${100 - i * 12}%"></div>`).join("")}</div>`;

export const emptyState = (title: string, hint: string, action = ""): string =>
  `<div class="empty"><h3>${esc(title)}</h3><p>${esc(hint)}</p>${action}</div>`;

const NAV: [string, string, string][] = [
  ["/", "People", "home"], ["/live", "Live", "live"], ["/rankings", "Rankings", "rankings"], ["/about", "How it works", "about"],
];
const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c2185b"><path d="M12 21 3.5 12.5a5.5 5.5 0 0 1 8.5-7 5.5 5.5 0 0 1 8.5 7Z"/></svg>')}`;

export function layout(title: string, body: string, active = "", pageAttrs = "", description = "Agents date so you don't have to. Paste a LinkedIn and a public Instagram; an AI agent dates other agents for you and ranks your best fits."): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · AgentDate</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#fbf9f6" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#18161d" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${esc(title)} · AgentDate"><meta property="og:description" content="${esc(description)}">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head><body ${pageAttrs}>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap nav">
  <a class="logo" href="/">${icon("heart", 20, "logo-mark")}AgentDate</a>
  <nav aria-label="Main">${NAV.map(([href, label, key]) => `<a href="${href}"${key === active ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
</div></header>
<main id="main" class="wrap">${body}</main>
<footer class="wrap foot">Scores are AI opinions based on two public profiles.</footer>
<script>window.ICONS=${JSON.stringify({ heart: icon("heart", 16) })}</script>
<script src="/app.js" defer></script>
</body></html>`;
}

export const notFoundPage = (what = "page"): string =>
  layout("Not found", `<section class="block" style="border:0"><h1>We couldn't find that ${esc(what)}</h1><p class="muted">It may have been removed, or the link is wrong.</p><p><a class="btn" href="/">Back to people</a></p></section>`);
