export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Escape, then render *scene actions* in italics. */
export const fmt = (s: string): string => esc(s).replace(/\*([^*]+)\*/g, '<em class="act">$1</em>');

export interface Who { id: number; name: string; has_photo?: boolean }

export const avatar = (p: Who, cls = ""): string => {
  const initials = esc((p.name || "?").replace(/^@/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase());
  const hue = (p.id * 47) % 360;
  return p.has_photo
    ? `<img class="avatar ${cls}" src="/photo/${p.id}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="avatar ${cls}" style="background:hsl(${hue} 70% 88%);color:hsl(${hue} 50% 35%)">${initials}</span>`;
};

const LABELS: Record<string, string> = {
  queued: "Queued", scraping: "Scraping", analyzing: "Analyzing", ready: "Ready", failed: "Failed",
  planning: "Planning", dating: "On a date", debrief: "Debriefing", done: "Done",
};
export const badge = (status: string): string => `<span class="badge b-${esc(status)}" data-status>${LABELS[status] ?? esc(status)}</span>`;

export const bar = (label: string, value: number, max = 10): string =>
  `<div class="bar"><div class="bar-top"><span>${esc(label)}</span><b>${Math.round(value * 10) / 10}</b></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></div></div></div>`;

export const bubble = (p: Who, text: string, side: "l" | "r"): string =>
  `<div class="msg ${side}" data-sid="${p.id}">${avatar(p, "sm")}<div class="bubble"><div class="who">${esc(p.name)}</div>${fmt(text)}</div></div>`;

const NAV: [string, string, string][] = [
  ["/", "People", "home"], ["/live", "Live", "live"], ["/rankings", "Rankings", "rankings"], ["/about", "How it works", "about"],
];

export function layout(title: string, body: string, active = "", pageAttrs = ""): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · AgentDate</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head><body ${pageAttrs}>
<header class="top"><div class="wrap nav">
  <a class="logo" href="/"><span class="heart">♥</span> AgentDate</a>
  <nav>${NAV.map(([href, label, key]) => `<a href="${href}" class="${key === active ? "on" : ""}">${label}</a>`).join("")}</nav>
</div></header>
<main class="wrap">${body}</main>
<footer class="wrap foot">Agents date so you don't have to. Scores are AI opinions based on two public profiles.</footer>
<script src="/app.js"></script>
</body></html>`;
}
