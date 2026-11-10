/**
 * The Smugglers' Grotto (levels 19-22): three below the cove, each harder than the last (sim/patterns/grotto.ts).
 * The Drowned Priestess's flood (the shrine under the sea, air only at the vents), Mother Clatterclaw's shell (blows
 * to her face glance off; get round her, until she molts) and Saltbeard's Black Spot (pass it on with a blow, or it
 * bursts on you). Every class clears it with the bot.
 */
import { describe, expect, it } from 'vitest';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { floodVents } from '../src/games/sigilfall/sim/patterns/grotto';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { clearsWithRetry, gearAt, HARD_DEATHS, newWorld, play, readyHero } from './sigilfall-bot';

const LEVEL = 21;

function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** A hero standing in a boss room (the rooms before it cleared), the boss up and doing only what it is told. */
function arena(boss: string): { w: World; b: Enemy; hold: () => void; idle: () => void } {
  const w = newWorld('smugglers-grotto', readyHero('warrior', LEVEL, 'uncommon'));
  const enc = w.encounters.find((e) => e.def.boss === boss)!;
  for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
  const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE + 40;
  for (let k = 0; k < 5; k++) w.step(1 / 60);
  const b = w.boss()!;
  expect(b.def.id).toBe(boss);
  b.boss!.queue = [];
  b.boss!.pattern = null;
  // the boss does only what it is told (and the hero, with `hold`, is out of harm's way)
  const idle = (): void => {
    if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
  };
  const hold = (): void => {
    w.player.iframe = 99;
    idle();
  };
  return { w, b, hold, idle };
}
const run = (w: World, s: number, each: () => void): void => {
  for (let i = 0; i < s * 60; i++) {
    each();
    w.step(1 / 60);
  }
};
const order = (b: Enemy, id: string, p: PatternUse['p'] = {}): void => {
  b.boss!.pattern = null;
  b.boss!.queue = [{ id: id as PatternUse['id'], w: 1, cd: 0, p }];
  b.boss!.rest = 0;
};

describe('sigilfall: the Smugglers’ Grotto', () => {
  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Smugglers’ Grotto at level ${LEVEL}, three bosses in turn`, { timeout: 240_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld('smugglers-grotto', readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['the-drowned', 'clatterclaw', 'saltbeard']);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
    });
  }

  it('the Priestess floods her shrine: away from the vents the hero runs out of air and drowns, at one they breathe', () => {
    const { w, b, idle } = arena('the-drowned');
    w.player.iframe = 0;
    order(b, 'grotto:flood', { time: 5, air: 1, vents: 3, drown: 0.2 });
    run(w, 0.4, idle);
    expect(w.flooded).toBeGreaterThan(0);
    const vents = floodVents(b);
    expect(vents).toHaveLength(3);
    // well away from every vent
    const far = vents.reduce((m, v) => Math.min(m, Math.hypot(v.x - w.player.x, v.y - w.player.y)), Infinity);
    expect(far).toBeGreaterThan(24);
    const hp = w.player.hp;
    run(w, 2, idle);
    expect(w.player.hp).toBeLessThan(hp);
    // at a vent: no more drowning
    w.player.x = vents[0]!.x;
    w.player.y = vents[0]!.y;
    run(w, 0.8, idle);
    const breathing = w.player.hp;
    run(w, 1, () => {
      idle();
      w.player.iframe = 0;
    });
    expect(w.player.hp).toBeGreaterThanOrEqual(breathing);
    // the sea goes out again
    run(w, 2.5, idle);
    expect(w.flooded).toBe(0);
  });

  it('Clatterclaw’s shell turns blows to her face, not to her back, until she molts', () => {
    const { w, b, hold } = arena('clatterclaw');
    order(b, 'grotto:shell', { cut: 0.7, turn: 1.4 });
    run(w, 0.3, hold);
    // the hero square in front of her
    const front = Math.atan2(w.player.y - b.y, w.player.x - b.x);
    w.player.x = b.x + Math.cos(front) * 40;
    w.player.y = b.y + Math.sin(front) * 40;
    run(w, 0.5, hold);
    // (a wound of a known size, as a blow would leave)
    const wound = (): number => {
      const hp = b.hp;
      b.hp -= 600;
      run(w, 0.05, hold);
      return hp - b.hp;
    };
    const toFace = wound();
    // the hero behind her (she turns slowly: it takes her a while to face them again)
    w.player.x = b.x - Math.cos(b.face) * 40;
    w.player.y = b.y - Math.sin(b.face) * 40;
    const toBack = wound();
    expect(toFace).toBeCloseTo(600 * 0.3, 0);
    expect(toBack).toBe(600);
    // molted: her face is as soft as her back
    order(b, 'grotto:molt', { turn: 3.2 });
    run(w, 1.2, hold);
    w.player.x = b.x + Math.cos(b.face) * 40;
    w.player.y = b.y + Math.sin(b.face) * 40;
    expect(wound()).toBe(600);
  });

  it('Saltbeard’s Black Spot: struck onto him it staggers him, struck onto a crewman it takes him, left alone it bursts', () => {
    const { w, b, hold, idle } = arena('saltbeard');
    order(b, 'grotto:black-spot', { time: 4 });
    run(w, 1, hold);
    hitEnemy(w, b, 10, 'physical', { depth: 1 });
    run(w, 0.1, hold);
    expect(b.boss!.dazed).toBeGreaterThan(2);
    // onto a crewman
    b.boss!.dazed = 0;
    w.spawnAdd('smuggler-cutlass', w.player.x + 40, w.player.y, b.room);
    const mate = w.enemies[w.enemies.length - 1]!;
    run(w, 1, hold);
    order(b, 'grotto:black-spot', { time: 4 });
    run(w, 1, hold);
    hitEnemy(w, mate, 1, 'physical', { depth: 1 });
    run(w, 2, hold);
    expect(mate.dead).toBe(true);
    // left alone: it bursts on the hero
    order(b, 'grotto:black-spot', { time: 1.5 });
    run(w, 0.5, hold);
    w.player.hp = w.player.maxHp;
    run(w, 1.4, () => {
      idle();
      w.player.iframe = 0;
    });
    expect(w.player.hp).toBeLessThan(w.player.maxHp * 0.7);
  });
});
