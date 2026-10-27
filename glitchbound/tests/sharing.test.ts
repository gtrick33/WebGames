import { inflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { onRequestGet as challengePage } from '../functions/c/[id]';
import { onRequestGet as ogImage } from '../functions/og/[kind]/[file]';
import { onRequestGet as roomPage } from '../functions/r/[code]';
import { onRequestGet as sharePage } from '../functions/s/[code]';
import { onRequestPost as createChallenge } from '../functions/api/challenges/index';
import { onRequestPost as score } from '../functions/api/challenges/[id]/score';
import type { Ctx, Env } from '../server/http';
import { measure, OG_H, OG_W, ogFonts, renderOgCard, wrap, zlibRows } from '../server/ogImage';
import { newCode, sharePath, shareText } from '../server/shares';
import { shareDirect } from '../src/platform/share';
import { cardLines, lineWidth } from '../src/platform/shareCard';
import { memoryD1 } from './d1';

describe('share links', () => {
  it('only points at pages of this site', () => {
    expect(sharePath('/games/wing-it')).toBe('/games/wing-it');
    expect(sharePath('/games/wing-it?beat=40')).toBe('/games/wing-it?beat=40');
    expect(sharePath('/daily')).toBe('/daily');
    expect(sharePath('/')).toBe('/');
    expect(sharePath('/games/not-a-game')).toBeNull();
    expect(sharePath('https://evil.example/games/wing-it')).toBeNull();
    expect(sharePath('//evil.example')).toBeNull();
    expect(sharePath('/admin')).toBeNull();
  });

  it('keeps preview text short and clean', () => {
    expect(shareText('', 'x')).toBeNull();
    const t = shareText(`Wing It #2 \n 🐤 ${'x'.repeat(200)}`, 'line one\nline two');
    expect(t!.title.length).toBeLessThanOrEqual(100);
    expect(t!.title.startsWith('Wing It #2 🐤')).toBe(true);
    expect(t!.description).toBe('line one line two');
  });

  it('makes short, readable codes', () => {
    const codes = new Set(Array.from({ length: 500 }, () => newCode()));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{7}$/);
  });

  it('puts the shared text, minus links, on the picture card', () => {
    expect(cardLines('Wing It #2 🐤\n\nBest today: 34\nhttps://glitchboundstudio.com/games/wing-it')).toEqual(['Wing It #2 🐤', 'Best today: 34']);
  });
});

describe('picture card text', () => {
  // A canvas that measures 10 px per character, and (like many phones) emoji far too narrow.
  const ctx = { font: '800 50px Bricolage', measureText: (t: string) => ({ width: t.replace(/\p{Extended_Pictographic}|️/gu, '').length * 10 }) } as unknown as CanvasRenderingContext2D;

  it('gives every emoji a full box, so centred lines stay on the card', () => {
    expect(lineWidth(ctx, 'abc')).toBe(30);
    expect(lineWidth(ctx, '⚔️ abc')).toBe(60 + 40);
    expect(lineWidth(ctx, '🟩🟩🟥')).toBe(180);
  });
});

describe('sending a share', () => {
  let written: string[];
  beforeEach(() => {
    written = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (s: string) => void written.push(s) } });
  });
  afterEach(() => Reflect.deleteProperty(navigator, 'clipboard'));

  it('sends the link alone: no text, no emoji (the preview picture says it)', async () => {
    expect(await shareDirect({ title: 'Wing It', text: '⚔️ Ana challenges you\nOne flight', url: 'https://glitchbound.test/c/abc1234' })).toBe('copied');
    expect(written).toEqual(['https://glitchbound.test/c/abc1234']);
    // Without a link of its own, the page's address.
    await shareDirect({ title: 'Letter Pinch', text: 'Letter Pinch #3 4/6\n🟩🟩🟩🟩🟩' });
    expect(written[1]).toBe(location.href);
  });
});

/* ---------------------------------------------------------------- link-preview pictures */

/** The chunks of a PNG, after checking its signature and every chunk's CRC. */
function chunks(png: Uint8Array): Map<string, Uint8Array> {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const out = new Map<string, Uint8Array>();
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let o = 8; o < png.length; ) {
    const len = view.getUint32(o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    let crc = 0xffffffff;
    for (let i = o + 4; i < o + 8 + len; i++) crc = crcTable[(crc ^ png[i]!) & 255]! ^ (crc >>> 8);
    expect(view.getUint32(o + 8 + len), `${type} CRC`).toBe((crc ^ 0xffffffff) >>> 0);
    out.set(type, png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  return out;
}

/** Undoes the PNG row filters this encoder uses (none, up). */
function unfilter(raw: Uint8Array, w: number, h: number): Uint8Array {
  const px = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (w + 1)];
    expect([0, 2]).toContain(f);
    for (let x = 0; x < w; x++) px[y * w + x] = (raw[y * (w + 1) + 1 + x]! + (f === 2 && y ? px[(y - 1) * w + x]! : 0)) & 255;
  }
  return px;
}

describe('link-preview pictures', () => {
  it('packs pixels so any zlib reads them back exactly', () => {
    const w = 64;
    const h = 40;
    const px = new Uint8Array(w * h);
    // Runs, rows like the one above, runs longer than 258, noise and a long blank stretch.
    for (let i = 0; i < px.length; i++) px[i] = i < 900 ? 7 : i < 1600 ? (i * 37) % 251 : i < 2000 ? ((i / 64) | 0) % 3 : 0;
    expect(unfilter(inflateSync(zlibRows(px, w, h)), w, h)).toEqual(px);
    const odd = Uint8Array.from({ length: 30 * 7 }, (_, i) => (i % 9 < 5 ? 200 : i % 4));
    expect(unfilter(inflateSync(zlibRows(odd, 30, 7)), 30, 7)).toEqual(odd);
  });

  it('draws a 1200 × 630 PNG in the game’s colors, small enough for every chat app', async () => {
    const png = await renderOgCard({ headline: 'Ana challenges you to beat 1,234 in Wing It', lines: ['2/6 players · Round 1'], game: { title: 'Wing It', accent: 'yellow' }, cta: 'Can you beat it?' });
    const c = chunks(png);
    const head = new DataView(c.get('IHDR')!.buffer, c.get('IHDR')!.byteOffset);
    expect([head.getUint32(0), head.getUint32(4), c.get('IHDR')![8], c.get('IHDR')![9]]).toEqual([OG_W, OG_H, 8, 3]);
    const palette = c.get('PLTE')!;
    expect(palette.length % 3).toBe(0);
    const px = unfilter(inflateSync(c.get('IDAT')!), OG_W, OG_H);
    expect(px.reduce((m, v) => Math.max(m, v), 0)).toBeLessThan(palette.length / 3);
    // The top-left corner is the accent's first color (yellow: #ffc928).
    expect([...palette.subarray(px[0]! * 3, px[0]! * 3 + 3)]).toEqual([0xff, 0xc9, 0x28]);
    expect(png.length).toBeLessThan(200_000);
  });

  it('sets Latin and Cyrillic, draws result squares, and leaves other emoji out', async () => {
    const f = await ogFonts();
    expect(measure(f.bold, 'Иван', 64)).toBeGreaterThan(100);
    expect(measure(f.bold, 'Ivan', 64)).toBeGreaterThan(100);
    expect(measure(f.text, '🟩🟩🟥', 36)).toBe(3 * 36);
    expect(measure(f.text, '🔥', 36)).toBe(0);
    expect(measure(f.text, '🔥 5', 36)).toBe(measure(f.text, '5', 36));
    // Long lines wrap evenly and end with … when they run out of room.
    const lines = wrap(f.bold, 'Ana challenges you to beat 1,234 in Wing It', 64, 984, 3);
    expect(lines).toHaveLength(2);
    expect(Math.abs(measure(f.bold, lines[0]!, 64) - measure(f.bold, lines[1]!, 64))).toBeLessThan(400);
    const cut = wrap(f.text, 'word '.repeat(80), 36, 500, 2);
    expect(cut).toHaveLength(2);
    expect(cut[1]!.endsWith('…')).toBe(true);
  });
});

/* ---------------------------------------------------------------- what shared links say */

describe('shared links preview as a picture of the invite', () => {
  const ORIGIN = 'https://glitchbound.test';
  const ANA = 'ana-device-key-0000000001';
  let env: Env;
  const TEMPLATE = `<!doctype html><html><head><title>GlitchBound</title><meta property="og:title" content="GlitchBound" /><meta property="og:image" content="${ORIGIN}/og.png" /></head><body></body></html>`;

  beforeEach(() => {
    env = { DB: memoryD1(), NR_DB: {} as Env['NR_DB'], ASSETS: { fetch: async () => new Response(TEMPLATE) } };
  });

  const get = (handler: (ctx: Ctx) => Promise<Response>, path: string, params: Record<string, string>): Promise<Response> => handler({ request: new Request(`${ORIGIN}${path}`), env, params });
  const meta = (html: string, prop: string): string | undefined => new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html)?.[1];
  const noEmoji = (s: string | undefined): boolean => !!s && !/\p{Extended_Pictographic}/u.test(s);

  async function picture(src: string): Promise<Response> {
    const url = new URL(src);
    const [, kind, file] = /^\/og\/(\w)\/(.+)$/.exec(url.pathname)!;
    return ogImage({ request: new Request(src), env, params: { kind: kind!, file: file! } });
  }

  it('a challenge: who challenges you, and the score to beat', async () => {
    const post = (handler: (ctx: Ctx) => Promise<Response>, path: string, body: Record<string, unknown>, params: Record<string, string> = {}) =>
      handler({ request: new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ ...body, key: ANA }) }), env, params });
    const { id } = (await (await post(createChallenge, '/api/challenges', { game: 'wing-it', mode: 'fresh', name: 'Ana' })).json()) as { id: string };
    let html = await (await get(challengePage, `/c/${id}`, { id })).text();
    expect(meta(html, 'og:title')).toBe('Ana challenges you in Wing It');
    await post(score, `/api/challenges/${id}/score`, { round: 1, score: 1234 }, { id });
    html = await (await get(challengePage, `/c/${id}`, { id })).text();
    expect(meta(html, 'og:title')).toBe('Ana challenges you to beat 1,234 in Wing It');
    expect(meta(html, 'og:image:alt')).toBe('Ana challenges you to beat 1,234 in Wing It');
    expect(noEmoji(meta(html, 'og:title')) && noEmoji(meta(html, 'og:description'))).toBe(true);
    const src = meta(html, 'og:image')!;
    expect(src).toMatch(new RegExp(`^${ORIGIN}/og/c/${id}\\.png\\?v=\\w+$`));
    const res = await picture(src);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('max-age=2592000');
    chunks(new Uint8Array(await res.arrayBuffer()));
  });

  it('a room: who is waiting, and the code', async () => {
    env.ROOMS = { idFromName: (n: string) => n, get: () => ({ fetch: async () => Response.json({ host: 'Bo', players: 2, game: 'belot' }) }) };
    const html = await (await get(roomPage, '/r/ABCDE', { code: 'abcde' })).text();
    expect(meta(html, 'og:title')).toBe('Bo saved you a seat at the Belot table');
    expect(meta(html, 'og:description')).toContain('Room ABCDE · 2 players waiting');
    expect(meta(html, 'og:image')).toMatch(new RegExp(`^${ORIGIN}/og/r/ABCDE\\.png\\?v=`));
    expect((await picture(meta(html, 'og:image')!)).headers.get('content-type')).toBe('image/png');
    // A party room, and one that has closed: never an emoji, never the 18+ game by default.
    env.ROOMS = { idFromName: (n: string) => n, get: () => ({ fetch: async () => Response.json({ host: '', players: 0, game: 'nhie' }) }) };
    expect(meta(await (await get(roomPage, '/r/ABCDE', { code: 'ABCDE' })).text(), 'og:title')).toBe('Join my Never Have I Ever room');
    env.ROOMS = { idFromName: (n: string) => n, get: () => ({ fetch: async () => new Response('gone', { status: 404 }) }) };
    expect(meta(await (await get(roomPage, '/r/ABCDE', { code: 'ABCDE' })).text(), 'og:title')).toBe('Join my party room');
  });

  it('a shared result: the sharer’s own lines on the picture', async () => {
    (env.DB as ReturnType<typeof memoryD1>).sqlite
      .prepare('INSERT INTO shares (code, path, title, description, visitor, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('Abc2345', '/games/letter-pinch', 'Letter Pinch #12 4/6', '🔼🟩🔽 · 🟩🟩🟩🟩🟩', 'v', Date.now());
    const html = await (await get(sharePage, '/s/Abc2345', { code: 'Abc2345' })).text();
    expect(meta(html, 'og:title')).toBe('Letter Pinch #12 4/6');
    expect(meta(html, 'og:image')).toMatch(new RegExp(`^${ORIGIN}/og/s/Abc2345\\.png\\?v=`));
    expect((await picture(meta(html, 'og:image')!)).headers.get('content-type')).toBe('image/png');
  });

  it('answers anything unknown with the site’s own card', async () => {
    for (const [kind, file] of [
      ['s', 'nope123.png'],
      ['c', 'nope123.png'],
      ['x', 'abcde.png'],
      ['c', '../etc.png'],
    ] as const) {
      const res = await ogImage({ request: new Request(`${ORIGIN}/og/${kind}/${file}`), env, params: { kind, file } });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(`${ORIGIN}/og.png`);
    }
  });
});
