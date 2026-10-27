/**
 * Scribble Scramble on the phone: the drawing as this phone knows it (the op log, kept in step with the
 * room's) and painting it onto the canvas. Ops come from the room as they are drawn (`receive`) or, for
 * the drawer, straight from their finger (`add`). A gap (a phone that joined late or dropped a message)
 * asks the room for the whole drawing again.
 */
import { COLORS, H, replay, SIZES, W, type Mark, type Op } from '../scribble';

export class InkStore {
  turn = 0;
  ops: Op[] = [];
  marks: Mark[] = [];
  /** Ops are missing: ask the room for the drawing. */
  behind = false;
  /** The room refused more ink (the canvas is full). */
  full = false;
  /** Bumped whenever the whole picture must be repainted (an undo, a clear, a sync, a new turn). */
  version = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private apply(ops: Op[]): void {
    this.ops.push(...ops);
    if (ops.some((op) => op[0] === 3 || op[0] === 4)) {
      this.marks = replay(this.ops);
      this.version++;
    } else replay(ops, this.marks);
  }

  /** A new turn: a blank canvas. */
  reset(turn: number): void {
    if (turn === this.turn && !this.ops.length) return;
    this.turn = turn;
    this.ops = [];
    this.marks = [];
    this.behind = false;
    this.full = false;
    this.version++;
    this.emit();
  }

  /** The drawer's own ops, shown at once. */
  add(ops: Op[]): void {
    this.apply(ops);
    this.emit();
  }

  /** A message from the room: new ops at `at`, the whole drawing (`sync`), or "the canvas is full". */
  receive = (data: unknown): void => {
    const d = data as { turn?: number; at?: number; ops?: Op[]; sync?: boolean; full?: boolean } | null;
    if (!d || typeof d !== 'object') return;
    if (d.full) {
      this.full = true;
      this.emit();
      return;
    }
    if (typeof d.turn !== 'number' || !Array.isArray(d.ops)) return;
    if (d.sync) {
      this.turn = d.turn;
      this.ops = [];
      this.marks = [];
      this.apply(d.ops);
      this.version++;
      this.behind = false;
    } else if (d.turn !== this.turn) {
      if (d.turn < this.turn) return;
      this.turn = d.turn;
      this.ops = [];
      this.marks = [];
      this.version++;
      if (d.at === 0) this.apply(d.ops);
      else this.behind = true;
    } else if (d.at === this.ops.length) this.apply(d.ops);
    else if ((d.at ?? 0) > this.ops.length) this.behind = true;
    this.emit();
  };
}

/** How far the canvas has been painted (marks done, and points of the last one). */
export interface Painted {
  marks: number;
  points: number;
  version: number;
}

/** Paints what is new since `from` (or everything, after a repaint), and returns how far it got. */
export function paint(ctx: CanvasRenderingContext2D, marks: readonly Mark[], from: Painted | null, version: number): Painted {
  let start = from && from.version === version ? from : null;
  if (!start) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    start = { marks: 0, points: 0, version };
  }
  let i = start.marks;
  let p = start.points;
  // The last mark painted may have grown since (a stroke still being drawn): carry on from where it was.
  if (i > 0 && i <= marks.length && marks[i - 1]!.kind === 'stroke' && (marks[i - 1] as { pts: number[] }).pts.length > p) {
    i--;
  } else p = 0;
  for (; i < marks.length; i++, p = 0) {
    const m = marks[i]!;
    if (m.kind === 'fill') floodFill(ctx, m.x, m.y, COLORS[m.color] ?? '#000');
    else stroke(ctx, m, p);
  }
  const last = marks[marks.length - 1];
  return { marks: marks.length, points: last?.kind === 'stroke' ? last.pts.length : 0, version };
}

function stroke(ctx: CanvasRenderingContext2D, m: Extract<Mark, { kind: 'stroke' }>, from: number): void {
  const pts = m.pts;
  ctx.strokeStyle = COLORS[m.color] ?? '#000';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = SIZE_PX(m.size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 2 && from === 0) {
    ctx.beginPath();
    ctx.arc(pts[0]!, pts[1]!, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const begin = Math.max(2, from);
  if (begin >= pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[begin - 2]!, pts[begin - 1]!);
  for (let k = begin; k < pts.length; k += 2) ctx.lineTo(pts[k]!, pts[k + 1]!);
  ctx.stroke();
}

const SIZE_PX = (i: number): number => SIZES[i] ?? 9;

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

/**
 * Bucket fill: the area of (nearly) the clicked color, so the soft edges of lines are filled up to as
 * well. Works on the canvas at its own size, so every phone fills the same area.
 */
export function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const at = (y * W + x) * 4;
  const [r0, g0, b0] = [d[at]!, d[at + 1]!, d[at + 2]!];
  const [r1, g1, b1] = hex(color);
  if (Math.abs(r0 - r1) + Math.abs(g0 - g1) + Math.abs(b0 - b1) < 12) return;
  const near = (i: number): boolean => Math.abs(d[i]! - r0) + Math.abs(d[i + 1]! - g0) + Math.abs(d[i + 2]! - b0) <= 96;
  const seen = new Uint8Array(W * H);
  const stack = [x, y];
  while (stack.length) {
    const py = stack.pop()!;
    let px = stack.pop()!;
    while (px > 0 && !seen[py * W + px - 1] && near((py * W + px - 1) * 4)) px--;
    let up = false;
    let down = false;
    for (; px < W; px++) {
      const k = py * W + px;
      if (seen[k] || !near(k * 4)) break;
      seen[k] = 1;
      d[k * 4] = r1;
      d[k * 4 + 1] = g1;
      d[k * 4 + 2] = b1;
      d[k * 4 + 3] = 255;
      if (py > 0) {
        const open = !seen[k - W] && near((k - W) * 4);
        if (open && !up) stack.push(px, py - 1);
        up = open;
      }
      if (py < H - 1) {
        const open = !seen[k + W] && near((k + W) * 4);
        if (open && !down) stack.push(px, py + 1);
        down = open;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
