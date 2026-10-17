import { createProfile, sanitizeProfile, type Profile } from './profile';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'neonrush.save';
export const CORRUPT_KEY = 'neonrush.save.corrupt';

/** In-memory fallback (private mode, blocked storage, tests). */
export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export function browserStore(): KeyValueStore {
  try {
    const ls = window.localStorage;
    const probe = '__neonrush_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    console.warn('[save] localStorage unavailable, progress will not persist this session');
    return new MemoryStore();
  }
}

export interface LoadResult {
  profile: Profile;
  status: 'new' | 'loaded' | 'recovered';
}

export class SaveManager {
  constructor(private readonly store: KeyValueStore) {}

  load(now = Date.now()): LoadResult {
    let raw: string | null;
    try {
      raw = this.store.getItem(SAVE_KEY);
    } catch {
      raw = null;
    }
    if (raw === null) return { profile: createProfile(now), status: 'new' };
    try {
      const parsed: unknown = JSON.parse(raw);
      return { profile: sanitizeProfile(parsed, now), status: 'loaded' };
    } catch {
      // Keep the unreadable data around for support/debugging, then start fresh rather than crash.
      try {
        this.store.setItem(CORRUPT_KEY, raw);
      } catch {
        /* ignore */
      }
      console.warn('[save] save data was corrupted; starting a fresh profile');
      return { profile: createProfile(now), status: 'recovered' };
    }
  }

  save(profile: Profile): boolean {
    try {
      this.store.setItem(SAVE_KEY, JSON.stringify(profile));
      return true;
    } catch (err) {
      console.warn('[save] failed to write save data', err);
      return false;
    }
  }

  reset(now = Date.now()): Profile {
    const fresh = createProfile(now);
    this.save(fresh);
    return fresh;
  }
}
