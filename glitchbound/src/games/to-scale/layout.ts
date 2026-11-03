/**
 * Stage layout helpers (pure). The two labels under the things are laid out together, so they never
 * overlap or run off the stage, however close or big the things are.
 */
export interface LabelBox {
  /** Center x and width, in pixels. */
  mid: number;
  width: number;
}

/** About how wide a label is: the labels are monospace, 12 px names over 13 px sizes. */
export const labelWidth = (name: string, size: string): number => Math.ceil(Math.max(name.length * 12, size.length * 13) * 0.62) + 4;

/**
 * Places the reference label (left) and the target label (right) near the centers of their things:
 * at least `gap` apart and `pad` inside the stage, narrowed (they truncate) only when both can't fit.
 */
export function layoutLabels(W: number, refMid: number, tMid: number, refW: number, tW: number, gap = 8, pad = 4): { ref: LabelBox; target: LabelBox } {
  const room = W - 2 * pad - gap;
  let rw = refW;
  let tw = tW;
  if (rw + tw > room) {
    // Share the room, each keeping what it needs when the other is short.
    const half = room / 2;
    if (rw <= half) tw = room - rw;
    else if (tw <= half) rw = room - tw;
    else rw = tw = half;
  }
  let r = Math.min(W - pad - rw / 2, Math.max(pad + rw / 2, refMid));
  let t = Math.min(W - pad - tw / 2, Math.max(pad + tw / 2, tMid));
  const overlap = r + rw / 2 + gap - (t - tw / 2);
  if (overlap > 0) {
    r -= overlap / 2;
    t += overlap / 2;
    // Pushed past an edge: the other one takes the rest.
    const rMin = pad + rw / 2;
    const tMax = W - pad - tw / 2;
    if (r < rMin) {
      t += rMin - r;
      r = rMin;
    }
    if (t > tMax) {
      r -= t - tMax;
      t = tMax;
    }
  }
  return { ref: { mid: r, width: rw }, target: { mid: t, width: tw } };
}
