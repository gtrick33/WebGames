import type { Me } from './apiTypes';
import { api } from './account';
import { browserKV, readSave, writeSave } from './save';
import { saveStore } from './store';

/**
 * Browser-side helpers for the QA tab. Tools that only touch this device report themselves to
 * /api/qa/log, so the QA audit trail has them too (the server ignores this for admins).
 */
export function logQa(action: string, detail?: Record<string, unknown>): void {
  void api('/api/qa/log', { body: { action, detail: detail ?? null } }).catch(() => undefined);
}

const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const OURS = /^(gb\.|glitchbound|neonrush)/i;

/** This device's storage keys that belong to one game (its saves, ghosts, settings). */
export function deviceKeysFor(slug: string, keys: string[] = storageKeys()): string[] {
  const id = squash(slug);
  return keys.filter((k) => OURS.test(k) && squash(k).includes(id));
}

export function storageKeys(): string[] {
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => !!k);
  } catch {
    return [];
  }
}

/** Clears one game's data on this device: its own storage and its rounds in the arcade save. */
export function clearDeviceGame(slug: string): string[] {
  const keys = deviceKeysFor(slug);
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage blocked */
    }
  }
  // The arcade save: this game's rounds and own-daily marks.
  const { kv } = browserKV();
  const save = readSave(kv);
  delete save.games[slug];
  for (const [day, list] of Object.entries(save.gameDailies)) save.gameDailies[day] = list.filter((g) => g !== slug);
  writeSave(kv, save);
  saveStore.reload();
  return keys;
}

/** Clears every arcade and game key on this device (sign-in stays: it is a cookie). */
export function clearDeviceAll(): string[] {
  const keys = storageKeys().filter((k) => OURS.test(k));
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage blocked */
    }
  }
  saveStore.reset();
  return keys;
}

/** A block of facts to paste into a bug report. */
export function debugInfo(me: Me | null): string {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const build = typeof document === 'undefined' ? '' : (document.querySelector('script[type="module"][src]')?.getAttribute('src') ?? '');
  return [
    `Time: ${new Date().toISOString()}`,
    `Page: ${typeof location === 'undefined' ? '' : location.href}`,
    `Build: ${build}`,
    `Account: ${me ? `${me.nickname} (${me.id}, ${me.role ?? 'player'})` : 'guest'}`,
    `Browser: ${nav?.userAgent ?? ''}`,
    `Language: ${nav?.language ?? ''}`,
    `Screen: ${typeof window === 'undefined' ? '' : `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`}`,
    `Theme: ${typeof document === 'undefined' ? '' : (document.documentElement.dataset.theme ?? 'auto')}, holiday: ${typeof document === 'undefined' ? '' : (document.documentElement.dataset.season ?? 'none')}`,
  ].join('\n');
}
