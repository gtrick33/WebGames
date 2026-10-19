/**
 * The loop behind the catalogue's live previews (src/games/<slug>/Preview.tsx). A preview is a small
 * "attract mode", not the game: it runs at 30 fps, at most 1.5x pixels, only while its tile is on
 * screen, the tab is visible and the tile wants it `playing`; with reduced motion it shows one still
 * frame. Previews are lazy chunks, so this module never reaches the startup bundle.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

export interface PreviewScene {
  /**
   * Advance by `dt` seconds (at most 0.1) and draw. The context is scaled to CSS pixels and cleared to
   * nothing; `w` x `h` is the box in CSS pixels. Scenes that draw the canvas themselves (a game's own
   * renderer) can use `canvas` instead.
   */
  frame(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, canvas: HTMLCanvasElement): void;
}

const FRAME_MS = 1000 / 31;
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Whether a preview should be moving: on screen, tab visible, `playing`, and motion allowed. */
export function usePreviewActive(ref: RefObject<Element | null>, playing: boolean): boolean {
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // Only tiles mostly in view move, which keeps a scrolling grid cheap.
    const io = new IntersectionObserver(([e]) => setOnScreen(!!e && e.intersectionRatio >= 0.35), { threshold: [0, 0.35, 0.7] });
    io.observe(el);
    const onVis = (): void => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ref]);
  return onScreen && tabVisible && playing && !reducedMotion();
}

/**
 * Runs a canvas scene for a preview. Returns the ref for the <canvas>. `make` is called once; the scene
 * keeps its own state between frames.
 */
export function usePreviewCanvas(playing: boolean, make: () => PreviewScene): RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement>(null);
  const active = usePreviewActive(ref, playing);
  const scene = useRef<PreviewScene | null>(null);
  const box = useRef({ w: 0, h: 0, dpr: 1 });

  // Size the canvas to its box and draw a first frame (the only one with reduced motion).
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    scene.current ??= make();
    const fit = (): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      box.current = { w: Math.max(1, rect.width), h: Math.max(1, rect.height), dpr };
      canvas.width = Math.round(box.current.w * dpr);
      canvas.height = Math.round(box.current.h * dpr);
    };
    const still = (): void => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !scene.current) return;
      // A still frame shows the scene a little way in, not its empty first moment.
      for (let i = 0; i < (reducedMotion() ? 60 : 1); i++) draw(canvas, ctx, scene.current, box.current, 1 / 30);
    };
    fit();
    still();
    const ro = new ResizeObserver(() => {
      fit();
      const ctx = canvas.getContext('2d');
      if (ctx && scene.current) draw(canvas, ctx, scene.current, box.current, 0);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!active || !canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (scene.current) draw(canvas, ctx, scene.current, box.current, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return ref;
}

function draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, scene: PreviewScene, box: { w: number; h: number; dpr: number }, dt: number): void {
  ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
  ctx.clearRect(0, 0, box.w, box.h);
  scene.frame(ctx, box.w, box.h, dt, canvas);
}

// ------------------------------------------------------------------ drawing helpers shared by previews

export type C = CanvasRenderingContext2D;

/** A rounded rectangle path. */
export function rr(ctx: C, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

/** Fill the current path and outline it in ink. */
export function inked(ctx: C, fill: string, ink: string, lw: number): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = ink;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** The site's display face (canvas cannot read CSS variables). */
export const PREVIEW_FONT = '"Bricolage Grotesque", ui-rounded, system-ui, sans-serif';

/** Centered text in a heavy rounded face. */
export function label(ctx: C, text: string, x: number, y: number, size: number, color: string, weight = 900): void {
  ctx.font = `${weight} ${size}px ${PREVIEW_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** 0..1 eased in and out. */
export const ease = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
};

/** A seeded random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fits a w x h design into the box: the scale and offsets that center it (contain). */
export function fit(boxW: number, boxH: number, w: number, h: number): { k: number; x: number; y: number } {
  const k = Math.min(boxW / w, boxH / h);
  return { k, x: (boxW - w * k) / 2, y: (boxH - h * k) / 2 };
}
