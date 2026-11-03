/**
 * Whether a key press on the window is meant for the Belot table: not typed into a field, not inside
 * someone else's dialog, not outside the game (the page around it), and no shortcut combination.
 */
export function keyForGame(e: KeyboardEvent, root: Element | null): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const t = e.target instanceof Element ? e.target : null;
  if (!t || t === document.body || t === document.documentElement) return true;
  if (t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
  if (!root || !root.contains(t)) return false;
  const dialog = t.closest('[role="dialog"], [aria-modal="true"]');
  return !dialog || root.contains(dialog);
}

/** A keyboard-focused button keeps Enter and Space for itself. */
export const buttonKeepsKey = (e: KeyboardEvent): boolean =>
  (e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLElement && e.target.matches('button:focus-visible, a:focus-visible, [role="switch"]:focus-visible, [role="radio"]:focus-visible');
