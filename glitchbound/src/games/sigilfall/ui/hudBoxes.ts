import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { SigilEngine } from '../engine';
import type { ViewBox } from '../render/speech';

/** A box of the HUD in the view's own CSS pixels (the same pixels the picture's words are laid out in). */
export type HudBox = ViewBox;

/**
 * Where an element of the HUD sits over the picture. Measured against the canvas, so it holds whatever the page does
 * round the game; on an upright phone the game is laid out on its side and turned a quarter (Game.css `.is-turned`:
 * the game's top is the screen's right), and the screen's box is turned back.
 */
export function hudBoxOf(canvas: HTMLElement, el: HTMLElement, viewW: number, viewH: number): HudBox | null {
  const c = canvas.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  if (!(c.width > 0 && c.height > 0 && e.width > 0 && e.height > 0)) return null;
  if (canvas.parentElement?.classList.contains('is-turned')) {
    const kx = viewW / c.height;
    const ky = viewH / c.width;
    return { x: (e.top - c.top) * kx, y: (c.right - e.right) * ky, w: e.height * kx, h: e.width * ky };
  }
  const kx = viewW / c.width;
  const ky = viewH / c.height;
  return { x: (e.left - c.left) * kx, y: (e.top - c.top) * ky, w: e.width * kx, h: e.height * ky };
}

/**
 * Tells the renderer where a piece of the HUD is (render/renderer.ts `hudBoxes`), for as long as it is on the screen:
 * the picture's own words (a spoken line, a caption over the hero) and the HUD then know when they would sit on each
 * other. Measured when the HUD is drawn again, when the piece changes size (shown, hidden, folded) and when the
 * window does: never every frame, which would lay the page out sixty times a second.
 */
export function useHudBox(engine: SigilEngine, id: string, ref: RefObject<HTMLElement | null>): void {
  const watch = useRef<{ ro: ResizeObserver | null; el: HTMLElement | null }>({ ro: null, el: null });
  const measure = (): void => {
    const el = ref.current;
    // (a HUD drawn with no picture under it, as the tests draw one, has nothing to tell)
    const r = engine.renderer as SigilEngine['renderer'] | undefined;
    if (!r) return;
    r.setHudBox(id, el ? hudBoxOf(r.canvas, el, r.viewW, r.viewH) : null);
  };
  const measureRef = useRef(measure);
  const measureLater = useRef((): void => measureRef.current()).current;
  useLayoutEffect(() => {
    measureRef.current = measure;
    const w = watch.current;
    if (w.el !== ref.current) {
      w.ro?.disconnect();
      w.el?.removeEventListener('animationend', measureLater);
      w.el = ref.current;
      if (w.el && w.ro) w.ro.observe(w.el);
      // (a piece that comes in moving is where it will stay once it has come: measured again then)
      w.el?.addEventListener('animationend', measureLater);
    }
    measure();
  });
  useEffect(() => {
    const w = watch.current;
    const again = (): void => measureRef.current();
    if (typeof ResizeObserver !== 'undefined') {
      w.ro = new ResizeObserver(again);
      if (w.el) w.ro.observe(w.el);
      const canvas = (engine.renderer as SigilEngine['renderer'] | undefined)?.canvas;
      if (canvas) w.ro.observe(canvas);
    }
    window.addEventListener('resize', again);
    return () => {
      w.ro?.disconnect();
      w.ro = null;
      window.removeEventListener('resize', again);
      (engine.renderer as SigilEngine['renderer'] | undefined)?.setHudBox(id, null);
    };
  }, [engine, id]);
}
