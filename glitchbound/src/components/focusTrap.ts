/**
 * Keeps keyboard focus inside a modal dialog (an `aria-modal` div is only a promise: the browser still
 * tabs out to the page behind it). `trapTab` turns Tab on the last control into the first one and
 * Shift+Tab on the first into the last; `useFocusReturn` gives the focus back to whatever had it before
 * the dialog opened.
 */
import { useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Call from a keydown handler: wraps Tab around inside `root`. Returns whether it handled the key. */
export function trapTab(e: KeyboardEvent | ReactKeyboardEvent, root: HTMLElement | null): boolean {
  if (e.key !== 'Tab' || !root) return false;
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[aria-hidden="true"], [inert]'));
  if (items.length === 0) {
    e.preventDefault();
    return true;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const at = document.activeElement;
  const inside = at instanceof Node && root.contains(at);
  if (e.shiftKey ? !inside || at === first : !inside || at === last) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
    return true;
  }
  return false;
}

/** Puts the focus back where it was when the calling dialog mounted, once it unmounts. */
export function useFocusReturn(): void {
  useEffect(() => {
    const before = document.activeElement;
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
}
