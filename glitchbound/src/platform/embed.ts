import { useSyncExternalStore } from 'react';

/**
 * When the arcade runs inside another app (the Discord Activity, docs/discord-activity.md): the
 * arcade shows a slim bar instead of its header and footer, and inviting goes through the app.
 */
export interface EmbedHost {
  kind: 'discord';
  /** Opens the app's own invite dialog (set once the app is connected). */
  invite?: () => void;
}

let host: EmbedHost | null = null;
const listeners = new Set<() => void>();

export const embedHost = (): EmbedHost | null => host;

export function setEmbedHost(next: EmbedHost | null): void {
  host = next;
  listeners.forEach((fn) => fn());
}

export function useEmbedHost(): EmbedHost | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    embedHost,
    () => null,
  );
}

/** Discord adds these to the Activity's address when it launches it. */
export function isDiscordLaunch(search: string): boolean {
  const q = new URLSearchParams(search);
  return !!q.get('frame_id') && !!q.get('instance_id') && !!q.get('platform');
}
