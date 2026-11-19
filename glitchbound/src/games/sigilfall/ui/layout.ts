import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { SigilEngine } from '../engine';
import { boxesMeet, type ViewBox } from '../render/speech';
import { hudBoxOf } from './hudBoxes';

/**
 * The screen's one owner (POLISH_PLAN.md piece 2: "nothing on the screen covering anything else, at any size").
 *
 * The HUD's fixed pieces (the hero's frame, the menu, the minimap, the quest, the news, the skills, a phone's thumbs)
 * keep their places, and each says where it is (ui/hudBoxes.ts). What comes and goes asks for a place among them, by
 * priority: an announcement (a banner, a level gained, a land's name) and the wave's count slide down from where they
 * would stand until nothing fixed is under them; a lesson over a button slides up off the other buttons and keeps
 * inside the picture; and the words people say, drawn on the picture itself, go last, round all of it
 * (render/speech.ts placeSpeech).
 */

/** What an announcement or the wave's count keeps clear of. */
export const TOP_PIECES = ['hero', 'menu', 'map', 'quest', 'toasts', 'boss', 'call', 'party', 'clock', 'wave'] as const;

/** How far down the picture a sliding piece may go, as a share of its height, before it gives up and stays put. */
const SLIDE_LIMIT = 0.55;

/**
 * How far a box has to slide (down, or up with `dir` -1) to meet none of `taken`, a step at a time, never past
 * `limit` (a y for its top going down, for its bottom going up). 0 when it is clear where it stands, and 0 too when
 * nothing within reach is clear: then it is better where it was meant to be.
 */
export function slideClear(box: ViewBox, taken: readonly ViewBox[], limit: number, dir: 1 | -1 = 1, step = 6, gap = 6): number {
  for (let d = 0; ; d += step) {
    const b = { ...box, y: box.y + dir * d };
    if (dir > 0 ? b.y > limit : b.y + b.h < limit) return 0;
    if (!taken.some((t) => boxesMeet(b, t, gap))) return dir * d;
  }
}

/** How far a box must move sideways to stay inside [lo, hi] (0 if it does). */
export function keepInside(box: ViewBox, lo: number, hi: number): number {
  if (box.w > hi - lo) return lo + (hi - lo) / 2 - (box.x + box.w / 2);
  if (box.x < lo) return lo - box.x;
  if (box.x + box.w > hi) return hi - (box.x + box.w);
  return 0;
}

/**
 * How the element's own pixels stand on the screen: each axis's size (its zoom and its parents' scaling) against the
 * view's pixels, and whether a mirrored parent turns its x round (a left-handed player's cluster is drawn mirrored).
 */
function scaleOf(engine: SigilEngine, el: HTMLElement): { x: number; y: number; flip: boolean } {
  const r = engine.renderer as SigilEngine['renderer'] | undefined;
  const c = r?.canvas.getBoundingClientRect();
  const view = r && c && c.width > 0 ? r.viewW / c.width : 1;
  let sx = Number(getComputedStyle(el).zoom) || 1;
  let sy = sx;
  let flip = false;
  for (let e = el.parentElement; e && !e.classList.contains('rb-ui'); e = e.parentElement) {
    const t = getComputedStyle(e).transform;
    if (!t || t === 'none') continue;
    const m = new DOMMatrixReadOnly(t);
    if (m.a < 0) flip = !flip;
    sx *= Math.hypot(m.a, m.b) || 1;
    sy *= Math.hypot(m.c, m.d) || 1;
  }
  return { x: view * sx, y: view * sy, flip };
}

/**
 * Where an element would stand with nothing moved, in the view's pixels. Its own `translate` is taken off (it is
 * what this owner sets), and so is any scale its animation is in the middle of: the size is its laid-out size.
 */
function natural(engine: SigilEngine, el: HTMLElement): ViewBox | null {
  const r = engine.renderer as SigilEngine['renderer'] | undefined;
  if (!r) return null;
  const was = el.style.translate;
  el.style.translate = '';
  const at = hudBoxOf(r.canvas, el, r.viewW, r.viewH);
  el.style.translate = was;
  if (!at) return null;
  const k = scaleOf(engine, el);
  const w = el.offsetWidth * k.x;
  const h = el.offsetHeight * k.y;
  if (!(w > 0 && h > 0)) return at;
  const cx = at.x + at.w / 2;
  const cy = at.y + at.h / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Moves an element by (dx, dy) of the view's pixels, by its `translate` (its own `transform` and animation untouched).
 * A piece of the HUD that says where it is (`self`) says so again once moved: what keeps clear of it keeps clear of
 * where it is now, not where it was.
 */
function shift(engine: SigilEngine, el: HTMLElement, dx: number, dy: number, self = ''): void {
  const k = scaleOf(engine, el);
  const x = Math.round(((k.flip ? -1 : 1) * dx) / k.x);
  const y = Math.round(dy / k.y);
  const next = x || y ? `${x}px ${y}px` : '';
  if (el.style.translate === next) return;
  el.style.translate = next;
  const r = engine.renderer as SigilEngine['renderer'] | undefined;
  if (self && r) r.setHudBox(self, hudBoxOf(r.canvas, el, r.viewW, r.viewH));
}

/** The fixed pieces by name, and the speech drawn this frame. */
function taken(engine: SigilEngine, ids: readonly string[], self: string): ViewBox[] {
  const r = engine.renderer as SigilEngine['renderer'] | undefined;
  if (!r) return [];
  return ids.flatMap((id) => (id === self ? [] : (r.hudBoxes.get(id) ?? [])));
}

/**
 * Places an element that comes and goes (an announcement, the wave's count): down from where its CSS stands it until
 * none of `avoid` is under it, inside the picture. Placed when it appears, when the HUD's pieces move (`version`), and
 * when the window changes; never every frame.
 */
export function placeDown(engine: SigilEngine, el: HTMLElement, avoid: readonly string[], self = ''): void {
  const r = engine.renderer as SigilEngine['renderer'] | undefined;
  const box = natural(engine, el);
  if (!r || !box) return;
  const dy = slideClear(box, taken(engine, avoid, self), r.viewH * SLIDE_LIMIT);
  shift(engine, el, keepInside({ ...box, y: box.y + dy }, 8, r.viewW - 8), dy, self);
}

/**
 * Places a lesson over the button it teaches: inside the picture side to side (its arrow stays over the button:
 * `--rb-arrow-dx` moves it back by as much), and up off the other buttons and the HUD if it lies across them.
 */
export function placeLesson(engine: SigilEngine, el: HTMLElement, avoid: readonly string[], buttons: readonly HTMLElement[] = []): void {
  const r = engine.renderer as SigilEngine['renderer'] | undefined;
  const box = natural(engine, el);
  if (!r || !box) return;
  const dx = keepInside(box, 8, r.viewW - 8);
  const moved = { ...box, x: box.x + dx };
  const pressed = buttons.flatMap((b) => hudBoxOf(r.canvas, b, r.viewW, r.viewH) ?? []);
  const dy = slideClear(moved, [...taken(engine, avoid, 'teach'), ...pressed], r.viewH * 0.12, -1);
  shift(engine, el, dx, dy, 'teach');
  // (the arrow is drawn in the lesson's own pixels, which a mirrored cluster turns round once more for the words)
  const k = scaleOf(engine, el);
  el.style.setProperty('--rb-arrow-dx', `${Math.round(-dx / k.x)}px`);
}

/**
 * Keeps an element placed by `place` while it is on the screen: when it is drawn, when the HUD's pieces move, and
 * when the window changes size.
 */
export function usePlaced(engine: SigilEngine, ref: RefObject<HTMLElement | null>, place: (el: HTMLElement) => void, key: unknown): void {
  const placeRef = useRef(place);
  useLayoutEffect(() => {
    placeRef.current = place;
    if (ref.current) place(ref.current);
  });
  useEffect(() => {
    const again = (): void => {
      if (ref.current) placeRef.current(ref.current);
    };
    const r = engine.renderer as SigilEngine['renderer'] | undefined;
    const off = r?.onHudMoved(again);
    window.addEventListener('resize', again);
    // (what comes in moving is placed again once it has come: it was measured mid-way)
    const el = ref.current;
    el?.addEventListener('animationend', again);
    return () => {
      off?.();
      window.removeEventListener('resize', again);
      el?.removeEventListener('animationend', again);
    };
  }, [engine, ref, key]);
}
