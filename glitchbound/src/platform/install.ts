/**
 * The arcade as an app: opened from the Home Screen it runs full screen, without the browser's bars
 * (the manifest and the apple-mobile-web-app tags in index.html). Browsers that can install say so
 * with `beforeinstallprompt` (Chrome, Edge, Samsung Internet): then the settings' button installs in
 * one tap, with the browser's own Install dialog (which no site can skip). That offer often comes
 * before this file has loaded (the settings are their own chunk), so index.html keeps it in
 * `window.__gbInstall` until it is wanted. iPhone and iPad never offer it, and no site can add itself
 * to their Home Screen: there it is Share → Add to Home Screen, so the settings show the steps for
 * the browser at hand instead (installHow).
 */
import { useSyncExternalStore } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type EarlyWindow = Window & { __gbInstall?: InstallEvent | null };

let deferred: InstallEvent | null = null;
let version = 0;
const listeners = new Set<() => void>();
const changed = (): void => {
  version++;
  for (const f of listeners) f();
};

if (typeof window !== 'undefined') {
  // (the offer index.html caught before this file came in)
  deferred = (window as EarlyWindow).__gbInstall ?? null;
  window.addEventListener('beforeinstallprompt', (e) => {
    // kept for the settings' button (instead of the browser's own banner at a random moment)
    e.preventDefault();
    deferred = e as InstallEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    (window as EarlyWindow).__gbInstall = null;
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

/**
 * How this browser puts the arcade on the Home Screen when it gives no install dialog to open:
 * - `ios-safari`: Safari's Share button, then Add to Home Screen (on iOS 26 Share can sit under •••: `ios-safari-26`);
 * - `ios-browser`: Chrome, Firefox or Edge on an iPhone: their own Share menu, then Add to Home Screen;
 * - `android`: the browser menu, then Install app / Add to Home screen;
 * - `mac-safari`: File, then Add to Dock;
 * - `desktop`: the install icon in the address bar, or the browser menu;
 * - `none`: a browser that can't install sites (Firefox on a computer).
 */
export type InstallHow = 'ios-safari' | 'ios-safari-26' | 'ios-browser' | 'android' | 'mac-safari' | 'desktop' | 'none';

export function installHow(ua: string, touchPoints: number): InstallHow {
  if (/iP(hone|ad|od)/.test(ua) || (ua.includes('Macintosh') && touchPoints > 1)) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)) return 'ios-browser';
    return Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0) >= 26 ? 'ios-safari-26' : 'ios-safari';
  }
  if (/Android/.test(ua)) return 'android';
  if (/Firefox\//.test(ua)) return 'none';
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'mac-safari';
  return 'desktop';
}

/** Shows the browser's install dialog (when it offered one); true when the player installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  (window as EarlyWindow).__gbInstall = null;
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
  /** The browser can show its install dialog now: one tap installs. */
  canPrompt: boolean;
  /** Otherwise, the steps this browser takes (installHow). */
  how: InstallHow;
}

let cached: { v: number; state: InstallState } | null = null;
const snapshot = (): InstallState => {
  if (!cached || cached.v !== version) cached = { v: version, state: { standalone: isStandalone(), ios: isIos(), canPrompt: !!deferred, how: installHow(navigator.userAgent, navigator.maxTouchPoints || 0) } };
  return cached.state;
};
const SERVER: InstallState = { standalone: false, ios: false, canPrompt: false, how: 'desktop' };

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
