/**
 * Picture cards for sharing: a square image with the game's artwork, the result (title, score
 * lines, emoji grids) and the site, drawn on a canvas in the player's browser. No server work.
 */
import type { Accent, GameEntry } from '../catalog/types';
import { t } from '../i18n';

export const CARD_SIZE = 1080;

const ACCENTS: Record<Accent, [string, string]> = {
  cyan: ['#2ad1f0', '#3d5bff'],
  magenta: ['#ff4fc8', '#7b4dff'],
  blue: ['#3d5bff', '#2ad1f0'],
  orange: ['#ff6a1a', '#ffc928'],
  lime: ['#b6e62c', '#12c6b3'],
  coral: ['#ff5a6c', '#ff6a1a'],
  yellow: ['#ffc928', '#ff6a1a'],
  teal: ['#12c6b3', '#3d5bff'],
  violet: ['#7b4dff', '#ff4fc8'],
};

const INK = '#1d1238';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Lines of the shared text worth putting on the card (no links, no empty lines). */
export function cardLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^https?:\/\//i.test(l));
}

/** A line made only of emoji and spaces (a result grid). */
const isGrid = (l: string): boolean => /\p{Extended_Pictographic}/u.test(l) && l.replace(/\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s|·/gu, '') === '';

/*
 * Emoji are laid out in fixed boxes: phones often measure an emoji narrower than they draw it,
 * which pushed centred lines off the card. Text runs are measured as usual.
 */
const EMOJI = /(\p{Extended_Pictographic}(?:\ufe0f|\p{Emoji_Modifier}|\u200d\p{Extended_Pictographic}\ufe0f?)*)/u;
const EMOJI_BOX = 1.2;
const fontSize = (ctx: CanvasRenderingContext2D): number => Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 16);

/** Width of a line in the current font, with every emoji counted as a fixed box. */
export function lineWidth(ctx: CanvasRenderingContext2D, text: string): number {
  const box = fontSize(ctx) * EMOJI_BOX;
  return text
    .split(EMOJI)
    .filter(Boolean)
    .reduce((w, part) => w + (EMOJI.test(part) ? box : ctx.measureText(part).width), 0);
}

/** Draws a line centred on `cx`, emoji in their fixed boxes. */
function drawLine(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number): void {
  const box = fontSize(ctx) * EMOJI_BOX;
  let x = cx - lineWidth(ctx, text) / 2;
  for (const part of text.split(EMOJI).filter(Boolean)) {
    if (EMOJI.test(part)) {
      ctx.textAlign = 'center';
      ctx.fillText(part, x + box / 2, y, box);
      x += box;
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
    }
  }
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxW: number, min = 22): number {
  let s = size;
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (lineWidth(ctx, text) <= maxW) break;
  }
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

type Tile = { src: string; bg: string; done: boolean };

/** Columns and size of a grid of game tiles that fits `w` × `h` (rows kept balanced: 10 → 5 + 5). */
export function tileGrid(n: number, w: number, h: number, gap: number): { cols: number; rows: number; size: number } {
  const rows = Math.max(1, Math.ceil(n / 5));
  const cols = Math.max(1, Math.ceil(n / rows));
  const size = Math.floor(Math.min(170, (w - (cols - 1) * gap) / cols, (h - (rows - 1) * gap) / rows));
  return { cols, rows, size: Math.max(40, size) };
}

/** Game tiles in rows, centred on `cx`: done ones bright with a green ✓, the rest faded with a ✗. */
function drawTiles(ctx: CanvasRenderingContext2D, tiles: Tile[], imgs: (HTMLImageElement | null)[], cx: number, top: number, grid: { cols: number; size: number }, gap: number): void {
  const { cols, size } = grid;
  const r = size * 0.22;
  ctx.save();
  tiles.forEach((tile, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, tiles.length - row * cols);
    const x = cx - (inRow * size + (inRow - 1) * gap) / 2 + (i % cols) * (size + gap);
    const y = top + row * (size + gap);
    ctx.save();
    roundRect(ctx, x, y, size, size, r);
    ctx.clip();
    ctx.fillStyle = tile.bg;
    ctx.fillRect(x, y, size, size);
    const img = imgs[i];
    if (img) ctx.drawImage(img, x, y, size, size);
    if (!tile.done) {
      ctx.fillStyle = 'rgba(255,250,242,0.68)';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = tile.done ? INK : 'rgba(29,18,56,0.35)';
    roundRect(ctx, x, y, size, size, r);
    ctx.stroke();
    // The badge, drawn as paths (a ✓ glyph is missing from some phone fonts).
    const br = size * 0.2;
    const bx = x + size - br * 0.7;
    const by = y + size - br * 0.7;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = tile.done ? '#22b35e' : '#9a93ad';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    const k = br * 0.45;
    if (tile.done) {
      ctx.moveTo(bx - k, by + k * 0.05);
      ctx.lineTo(bx - k * 0.25, by + k * 0.75);
      ctx.lineTo(bx + k, by - k * 0.65);
    } else {
      ctx.moveTo(bx - k * 0.7, by - k * 0.7);
      ctx.lineTo(bx + k * 0.7, by + k * 0.7);
      ctx.moveTo(bx + k * 0.7, by - k * 0.7);
      ctx.lineTo(bx - k * 0.7, by + k * 0.7);
    }
    ctx.lineWidth = Math.max(4, br * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Draws the card; returns a PNG blob (or null if the browser can't). With `tiles` (the Daily Sweep)
 * the panel grows upwards and shows the game tiles under the headline.
 */
export async function renderShareCard(opts: { game?: GameEntry; lines: string[]; cta?: string; site: string; tiles?: Tile[] }): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const S = CARD_SIZE;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const family = '"Bricolage", "Avenir Next", system-ui, -apple-system, "Segoe UI", sans-serif';
  try {
    await document.fonts?.load(`800 64px Bricolage`);
  } catch {
    /* system font */
  }
  const [a1, a2] = ACCENTS[opts.game?.accent ?? 'cyan'];

  // Background: the game's colours, its wide art softly behind, and a light grain of dots.
  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, a1);
  bg.addColorStop(1, a2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  const tiles = opts.tiles?.length ? opts.tiles : null;
  const [[wide, tile], tileImgs] = await Promise.all([
    opts.game ? Promise.all([loadImage(opts.game.art.wide), loadImage(opts.game.art.tile)]) : Promise.resolve([null, null]),
    Promise.all((tiles ?? []).map((x) => loadImage(x.src))),
  ]);
  if (wide) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    const k = Math.max(S / wide.width, (S * 0.55) / wide.height);
    ctx.drawImage(wide, (S - wide.width * k) / 2, 0, wide.width * k, wide.height * k);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 18; y < S; y += 36) for (let x = (y / 36) % 2 ? 18 : 0; x < S; x += 36) ctx.fillRect(x, y, 3, 3);

  // White result panel.
  const px = 64;
  const py = tiles ? 140 : 300;
  const pw = S - px * 2;
  const ph = S - py - 200;
  ctx.fillStyle = 'rgba(29,18,56,0.25)';
  roundRect(ctx, px + 10, py + 14, pw, ph, 44);
  ctx.fill();
  ctx.fillStyle = '#fffaf2';
  roundRect(ctx, px, py, pw, ph, 44);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Game tile, overlapping the top of the panel.
  if (tile) {
    const ts = 230;
    const tx = (S - ts) / 2;
    const ty = py - ts / 2 - 30;
    ctx.save();
    ctx.fillStyle = 'rgba(29,18,56,0.3)';
    roundRect(ctx, tx + 8, ty + 12, ts, ts, 46);
    ctx.fill();
    roundRect(ctx, tx, ty, ts, ts, 46);
    ctx.clip();
    ctx.drawImage(tile, tx, ty, ts, ts);
    ctx.restore();
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    roundRect(ctx, tx, ty, ts, ts, 46);
    ctx.stroke();
  }

  // Brand.
  ctx.fillStyle = '#fff';
  ctx.font = `800 40px ${family}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('GlitchBound', 56, 44);
  if (opts.game) {
    ctx.textAlign = 'right';
    ctx.font = `700 30px ${family}`;
    ctx.fillText(opts.game.title, S - 56, 50);
  }

  // Text: the first line as the headline, emoji grids large, the rest as wrapped details; the block
  // is measured first and centred in the panel.
  const maxW = pw - 90;
  type Row = { text: string; font: string; color: string; h: number; tiles?: true };
  const rows: Row[] = [];
  const wrapAt = (words: string[], width: number): string[] => {
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (lineWidth(ctx, next) <= width || !cur) cur = next;
      else {
        out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    return out;
  };
  const wrap = (text: string, font: string, maxLines: number): string[] => {
    ctx.font = font;
    const words = text.split(/\s+/);
    let out = wrapAt(words, maxW);
    // Balance the lines (no single word left alone on the last one): narrow the width while the
    // line count stays the same.
    if (out.length > 1 && out.length <= maxLines) {
      for (let w = maxW - 10; w > maxW * 0.5; w -= 10) {
        const tried = wrapAt(words, w);
        if (tried.length !== out.length || tried.some((l) => lineWidth(ctx, l) > maxW)) break;
        out = tried;
      }
    }
    if (out.length > maxLines) {
      const kept = out.slice(0, maxLines);
      kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/\s+\S*$/, '')}…`;
      return kept;
    }
    return out;
  };
  opts.lines.slice(0, 9).forEach((line, i) => {
    if (i === 0) {
      const size = line.length > 34 ? 52 : 62;
      const font = `800 ${size}px ${family}`;
      for (const t of wrap(line, font, 3)) rows.push({ text: t, font, color: INK, h: size + 12 });
      rows.push({ text: '', font, color: INK, h: 14 });
    } else if (isGrid(line)) {
      const size = fitFont(ctx, line, 400, 58, family, maxW, 26);
      rows.push({ text: line, font: `400 ${size}px ${family}`, color: INK, h: size + 10 });
    } else {
      const font = `700 36px ${family}`;
      for (const t of wrap(line, font, 3)) rows.push({ text: t, font, color: '#4a3f66', h: 48 });
    }
  });
  const textTop = py + (tile ? 105 : 50);
  const room = py + ph - 40 - textTop;
  // The tile grid goes under the headline and takes the room the text leaves.
  const GAP = 22;
  const grid = tiles ? tileGrid(tiles.length, maxW, room - rows.reduce((n, r) => n + r.h, 0) - 50, GAP) : null;
  if (tiles && grid) {
    const at = rows.findIndex((r) => r.text === '') + 1 || 1;
    rows.splice(at, 0, { text: '', font: '', color: INK, h: grid.rows * grid.size + (grid.rows - 1) * GAP + 40, tiles: true });
  }
  let used = rows.reduce((n, r) => n + r.h, 0);
  while (used > room && rows.length > 1) used -= rows.pop()!.h;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = textTop + Math.max(0, (room - used) / 2);
  for (const r of rows) {
    if (r.tiles && tiles && grid) drawTiles(ctx, tiles, tileImgs, S / 2, y + 8, grid, GAP);
    ctx.font = r.font;
    ctx.fillStyle = r.color;
    if (r.text) drawLine(ctx, r.text, S / 2, y);
    y += r.h;
  }

  // Call to action and address.
  ctx.textAlign = 'center';
  const cta = opts.cta ?? t('Can you beat it?');
  ctx.font = `800 40px ${family}`;
  const cw = ctx.measureText(cta).width + 90;
  const cx = (S - cw) / 2;
  const cy = S - 118;
  ctx.fillStyle = INK;
  roundRect(ctx, cx + 6, cy + 8, cw, 76, 38);
  ctx.fill();
  ctx.fillStyle = '#c4f034';
  roundRect(ctx, cx, cy, cw, 76, 38);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(cta, S / 2, cy + 39);
  ctx.fillStyle = '#fff';
  ctx.font = `700 28px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(opts.site, S / 2, S - 140 + 2);

  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}
