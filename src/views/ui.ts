import { icon } from "./icons.js";

// ---------- escaping / text ----------
export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Escape, then render *scene actions* in italics. */
export const fmt = (s: string): string => esc(s).replace(/\*([^*]+)\*/g, '<em class="act">$1</em>');

// ---------- Basecoat component helpers (markup only; styling comes from Basecoat + tokens) ----------
export interface Who { id: number; name: string; has_photo?: boolean }
export type AvatarSize = "sm" | "md" | "lg" | "xl";

const initials = (name: string) => (name || "?").replace(/^@/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Basecoat avatar: photo when we have one, initials fallback otherwise. Mirrored in public/app.js. */
export const avatar = (p: Who, size: AvatarSize = "md"): string =>
  `<span class="avatar"${size === "md" ? "" : ` data-size="${size}"`}>${p.has_photo ? `<img src="/photo/${p.id}" alt="" width="48" height="48" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}<span>${esc(initials(p.name))}</span></span>`;

const LABELS: Record<string, string> = {
  queued: "Queued", scraping: "Scraping", analyzing: "Analyzing", ready: "Ready", failed: "Failed",
  planning: "Planning", dating: "On a date", debrief: "Debriefing", done: "Done",
};
export const badge = (status: string): string =>
  `<span class="badge status s-${esc(status)}" data-status>${LABELS[status] ?? esc(status)}</span>`;

export const chips = (xs: string[], tone: "" | "bad" | "good" = ""): string =>
  xs.length
    ? `<ul class="flex flex-wrap gap-2">${xs.map((x) => `<li class="badge chip ${tone}" data-variant="secondary">${esc(x)}</li>`).join("")}</ul>`
    : '<p class="text-sm text-muted-foreground">None noted.</p>';

/** Labelled Basecoat progress bar (0..max). */
export const bar = (label: string, value: number, max = 10): string => {
  const v = Math.round(value * 10) / 10;
  return `<div class="grid gap-1.5"><div class="flex justify-between text-sm"><span class="text-muted-foreground">${esc(label)}</span><b class="font-medium tabular-nums">${v}</b></div>
    <div class="progress" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}"><span style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></span></div></div>`;
};

export const bubble = (p: Who, text: string, side: "l" | "r"): string =>
  `<div class="msg ${side}" data-sid="${p.id}">${avatar(p, "md")}<div class="bubble"><div class="who">${esc(p.name)}</div>${fmt(text)}</div></div>`;

export const skeleton = (lines = 3): string =>
  `<div class="grid gap-3" aria-hidden="true">${Array.from({ length: lines }, (_, i) => `<div class="skeleton h-4" style="width:${100 - i * 12}%"></div>`).join("")}</div>`;

export const emptyState = (title: string, hint: string, action = "", ic: Parameters<typeof icon>[0] = "users"): string =>
  `<section class="empty"><header><figure>${icon(ic, 24)}</figure><h3>${esc(title)}</h3><p>${esc(hint)}</p></header>${action ? `<footer>${action}</footer>` : ""}</section>`;

export const alertError = (title: string, message: string, action = ""): string =>
  `<div class="alert" data-variant="destructive" role="alert">${icon("x", 16)}<h2>${esc(title)}</h2><section>${esc(message)}</section>${action ? `<footer class="mt-3">${action}</footer>` : ""}</div>`;

export const field = (id: string, label: string, input: string): string =>
  `<div role="group" class="field"><label for="${id}" class="label">${esc(label)}</label>${input}</div>`;

export const button = (label: string, o: { id?: string; variant?: string; ic?: Parameters<typeof icon>[0]; href?: string; type?: string; disabled?: boolean } = {}): string => {
  const v = o.variant ? ` data-variant="${o.variant}"` : "";
  const body = `${o.ic ? icon(o.ic, 16) : ""}${esc(label)}`;
  return o.href
    ? `<a class="btn" href="${o.href}"${v}>${body}</a>`
    : `<button class="btn" type="${o.type ?? "button"}"${o.id ? ` id="${o.id}"` : ""}${v}${o.disabled ? " disabled" : ""}>${body}</button>`;
};

// ---------- layout ----------
const NAV: [string, string, string][] = [
  ["/", "People", "home"], ["/live", "Live", "live"], ["/rankings", "Rankings", "rankings"], ["/about", "How it works", "about"],
];
const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c2185b"><path d="M12 21 3.5 12.5a5.5 5.5 0 0 1 8.5-7 5.5 5.5 0 0 1 8.5 7Z"/></svg>')}`;

export const CONTAINER = "mx-auto w-full max-w-6xl px-4 md:px-6";

export function layout(title: string, body: string, active = "", pageAttrs = "", description = "Agents date so you don't have to. Paste a LinkedIn and a public Instagram; an AI agent dates other agents for you and ranks your best fits."): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · AgentDate</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#fbf9f6" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#18161d" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${esc(title)} · AgentDate"><meta property="og:description" content="${esc(description)}">
<link rel="icon" href="${FAVICON}">
<script>document.documentElement.classList.toggle("dark",matchMedia("(prefers-color-scheme: dark)").matches)</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/basecoat.cdn.min.css">
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
  @theme inline {
    --font-sans: Geist, ui-sans-serif, system-ui, sans-serif;
    --color-background: var(--background); --color-foreground: var(--foreground);
    --color-card: var(--card); --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
    --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
    --color-border: var(--border); --color-destructive: var(--destructive); --color-success: var(--success); --color-warning: var(--warning);
  }
</style>
<link rel="stylesheet" href="/style.css">
<script src="https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/js/all.min.js" defer></script>
</head><body ${pageAttrs}>
<a class="skip" href="#main">Skip to content</a>
<header class="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm"><div class="${CONTAINER} flex min-h-14 flex-wrap items-center justify-between gap-x-4">
  <a class="inline-flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight" href="/">${icon("heart", 20, "text-primary fill-current")}AgentDate</a>
  <nav aria-label="Main" class="-mx-2 flex flex-wrap gap-1">${NAV.map(([href, label, key]) => `<a class="btn" data-variant="${key === active ? "secondary" : "ghost"}" href="${href}"${key === active ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
</div></header>
<main id="main" class="${CONTAINER} min-h-[70vh] py-8 md:py-12">${body}</main>
<footer class="${CONTAINER} pb-10 text-sm text-muted-foreground">Scores are AI opinions based on two public profiles.</footer>
<div id="toaster" class="toaster" data-align="end"></div>
<script>window.ICONS=${JSON.stringify({ heart: icon("heart", 16) })}</script>
<script src="/app.js" defer></script>
</body></html>`;
}

export const notFoundPage = (what = "page"): string =>
  layout("Not found", emptyState(`We couldn't find that ${what}`, "It may have been removed, or the link is wrong.", button("Back to people", { href: "/" }), "search"));
