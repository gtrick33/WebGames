/**
 * The Rotmother's Cistern, played through by the bot (tests/sigilfall-bot.ts): every class clears it
 * a level above its own with the gear a player would have by then, room by room, Brother Pustule, Old
 * Sluicegut and then the Rot-Mother, without getting stuck. Also: her bile stays on the floor as pools,
 * and the pools dry up when she falls; Pustule's leeches drink until a dodge shakes them off; Sluicegut's
 * sluices drag the hero along until their levers are struck.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
import { leechCount, openSluices } from '../src/games/sigilfall/sim/patterns/rotmother-cistern';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { HARD_DEATHS } from './sigilfall-bot';

const REGION = 'rotmother-cistern';
const LEVEL = REGIONS[REGION].level + 1;
const BOSS_ORDER = ['brother-pustule', 'old-sluicegut', 'the-rot-mother'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

function runDungeon(cls: ClassId) {
  const { w, r } = clearsWithRetry((seed) => {
    const w = newWorld(REGION, readyHero(cls, LEVEL, 'uncommon'), seed);
    return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
  });
  return { w, r };
}

describe('sigilfall: the Rotmother’s Cistern', () => {
  it('has its three bosses in order, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    expect(BOSSES['the-rot-mother']!.phases).toHaveLength(3);
    for (const id of BOSS_ORDER) {
      for (const ph of BOSSES[id]!.phases) {
        for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
      }
    }
  });

  it('the Rot-Mother’s bile stays on the floor as pools, and they dry up when she falls', () => {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const pit = w.encounters.find((e) => e.def.boss === 'the-rot-mother')!;
    for (const enc of w.encounters) if (enc.index < pit.index) enc.state = 'cleared';
    // walk into the pit: she wakes
    const tiles = w.map.roomTiles[pit.index]!.filter((i) => !w.map.solid[i]);
    const t = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((t % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(t / w.map.w) + 0.5) * TILE + 60;
    w.player.iframe = 1e9;
    const boss = (): ReturnType<World['boss']> => w.boss();
    for (let i = 0; i < 10 && !boss(); i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    const b = boss()!;
    expect(b.def.id).toBe('the-rot-mother');
    // she spits: when the gobs land, pools stay
    b.boss!.queue = [{ id: 'rot:bile', w: 1, cd: 0, p: { count: 3, wind: 1.2, pool: 22 } }];
    b.boss!.rest = 0;
    for (let i = 0; i < 60 * 3; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    const pools = (): number => w.fields.filter((f) => f.hostile && f.type === 'poison').length;
    expect(pools()).toBeGreaterThanOrEqual(1);
    // a pool hurts whoever stands in it
    const f = w.fields.find((x) => x.hostile && x.type === 'poison')!;
    w.player.iframe = 0;
    w.player.x = f.x;
    w.player.y = f.y;
    const hp = w.player.hp;
    for (let i = 0; i < 40; i++) {
      w.player.x = f.x;
      w.player.y = f.y;
      w.input = emptyInput();
      w.step(1 / 60);
    }
    expect(w.player.hp).toBeLessThan(hp);
    // she falls: the floor dries
    w.player.iframe = 1e9;
    b.hp = 1;
    b.boss!.dying = 0.01;
    for (let i = 0; i < 60 * 3; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    expect(pools()).toBe(0);
  });

  /** A hero in a boss's room (the rooms before it cleared), the boss up and doing only what it is told. */
  function arena(boss: string): { w: World; b: Enemy; idle: () => void } {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
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
    const idle = (): void => {
      if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
    };
    return { w, b, idle };
  }
  const run = (w: World, s: number, each: () => void): void => {
    for (let i = 0; i < s * 60; i++) {
      each();
      w.input = emptyInput();
      w.step(1 / 60);
    }
  };
  const order = (b: Enemy, id: string, p: PatternUse['p'] = {}): void => {
    b.boss!.pattern = null;
    b.boss!.queue = [{ id: id as PatternUse['id'], w: 1, cd: 0, p }];
    b.boss!.rest = 0;
  };

  it('Brother Pustule’s leeches cling and drink, feeding him, until a dodge shakes them off', () => {
    const { w, b, idle } = arena('brother-pustule');
    b.hp = b.maxHp * 0.8;
    w.player.x = b.x + 40;
    w.player.y = b.y;
    order(b, 'rot:leeches', { n: 4, wind: 0.5 });
    run(w, 0.7, idle);
    expect(leechCount(b)).toBe(4);
    const hp = w.player.hp;
    run(w, 2.1, idle);
    expect(w.player.hp).toBeLessThan(hp);
    expect(b.hp).toBeGreaterThan(b.maxHp * 0.8);
    // a dodge shakes two off, another the rest
    w.player.lastDodge = w.time;
    run(w, 0.1, idle);
    expect(leechCount(b)).toBe(2);
    w.player.lastDodge = w.time;
    run(w, 0.1, idle);
    expect(leechCount(b)).toBe(0);
  });

  it('Old Sluicegut’s sluices drag the hero along their lanes until the lever is struck', () => {
    const { w, b, idle } = arena('old-sluicegut');
    order(b, 'rot:sluices', { lanes: 3, time: 8, push: 100 });
    run(w, 0.9, idle);
    const lanes = openSluices(b);
    expect(lanes).toHaveLength(3);
    expect(w.enemies.filter((e) => e.def.id === 'sluice-lever' && !e.dead)).toHaveLength(3);
    // into a lane, halfway along it: dragged toward its grate
    const lane = lanes[0]!;
    w.player.x = (lane.x0 + lane.x1) / 2;
    w.player.y = lane.y;
    w.player.iframe = 99;
    const x = w.player.x;
    run(w, 0.5, idle);
    expect((w.player.x - x) * lane.dir).toBeGreaterThan(25);
    // its lever struck: that sluice shuts
    hitEnemy(w, lane.lever!, lane.lever!.hp + 999, 'physical', { depth: 1 });
    run(w, 0.2, idle);
    expect(openSluices(b)).toHaveLength(2);
    const still = w.player.x;
    run(w, 0.5, idle);
    expect(Math.abs(w.player.x - still)).toBeLessThan(2);
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears it at level ${LEVEL}`, { timeout: 240_000 }, () => {
      const { w, r } = runDungeon(cls);
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // the Rot-Mother is a real fight, not a few seconds of burst
      expect(r.bossTimes['the-rot-mother']).toBeGreaterThan(20);
    });
  }
});
