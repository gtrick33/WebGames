/**
 * Sigilfall titles an admin gives (server/sigilfallTitles.ts, functions/api/admin/sigilfall/titles.ts): only words and
 * lights that are allowed, taken back for good, written to the change log, admins only, and carried with the member's
 * account (Me.sigilTitles) while they're held.
 */
import { describe, expect, it } from 'vitest';
import { onRequestDelete as deleteMe, onRequestGet as getMe } from '../functions/api/me';
import { onRequestGet as titlesGet, onRequestPost as titlesPost } from '../functions/api/admin/sigilfall/titles';
import type { Env } from '../server/http';
import { signIn } from '../server/signin';
import { checkTitle, grantTitle, liveTitles, revokeTitle, titlesFor, TITLES_MAX } from '../server/sigilfallTitles';
import { TITLE_MAX } from '../src/catalog/titleFx';
import type { GmTitle, Me, SigilTitleGrant } from '../src/platform/apiTypes';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost';

async function setup() {
  const db = memoryD1();
  const env: Env = { DB: db, NR_DB: {} as Env['NR_DB'], ADMIN_EMAILS: 'boss@example.com' };
  const member = async (name: string) => {
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: `dev:${name}`, email: `${name.toLowerCase()}@example.com`, name, givenName: '', picture: '', provider: 'email' });
    db.sqlite.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(name, user.id);
    return { id: user.id, jar: cookie.split(';')[0]! };
  };
  const boss = await member('Boss');
  const ash = await member('Ash');
  const post = (jar: string, body: unknown, origin = ORIGIN): Promise<Response> =>
    titlesPost({ request: new Request(`${ORIGIN}/api/admin/sigilfall/titles`, { method: 'POST', headers: { origin, cookie: jar, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env });
  const list = (jar: string, user: string): Promise<Response> => titlesGet({ request: new Request(`${ORIGIN}/api/admin/sigilfall/titles?user=${encodeURIComponent(user)}`, { headers: { cookie: jar } }), env });
  const me = async (jar: string): Promise<Me> => ((await (await getMe({ request: new Request(`${ORIGIN}/api/me`, { headers: { cookie: jar } }), env })).json()) as { user: Me }).user;
  const log = (): string[] => (db.sqlite.prepare("SELECT detail FROM admin_log WHERE action = 'sigilfall' ORDER BY ts, rowid").all() as { detail: string }[]).map((r) => r.detail);
  return { db, env, boss, ash, post, list, me, log };
}

describe('a title an admin types', () => {
  it('is tidied, needs words and a light there is, and reads on the side its words suggest unless told', () => {
    expect(checkTitle({ name: '  the   Kingslayer ', fx: 'ember' })).toEqual({ name: 'the Kingslayer', fx: 'ember', before: false });
    expect(checkTitle({ name: 'Blooded', fx: 'blood' })).toEqual({ name: 'Blooded', fx: 'blood', before: true });
    expect(checkTitle({ name: 'Champion of the Ring', fx: 'gilded' })).toMatchObject({ before: false });
    expect(checkTitle({ name: 'Blooded', fx: 'blood', before: false })).toMatchObject({ before: false });
    expect(checkTitle({ name: 'the Kingslayer', fx: 'ember', before: true })).toMatchObject({ before: true });
    // (a side that isn't a yes or no is the words' own)
    expect(checkTitle({ name: 'Blooded', fx: 'blood', before: 'no' })).toMatchObject({ before: true });
    expect(checkTitle({ name: '   ', fx: 'gleam' })).toBeTypeOf('string');
    expect(checkTitle({ name: '\u0000​ ', fx: 'gleam' })).toBeTypeOf('string');
    expect(checkTitle({ name: 42, fx: 'gleam' })).toBeTypeOf('string');
    expect(checkTitle({ name: 'Blooded', fx: 'rainbow' })).toBeTypeOf('string');
    expect(checkTitle({ name: 'Blooded', fx: undefined })).toBeTypeOf('string');
    const long = checkTitle({ name: 'x'.repeat(200), fx: 'void' });
    expect(typeof long === 'string' ? '' : long.name).toHaveLength(TITLE_MAX);
  });
});

describe('giving and taking back', () => {
  it('gives, lists and takes back; one taken back is kept on record but no longer held', async () => {
    const { env, ash } = await setup();
    const a = (await grantTitle(env, ash.id, { name: 'the Kingslayer', fx: 'ember' }, 'boss@example.com', 1000)) as SigilTitleGrant;
    const b = (await grantTitle(env, ash.id, { name: 'Blooded', fx: 'blood', before: true }, 'boss@example.com', 2000)) as SigilTitleGrant;
    expect(a).toMatchObject({ name: 'the Kingslayer', fx: 'ember', before: false, at: 1000 });
    expect((await liveTitles(env, ash.id)).map((t) => t.name)).toEqual(['the Kingslayer', 'Blooded']);
    expect(await revokeTitle(env, a.id, 3000)).toMatchObject({ userId: ash.id, title: { name: 'the Kingslayer' } });
    // once only
    expect(await revokeTitle(env, a.id, 4000)).toBeNull();
    expect(await revokeTitle(env, 'nope', 4000)).toBeNull();
    expect(await liveTitles(env, ash.id)).toEqual([b]);
    const all = await titlesFor(env, ash.id);
    expect(all.map((t): [string, number | null, string] => [t.name, t.revokedAt, t.by])).toEqual([
      ['Blooded', null, 'boss@example.com'],
      ['the Kingslayer', 3000, 'boss@example.com'],
    ]);
  });

  it('won’t give the same words twice while they’re held (in any case), nor more than the most a member holds', async () => {
    const { env, ash } = await setup();
    const a = (await grantTitle(env, ash.id, { name: 'Blooded', fx: 'blood' }, 'b')) as SigilTitleGrant;
    expect(await grantTitle(env, ash.id, { name: 'BLOODED', fx: 'ember' }, 'b')).toMatch(/already have/);
    await revokeTitle(env, a.id);
    expect(await grantTitle(env, ash.id, { name: 'blooded', fx: 'ember' }, 'b')).toMatchObject({ name: 'blooded', fx: 'ember' });
    for (let i = (await liveTitles(env, ash.id)).length; i < TITLES_MAX; i++) await grantTitle(env, ash.id, { name: `Title ${i}`, fx: 'gleam' }, 'b');
    expect(await grantTitle(env, ash.id, { name: 'One too many', fx: 'gleam' }, 'b')).toMatch(/Take one back/);
    expect(await liveTitles(env, ash.id)).toHaveLength(TITLES_MAX);
  });
});

describe('the admin endpoint', () => {
  it('is for admins only, from the site’s own pages', async () => {
    const { ash, boss, post, list } = await setup();
    expect((await post(ash.jar, { action: 'grant', userId: ash.id, name: 'Self-made', fx: 'gleam' })).status).toBe(403);
    expect((await post('', { action: 'grant', userId: ash.id, name: 'Nobody', fx: 'gleam' })).status).toBe(401);
    expect((await post(boss.jar, { action: 'grant', userId: ash.id, name: 'Elsewhere', fx: 'gleam' }, 'https://evil.example')).status).toBe(403);
    expect((await list(ash.jar, ash.id)).status).toBe(403);
    expect(((await (await list(boss.jar, ash.id)).json()) as { titles: GmTitle[] }).titles).toEqual([]);
  });

  it('gives and takes back, says why it can’t, and writes each to the change log', async () => {
    const { ash, boss, post, list, log } = await setup();
    const res = await post(boss.jar, { action: 'grant', userId: ash.id, name: ' the  Kingslayer', fx: 'ember', before: false });
    expect(res.status).toBe(200);
    const { title } = (await res.json()) as { title: SigilTitleGrant };
    expect(title).toMatchObject({ name: 'the Kingslayer', fx: 'ember', before: false });
    const bad = await post(boss.jar, { action: 'grant', userId: ash.id, name: 'Blooded', fx: 'rainbow' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toBe('Pick a light for it.');
    expect((await post(boss.jar, { action: 'grant', userId: ash.id, name: '', fx: 'ember' })).status).toBe(400);
    expect((await post(boss.jar, { action: 'grant', userId: 'nobody', name: 'Blooded', fx: 'blood' })).status).toBe(404);
    expect((await list(boss.jar, 'nobody')).status).toBe(404);
    expect((await post(boss.jar, { action: 'revoke', id: title.id })).status).toBe(200);
    expect((await post(boss.jar, { action: 'revoke', id: title.id })).status).toBe(404);
    expect((await post(boss.jar, { action: 'explode' })).status).toBe(400);
    const titles = ((await (await list(boss.jar, ash.id)).json()) as { titles: GmTitle[] }).titles;
    expect(titles).toHaveLength(1);
    expect(titles[0]).toMatchObject({ name: 'the Kingslayer', by: 'boss@example.com' });
    expect(titles[0]!.revokedAt).toBeTypeOf('number');
    expect(log()).toEqual(['Sigilfall, Ash: gave the title “the Kingslayer” (Ember, after the name)', 'Sigilfall, Ash: took back the title “the Kingslayer”']);
  });
});

describe('the member’s account', () => {
  it('carries the titles they hold, in the shape the game reads, and nobody else’s', async () => {
    const { ash, boss, post, me } = await setup();
    expect((await me(ash.jar)).sigilTitles).toEqual([]);
    await post(boss.jar, { action: 'grant', userId: ash.id, name: 'Blooded', fx: 'blood', before: true });
    const gone = ((await (await post(boss.jar, { action: 'grant', userId: ash.id, name: 'the Lost', fx: 'void' })).json()) as { title: SigilTitleGrant }).title;
    await post(boss.jar, { action: 'grant', userId: ash.id, name: 'Champion of the Ring', fx: 'ashfire' });
    await post(boss.jar, { action: 'revoke', id: gone.id });
    const held = (await me(ash.jar)).sigilTitles!;
    expect(held.map((t) => [t.name, t.fx, t.before])).toEqual([
      ['Blooded', 'blood', true],
      ['Champion of the Ring', 'ashfire', false],
    ]);
    for (const t of held) expect(Object.keys(t).sort()).toEqual(['at', 'before', 'fx', 'id', 'name']);
    expect((await me(boss.jar)).sigilTitles).toEqual([]);
  });

  it('still loads before the table exists, and a deleted account takes its titles with it', async () => {
    const { db, env, ash, boss, post } = await setup();
    await post(boss.jar, { action: 'grant', userId: ash.id, name: 'Blooded', fx: 'blood' });
    const res = await deleteMe({ request: new Request(`${ORIGIN}/api/me`, { method: 'DELETE', headers: { origin: ORIGIN, cookie: ash.jar } }), env });
    expect(res.status).toBe(200);
    expect((db.sqlite.prepare('SELECT COUNT(*) AS n FROM sigilfall_titles').get() as { n: number }).n).toBe(0);
    db.sqlite.exec('DROP TABLE sigilfall_titles');
    expect(await liveTitles(env, boss.id)).toEqual([]);
  });
});
