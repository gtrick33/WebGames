/**
 * The Deepforge Halls: the Great Forge's channels match its map, Grold's molten channels burn only who
 * stands in them, the Slag Colossus's crust cracks when it is broken, and every class clears the
 * dungeon at its level with the gear a player would have by then (tests/sigilfall-bot.ts), both bosses
 * in order, without getting stuck.
 */
import { describe, expect, it } from 'vitest';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { K, TILE } from '../src/games/sigilfall/sim/map';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

const LEVEL = 27;

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** A hero standing in a boss room (the rooms before it cleared), the boss up and waiting. */
function arena(boss: string) {
  const w = newWorld('deepforge-halls', readyHero('warrior', LEVEL, 'uncommon'));
  const enc = w.encounters.find((e) => e.def.boss === boss)!;
  for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
  const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
  for (let k = 0; k < 5; k++) w.step(1 / 60);
  const b = w.boss()!;
  expect(b.def.id).toBe(boss);
  // nothing else of its own for now
  b.boss!.rest = 999;
  return { w, b };
}

const run = (b: NonNullable<World['enemies'][number]['boss']>, use: Omit<PatternUse, 'w' | 'cd'>): void => {
  b.pattern = { use: { w: 1, cd: 0, ...use } as PatternUse, t: 0, step: 0, data: {} };
};

describe('the Deepforge Halls', () => {
  it('the Great Forge’s channels run between the spouts on its map', () => {
    const w = newWorld('deepforge-halls', readyHero('warrior', LEVEL));
    const lanes = BOSSES['forgemaster-grold']!.phases[0]!.patterns.find((p) => p.id === 'forge:pour')!.p!.lanes as string[];
    expect(lanes).toHaveLength(4);
    const forge = w.encounters.findIndex((e) => e.def.boss === 'forgemaster-grold');
    const xs = w.map.roomTiles[forge]!.map((i) => i % w.map.w);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    for (const l of lanes) {
      const row = parseInt(l, 10);
      // the spout (a brazier) at the end it pours from, open floor of the hall all along the rest
      const spout = l.endsWith('R') ? x1 : x0;
      expect(w.map.kind[row * w.map.w + spout], l).toBe(K.Brazier);
      for (let x = x0; x <= x1; x++) if (x !== spout) expect(w.map.room[row * w.map.w + x], `${l} at ${x}`).toBe(forge + 1);
    }
  });

  it('a molten channel burns the hero standing in it, again and again, and spares the one beside it', () => {
    const { w, b } = arena('forgemaster-grold');
    const p = w.player;
    p.hp = p.maxHp = 1e6;
    p.x = 30 * TILE;
    // in the channel on row 11
    p.y = 11.5 * TILE;
    run(b.boss!, { id: 'forge:pour', p: { lanes: ['11R'], count: 1, open: 3, wind: 1 } });
    let hits = 0;
    for (let k = 0; k < 60 * 4.2; k++) {
      const hp = p.hp;
      w.step(1 / 60);
      p.x = 30 * TILE;
      p.y = 11.5 * TILE;
      if (p.hp < hp && w.telegraphs.length) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(4);
    // two tiles off the channel: never touched
    const { w: w2, b: b2 } = arena('forgemaster-grold');
    const q = w2.player;
    q.hp = q.maxHp = 1e6;
    run(b2.boss!, { id: 'forge:pour', p: { lanes: ['11R'], count: 1, open: 3, wind: 1 } });
    for (let k = 0; k < 60 * 4.2; k++) {
      w2.step(1 / 60);
      q.x = 30 * TILE;
      q.y = 13.5 * TILE;
      q.vx = q.vy = 0;
    }
    expect(q.hp).toBe(q.maxHp);
  });

  it('the Slag Colossus hardens into a crust that, broken, leaves it reeling', () => {
    const { w, b } = arena('slag-colossus');
    w.player.iframe = 99;
    run(b.boss!, { id: 'forge:harden', p: { shield: 0.1, time: 8 } });
    w.step(1 / 60);
    expect(b.shield).toBeCloseTo(b.maxHp * 0.1);
    expect(b.def.sprite).toBe('slag-colossus-cooled');
    // the crust takes the blows first
    const hp = b.hp;
    const crust = b.shield;
    hitEnemy(w, b, 20, 'fire', { depth: 0 });
    expect(b.hp).toBe(hp);
    expect(b.shield).toBeLessThan(crust);
    // broken, it cracks: the molten look comes back and it reels, softer than before
    b.shield = 1;
    hitEnemy(w, b, 20, 'fire', { depth: 0 });
    expect(b.shield).toBe(0);
    expect(b.hp).toBeLessThan(hp);
    w.step(1 / 60);
    expect(b.def.sprite).toBe('slag-colossus');
    expect(b.boss!.dazed).toBeGreaterThan(2);
    expect(b.statuses.some((s) => s.id === 'armorBreak')).toBe(true);
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Deepforge Halls at level ${LEVEL}`, { timeout: 30_000 }, () => {
      const w = newWorld('deepforge-halls', readyHero(cls, LEVEL, 'uncommon'));
      const r = play(w, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['slag-colossus', 'forgemaster-grold']);
      expect(r.deaths).toBeLessThanOrEqual(2);
      // Grold is a real fight, not a few seconds of burst
      expect(r.bossTimes['forgemaster-grold']).toBeGreaterThan(20);
    });
  }
});
