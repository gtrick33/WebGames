import { useSyncExternalStore } from 'react';

/**
 * Light (toy-box) or dark (neon) theme. "auto" follows the system setting; a choice is remembered on
 * this device. index.html applies the stored choice before first paint, so there is no flash.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';
const KEY = 'glitchbound.theme';
const listeners = new Set<() => void>();

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

const systemDark = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

/** Whether the page is showing the dark theme right now. */
export const isDark = (choice: ThemeChoice = readTheme()): boolean => choice === 'dark' || (choice === 'auto' && systemDark());

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark(choice) ? '#0d0522' : '#fff6ea');
}

export function setTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: still applies for this visit */
  }
  apply(choice);
  listeners.forEach((fn) => fn());
}

/** Next choice for a one-button toggle: auto -> the opposite of what is showing -> back to auto. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  if (choice === 'auto') return isDark('auto') ? 'light' : 'dark';
  return 'auto';
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const onSystem = (): void => {
    if (readTheme() === 'auto') apply('auto');
    fn();
  };
  mq?.addEventListener('change', onSystem);
  return () => {
    listeners.delete(fn);
    mq?.removeEventListener('change', onSystem);
  };
}

/** [choice, dark] for components. */
export function useTheme(): [ThemeChoice, boolean] {
  const key = useSyncExternalStore(
    subscribe,
    () => `${readTheme()}:${isDark()}`,
    () => 'auto:false',
  );
  const [choice, dark] = key.split(':');
  return [choice as ThemeChoice, dark === 'true'];
}
