/**
 * How the warlock's ashbound dead (Call the Ashbound) are drawn in the Ring: which model, and which of its clips it
 * plays. Kept apart from ring3d.ts so the choice can be tested without a picture.
 *
 * They were the barrows' little skeleton (`barrow-skeleton`, the model `sk_minion`), played with its slow `walk`. The
 * rules move the dead at nine tenths of a hero's run, so that walk's short steps slid over the ground at more than
 * twice the pace they were made for, and from the Ring's high camera the minion's great skull hides its short arms
 * and legs: the owner saw them "floating and not animated". Now they are the Ashen Host's skeleton soldier (`skeleton`,
 * the model `sk_warrior`, with sword and shield, made on the heroes' own rig), standing on its own feet at its spot, running
 * as a hero runs, and cutting at every claw the rules land.
 */

/** The creature they are (render3d/kits.ts). */
export const THRALL_SPRITE = 'skeleton';
/** The clip they move with: a hero's run, for they move nearly as fast as one. */
export const THRALL_RUN = 'run';
/** Their blows, one after the other: a cut down from overhead, then a slice back across. */
export const THRALL_BLOWS = ['chop2', 'slice'] as const;
/** How long a blow is shown for, in seconds (the dead claw every 1.25 seconds). */
export const THRALL_BLOW_T = 0.55;
/** How far a blow carries one into it, in world pixels. */
export const THRALL_LUNGE = 6;
/** How high the cold light in its skull is drawn, in world pixels over the ground. */
export const THRALL_EYES = 17;

export interface ThrallPose {
  /** null: the blow under way plays on. */
  clip: string | null;
  loop: boolean;
  /** A new blow starts this frame: its clip from the top (from where its strike begins). */
  blow: boolean;
}

/**
 * What one of the dead plays now. `seen` is how many blows it had struck when last drawn and `hits` how many it has
 * struck now (Pet.hits, counted by the rules at each claw); `swinging`: a blow is still playing out.
 */
export function thrallPose(seen: number, hits: number, swinging: boolean, dead: boolean, held: boolean, moving: boolean): ThrallPose {
  if (dead) return { clip: 'die', loop: false, blow: false };
  if (hits > seen) return { clip: THRALL_BLOWS[(hits - 1) % THRALL_BLOWS.length]!, loop: false, blow: true };
  if (swinging) return { clip: null, loop: false, blow: false };
  if (held) return { clip: 'hit', loop: true, blow: false };
  return { clip: moving ? THRALL_RUN : 'idle', loop: true, blow: false };
}
