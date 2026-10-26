import { clamp } from '../core/math';

/**
 * The camera, as pure arithmetic (the renderer applies it; tests replay it frame by frame).
 *
 * It sits on the hero's art pixel plus a smoothed lean, kept to the nearest device pixel. The world
 * is drawn from the art pixel at or below it and the canvas slides by the remainder with a CSS
 * transform, so the lean glides one device pixel at a time instead of jumping a whole world pixel
 * (DETAIL × scale device pixels) whenever it crossed one.
 */

/** How far the view leans ahead of the hero, in world pixels. */
export const LEAD = 14;
/** The view sits this far above the hero by default, so more of what is ahead (and above) shows. */
export const LIFT = -8;

/**
 * Where the camera wants to lean. With a mouse this comes from where the cursor is on the screen
 * (`pointer`, -0.5 to 0.5 from the view's center), never from the aim in the world: the aim is
 * measured from the camera, so leaning on it fed every camera move back into the next one and the view
 * shivered as the mouse went round the hero. Touch aims with the stick, which the camera can't move,
 * so it leans on the aim angle.
 */
export function leanTarget(pointer: { x: number; y: number } | null, aim: number, lead: number): { x: number; y: number } {
  if (pointer) {
    // nothing near the middle of the screen, the full lead toward an edge
    const nx = pointer.x * 2;
    const ny = pointer.y * 2;
    const len = Math.hypot(nx, ny);
    const k = len > 0.2 ? Math.min(1, (len - 0.2) / 0.8) / len : 0;
    return { x: nx * k * lead * 1.3, y: ny * k * lead * 0.9 + LIFT };
  }
  return { x: Math.cos(aim) * lead, y: Math.sin(aim) * lead * 0.7 + LIFT };
}

export interface CameraPlace {
  /** The camera's top-left in world pixels (a whole number of device pixels). */
  camX: number;
  camY: number;
  /** Where the world is drawn from: the camera rounded down to an art pixel. */
  drawX: number;
  drawY: number;
  /** The rest, in device pixels: the canvas slides left and up by this much. */
  slideX: number;
  slideY: number;
}

/**
 * Places the camera. `hx, hy` is the hero in world pixels, `lean` the smoothed lean, `viewW, viewH`
 * what is on screen in world pixels, `detail` art pixels per world pixel and `scale` device pixels per
 * art pixel.
 */
export function placeCamera(
  hx: number,
  hy: number,
  lean: { x: number; y: number },
  viewW: number,
  viewH: number,
  mapW: number,
  mapH: number,
  detail: number,
  scale: number,
): CameraPlace {
  const q = detail * scale;
  // the hero's art pixel: the camera is pinned to it, so the hero never wobbles against the screen
  const ax = Math.round(hx * detail) / detail;
  const ay = Math.round(hy * detail) / detail;
  const x = ax + Math.round((lean.x - viewW / 2) * q) / q;
  const y = ay + Math.round((lean.y - viewH / 2) * q) / q;
  const camX = mapW <= viewW ? Math.round((mapW - viewW) / 2) : clamp(x, 0, mapW - viewW);
  const camY = mapH <= viewH ? Math.round((mapH - viewH) / 2) : clamp(y, 0, mapH - viewH);
  const drawX = Math.floor(camX * detail + 1e-6) / detail;
  const drawY = Math.floor(camY * detail + 1e-6) / detail;
  return { camX, camY, drawX, drawY, slideX: Math.round((camX - drawX) * q), slideY: Math.round((camY - drawY) * q) };
}
