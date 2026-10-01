import { iconAt, type IconName } from "./icons.js";
import { esc } from "./ui.js";

/** A generic animated-beam diagram: nodes + edges in, inline SVG out. No page knowledge here. */

export interface BeamNode {
  id: string;
  label: string;
  sub?: string;
  cx: number;
  cy: number;
  /** "chip" = rounded rectangle, "hub" = circle with a glyph. */
  shape: "chip" | "hub";
  icon?: IconName;
  /** Chip width/height (ignored for hubs). */
  w?: number;
  h?: number;
  /** CSS colour (use a token, e.g. "var(--primary)") for the dot on chips. */
  tone?: string;
}
export interface BeamEdge { from: string; to: string; dur?: number; begin?: number }

const BEAM_LEN = 46;
const HUB_R = 30;
const ANIM = `keyTimes="0;.65;1" calcMode="spline" keySplines="0.16 1 0.3 1;0 0 1 1" repeatCount="indefinite"`;

interface Pt { x: number; y: number }
const out = (n: BeamNode): Pt => ({ x: n.cx + (n.shape === "hub" ? HUB_R : (n.w ?? 120) / 2), y: n.cy });
const into = (n: BeamNode): Pt => ({ x: n.cx - (n.shape === "hub" ? HUB_R : (n.w ?? 120) / 2), y: n.cy });

const curve = (a: Pt, b: Pt) => {
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
};

/** Sliding gradient window: enters before the source, leaves past the target, holds for the idle gap. */
function gradient(id: string, a: Pt, b: Pt, dur: number, begin: number): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = ((b.x - a.x) / len) * BEAM_LEN;
  const uy = ((b.y - a.y) / len) * BEAM_LEN;
  const hold = (s: number, e: number) => `${s};${e};${e}`;
  const anim = (attr: string, s: number, e: number) =>
    `<animate attributeName="${attr}" values="${hold(s, e)}" dur="${dur}s" begin="${begin}s" ${ANIM}/>`;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${a.x - ux}" y1="${a.y - uy}" x2="${a.x}" y2="${a.y}">
    <stop offset="0" stop-color="var(--primary)" stop-opacity="0"/><stop offset=".5" stop-color="var(--primary)" stop-opacity=".9"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/>
    ${anim("x1", a.x - ux, b.x)}${anim("y1", a.y - uy, b.y)}${anim("x2", a.x, b.x + ux)}${anim("y2", a.y, b.y + uy)}</linearGradient>`;
}

function node(n: BeamNode): string {
  const label = `<text x="${n.cx}" y="${n.cy + (n.sub ? -1 : 4)}" text-anchor="middle" class="bn-label">${esc(n.label)}</text>`;
  const sub = n.sub ? `<text x="${n.cx}" y="${n.cy + 12}" text-anchor="middle" class="bn-sub">${esc(n.sub)}</text>` : "";
  if (n.shape === "hub") {
    return `<g><circle cx="${n.cx}" cy="${n.cy}" r="${HUB_R}" class="bn-box"/>
      <g class="bn-icon">${iconAt(n.icon ?? "heart", n.cx - 12, n.cy - 12, 24)}</g>
      <text x="${n.cx}" y="${n.cy + HUB_R + 16}" text-anchor="middle" class="bn-label">${esc(n.label)}</text>
      ${n.sub ? `<text x="${n.cx}" y="${n.cy + HUB_R + 29}" text-anchor="middle" class="bn-sub">${esc(n.sub)}</text>` : ""}</g>`;
  }
  const w = n.w ?? 120, h = n.h ?? 40;
  return `<g><rect x="${n.cx - w / 2}" y="${n.cy - h / 2}" width="${w}" height="${h}" rx="8" class="bn-box"/>
    ${n.tone ? `<circle cx="${n.cx - w / 2 + 14}" cy="${n.cy}" r="3.6" style="fill:${n.tone}"/>` : ""}${label}${sub}</g>`;
}

export function beamDiagram(nodes: BeamNode[], edges: BeamEdge[], size = { w: 720, h: 300 }, label = "Diagram"): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const computed = edges.map((e, i) => {
    const a = out(byId.get(e.from)!);
    const b = into(byId.get(e.to)!);
    return { id: `bn-${i}`, a, b, d: curve(a, b), dur: e.dur ?? 3.6 + (i % 4) * 0.6, begin: e.begin ?? (i * 0.55) % 2.2 };
  });
  return `<svg class="beams" viewBox="0 0 ${size.w} ${size.h}" role="img" aria-label="${esc(label)}">
  <defs>${computed.map((e) => gradient(`g-${e.id}`, e.a, e.b, e.dur, e.begin)).join("")}</defs>
  ${computed.map((e) => `<path d="${e.d}" class="bn-wire"/>`).join("")}
  ${computed.map((e) => `<path d="${e.d}" class="bn-beam" stroke="url(#g-${e.id})"/>`).join("")}
  ${nodes.map(node).join("")}</svg>`;
}
