import { decodeGhost, encodeGhost, type Ghost } from './ghost';
import type { Mode } from './sim';

/** Local-only saves (bests, ghosts, settings). Every access is guarded: storage can be missing or full. */

const KEY = 'gb.mini-racer.v1';
const GHOST_PREFIX = 'gb.mini-racer.ghost.';

export interface Bests {
  /** Best valid lap, seconds. */
  lap?: number;
  /** Best 3-lap race, seconds. */
  race?: number;
  /** Best Drift Zone score. */
  drift?: number;
}

export interface SaveData {
  bests: Record<string, Bests>;
  paint: number;
  muted: boolean;
  track: string;
  mode: Mode;
}

const DEFAULTS: SaveData = { bests: {}, paint: 0, muted: false, track: 'sunny-bay', mode: 'race' };

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): SaveData {
  try {
    const raw = store()?.getItem(KEY);
    if (!raw) return { ...DEFAULTS, bests: {} };
    const o = JSON.parse(raw) as Partial<SaveData>;
    const bests: Record<string, Bests> = {};
    if (o.bests && typeof o.bests === 'object') {
      for (const [k, v] of Object.entries(o.bests)) {
        if (!v || typeof v !== 'object') continue;
        const b: Bests = {};
        for (const f of ['lap', 'race', 'drift'] as const) {
          const n = (v as Bests)[f];
          if (typeof n === 'number' && Number.isFinite(n) && n > 0) b[f] = n;
        }
        bests[k] = b;
      }
    }
    return {
      bests,
      paint: typeof o.paint === 'number' ? o.paint : 0,
      muted: o.muted === true,
      track: typeof o.track === 'string' ? o.track : DEFAULTS.track,
      mode: o.mode === 'hotlap' || o.mode === 'drift' ? o.mode : 'race',
    };
  } catch {
    return { ...DEFAULTS, bests: {} };
  }
}

export function writeSave(s: SaveData): void {
  try {
    store()?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* full or blocked */
  }
}

export function loadGhost(trackId: string): Ghost | null {
  try {
    return decodeGhost(store()?.getItem(GHOST_PREFIX + trackId) ?? null);
  } catch {
    return null;
  }
}

export function saveGhost(trackId: string, g: Ghost): void {
  const s = store();
  if (!s) return;
  try {
    // Daily ghosts expire with their day: drop the old ones first.
    if (trackId.startsWith('daily-')) {
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i);
        if (k && k.startsWith(GHOST_PREFIX + 'daily-') && k !== GHOST_PREFIX + trackId) s.removeItem(k);
      }
    }
    s.setItem(GHOST_PREFIX + trackId, encodeGhost(g));
  } catch {
    /* full or blocked */
  }
}
