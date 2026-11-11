/**
 * The Spire of the Tear (levels 55-56), the last: up the Herald’s tower of black glass, past the Veil Sentinel to the Pale Herald and the Sigil of the Veil,
 * played through by the bot (tests/sigilfall-bot.ts): every class clears it a level above its own with the
 * gear a player would have by then, room by room, both bosses in order, without getting stuck, and the last
 * boss is a real fight. Its bosses' attacks all exist and its rooms are registered.
 * And Ilvane the Unmoored's weightless gallery: the hero drifts, the stones float, and every stone crashes where it
 * hangs when the weight comes back.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import { endScene } from '../src/games/sigilfall/sim/scene';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
// (after the patterns' index: a boss's own file imported first would meet itself half-loaded through combat)
import { galleryOfIlvane } from '../src/games/sigilfall/sim/patterns/spire-of-the-rift';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { gearAt, HARD_DEATHS } from './sigilfall-bot';

const REGION = 'spire-of-the-rift';
const LEVEL = REGIONS[REGION].level + 1;
const BOSS_ORDER = ['veil-sentinel', 'ilvane-the-unmoored', 'herald-in-the-spire'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: the Spire of the Tear', () => {
  it('has its three bosses in order, each in phases, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    for (const id of BOSS_ORDER) {
      expect(BOSSES[id]!.phases.length, id).toBeGreaterThanOrEqual(2);
      for (const ph of BOSSES[id]!.phases) for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
    }
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Spire of the Tear at level ${LEVEL}, three bosses in turn`, { timeout: 240_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld(REGION, readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // the Herald is a real fight, not a few seconds of burst
      expect(r.bossTimes['herald-in-the-spire']).toBeGreaterThan(30);
    });
  }

  /** A hero in the Weightless Gallery, Ilvane up and doing only what she is told. */
  function gallery(): { w: World; b: Enemy; step: (secs: number, mx?: number) => void } {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss === 'ilvane-the-unmoored')!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    // (a spot with open floor to the east, to walk into)
    const open = (i: number): boolean => w.map.room[i] === enc.index + 1 && !w.map.solid[i];
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => [0, 1, 2, 3, 4].every((d) => open(i + d) && open(i + d - w.map.w) && open(i + d + w.map.w)));
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    // (past the boss's card: nobody moves while a scene plays)
    if (w.scene) endScene(w, true);
    const b = w.boss()!;
    expect(b.def.id).toBe('ilvane-the-unmoored');
    b.boss!.queue = [];
    b.boss!.pattern = null;
    const step = (secs: number, mx = 0): void => {
      for (let k = 0; k < secs * 60; k++) {
        w.player.iframe = 99;
        if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
        w.input = { ...emptyInput(), mx };
        w.step(1 / 60);
      }
    };
    return { w, b, step };
  }
  const unmoor = (b: Enemy, p: Record<string, number>): void => {
    b.boss!.pattern = null;
    b.boss!.queue = [{ id: 'spire:unmoor', w: 1, cd: 0, p }];
    b.boss!.rest = 0;
  };

  it('Ilvane’s gallery lets go: the hero drifts, slow to start, and the stones float; the weight comes back and they crash', () => {
    const { w, b, step } = gallery();
    const p = w.player;
    const from = { x: p.x, y: p.y };
    // on the floor, a hero gets going at once
    step(0.25, 1);
    const firm = p.vx;
    expect(firm).toBeGreaterThan(40);
    step(0.5);
    p.x = from.x;
    p.y = from.y;
    unmoor(b, { time: 3, stones: 6, warn: 0.8 });
    step(0.8);
    expect(w.unmoored).toBeGreaterThan(0.9);
    const g = galleryOfIlvane(w, b)!;
    expect(g.adrift).toBe(true);
    expect(g.stones.length).toBeGreaterThan(3);
    expect(w.floaters.every((f) => f.lift > 20)).toBe(true);
    // adrift: slow to get going
    p.vx = 0;
    p.vy = 0;
    step(0.25, 1);
    expect(p.vx).toBeLessThan(firm * 0.6);
    // the weight is coming: every stone hangs still, its fall marked under it
    step(1.2);
    const marked = galleryOfIlvane(w, b)!.stones;
    expect(marked.every((st) => st.marked)).toBe(true);
    for (const st of marked) expect(w.telegraphs.some((t) => t.shape === 'circle' && t.r === 22 && Math.hypot(t.x - st.x, t.y - st.y) < 1)).toBe(true);
    step(1);
    expect(w.unmoored).toBe(0);
    expect(w.floaters).toHaveLength(0);
  });

  it('from her second phase Ilvane flings the drifting stones at the hero', () => {
    const { w, b, step } = gallery();
    unmoor(b, { time: 4, stones: 8, warn: 0.8, fling: 0.5 });
    step(1);
    const before = w.floaters.length;
    let flung = 0;
    for (let k = 0; k < 90; k++) {
      step(1 / 60);
      flung = Math.max(flung, w.projectiles.filter((q) => q.hostile && q.color === '#9a92b0').length);
    }
    expect(flung).toBeGreaterThan(0);
    expect(w.floaters.length).toBeLessThan(before);
  });
});
