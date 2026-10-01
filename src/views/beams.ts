import { iconAt, type IconName } from "./icons.js";
import { esc } from "./ui.js";

/** A generic animated-beam diagram: nodes + edges in, inline SVG out. No page knowledge here. */

export interface BeamNode {
  id: string;
  label: string;
  sub?: string;
  cx: number;
  cy: number;
  /** Both are circles with a Lucide icon: "dot" is small (sources), "hub" is larger (steps). */
  shape: "dot" | "hub";
  icon: IconName;
}
export interface BeamEdge { from: string; to: string; dur?: number; begin?: number }

const BEAM_LEN = 30;
const RADIUS = { dot: 22, hub: 30 } as const;
const ICON = { dot: 18, hub: 24 } as const;
const ANIM = `keyTimes="0;.65;1" calcMode="spline" keySplines="0.16 1 0.3 1;0 0 1 1" repeatCount="indefinite"`;

interface Pt { x: number; y: number }
const out = (n: BeamNode): Pt => ({ x: n.cx + RADIUS[n.shape], y: n.cy });
const into = (n: BeamNode): Pt => ({ x: n.cx - RADIUS[n.shape], y: n.cy });

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
  const r = RADIUS[n.shape], size = ICON[n.shape];
  return `<g><circle cx="${n.cx}" cy="${n.cy}" r="${r}" class="bn-box"/>
    <g class="bn-icon">${iconAt(n.icon, n.cx - size / 2, n.cy - size / 2, size)}</g>
    <text x="${n.cx}" y="${n.cy + r + 16}" text-anchor="middle" class="bn-label">${esc(n.label)}</text>
    ${n.sub ? `<text x="${n.cx}" y="${n.cy + r + 29}" text-anchor="middle" class="bn-sub">${esc(n.sub)}</text>` : ""}</g>`;
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
