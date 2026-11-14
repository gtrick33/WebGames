/**
 * How many pixels the 3D view draws, by how fast the machine keeps up (render3d/stage.ts).
 *
 * A machine that can't keep up draws fewer pixels rather than stutter (real time between frames; a tab left in the
 * background isn't a slow machine). It aims at a smooth sixty: anything under about fifty for three quarters of a
 * second takes a step down, and it comes back up only after twenty seconds at speed (the owner, at 2560 by 1440: "it
 * feels as if its capped by 30 fps or smth, i want it smooth").
 *
 * Each step down is a trial: if the frames come no faster with fewer pixels, the pixels weren't what held them back,
 * and the step is taken back. An iPhone in Low Power Mode is held at thirty frames a second however little it draws;
 * without the trial it stepped all the way down to the floor in five seconds and stayed there for good, and on a
 * phone's 3x screen the picture was drawn at under one pixel for every three the screen has, a blur under a sharp HUD.
 */

/** Slower than this between frames (about fifty a second), kept up, and the picture is drawn with fewer pixels. */
export const PACE_SLOW = 1 / 50;
/** The least share of the full picture it is drawn with. */
export const QUALITY_FLOOR = 0.45;
/** How far each step goes down. */
export const QUALITY_STEP = 0.15;
/** Frames a step down is given to show it helped. */
export const TRIAL_FRAMES = 60;
/** A step helped if the frames came at least this much faster for it. */
export const TRIAL_GAIN = 0.92;

export class Pacer {
  /** Share of the full pixel ratio drawn with. */
  quality = 1;
  /** The least `quality` may fall to (a phone's is higher: stage.ts). */
  floor = QUALITY_FLOOR;
  private avg = 1 / 60;
  private slow = 0;
  private fast = 0;
  /** A step down being tried: the pace before it, the quality it came from, the frames since. */
  private trial: { before: number; from: number; frames: number } | null = null;
  /** The pace that fewer pixels didn't help with (a frame-rate cap): no more steps down unless it gets worse. */
  private capped = 0;

  /** One frame, `dt` seconds after the last. True when `quality` changed. */
  tick(dt: number): boolean {
    if (!(dt > 0 && dt < 0.25)) return false;
    // (the pace over the last ten frames or so: one long frame is a hitch, not a slow machine)
    this.avg = this.avg * 0.9 + dt * 0.1;
    if (this.trial) {
      if (++this.trial.frames < TRIAL_FRAMES) return false;
      const t = this.trial;
      this.trial = null;
      this.slow = 0;
      this.fast = 0;
      if (this.avg < t.before * TRIAL_GAIN) return false;
      // no faster for fewer pixels: a cap, not a load. The picture goes back as it was
      this.capped = t.before;
      this.quality = t.from;
      return true;
    }
    if (this.avg < 1 / 55) this.fast++;
    else this.fast = 0;
    // (at speed again, or much slower than the cap was: whatever held it back has changed)
    if (this.capped && (this.fast > 120 || this.avg > this.capped * 1.25)) this.capped = 0;
    if (!this.capped && this.avg > PACE_SLOW) this.slow++;
    else this.slow = Math.max(0, this.slow - 2);
    if (this.slow > 40 && this.quality > this.floor + 1e-6) {
      this.trial = { before: this.avg, from: this.quality, frames: 0 };
      this.quality = Math.max(this.floor, this.quality - QUALITY_STEP);
      this.slow = 0;
      this.fast = 0;
      return true;
    }
    if (this.fast > 1200 && this.quality < 1) {
      this.quality = Math.min(1, this.quality + 0.1);
      this.fast = 0;
      return true;
    }
    return false;
  }
}
