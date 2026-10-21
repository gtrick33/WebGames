/**
 * The arcade as an app: opened from the Home Screen it runs full screen, without the browser's bars
 * (the manifest and the apple-mobile-web-app tags in index.html). Browsers that can install say so
 * with `beforeinstallprompt` (Chrome, Edge, Android); iPhone and iPad never do: there it is Share →
 * Add to Home Screen, so the settings explain it instead.
 */
import { useSyncExternalStore } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: InstallEvent | null = null;
let version = 0;
const listeners = new Set<() => void>();
const changed = (): void => {
  version++;
  for (const f of listeners) f();
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // keep it for the settings' Install button (instead of the browser's own banner at a random moment)
    e.preventDefault();
    deferred = e as InstallEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    changed();
  });
}

/** Running as the installed app (from the Home Screen), not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) || (navigator as { standalone?: boolean }).standalone === true;
}

/** An iPhone or iPad browser tab (iPadOS reports a Mac, so touch points decide). */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** Shows the browser's install dialog (when it offered one); true when the player installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  changed();
  await e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  return choice.outcome === 'accepted';
}

export interface InstallState {
  /** Already the app: nothing to offer. */
  standalone: boolean;
  /** iPhone or iPad: Share → Add to Home Screen. */
  ios: boolean;
  /** The browser can show its install dialog now. */
  canPrompt: boolean;
}

let cached: { v: number; state: InstallState } | null = null;
const snapshot = (): InstallState => {
  if (!cached || cached.v !== version) cached = { v: version, state: { standalone: isStandalone(), ios: isIos(), canPrompt: !!deferred } };
  return cached.state;
};
const SERVER: InstallState = { standalone: false, ios: false, canPrompt: false };

export function useInstall(): InstallState {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    snapshot,
    () => SERVER,
  );
}
