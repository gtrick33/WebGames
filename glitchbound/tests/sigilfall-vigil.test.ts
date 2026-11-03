/** The Vigil's simulation (vigil/sim.ts): the Host, the spells and the choices, without drawing anything. */
import { describe, expect, it } from 'vitest';
import { BOSS_EVERY, MAX_SPELL, SPELLS, STRENGTHS } from '../src/games/sigilfall/vigil/kit';
import { MAX_FOES, Vigil, xpForLevel, type VigilInput } from '../src/games/sigilfall/vigil/sim';

const STILL: VigilInput = { mx: 0, my: 0 };

/** A plain player: walks away from the nearest foes in wide circles and takes the first card it is offered. */
function bot(v: Vigil, t: number): VigilInput {
  if (v.cards) v.choose(0);
  let ax = 0;
  let ay = 0;
  for (const f of v.foes) {
    const d = Math.hypot(v.x - f.x, v.y - f.y) || 1;
    if (d < 70) {
      ax += (v.x - f.x) / d / d;
      ay += (v.y - f.y) / d / d;
    }
  }
  // drawn to the nearest spark, when it is safe to go
  let sx = 0;
  let sy = 0;
  let sd = 160;
  for (const g of v.sparks) {
    const d = Math.hypot(g.x - v.x, g.y - v.y);
    if (d < sd) {
      sd = d;
      sx = (g.x - v.x) / (d || 1);
      sy = (g.y - v.y) / (d || 1);
    }
  }
  const circle = t * 0.5;
  return { mx: ax * 40 + sx * 0.7 + Math.cos(circle) * 0.3, my: ay * 40 + sy * 0.7 + Math.sin(circle) * 0.3 };
}

function run(seed: number, seconds: number, input: (v: Vigil, t: number) => VigilInput, pick = true): Vigil {
  const v = new Vigil(seed, 2000, 2000);
  for (let t = 0; t < seconds && !v.over; t += 1 / 30) {
    if (pick && v.cards) v.choose(0);
    v.step(1 / 30, input(v, t));
  }
  return v;
}

describe('The Vigil', () => {
  it('the same seed and input play the same night', () => {
    const a = run(5, 90, bot);
    const b = run(5, 90, bot);
    expect(a.kills).toBe(b.kills);
    expect(a.level).toBe(b.level);
    expect(a.x).toBe(b.x);
    expect(run(6, 90, bot).kills).not.toBe(a.kills);
  });

  it('standing still gets you killed, and quite soon', () => {
    const v = run(1, 600, () => STILL);
    expect(v.over).toBe(true);
    expect(v.t).toBeLessThan(420);
  });

  // A floor and a ceiling, not the feel: this bot takes whatever card comes first, so a person should last far longer.
  it('even a poor player gets a couple of minutes and several levels, and the Host always wins in the end', () => {
    const times: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const v = run(seed, 40 * 60, bot);
      expect(v.over, `seed ${seed} survived 40 minutes`).toBe(true);
      expect(v.level).toBeGreaterThanOrEqual(5);
      expect(v.kills).toBeGreaterThan(50);
      times.push(v.t);
    }
    const median = [...times].sort((a, b) => a - b)[2]!;
    expect(median).toBeGreaterThan(90);
    expect(median).toBeLessThan(30 * 60);
  }, 120_000);

  it('a level offers three different cards and stops the night until you choose', () => {
    const v = new Vigil(2, 2000, 2000);
    v.owed = 1;
    v.step(1 / 30, STILL);
    expect(v.cards).toHaveLength(3);
    const key = (c: NonNullable<typeof v.cards>[number]) => JSON.stringify(c);
    expect(new Set(v.cards!.map(key)).size).toBe(3);
    const t = v.t;
    v.step(1, STILL);
    expect(v.t).toBe(t);
    v.choose(1);
    expect(v.cards).toBeNull();
    v.step(1 / 30, STILL);
    expect(v.t).toBeGreaterThan(t);
  });

  it('early on a new spell is always among the cards', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const v = new Vigil(seed, 2000, 2000);
      v.owed = 1;
      v.step(1 / 30, STILL);
      expect(v.cards!.some((c) => c.kind === 'spell' && c.level === 1)).toBe(true);
    }
  });

  it('a frame stamped before the run began does no harm (a browser’s first frame can be)', () => {
    const v = new Vigil(1, 2000, 2000);
    v.step(-0.02, STILL);
    v.step(Number.NaN, STILL);
    expect(v.t).toBe(0);
    for (let i = 0; i < 30 * 40; i++) {
      if (v.cards) v.choose(0);
      v.step(1 / 30, STILL);
    }
    expect(v.foes.length + v.kills).toBeGreaterThan(5);
  });

  it('rerolls are limited', () => {
    const v = new Vigil(2, 2000, 2000);
    v.owed = 1;
    v.step(1 / 30, STILL);
    for (let i = 0; i < 3; i++) v.reroll();
    expect(v.rerolls).toBe(0);
    const before = v.cards;
    v.reroll();
    expect(v.cards).toBe(before);
  });

  it('a spell at its top with the right strength evolves, once, and is always offered', () => {
    const v = new Vigil(2, 2000, 2000);
    v.spells['ember-bolt'] = MAX_SPELL;
    v.strengths.haste = 3;
    v.owed = 1;
    v.step(1 / 30, STILL);
    const i = v.cards!.findIndex((c) => c.kind === 'spell' && c.evolve);
    expect(i).toBeGreaterThanOrEqual(0);
    v.choose(i);
    expect(v.evolved.has('ember-bolt')).toBe(true);
    v.owed = 1;
    v.step(1 / 30, STILL);
    expect(v.cards!.some((c) => c.kind === 'spell' && c.id === 'ember-bolt')).toBe(false);
  });

  it('a full collection still gives something when there is nothing left to take', () => {
    const v = new Vigil(2, 2000, 2000);
    for (const id of Object.keys(SPELLS) as (keyof typeof SPELLS)[]) {
      v.spells[id] = MAX_SPELL;
      v.evolved.add(id);
    }
    for (const id of Object.keys(STRENGTHS) as (keyof typeof STRENGTHS)[]) v.strengths[id] = 5;
    v.hp = 10;
    v.owed = 1;
    v.step(1 / 30, STILL);
    expect(v.cards).toEqual([{ kind: 'heal' }]);
    v.choose(0);
    expect(v.hp).toBeGreaterThan(10);
  });

  it('champions come on the clock, and a champion’s fall is a free choice', () => {
    const v = new Vigil(3, 2000, 2000);
    v.hp = 1e9;
    v.t = BOSS_EVERY - 0.1;
    for (let i = 0; i < 6; i++) v.step(1 / 30, STILL);
    const boss = v.foes.find((f) => f.boss);
    expect(boss).toBeTruthy();
    expect(v.banner?.text).toContain(boss!.boss!);
    const owed = v.owed;
    boss!.hp = 1;
    (v as unknown as { hurt(f: unknown, d: number): void }).hurt(boss, 5);
    expect(v.owed).toBe(owed + 1);
  });

  it('never holds more foes than it can afford, and a heavy frame stays cheap', () => {
    const v = new Vigil(4, 2000, 2000);
    v.hp = 1e12;
    v.spells = { 'ember-bolt': 5, 'frost-ring': 5, 'chain-spark': 5, 'orbit-motes': 5, meteor: 5 };
    let most = 0;
    for (let t = 0; t < 900; t += 1 / 10) {
      if (v.cards) v.choose(0);
      v.step(1 / 10, STILL);
      most = Math.max(most, v.foes.length);
    }
    expect(most).toBeLessThanOrEqual(MAX_FOES + 5);
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      if (v.cards) v.choose(0);
      v.step(1 / 60, { mx: 1, my: 0 });
    }
    // well inside a frame on this machine, leaving room for a phone and for drawing
    expect((performance.now() - t0) / 60).toBeLessThan(8);
  }, 60_000);

  it('levels cost more as they go', () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(30)).toBeGreaterThan(xpForLevel(10) * 2);
  });

  it('walls stop the hero, and the map’s edge holds', () => {
    const v = new Vigil(1, 100, 100, (x) => x > 110, { x0: 0, y0: 0, x1: 200, y1: 200 });
    for (let i = 0; i < 60; i++) v.step(1 / 30, { mx: 1, my: 0 });
    expect(v.x).toBeLessThanOrEqual(110.5);
    for (let i = 0; i < 300; i++) v.step(1 / 30, { mx: 0, my: -1 });
    expect(v.y).toBe(0);
  });
});
