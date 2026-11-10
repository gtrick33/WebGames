/**
 * The Molten Throne (levels 53-54), the second: under Emberdeep, past the Magma Warden and Ossa the Founder to Ashkar the Bound, chained to his throne and forging
 * the Pale Crown, played through by the bot (tests/sigilfall-bot.ts): every class clears it a level above its own with the
 * gear a player would have by then, room by room, the three bosses in order, without getting stuck, and the last
 * boss is a real fight. Its bosses' attacks all exist and its rooms are registered. And Ossa's likenesses: white-hot
 * casts of the hero that walk the hero's own path a few seconds behind, burn what they touch, and crack as they cool.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
// (after the patterns' index: a boss's own file imported first would meet itself half-loaded through combat)
import { likenessesOf } from '../src/games/sigilfall/sim/patterns/molten-throne';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { gearAt, HARD_DEATHS } from './sigilfall-bot';

const REGION = 'molten-throne';
const LEVEL = REGIONS[REGION].level + 1;
const BOSS_ORDER = ['magma-warden', 'ossa-the-founder', 'ashkar-the-bound'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: the Molten Throne', () => {
  it('has its three bosses in order, each in phases, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    for (const id of BOSS_ORDER) {
      expect(BOSSES[id]!.phases.length, id).toBeGreaterThanOrEqual(2);
      for (const ph of BOSSES[id]!.phases) for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
    }
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Molten Throne at level ${LEVEL}, three bosses in turn`, { timeout: 240_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld(REGION, readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // Ashkar is a real fight, not a few seconds of burst
      expect(r.bossTimes['ashkar-the-bound']).toBeGreaterThan(30);
    });
  }

  /** A hero in the Bone-Steel Foundry, Ossa up and doing only what she is told. */
  function foundry(): { w: World; b: Enemy; step: (secs: number, mx?: number, my?: number) => void } {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss === 'ossa-the-founder')!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    const b = w.boss()!;
    expect(b.def.id).toBe('ossa-the-founder');
    b.boss!.queue = [];
    b.boss!.pattern = null;
    const step = (secs: number, mx = 0, my = 0): void => {
      for (let k = 0; k < secs * 60; k++) {
        if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
        w.input = { ...emptyInput(), mx, my };
        w.step(1 / 60);
      }
    };
    return { w, b, step };
  }
  const pour = (b: Enemy, p: Record<string, number>): void => {
    b.boss!.pattern = null;
    b.boss!.queue = [{ id: 'throne:likeness', w: 1, cd: 0, p }];
    b.boss!.rest = 0;
  };

  it('Ossa’s likeness walks the hero’s own path a few seconds behind, and burns a hero who stands still', () => {
    const { w, b, step } = foundry();
    const p = w.player;
    p.iframe = 99;
    pour(b, { count: 1, lag: 1.5, life: 30, wind: 0.1 });
    step(0.8);
    expect(likenessesOf(b)).toHaveLength(1);
    expect(w.likenesses).toHaveLength(1);
    // the hero walks a square; the likeness follows where they were 1.5 s before
    const path: { x: number; y: number; t: number }[] = [];
    for (const [mx, my] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      for (let k = 0; k < 60; k++) {
        path.push({ x: p.x, y: p.y, t: w.time });
        step(1 / 60, mx, my);
      }
    }
    const then = path.find((q) => q.t >= w.time - 1.5)!;
    const l = likenessesOf(b)[0]!;
    expect(Math.hypot(l.x - then.x, l.y - then.y)).toBeLessThan(12);
    // no blow can touch it: it is no enemy
    expect(w.enemies.some((e) => Math.hypot(e.x - l.x, e.y - l.y) < 2)).toBe(false);
    // the hero stops: it catches up, and burns
    p.iframe = 0;
    const hp = p.hp;
    step(2.5);
    expect(p.hp).toBeLessThan(hp);
  });

  it('a likeness cools in time, and in her second phase cracks as it cools, spitting molten metal round it', () => {
    const { w, b, step } = foundry();
    w.player.iframe = 99;
    pour(b, { count: 2, lag: 1, gap: 1, life: 1.2, wind: 0.1, burst: 30 });
    step(0.4);
    expect(likenessesOf(b)).toHaveLength(2);
    step(1.1);
    expect(likenessesOf(b)).toHaveLength(0);
    expect(w.likenesses).toHaveLength(0);
    expect(w.telegraphs.filter((t) => t.shape === 'circle' && t.r === 30).length).toBe(2);
  });
});
