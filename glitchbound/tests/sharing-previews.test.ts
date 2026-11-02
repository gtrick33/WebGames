import { beforeEach, describe, expect, it } from 'vitest';
import { onRequestPost as createChallenge } from '../functions/api/challenges/index';
import { onRequestPost as closeChallenge } from '../functions/api/challenges/[id]/close';
import { onRequestPost as joinChallenge } from '../functions/api/challenges/[id]/join';
import { onRequestPost as score } from '../functions/api/challenges/[id]/score';
import { onRequestPost as createShare } from '../functions/api/shares';
import { onRequestGet as challengePage } from '../functions/c/[id]';
import { onRequestGet as ogImage } from '../functions/og/[kind]/[file]';
import { onRequestGet as roomPage } from '../functions/r/[code]';
import { onRequestGet as sharePage } from '../functions/s/[code]';
import type { Ctx, Env } from '../server/http';
import { roomInvite, SHARED_BY } from '../server/invites';
import { drawable, measure, ogFonts, renderOgCard } from '../server/ogImage';
import { previewPage, shareGame, sharePath, shareText } from '../server/shares';
import { memoryD1 } from './d1';

const ORIGIN = 'https://glitchbound.test';
const TEMPLATE = `<!doctype html><html><head><title>GlitchBound</title><meta property="og:title" content="GlitchBound" /><meta property="og:image" content="${ORIGIN}/og.png" /></head><body><p>page</p></body></html>`;
const meta = (html: string, prop: string): string | undefined => new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html)?.[1];

let env: Env;
beforeEach(() => {
  env = { DB: memoryD1(), NR_DB: {} as Env['NR_DB'], ASSETS: { fetch: async () => new Response(TEMPLATE) } };
});
const get = (handler: (ctx: Ctx) => Promise<Response>, path: string, params: Record<string, string>): Promise<Response> => handler({ request: new Request(`${ORIGIN}${path}`), env, params });
const post = (handler: (ctx: Ctx) => Promise<Response>, path: string, body: Record<string, unknown>, params: Record<string, string> = {}): Promise<Response> =>
  handler({ request: new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, params, waitUntil: () => undefined });
const room = (info: Record<string, unknown> | number): void => {
  env.ROOMS = { idFromName: (n: string) => n, get: () => ({ fetch: async () => (typeof info === 'number' ? new Response('', { status: info }) : Response.json(info)) }) };
};

describe('preview pages keep player text as text (PB-02)', () => {
  it('a name with $\' $` $& or $$ never pulls parts of the page into the tags', async () => {
    for (const name of ["A$'B", 'A$`B', 'A$&B', 'A$$B', "$'$`$&"]) {
      const res = await previewPage(env, new Request(`${ORIGIN}/r/ABCDE`), '/party', { title: `${name} wants you in a room`, description: `${name} is waiting`, replaceUrl: `/party?room=${name}` });
      const html = await res.text();
      expect(meta(html, 'og:title')).toBe(`${name.replace(/&/g, '&amp;')} wants you in a room`);
      expect(meta(html, 'og:description')).toBe(`${name.replace(/&/g, '&amp;')} is waiting`);
      expect(html.match(/<title>/g)).toHaveLength(1);
      expect(html.match(/og:title/g)).toHaveLength(1);
      expect(html.match(/<p>page<\/p>/g)).toHaveLength(1);
      expect(html.length).toBeLessThan(TEMPLATE.length + 600);
    }
  });

  it('a room host named BG-$\'Zed previews cleanly', async () => {
    room({ host: "BG-$'Zed", players: 2, phase: 'lobby', full: false, game: 'nhie' });
    const html = await (await get(roomPage, '/r/ABCDE', { code: 'ABCDE' })).text();
    expect(meta(html, 'og:title')).toBe("BG-$'Zed wants you in a Never Have I Ever room");
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe("BG-$'Zed wants you in a Never Have I Ever room");
  });
});

describe('share links for renamed games (WW-04)', () => {
  it('takes a game by its address name', () => {
    expect(sharePath('/games/quizbelief')).toBe('/games/quizbelief');
    expect(sharePath('/games/wait-what')).toBe('/games/wait-what');
    expect(shareGame('/games/quizbelief')).toBe('wait-what');
    expect(shareGame('/games/nope')).toBeUndefined();
  });

  it('makes a short link whose preview is the result, on the game’s card', async () => {
    const res = await post(createShare, '/api/shares', { path: '/games/quizbelief', title: 'Quizbelief #13 4/5', description: '🟩🟩🟥🟩🟩' });
    expect(res.status).toBe(200);
    const { code } = (await res.json()) as { code: string };
    const html = await (await get(sharePage, `/s/${code}`, { code })).text();
    expect(meta(html, 'og:title')).toBe('Quizbelief #13 4/5');
    expect(meta(html, 'og:description')).toBe(`🟩🟩🟥🟩🟩 · ${SHARED_BY}`);
    const src = new URL(meta(html, 'og:image')!);
    const png = await ogImage({ request: new Request(src), env, params: { kind: 's', file: `${code}.png` } });
    expect(png.headers.get('content-type')).toBe('image/png');
  });
});

describe('shared result cards say only what a result says (PS-07)', () => {
  it('keeps the games’ own result lines', () => {
    for (const [title, description] of [
      ['Letter Pinch #12 4/6', '🔼🟩🔽 · 🟩🟩🟩🟩🟩'],
      ['📦 Whatsit #12 · 🌵 · 4 questions · ✅', ''],
      ['GlitchBound · 5/6 dailies', 'Oct 30 · Best streak 4'],
      ['Launch Control #40 🏁', 'Best today: 12,345 (3 runs)'],
      ['Куизбилийф #13 4/5', 'Серия: 7 дни'],
      ['Wait, What? 9/10', '123,456,789 points'],
    ]) expect(shareText(title, description), title).not.toBeNull();
  });

  it('refuses links, money and prize talk, and drops markup', () => {
    for (const [title, description] of [
      ['GlitchBound official: you won a $500 gift card', 'Claim it today at example.com/claim · Offer ends at midnight'],
      ['Wing It #2', 'see example.com'],
      ['Wing It #2', 'https://evil.test'],
      ['Win 500 € now', ''],
      ['Спечелихте 100 лв', ''],
      ['Call 0888 123 456 7', ''],
      ['Ask @someone', ''],
      ['Big prize inside', ''],
      ['Free cash', ''],
    ]) expect(shareText(title, description), title).toBeNull();
    expect(shareText('<b>Wing It</b> {34}', '')!.title).toBe('bWing It/b 34');
  });

  it('answers a bad share with 400, and the card names the game and who shared it', async () => {
    expect((await post(createShare, '/api/shares', { path: '/games/wing-it', title: 'GlitchBound official: you won a $500 gift card', description: 'Claim it at example.com/claim' })).status).toBe(400);
    // A link made before these checks falls back to the game's own card.
    (env.DB as ReturnType<typeof memoryD1>).sqlite
      .prepare('INSERT INTO shares (code, path, title, description, visitor, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('Old2345', '/games/wing-it', 'You won a $500 gift card', 'Claim at example.com', 'v', Date.now());
    const html = await (await get(sharePage, '/s/Old2345', { code: 'Old2345' })).text();
    expect(meta(html, 'og:title')).toBe('A Wing It result');
    expect(meta(html, 'og:description')).toBe(SHARED_BY);
  });
});

describe('room invites say what the room is doing (SFC-06, PB-09, CA-17)', () => {
  it('a lobby waits for you', async () => {
    room({ host: 'Bo', players: 2, phase: 'lobby', full: false, game: 'belot' });
    const inv = await roomInvite(env, 'ABCDE');
    expect(inv.card.lines).toEqual(['Room ABCDE · 2 players waiting']);
    expect(inv.card.cta).toBe('Join the room');
  });

  it('a full room says so', async () => {
    room({ host: 'Ana', players: 4, phase: 'lobby', full: true, game: 'sigilfall' });
    const inv = await roomInvite(env, 'ABCDE');
    expect(inv.description).toContain('Room ABCDE · Room full · 4 players');
    expect(inv.description).not.toContain('waiting');
    expect(inv.card.cta).toBe('Open Sigilfall');
  });

  it('a Sigilfall party in a run takes nobody', async () => {
    room({ host: 'Ana', players: 2, phase: 'run', full: false, game: 'sigilfall' });
    const inv = await roomInvite(env, 'ABCDE');
    expect(inv.card.lines).toEqual(['Room ABCDE · In a Riftstone run right now']);
    expect(inv.card.cta).toBe('Open Sigilfall');
  });

  it('an adult game mid-round: playing, and marked 18+', async () => {
    room({ host: 'Cy', players: 3, phase: 'picking', full: false });
    const inv = await roomInvite(env, 'ABCDE');
    expect(inv.title).toBe('Cy wants you in a Crass Act room');
    expect(inv.card.lines).toEqual(['Room ABCDE · 3 playing · game in progress']);
    expect(inv.card.adult).toBe(true);
    expect(inv.description).toContain('18+');
    room({ host: 'Cy', players: 3, phase: 'over', full: false });
    expect((await roomInvite(env, 'ABCDE')).card.lines).toEqual(['Room ABCDE · 3 players · between games']);
  });

  it('a party room gets its game’s name and colors on the picture', async () => {
    room({ host: 'Bo', players: 3, phase: 'lobby', full: false, game: 'hues' });
    const inv = await roomInvite(env, 'ABCDE');
    expect(inv.card.game).toEqual({ title: 'Hue Knew?', accent: 'coral' });
    expect(inv.card.adult).toBeUndefined();
  });

  it('a mistyped or closed code says it can’t be found, not that it closed', async () => {
    room(404);
    const html = await (await get(roomPage, '/r/ZZZZZ', { code: 'ZZZZZ' })).text();
    expect(meta(html, 'og:title')).toBe('We can’t find room ZZZZZ');
    expect(meta(html, 'og:description')).toContain('Check the code, or start a new room');
    expect(html).not.toContain('has closed');
    // A room that could not be asked: the plain party invite.
    room(500);
    expect((await roomInvite(env, 'ABCDE')).title).toBe('Join my party room');
  });
});

describe('an ended challenge names the real result (PS-06)', () => {
  it('ties are ties, and a round played alone wins nothing', async () => {
    const ana = { key: 'ana-device-key-0000000001', name: 'Ana' };
    const bo = { key: 'bo-device-key-00000000001', name: 'Bo' };
    const { id } = (await (await post(createChallenge, '/api/challenges', { game: 'wing-it', mode: 'fresh', ...ana })).json()) as { id: string };
    expect((await post(joinChallenge, `/api/challenges/${id}/join`, bo, { id })).status).toBe(200);
    await post(score, `/api/challenges/${id}/score`, { round: 1, score: 431, ...ana }, { id });
    await post(score, `/api/challenges/${id}/score`, { round: 1, score: 431, ...bo }, { id });
    await post(closeChallenge, `/api/challenges/${id}/close`, ana, { id });
    const html = await (await get(challengePage, `/c/${id}`, { id })).text();
    expect(meta(html, 'og:title')).toBe("Ana's Wing It challenge has ended");
    expect(meta(html, 'og:description')).toContain('Ana and Bo tied with 1 round win each');
    expect(meta(html, 'og:description')).not.toContain('won');
  });
});

describe('the picture leaves out what it can’t draw, cleanly (OH-15, WH-06)', () => {
  it('drops an emoji with its separator, and draws verdicts and result marks as shapes', async () => {
    const f = await ogFonts();
    expect(drawable(f.bold, '📦 Whatsit #12 · 🌵 · 4 questions · ✅')).toBe('Whatsit #12 · 4 questions · ✅');
    expect(drawable(f.bold, 'Whatsit #12 · 🌵🎁 · 4')).toBe('Whatsit #12 · 4');
    expect(drawable(f.bold, '🌵 · Whatsit')).toBe('Whatsit');
    expect(drawable(f.bold, 'Ana · Bo')).toBe('Ana · Bo');
    expect(measure(f.text, '💨🟡💨💥', 36)).toBe(4 * 36);
    expect(measure(f.text, '✅❌', 36)).toBe(2 * 36);
    const png = await renderOgCard({ headline: 'Whatsit #12 · 🌵 · 4 questions · ✅', lines: ['💨🟡💨💨💨'], game: { title: 'Crass Act', accent: 'coral' }, adult: true, byline: SHARED_BY, cta: 'Play Crass Act' });
    expect(png.length).toBeGreaterThan(1000);
  });
});
