import { account, api } from './account';
import { AccountPoll } from './accountPoll';
import type { Me } from './apiTypes';
import { dayKey } from './dates';
import { getLiveCatalog } from './liveCatalog';

/**
 * Things a member receives, as they arrive: a purchase the shop confirms, an item or a Sigilfall title an admin gives,
 * a Game Master's gift in Sigilfall. The open page asks the account again now and then (platform/accountPoll.ts), so
 * nothing waits for a reload, and what is new since the last look is said once, with a small card: the site's
 * (components/Arrivals.tsx), or Sigilfall's own while the game is open (src/games/sigilfall/ui/Arrival.tsx).
 *
 * Only what is new while the page is open counts: what an account already has when the page loads, or when someone
 * signs in, was had before. The one exception is a purchase this browser went to the checkout for: coming back from
 * it, the item is new however quickly the shop confirmed it. Each thing is said once, on any of the member's tabs:
 * this browser remembers what it has shown (and what it still has to show, across a reload).
 *
 * Loaded after the first page is drawn (src/main.tsx), and light: what an item is (its name, whether it is
 * Sigilfall's, a pack's pieces) is looked up only once something has arrived (platform/arrivalItems.ts).
 */

export interface Arrival {
  /** The thing, once: 'item:<shop item>', 'title:<grant>' or 'gm:<order>'. */
  key: string;
  kind: 'item' | 'title' | 'gm';
  /** The shop item, the title's grant, or what a Game Master's order gave (a mount, a look, an item). */
  id: string;
  how: 'bought' | 'given';
  /** Shown inside that game while it is open (null: the site's). */
  game: 'sigilfall' | null;
  /** Its words, for what isn't in the shop list: a title, a Game Master's gift. */
  name?: string;
  /** A title's light (src/catalog/titleFx.ts). */
  fx?: string;
  /** A Game Master's gift: what sort of thing, and the hero it went to. */
  what?: 'mount' | 'look' | 'item';
  hero?: string;
  at: number;
}

/** What an account had at the last look. */
export interface Seen {
  id: string;
  owned: readonly string[];
  titles: readonly string[];
}

export const seenOf = (me: Me): Seen => ({ id: me.id, owned: me.owned ?? [], titles: (me.sigilTitles ?? []).map((t) => t.id) });

const KEY = 'glitchbound.arrivals.';
const EXPECT_KEY = 'glitchbound.arrivals.expect';
/** How long a checkout is waited for, and how long something waits to be shown. */
const EXPECT_MS = 6 * 3600_000;
const PENDING_MS = 2 * 86_400_000;
const SHOWN_MAX = 300;

function read(key: string, store: 'localStorage' | 'sessionStorage' = 'localStorage'): unknown {
  try {
    return JSON.parse(window[store].getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function write(key: string, v: unknown, store: 'localStorage' | 'sessionStorage' = 'localStorage'): void {
  try {
    window[store].setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked: this visit still remembers */
  }
}

/* ------------------------------------------------- what this browser went to the checkout for */

interface Expected {
  id: string;
  at: number;
}

function readExpected(now = Date.now()): Expected[] {
  const v = read(EXPECT_KEY);
  return Array.isArray(v) ? v.filter((e): e is Expected => !!e && typeof e.id === 'string' && typeof e.at === 'number' && now - e.at < EXPECT_MS) : [];
}

/** The items this browser went to the checkout for and hasn't seen arrive yet. */
export const expectedItems = (): string[] => readExpected().map((e) => e.id);

function forgetExpected(ids: readonly string[]): void {
  if (ids.length) write(EXPECT_KEY, readExpected().filter((e) => !ids.includes(e.id)));
}

/** Everything waited for has come (or nothing is). */
const allHere = (): boolean => {
  const owned = account.state.me?.owned ?? [];
  return expectedItems().every((id) => owned.includes(id));
};

/**
 * The player is off to the checkout for this item (components/ShopCheckout.tsx), or back from it (`?bought=`): it is
 * theirs when it comes, and the account is asked every few seconds for a few minutes until it does.
 */
export function expectPurchase(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return;
  write(EXPECT_KEY, [...readExpected().filter((e) => e.id !== id), { id, at: Date.now() }]);
  if (started) poll.burst(allHere);
}

/* ------------------------------------------------- what has been shown, and what is waiting */

let user: string | null = null;
let shown = new Set<string>();
let pending: Arrival[] = [];
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  for (const fn of listeners) fn();
}

/** What this member has been shown in this browser, by any tab. */
function readShown(id: string): string[] {
  const v = read(KEY + id);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * This member's memory (a browser can be shared by two): what was shown, kept by the browser, and what this tab still
 * has to show, kept by the tab (so a reload doesn't lose it, and two tabs don't each show the other's).
 */
function load(id: string): void {
  if (user === id) return;
  user = id;
  shown = new Set(readShown(id));
  const v = read(KEY + id, 'sessionStorage');
  const now = Date.now();
  pending = Array.isArray(v) ? (v as Arrival[]).filter((a) => a && typeof a.key === 'string' && typeof a.id === 'string' && typeof a.at === 'number' && now - a.at < PENDING_MS && !shown.has(a.key)) : [];
  emit();
}

function save(): void {
  if (!user) return;
  // (another tab may have shown something meanwhile: both are kept)
  for (const key of readShown(user)) shown.add(key);
  write(KEY + user, [...shown].slice(-SHOWN_MAX));
  write(KEY + user, pending, 'sessionStorage');
}

/** What has arrived and hasn't been shown yet, oldest first. */
export const pendingArrivals = (): readonly Arrival[] => pending;
export const arrivalsVersion = (): number => version;

export function subscribeArrivals(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Something new to say (a Game Master's gift, or what the account brought): once, never again after it's shown. */
export function addArrival(a: Arrival): void {
  const me = account.state.me;
  if (!me) return;
  load(me.id);
  if (shown.has(a.key) || pending.some((p) => p.key === a.key)) return;
  pending = [...pending, a];
  save();
  emit();
}

/** It is on the screen: never shown again, here or in another tab. */
export function markShown(key: string): void {
  if (!user) return;
  shown.add(key);
  pending = pending.filter((a) => a.key !== key);
  save();
  emit();
}

/* ------------------------------------------------- a game that shows its own */

const claims = new Map<string, number>();

/** A game open in this tab shows its own arrivals (Sigilfall's card): the site's card leaves them to it until it closes. */
export function claimArrivals(game: string): () => void {
  claims.set(game, (claims.get(game) ?? 0) + 1);
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const n = (claims.get(game) ?? 1) - 1;
    if (n > 0) claims.set(game, n);
    else claims.delete(game);
    emit();
  };
}

export const arrivalsClaimed = (game: string | null): boolean => !!game && claims.has(game);

/* ------------------------------------------------- watching the account */

let seen: Seen | null = null;
let member = false;
/** (what arrived is worked out in order, one look after the other) */
let working: Promise<void> = Promise.resolve();

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

function onAccount(): void {
  const me = account.state.status === 'member' ? account.state.me : null;
  if (!!me !== member) {
    member = !!me;
    // (a member was just read: the next look is a whole wait away)
    if (me) poll.seen();
    else poll.stop();
  }
  if (!me) {
    seen = null;
    return;
  }
  load(me.id);
  const before = seen?.id === me.id ? seen : null;
  const now = seenOf(me);
  if (before && sameList(before.owned, now.owned) && sameList(before.titles, now.titles)) return;
  seen = now;
  const expected = expectedItems();
  // a first look (the page loading, a sign-in) says nothing, unless a checkout this browser went to has come
  if (!before && !expected.some((id) => now.owned.includes(id))) return;
  // nothing added (an item taken back): nothing to say
  if (before && now.owned.every((id) => before.owned.includes(id)) && now.titles.every((id) => before.titles.includes(id))) return;
  const items = getLiveCatalog().raw.shopItems;
  working = working
    .then(() => import('./arrivalItems'))
    .then((m) => {
      if (user !== me.id) return;
      const found = m.arrivalsBetween(before, me, { items, expected: new Set(expected), shown });
      forgetExpected(found.filter((a) => a.kind === 'item').map((a) => a.id));
      for (const a of found) addArrival(a);
    })
    .catch(() => undefined);
}

/** One look at the account: only what can arrive is taken from it, and only when it changed. False when it failed. */
async function look(): Promise<boolean> {
  if (!account.state.me) return true;
  let fresh: Me | null;
  try {
    fresh = (await api<{ user: Me | null }>(`/api/me?day=${dayKey()}`)).user;
  } catch {
    return false;
  }
  const me = account.state.me;
  // signed out meanwhile, or another account signed in from another tab: the page's own sign-in handles that (and
  // looking again soon would tell nothing new)
  if (!fresh || !me || fresh.id !== me.id) return false;
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (!same(fresh.owned, me.owned) || !same(fresh.gifts, me.gifts) || !same(fresh.sigilTitles, me.sigilTitles) || !same(fresh.looks, me.looks)) {
    account.setMe({ ...me, owned: fresh.owned, gifts: fresh.gifts, sigilTitles: fresh.sigilTitles, looks: fresh.looks });
  }
  return true;
}

const poll = new AccountPoll({
  check: look,
  can: () => account.state.status === 'member' && typeof document !== 'undefined' && !document.hidden && navigator.onLine !== false,
});

/* ------------------------------------------------- starting */

let started = false;
let stops: (() => void)[] = [];

function onStorage(e: StorageEvent): void {
  // another tab showed something: it isn't shown here too
  if (!user || e.key !== KEY + user) return;
  for (const key of readShown(user)) shown.add(key);
  const left = pending.filter((a) => !shown.has(a.key));
  if (left.length === pending.length) return;
  pending = left;
  write(KEY + user, pending, 'sessionStorage');
  emit();
}

/**
 * Starts watching (once a visit, whoever asks how often). `bought` is the item a checkout just brought the player back
 * for (`?bought=`, read before the shop's page or the game takes it off the address).
 */
export function startArrivals(bought?: string | null): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (bought) expectPurchase(bought);
  const wake = (): void => {
    if (!document.hidden) poll.wake();
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);
  window.addEventListener('pageshow', wake);
  window.addEventListener('storage', onStorage);
  stops = [
    account.subscribe(onAccount),
    () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('storage', onStorage);
    },
  ];
  onAccount();
  if (expectedItems().length) poll.burst(allHere);
}

/** For tests: back to before startArrivals(). */
export function stopArrivals(): void {
  for (const stop of stops) stop();
  stops = [];
  poll.stop();
  started = false;
  member = false;
  seen = null;
  user = null;
  shown = new Set();
  pending = [];
  claims.clear();
  working = Promise.resolve();
}

/** For tests: when the last arrivals have been worked out. */
export const arrivalsSettled = (): Promise<void> => working;
