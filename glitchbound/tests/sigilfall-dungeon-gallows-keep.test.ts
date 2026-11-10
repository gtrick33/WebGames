/**
 * Gallows Keep (levels 13-16): the gang's three, each harder than the last (sim/patterns/gallows.ts). The Hangman's
 * trapdoors (a checkerboard of boards that drop, and his hook that drags the hero onto one), Gnasher's burrow (the
 * mound that runs after the hero under the kennels, drawn up by the bone heaps) and Harlan's hostages (captives in
 * cages over the fire, to be broken out in time). Every class clears it with the bot.
 */
import { describe, expect, it } from 'vitest';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { bossHidden } from '../src/games/sigilfall/sim/boss';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { clearsWithRetry, gearAt, HARD_DEATHS, newWorld, play, readyHero } from './sigilfall-bot';

const LEVEL = 15;

function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** A hero standing in a boss room (the rooms before it cleared), the boss up and doing only what it is told. */
function arena(boss: string): { w: World; b: Enemy; hold: () => void } {
  const w = newWorld('gallows-keep', readyHero('warrior', LEVEL, 'uncommon'));
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
  const hold = (): void => {
    w.player.iframe = 99;
    if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
  };
  return { w, b, hold };
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
const things = (w: World, id: string): Enemy[] => w.enemies.filter((e) => e.def.id === id && !e.dead && e.hp > 0);
const strike = (w: World, e: Enemy): void => void hitEnemy(w, e, e.hp + e.shield + 999, 'physical', { depth: 1 });
const circles = (w: World): string[] => w.telegraphs.filter((t) => t.shape === 'circle' && !t.dead).map((t) => `${Math.round(t.x)},${Math.round(t.y)}`);

describe('sigilfall: Gallows Keep', () => {
  for (const cls of CLASS_IDS) {
    it(`${cls}: clears Gallows Keep at level ${LEVEL}, three bosses in turn`, { timeout: 240_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld('gallows-keep', readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['hangman', 'gnasher', 'varric']);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
    });
  }

  it('the Hangman drops the gallows boards in a checkerboard, one color and then the other', () => {
    const { w, b, hold } = arena('hangman');
    order(b, 'gallows:trapdoors', { waves: 2, wind: 1 });
    run(w, 0.5, hold);
    const first = circles(w);
    expect(first.length).toBeGreaterThan(12);
    run(w, 1, hold);
    const second = circles(w);
    expect(second.length).toBeGreaterThan(12);
    // the second drop is the other color: no board drops twice running
    expect(second.filter((x) => first.includes(x))).toEqual([]);
  });

  it('caught on the Hangman’s hook, the hero is dragged onto the boards before him, and they drop', () => {
    const { w, b, hold } = arena('hangman');
    w.player.x = b.x + 80;
    w.player.y = b.y;
    w.player.hp = w.player.maxHp;
    order(b, 'gallows:hook-drop', { wind: 0.5, drop: 0.9 });
    run(w, 0.45, hold);
    // (open to the hook as it lands)
    w.player.iframe = 0;
    run(w, 0.6, () => {
      if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
    });
    expect(Math.hypot(w.player.x - b.x, w.player.y - b.y)).toBeLessThan(b.r + 40);
    expect(w.telegraphs.some((t) => t.shape === 'circle' && t.r === 30 && Math.hypot(t.x - w.player.x, t.y - w.player.y) < 12)).toBe(true);
  });

  it('Gnasher burrows out of reach, and a bone heap in the mound’s way draws him up stunned (once, till it’s picked clean)', () => {
    const { w, b, hold } = arena('gnasher');
    const heap = w.props.find((p) => p.prop === 'bone-heap' && w.map.room[Math.floor(p.y / TILE) * w.map.w + Math.floor(p.x / TILE)] === b.room + 1)!;
    expect(heap).toBeTruthy();
    order(b, 'gallows:burrow', { time: 6 });
    run(w, 0.3, hold);
    expect(bossHidden(b)).toBe(true);
    const hp = b.hp;
    hitEnemy(w, b, 500, 'physical', { depth: 1 });
    expect(b.hp).toBe(hp);
    // the mound comes to the heap
    b.x = heap.x + 12;
    b.y = heap.y;
    run(w, 0.1, hold);
    expect(bossHidden(b)).toBe(false);
    expect(b.boss!.pattern).toBeNull();
    expect(b.boss!.dazed).toBeGreaterThan(2);
    expect(b.statuses.some((s) => s.id === 'mark')).toBe(true);
    // picked clean: the next mound passes over it
    b.boss!.dazed = 0;
    order(b, 'gallows:burrow', { time: 6 });
    run(w, 0.3, hold);
    b.x = heap.x + 12;
    b.y = heap.y;
    run(w, 0.2, hold);
    expect(bossHidden(b)).toBe(true);
  });

  it('a mound that finds no bone bursts up under the hero', () => {
    const { w, b, hold } = arena('gnasher');
    order(b, 'gallows:burrow', { time: 1, speed: 400 });
    run(w, 1.1, hold);
    expect(w.telegraphs.some((t) => t.shape === 'circle' && t.r === 40 && Math.hypot(t.x - w.player.x, t.y - w.player.y) < 30)).toBe(true);
    run(w, 1, hold);
    expect(bossHidden(b)).toBe(false);
  });

  it('Harlan’s captives: one broken out thanks the hero, one left to the fire quickens him, and a cage drops nothing', () => {
    const { w, b, hold } = arena('varric');
    b.hp = b.maxHp * 0.7;
    order(b, 'gallows:hostages', { n: 2, time: 3 });
    run(w, 0.8, hold);
    const cages = things(w, 'gang-cage');
    expect(cages).toHaveLength(2);
    w.player.hp = w.player.maxHp * 0.5;
    const ult = w.player.ult;
    const drops = w.drops.length;
    strike(w, cages[0]!);
    run(w, 0.2, hold);
    expect(w.player.hp).toBeGreaterThan(w.player.maxHp * 0.55);
    expect(w.player.ult).toBeGreaterThan(ult);
    expect(w.drops.length).toBe(drops);
    const quick = b.atkMul;
    run(w, 2.5, hold);
    expect(things(w, 'gang-cage')).toHaveLength(0);
    expect(b.atkMul).toBeGreaterThan(quick * 1.05);
    expect(b.hp).toBeGreaterThan(b.maxHp * 0.72);
  });
});
