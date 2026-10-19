import { useSyncExternalStore } from 'react';
import type { Me, PublicConfig, QuestView } from './apiTypes';
import { dayKey } from './dates';
import { currentSlug } from '../catalog/catalog';

/**
 * The signed-in member (or guest) on the client. Talks to /api; everything degrades gracefully
 * when the API is unreachable (local static preview, network errors): the site keeps working
 * as a guest.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    credentials: 'same-origin',
    headers: init.body ? { 'content-type': 'application/json' } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, d.error ?? 'request_failed', d.message);
  }
  return data as T;
}

const GUEST_FAVS = 'glitchbound.favorites';

function readGuestFavs(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(GUEST_FAVS) ?? '[]');
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string').map(currentSlug))].slice(0, 100) : [];
  } catch {
    return [];
  }
}

function writeGuestFavs(list: string[]): void {
  try {
    localStorage.setItem(GUEST_FAVS, JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
}

export interface AccountState {
  status: 'loading' | 'guest' | 'member' | 'offline';
  me: Me | null;
  config: PublicConfig | null;
  guestFavorites: string[];
}

class AccountStore {
  state: AccountState = { status: 'loading', me: null, config: null, guestFavorites: [] };
  private listeners = new Set<() => void>();
  private started = false;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    this.start();
    return () => this.listeners.delete(fn);
  };

  get = (): AccountState => this.state;

  private set(patch: Partial<AccountState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.set({ guestFavorites: readGuestFavs() });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const [config, res] = await Promise.all([api<PublicConfig>('/api/config'), api<{ user: Me | null }>(`/api/me?day=${dayKey()}`)]);
      this.set({ config, me: res.user, status: res.user ? 'member' : 'guest' });
    } catch {
      this.set({ status: 'offline', me: null });
    }
  }

  /** After Google (or dev) sign-in: carries guest favorites over to the account. */
  async signedIn(me: Me): Promise<void> {
    this.set({ me, status: 'member' });
    const pending = this.state.guestFavorites.filter((g) => !me.favorites.includes(g));
    for (const game of pending) await this.toggleFavorite(game, true).catch(() => undefined);
    writeGuestFavs([]);
    this.set({ guestFavorites: [] });
  }

  async signInWithGoogle(credential: string): Promise<Me> {
    const res = await api<{ user: Me }>('/api/auth/google', { body: { credential, day: dayKey() } });
    await this.signedIn(res.user);
    return res.user;
  }

  async signInWithGoogleToken(accessToken: string): Promise<Me> {
    const res = await api<{ user: Me }>('/api/auth/google', { body: { accessToken, day: dayKey() } });
    await this.signedIn(res.user);
    return res.user;
  }

  async emailStart(email: string, nickname?: string): Promise<void> {
    await api('/api/auth/email/start', { body: { email, nickname: nickname || undefined } });
  }

  async emailVerify(email: string, code: string): Promise<Me> {
    const res = await api<{ user: Me }>('/api/auth/email/verify', { body: { email, code, day: dayKey() } });
    await this.signedIn(res.user);
    return res.user;
  }

  async devSignIn(email: string, name: string): Promise<Me> {
    const res = await api<{ user: Me }>('/api/auth/dev', { body: { email, name, day: dayKey() } });
    await this.signedIn(res.user);
    return res.user;
  }

  async signOut(): Promise<void> {
    await api('/api/auth/logout', { body: {} }).catch(() => undefined);
    this.set({ me: null, status: 'guest' });
  }

  isFavorite(slug: string): boolean {
    return this.state.me ? this.state.me.favorites.includes(slug) : this.state.guestFavorites.includes(slug);
  }

  async toggleFavorite(slug: string, on = !this.isFavorite(slug)): Promise<void> {
    const me = this.state.me;
    if (!me) {
      const next = on ? [...new Set([...this.state.guestFavorites, slug])] : this.state.guestFavorites.filter((g) => g !== slug);
      writeGuestFavs(next);
      this.set({ guestFavorites: next });
      return;
    }
    // Optimistic update, then reconcile with the server.
    const optimistic = on ? [...new Set([...me.favorites, slug])] : me.favorites.filter((g) => g !== slug);
    this.set({ me: { ...me, favorites: optimistic } });
    try {
      const res = await api<{ favorites: string[] }>('/api/favorites', { body: { game: slug, on } });
      if (this.state.me) this.set({ me: { ...this.state.me, favorites: res.favorites } });
      if (on) void this.refreshQuietly();
    } catch {
      if (this.state.me) this.set({ me: { ...this.state.me, favorites: me.favorites } });
    }
  }

  setQuests(quests: QuestView[]): void {
    if (this.state.me) this.set({ me: { ...this.state.me, quests } });
  }

  setMe(me: Me): void {
    this.set({ me, status: 'member' });
  }

  async refreshQuietly(): Promise<void> {
    try {
      const res = await api<{ user: Me | null }>(`/api/me?day=${dayKey()}`);
      this.set({ me: res.user, status: res.user ? 'member' : 'guest' });
    } catch {
      /* keep what we have */
    }
  }

  async update(patch: { nickname?: string; notify?: boolean }): Promise<Me> {
    const res = await api<{ user: Me }>('/api/me', { method: 'PATCH', body: { ...patch, day: dayKey() } });
    this.set({ me: res.user });
    return res.user;
  }

  async claimQuest(questId: string): Promise<{ xp: number; levelUp: boolean }> {
    const res = await api<{ xp: number; levelUp: boolean; user: Me }>('/api/quests/claim', { body: { questId, day: dayKey() } });
    this.set({ me: res.user });
    return res;
  }

  async deleteAccount(): Promise<void> {
    await api('/api/me', { method: 'DELETE', body: {} });
    this.set({ me: null, status: 'guest' });
  }

  /** For tests. */
  reset(state: Partial<AccountState> = {}): void {
    this.started = true;
    this.state = { status: 'guest', me: null, config: null, guestFavorites: [], ...state };
    for (const fn of this.listeners) fn();
  }
}

export const account = new AccountStore();

export function useAccount(): AccountState {
  return useSyncExternalStore(account.subscribe, account.get, account.get);
}
