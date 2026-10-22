/**
 * The Siege of Highwall (levels 43-46), played through by the bot (tests/sigilfall-bot.ts): every class
 * clears it a level above the dungeon's with the gear a player would have by then, the Siege-Breaker
 * first and General Morvain last, without getting stuck. And the bosses' own mechanics: the ram brings
 * a wall down and sticks in it, the crew's torches set the pitch alight, Morvain's banner wards his
 * troops until it is broken, his squads come through the far gate, his guard answers a wound, the last
 * volley spares only the ground by his banner (or by him), and what the fights leave goes with them.
 */
import { describe, expect, it } from 'vitest';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

const LEVEL = 45;

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: the Siege of Highwall', () => {
  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Siege of Highwall at level ${LEVEL}`, { timeout: 60_000 }, () => {
      const w = newWorld('siege-of-highwall', readyHero(cls as ClassId, LEVEL, 'uncommon'));
      const r = play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['the-siege-breaker', 'general-morvain']);
      expect(r.deaths).toBeLessThanOrEqual(2);
      // the act's last fight is a real one, three phases long
      expect(r.bossTimes['general-morvain']).toBeGreaterThan(20);
    });
  }

  /** A hero standing in a boss room (the rooms before it cleared), the boss up and doing only what it is told. */
  function arena(boss: string): { w: World; b: Enemy; hold: () => void; at: (x: number, y: number) => void } {
    const w = newWorld('siege-of-highwall', readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss === boss)!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    const b = w.boss()!;
    expect(b.def.id).toBe(boss);
    b.boss!.queue = [];
    const hold = (): void => {
      w.player.iframe = 99;
      if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
    };
    const at = (x: number, y: number): void => {
      w.player.x = x;
      w.player.y = y;
    };
    return { w, b, hold, at };
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

  it('the Siege-Breaker’s ram brings the wall down where it strikes, and sticks there', () => {
    const { w, b, hold, at } = arena('the-siege-breaker');
    // the hero by the east wall, level with the Siege-Breaker: the lane ends in the wall
    const spot = { x: b.x + 200, y: b.y };
    const x0 = b.x;
    at(spot.x, spot.y);
    order(b, 'siege:ram', { wind: 0.5, speed: 300, len: 440, mul: 1.6, rubble: 8, rr: 20, fall: 1, rmul: 1.1, daze: 1.5 });
    let rubble = 0;
    let dazed = false;
    run(w, 2.5, () => {
      hold();
      at(spot.x, spot.y);
      rubble = Math.max(rubble, w.telegraphs.filter((t) => t.shape === 'circle' && t.r === 20).length);
      dazed ||= b.boss!.dazed > 0;
    });
    // the stones come down by the wall and on the hero, and the ram is stuck in the wall
    expect(rubble).toBeGreaterThanOrEqual(5);
    expect(dazed).toBe(true);
    expect(b.x).toBeGreaterThan(x0 + 150);
  });

  it('the crew’s torches set the pitch alight, and the pitch goes with the Siege-Breaker', () => {
    const { w, b, hold } = arena('the-siege-breaker');
    order(b, 'siege:pitch', { r: 84, arc: 0.55, wind: 0.6, mul: 1, pools: 4, poolR: 17, life: 20 });
    run(w, 1.5, hold);
    const pools = w.fields.filter((f) => f.hostile && f.look === 'shadow');
    expect(pools.length).toBeGreaterThanOrEqual(3);
    order(b, 'siege:torch', { wind: 0.8, mul: 1.2, burn: 5 });
    run(w, 2, hold);
    expect(pools.filter((f) => w.fields.includes(f) && f.look === 'fire').length).toBe(pools.length);
    hitEnemy(w, b, b.hp * 100, 'physical', { depth: 1 });
    run(w, 0.5, () => (w.player.iframe = 99));
    expect(w.fields.filter((f) => f.hostile)).toHaveLength(0);
  });

  it('Morvain’s banner wards him and his troops until it is broken', () => {
    const { w, b, hold } = arena('general-morvain');
    order(b, 'siege:banner');
    run(w, 2.5, hold);
    const flag = w.enemies.find((e) => e.def.id === 'legion-war-banner' && !e.dead)!;
    expect(flag).toBeTruthy();
    // a soldier beside it is warded and rallied; the general's ward grows while he stands near it
    w.spawnAdd('legion-shieldbearer', flag.x + 20, flag.y, b.room);
    const man = w.enemies[w.enemies.length - 1]!;
    b.x = flag.x - 24;
    b.y = flag.y;
    run(w, 3, hold);
    expect(man.shield).toBeGreaterThan(0);
    expect(man.atkMul).toBeGreaterThan(1);
    expect(b.shield).toBeGreaterThan(0);
    // broken: every ward goes
    hitEnemy(w, flag, flag.hp * 10, 'fire', { depth: 1 });
    run(w, 0.5, hold);
    expect(man.shield).toBe(0);
    expect(man.atkMul).toBe(1);
    expect(b.shield).toBe(0);
  });

  it('Morvain’s squads march in through the gate farthest from the hero', () => {
    const { w, b, hold, at } = arena('general-morvain');
    // the hero by the west gate (the way in): they come through the east one or the north one
    const west = { x: 64.5 * TILE, y: 6.5 * TILE };
    at(west.x + 16, west.y);
    order(b, 'siege:squad', { enemies: ['legion-shieldbearer', 'legion-arbalester'] });
    run(w, 1.5, () => {
      hold();
      at(west.x + 16, west.y);
    });
    const squad = w.enemies.filter((e) => !e.dead && !e.boss && e.def.id !== 'legion-war-banner');
    expect(squad).toHaveLength(2);
    for (const e of squad) expect(Math.hypot(e.x - west.x, e.y - west.y)).toBeGreaterThan(200);
  });

  it('Morvain’s guard answers a wound with a riposte, and the guard leaves no trace when it ends', () => {
    const { w, b, hold } = arena('general-morvain');
    order(b, 'siege:guard', { time: 2.4, wind: 0.45, mul: 2, r: 62, arc: 1.15 });
    run(w, 0.3, hold);
    expect(b.def.sprite).toBe('general-morvain-guard');
    hitEnemy(w, b, 10, 'physical', { depth: 1 });
    let riposte = false;
    run(w, 0.3, () => {
      hold();
      riposte ||= w.telegraphs.some((t) => t.shape === 'cone' && t.r === 62);
    });
    expect(riposte).toBe(true);
    run(w, 1, hold);
    expect(b.def.sprite).toBe('general-morvain');
  });

  it('the last volley spares only the ground beside the banner, or beside Morvain once it has fallen', () => {
    for (const withBanner of [true, false]) {
      const { w, b, hold, at } = arena('general-morvain');
      if (withBanner) {
        order(b, 'siege:banner');
        run(w, 2.5, hold);
      }
      const flag = w.enemies.find((e) => e.def.id === 'legion-war-banner' && !e.dead);
      expect(!!flag).toBe(withBanner);
      const safe = flag ?? b;
      // to the safe ground, or anywhere else
      for (const stay of [true, false]) {
        order(b, 'siege:last-volley', { mul: 2.2, safe: 46, slam: 52, slamWind: 0.75 });
        run(w, 0.1, hold);
        const ring = w.telegraphs.find((t) => t.shape === 'donut')!;
        expect(Math.hypot(ring.x - safe.x, ring.y - safe.y)).toBeLessThan(1);
        const hp = w.player.maxHp;
        w.player.hp = hp;
        const spot = stay ? { x: safe.x + 20, y: safe.y + 10 } : { x: safe.x + 120, y: safe.y + 60 };
        run(w, ring.dur - ring.t + 0.05, () => {
          if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
          w.player.iframe = 0;
          at(spot.x, spot.y);
        });
        if (stay) expect(w.player.hp).toBe(hp);
        else expect(w.player.hp).toBeLessThan(hp);
        run(w, 1.5, () => {
          hold();
          at(spot.x + 80, spot.y);
        });
      }
    }
  });

  it('Morvain’s banner falls with him', () => {
    const { w, b, hold } = arena('general-morvain');
    order(b, 'siege:banner');
    run(w, 2.5, hold);
    const flag = w.enemies.find((e) => e.def.id === 'legion-war-banner' && !e.dead)!;
    expect(flag).toBeTruthy();
    hitEnemy(w, b, b.hp * 100, 'physical', { depth: 1 });
    run(w, 0.5, () => (w.player.iframe = 99));
    expect(flag.dead).toBe(true);
  });
});
