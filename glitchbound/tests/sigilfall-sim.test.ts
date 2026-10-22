/**
 * Sigilfall play-throughs: a simple bot (tests/sigilfall-bot.ts) plays each class through the
 * forest and the crypt at every difficulty, with gear a player would plausibly have by then. It
 * proves the regions can be finished (no soft-locks, no stuck spots, no broken numbers) and that
 * every boss can be beaten by every class.
 */
import { describe, expect, it } from 'vitest';
import { SLOTS, type ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

/** The middle of the first room not fought yet (the bot's route through a region). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** Common gear in six of nine slots: what a new player has on reaching the forest. */
const modest = (cls: ClassId, level: number) => {
  const c = readyHero(cls, level, 'common', 11);
  for (const s of SLOTS.slice(6)) delete c.equip[s];
  return c;
};

const CLASSES: ClassId[] = ['mage', 'warrior', 'ranger'];

describe('sigilfall play-throughs', () => {
  for (const cls of CLASSES) {
    it(`${cls}: beats Grimtusk in the Whisperwood at level 3 with modest gear`, () => {
      const w = newWorld('whisperwood', modest(cls, 3));
      const r = play(w, { seconds: 600, done: (x) => !!x.hero.bosses.grimtusk, goal: nextRoom });
      expect(r.stuck).toBe(false);
      expect(r.bossesDown).toEqual(['grimtusk']);
      expect(r.deaths).toBeLessThanOrEqual(2);
    });

    it(`${cls}: clears the Hollow Crypt on Normal at level 8`, () => {
      const w = newWorld('crypt', readyHero(cls, 8));
      const r = play(w, { seconds: 900, done: (x) => x.cleared, goal: nextRoom });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['ossric', 'morgrave']);
      expect(r.deaths).toBeLessThanOrEqual(1);
      // the clear is recorded and opens the next difficulty's quest
      expect(w.hero.clears['crypt:0']).toBe(1);
    });

    it(`${cls}: clears Heroic at level 13 and Mythic at level 17 with rare gear`, () => {
      const heroic = newWorld('crypt', readyHero(cls, 13, 'rare'), 3, 1);
      const h = play(heroic, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom });
      expect(heroic.cleared).toBe(true);
      expect(h.deaths).toBeLessThanOrEqual(3);
      const mythic = newWorld('crypt', readyHero(cls, 17, 'rare'), 4, 2);
      const m = play(mythic, { seconds: 1800, done: (x) => x.cleared, goal: nextRoom });
      expect(mythic.cleared).toBe(true);
      expect(m.stuck).toBe(false);
    });
  }

  it('each difficulty hits harder and lasts longer than the one before', () => {
    const boss = (tier: number) => {
      const w = newWorld('crypt', readyHero('mage', 9), 1, tier);
      const e = w.addEnemy('skeleton', w.player.x, w.player.y, w.level, { room: -1, pack: 0 });
      return { hp: e.maxHp, dmg: e.dmg };
    };
    const [n, h, m] = [boss(0), boss(1), boss(2)];
    expect(h.hp).toBeGreaterThan(n.hp * 2.5);
    expect(m.hp).toBeGreaterThan(h.hp * 2.5);
    expect(h.dmg).toBeGreaterThan(n.dmg * 1.5);
    expect(m.dmg).toBeGreaterThan(h.dmg * 1.5);
  });

  it('plays out the same way from the same seed', () => {
    const run = () => {
      const w = newWorld('whisperwood', readyHero('ranger', 4), 9);
      const r = play(w, { seconds: 120, done: (x) => !!x.hero.bosses.grimtusk, goal: nextRoom });
      return { t: r.time, kills: r.kills, hp: Math.round(w.player.hp), x: Math.round(w.player.x) };
    };
    expect(run()).toEqual(run());
  });
});
