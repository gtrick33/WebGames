import { DEFAULT_SKIN_ID, isKnownSkin } from '../cosmetics/skins';

/** Bump when the shape changes and add a migration in `migrate`. */
export const SAVE_VERSION = 3;

export interface Settings {
  sfxVolume: number;
  musicVolume: number;
  vibration: boolean;
  screenShake: boolean;
  /** Fewer particles and glow for low-end devices. */
  lowQuality: boolean;
}

export interface Profile {
  version: number;
  createdAt: number;
  /** Soft currency earned in play. */
  coins: number;
  bestDistance: number;
  bestScore: number;
  lifetimeDistance: number;
  gamesPlayed: number;
  totalCoins: number;
  totalNearMisses: number;
  xp: number;
  level: number;
  ownedSkins: string[];
  equippedSkin: string;
  /** Unlocked achievement id -> unlock timestamp. */
  achievements: Record<string, number>;
  daily: { lastClaimDay: string | null; streak: number };
  challenges: { day: string; progress: Record<string, number>; claimed: string[] };
  /** Real-money entitlements (e.g. "no_ads"); only ever granted after provider/server verification. */
  entitlements: string[];
  /** Idempotency keys so repeated callbacks can never grant a reward twice. */
  processedRunIds: string[];
  grantedRewardIds: string[];
  processedTransactions: string[];
  settings: Settings;
  /** Random anonymous id for the online leaderboard (not linked to any account). */
  playerId: string;
  /** Public racer name; empty until the player chooses one. */
  playerName: string;
  /** True once the player typed their own racer name: the arcade's name no longer replaces it. */
  nameChosen: boolean;
  /** Friends' challenge rounds from the arcade, by seed: one attempt each (newest last, pruned). */
  challengeRounds: Record<string, ChallengeRound>;
}

export interface ChallengeRound {
  /** Score, meters, coins and near misses reached so far (the final ones once done). */
  score: number;
  meters: number;
  coins: number;
  nearMisses: number;
  done: boolean;
}

/** How many challenge rounds the save remembers. */
export const MAX_CHALLENGE_ROUNDS = 20;

export const challengeKey = (seed: number): string => `s${seed}`;

/** RFC 4122 v4 UUID, with a fallback for non-secure contexts. */
export function newPlayerId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_SETTINGS: Settings = {
  sfxVolume: 0.8,
  musicVolume: 0.5,
  vibration: true,
  screenShake: true,
  lowQuality: false,
};

export const STARTING_COINS = 100;

export function createProfile(now = Date.now()): Profile {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    coins: STARTING_COINS,
    bestDistance: 0,
    bestScore: 0,
    lifetimeDistance: 0,
    gamesPlayed: 0,
    totalCoins: 0,
    totalNearMisses: 0,
    xp: 0,
    level: 1,
    ownedSkins: [DEFAULT_SKIN_ID],
    equippedSkin: DEFAULT_SKIN_ID,
    achievements: {},
    daily: { lastClaimDay: null, streak: 0 },
    challenges: { day: '', progress: {}, claimed: [] },
    entitlements: [],
    processedRunIds: [],
    grantedRewardIds: [],
    processedTransactions: [],
    settings: { ...DEFAULT_SETTINGS },
    playerId: newPlayerId(),
    playerName: '',
    nameChosen: false,
    challengeRounds: {},
  };
}

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const int = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  Math.floor(num(v, fallback, min, max));
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const strArr = (v: unknown, limit = 500): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))].slice(-limit) : [];

/** Upgrade older save shapes to the current version. Each step is pure and additive. */
export function migrate(raw: Raw): Raw {
  let data = { ...raw };
  const version = typeof data.version === 'number' ? data.version : 1;
  if (version < 2) {
    // v1 stored { best, skins, skin } and had no achievements or daily data.
    data = {
      ...data,
      bestScore: data.bestScore ?? data.best,
      ownedSkins: data.ownedSkins ?? data.skins,
      equippedSkin: data.equippedSkin ?? data.skin,
      version: 2,
    };
  }
  // v3 added playerId / playerName; sanitizeProfile fills them in.
  return data;
}

/**
 * Turn arbitrary (possibly corrupted or tampered) JSON into a valid Profile.
 * Every field falls back to a safe default instead of throwing.
 */
export function sanitizeProfile(input: unknown, now = Date.now()): Profile {
  const base = createProfile(now);
  if (!isObj(input)) return base;
  const raw = migrate(input);

  const ownedSkins = strArr(raw.ownedSkins).filter(isKnownSkin);
  if (!ownedSkins.includes(DEFAULT_SKIN_ID)) ownedSkins.unshift(DEFAULT_SKIN_ID);
  const equipped = typeof raw.equippedSkin === 'string' && ownedSkins.includes(raw.equippedSkin) ? raw.equippedSkin : DEFAULT_SKIN_ID;

  const achievements: Record<string, number> = {};
  if (isObj(raw.achievements)) {
    for (const [k, v] of Object.entries(raw.achievements)) if (typeof v === 'number' && Number.isFinite(v)) achievements[k] = v;
  }

  const dailyRaw = isObj(raw.daily) ? raw.daily : {};
  const chRaw = isObj(raw.challenges) ? raw.challenges : {};
  const progress: Record<string, number> = {};
  if (isObj(chRaw.progress)) {
    for (const [k, v] of Object.entries(chRaw.progress)) if (typeof v === 'number' && Number.isFinite(v)) progress[k] = Math.max(0, v);
  }
  const s = isObj(raw.settings) ? raw.settings : {};

  return {
    version: SAVE_VERSION,
    createdAt: num(raw.createdAt, now),
    coins: int(raw.coins, base.coins),
    bestDistance: num(raw.bestDistance, 0),
    bestScore: int(raw.bestScore, 0),
    lifetimeDistance: num(raw.lifetimeDistance, 0),
    gamesPlayed: int(raw.gamesPlayed, 0),
    totalCoins: int(raw.totalCoins, 0),
    totalNearMisses: int(raw.totalNearMisses, 0),
    xp: int(raw.xp, 0),
    level: int(raw.level, 1, 1, 999),
    ownedSkins,
    equippedSkin: equipped,
    achievements,
    daily: {
      lastClaimDay: typeof dailyRaw.lastClaimDay === 'string' ? dailyRaw.lastClaimDay : null,
      streak: int(dailyRaw.streak, 0, 0, 10_000),
    },
    challenges: {
      day: typeof chRaw.day === 'string' ? chRaw.day : '',
      progress,
      claimed: strArr(chRaw.claimed, 20),
    },
    entitlements: strArr(raw.entitlements, 50),
    processedRunIds: strArr(raw.processedRunIds, 50),
    grantedRewardIds: strArr(raw.grantedRewardIds, 100),
    processedTransactions: strArr(raw.processedTransactions, 200),
    settings: {
      sfxVolume: num(s.sfxVolume, DEFAULT_SETTINGS.sfxVolume, 0, 1),
      musicVolume: num(s.musicVolume, DEFAULT_SETTINGS.musicVolume, 0, 1),
      vibration: bool(s.vibration, DEFAULT_SETTINGS.vibration),
      screenShake: bool(s.screenShake, DEFAULT_SETTINGS.screenShake),
      lowQuality: bool(s.lowQuality, DEFAULT_SETTINGS.lowQuality),
    },
    playerId: typeof raw.playerId === 'string' && UUID.test(raw.playerId) ? raw.playerId : base.playerId,
    playerName: typeof raw.playerName === 'string' ? raw.playerName.slice(0, 14) : '',
    nameChosen: bool(raw.nameChosen, false),
    challengeRounds: sanitizeRounds(raw.challengeRounds),
  };
}

function sanitizeRounds(v: unknown): Record<string, ChallengeRound> {
  const out: Record<string, ChallengeRound> = {};
  if (!isObj(v)) return out;
  for (const [k, r] of Object.entries(v).slice(-MAX_CHALLENGE_ROUNDS)) {
    if (!/^s-?\d{1,10}$/.test(k) || !isObj(r)) continue;
    out[k] = { score: int(r.score, 0, 0, 1e9), meters: int(r.meters, 0, 0, 1e9), coins: int(r.coins, 0, 0, 1e9), nearMisses: int(r.nearMisses, 0, 0, 1e9), done: bool(r.done, false) };
  }
  return out;
}

/** Record a challenge round's progress, keeping only the newest rounds. */
export function putChallengeRound(profile: Profile, key: string, round: ChallengeRound): void {
  delete profile.challengeRounds[key];
  profile.challengeRounds[key] = round;
  const keys = Object.keys(profile.challengeRounds);
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_CHALLENGE_ROUNDS))) delete profile.challengeRounds[old];
}

/** Another tab's save is adopted whole; the rounds this tab knows about are kept (the furthest one wins). */
export function mergeChallengeRounds(into: Profile, from: Profile): void {
  for (const [k, r] of Object.entries(from.challengeRounds)) {
    const theirs = into.challengeRounds[k];
    if (!theirs || (!theirs.done && (r.done || r.score > theirs.score))) putChallengeRound(into, k, r);
  }
}

/** Record an idempotency key in a bounded list. Returns false if it was already present. */
export function markOnce(list: string[], key: string, limit: number): boolean {
  if (list.includes(key)) return false;
  list.push(key);
  if (list.length > limit) list.splice(0, list.length - limit);
  return true;
}
