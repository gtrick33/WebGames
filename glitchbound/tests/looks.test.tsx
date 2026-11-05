/**
 * Borders and banners: a member wears only what they own, a refund takes it off everywhere, and every board shows it
 * around the player's initial and behind their name, never their photo.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as hall } from '../functions/api/hall';
import { onRequestGet as leaderboard } from '../functions/api/leaderboard';
import { onRequestGet as friendsGet } from '../functions/api/friends';
import { onRequestGet as getMe, onRequestPatch as patchMe } from '../functions/api/me';
import { isLookIn, lookOf, sanitizeLook, STYLES, wornFrom } from '../src/catalog/looks';
import { PRODUCTS } from '../src/catalog/shop';
import { applyStripeEvent, giftItem } from '../server/shop';
import type { Env } from '../server/http';
import { signIn } from '../server/signin';
import type { FriendRow, HallRow, LeaderRow, Me } from '../src/platform/apiTypes';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The built-in looks sold on their own (the Gloamknight Pack's own come with it, hidden). */
const LOOKS = PRODUCTS.filter((p) => p.look && !p.hidden);

describe('the looks', () => {
  it('are each a shop item in one of the site’s styles, and only change how someone looks', () => {
    for (const kind of ['border', 'banner', 'icon'] as const) {
      // one built-in item per style
      expect(LOOKS.filter((p) => p.look!.kind === kind).map((p) => p.look!.style)).toEqual(STYLES[kind].map((s) => s.id));
      for (const s of STYLES[kind]) expect(s.colors.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    }
    for (const p of LOOKS) {
      expect(p.id).toBe(`${p.look!.kind}-${p.look!.style}`);
      expect(p.later).toBeUndefined();
      expect(`${p.name} ${p.blurb}`).not.toMatch(/\b(win|wins|winning|stronger|faster|boost|score)\b/i);
    }
    expect(isLookIn('border-glitch', 'border', PRODUCTS)).toBe(true);
    expect(isLookIn('border-glitch', 'banner', PRODUCTS)).toBe(false);
    expect(lookOf('ad-free', PRODUCTS)).toBeUndefined();
  });

  it('keep an admin’s look only in a style the site can draw, with real colors', () => {
    expect(sanitizeLook({ kind: 'border', style: 'frost', colors: ['#AABBCC', '#112233'] })).toEqual({ kind: 'border', style: 'frost', colors: ['#aabbcc', '#112233'] });
    expect(sanitizeLook({ kind: 'border', style: 'frost', colors: ['red'] })).toEqual({ kind: 'border', style: 'frost' });
    expect(sanitizeLook({ kind: 'banner', style: 'frost' })).toBeNull();
    expect(sanitizeLook({ kind: 'hat', style: 'fox' })).toBeNull();
    expect(sanitizeLook('fox')).toBeNull();
  });

  it('show only while owned and of the right kind', () => {
    expect(wornFrom({ border: 'border-glitch', banner: 'banner-aurora', icon: 'icon-fox' }, ['border-glitch', 'icon-fox'], PRODUCTS)).toEqual({ border: 'border-glitch', banner: '', icon: 'icon-fox' });
    expect(wornFrom({ border: 'banner-aurora', banner: 'border-glitch' }, ['banner-aurora', 'border-glitch'], PRODUCTS)).toEqual({ border: '', banner: '', icon: '' });
    expect(wornFrom({ border: null, banner: undefined }, [], PRODUCTS)).toEqual({ border: '', banner: '', icon: '' });
  });
});

function setup() {
  const db = memoryD1();
  const env = { DB: db, NR_DB: {} as Env['NR_DB'] } as Env;
  const member = async (name: string, score: number) => {
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: `dev:${name}@example.com`, email: `${name}@example.com`, name, givenName: '', picture: `https://photos.example/${name}.jpg`, provider: 'email' });
    db.sqlite.prepare(`UPDATE users SET nickname = ? WHERE id = ?`).run(name, user.id);
    db.sqlite.prepare(`INSERT INTO bests (user_id, game, score, at) VALUES (?, 'gut-check', ?, 1)`).run(user.id, score);
    const jar = cookie.split(';')[0]!;
    const wear = async (patch: Record<string, unknown>): Promise<Response> =>
      patchMe({ request: new Request(`${ORIGIN}/api/me`, { method: 'PATCH', headers: { origin: ORIGIN, cookie: jar, 'content-type': 'application/json' }, body: JSON.stringify(patch) }), env, params: {} });
    const me = async (): Promise<Me> => ((await (await getMe({ request: new Request(`${ORIGIN}/api/me`, { headers: { cookie: jar } }), env, params: {} })).json()) as { user: Me }).user;
    return { id: user.id, jar, wear, me };
  };
  const board = async (jar = '', query = ''): Promise<{ rows: LeaderRow[]; mine: LeaderRow | null }> =>
    (await (await leaderboard({ request: new Request(`${ORIGIN}/api/leaderboard?game=gut-check${query}`, { headers: jar ? { cookie: jar } : {} }), env, params: {} })).json()) as { rows: LeaderRow[]; mine: LeaderRow | null };
  const hallRows = async (): Promise<HallRow[]> => ((await (await hall({ request: new Request(`${ORIGIN}/api/hall`), env, params: {} })).json()) as { rows: HallRow[] }).rows;
  return { db, env, member, board, hallRows };
}

describe('wearing a look', () => {
  it('works only for a look the member owns, and shows on their profile', async () => {
    const { env, member } = setup();
    const ann = await member('Ann', 10);
    expect((await ann.wear({ border: 'border-neon-halo' })).status).toBe(403);
    expect((await ann.wear({ border: 'not-a-look' })).status).toBe(403);
    await giftItem(env, ann.id, 'border-neon-halo');
    await giftItem(env, ann.id, 'banner-nebula');
    // the wrong kind is refused, and so is anything that isn't text
    expect((await ann.wear({ banner: 'border-neon-halo' })).status).toBe(403);
    expect((await ann.wear({ border: 7 })).status).toBe(403);
    const res = await ann.wear({ border: 'border-neon-halo', banner: 'banner-nebula' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: Me }).user.looks).toEqual({ border: 'border-neon-halo', banner: 'banner-nebula', icon: '' });
    expect((await ann.me()).looks).toEqual({ border: 'border-neon-halo', banner: 'banner-nebula', icon: '' });
    // '' takes one off
    await ann.wear({ banner: '' });
    expect((await ann.me()).looks).toEqual({ border: 'border-neon-halo', banner: '', icon: '' });
  });

  it('comes off everywhere when the purchase is refunded', async () => {
    const { db, env, member, board, hallRows } = setup();
    const bea = await member('Bea', 20);
    db.sqlite
      .prepare(`INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at, provider_ref) VALUES ('p1', ?, 'banner-aurora', 'pending', 1, 't', 1, 'pending:p1')`)
      .run(bea.id);
    await applyStripeEvent(env, { type: 'checkout.session.completed', livemode: false, data: { object: { payment_status: 'paid', client_reference_id: 'p1', payment_intent: 'pi_1' } } });
    expect((await bea.wear({ banner: 'banner-aurora' })).status).toBe(200);
    expect((await board()).rows[0]!.banner).toBe('banner-aurora');
    await applyStripeEvent(env, { type: 'charge.refunded', data: { object: { payment_intent: 'pi_1' } } });
    expect((await bea.me()).looks).toEqual({ border: '', banner: '', icon: '' });
    expect((await board()).rows[0]!.banner).toBeUndefined();
    expect((await hallRows())[0]!.banner).toBeUndefined();
  });
});

describe('the boards', () => {
  it('carry each player’s border and banner, and never their photo', async () => {
    const { env, member, board, hallRows } = setup();
    const cal = await member('Cal', 30);
    await member('Dee', 25);
    await giftItem(env, cal.id, 'border-solar-flare');
    await giftItem(env, cal.id, 'banner-sunset-grid');
    await cal.wear({ border: 'border-solar-flare', banner: 'banner-sunset-grid' });
    const { rows } = await board();
    expect(rows).toEqual([
      { rank: 1, nickname: 'Cal', level: 1, score: 30, at: 1, you: false, border: 'border-solar-flare', banner: 'banner-sunset-grid' },
      { rank: 1 + 1, nickname: 'Dee', level: 1, score: 25, at: 1, you: false },
    ]);
    expect(JSON.stringify(rows)).not.toContain('photos.example');
    expect((await board('', '&period=24h')).rows).toEqual([]);
    const hall = await hallRows();
    expect(hall.map((r) => [r.nickname, r.border, r.banner])).toEqual([
      ['Cal', 'border-solar-flare', 'banner-sunset-grid'],
      ['Dee', undefined, undefined],
    ]);
    expect(JSON.stringify(hall)).not.toContain('photos.example');
  });

  it('put your own looks on your row below the top 50', async () => {
    const { env, member, board } = setup();
    for (let i = 0; i < 50; i++) await member(`P${i}`, 100 + i);
    const low = await member('Low', 1);
    await giftItem(env, low.id, 'border-glitch');
    await low.wear({ border: 'border-glitch' });
    const { mine } = await board(low.jar);
    expect(mine).toMatchObject({ nickname: 'Low', rank: 51, you: true, border: 'border-glitch' });
    expect(mine!.banner).toBeUndefined();
  });
});

describe('icons and looks an admin made', () => {
  it('wear like any look, and the boards carry them', async () => {
    const { db, env, member, board } = setup();
    const ann = await member('Ann', 10);
    // an admin's own look: one of the site's styles, recolored
    db.sqlite
      .prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('shop_items', ?, 1, 'qa')")
      .run(JSON.stringify([{ id: 'border-ember-ring', name: 'Ember Ring border', blurb: 'A warm ring.', cents: 99, look: { kind: 'border', style: 'solar-flare', colors: ['#330000', '#aa2200', '#ff8800', '#ffee88'] } }]));
    await giftItem(env, ann.id, 'border-ember-ring');
    await giftItem(env, ann.id, 'icon-owl');
    expect((await ann.wear({ icon: 'border-ember-ring' })).status).toBe(403);
    expect((await ann.wear({ border: 'border-ember-ring', icon: 'icon-owl' })).status).toBe(200);
    expect((await ann.me()).looks).toEqual({ border: 'border-ember-ring', banner: '', icon: 'icon-owl' });
    expect((await board()).rows[0]).toMatchObject({ nickname: 'Ann', border: 'border-ember-ring', icon: 'icon-owl' });
  });

  it('a saved list keeps every item someone bought, hidden, even when an admin leaves it out', async () => {
    const { env, member } = setup();
    const ann = await member('Ann', 10);
    const { onRequestPost: adminCatalog } = await import('../functions/api/admin/catalog');
    const own = { id: 'icon-red-fox', name: 'Red Fox icon', blurb: 'A red fox.', cents: 50, look: { kind: 'icon', style: 'fox', colors: ['#300', '#a00', '#f40', '#fff'] } };
    const save = async (items: unknown[]): Promise<{ id: string; hidden?: boolean }[]> => {
      const e = { ...env, ADMIN_EMAILS: 'ann@example.com' } as Env;
      const res = await adminCatalog({ request: new Request(`${ORIGIN}/api/admin/catalog`, { method: 'POST', headers: { origin: ORIGIN, cookie: ann.jar, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'shopItems', items }) }), env: e, params: {} });
      expect(res.status).toBe(200);
      return ((await res.json()) as { shopItems: { id: string; hidden?: boolean }[] }).shopItems;
    };
    // colors that aren't #rrggbb are dropped, the style stays
    expect((await save([own])).find((p) => p.id === 'icon-red-fox')).toMatchObject({ look: { kind: 'icon', style: 'fox' } });
    await giftItem(env, ann.id, 'icon-red-fox');
    const after = await save([]);
    expect(after.find((p) => p.id === 'icon-red-fox')).toMatchObject({ id: 'icon-red-fox', hidden: true });
  });
});

describe('the Gloamknight Pack', () => {
  it('lets its owner wear its own border and banner, and the boards show them, until a refund', async () => {
    const { db, env, member, board } = setup();
    const kay = await member('Kay', 12);
    // not bought: refused
    expect((await kay.wear({ border: 'border-gloam' })).status).toBe(403);
    db.sqlite
      .prepare(`INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at, provider_ref) VALUES ('pk', ?, 'sigilfall-gloamknight', 'paid', 1, 't', 1, 'pi_pack')`)
      .run(kay.id);
    expect((await kay.wear({ border: 'border-gloam', banner: 'banner-gloam' })).status).toBe(200);
    expect((await kay.me()).owned).toEqual(expect.arrayContaining(['sigilfall-gloamknight', 'border-gloam', 'banner-gloam', 'sigilfall-gloamwing-drake']));
    expect((await board()).rows[0]).toMatchObject({ nickname: 'Kay', border: 'border-gloam', banner: 'banner-gloam' });
    db.sqlite.prepare(`UPDATE purchases SET status = 'refunded' WHERE id = 'pk'`).run();
    expect((await board()).rows[0]!.border).toBeUndefined();
    expect((await kay.me()).looks).toEqual({ border: '', banner: '', icon: '' });
  });
});

describe('your friends list', () => {
  it('carries each friend’s border and banner, and never their photo', async () => {
    const { db, env, member } = setup();
    const me = await member('Me', 5);
    const pal = await member('Pal', 6);
    const plain = await member('Plain', 7);
    for (const f of [pal.id, plain.id]) db.sqlite.prepare('INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, 1)').run(me.id, f);
    await giftItem(env, pal.id, 'border-glitch');
    await giftItem(env, pal.id, 'banner-aurora');
    await pal.wear({ border: 'border-glitch', banner: 'banner-aurora' });
    const res = await friendsGet({ request: new Request(`${ORIGIN}/api/friends`, { headers: { cookie: me.jar } }), env, params: {} });
    const { friends } = (await res.json()) as { friends: FriendRow[] };
    expect(friends.map((f) => [f.nickname, f.border, f.banner])).toEqual([
      ['Pal', 'border-glitch', 'banner-aurora'],
      ['Plain', undefined, undefined],
    ]);
    expect(JSON.stringify(friends)).not.toContain('photos.example');
  });
});

describe('on screen', () => {
  it('draws a board row with the player’s initial in their border and their banner behind it', async () => {
    const { LeaderTable, HallTable } = await import('../src/components/Leaderboard');
    const { container } = render(
      <LeaderTable
        rows={[
          { rank: 1, nickname: 'Cal', level: 3, score: 30, at: 1, you: false, border: 'border-solar-flare', banner: 'banner-sunset-grid' },
          { rank: 2, nickname: 'Dee', level: 2, score: 25, at: 1, you: false },
          { rank: 3, nickname: 'Eve', level: 2, score: 20, at: 1, you: false, border: 'border-from-a-newer-build', banner: 'banner-from-a-newer-build' },
        ]}
        mine={null}
      />,
    );
    const [cal, dee, eve] = [...container.querySelectorAll('.board-row')];
    expect(cal!.classList.contains('has-banner')).toBe(true);
    expect(cal!.querySelector('.look-banner.look-banner-sunset-grid')).toBeTruthy();
    expect(cal!.querySelector('.avatar-frame.look-border-solar-flare .avatar')!.textContent).toBe('C');
    // no border: the plain initial; one this build can't draw: nothing at all
    expect(dee!.querySelector('.avatar-frame')).toBeNull();
    expect(dee!.querySelector('.avatar')!.textContent).toBe('D');
    expect(eve!.querySelector('.look-banner, .avatar-frame')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    cleanup();
    const hallView = render(<HallTable rows={[{ rank: 1, nickname: 'Cal', level: 3, crowns: 1, podiums: 1, records: 2, games: 1, you: true, border: 'border-glitch', banner: 'banner-aurora' }]} />);
    expect(hallView.container.querySelector('td.has-banner .look-banner-aurora')).toBeTruthy();
    expect(hallView.container.querySelector('.avatar-frame.look-border-glitch')).toBeTruthy();
    expect(screen.getByText('LV 3')).toBeTruthy();
  });

  it('lets a member pick what to wear from what they own, on their profile', async () => {
    const calls: { path: string; body: unknown }[] = [];
    let looks = { border: '', banner: '' };
    const me = (): Me =>
      ({ id: 'u1', nickname: 'Cal', email: 'cal@example.com', avatar: '', isAdmin: false, role: null, xp: 0, level: 1, levelFloor: 0, levelNext: 100, notify: false, favorites: [], bests: {}, rounds: 0, streak: 0, dailyDays: [], badges: [], quests: [], questDay: '2026-11-05', joinedAt: 0, savesAt: 0, owned: ['border-glitch', 'banner-aurora'], looks }) as unknown as Me;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ path: String(path), body });
        if (String(path).startsWith('/api/me') && init?.method === 'PATCH') {
          looks = { ...looks, ...(body.border !== undefined ? { border: body.border } : {}), ...(body.banner !== undefined ? { banner: body.banner } : {}) };
          return new Response(JSON.stringify({ user: me() }));
        }
        return new Response(JSON.stringify({ items: [], history: [], user: me() }));
      }),
    );
    const { account } = await import('../src/platform/account');
    await act(async () => {
      await account.signedIn(me());
    });
    const { ProfilePage } = await import('../src/pages/ProfilePage');
    const { container } = render(<ProfilePage />);
    const group = (name: string): HTMLElement => screen.getByRole('group', { name });
    // what they own, and none: nothing they don't own
    expect([...group('Border').querySelectorAll('.look-pick-name')].map((n) => n.textContent)).toEqual(['No border', 'Glitch border']);
    expect([...group('Banner').querySelectorAll('.look-pick-name')].map((n) => n.textContent)).toEqual(['No banner', 'Aurora banner']);
    expect(screen.getByRole('button', { name: 'No border' }).getAttribute('aria-pressed')).toBe('true');
    // (the account's first load, started by the page, lands before anything is changed)
    await vi.waitFor(() => expect(account.get().config).not.toBeNull());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Aurora banner' }));
    });
    expect(calls.find((c) => c.path.startsWith('/api/me') && (c.body as { banner?: string })?.banner === 'banner-aurora')).toBeTruthy();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Aurora banner' }).getAttribute('aria-pressed')).toBe('true'));
    // the player card wears it at once
    expect(container.querySelector('.profile-card.has-banner .profile-banner.look-banner-aurora')).toBeTruthy();
    // the shop is closed, so there's no pointer to it
    expect(screen.queryByText('See borders and banners in the shop')).toBeNull();
    // the header wears them too: the border on the picture, the banner behind the menu's name card
    cleanup();
    const { Header } = await import('../src/components/Header');
    const header = render(<Header />);
    await vi.waitFor(() => expect(header.container.querySelector('.account-head.has-banner .look-banner-aurora')).toBeTruthy());
    expect(header.container.querySelector('.account-btn .avatar-frame')).toBeNull();
    await act(async () => {
      await account.update({ border: 'border-glitch' });
    });
    await vi.waitFor(() => expect(header.container.querySelector('.account-btn .avatar-frame.look-border-glitch')).toBeTruthy());
    expect(header.container.querySelector('.account-head .avatar-frame.look-border-glitch')).toBeTruthy();
  });
});
