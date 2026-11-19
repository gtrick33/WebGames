/**
 * A Riftstone run's clock keeps the world's time (sim/world.ts step). A hit-stop, the few frames a heavy blow holds the
 * world all but still, and slow motion, a boss's last blow, cost it nothing beyond the sliver of world time that passes
 * in them; a fall costs it in full, the clock running at full speed while the hero is down. A boss's fall costs the same
 * in a party, which has no slow motion; and in a party every clock reads the host's (tests/sigilfall-coop.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { SKILL_SLOTS } from '../src/games/sigilfall/data/types';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { emptyInput, HITSTOP, SLOW, World, type InputFrame } from '../src/games/sigilfall/sim/world';
import { readyHero } from './sigilfall-bot';

const DT = 1 / 60;

/** A level-60 warrior in epic gear on Riftstone +1 of the Crypt (alone, or leading a party). */
function keyRun(coop?: 'host'): World {
  const hero = readyHero('warrior', 60, 'epic');
  hero.keystone = 1;
  return new World({ region: 'crypt', tier: 2, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed: 1, key: 1, affixes: [], handIns: false, ...(coop ? { coop } : {}) });
}

/** The hero set off: the clock is going. */
function setOff(w: World): void {
  w.input = { ...emptyInput(), mx: 1 };
  w.step(DT);
  w.input = emptyInput();
  expect(w.keyRun!.going).toBe(true);
}

/** The hero put down in the middle of the dungeon's last boss's room (its fight starts with their next step). */
function toLastBoss(w: World): void {
  const last = [...w.encounters].reverse().find((e) => !!e.def.boss)!;
  const tiles = w.map.roomTiles[last.index]!.filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
}

/** The boss of the room the hero stands in, once it has risen. */
function risen(w: World): Enemy {
  for (let n = 0; n < 600 && !w.boss(); n++) {
    w.player.iframe = 99;
    w.step(DT);
  }
  const b = w.boss();
  expect(b).toBeTruthy();
  return b!;
}

/** At the boss with every blow there is: the basic attack held down, each skill as it comes ready, a step closer. */
function fight(w: World): InputFrame {
  const f = emptyInput();
  const b = w.boss();
  if (!b || b.dead || b.boss?.dying) return f;
  const p = w.player;
  const a = Math.atan2(b.y - p.y, b.x - p.x);
  f.aim = a;
  f.aimX = b.x;
  f.aimY = b.y;
  f.holdBasic = { slot: 'basic', angle: a, dist: null, assist: 0 };
  if (Math.hypot(b.x - p.x, b.y - p.y) > b.r + p.r + 12) {
    f.mx = Math.cos(a);
    f.my = Math.sin(a);
  }
  for (const slot of SKILL_SLOTS) if (p.cds[slot].charges > 0) f.casts.push({ slot, angle: a, dist: null, assist: 0 });
  if (p.ult >= 100) f.casts.push({ slot: 'ult', angle: a, dist: null, assist: 0 });
  return f;
}

/** Everything the two runs' worlds are made of that a step moves (the clocks apart): equal while they are the same. */
const state = (w: World): string =>
  JSON.stringify([w.time, w.player.x, w.player.y, w.player.hp, w.player.ult, w.enemies.map((e) => [e.id, e.x, e.y, e.hp, e.state]), w.projectiles.length, w.telegraphs.length, w.encounters.map((e) => e.state)]);

describe('Sigilfall: the Riftstone clock keeps the world’s time', () => {
  it('through a hit-stop the clock counts the world’s time, not the wall’s', () => {
    const w = keyRun();
    setOff(w);
    const k = w.keyRun!;
    // held a quarter of a second (as long as a boss's last blow holds the world)
    let t0 = k.t;
    let w0 = w.time;
    w.hitstop(0.25);
    let steps = 0;
    while (w.hitstopT > 0) {
      w.step(DT);
      steps++;
    }
    expect(steps * DT).toBeGreaterThanOrEqual(0.25 - 1e-9);
    // the clock moved as far as the world did: the sliver a hold lets through, not the wall's quarter second
    expect(k.t - t0).toBeCloseTo(w.time - w0, 9);
    expect(k.t - t0).toBeCloseTo(steps * DT * HITSTOP, 9);
    // and with nothing held, a second of the wall is a second of the clock
    t0 = k.t;
    w0 = w.time;
    for (let i = 0; i < 60; i++) w.step(DT);
    expect(k.t - t0).toBeCloseTo(1, 9);
    expect(w.time - w0).toBeCloseTo(1, 9);
  });

  it('a run with hit-stops in it ends at the same clock time as the same run without them', () => {
    // Two runs of the same fight, kept the same world step for step: the last boss of the Crypt on Riftstone +1, fought
    // by a warrior who can't be hurt (a fall costs the clock in full, which is not what is asked here). In one the blows
    // hold the world as they do in play: the hit-stops, and the boss's fall in slow motion. From the other they are
    // taken out, and it is stepped as far as the first one's world moved in each step, in as little wall time as that
    // takes. The fight ends at the same instant of its world in both, the held one later by the wall: the clocks must
    // read the same.
    const held = keyRun();
    const bare = keyRun();
    let holds = 0;
    const hold = held.hitstop.bind(held);
    held.hitstop = (t: number): void => {
      holds++;
      hold(t);
    };
    bare.hitstop = (): void => {};
    bare.slowmo = (): void => {};
    // how far the held world moves in a step of DT, worked out as sim/world.ts step does
    const pace = (): number => {
      let d = DT;
      if (held.hitstopT > 0) d = DT * HITSTOP;
      if (held.slowT > 0) d *= SLOW;
      return d;
    };
    toLastBoss(held);
    toLastBoss(bare);
    let wallHeld = 0;
    let wallBare = 0;
    let slowSteps = 0;
    let parted = -1;
    // (the fight takes about two minutes of its world; ten are allowed)
    for (let n = 0; n < 60 * 600 && !(held.keyRun!.end && bare.keyRun!.end); n++) {
      const d = pace();
      if (held.slowT > 0) slowSteps++;
      for (const w of [held, bare]) {
        w.input = fight(w);
        w.player.iframe = 99;
      }
      held.step(DT);
      bare.step(d);
      wallHeld += DT;
      wallBare += d;
      if (parted < 0 && state(held) !== state(bare)) parted = n;
    }
    // the same fight, step for step, to its end
    expect(parted, 'the two runs parted at this step').toBe(-1);
    expect(held.cleared).toBe(true);
    expect(bare.cleared).toBe(true);
    // the held one had its hit-stops (the blows', and the boss's last), and its boss fell slowly...
    expect(holds).toBeGreaterThan(5);
    expect(slowSteps).toBeGreaterThan(60);
    // ...and took more than a second longer by the wall
    expect(wallHeld - wallBare).toBeGreaterThan(1);
    // the clocks read the same, to the last bit
    expect(held.keyRun!.end!.time).toBe(bare.keyRun!.end!.time);
    expect(held.keyRun!.end!.up).toBe(bare.keyRun!.end!.up);
  });

  it('a fall still costs the clock in full: while the hero is down it runs at full speed', () => {
    const w = keyRun();
    setOff(w);
    const k = w.keyRun!;
    const t0 = k.t;
    const w0 = w.time;
    w.playerDies();
    for (let i = 0; i < 60; i++) w.step(DT);
    expect(k.deaths).toBe(1);
    // a second of the wall on the clock, though the world, slowed as the hero falls, moved a third of that
    expect(k.t - t0).toBeCloseTo(1, 9);
    expect(w.time - w0).toBeLessThan(0.5);
  });

  it('a boss’s fall costs the clock its throes: the same alone, in slow motion, as in a party, without', () => {
    const fall = (coop?: 'host') => {
      const w = keyRun(coop);
      toLastBoss(w);
      const b = risen(w);
      const k = w.keyRun!;
      // (struck again until the blow lands: a boss between its phases takes none)
      for (let n = 0; n < 600 && !(b.boss!.dying > 0); n++) {
        hitEnemy(w, b, b.hp * 1000, 'physical', { depth: 1 });
        if (b.boss!.dying > 0) break;
        w.player.iframe = 99;
        w.step(DT);
      }
      const throes = b.boss!.dying;
      expect(throes).toBeGreaterThan(1);
      const at = k.t;
      let wall = 0;
      while (!k.end && wall < 10) {
        w.player.iframe = 99;
        w.step(DT);
        wall += DT;
      }
      expect(k.end).toBeTruthy();
      return { throes, clock: k.end!.time - at, wall };
    };
    const alone = fall();
    const party = fall('host');
    // alone the boss falls in slow motion (a party's worlds keep one pace): a second longer by the wall...
    expect(alone.wall - party.wall).toBeGreaterThan(0.5);
    // ...but the clock pays the throes, and no more, either way
    for (const f of [alone, party]) {
      expect(f.clock).toBeGreaterThanOrEqual(f.throes);
      expect(f.clock).toBeLessThan(f.throes + DT);
    }
  });
});
