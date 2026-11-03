/**
 * A drawing tracer: runs an object's real drawing code (draw.ts) against a recording stand-in for the
 * canvas and keeps what it painted (each fill and stroke, its color and its bounds in scene units).
 * The difference picker uses it to check what a change really draws, instead of guessing from circles:
 * that the change paints something new, how big it is, where to tap, and whether it shows. Pure, no DOM.
 */
import { deltaE, type Rgb } from '../color-recall/color';
import { drawObj } from './draw';
import type { Obj } from './scene';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Op {
  /** What was painted (kind, style and rounded geometry): two equal keys paint the same pixels. */
  key: string;
  box: Box;
  /** Solid colors it paints with (gradient stops included). */
  colors: Rgb[];
  /** Mostly see-through (glows, soft shadows): not counted as the object's body. */
  faint: boolean;
}

type M = [number, number, number, number, number, number];
const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** '#rrggbb', 'rgb(r g b)', 'rgba(r,g,b,a)' or '#000' to a color and its alpha (null for anything else). */
function parse(c: string): { rgb: Rgb; a: number } | null {
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const n = parseInt(m[1]!, 16);
    return { rgb: { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }, a: 1 };
  }
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (m) return { rgb: { r: parseInt(m[1]! + m[1]!, 16), g: parseInt(m[2]! + m[2]!, 16), b: parseInt(m[3]! + m[3]!, 16) }, a: 1 };
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(c);
  if (m) return { rgb: { r: +m[1]!, g: +m[2]!, b: +m[3]! }, a: m[4] === undefined ? 1 : +m[4] };
  return null;
}

class Gradient {
  stops: string[] = [];
  readonly id: string;
  constructor(id: string) {
    this.id = id;
  }
  addColorStop(at: number, c: string): void {
    this.stops.push(`${at}:${c}`);
  }
}

type Style = string | Gradient;

/** The recording stand-in: only what draw.ts's object code uses. */
class Recorder {
  ops: Op[] = [];
  fillStyle: Style = '#000';
  strokeStyle: Style = '#000';
  lineWidth = 1;
  globalAlpha = 1;
  lineJoin = 'miter';
  lineCap = 'butt';
  private m: M = [1, 0, 0, 1, 0, 0];
  private stack: { m: M; fill: Style; stroke: Style; lw: number; ga: number }[] = [];
  private pts: [number, number][] = [];
  private path: string[] = [];

  save(): void {
    this.stack.push({ m: this.m, fill: this.fillStyle, stroke: this.strokeStyle, lw: this.lineWidth, ga: this.globalAlpha });
  }
  restore(): void {
    const s = this.stack.pop();
    if (!s) return;
    this.m = s.m;
    this.fillStyle = s.fill;
    this.strokeStyle = s.stroke;
    this.lineWidth = s.lw;
    this.globalAlpha = s.ga;
  }
  translate(x: number, y: number): void {
    this.m = mul(this.m, [1, 0, 0, 1, x, y]);
  }
  scale(x: number, y: number): void {
    this.m = mul(this.m, [x, 0, 0, y, 0, 0]);
  }
  rotate(a: number): void {
    this.m = mul(this.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
  }
  private add(cmd: string, ...xy: number[]): void {
    const out: string[] = [];
    for (let i = 0; i < xy.length; i += 2) {
      const p = apply(this.m, xy[i]!, xy[i + 1]!);
      this.pts.push(p);
      out.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    this.path.push(cmd + out.join(' '));
  }
  beginPath(): void {
    this.pts = [];
    this.path = [];
  }
  closePath(): void {
    this.path.push('z');
  }
  moveTo(x: number, y: number): void {
    this.add('M', x, y);
  }
  lineTo(x: number, y: number): void {
    this.add('L', x, y);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.add('Q', cx, cy, x, y);
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    this.add('C', c1x, c1y, c2x, c2y, x, y);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.add('R', x, y, x + w, y, x + w, y + h, x, y + h);
  }
  roundRect(x: number, y: number, w: number, h: number): void {
    this.rect(x, y, w, h);
  }
  arc(x: number, y: number, r: number, a0: number, a1: number): void {
    // The arc's own extent (sampled), so half circles and slivers are not counted as whole circles.
    const span = Math.min(Math.PI * 2, Math.abs(a1 - a0));
    const out: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = a0 + (span * i) / 12;
      out.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    this.add(`A${r.toFixed(1)}`, ...out);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number): void {
    const out: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry;
      out.push(x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot));
    }
    this.add('E', ...out);
  }
  clip(): void {}
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient {
    return new Gradient(`lin${[x0, y0, x1, y1].join(',')}`);
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Gradient {
    return new Gradient(`rad${[x0, y0, r0, x1, y1, r1].join(',')}`);
  }
  private paint(kind: string, style: Style, pad: number, pts: [number, number][], path: string): void {
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const box = { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad };
    const parsed = (typeof style === 'string' ? [style] : style.stops.map((s) => s.slice(s.indexOf(':') + 1))).map(parse).filter((p) => !!p);
    const alpha = Math.max(0, ...parsed.map((p) => p.a)) * this.globalAlpha;
    const styleKey = typeof style === 'string' ? style : `${style.id}[${style.stops.join(';')}]`;
    this.ops.push({ key: `${kind} ${styleKey} ${this.globalAlpha} ${path}`, box, colors: parsed.map((p) => p.rgb), faint: alpha < 0.5 });
  }
  /** How far a stroke reaches beyond its path, in scene units. */
  private halfLine(): number {
    return (this.lineWidth / 2) * Math.sqrt(Math.abs(this.m[0] * this.m[3] - this.m[1] * this.m[2]));
  }
  fill(): void {
    this.paint('fill', this.fillStyle, 0, this.pts, this.path.join(''));
  }
  stroke(): void {
    this.paint(`stroke${this.lineWidth}`, this.strokeStyle, this.halfLine(), this.pts, this.path.join(''));
  }
  private box(x: number, y: number, w: number, h: number): { pts: [number, number][]; path: string } {
    const pts = [apply(this.m, x, y), apply(this.m, x + w, y), apply(this.m, x + w, y + h), apply(this.m, x, y + h)];
    return { pts, path: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') };
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const b = this.box(x, y, w, h);
    this.paint('fillRect', this.fillStyle, 0, b.pts, b.path);
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    const b = this.box(x, y, w, h);
    this.paint(`strokeRect${this.lineWidth}`, this.strokeStyle, this.halfLine(), b.pts, b.path);
  }
}

/** Everything an object paints, in drawing order. */
export function traceObj(o: Obj): Op[] {
  const rec = new Recorder();
  drawObj(rec as unknown as CanvasRenderingContext2D, o);
  return rec.ops;
}

export const area = (b: Box): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);

export function union(boxes: readonly Box[]): Box | null {
  if (!boxes.length) return null;
  return { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
}

/** The body of an object: the bounds of everything solid it paints. */
export const bodyOf = (ops: readonly Op[]): Box | null => union(ops.filter((op) => !op.faint).map((op) => op.box));

/** The ops in `a` that `b` does not paint (as a multiset: a key painted twice in `a` and once in `b` leaves one). */
function minus(a: readonly Op[], b: readonly Op[]): Op[] {
  const count = new Map<string, number>();
  for (const op of b) count.set(op.key, (count.get(op.key) ?? 0) + 1);
  return a.filter((op) => {
    const n = count.get(op.key) ?? 0;
    if (n > 0) count.set(op.key, n - 1);
    return n === 0;
  });
}

/** What one drawing paints that the other does not (both ways): the change a player can see. */
export const changedOps = (before: readonly Op[], after: readonly Op[]): Op[] => [...minus(before, after), ...minus(after, before)];

/** The most an object's solid colors stand out from a backdrop color (CIE76 deltaE). */
export const contrastWith = (ops: readonly Op[], backdrop: Rgb): number => Math.max(0, ...ops.filter((op) => !op.faint).flatMap((op) => op.colors.map((c) => deltaE(c, backdrop))));
