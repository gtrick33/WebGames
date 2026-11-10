/**
 * Blightheart (levels 52-53), the first of Act V’s three great dungeons: down the Heartroot into the rotten heart of the Blightwood, past the Rotwood Colossus and the
 * sisters of the Faded Lights to the Withered Queen and the Sigil of Thorns, played through by the bot (tests/sigilfall-bot.ts):
 * every class clears it a level above its own with the gear a player would have by then, room by room, the three bosses in
 * order, without getting stuck, and the last boss is a real fight. Its bosses' attacks all exist and its rooms are registered.
 * And the sisters' bond: whichever falls first is sung back up unless the other falls in time, close together they turn half
 * of every wound aside, and from Elowen's second phase the bond between them burns.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { bossHidden } from '../src/games/sigilfall/sim/boss';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
import { twinsOfElowen } from '../src/games/sigilfall/sim/patterns/blightheart';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { gearAt, HARD_DEATHS } from './sigilfall-bot';

const REGION = 'blightheart';
const LEVEL = REGIONS[REGION].level + 1;
const BOSS_ORDER = ['rotwood-colossus', 'elowen-of-the-dawn', 'the-withered-queen'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: Blightheart', () => {
  it('has its three bosses in order, each in phases, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    for (const id of BOSS_ORDER) {
      expect(BOSSES[id]!.phases.length, id).toBeGreaterThanOrEqual(2);
      for (const ph of BOSSES[id]!.phases) for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
    }
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears Blightheart at level ${LEVEL}, three bosses in turn`, { timeout: 240_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld(REGION, readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // the Queen is a real fight, not a few seconds of burst
      expect(r.bossTimes['the-withered-queen']).toBeGreaterThan(30);
    });
  }

  /** A hero in the Hall of Faded Lights, Elowen up and doing only what she is told, her sister woken beside her. */
  function hall(): { w: World; b: Enemy; hold: () => void; run: (secs: number) => void } {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss === 'elowen-of-the-dawn')!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE + 60;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    const b = w.boss()!;
    expect(b.def.id).toBe('elowen-of-the-dawn');
    b.boss!.queue = [{ id: 'blight:twins', w: 1, cd: 0 }];
    b.boss!.pattern = null;
    b.boss!.rest = 0;
    const hold = (): void => {
      w.player.iframe = 99;
      if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
    };
    const run = (secs: number): void => {
      for (let k = 0; k < secs * 60; k++) {
        hold();
        w.step(1 / 60);
      }
    };
    // (her sister up, and done rising)
    run(1.2);
    expect(twinsOfElowen(b)!.sister).not.toBeNull();
    return { w, b, hold, run };
  }

  it('the sisters of the Faded Lights: close together they turn half of every wound aside, apart they bear it all', () => {
    const { w, b, run } = hall();
    const m = twinsOfElowen(b)!.sister!;
    const wound = (): number => {
      const hp = b.hp;
      b.hp -= 1000;
      w.step(1 / 60);
      return hp - b.hp;
    };
    m.x = b.x + 30;
    m.y = b.y;
    run(0.05);
    m.x = b.x + 30;
    m.y = b.y;
    expect(wound()).toBeCloseTo(500, -1);
    m.x = b.x + 200;
    m.y = b.y;
    w.step(1 / 60);
    m.x = b.x + 200;
    expect(wound()).toBeCloseTo(1000, -1);
  });

  it('whichever sister falls first is sung back up a few seconds later, unless the other falls in time', () => {
    const { w, b, run } = hall();
    // Merrin first: back again, a third of her strength
    hitEnemy(w, twinsOfElowen(b)!.sister!, 999999, 'physical', { depth: 1 });
    run(0.2);
    expect(twinsOfElowen(b)!.down).toBe('dusk');
    run(12.5);
    const back = twinsOfElowen(b)!.sister!;
    expect(back).not.toBeNull();
    expect(back.hp / back.maxHp).toBeCloseTo(0.3, 1);
    expect(twinsOfElowen(b)!.down).toBeNull();
    // Elowen first: a mote of dawn no blow can touch, and back again
    run(1);
    b.hp = b.maxHp * 0.04;
    run(0.1);
    expect(twinsOfElowen(b)!.down).toBe('dawn');
    expect(bossHidden(b)).toBe(true);
    run(12.5);
    expect(bossHidden(b)).toBe(false);
    expect(b.hp / b.maxHp).toBeCloseTo(0.3, 1);
    // and once more, but her sister falls while she sings: the dawn goes out with her
    b.hp = b.maxHp * 0.04;
    run(0.1);
    expect(twinsOfElowen(b)!.down).toBe('dawn');
    run(0.5);
    hitEnemy(w, twinsOfElowen(b)!.sister!, 999999, 'physical', { depth: 1 });
    run(0.3);
    expect(b.dead || b.boss!.dying > 0).toBe(true);
  });

  it('from Elowen’s second phase the bond between the sisters burns: a beam from one to the other', () => {
    const { w, b, run } = hall();
    b.hp = b.maxHp * 0.45;
    run(4);
    expect(b.boss!.phase).toBe(1);
    const m = twinsOfElowen(b)!.sister!;
    const beams = w.telegraphs.filter((t) => t.shape === 'line' && t.r2 === 12 && Math.hypot(t.x - b.x, t.y - b.y) < 20);
    expect(beams.length).toBeGreaterThan(0);
    expect(Math.abs(beams[0]!.len - Math.hypot(m.x - b.x, m.y - b.y))).toBeLessThan(30);
  });
});
