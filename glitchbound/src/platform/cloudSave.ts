import { api } from './account';
import { mergeSaveText } from './cloudMerge';
import { saveStore } from './store';
import { isHeld, onRelease } from './syncGate';
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
 */

const STATE_KEY = 'glitchbound.sync';
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
let timer = 0;
let firstChange = 0;
let pushing = false;
let pushAgain = false;
let lastCheck = 0;
let first: Promise<void> = Promise.resolve();
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

function readState(): SyncState {
  try {
    const s = JSON.parse(read(STATE_KEY) ?? 'null') as SyncState | null;
    if (s && s.user === user && typeof s.pulledAt === 'number' && s.keys && typeof s.keys === 'object') return s;
  } catch {
    /* damaged: start over (every save here is then merged with the account's) */
  }
  return { user: user!, pulledAt: 0, keys: {} };
}

function writeState(s: SyncState): void {
  try {
    store?.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* full or blocked */
  }
}

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
  return [...keys].filter((k) => {
    // A copy from another device is waiting for this game to close: send nothing for it until then.
    if (waiting.has(k)) return false;
    const v = read(k);
    const e = state.keys[k];
    return v === null ? !!e : v.length <= MAX_SYNCED_SAVE && (!e || e.h !== hashText(v));
  });
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
  const next = unchanged ? s.data : mergeSaveText(s.key, local, s.data);
  // Only remember the version once it is really stored here (storage can be full).
  if (writeRaw(s.key, next)) state.keys[s.key] = { at: s.at, h: hashText(s.data) };
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
async function flush(closing = false): Promise<void> {
  if (!user || !ready) return;
  if (pushing) {
    pushAgain = true;
    return;
  }
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
  proto.setItem = function (this: Storage, key: string, value: string): void {
    set.call(this, key, value);
    if (this === store && user && isSyncedKey(key)) schedule();
  };
  proto.removeItem = function (this: Storage, key: string): void {
    remove.call(this, key);
    if (this === store && user && isSyncedKey(key)) schedule();
  };
  window.addEventListener('storage', (e) => {
    if (user && e.storageArea === store && (e.key === null || isSyncedKey(e.key))) schedule();
  });
  document.addEventListener('visibilitychange', () => {
    if (!user || !ready) return;
    if (document.visibilityState === 'hidden') void flush(true);
    else if (Date.now() - lastCheck > RECHECK_MS) void pull().then(() => flush(), () => undefined);
  });
  window.addEventListener('pagehide', () => void flush(true));
  // A game closed: take in what other devices sent meanwhile, then send what the game saved.
  onRelease((slug) => {
    if (!user) return;
    const state = readState();
    for (const [key, s] of waiting)
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

/** Signed out: stop syncing (this device keeps its saves). */
export function stopCloudSave(): void {
  user = null;
  ready = false;
  window.clearTimeout(timer);
  timer = 0;
  firstChange = 0;
  waiting.clear();
}
