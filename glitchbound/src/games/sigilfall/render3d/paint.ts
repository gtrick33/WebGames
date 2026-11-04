import type { MeshData } from './pack';

/** Dyeing a model: each swatch moved onto a new color, keeping how light or dark it was next to its neighbours. */

export function rgbHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}
export function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** What a swatch is, by eye. */
const isSkin = (h: number, s: number, l: number): boolean => h >= 12 && h <= 36 && s > 0.45 && l > 0.62;
const isDark = (l: number): boolean => l < 0.14;
const isWhite = (s: number, l: number): boolean => l > 0.88 && s < 0.5;
const isMetal = (s: number, l: number): boolean => s < 0.16 && l >= 0.14;

/** Moves a color onto `to`, keeping how light or dark it was next to its neighbours (the swatch's own shading). */
function repaint(col: Uint8Array, i: number, to: [number, number, number], l: number, baseL: number): void {
  const [h, s, tl] = rgbHsl(to[0], to[1], to[2]);
  const nl = Math.max(0.03, Math.min(0.97, tl + (l - baseL) * 0.75));
  const [r, g, b] = hslRgb(h, s, nl);
  col[i] = r * 255;
  col[i + 1] = g * 255;
  col[i + 2] = b * 255;
}

export interface Paint {
  /** Skin swatches. */
  skin?: [number, number, number];
  /** Cloth and leather swatches. */
  cloth?: [number, number, number];
  /** Grey metal swatches. */
  metal?: [number, number, number];
  /** Anything else colored (a head's hair). */
  hair?: [number, number, number];
  /** White swatches (they keep their white otherwise). */
  white?: [number, number, number];
  /** Tans and golds count as metal: the plate of a paladin's armor. */
  plated?: boolean;
}

export function painted(m: MeshData, paint: Paint): MeshData {
  const col = new Uint8Array(m.col);
  // the middle lightness of each swatch family, so a dye lands on its own color rather than a shade of it
  let clothL = 0;
  let clothN = 0;
  for (let v = 0; v < m.n; v++) {
    const [h, s, l] = rgbHsl(col[v * 3]! / 255, col[v * 3 + 1]! / 255, col[v * 3 + 2]! / 255);
    if (!isSkin(h, s, l) && !isDark(l) && !isMetal(s, l) && !isWhite(s, l)) {
      clothL += l;
      clothN++;
    }
  }
  const midCloth = clothN ? clothL / clothN : 0.5;
  for (let v = 0; v < m.n; v++) {
    const i = v * 3;
    const [h, s, l] = rgbHsl(col[i]! / 255, col[i + 1]! / 255, col[i + 2]! / 255);
    if (isSkin(h, s, l)) {
      if (paint.skin) repaint(col, i, paint.skin, l, 0.75);
    } else if (isWhite(s, l)) {
      if (paint.white) repaint(col, i, paint.white, l, 0.93);
    } else if (isDark(l)) continue;
    else if (isMetal(s, l) || (paint.plated && h >= 18 && h <= 58 && s < 0.8 && l > 0.26)) {
      if (paint.metal) repaint(col, i, paint.metal, l, 0.5);
    } else if (paint.cloth) repaint(col, i, paint.cloth, l, midCloth);
    else if (paint.hair) repaint(col, i, paint.hair, l, midCloth);
  }
  return { ...m, col };
}

/**
 * The short-haired head in the pack comes with a moustache and a goatee, in the color of its hair. This is the same head
 * shaved: whatever isn't skin on the front of the face, below the eyes, comes off. Children and anyone not meant to
 * have a beard wear it.
 */
export function shaved(m: MeshData): MeshData {
  const idx: number[] = [];
  for (let t = 0; t < m.i; t += 3) {
    const a = m.idx[t]!;
    const b = m.idx[t + 1]!;
    const c = m.idx[t + 2]!;
    const y = (m.pos[a * 3 + 1]! + m.pos[b * 3 + 1]! + m.pos[c * 3 + 1]!) / 3;
    const z = (m.pos[a * 3 + 2]! + m.pos[b * 3 + 2]! + m.pos[c * 3 + 2]!) / 3;
    const [h, s, l] = rgbHsl(m.col[a * 3]! / 255, m.col[a * 3 + 1]! / 255, m.col[a * 3 + 2]! / 255);
    if (y < 1.53 && z > 0.05 && !isSkin(h, s, l) && !isDark(l)) continue;
    idx.push(a, b, c);
  }
  return { ...m, i: idx.length, idx: Uint16Array.from(idx) };
}

/** Paints only the vertices tied to these joints (a pair of gloves on an arm, boots on a leg). */
export function paintJoints(m: MeshData, joints: Set<number>, to: [number, number, number]): MeshData {
  const col = new Uint8Array(m.col);
  for (let v = 0; v < m.n; v++) {
    if (!joints.has(m.skin![v * 3]!)) continue;
    const i = v * 3;
    const [h, s, l] = rgbHsl(col[i]! / 255, col[i + 1]! / 255, col[i + 2]! / 255);
    if (isDark(l) || isWhite(s, l)) continue;
    void h;
    repaint(col, i, to, l, 0.55);
  }
  return { ...m, col };
}
