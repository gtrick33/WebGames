/**
 * The computer's fighters, a little more like people (the owner, 2026-11-18): "make the bots act a bit more like
 * humans, smoother movements, toughen up with higer rate (as they are right now), however make the movements and spell
 * choices as human as possible, also make the nicknames random please, to feel like real players".
 */
import { describe, expect, it } from 'vitest';
import { newBrain, smoothFeet } from '../src/games/sigilfall/arena/bot';
import { BOT_NAMES, drawOpponents, nameFor } from '../src/games/sigilfall/arena/ladder';
import { nextLook } from '../src/games/sigilfall/arena/tactics';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { Fighter } from '../src/games/sigilfall/arena/sim';

const STEP = 1 / 60;

describe('The Ring’s computer players move like people', () => {
  it('turn round over a moment, not in a frame', () => {
    const b = newBrain(7);
    for (let i = 0; i < 60; i++) smoothFeet(b, { mx: 1, my: 0 }, STEP, 0.8);
    const first = smoothFeet(b, { mx: -1, my: 0 }, STEP, 0.8);
    expect(first.mx).toBeGreaterThan(0.6);
    let frames = 1;
    while (smoothFeet(b, { mx: -1, my: 0 }, STEP, 0.8).mx > -0.5) frames++;
    expect(frames).toBeGreaterThan(4);
    expect(frames).toBeLessThan(20);
  });

  it('a reflex still answers at once: stepping out from under what is falling', () => {
    const b = newBrain(7);
    for (let i = 0; i < 60; i++) smoothFeet(b, { mx: 1, my: 0 }, STEP, 0.8);
    b.urgent = 0.3;
    smoothFeet(b, { mx: 0, my: 1 }, STEP, 0.8);
    smoothFeet(b, { mx: 0, my: 1 }, STEP, 0.8);
    const v = smoothFeet(b, { mx: 0, my: 1 }, STEP, 0.8);
    expect(v.my).toBeGreaterThan(0.6);
  });

  it('a walk is never quite straight, and never faster than a person walks', () => {
    const b = newBrain(3);
    const seen: number[] = [];
    for (let i = 0; i < 240; i++) {
      const v = smoothFeet(b, { mx: 1, my: 0 }, STEP, 0.5);
      seen.push(v.my);
      expect(Math.hypot(v.mx, v.my)).toBeLessThanOrEqual(1.0001);
    }
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(0.1);
  });

  it('presses the next button a varying moment after it is back, about as quickly as before on average', () => {
    const f = { gcd: 1, cast: null } as unknown as Fighter;
    const waits = [0, 0.25, 0.5, 0.75, 0.999].map((r) => nextLook(f, 9, 1, r));
    expect(new Set(waits.map((w) => w.toFixed(3))).size).toBe(5);
    expect(waits.reduce((a, b) => a + b, 0) / waits.length - 1).toBeCloseTo(0.065, 2);
  });
});

describe('The Ring’s computer players go by handles', () => {
  it('a pool of handles, none twice, none of them the old storybook names', () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(BOT_NAMES).size).toBe(BOT_NAMES.length);
    for (const n of BOT_NAMES) expect(n, n).toMatch(/^[A-Za-z0-9_]{3,16}$/);
    for (const old of ['Brannoch', 'Sister Maud', 'Ser Galen', 'Quill']) expect(BOT_NAMES).not.toContain(old);
  });

  it('every class draws from all of it, and the teams drawn are varied', () => {
    for (const cls of CLASS_IDS) expect(new Set(Array.from({ length: 400 }, (_, i) => nameFor(cls, i))).size, cls).toBeGreaterThan(80);
    const names = new Set<string>();
    for (let seed = 0; seed < 60; seed++) for (const f of drawOpponents(3, seed).fighters) names.add(f.name);
    expect(names.size).toBeGreaterThan(60);
  });
});
