/**
 * Who is playing right now. A signed-in player's open tab says it is there by asking for invitations (it does anyway,
 * every 45 seconds; Sigilfall every 20, from inside itself), and for a couple of minutes after their friends see
 * them as online, and in which game. Only friends are told, only "online" or not, and an invitation carries its
 * room's code so a game can show it inside itself and join without leaving.
 */
import { describe, expect, it } from 'vitest';
import { onRequestGet as friendsGet, onRequestPost as friendsPost } from '../functions/api/friends';
import { onRequestGet as invitesGet } from '../functions/api/friends/invites';
import { ONLINE_MS, presenceOf, presencePlace, stampPresence } from '../server/friends';
import type { Env } from '../server/http';
import { signIn } from '../server/signin';
import type { FriendInvite, FriendsView } from '../src/platform/apiTypes';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';

async function setup() {
  const db = memoryD1();
  const env = { DB: db, NR_DB: {} as Env['NR_DB'] } as Env;
  const person = async (name: string) => {
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: `dev:${name}@example.com`, email: `${name}@example.com`, name, givenName: '', picture: '', provider: 'email' });
    const c = cookie.split(';')[0]!;
    const post = (body: unknown) => friendsPost({ request: new Request(`${ORIGIN}/api/friends`, { method: 'POST', headers: { origin: ORIGIN, cookie: c, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, params: {} });
    const view = async () => (await (await friendsGet({ request: new Request(`${ORIGIN}/api/friends`, { headers: { cookie: c } }), env, params: {} })).json()) as FriendsView;
    /** The tab asking whether a friend wants them: from the site, or from inside a game. */
    const ask = async (where = '') => ((await (await invitesGet({ request: new Request(`${ORIGIN}/api/friends/invites${where ? `?in=${where}` : ''}`, { headers: { cookie: c } }), env, params: {} })).json()) as { invites: FriendInvite[] }).invites;
    return { user, cookie: c, post, view, ask };
  };
  const row = (id: string) => db.sqlite.prepare('SELECT online_at, online_in FROM users WHERE id = ?').get(id) as { online_at: number; online_in: string };
  return { db, env, person, row };
}

describe('presence: who is playing right now', () => {
  it('a friend is offline until their tab says it is there, then online, and in the game it said it from', async () => {
    const { person } = await setup();
    const [a, b] = [await person('ann'), await person('bob')];
    await b.post({ action: 'add', code: (await a.view()).code });
    const bob = async () => (await a.view()).friends.find((f) => f.id === b.user.id)!;
    expect(await bob()).toMatchObject({ online: false, onlineIn: null });
    // Bob's tab on the site asks for invitations, as it does every 45 seconds
    await b.ask();
    expect(await bob()).toMatchObject({ online: true, onlineIn: null });
    // Bob opens Sigilfall, which asks from inside itself
    await b.ask('sigilfall');
    expect(await bob()).toMatchObject({ online: true, onlineIn: 'sigilfall' });
    // and it goes both ways, to friends alone
    expect((await b.view()).friends[0]).toMatchObject({ online: false });
    await a.ask('sigilfall');
    expect((await b.view()).friends[0]).toMatchObject({ online: true, onlineIn: 'sigilfall' });
  });

  it('wears off a couple of minutes after the last sign of life, and the time itself is never sent', async () => {
    const { db, person } = await setup();
    const [a, b] = [await person('ann'), await person('bob')];
    await b.post({ action: 'add', code: (await a.view()).code });
    await b.ask('sigilfall');
    // (the tab went to the background, or was closed: it asks for nothing more)
    db.sqlite.prepare('UPDATE users SET online_at = ? WHERE id = ?').run(Date.now() - ONLINE_MS - 1000, b.user.id);
    const bob = (await a.view()).friends[0]!;
    expect(bob).toMatchObject({ online: false, onlineIn: null });
    expect(Object.keys(bob).some((k) => /online_?at/i.test(k))).toBe(false);
    expect(presenceOf({ online_at: 1000, online_in: 'sigilfall' }, 1000 + ONLINE_MS - 1)).toEqual({ online: true, onlineIn: 'sigilfall' });
    expect(presenceOf({ online_at: 1000, online_in: 'sigilfall' }, 1000 + ONLINE_MS)).toEqual({ online: false, onlineIn: null });
    expect(presenceOf({})).toEqual({ online: false, onlineIn: null });
  });

  it('is written at most once a minute, or at once when the place changes', async () => {
    const { env, person, row } = await setup();
    const a = await person('ann');
    const me = { id: a.user.id };
    expect(await stampPresence(env, { ...me, ...row(me.id) }, '', 100_000)).toBe(true);
    expect(row(me.id)).toEqual({ online_at: 100_000, online_in: '' });
    // twenty seconds on, in the same place: nothing worth a write
    expect(await stampPresence(env, { ...me, ...row(me.id) }, '', 120_000)).toBe(false);
    expect(row(me.id).online_at).toBe(100_000);
    // into the game: written at once
    expect(await stampPresence(env, { ...me, ...row(me.id) }, 'sigilfall', 121_000)).toBe(true);
    expect(row(me.id)).toEqual({ online_at: 121_000, online_in: 'sigilfall' });
    expect(await stampPresence(env, { ...me, ...row(me.id) }, 'sigilfall', 190_000)).toBe(true);
    // only a game friends can be invited into is a place; anything else is the site
    expect(presencePlace('sigilfall')).toBe('sigilfall');
    for (const v of [null, undefined, '', 'nope', '<script>', 'constructor', 42]) expect(presencePlace(v), String(v)).toBe('');
  });

  it('is told to friends only: not to a stranger, not to someone blocked, and a guest says nothing', async () => {
    const { env, person, row } = await setup();
    const [a, b, c] = [await person('ann'), await person('bob'), await person('cat')];
    await b.post({ action: 'add', code: (await a.view()).code });
    await b.ask('sigilfall');
    // Cat is nobody's friend: she has no list to see Bob on
    expect((await c.view()).friends).toEqual([]);
    // Ann blocks Bob: he is off her list, and she off his
    await a.post({ action: 'block', id: b.user.id });
    expect((await a.view()).friends).toEqual([]);
    expect((await b.view()).friends).toEqual([]);
    // nobody signed in: no invitations, and nothing written
    const guest = (await (await invitesGet({ request: new Request(`${ORIGIN}/api/friends/invites?in=sigilfall`), env, params: {} })).json()) as { invites: unknown[] };
    expect(guest.invites).toEqual([]);
    expect(row(c.user.id)).toEqual({ online_at: 0, online_in: '' });
  });
});

describe('an invitation a game can show inside itself', () => {
  it('carries the room’s code beside the link, for the friend it was sent to', async () => {
    const { person } = await setup();
    const [a, b] = [await person('ann'), await person('bob')];
    await b.post({ action: 'add', code: (await a.view()).code });
    await a.post({ action: 'invite', id: b.user.id, game: 'sigilfall', code: 'FGHIJ' });
    expect(await b.ask('sigilfall')).toEqual([expect.objectContaining({ from: a.user.nickname, game: 'sigilfall', href: '/sigilfall?room=FGHIJ', code: 'FGHIJ' })]);
    // (Ann sent it; she is asked nothing)
    expect(await a.ask('sigilfall')).toEqual([]);
  });
});
