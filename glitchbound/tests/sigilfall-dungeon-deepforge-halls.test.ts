/**
 * The Deepforge Halls: the Great Forge's channels match its map, Grold's molten channels burn only who
 * stands in them, the Slag Colossus's crust cracks when it is broken, and every class clears the
 * dungeon at its level with the gear a player would have by then (tests/sigilfall-bot.ts), both bosses
 * in order, without getting stuck.
 */
import { describe, expect, it } from 'vitest';
import { bossBase } from '../src/games/sigilfall/sim/patterns/kit';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { K, TILE } from '../src/games/sigilfall/sim/map';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { HARD_DEATHS } from './sigilfall-bot';
import { runesOf } from '../src/games/sigilfall/sim/patterns/deepforge-halls';

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
    // two tiles off the channel: never touched by it (Grold's seeking embers fly on their own all the while, wherever
    // the dice send them: they are taken out of the air, so that only the channel is being asked about)
    const { w: w2, b: b2 } = arena('forgemaster-grold');
    const q = w2.player;
    q.hp = q.maxHp = 1e6;
    run(b2.boss!, { id: 'forge:pour', p: { lanes: ['11R'], count: 1, open: 3, wind: 1 } });
    for (let k = 0; k < 60 * 4.2; k++) {
      w2.projectiles = w2.projectiles.filter((x) => !x.hostile);
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
    // (a share of the health it had before its fights grew longer: sim/patterns/kit.ts bossBase)
    expect(b.shield).toBeCloseTo(bossBase(b) * 0.1);
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

  it('the Runewarden is bound until its runes are stepped in the order it shows, and a wrong rune bursts', () => {
    const { w, b } = arena('the-runewarden');
    const idle = (): void => {
      if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
    };
    const run = (s: number, each: () => void = idle): void => {
      for (let i = 0; i < s * 60; i++) {
        each();
        w.step(1 / 60);
      }
    };
    const order = (id: string, p: PatternUse['p'] = {}): void => {
      b.boss!.pattern = null;
      b.boss!.queue = [{ id: id as PatternUse['id'], w: 1, cd: 0, p }];
      b.boss!.rest = 0;
    };
    order('forge:bound', { cut: 0.55 });
    run(0.2);
    expect(runesOf(w, b).bound).toBe(true);
    expect(runesOf(w, b).plates).toHaveLength(4);
    // bound: a wound mostly closes again
    let hp = b.hp;
    b.hp -= 1000;
    run(0.05);
    expect(hp - b.hp).toBeCloseTo(450, 0);
    // the sequence shown, then stepped in order
    w.player.x = b.x;
    w.player.y = b.y + 60;
    order('forge:runes', { len: 3, beat: 0.3, time: 9 });
    run(2);
    const { plates, seq } = runesOf(w, b);
    expect(seq).toHaveLength(3);
    for (const n of seq) {
      w.player.x = plates[n]!.x;
      w.player.y = plates[n]!.y;
      run(0.1);
      // (off the plates between steps)
      w.player.x = b.x;
      w.player.y = b.y + 30;
      run(0.1);
    }
    expect(runesOf(w, b).bound).toBe(false);
    expect(b.boss!.dazed).toBeGreaterThan(2);
    hp = b.hp;
    b.hp -= 1000;
    run(0.05);
    expect(hp - b.hp).toBe(1000);
    // a wrong rune bursts under the hero
    b.boss!.dazed = 0;
    order('forge:runes', { len: 3, beat: 0.3, time: 9 });
    run(2);
    const s2 = runesOf(w, b);
    const wrong = [0, 1, 2, 3].find((n) => n !== s2.seq[0])!;
    w.player.iframe = 0;
    w.player.hp = w.player.maxHp;
    w.player.x = s2.plates[wrong]!.x;
    w.player.y = s2.plates[wrong]!.y;
    run(0.1);
    expect(w.player.hp).toBeLessThan(w.player.maxHp * 0.9);
    expect(runesOf(w, b).seq).toHaveLength(0);
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Deepforge Halls at level ${LEVEL}`, { timeout: 240_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld('deepforge-halls', readyHero(cls, LEVEL, 'uncommon'), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['slag-colossus', 'the-runewarden', 'forgemaster-grold']);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // Grold is a real fight, not a few seconds of burst
      expect(r.bossTimes['forgemaster-grold']).toBeGreaterThan(20);
    });
  }
});
