import { GAMES } from '../catalog/games';
import { api } from './account';
import { mergeSaveText } from './cloudMerge';
import type { Side } from './mergeRules';
import { saveStore } from './store';
import { isHeld, onRelease, saveArrived } from './syncGate';
import { ARCADE_SAVE_KEY, isSyncedKey, MAX_SYNCED_SAVE, slugOfKey } from './syncKeys';

/**
 * Cloud saves for signed-in players. Every game keeps its own save in localStorage (today's daily,
 * a half-played daily that resumes where it was left, bests), and so does the arcade (rounds, the
 * Daily Challenge, which games' dailies are done). This copies those saves to the account
 * (functions/api/saves.ts) and back, so they follow the player to every device and return after a
 * browser clears its storage. Games need no changes: writes to their keys are noticed here.
 *
 * Cheap by design: a save is sent only when it changed, 8 s after the last change (40 s at most after
 * the first), when a game closes and when the tab is hidden or closed. Saves come down once per visit,
 * skipped when /api/me says the account has nothing newer, and again when the player returns to the
 * tab after 5 minutes. When two devices changed the same save, the copies are merged (cloudMerge.ts).
 * A save too big to sync stays on its device, and the player is told so.
 *
 * Signing out sends what is left, then clears that member's saves from the browser: the next person to
 * sign in there doesn't get them merged into their account. Saves that couldn't be sent wait aside
 * (STASH_KEY) for that member's next sign-in on this browser.
 */

const STATE_KEY = 'glitchbound.sync';
const STASH_KEY = 'glitchbound.sync.stash';
const QUIET_MS = 8_000;
const MAX_WAIT_MS = 40_000;
const RECHECK_MS = 5 * 60_000;
const MAX_BODY = 900_000;
/** Browsers drop keepalive requests (the ones that outlive a closing page) above 64 KB. */
const KEEPALIVE_MAX = 60_000;

interface Entry {
  /** The server version this device's copy grew from. */
  at: number;
  /** Hash of that version: the save changed here when the local copy hashes differently. */
  h: string;
}
interface SyncState {
  user: string;
  /** Newest server version received so far. */
  pulledAt: number;
  keys: Record<string, Entry>;
  /** When each save last changed here (this device's clock): tells which copy changed last in a merge. */
  t?: Record<string, number>;
}
interface Stash {
  user: string;
  state: SyncState;
  saves: Record<string, string>;
}
export interface ServerSave {
  key: string;
  data: string;
  at: number;
}
interface PushResult {
  saved: { key: string; at: number }[];
  conflicts: ServerSave[];
}

let user: string | null = null;
let ready = false;
let store: Storage | null = null;
let setRaw: Storage['setItem'] = () => undefined;
let removeRawFn: Storage['removeItem'] = () => undefined;
let timer = 0;
let firstChange = 0;
let pushing = false;
let pushAgain = false;
let lastCheck = 0;
let first: Promise<void> = Promise.resolve();
let running: Promise<void> = Promise.resolve();
/** Saves over MAX_SYNCED_SAVE that stay on this device, and the ones the player dismissed the notice for. */
const tooBig = new Set<string>();
const dismissed = new Set<string>();
const lastTouch = new Map<string, number>();
/** Copies from other devices for games that are running: applied when the game closes. */
const waiting = new Map<string, ServerSave>();

/** A 53-bit string hash (cyrb53): enough to tell whether a save changed. */
export function hashText(s: string): string {
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function read(key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Writes a save without counting it as a local change. False when storage refused it (full). */
function writeRaw(key: string, value: string): boolean {
  try {
    setRaw.call(store!, key, value);
  } catch {
    return false;
  }
  if (key === ARCADE_SAVE_KEY) saveStore.reload();
  return true;
}

const validState = (v: unknown): SyncState | null => {
  const s = v as SyncState | null;
  return s && typeof s === 'object' && typeof s.user === 'string' && typeof s.pulledAt === 'number' && s.keys && typeof s.keys === 'object' ? s : null;
};

function parseState(text: string | null): SyncState | null {
  try {
    return validState(JSON.parse(text ?? 'null'));
  } catch {
    return null; // damaged
  }
}

function readState(): SyncState {
  const s = parseState(read(STATE_KEY));
  // damaged or another member's: start over (every save here is then merged with the account's)
  return s && s.user === user ? s : { user: user!, pulledAt: 0, keys: {} };
}

function writeState(s: SyncState): void {
  try {
    store?.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* full or blocked */
  }
}

/** Notes when a save changed here (at most once a second per save). */
function touch(key: string): void {
  const now = Date.now();
  if (now - (lastTouch.get(key) ?? 0) < 1000) return;
  lastTouch.set(key, now);
  const state = readState();
  state.t = { ...state.t, [key]: now };
  writeState(state);
}

const gameName = (key: string): string => {
  const slug = slugOfKey(key);
  return slug ? (GAMES.find((g) => g.slug === slug)?.title ?? slug) : 'arcade';
};

/** Shows (or updates, or takes down) the notice about saves too big to follow the player. */
function showTooBig(): void {
  if (typeof document === 'undefined') return;
  const keys = [...tooBig].filter((k) => !dismissed.has(k));
  let el = document.getElementById('gb-sync-notice');
  if (keys.length === 0) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'gb-sync-notice';
    el.setAttribute('role', 'status');
    el.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:1000;box-sizing:border-box;width:min(520px,calc(100% - 32px));display:flex;gap:10px;align-items:center;padding:10px 12px;border:2px solid var(--ink,#1d1238);border-radius:12px;background:#ffd9cf;color:#1d1238;font:700 14px/1.35 var(--font,system-ui,sans-serif);box-shadow:3px 3px 0 var(--ink,#1d1238)';
    document.body.append(el);
  }
  const names = keys.map(gameName).join(', ');
  const text = document.createElement('p');
  text.style.cssText = 'flex:1;margin:0';
  text.textContent = `Your ${names} save is too big to sync to your account. Its newest progress stays on this device only.`;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss this notice');
  close.style.cssText = 'flex:none;min-width:44px;min-height:44px;border:0;background:none;color:inherit;font:inherit;font-size:22px;cursor:pointer';
  close.onclick = () => {
    for (const k of keys) dismissed.add(k);
    showTooBig();
  };
  el.replaceChildren(text, close);
}

/** Saves too big to sync (they stay on this device); the player sees a notice for them. */
export const oversizedSaves = (): string[] => [...tooBig];

/** Saves that changed here since they were last synced (a removed one counts: it is deleted on the server too). */
function changedKeys(state: SyncState): string[] {
  const keys = new Set(Object.keys(state.keys));
  try {
    for (let i = 0; i < store!.length; i++) {
      const k = store!.key(i);
      if (k && isSyncedKey(k)) keys.add(k);
    }
  } catch {
    /* blocked */
  }
  const before = [...tooBig].join();
  const out = [...keys].filter((k) => {
    // A copy from another device is waiting for this game to close: send nothing for it until then.
    if (waiting.has(k)) return false;
    const v = read(k);
    const e = state.keys[k];
    if (v === null) return !!e;
    const changed = !e || e.h !== hashText(v);
    // too big for the account: it stays here, and the player is told (SFS-01)
    if (v.length > MAX_SYNCED_SAVE) {
      if (changed) tooBig.add(k);
      return false;
    }
    tooBig.delete(k);
    return changed;
  });
  if ([...tooBig].join() !== before) showTooBig();
  return out;
}

/** Takes in a newer copy from the server: replaces an unchanged local copy, or merges with a changed one. */
function receive(state: SyncState, s: ServerSave): void {
  const e = state.keys[s.key];
  if (e && e.at >= s.at) return;
  if (isHeld(slugOfKey(s.key))) {
    waiting.set(s.key, s);
    return;
  }
  const local = read(s.key);
  const unchanged = local === null || (!!e && e.h === hashText(local));
  // The copy changed last: this device's when it changed after the account's copy was stored (or when
  // it isn't known when it changed here).
  const t = state.t?.[s.key];
  const newer: Side = t === undefined || t > s.at ? 'local' : 'remote';
  const next = unchanged ? s.data : mergeSaveText(s.key, local, s.data, undefined, newer);
  // Only remember the version once it is really stored here (storage can be full).
  if (!writeRaw(s.key, next)) return;
  state.keys[s.key] = { at: s.at, h: hashText(s.data) };
  // a game that takes copies while it runs reloads its save
  saveArrived(slugOfKey(s.key));
}

async function pull(): Promise<void> {
  lastCheck = Date.now();
  const res = await api<{ saves: ServerSave[] }>(`/api/saves?since=${readState().pulledAt}`);
  if (!user) return;
  const state = readState();
  let newest = state.pulledAt;
  for (const s of res.saves) {
    if (!isSyncedKey(s.key) || typeof s.data !== 'string' || typeof s.at !== 'number') continue;
    receive(state, s);
    newest = Math.max(newest, s.at);
  }
  // Ask again next time for copies held back for a running game.
  for (const s of waiting.values()) newest = Math.min(newest, s.at - 1);
  state.pulledAt = Math.max(state.pulledAt, newest);
  writeState(state);
}

/** Sends every changed save; `closing` (the page is going away) sends one request that outlives the page. */
function flush(closing = false): Promise<void> {
  if (!user || !ready) return Promise.resolve();
  if (pushing) {
    pushAgain = true;
    return running;
  }
  running = push(closing);
  return running;
}

async function push(closing: boolean): Promise<void> {
  window.clearTimeout(timer);
  timer = 0;
  firstChange = 0;
  pushing = true;
  try {
    for (let round = 0; round < 4 && user; round++) {
      const state = readState();
      const keys = changedKeys(state);
      if (keys.length === 0) break;
      const items: { key: string; data: string | null; base: number }[] = [];
      let size = 0;
      for (const key of keys) {
        const data = read(key);
        const n = (data?.length ?? 0) + key.length + 40;
        if (items.length > 0 && (size + n > MAX_BODY || items.length >= 24)) break;
        items.push({ key, data, base: state.keys[key]?.at ?? 0 });
        size += n;
      }
      const res = await api<PushResult>('/api/saves', { body: { items }, keepalive: closing && size < KEEPALIVE_MAX });
      if (!user) break;
      const after = readState();
      for (const s of res.saved) {
        const sent = items.find((it) => it.key === s.key);
        if (!sent) continue;
        if (sent.data === null) delete after.keys[s.key];
        // Even if the save changed again meanwhile, it now differs from what the server has and goes next round.
        else after.keys[s.key] = { at: s.at, h: hashText(sent.data) };
      }
      // Another device got there first: merge its copy in here; the merged save goes out next round.
      for (const c of res.conflicts) receive(after, c);
      writeState(after);
      if (closing) break;
    }
  } catch {
    /* offline or signed out: the next change tries again */
  } finally {
    pushing = false;
    if (pushAgain) {
      pushAgain = false;
      schedule();
    }
  }
}

function changed(key: string | null): void {
  if (key) touch(key);
  schedule();
}

function schedule(): void {
  if (!user) return;
  const now = Date.now();
  if (!firstChange) firstChange = now;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void flush(), Math.max(0, Math.min(QUIET_MS, firstChange + MAX_WAIT_MS - now)));
}

/** Notices writes to the synced saves (by any code, in this tab or another) and the page closing. */
function install(): boolean {
  if (store) return true;
  try {
    store = window.localStorage;
    store.getItem(STATE_KEY);
  } catch {
    store = null;
    return false;
  }
  const proto = Storage.prototype;
  const set = proto.setItem;
  const remove = proto.removeItem;
  setRaw = set;
  removeRawFn = remove;
  proto.setItem = function (this: Storage, key: string, value: string): void {
    set.call(this, key, value);
    if (this === store && user && isSyncedKey(key)) changed(key);
  };
  proto.removeItem = function (this: Storage, key: string): void {
    remove.call(this, key);
    if (this === store && user && isSyncedKey(key)) changed(key);
  };
  // another tab, or an embedded game's frame (NEON RUSH)
  window.addEventListener('storage', (e) => {
    if (user && e.storageArea === store && (e.key === null || isSyncedKey(e.key))) changed(e.key);
  });
  document.addEventListener('visibilitychange', () => {
    if (!user || !ready) return;
    if (document.visibilityState === 'hidden') void flush(true);
    else if (Date.now() - lastCheck > RECHECK_MS) void pull().then(() => flush(), () => undefined);
  });
  window.addEventListener('pagehide', () => void flush(true));
  // A game closed (or began taking copies while it runs): take in what other devices sent meanwhile,
  // then send what the game saved.
  onRelease((slug) => {
    if (!user) return;
    const state = readState();
    for (const [key, s] of [...waiting])
      if (slugOfKey(key) === slug) {
        waiting.delete(key);
        receive(state, s);
      }
    writeState(state);
    void flush();
  });
  return true;
}

/**
 * Starts syncing for a signed-in player (again for the same player: fetches newer saves if `remoteAt`,
 * the account's newest save time from /api/me, is ahead). Resolves when this device has the account's
 * saves, so games can read them. The first time an account syncs on a device, everything already
 * saved here (for example while playing as a guest) is merged into the account.
 */
export function startCloudSave(id: string, remoteAt = Number.POSITIVE_INFINITY): Promise<void> {
  if (!install()) return Promise.resolve();
  if (user === id) {
    if (ready && remoteAt > readState().pulledAt) void pull().then(() => flush(), () => undefined);
    return first;
  }
  user = id;
  ready = false;
  waiting.clear();
  tooBig.clear();
  setAside(id);
  const state = readState();
  writeState(state);
  first = (remoteAt > state.pulledAt ? pull() : Promise.resolve())
    .catch(() => undefined)
    .then(() => {
      if (user !== id) return;
      ready = true;
      void flush();
    });
  return first;
}

/** Every synced save in this browser. */
function syncedKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < store!.length; i++) {
      const k = store!.key(i);
      if (k && isSyncedKey(k)) keys.push(k);
    }
  } catch {
    /* blocked */
  }
  return keys;
}

/** Removes a save without counting it as a local change. */
function removeRaw(key: string): void {
  try {
    removeRawFn.call(store!, key);
  } catch {
    /* blocked */
  }
}

/**
 * Before `id` syncs here: saves another member left behind (they couldn't be sent before signing out, or
 * the session ran out) go aside instead of into `id`'s account (PS-09); `id`'s own set-aside saves come back.
 * Call with `user` set to `id`, before anything reads the state.
 */
function setAside(id: string): void {
  const prev = parseState(read(STATE_KEY));
  if (prev && prev.user !== id) {
    const saves: Record<string, string> = {};
    for (const k of syncedKeys()) {
      saves[k] = read(k)!;
      removeRaw(k);
    }
    try {
      store?.setItem(STASH_KEY, JSON.stringify({ user: prev.user, state: prev, saves } satisfies Stash));
    } catch {
      /* full: the saves stay here and are merged as this browser's (the old behavior) */
      for (const [k, v] of Object.entries(saves)) writeRaw(k, v);
      return;
    }
    removeRaw(STATE_KEY);
    saveStore.reload();
  }
  let stash: Stash | null = null;
  try {
    stash = JSON.parse(read(STASH_KEY) ?? 'null') as Stash | null;
  } catch {
    /* damaged */
  }
  if (!stash || stash.user !== id || !isObj(stash.saves)) return;
  // this member's again: what was left here goes back, with what it grew from, so it merges as a change
  for (const [k, v] of Object.entries(stash.saves)) {
    if (!isSyncedKey(k) || typeof v !== 'string') continue;
    const here = read(k);
    writeRaw(k, here === null ? v : mergeSaveText(k, v, here));
  }
  if (validState(stash.state)?.user === id && !parseState(read(STATE_KEY))) writeState(stash.state);
  removeRaw(STASH_KEY);
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The member signs out: sends what changed since the last sync (a few seconds at most), then clears that
 * member's saves from this browser (they come back at the next sign-in). Saves that couldn't be sent
 * (offline) are kept aside for that member. Call it while still signed in (the sync needs the session).
 */
export async function signOutCloudSave(ms = 4000): Promise<void> {
  if (!user || !store) return stopCloudSave();
  const id = user;
  if (ready) {
    const sent = (async () => {
      await running;
      await flush();
    })().catch(() => undefined);
    await Promise.race([sent, new Promise<void>((r) => setTimeout(r, ms))]);
  }
  if (user !== id) return;
  const state = readState();
  stopCloudSave();
  const left: Record<string, string> = {};
  for (const k of syncedKeys()) {
    const v = read(k)!;
    const e = state.keys[k];
    if (!e || e.h !== hashText(v)) left[k] = v;
    removeRaw(k);
  }
  removeRaw(STATE_KEY);
  if (Object.keys(left).length) {
    try {
      store.setItem(STASH_KEY, JSON.stringify({ user: id, state, saves: left } satisfies Stash));
    } catch {
      // full: better kept here (and merged into the next account) than lost
      for (const [k, v] of Object.entries(left)) writeRaw(k, v);
      writeState(state);
    }
  }
  saveStore.reload();
}

/** Signed out: stop syncing (this device keeps its saves). */
export function stopCloudSave(): void {
  user = null;
  ready = false;
  window.clearTimeout(timer);
  timer = 0;
  firstChange = 0;
  waiting.clear();
  tooBig.clear();
  showTooBig();
}
