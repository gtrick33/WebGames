/**
 * Duskspire (level 60), Crownfall’s first stage: over the Bone Bridge, through the Hall of Kneeling Dead, past Ser Maltheus to Vaelor on his throne,
 * played through by the bot (tests/sigilfall-bot.ts): every class clears it at the level cap with the gear a
 * player would have by then, room by room, without getting stuck, and the last boss is a real fight. Its
 * bosses' attacks all exist and its rooms are registered.
 * And Lady Cendre's vigil: the dead she raises creep after the hero only while their back is turned, go still when
 * faced, and seize a hero they reach.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS, MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
// (after the patterns' index: a boss's own file imported first would meet itself half-loaded through combat)
import { vigilOfCendre } from '../src/games/sigilfall/sim/patterns/duskspire';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { endScene } from '../src/games/sigilfall/sim/scene';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { gearAt, HARD_DEATHS } from './sigilfall-bot';

const REGION = 'duskspire';
const LEVEL = Math.min(MAX_LEVEL, REGIONS[REGION].level + 1);
const BOSS_ORDER = ['lady-cendre', 'hollow-guard', 'vaelor'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: Duskspire', () => {
  it('has its bosses in order, each in phases, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    for (const id of BOSS_ORDER) {
      expect(BOSSES[id]!.phases.length, id).toBeGreaterThanOrEqual(2);
      for (const ph of BOSSES[id]!.phases) for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
    }
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears Duskspire at level ${LEVEL}`, { timeout: 270_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld(REGION, readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // Vaelor is a real fight, not a few seconds of burst
      expect(r.bossTimes['vaelor']).toBeGreaterThan(30);
    });
  }

  /** A hero in the Hall of Kneeling Dead, Lady Cendre up and doing only what she is told. */
  function hall(): { w: World; b: Enemy; step: (secs: number, aim: number | null) => void } {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss === 'lady-cendre')!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    if (w.scene) endScene(w, true);
    const b = w.boss()!;
    expect(b.def.id).toBe('lady-cendre');
    b.boss!.queue = [];
    b.boss!.pattern = null;
    const step = (secs: number, aim: number | null): void => {
      for (let k = 0; k < secs * 60; k++) {
        if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
        w.input = { ...emptyInput(), aim };
        w.step(1 / 60);
      }
    };
    return { w, b, step };
  }

  it('Lady Cendre’s dead keep still while the hero faces them, creep after them while their back is turned, and seize them', () => {
    const { w, b, step } = hall();
    const p = w.player;
    p.iframe = 99;
    b.boss!.queue = [{ id: 'dusk:vigil', w: 1, cd: 0, p: { count: 1, creep: 60, mul: 1.2 } }];
    b.boss!.rest = 0;
    step(1.5, 0);
    const d = vigilOfCendre(b)[0]!;
    expect(d).toBeTruthy();
    // put it to the hero's east, and face east: it stays where it is
    d.x = p.x + 90;
    d.y = p.y;
    step(1, 0);
    expect(Math.hypot(d.x - p.x, d.y - p.y)).toBeCloseTo(90, 0);
    // the hero turns west: it comes
    step(0.5, Math.PI);
    const near = Math.hypot(d.x - p.x, d.y - p.y);
    expect(near).toBeLessThan(80);
    // and when it reaches them, it seizes them and crumbles
    p.iframe = 0;
    const hp = p.hp;
    step(2, Math.PI);
    expect(p.hp).toBeLessThan(hp);
    expect(d.dead).toBe(true);
  });
});
