/**
 * The party session: players, settings, scores and the running mode, saved on this device after every
 * change so an accidental refresh resumes exactly where the group was. Nothing is uploaded.
 */
import type { AuctionState } from './auction';
import type { BoardState } from './board';
import { makePlayer, type Participation, type Scores } from './engine';
import type { Challenge, PartySettings, Player } from './types';

/** The card on the table in Party Prompts (kept so a refresh shows the same card). */
export interface DealtCard {
  c: Challenge;
  text: string;
  players: string[];
  teams?: [string[], string[]];
}

export const PARTY_KEY = 'glitchbound.party';

export type ModeId = 'prompts' | 'nhie' | 'charades' | 'board' | 'auction' | 'mini';

export type ModeState =
  | { mode: 'prompts'; count: number; limit: number; card?: DealtCard }
  | { mode: 'nhie'; count: number; limit: number; reveal: boolean; categories: string[]; have: Record<string, number> }
  | { mode: 'charades'; data: unknown }
  | { mode: 'board'; state: BoardState }
  | { mode: 'auction'; state: AuctionState }
  | { mode: 'mini' };

export interface PartySession {
  v: 1;
  players: Player[];
  settings: PartySettings;
  scores: Scores;
  part: Participation;
  /** Used content ids per deck, so prompts do not repeat within a session. */
  used: Record<string, string[]>;
  /** The group's own prompts, kept between sessions. */
  custom: { challenges: string[]; nhie: string[] };
  active: ModeState | null;
  updatedAt: number;
}

export const defaultSettings = (): PartySettings => ({
  consequence: 'points',
  intensities: ['casual'],
  adultConfirmed: false,
  excludedTags: [],
  length: 'standard',
});

export const emptySession = (): PartySession => ({
  v: 1,
  players: [makePlayer('', 0, 'p0'), makePlayer('', 1, 'p1')],
  settings: defaultSettings(),
  scores: {},
  part: {},
  used: {},
  custom: { challenges: [], nhie: [] },
  active: null,
  updatedAt: 0,
});

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown, max = 200): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 300)).slice(0, max) : []);

/** Repairs a stored session; anything that does not look right falls back to defaults. */
export function sanitizeSession(raw: unknown): PartySession {
  const s = emptySession();
  if (!isObj(raw) || raw.v !== 1) return s;
  if (Array.isArray(raw.players)) {
    const players = raw.players
      .filter(isObj)
      .filter((p) => typeof p.id === 'string' && typeof p.name === 'string')
      .slice(0, 16)
      .map((p, i) => ({ ...makePlayer(String(p.name), i, String(p.id)), color: typeof p.color === 'string' ? p.color : makePlayer('', i).color, emoji: typeof p.emoji === 'string' ? p.emoji : makePlayer('', i).emoji }));
    if (players.length) s.players = players;
  }
  if (isObj(raw.settings)) {
    const st = raw.settings;
    const def = defaultSettings();
    s.settings = {
      consequence: ['points', 'tasks', 'sips', 'none'].includes(st.consequence as string) ? (st.consequence as PartySettings['consequence']) : def.consequence,
      intensities: strings(st.intensities).filter((i): i is PartySettings['intensities'][number] => ['casual', 'spicy', 'afterdark'].includes(i)),
      adultConfirmed: st.adultConfirmed === true,
      excludedTags: strings(st.excludedTags, 30),
      length: ['quick', 'standard', 'long'].includes(st.length as string) ? (st.length as PartySettings['length']) : def.length,
    };
    if (!s.settings.intensities.length) s.settings.intensities = ['casual'];
  }
  const nums = (v: unknown): Record<string, number> => (isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === 'number' && Number.isFinite(n))) as Record<string, number> : {});
  s.scores = nums(raw.scores);
  s.part = nums(raw.part);
  if (isObj(raw.used)) for (const [k, v] of Object.entries(raw.used)) s.used[k] = strings(v, 2000);
  if (isObj(raw.custom)) s.custom = { challenges: strings(raw.custom.challenges, 100), nhie: strings(raw.custom.nhie, 100) };
  // Running modes are stored whole; a broken one is simply dropped (the players and scores survive).
  if (isObj(raw.active) && typeof raw.active.mode === 'string') s.active = raw.active as unknown as ModeState;
  s.updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : 0;
  return s;
}

export function loadSession(): PartySession {
  try {
    const raw = localStorage.getItem(PARTY_KEY);
    return raw ? sanitizeSession(JSON.parse(raw)) : emptySession();
  } catch {
    return emptySession();
  }
}

export function saveSession(s: PartySession): void {
  try {
    localStorage.setItem(PARTY_KEY, JSON.stringify({ ...s, updatedAt: Date.now() }));
  } catch {
    /* storage full or blocked: the party goes on, it just will not survive a refresh */
  }
}
