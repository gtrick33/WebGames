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

/** A touch that starts this soon after a tap ended is the second half of a double tap, to the phone. */
export const DOUBLE_TAP_MS = 500;
/** A finger that moves further than this is a drag, not a tap. */
export const TAP_SLOP = 12;
/** How soon after a touch's end the phone sends the click it makes of it. */
const CLICK_ECHO_MS = 350;

/** Inside something that scrolls (a bag, a list of talents): a drag there must still scroll it. */
function inScroller(el: Element | null, stage: Element): boolean {
  const view = el?.ownerDocument.defaultView;
  for (let n = el; n && n !== stage; n = n.parentElement) {
    const s = view?.getComputedStyle(n);
    if (!s) return false;
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return true;
    if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth) return true;
  }
  return false;
}

/**
 * No double tap on the game does anything but tap twice. The game already says no to selecting and to the press menu
 * (Game.css `.rb`: user-select none, touch-callout none, touch-action none), and still on an iPhone two fast taps on a
 * button of the HUD brought up Safari's magnifying glass (the owner, on an iPhone 17 Pro, 2026-11-26: "if i double tap
 * fast on any button of the ui, the magnefying glass pops up, block any such events please"). Safari's loupe is not
 * held back by any style; only a page that says no to the touch itself stops it.
 *
 * So the second touch of a double tap (one that starts within DOUBLE_TAP_MS of a tap's end) is refused to the phone:
 * its start, so nothing of the phone's begins (the loupe, a zoom, a selection), except inside something that scrolls,
 * where a drag must still scroll; and its end, if it is a tap, so no double tap is ever made of it. A refused touch
 * makes no click, so the tap's click is given to what it was on, as the phone would have. What the game reads from
 * touches (the stick, the skills: pointer events) comes all the same. A click the phone sends anyway is not taken twice.
 * A field being typed in is let be.
 */
export function stopDoubleTap(stage: HTMLElement): () => void {
  const doc = stage.ownerDocument;
  const view = doc.defaultView ?? window;
  /** When the last tap ended. */
  let lastTap = -Infinity;
  /** The touches under way: where each began, whether it has moved off, whether it is a double tap's second half. */
  const touches = new Map<number, { x: number; y: number; moved: boolean; second: boolean; target: EventTarget | null }>();
  /** When a click was given for a refused tap: the phone's own, if it sends one right after, is not taken as well. */
  let gave = -Infinity;
  const now = (): number => view.performance.now();
  const start = (e: TouchEvent): void => {
    gave = -Infinity;
    const second = now() - lastTap <= DOUBLE_TAP_MS;
    for (const t of Array.from(e.changedTouches)) touches.set(t.identifier, { x: t.clientX, y: t.clientY, moved: false, second, target: t.target });
    if (!second || typing(e.target as Node)) return;
    if (e.cancelable && !inScroller(e.target as Element, stage)) e.preventDefault();
  };
  const move = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      const at = touches.get(t.identifier);
      if (at && !at.moved && Math.hypot(t.clientX - at.x, t.clientY - at.y) > TAP_SLOP) at.moved = true;
    }
  };
  const end = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      const at = touches.get(t.identifier);
      touches.delete(t.identifier);
      if (!at || at.moved) continue;
      lastTap = now();
      const el = at.target instanceof view.Element ? at.target : null;
      if (!at.second || !el || typing(el)) continue;
      if (e.cancelable) e.preventDefault();
      if (el.closest(':disabled')) continue;
      gave = now();
      el.dispatchEvent(new view.MouseEvent('click', { bubbles: true, cancelable: true, composed: true, detail: 1,clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY }));
    }
  };
  const cancel = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) touches.delete(t.identifier);
  };
  const click = (e: MouseEvent): void => {
    // (the phone's own comes at once after the touch's end: a click later than this is someone else's, a mouse's)
    if (!e.isTrusted || now() - gave > CLICK_ECHO_MS) return;
    gave = -Infinity;
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  stage.addEventListener('touchstart', start, { passive: false });
  stage.addEventListener('touchmove', move, { passive: true });
  stage.addEventListener('touchend', end, { passive: false });
  stage.addEventListener('touchcancel', cancel);
  doc.addEventListener('click', click, true);
  return () => {
    stage.removeEventListener('touchstart', start);
    stage.removeEventListener('touchmove', move);
    stage.removeEventListener('touchend', end);
    stage.removeEventListener('touchcancel', cancel);
    doc.removeEventListener('click', click, true);
  };
}
