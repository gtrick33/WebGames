import { beforeEach, describe, expect, it } from 'vitest';
import { boardOf, onRequestGet as getRanks, onRequestPost as postRanks, type RankRow } from '../functions/api/sigilfall/ranks';
import type { Ctx, Env } from '../server/http';
import { signIn } from '../server/signin';
import { MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { newCharacter } from '../src/games/sigilfall/progress/character';
import { levelOf, levelScore, rankEntries } from '../src/games/sigilfall/progress/ranks';
import { emptySave } from '../src/games/sigilfall/progress/save';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';
type Handler = (ctx: Ctx) => Promise<Response>;
interface Board {
  board: string;
  rows: RankRow[];
  mine: RankRow | null;
  signedIn: boolean;
}

describe('Sigilfall rankings: the server', () => {
  let env: Env;
  let db: ReturnType<typeof memoryD1>;
  const cookies: Record<string, string> = {};

  async function call<T>(handler: Handler, path: string, body: unknown, who: string | null, origin = ORIGIN): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { origin, ...(who ? { cookie: cookies[who]! } : {}) };
    const init: RequestInit = body === undefined ? { headers } : { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) };
    const res = await handler({ request: new Request(`${ORIGIN}${path}`, init), env, params: {} });
    return { status: res.status, data: (await res.json()) as T };
  }
  const post = (who: string | null, entries: unknown) => call<{ ok?: boolean; kept?: number }>(postRanks, '/api/sigilfall/ranks', { entries }, who);
  const board = (name: string, who: string | null = null) => call<Board>(getRanks, `/api/sigilfall/ranks?board=${name}`, undefined, who);

  beforeEach(async () => {
    db = memoryD1();
    env = { DB: db, NR_DB: {} as Env['NR_DB'], ADMIN_EMAILS: '' };
    for (const who of ['ana', 'ben', 'cy']) {
      const s = await signIn(env, new Request(ORIGIN), { sub: `dev:${who}@example.com`, email: `${who}@example.com`, name: who, givenName: '', picture: '', provider: 'email' });
      cookies[who] = s.cookie.split(';')[0]!;
    }
  });

  it('knows its boards: the modes, a calling of the Trials, a land of the Vigil, a format of the Ring, and nothing else', () => {
    for (const ok of ['trial', 'trial:mage', 'stone', 'vigil', 'vigil:pale-reach', 'ring', 'ring:solo', 'ring:duo', 'ring:trio', 'level']) expect(boardOf(ok), ok).not.toBeNull();
    for (const no of ['', 'gold', 'ring:mage', 'ring:quad', 'ring:1v1', 'stone:warrior', 'trial:', 'trial:Mage', 'trial:a', "vigil:x'; DROP", 7, null]) expect(boardOf(no), String(no)).toBeNull();
  });

  it('keeps each of the Ring’s formats on a board of its own', async () => {
    await post('ana', [
      { board: 'ring:solo', score: 1320 },
      { board: 'ring:trio', score: 1180 },
    ]);
    await post('ben', [{ board: 'ring:solo', score: 1410 }]);
    expect((await board('ring:solo')).data.rows.map((r) => r.score)).toEqual([1410, 1320]);
    expect((await board('ring:duo')).data.rows).toEqual([]);
    expect((await board('ring:trio')).data.rows.map((r) => r.score)).toEqual([1180]);
  });

  it('ranks every player on a board, best first; equal scores share a rank', async () => {
    await post('ana', [{ board: 'trial', score: 7 }]);
    await post('ben', [{ board: 'trial', score: 12 }]);
    await post('cy', [{ board: 'trial', score: 7 }]);
    const { status, data } = await board('trial', 'cy');
    expect(status).toBe(200);
    expect(data.rows.map((r) => [r.rank, r.score])).toEqual([[1, 12], [2, 7], [2, 7]]);
    expect(data.rows.filter((r) => r.you).length).toBe(1);
    expect(data.signedIn).toBe(true);
    // a visitor reads it too, and is told they are not on it
    const guest = await board('trial');
    expect(guest.data.rows.length).toBe(3);
    expect(guest.data.signedIn).toBe(false);
    expect(guest.data.rows.some((r) => r.you)).toBe(false);
  });

  it('a row only ever goes up', async () => {
    await post('ana', [{ board: 'ring', score: 1400 }]);
    await post('ana', [{ board: 'ring', score: 1200 }]);
    expect((await board('ring')).data.rows[0]!.score).toBe(1400);
    await post('ana', [{ board: 'ring', score: 1500 }]);
    expect((await board('ring')).data.rows[0]!.score).toBe(1500);
    expect((db.sqlite.prepare('SELECT COUNT(*) AS n FROM sigilfall_ranks').get() as { n: number }).n).toBe(1);
  });

  it('takes only what the game can give: a real board, a whole number in its range', async () => {
    const r = await post('ana', [
      { board: 'trial', score: 5000 },
      { board: 'gold', score: 5 },
      { board: 'vigil', score: -3 },
      { board: 'ring', score: 'lots' },
      { board: 'level', score: levelScore(60, 12) + 0.7 },
      { board: 'vigil:whisperwood', score: 412 },
      'nonsense',
    ]);
    expect(r.data.kept).toBe(2);
    expect((await board('trial')).data.rows).toEqual([]);
    expect((await board('level')).data.rows[0]!.score).toBe(levelScore(60, 12));
    expect((await board('vigil:whisperwood')).data.rows[0]!.score).toBe(412);
  });

  it('is for signed-in players, from the site itself', async () => {
    expect((await post(null, [{ board: 'trial', score: 3 }])).status).toBe(401);
    expect((await call(postRanks, '/api/sigilfall/ranks', { entries: [{ board: 'trial', score: 3 }] }, 'ana', 'https://elsewhere.example')).status).toBe(403);
    expect((await board('nope')).status).toBe(404);
  });

  it('leaves a banned player off, and shows a player below the top their own place', async () => {
    await post('ana', [{ board: 'stone', score: 9 }]);
    await post('ben', [{ board: 'stone', score: 4 }]);
    db.sqlite.prepare("UPDATE users SET banned_at = 1 WHERE email = 'ana@example.com'").run();
    const seen = await board('stone', 'ben');
    expect(seen.data.rows.map((r) => r.score)).toEqual([4]);
    // fifty ahead of Ben: he is not in the list, and is told where he stands
    db.sqlite.prepare("UPDATE users SET banned_at = NULL WHERE email = 'ana@example.com'").run();
    for (let i = 0; i < 55; i++) {
      const s = await signIn(env, new Request(ORIGIN), { sub: `dev:p${i}@example.com`, email: `p${i}@example.com`, name: `p${i}`, givenName: '', picture: '', provider: 'email' });
      cookies[`p${i}`] = s.cookie.split(';')[0]!;
      await post(`p${i}`, [{ board: 'stone', score: 20 + i }]);
    }
    const far = await board('stone', 'ben');
    expect(far.data.rows.length).toBe(50);
    expect(far.data.mine).toMatchObject({ rank: 57, score: 4, you: true });
  });
});

describe('Sigilfall rankings: what an account sends', () => {
  it('nothing, for an account that has done nothing', () => {
    expect(rankEntries(emptySave(), {}, 0)).toEqual([]);
  });

  it('each mode\'s best: the Trials by calling and overall, a level-60 hero\'s own stone, the highest hero, the Vigil by land and overall, the Ring', () => {
    const save = emptySave() as ReturnType<typeof emptySave> & { rift?: Record<string, number> };
    save.rift = { mage: 9, warrior: 4, ranger: 1 };
    const top = newCharacter('mage', 'A', 'a', 0);
    top.level = MAX_LEVEL;
    top.keystone = 14;
    top.para.l = 3;
    const young = newCharacter('warrior', 'B', 'b', 0);
    young.level = 31;
    young.keystone = 20;
    save.heroes[0] = top;
    save.heroes[1] = young;
    const got = Object.fromEntries(rankEntries(save, { whisperwood: 300, thornvale: 512 }, 1460).map((e) => [e.board, e.score]));
    expect(got).toEqual({
      'trial:mage': 9,
      'trial:warrior': 4,
      trial: 9,
      // (the young hero's stone doesn't count: a story hero's Riftstones are for level 60)
      stone: 14,
      level: levelScore(MAX_LEVEL, 3),
      'vigil:whisperwood': 300,
      'vigil:thornvale': 512,
      vigil: 512,
      ring: 1460,
    });
    expect(levelOf(got.level!)).toEqual({ level: MAX_LEVEL, paragon: 3 });
  });

  it('the Ring’s formats, each on its own board, for every format a match has been played in', () => {
    const got = Object.fromEntries(rankEntries(emptySave(), {}, 1460, { 1: 1460, 3: 1000 }).map((e) => [e.board, e.score]));
    expect(got).toEqual({ ring: 1460, 'ring:solo': 1460, 'ring:trio': 1000 });
  });

  it('a hero jumped to a story beat for review is on no board', () => {
    const save = emptySave();
    const c = newCharacter('mage', 'A', 'a', 0);
    c.level = MAX_LEVEL;
    c.keystone = 30;
    c.review = true;
    save.heroes[0] = c;
    expect(rankEntries(save, {}, 0)).toEqual([]);
  });
});
