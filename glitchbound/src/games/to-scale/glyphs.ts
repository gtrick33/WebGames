/**
 * Turns an emoji into artwork the game can size precisely: drawn big on a canvas, cropped to its
 * visible pixels (emoji fonts pad differently on every device), and also as a one-color silhouette.
 * Results are cached per emoji and color.
 */
export interface Glyph {
  /** Data URLs of the cropped picture and the silhouette. */
  color: string;
  silhouette: string;
  /** Width over height of the visible shape. */
  aspect: number;
}

const DRAW = 220;
const cache = new Map<string, Glyph>();

export function glyph(emoji: string, tint: string): Glyph | null {
  const id = `${emoji}|${tint}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = Math.round(DRAW * 1.6);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = `${DRAW}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);
  const data = ctx.getImageData(0, 0, size, size).data;
  let x0 = size;
  let y0 = size;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (data[(y * size + x) * 4 + 3]! > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const cc = crop.getContext('2d')!;
  cc.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  const color = crop.toDataURL('image/png');
  cc.globalCompositeOperation = 'source-in';
  cc.fillStyle = tint;
  cc.fillRect(0, 0, w, h);
  const out: Glyph = { color, silhouette: crop.toDataURL('image/png'), aspect: w / h };
  cache.set(id, out);
  return out;
}
