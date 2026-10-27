/**
 * Landscape on a phone held upright (blueprint: "we don't want portrait view"). A phone can't be made to
 * rotate (iPhone Safari has no orientation lock), so when the game fills a portrait screen it turns itself
 * a quarter turn: `.rb.is-turned` is laid out landscape and rotated 90° into the screen, and the touch
 * controls read the fingers through the same turn (screen points and moves to the game's own axes).
 */

let turned: HTMLElement | null = null;

/** The game's root while it is turned (null when it isn't). */
export const setTurned = (el: HTMLElement | null): void => {
  turned = el;
};
export const isTurned = (): boolean => turned !== null;

/** A screen point in an element's own (unturned) box. */
export function toLocal(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  if (!turned) {
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }
  // the turned root's frame: its parent isn't turned; the root is rotated 90° clockwise about its corner
  const P = turned.parentElement!.getBoundingClientRect();
  const lx = clientY - P.top;
  const ly = P.left + P.width - clientX;
  let ox = 0;
  let oy = 0;
  for (let n: HTMLElement | null = el; n && n !== turned; n = n.offsetParent as HTMLElement | null) {
    ox += n.offsetLeft;
    oy += n.offsetTop;
  }
  return { x: lx - ox, y: ly - oy };
}

/** A finger's move on the screen in the game's own axes. */
export const toLocalDelta = (dx: number, dy: number): { x: number; y: number } => (turned ? { x: dy, y: -dx } : { x: dx, y: dy });
