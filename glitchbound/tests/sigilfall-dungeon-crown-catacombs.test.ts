/**
 * The catacombs under the Crown City (level 60, postgame): Silas Vey in the ossuary of ash-gold, the Royal Auditor in the
 * Counting Hall, then Maelis Crane in the old kings’ vault,
 * played through by the bot (tests/sigilfall-bot.ts): every class clears it at the level cap with the gear a
 * player would have by then, room by room, without getting stuck, and the last boss is a real fight. Its
 * bosses' attacks all exist and its rooms are registered.
 * And its first two: Silas Vey's ash-gold (taken it weighs on the hero, left lying it buys him blades, all of it
 * taken leaves him open) and the Royal Auditor's ledger (every blow tallied, paid back by a hero outside his ward).
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS, MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
// (after the patterns' index: a boss's own file imported first would meet itself half-loaded through combat)
import { ledgerOfAuditor, purseOfSilas } from '../src/games/sigilfall/sim/patterns/crown-catacombs';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { endScene } from '../src/games/sigilfall/sim/scene';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { gearAt, HARD_DEATHS } from './sigilfall-bot';

const REGION = 'crown-catacombs';
const LEVEL = Math.min(MAX_LEVEL, REGIONS[REGION].level + 1);
const BOSS_ORDER = ['silas-vey', 'the-royal-auditor', 'maelis-crane'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: the catacombs', () => {
  it('has its bosses in order, each in phases, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    for (const id of BOSS_ORDER) {
      expect(BOSSES[id]!.phases.length, id).toBeGreaterThanOrEqual(2);
      for (const ph of BOSSES[id]!.phases) for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
    }
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the catacombs at level ${LEVEL}`, { timeout: 270_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld(REGION, readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // Crane is a real fight, not a few seconds of burst
      expect(r.bossTimes['maelis-crane']).toBeGreaterThan(30);
    });
  }

  /** A hero in one of the catacombs' boss rooms, the boss up and doing only what it is told. */
  function room(boss: string): { w: World; b: Enemy; step: (secs: number, mx?: number, my?: number) => void } {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss === boss)!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    if (w.scene) endScene(w, true);
    const b = w.boss()!;
    expect(b.def.id).toBe(boss);
    b.boss!.queue = [];
    b.boss!.pattern = null;
    const step = (secs: number, mx = 0, my = 0): void => {
      for (let k = 0; k < secs * 60; k++) {
        w.player.iframe = Math.max(w.player.iframe, 0);
        if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
        w.input = { ...emptyInput(), mx, my };
        w.step(1 / 60);
      }
    };
    return { w, b, step };
  }

  it('Silas’s ash-gold: picked up it weighs on the hero, left lying it buys him blades, all of it taken leaves him open', () => {
    const { w, b, step } = room('silas-vey');
    const p = w.player;
    p.iframe = 99;
    b.boss!.queue = [{ id: 'crown:scatter', w: 1, cd: 0, p: { coins: 6, spend: 3, per: 3 } }];
    b.boss!.rest = 0;
    step(0.5);
    const coins = purseOfSilas(w, b)!.coins;
    expect(coins.length).toBe(6);
    // the hero walks over one: it weighs on them
    p.x = coins[0]!.x;
    p.y = coins[0]!.y;
    step(0.1);
    expect(purseOfSilas(w, b)!.carried).toBe(1);
    expect(p.statuses.some((x) => x.id === 'chill')).toBe(true);
    // the rest left lying: when he pays, a blade for every three
    const before = w.enemies.filter((e) => e.def.id === 'hired-knife' && !e.dead).length;
    step(3);
    expect(purseOfSilas(w, b)!.coins).toHaveLength(0);
    expect(w.enemies.filter((e) => e.def.id === 'hired-knife' && !e.dead).length).toBe(before + 1);
    // again, and every coin taken: he has nothing to pay with
    b.boss!.queue = [{ id: 'crown:scatter', w: 1, cd: 0, p: { coins: 4, spend: 3, per: 3 } }];
    b.boss!.rest = 0;
    step(0.5);
    for (const c of purseOfSilas(w, b)!.coins) {
      p.x = c.x;
      p.y = c.y;
      step(0.05);
    }
    expect(purseOfSilas(w, b)!.coins).toHaveLength(0);
    step(3);
    expect(b.boss!.dazed).toBeGreaterThan(1);
  });

  it('the Royal Auditor tallies every blow and settles the account: outside his ward the hero pays, inside it he does', () => {
    const { w, b, step } = room('the-royal-auditor');
    const p = w.player;
    // (his book opened, as the fight begins)
    b.boss!.queue = [{ id: 'crown:ledger', w: 1, cd: 0 }];
    b.boss!.rest = 0;
    step(1);
    hitEnemy(w, b, 300, 'physical', { depth: 1 });
    step(0.1);
    const owed = ledgerOfAuditor(b)!.tally;
    expect(owed).toBeGreaterThan(0);
    // settled with the hero outside the ward
    b.boss!.queue = [{ id: 'crown:settle', w: 1, cd: 0, p: { warn: 1, share: 0.5, cap: 0.4, rr: 30 } }];
    b.boss!.rest = 0;
    step(0.2);
    const ward = ledgerOfAuditor(b)!.ward!;
    expect(ward).toBeTruthy();
    expect(Math.hypot(ward.x - p.x, ward.y - p.y)).toBeGreaterThan(ward.r);
    const hp = p.hp;
    step(1.2);
    expect(hp - p.hp).toBeGreaterThan(Math.min(p.maxHp * 0.4, owed * 0.5) * 0.9);
    expect(ledgerOfAuditor(b)!.tally).toBe(0);
    // and again, standing in the ward: the ink burns him instead
    p.hp = p.maxHp;
    hitEnemy(w, b, 300, 'physical', { depth: 1 });
    step(0.1);
    b.boss!.queue = [{ id: 'crown:settle', w: 1, cd: 0, p: { warn: 1, share: 0.5, cap: 0.4, rr: 30 } }];
    b.boss!.rest = 0;
    step(0.2);
    const ward2 = ledgerOfAuditor(b)!.ward!;
    p.x = ward2.x;
    p.y = ward2.y;
    const his = b.hp;
    step(1.2);
    expect(p.hp).toBe(p.maxHp);
    expect(b.hp).toBeLessThan(his);
  });
});
