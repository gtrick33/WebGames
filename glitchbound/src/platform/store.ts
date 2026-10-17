import { useSyncExternalStore } from 'react';
import { GAMES } from '../catalog/games';
import type { GameEntry } from '../catalog/types';
import type { EndEvent } from './contract';
import { applyRound, browserKV, emptySave, readSave, SAVE_KEY, writeSave, type KV, type RoundResult, type Save } from './save';

/** App-wide holder for the local save, with React subscription and cross-tab sync. */
class SaveStore {
  private save: Save = emptySave();
  private kv: KV | null = null;
  persistent = false;
  private listeners = new Set<() => void>();

  private ensure(): void {
    if (this.kv || typeof window === 'undefined') return;
    const { kv, persistent } = browserKV();
    this.kv = kv;
    this.persistent = persistent;
    this.save = readSave(kv);
    window.addEventListener('storage', (e) => {
      if (e.key === SAVE_KEY || e.key === null) this.reload();
    });
  }

  /** Re-reads storage (another tab changed it). */
  reload(): void {
    if (!this.kv) return this.ensure();
    this.save = readSave(this.kv);
    this.emit();
  }

  get = (): Save => {
    this.ensure();
    return this.save;
  };

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private commit(next: Save): void {
    this.save = next;
    if (this.kv) writeSave(this.kv, next);
    this.emit();
  }

  record(game: GameEntry, event: EndEvent, games: GameEntry[] = GAMES): RoundResult {
    this.ensure();
    const next: Save = structuredClone(this.save);
    const result = applyRound(next, game, event, games);
    this.commit(next);
    return result;
  }

  reset(): void {
    this.ensure();
    try {
      this.kv?.removeItem(SAVE_KEY);
      this.kv?.removeItem(`${SAVE_KEY}.corrupt`);
      this.kv?.removeItem('glitchbound.lastVisit');
    } catch {
      /* ignore */
    }
    this.save = emptySave();
    this.emit();
  }
}

export const saveStore = new SaveStore();

export function useSave(): Save {
  return useSyncExternalStore(saveStore.subscribe, saveStore.get, emptySaveSnapshot);
}

const SERVER_SNAPSHOT = emptySave();
function emptySaveSnapshot(): Save {
  return SERVER_SNAPSHOT;
}
