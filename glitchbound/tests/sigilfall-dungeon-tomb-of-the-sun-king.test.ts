/**
 * The Tomb of the Sun King (levels 34-37), played through by the bot (tests/sigilfall-bot.ts): every
 * class clears it a level above the dungeon's with the gear a player would have by then, the Sand Warden
 * first and the Sun King last, without getting stuck. And the tomb's own mechanics: the burial chamber's
 * pillars cast shadows from the sun disc (and only the shadows are safe when it blazes), the Sand Warden
 * falls into a heap that can't be hurt and rises again (cracked if its wraiths are all destroyed, healed
 * by the ones left standing), and the fire of the burning chamber goes out with the king.
 */
import { describe, expect, it } from 'vitest';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { K, TILE } from '../src/games/sigilfall/sim/map';
import { inSunlight } from '../src/games/sigilfall/sim/patterns/tomb-of-the-sun-king';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

const LEVEL = 36;

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** A hero standing in a boss room (the rooms before it cleared), the boss up and doing nothing of its own. */
function arena(boss: string): { w: World; b: Enemy } {
  const w = newWorld('tomb-of-the-sun-king', readyHero('warrior', LEVEL, 'uncommon'));
  const enc = w.encounters.find((e) => e.def.boss === boss)!;
  for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
  const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
  for (let k = 0; k < 5; k++) w.step(1 / 60);
  const b = w.boss()!;
  expect(b.def.id).toBe(boss);
  b.boss!.rest = 999;
  return { w, b };
}

const start = (b: Enemy, use: Omit<PatternUse, 'w' | 'cd'>): void => {
  b.boss!.pattern = { use: { w: 1, cd: 0, ...use } as PatternUse, t: 0, step: 0, data: {} };
};

/** Steps the world, holding the hero where they stand and the boss to what it was told. */
function run(w: World, b: Enemy, s: number, at?: { x: number; y: number }): void {
  for (let i = 0; i < s * 60; i++) {
    if (at) {
      w.player.x = at.x;
      w.player.y = at.y;
      w.player.vx = w.player.vy = 0;
    }
    if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
    w.step(1 / 60);
  }
}

/** The burial chamber's pillars, as pixel centres. */
function pillars(w: World, room: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const tiles = new Set(w.map.roomTiles[room]);
  for (let i = 0; i < w.map.w * w.map.h; i++) {
    if (w.map.kind[i] !== K.Pillar) continue;
    if (![1, -1, w.map.w, -w.map.w].some((d) => tiles.has(i + d))) continue;
    out.push({ x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE });
  }
  return out;
}

describe('the Tomb of the Sun King', () => {
  it('the burial chamber’s pillars cast shadows from a sun in its middle: behind each one is dark, in front is lit', () => {
    const { w, b } = arena('the-sun-king');
    const ps = pillars(w, b.room);
    expect(ps.length).toBe(8);
    const sx = b.boss!.cx;
    const sy = b.boss!.cy;
    for (const p of ps) {
      const a = Math.atan2(p.y - sy, p.x - sx);
      // a step behind the pillar, seen from the sun, and a step in front of it
      expect(inSunlight(w, sx, sy, p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, 5), `behind ${p.x / TILE},${p.y / TILE}`).toBe(false);
      expect(inSunlight(w, sx, sy, p.x - Math.cos(a) * 22, p.y - Math.sin(a) * 22, 5), `before ${p.x / TILE},${p.y / TILE}`).toBe(true);
    }
    // and most of the chamber is in the light
    expect(inSunlight(w, sx, sy, sx + 40, sy + 30, 5)).toBe(true);
  });

  it('the sun disc burns the hero in its light once a flare, and never the one in a pillar’s shadow', () => {
    for (const hide of [true, false]) {
      const { w, b } = arena('the-sun-king');
      const p = w.player;
      p.hp = p.maxHp = 1e6;
      // the king in the middle of the chamber holds up the disc
      b.x = b.boss!.cx;
      b.y = b.boss!.cy;
      const pl = pillars(w, b.room)[0]!;
      const a = Math.atan2(pl.y - b.y, pl.x - b.x);
      const at = hide ? { x: pl.x + Math.cos(a) * 24, y: pl.y + Math.sin(a) * 24 } : { x: b.x + Math.cos(a + 0.5) * 70, y: b.y + Math.sin(a + 0.5) * 70 };
      start(b, { id: 'tomb:sun-disc', p: { at: 'king', flares: 1, wind: 1.5, blaze: 0.8, mul: 2, hold: 1 } });
      let hits = 0;
      for (let i = 0; i < 60 * 4; i++) {
        const hp = p.hp;
        run(w, b, 1 / 60, at);
        if (p.hp < hp - 50) hits++;
      }
      // the open floor is burnt once while the disc blazes (and keeps burning a little), the shadow never
      if (hide) expect(p.hp).toBe(p.maxHp);
      else expect(hits).toBe(1);
      expect(w.telegraphs.filter((t) => t.shape === 'cone')).toHaveLength(0);
    }
  });

  it('the Sand Warden falls into a heap that can’t be hurt; destroyed wraiths leave it cracked, spared ones heal it', () => {
    for (const kill of [true, false]) {
      const { w, b } = arena('the-sand-warden');
      w.player.iframe = 999;
      b.hp = b.maxHp * 0.49;
      run(w, b, 2.5);
      expect(b.boss!.phase).toBe(1);
      expect(b.def.sprite).toBe('the-sand-warden-heap');
      const wraiths = w.enemies.filter((e) => !e.dead && e.def.id === 'sand-wraith');
      expect(wraiths.length).toBe(4);
      // the heap takes no harm
      const hp = b.hp;
      expect(hitEnemy(w, b, 500, 'physical', { depth: 0 })).toBe(0);
      expect(b.hp).toBe(hp);
      if (kill) {
        for (const x of wraiths) {
          x.state = 'chase';
          hitEnemy(w, x, x.hp * 100, 'physical', { depth: 0 });
        }
        run(w, b, 0.2);
        expect(b.def.sprite).toBe('the-sand-warden');
        expect(b.boss!.dazed).toBeGreaterThan(1);
        expect(b.hp).toBe(hp);
      } else {
        for (const x of wraiths) x.hp = x.maxHp = 1e9;
        run(w, b, 11);
        expect(b.def.sprite).toBe('the-sand-warden');
        expect(b.hp).toBeGreaterThan(hp + b.maxHp * 0.15);
        expect(w.enemies.filter((e) => !e.dead && e.def.id === 'sand-wraith')).toHaveLength(0);
      }
    }
  });

  it('the Sand Warden’s wall of sand sweeps the hall: the hero in its gap is untouched, one beside it is hit once', () => {
    for (const inGap of [true, false]) {
      const { w, b } = arena('the-sand-warden');
      const p = w.player;
      p.hp = p.maxHp = 1e6;
      start(b, { id: 'tomb:sandsweep', p: { waves: 1, width: 22, gap: 56, speed: 160, form: 0.6, mul: 2 } });
      w.step(1 / 60);
      const d = b.boss!.pattern!.data;
      const horiz = d.dir === 0 || d.dir === 2;
      const across = inGap ? (d.g0! + d.g1!) / 2 : d.g0! > b.boss!.cy ? d.g0! - 30 : d.g1! + 30;
      const at = horiz ? { x: b.boss!.cx, y: across } : { x: across, y: b.boss!.cy };
      let hits = 0;
      for (let i = 0; i < 60 * 4; i++) {
        const hp = p.hp;
        run(w, b, 1 / 60, at);
        if (p.hp < hp) hits++;
      }
      expect(hits).toBe(inGap ? 0 : 1);
    }
  });

  it('a quicksand pit drags the hero standing in it toward its middle', () => {
    const { w, b } = arena('the-sand-warden');
    const p = w.player;
    p.hp = p.maxHp = 1e6;
    const x0 = p.x;
    const y0 = p.y;
    start(b, { id: 'tomb:quicksand', p: { count: 1, r: 24, wind: 0.5, life: 6, mul: 0, pull: 30 } });
    run(w, b, 0.7, { x: x0, y: y0 });
    const pit = w.fields.find((f) => f.hostile && Math.hypot(f.x - x0, f.y - y0) < 1);
    expect(pit).toBeTruthy();
    // step to its rim and stand still: the sand pulls
    p.x = x0 + 18;
    run(w, b, 0.5);
    expect(p.x - x0).toBeLessThan(10);
  });

  it('the burial chamber burns in from the walls in the last phase, and the fire goes out with the king', () => {
    const { w, b } = arena('the-sun-king');
    w.player.iframe = 999;
    b.hp = b.maxHp * 0.29;
    run(w, b, 9);
    expect(b.boss!.phase).toBe(2);
    const fire = w.fields.filter((f) => f.hostile && f.look === 'fire');
    expect(fire.length).toBeGreaterThan(20);
    // only by the walls: the middle of the chamber is clear
    expect(fire.every((f) => Math.hypot(f.x - b.boss!.cx, f.y - b.boss!.cy) > 80)).toBe(true);
    hitEnemy(w, b, b.hp * 100, 'physical', { depth: 1 });
    run(w, b, 0.5);
    expect(w.fields.filter((f) => f.hostile)).toHaveLength(0);
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Tomb of the Sun King at level ${LEVEL}`, { timeout: 30_000 }, () => {
      const w = newWorld('tomb-of-the-sun-king', readyHero(cls, LEVEL, 'uncommon'));
      const r = play(w, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['the-sand-warden', 'the-sun-king']);
      expect(r.deaths).toBeLessThanOrEqual(2);
      // the showpiece is a real fight, three phases long
      expect(r.bossTimes['the-sun-king']).toBeGreaterThan(20);
    });
  }
});
