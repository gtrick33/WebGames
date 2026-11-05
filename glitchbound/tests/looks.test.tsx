/**
 * Borders and banners: a member wears only what they own, a refund takes it off everywhere, and every board shows it
 * around the player's initial and behind their name, never their photo.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as hall } from '../functions/api/hall';
import { onRequestGet as leaderboard } from '../functions/api/leaderboard';
import { onRequestGet as getMe, onRequestPatch as patchMe } from '../functions/api/me';
import { isLook, LOOKS, wornFrom } from '../src/catalog/looks';
import { PRODUCTS, productIn } from '../src/catalog/shop';
import { applyStripeEvent, giftItem } from '../server/shop';
import type { Env } from '../server/http';
import { signIn } from '../server/signin';
import type { HallRow, LeaderRow, Me } from '../src/platform/apiTypes';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the looks', () => {
  it('are each a shop item with a name, and only change how someone looks', () => {
    expect(LOOKS.filter((l) => l.kind === 'border')).toHaveLength(3);
    expect(LOOKS.filter((l) => l.kind === 'banner')).toHaveLength(3);
    for (const l of LOOKS) {
      const p = productIn(PRODUCTS, l.id)!;
      expect(p.name).toBeTruthy();
      expect(p.later).toBeUndefined();
      expect(`${p.name} ${p.blurb}`).not.toMatch(/\b(win|wins|winning|stronger|faster|boost|score)\b/i);
    }
    expect(isLook('border-glitch', 'border')).toBe(true);
    expect(isLook('border-glitch', 'banner')).toBe(false);
    expect(isLook('ad-free')).toBe(false);
  });

  it('show only while owned and of the right kind', () => {
    expect(wornFrom({ border: 'border-glitch', banner: 'banner-aurora' }, ['border-glitch'])).toEqual({ border: 'border-glitch', banner: '' });
    expect(wornFrom({ border: 'banner-aurora', banner: 'border-glitch' }, ['banner-aurora', 'border-glitch'])).toEqual({ border: '', banner: '' });
    expect(wornFrom({ border: null, banner: undefined }, [])).toEqual({ border: '', banner: '' });
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
    expect(((await res.json()) as { user: Me }).user.looks).toEqual({ border: 'border-neon-halo', banner: 'banner-nebula' });
    expect((await ann.me()).looks).toEqual({ border: 'border-neon-halo', banner: 'banner-nebula' });
    // '' takes one off
    await ann.wear({ banner: '' });
    expect((await ann.me()).looks).toEqual({ border: 'border-neon-halo', banner: '' });
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
    expect((await bea.me()).looks).toEqual({ border: '', banner: '' });
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
  });
});
