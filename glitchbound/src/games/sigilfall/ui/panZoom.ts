import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isTurned } from './turn';

/**
 * Pan and zoom over a map `w`×`h` units big, shown in an element: the wheel and a pinch zoom round the point
 * under them, a drag pans, and the buttons zoom round the middle. At zoom 1 the whole map fits. A drag never
 * counts as a click on what is under it (a land on the world map).
 *
 * A finger's drag the map can't take (it is zoomed all the way out, or already at its edge that way) scrolls the
 * window the map is in instead. The map covers most of its window on a phone and takes every touch on it, so the
 * window scrolled only from the strip of frame beside it (the owner: "the map cant be scrolled up and down with
 * fingers unless i explicitly scroll on the brown side of the pop up").
 */

/** The nearest box round `node` that scrolls up and down, if any. */
function scroller(node: HTMLElement): HTMLElement | null {
  for (let p = node.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}

export interface View {
  /** Zoom: 1 is the whole map in the element. */
  k: number;
  /** The map point (in its units) at the element's middle. */
  cx: number;
  cy: number;
}

export interface PanZoom {
  /** The view (null until the element has a size). */
  view: View | null;
  /** The element's size in css px. */
  vw: number;
  vh: number;
  /** Css px a map unit at this zoom. */
  scale: number;
  zoomBy: (f: number) => void;
  /** Back to the whole map. */
  fitAll: () => void;
  /** A press that moved (a drag): the click after it is not a click. */
  dragged: () => boolean;
}

/** `start` gives the view until the map is zoomed or moved (from the css px a unit at zoom 1). */
export function usePanZoom(el: RefObject<HTMLElement | null>, w: number, h: number, maxK: number, start: (fit: number) => View): PanZoom {
  const [size, setSize] = useState({ vw: 0, vh: 0 });
  // (a view kept for another map is not this one's)
  const key = `${w}x${h}`;
  const [raw, setRaw] = useState<{ key: string; v: View } | null>(null);
  const fit = size.vw && size.vh ? Math.min(size.vw / w, size.vh / h) : 0;

  const clamp = useCallback(
    (v: View): View => {
      const k = Math.min(maxK, Math.max(1, v.k));
      const s = fit * k;
      // the map's edge stays at the element's (or, when it is narrower than the element, it sits in the middle)
      const hw = size.vw / 2 / s;
      const hh = size.vh / 2 / s;
      const cx = hw * 2 >= w ? w / 2 : Math.min(w - hw, Math.max(hw, v.cx));
      const cy = hh * 2 >= h ? h / 2 : Math.min(h - hh, Math.max(hh, v.cy));
      return { k, cx, cy };
    },
    [fit, size.vw, size.vh, w, h, maxK],
  );
  const view = fit ? clamp(raw?.key === key ? raw.v : start(fit)) : null;

  // what the handlers work from (kept up to date after each render)
  const live = useRef({ view, fit, vw: size.vw, vh: size.vh, clamp, key });
  useEffect(() => {
    live.current = { view, fit, vw: size.vw, vh: size.vh, clamp, key };
  });

  // the element's size, kept up to date
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const measure = (): void => setSize((o) => (o.vw === node.clientWidth && o.vh === node.clientHeight ? o : { vw: node.clientWidth, vh: node.clientHeight }));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [el]);

  /** Zooms by `f` keeping the map point under (px, py) (css px in the element) where it is. */
  const zoomAt = useCallback((px: number, py: number, f: number): void => {
    const { view: v, fit: fit0, vw, vh, clamp: fix, key: at } = live.current;
    if (!v || !fit0) return;
    const s = fit0 * v.k;
    const ux = v.cx + (px - vw / 2) / s;
    const uy = v.cy + (py - vh / 2) / s;
    const k = fix({ ...v, k: v.k * f }).k;
    const s2 = fit0 * k;
    const to = fix({ k, cx: ux - (px - vw / 2) / s2, cy: uy - (py - vh / 2) / s2 });
    live.current = { ...live.current, view: to };
    setRaw({ key: at, v: to });
  }, []);

  const moved = useRef(0);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const local = (e: { clientX: number; clientY: number }): [number, number] => {
      const r = node.getBoundingClientRect();
      // (the game may be turned a quarter turn into a portrait screen, ui/turn.ts: the element's x runs down it)
      return isTurned() ? [e.clientY - r.top, r.right - e.clientX] : [e.clientX - r.left, e.clientY - r.top];
    };
    const wheel = (e: WheelEvent): void => {
      e.preventDefault();
      const [x, y] = local(e);
      zoomAt(x, y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
    };
    const pts = new Map<number, [number, number]>();
    const down = (e: PointerEvent): void => {
      // (the zoom buttons are pressed, not dragged)
      if (e.button > 0 || (e.target instanceof Element && e.target.closest('button'))) return;
      if (!pts.size) moved.current = 0;
      pts.set(e.pointerId, local(e));
    };
    const move = (e: PointerEvent): void => {
      const was = pts.get(e.pointerId);
      if (!was) return;
      const now = local(e);
      const { view: v, fit: fit0, clamp: fix, key: at } = live.current;
      if (!v || !fit0) return;
      if (pts.size === 1) {
        const dx = now[0] - was[0];
        const dy = now[1] - was[1];
        moved.current += Math.abs(dx) + Math.abs(dy);
        // (a press that hasn't moved yet stays a click)
        if (moved.current > 5) {
          if (!node.hasPointerCapture(e.pointerId)) node.setPointerCapture(e.pointerId);
          const s = fit0 * v.k;
          const to = fix({ ...v, cx: v.cx - dx / s, cy: v.cy - dy / s });
          live.current = { ...live.current, view: to };
          setRaw({ key: at, v: to });
          // (what of a finger's drag up or down the map couldn't take goes to the window: it scrolls)
          const left = dy + (to.cy - v.cy) * s;
          if (e.pointerType !== 'mouse' && Math.abs(left) > 0.5) {
            const box = scroller(node);
            if (box) {
              const before = box.scrollTop;
              box.scrollTop = before - left;
              // (the map moved under the finger with the window: where the finger is on it now)
              pts.set(e.pointerId, [now[0], now[1] + box.scrollTop - before]);
              return;
            }
          }
        }
      } else if (pts.size === 2) {
        const other = [...pts.entries()].find(([id]) => id !== e.pointerId)?.[1];
        if (other) {
          const d0 = Math.hypot(was[0] - other[0], was[1] - other[1]);
          const d1 = Math.hypot(now[0] - other[0], now[1] - other[1]);
          moved.current += 10;
          if (d0 > 4) zoomAt((now[0] + other[0]) / 2, (now[1] + other[1]) / 2, d1 / d0);
        }
      }
      pts.set(e.pointerId, now);
    };
    const up = (e: PointerEvent): void => {
      pts.delete(e.pointerId);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    return () => {
      node.removeEventListener('wheel', wheel);
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    };
  }, [el, zoomAt]);

  return {
    view,
    vw: size.vw,
    vh: size.vh,
    scale: view ? fit * view.k : 0,
    zoomBy: (f) => zoomAt(size.vw / 2, size.vh / 2, f),
    fitAll: () => setRaw({ key, v: { k: 1, cx: w / 2, cy: h / 2 } }),
    dragged: () => moved.current > 5,
  };
}
