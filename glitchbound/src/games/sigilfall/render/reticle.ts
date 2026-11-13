/**
 * The mark of where a placed spell will land, drawn flat on the ground: a comet, a well, a rain of arrows held over
 * the spot before it is let go. It was a plain white disc with a white line round it, which on pale ground was hard
 * to see and said nothing about what was coming (the owner: "make the projected textures for the targeted spells
 * with better visuals, currently it's just big white circle and i want it to be a bit more noticable").
 *
 * Now, in the spell's own color: a soft fill that is deepest at its rim, a bold rim with a dark line under it so it
 * reads on any ground, a dashed ring turning inside it, four teeth pointing in from the rim, a ring that closes in
 * on the middle again and again (where it will hit), and a small bright cross at the middle. All of it is lines and
 * arcs, drawn with the picture's own ground slant, so it lies on the land as the old one did.
 */
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** `#rrggbb` (or `#rgb`) with an alpha. */
function tint(hex: string, alpha: number): string {
  const h = hex.length < 6 ? hex.slice(1, 4).replace(/./g, (x) => x + x) : hex.slice(1, 7);
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * A spell's landing mark at (`x`, `y`), `r` wide. `time`: seconds, for what turns and closes in it (0 for a still
 * one). `dim`: it can't be cast there (out of sight, being put away): grey, and nothing moves.
 */
export function drawReticle(g: Ctx, x: number, y: number, r: number, color: string, time: number, dim = false): void {
  const c = dim ? '#9a9aa6' : color;
  const t = dim ? 0 : time;
  g.save();
  g.setLineDash([]);
  // the fill: deepest at the rim, so the ground under the middle is still seen
  const fill = g.createRadialGradient(x, y, r * 0.15, x, y, r);
  fill.addColorStop(0, tint(c, 0.1));
  fill.addColorStop(0.7, tint(c, 0.2));
  fill.addColorStop(1, tint(c, 0.42));
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  // the rim: a dark line, the color over it, a thin bright line inside
  const rim = Math.max(1.4, r * 0.055);
  g.lineWidth = rim + 1.6;
  g.strokeStyle = 'rgba(14,8,22,0.75)';
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.stroke();
  g.lineWidth = rim;
  g.strokeStyle = c;
  g.stroke();
  g.lineWidth = Math.max(0.6, rim * 0.35);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.arc(x, y, r - rim * 0.9, 0, TAU);
  g.stroke();
  // a dashed ring turning inside it
  g.lineWidth = Math.max(1, rim * 0.6);
  g.strokeStyle = tint(c, 0.9);
  g.setLineDash([r * 0.2, r * 0.13]);
  g.lineDashOffset = -t * r * 0.55;
  g.beginPath();
  g.arc(x, y, r * 0.72, 0, TAU);
  g.stroke();
  g.setLineDash([]);
  // four teeth pointing in from the rim, turning the other way
  g.fillStyle = c;
  g.strokeStyle = 'rgba(14,8,22,0.7)';
  g.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const a = -t * 0.9 + (i * TAU) / 4;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const w = r * 0.11;
    g.beginPath();
    g.moveTo(x + ca * r * 0.98 - sa * w, y + sa * r * 0.98 + ca * w);
    g.lineTo(x + ca * r * 0.98 + sa * w, y + sa * r * 0.98 - ca * w);
    g.lineTo(x + ca * r * 0.76, y + sa * r * 0.76);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // a ring closing in on the middle: where it lands
  if (!dim) {
    const u = (t * 0.9) % 1;
    g.globalAlpha = 0.85 * (1 - u) + 0.1;
    g.lineWidth = Math.max(1, rim * 0.7);
    g.strokeStyle = '#ffffff';
    g.beginPath();
    g.arc(x, y, Math.max(1, r * (1 - u * 0.86)), 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }
  // the middle: a small bright cross
  const k = Math.max(2.5, r * 0.13);
  g.lineCap = 'round';
  for (const [w, s] of [[rim + 1.4, 'rgba(14,8,22,0.75)'], [rim * 0.9, '#ffffff']] as const) {
    g.lineWidth = w;
    g.strokeStyle = s;
    g.beginPath();
    g.moveTo(x - k, y);
    g.lineTo(x + k, y);
    g.moveTo(x, y - k);
    g.lineTo(x, y + k);
    g.stroke();
  }
  g.restore();
}

/** The thread from the caster to the mark: dashes running out along it. */
export function drawReach(g: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, time: number, dim = false): void {
  g.save();
  g.lineCap = 'round';
  g.setLineDash([5, 5]);
  g.lineDashOffset = dim ? 0 : -time * 26;
  g.lineWidth = 2.6;
  g.strokeStyle = 'rgba(14,8,22,0.5)';
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.lineWidth = 1.4;
  g.strokeStyle = tint(dim ? '#9a9aa6' : color, 0.9);
  g.stroke();
  g.restore();
}
