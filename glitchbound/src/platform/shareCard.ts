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

/** Draws the card; returns a PNG blob (or null if the browser can't). */
export async function renderShareCard(opts: { game?: GameEntry; lines: string[]; cta?: string; site: string }): Promise<Blob | null> {
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
  const [wide, tile] = opts.game ? await Promise.all([loadImage(opts.game.art.wide), loadImage(opts.game.art.tile)]) : [null, null];
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
  const py = 300;
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
  type Row = { text: string; font: string; color: string; h: number };
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
  let used = rows.reduce((n, r) => n + r.h, 0);
  while (used > room && rows.length > 1) used -= rows.pop()!.h;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = textTop + Math.max(0, (room - used) / 2);
  for (const r of rows) {
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
