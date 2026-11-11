/**
 * iPhone Safari while a game is pinned over the screen: the swipe up that tucks Safari's bar away only works while
 * the page under the game still has somewhere to scroll to. The page keeps a little room for that (GameStage.css),
 * but the room gets used up: once by the swipe itself, and once more when the player was already part of the way
 * down the page as they started. After that the bar came back out (a rotation, a tap on the clock, a trip to
 * another app) and the next swipe did nothing. So the page goes back to its top whenever the bar is out and nobody
 * is in the middle of swiping: there is always room for the next one.
 */

export interface BarsNow {
  /** Safari's bar is showing. */
  out: boolean;
  /** It was showing the last time anyone looked. */
  wasOut: boolean;
  /** A finger is on the screen. */
  touching: boolean;
  /** How far down the page is. */
  scrollY: number;
}

/**
 * Whether the page should go back to its top now.
 * - `because: 'bar'`: the bar's state was just looked at (a resize): back to the top when it has just come out.
 * - `because: 'lift'`: a finger has just left the screen: back to the top when the bar is still out, so that a swipe
 *   that ran out of room is followed by one that has it.
 * Never while a finger is down: that would pull the page out from under the swipe that is hiding the bar.
 */
export function shouldGoToTop(now: BarsNow, because: 'bar' | 'lift'): boolean {
  if (!now.out || now.touching || now.scrollY <= 0) return false;
  return because === 'lift' || !now.wasOut;
}
