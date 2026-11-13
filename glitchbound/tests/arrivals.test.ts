/**
 * What a member receives arrives without a reload, and is said once (platform/arrivals.ts): what is new between two
 * looks at the account, how often the page looks (platform/accountPoll.ts), and the words the cards use.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me, SigilTitleGrant } from '../src/platform/apiTypes';
import type { Seen } from '../src/platform/arrivals';

afterEach(async () => {
  const { stopArrivals } = await import('../src/platform/arrivals');
  stopArrivals();
  vi.unstubAllGlobals();
});

const me = (patch: Partial<Me> = {}): Me =>
  ({ id: 'u1', nickname: 'Cal', email: 'cal@example.com', avatar: '', isAdmin: false, role: null, xp: 0, level: 1, levelFloor: 0, levelNext: 100, notify: false, favorites: [], bests: {}, rounds: 0, streak: 0, dailyDays: [], badges: [], quests: [], questDay: '2026-11-13', joinedAt: 0, savesAt: 0, owned: [], ...patch }) as Me;

const title = (id: string, name = 'the Unbroken'): SigilTitleGrant => ({ id, name, fx: 'ember', before: false, at: 1 });

const seen = (m: Me): Seen => ({ id: m.id, owned: m.owned ?? [], titles: (m.sigilTitles ?? []).map((t) => t.id) });

describe('what is new between two looks', () => {
  const none = new Set<string>();

  it('says nothing on the first look (the page loading) or on a sign-in, whatever the account has', async () => {
    const { arrivalsBetween } = await import('../src/platform/arrivalItems');
    const full = me({ owned: ['ad-free', 'sigilfall-galecrest-drake'], sigilTitles: [title('t1')] });
    expect(arrivalsBetween(null, full, { expected: none, shown: none })).toEqual([]);
    // someone else was signed in before
    expect(arrivalsBetween(seen(me({ id: 'u2' })), full, { expected: none, shown: none })).toEqual([]);
  });

  it('on a first look, still says a purchase this browser went to the checkout for', async () => {
    const { arrivalsBetween } = await import('../src/platform/arrivalItems');
    const full = me({ owned: ['ad-free', 'sigilfall-galecrest-drake'] });
    const found = arrivalsBetween(null, full, { expected: new Set(['sigilfall-galecrest-drake']), shown: none, now: 5 });
    expect(found).toEqual([{ key: 'item:sigilfall-galecrest-drake', kind: 'item', id: 'sigilfall-galecrest-drake', how: 'bought', game: 'sigilfall', at: 5 }]);
  });

  it('says a new item once: never when it was shown already', async () => {
    const { arrivalsBetween } = await import('../src/platform/arrivalItems');
    const before = me({ owned: ['ad-free'] });
    const after = me({ owned: ['ad-free', 'border-frost'] });
    const found = arrivalsBetween(seen(before), after, { expected: none, shown: none });
    expect(found.map((a) => [a.key, a.how, a.game])).toEqual([['item:border-frost', 'bought', null]]);
    expect(arrivalsBetween(seen(before), after, { expected: none, shown: new Set(['item:border-frost']) })).toEqual([]);
    // nothing new: nothing said; an item taken back: nothing either
    expect(arrivalsBetween(seen(after), after, { expected: none, shown: none })).toEqual([]);
    expect(arrivalsBetween(seen(after), before, { expected: none, shown: none })).toEqual([]);
  });

  it('tells a gift from a purchase, and a checkout from here is always a purchase', async () => {
    const { arrivalsBetween } = await import('../src/platform/arrivalItems');
    const before = me();
    const after = me({ owned: ['banner-aurora', 'icon-fox'], gifts: ['banner-aurora'] });
    const found = arrivalsBetween(seen(before), after, { expected: none, shown: none });
    expect(Object.fromEntries(found.map((a) => [a.id, a.how]))).toEqual({ 'banner-aurora': 'given', 'icon-fox': 'bought' });
    const mine = arrivalsBetween(seen(before), after, { expected: new Set(['banner-aurora']), shown: none });
    expect(mine.find((a) => a.id === 'banner-aurora')?.how).toBe('bought');
  });

  it('says a pack as one thing, not each of its pieces', async () => {
    const { arrivalsBetween } = await import('../src/platform/arrivalItems');
    const { withIncluded, GLOAMKNIGHT_ITEM } = await import('../src/catalog/shop');
    const after = me({ owned: withIncluded([GLOAMKNIGHT_ITEM]) });
    const found = arrivalsBetween(seen(me()), after, { expected: none, shown: none });
    expect(found.map((a) => [a.id, a.game])).toEqual([[GLOAMKNIGHT_ITEM, 'sigilfall']]);
  });

  it('skips an item no list knows, and reads an admin’s item from the live list', async () => {
    const { arrivalsBetween } = await import('../src/platform/arrivalItems');
    const items = [{ id: 'sigilfall-mistwing', name: 'Mistwing', blurb: 'A pale drake.', cents: 199, sigil: { kind: 'mount' as const, body: 'drake' as const, coat: '#fff', mane: '#fff', tack: '#000', plate: '#888', extras: [] } }];
    const after = me({ owned: ['nothing-like-it', 'sigilfall-mistwing'] });
    expect(arrivalsBetween(seen(me()), after, { items, expected: none, shown: none }).map((a) => [a.id, a.game])).toEqual([['sigilfall-mistwing', 'sigilfall']]);
  });

  it('says a new title an admin gave, once, and never a title the account had', async () => {
    const { arrivalsBetween } = await import('../src/platform/arrivalItems');
    const before = me({ sigilTitles: [title('t1')] });
    const after = me({ sigilTitles: [title('t2', 'Kingslayer'), title('t1')] });
    const found = arrivalsBetween(seen(before), after, { expected: none, shown: none, now: 9 });
    expect(found).toEqual([{ key: 'title:t2', kind: 'title', id: 't2', how: 'given', game: 'sigilfall', name: 'Kingslayer', fx: 'ember', at: 9 }]);
    expect(arrivalsBetween(seen(before), after, { expected: none, shown: new Set(['title:t2']) })).toEqual([]);
  });
});

describe('the words', () => {
  it('thank a buyer, name a gift, and say where to find it on the site and in the game', async () => {
    const { arrivalInfo } = await import('../src/platform/arrivalItems');
    const bought = { key: 'item:sigilfall-galecrest-drake', kind: 'item' as const, id: 'sigilfall-galecrest-drake', how: 'bought' as const, game: 'sigilfall' as const, at: 0 };
    expect(arrivalInfo(bought, null, 'site')).toMatchObject({ head: 'It’s yours!', name: 'Galecrest Drake', line: 'Thanks for supporting GlitchBound.', where: 'In every hero’s stable in Sigilfall.', sort: 'mount' });
    expect(arrivalInfo(bought, null, 'game')?.where).toBe('In every hero’s stable.');
    const gift = { ...bought, key: 'item:border-frost', id: 'border-frost', how: 'given' as const, game: null };
    expect(arrivalInfo(gift, null, 'site')).toMatchObject({ head: 'A gift for you!', name: 'Frost border', line: 'A gift from the GlitchBound team.', where: 'Wear it from your profile.' });
    const t = { key: 'title:t1', kind: 'title' as const, id: 't1', how: 'given' as const, game: 'sigilfall' as const, name: 'the Unbroken', fx: 'ember', at: 0 };
    expect(arrivalInfo(t, null, 'game')).toMatchObject({ head: 'You’ve been given a title', name: 'the Unbroken', where: 'Choose it under your name on the Hero page.' });
    const gm = { key: 'gm:o1', kind: 'gm' as const, id: 'm1', how: 'given' as const, game: 'sigilfall' as const, name: 'Old Grey', what: 'mount' as const, hero: 'Ash', at: 0 };
    expect(arrivalInfo(gm, null, 'game')).toMatchObject({ name: 'Old Grey', line: 'From a Game Master.', where: 'In Ash’s stable.' });
    expect(arrivalInfo({ ...bought, id: 'gone-for-good', key: 'item:gone-for-good' }, null, 'site')).toBeNull();
  });
});

describe('a Game Master’s gift', () => {
  it('is a card for a mount, a look or an item, and a toast for the rest', async () => {
    const { gmThing } = await import('../src/games/sigilfall/progress/gmArrival');
    const { MOUNT_DEFS } = await import('../src/games/sigilfall/data/mounts');
    const mount = Object.keys(MOUNT_DEFS)[0]!;
    expect(gmThing({ kind: 'mount', payload: { id: mount } })).toEqual({ what: 'mount', id: mount, name: MOUNT_DEFS[mount]!.name });
    expect(gmThing({ kind: 'gear', payload: { rarity: 'epic', slot: 'head' } })).toEqual({ what: 'item', id: 'gear-epic', name: 'Epic gear' });
    expect(gmThing({ kind: 'mount', payload: { id: 'no-such-mount' } })).toBeNull();
    expect(gmThing({ kind: 'gold', payload: { amount: 100 } })).toBeNull();
  });
});

describe('the account, watched', () => {
  async function setUp(first: Me | null, bought: string | null = null) {
    const { account } = await import('../src/platform/account');
    const arrivals = await import('../src/platform/arrivals');
    account.reset(first ? { status: 'member', me: first } : { status: 'loading' });
    arrivals.startArrivals(bought);
    return { account, ...arrivals };
  }

  it('says what a purchase confirmed later brings, once, and remembers it across a reload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null }))));
    const a = await setUp(me({ owned: ['ad-free'] }));
    await a.arrivalsSettled();
    expect(a.pendingArrivals()).toEqual([]);
    a.account.setMe(me({ owned: ['ad-free', 'icon-owl'] }));
    await a.arrivalsSettled();
    expect(a.pendingArrivals().map((x) => x.key)).toEqual(['item:icon-owl']);
    a.markShown('item:icon-owl');
    expect(a.pendingArrivals()).toEqual([]);
    // a reload: the account has it from the first look on, and nothing is said again
    a.stopArrivals();
    a.account.reset({ status: 'member', me: me({ owned: ['ad-free', 'icon-owl'] }) });
    a.startArrivals();
    a.account.setMe(me({ owned: ['ad-free', 'icon-owl'], sigilTitles: [title('t1')] }));
    await a.arrivalsSettled();
    expect(a.pendingArrivals().map((x) => x.key)).toEqual(['title:t1']);
  });

  it('coming back from the checkout, says the item even when the page loads with it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null }))));
    const a = await setUp(null, 'sigilfall-moonglass-hart');
    a.account.reset({ status: 'member', me: me({ owned: ['sigilfall-moonglass-hart'] }) });
    await a.arrivalsSettled();
    expect(a.pendingArrivals().map((x) => [x.key, x.how, x.game])).toEqual([['item:sigilfall-moonglass-hart', 'bought', 'sigilfall']]);
    expect(a.expectedItems()).toEqual([]);
  });

  it('looks again on its own, and takes only what can arrive from the answer', async () => {
    vi.useFakeTimers();
    const first = me({ owned: [], xp: 10 });
    let server = me({ owned: [], xp: 10 });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ user: server })));
    vi.stubGlobal('fetch', fetch);
    const a = await setUp(first);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    // nothing changed: the account isn't touched
    expect(a.account.state.me).toBe(first);
    server = me({ owned: ['banner-nebula'], gifts: ['banner-nebula'], xp: 999 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(a.account.state.me?.owned).toEqual(['banner-nebula']);
    // (only what can arrive is taken: the rest of the page's account is left as it is)
    expect(a.account.state.me?.xp).toBe(10);
    await a.arrivalsSettled();
    expect(a.pendingArrivals().map((x) => [x.key, x.how])).toEqual([['item:banner-nebula', 'given']]);
  });

  it('never looks for a guest', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ user: null })));
    vi.stubGlobal('fetch', fetch);
    await setUp(null);
    const { account } = await import('../src/platform/account');
    account.reset({ status: 'guest' });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a game that shows its own claims them while it is open', async () => {
    const a = await setUp(null);
    expect(a.arrivalsClaimed('sigilfall')).toBe(false);
    const stop = a.claimArrivals('sigilfall');
    const stop2 = a.claimArrivals('sigilfall');
    stop();
    stop();
    expect(a.arrivalsClaimed('sigilfall')).toBe(true);
    stop2();
    expect(a.arrivalsClaimed('sigilfall')).toBe(false);
    expect(a.arrivalsClaimed(null)).toBe(false);
  });
});

describe('when the page looks', () => {
  async function poll(can = { now: true }) {
    vi.useFakeTimers();
    const { AccountPoll, POLL } = await import('../src/platform/accountPoll');
    let answer = true;
    const check = vi.fn(async () => answer);
    const p = new AccountPoll({ check, can: () => can.now });
    return { p, check, POLL, fail: (v: boolean) => (answer = !v) };
  }

  it('every minute while it can, and not at all while it can’t (hidden, offline, a guest)', async () => {
    const can = { now: true };
    const { p, check, POLL } = await poll(can);
    p.seen();
    await vi.advanceTimersByTimeAsync(POLL.every * 3);
    expect(check).toHaveBeenCalledTimes(3);
    can.now = false;
    await vi.advanceTimersByTimeAsync(POLL.every * 5);
    expect(check).toHaveBeenCalledTimes(3);
    // back in view: a look at once, then the usual pace
    can.now = true;
    p.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(POLL.every);
    expect(check).toHaveBeenCalledTimes(5);
    p.stop();
  });

  it('coming back right after a look waits for the next one (focus and visibility come together)', async () => {
    const { p, check, POLL } = await poll();
    p.wake();
    p.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL.gap - 1);
    p.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    p.stop();
  });

  it('after a checkout: every few seconds until the item is here, and for a few minutes at most', async () => {
    const { p, check, POLL } = await poll();
    let here = false;
    p.burst(() => here);
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL.burst * 5);
    expect(check).toHaveBeenCalledTimes(6);
    here = true;
    await vi.advanceTimersByTimeAsync(POLL.burst * 5);
    // (the look planned before it came, then back to the usual pace)
    expect(check).toHaveBeenCalledTimes(7);
    await vi.advanceTimersByTimeAsync(POLL.every);
    expect(check).toHaveBeenCalledTimes(8);
    // and an item that never comes stops the hurry all the same
    check.mockClear();
    p.burst(() => false);
    await vi.advanceTimersByTimeAsync(POLL.burstFor);
    const fast = check.mock.calls.length;
    expect(fast).toBeGreaterThanOrEqual(POLL.burstFor / POLL.burst - 1);
    expect(fast).toBeLessThanOrEqual(POLL.burstFor / POLL.burst + 1);
    await vi.advanceTimersByTimeAsync(POLL.every - 1);
    expect(check.mock.calls.length).toBeLessThanOrEqual(fast + 1);
    p.stop();
  });

  it('waits longer after each failure, and goes back to its pace once a look works', async () => {
    const { p, check, POLL, fail } = await poll();
    fail(true);
    p.seen();
    await vi.advanceTimersByTimeAsync(POLL.every);
    expect(check).toHaveBeenCalledTimes(1);
    expect(p.wait()).toBe(POLL.every * 2);
    await vi.advanceTimersByTimeAsync(POLL.every * 2);
    expect(check).toHaveBeenCalledTimes(2);
    expect(p.wait()).toBe(POLL.every * 4);
    await vi.advanceTimersByTimeAsync(POLL.every * 4);
    expect(p.wait()).toBe(POLL.every * 8);
    await vi.advanceTimersByTimeAsync(POLL.every * 8);
    expect(p.wait()).toBe(POLL.slowest);
    fail(false);
    await vi.advanceTimersByTimeAsync(POLL.slowest);
    expect(p.wait()).toBe(POLL.every);
    p.stop();
  });

  it('never runs two looks at once', async () => {
    vi.useFakeTimers();
    const { AccountPoll } = await import('../src/platform/accountPoll');
    let release: (v: boolean) => void = () => undefined;
    const check = vi.fn(() => new Promise<boolean>((r) => (release = r)));
    const p = new AccountPoll({ check, can: () => true });
    p.wake();
    p.burst(() => false);
    p.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    release(true);
    p.stop();
  });
});
