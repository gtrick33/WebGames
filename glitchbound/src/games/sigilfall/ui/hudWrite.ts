/**
 * Writing to the HUD from the frame loop.
 *
 * The HUD's numbers and flags are set once a frame, straight onto the page (no React render per frame). But setting
 * an element's text takes its old text away and puts new text in, even when the words are the same, and the browser
 * then lays that part of the page out and paints it again. With the hero standing still and nothing changing, the
 * HUD was doing that in seven places every frame (nine in a Rift, with its clock): the page was laid out and painted
 * sixty times a second under a picture that had not moved. These write only what has changed.
 */

/** Sets an element's words, if they aren't its words already. */
export function say(el: Element | null | undefined, text: string): void {
  if (!el) return;
  const first = el.firstChild;
  // (one piece of text, as the HUD's all are: read as it stands, without gathering up everything under the element)
  if (first ? !first.nextSibling && first.nodeType === 3 && (first as Text).data === text : text === '') return;
  el.textContent = text;
}

/** Hides or shows an element, if it isn't so already. */
export function hide(el: HTMLElement | null | undefined, hidden: boolean): void {
  if (el && el.hidden !== hidden) el.hidden = hidden;
}

/**
 * A share (0 to 1) as a CSS percentage in steps of a quarter of one. A bar that creeps (a Rift's clock over four
 * minutes, mana coming back, a cooldown's sweep) was given a new size on every frame, each one a layout, for a
 * change far smaller than a pixel: in quarter steps it is given one a few hundred times over its whole length.
 */
export function part(k: number): string {
  // (nothing of nothing, 0 / 0, is an empty bar)
  return `${Math.round(Math.max(0, Math.min(1, k || 0)) * 400) / 4}%`;
}
