import { useEffect } from 'react';

/** What a press inside never picks up words from (a field being typed in still can). */
const GUARDED = '.rb-vigil, .rb-vlobby, .rb-vend, .rb-vfire';
const typing = (n: Node | null): boolean => {
  const el = n instanceof Element ? n : n?.parentElement;
  return !!el?.closest('input, textarea, select, [contenteditable="true"]');
};
const guarded = (n: Node | null): boolean => {
  const el = n instanceof Element ? n : n?.parentElement;
  return !!el?.closest(GUARDED) && !typing(n);
};

/**
 * Words in the Vigil are never picked up by a held thumb. The game already asks for that in its styles (Game.css's
 * `.rb`, `user-select: none`), and still the owner, holding his thumb down in a night on an iPhone, had the clock's
 * words picked up and Safari's "Copy Link with Highlight" over them (2026-11-26). So the page also refuses: a selection
 * that would begin inside the Vigil is stopped, one that forms anyway is dropped at once, and the press-and-hold menu
 * is not opened there.
 */
export function stopSelecting(doc: Document): () => void {
  const start = (e: Event): void => {
    if (guarded(e.target as Node)) e.preventDefault();
  };
  const changed = (): void => {
    const s = doc.getSelection();
    if (s && !s.isCollapsed && guarded(s.anchorNode)) s.removeAllRanges();
  };
  doc.addEventListener('selectstart', start);
  doc.addEventListener('contextmenu', start);
  doc.addEventListener('selectionchange', changed);
  return () => {
    doc.removeEventListener('selectstart', start);
    doc.removeEventListener('contextmenu', start);
    doc.removeEventListener('selectionchange', changed);
  };
}

/** While a Vigil screen is up. */
export function useNoSelect(): void {
  useEffect(() => stopSelecting(document), []);
}
