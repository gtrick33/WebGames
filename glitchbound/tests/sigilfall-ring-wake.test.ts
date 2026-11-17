/**
 * The Gloamknight's wake, after the owner, 2026-11-17: "gloamknight nightblade spec - theres a jittering orbs around
 * the character when theyre moving, fix it". The puffs of dark left behind as he runs were counted by their place in
 * the list: each time the oldest went, every puff took the shape of the one before it and the small dark orbs at head
 * height hopped from one puff to the next, a flicker about him on every step. Each puff is its own now, from the
 * moment it is laid to the moment it is gone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { newWake, trailWake, WAKE_GAP, WAKE_IN, wakeBlobs } from '../src/games/sigilfall/render/ring';

const FRAME = 1 / 60;

/** Runs a wake along a path for `seconds`, a frame at a time, and hands back what was drawn each frame. */
function run(at: (t: number) => { x: number; y: number }, seconds: number, life = 0.32): ReturnType<typeof wakeBlobs>[] {
  const p0 = at(0);
  const w = newWake(p0.x, p0.y);
  const frames: ReturnType<typeof wakeBlobs>[] = [];
  for (let t = 0; t <= seconds; t += FRAME) {
    const p = at(t);
    trailWake(w, p.x, p.y, t, life);
    frames.push(wakeBlobs(w, t));
  }
  return frames;
}

/** A Nightblade running at a little over a walk, east. */
const east = (t: number): { x: number; y: number } => ({ x: 100 + t * 70, y: 120 });

describe('The Ring: the Gloamknight’s wake holds still while he runs', () => {
  it('each puff stays where it was laid, keeps its shape, and the orbs over them never hop from one to another', () => {
    const frames = run(east, 3);
    const seen = new Map<string, { x: number; y: number; seed: number; high: boolean }>();
    let compared = 0;
    for (const blobs of frames) {
      for (const b of blobs) {
        const key = `${b.n}-${b.high}`;
        const was = seen.get(key);
        if (was) {
          compared++;
          expect(b.x).toBe(was.x);
          expect(b.y).toBe(was.y);
          expect(b.seed).toBe(was.seed);
        } else seen.set(key, { x: b.x, y: b.y, seed: b.seed, high: b.high });
      }
    }
    expect(compared).toBeGreaterThan(200);
    // (the high orbs belong to every other puff by its own count, so the same puffs carry them from start to end)
    for (const [key, v] of seen) if (v.high) expect(Number(key.split('-')[0]) % 2).toBe(0);
  });

  it('a puff comes up and goes away smoothly: nothing appears or vanishes whole from one frame to the next', () => {
    const frames = run(east, 3);
    const last = new Map<string, number>();
    for (const blobs of frames) {
      const now = new Map(blobs.map((b) => [`${b.n}-${b.high}`, b.alpha]));
      for (const [key, a] of now) {
        const before = last.get(key);
        // (a new one starts faint; one already up changes by a little a frame)
        if (before === undefined) expect(a).toBeLessThan(0.3);
        else expect(Math.abs(a - before)).toBeLessThan(0.25);
      }
      // (one that was drawn and is no more was all but faded already)
      for (const [key, a] of last) if (!now.has(key)) expect(a).toBeLessThan(0.1);
      last.clear();
      for (const [k, a] of now) last.set(k, a);
    }
    expect(WAKE_IN).toBeGreaterThan(FRAME * 3);
  });

  it('the puffs are laid evenly along the way, however long or short a frame was', () => {
    const w = newWake(0, 0);
    // (a long frame, then several short ones)
    trailWake(w, 23, 0, 0.1, 0.32);
    trailWake(w, 24, 0, 0.11, 0.32);
    trailWake(w, 31, 0, 0.12, 0.32);
    const xs = w.puffs.map((p) => p.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(WAKE_GAP, 6);
    expect(w.puffs.map((p) => p.n)).toEqual(xs.map((_, i) => i));
  });

  it('standing still, swinging or not, lays nothing: a blow’s step is not a way gone', () => {
    const frames = run(() => ({ x: 150, y: 90 }), 2);
    expect(frames.every((b) => b.length === 0)).toBe(true);
    // (it is laid from the rules' spot, not from where a blow carries the body)
    const ring = fs.readFileSync(path.resolve(__dirname, '../src/games/sigilfall/render/ring.ts'), 'utf8');
    expect(ring).toContain('trailWake(wake, f.x, f.y, time,');
  });

  it('a step out of the dark at someone’s back starts the wake again where he comes out, with nothing laid across the gap', () => {
    const w = newWake(100, 100);
    trailWake(w, 106, 100, 0, 0.32);
    const before = w.puffs.length;
    trailWake(w, 220, 140, 0.02, 0.32);
    expect(w.puffs.length).toBe(before);
    expect([w.x, w.y]).toEqual([220, 140]);
  });

  it('a puff laid in a lunge keeps its longer life when the lunge is over', () => {
    const w = newWake(0, 0);
    trailWake(w, 6, 0, 0, 0.5);
    trailWake(w, 6, 0, 0.4, 0.32);
    expect(wakeBlobs(w, 0.4).length).toBeGreaterThan(0);
  });
});
