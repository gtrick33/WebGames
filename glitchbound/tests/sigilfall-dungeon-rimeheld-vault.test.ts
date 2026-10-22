/**
 * The Rimeheld Vault (levels 38-41), played through by the bot (tests/sigilfall-bot.ts): every class
 * clears it a level above its own with the gear a player would have by then, room by room, Jarl
 * Hrimfang and then the Rime Wyrm, without getting stuck. And its bosses' own mechanics: the wyrm's
 * ice freezes a hero who stands on it too long (not one who keeps moving), its flight takes it out of
 * reach until it dives onto the hero, its breath lands once a sweep and the cavern's columns stop it,
 * its wings drive the hero back (the columns shelter from them too), and the Jarl's war cry calls his
 * huscarls in through the doors, never more than four of his following at once.
 */
import { describe, expect, it } from 'vitest';
import type { PatternUse } from '../src/games/sigilfall/data/bosses';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { bossHidden } from '../src/games/sigilfall/sim/boss';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { K, TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

const REGION = 'rimeheld-vault';
const LEVEL = REGIONS[REGION].level + 1;
const BOSS_ORDER = ['jarl-hrimfang', 'the-rime-wyrm'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

const at = (tx: number, ty: number): { x: number; y: number } => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });

/** A hero in a boss room (the rooms before it cleared), the boss up and doing nothing of its own. */
function arena(boss: string): { w: World; b: Enemy } {
  const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
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

/** Starts one of the boss's attacks now. */
const use = (b: Enemy, u: Omit<PatternUse, 'w' | 'cd'>): void => {
  b.boss!.pattern = { use: { w: 1, cd: 0, ...u } as PatternUse, t: 0, step: 0, data: {} };
};

/** Steps the world for `s` seconds, the hero standing still (and `each` run before every step). */
function run(w: World, s: number, each: () => void = () => undefined): void {
  for (let i = 0; i < s * 60; i++) {
    each();
    w.input = emptyInput();
    w.step(1 / 60);
  }
}

/** Keeps the boss from starting anything of its own once its attack is over. */
const idle = (b: Enemy) => (): void => {
  if (!b.boss!.pattern) b.boss!.rest = 999;
};

const iceOn = (w: World): World['fields'] => w.fields.filter((f) => f.hostile && f.look === 'frost');

describe('sigilfall: the Rimeheld Vault', () => {
  it('has its two bosses in order, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    expect(BOSSES['jarl-hrimfang']!.phases).toHaveLength(2);
    expect(BOSSES['the-rime-wyrm']!.phases).toHaveLength(3);
    for (const id of BOSS_ORDER) {
      for (const ph of BOSSES[id]!.phases) {
        for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
      }
    }
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Rimeheld Vault at level ${LEVEL}`, { timeout: 30_000 }, () => {
      const w = newWorld(REGION, readyHero(cls as ClassId, LEVEL, 'uncommon'));
      const r = play(w, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(2);
      // the Act's frozen showpiece is a real fight, three phases and two flights long
      expect(r.bossTimes['the-rime-wyrm']).toBeGreaterThan(20);
    });
  }

  it('the wyrm’s ice freezes a hero who stands on it too long, not one who keeps moving, and goes when it falls', () => {
    const stuck = (w: World): boolean => w.player.statuses.some((s) => s.id === 'stun');
    for (const still of [true, false]) {
      const { w, b } = arena('the-rime-wyrm');
      const p = w.player;
      use(b, { id: 'rime:frost', p: { count: 1, r: 20, wind: 0.6, grow: 0, max: 30, life: 30 } });
      run(w, 1, idle(b));
      const ice = iceOn(w);
      expect(ice).toHaveLength(1);
      const f = ice[0]!;
      // somewhere clear of the ice, to step off to
      const off = { x: f.x + (f.x < b.boss!.cx ? 70 : -70), y: f.y };
      expect(Math.hypot(off.x - f.x, off.y - f.y)).toBeGreaterThan(f.r + 10);
      let frozen = false;
      let t = 0;
      run(w, 4, () => {
        idle(b)();
        p.hp = p.maxHp;
        p.iframe = 0;
        // standing on it the whole time, or on it a second and off it a second
        const on = still || Math.floor(t) % 2 === 0;
        p.x = on ? f.x : off.x;
        p.y = on ? f.y : off.y;
        frozen ||= stuck(w);
        t += 1 / 60;
      });
      expect(frozen, still ? 'standing on the ice' : 'stepping off it').toBe(still);
      if (still) {
        // the wyrm falls: its ice thaws with it
        hitEnemy(w, b, b.hp * 100, 'physical', { depth: 1 });
        run(w, 2.5, () => (p.iframe = 99));
        expect(iceOn(w)).toHaveLength(0);
      }
    }
  });

  it('the wyrm takes to the air out of reach, its shadow circling, and dives onto the hero', () => {
    const { w, b } = arena('the-rime-wyrm');
    const p = w.player;
    use(b, { id: 'rime:flight', p: { time: 3, strafes: 1, icicles: 2, land: 1.2, landR: 46 } });
    const shadow = (): boolean => w.fx.some((f) => f.kind === 'burst' && f.color.startsWith('rgba(0,6,16'));
    run(w, 1.5, () => (p.iframe = 99));
    expect(bossHidden(b)).toBe(true);
    expect(shadow()).toBe(true);
    expect(hitEnemy(w, b, 1000, 'physical', { depth: 1 })).toBe(0);
    // it comes down where the hero stood when it dived (they don't move here)
    let landed = false;
    run(w, 6, () => {
      p.iframe = 99;
      if (!b.boss!.pattern) landed = true;
      idle(b)();
    });
    expect(landed).toBe(true);
    expect(bossHidden(b)).toBe(false);
    expect(Math.hypot(b.x - p.x, b.y - p.y)).toBeLessThan(30);
    expect(hitEnemy(w, b, 1000, 'physical', { depth: 1 })).toBeGreaterThan(0);
  });

  it('the wyrm’s breath lands once a sweep, and a column of ice shelters from it (and from its wings)', () => {
    // the cavern's west columns: the wyrm on one side of one, the hero on the other
    const pillar = { tx: 53, ty: 6 };
    for (const sheltered of [true, false]) {
      const { w, b } = arena('the-rime-wyrm');
      expect(w.map.kind[pillar.ty * w.map.w + pillar.tx]).toBe(K.Pillar);
      const p = w.player;
      const bp = at(47, pillar.ty);
      // behind the column, or out in the open exactly where two slices of the breath meet (it still
      // lands once)
      const hp = sheltered ? at(58, pillar.ty) : { x: bp.x + 176 * Math.cos(0.6 - (1.2 / 14) * 9), y: bp.y + 176 * Math.sin(0.6 - (1.2 / 14) * 9) };
      b.x = bp.x;
      b.y = bp.y;
      let hits = 0;
      let last = p.hp;
      const hold = (): void => {
        idle(b)();
        p.x = hp.x;
        p.y = hp.y;
        p.iframe = 0;
        if (p.hp < last) hits += 1;
        p.hp = last = p.maxHp;
      };
      use(b, { id: 'rime:breath', p: { arc: 1.2, beams: 14, len: 260, wind: 0.6, step: 0.05, mul: 1.3, ice: 0 } });
      run(w, 2, hold);
      expect(hits, sheltered ? 'behind the column' : 'in the open').toBe(sheltered ? 0 : 1);
      // and the wings: the open hero is driven back, the sheltered one stays put
      const d0 = Math.hypot(p.x - b.x, p.y - b.y);
      use(b, { id: 'rime:gust', p: { wind: 0.5, time: 1.2, push: 110, len: 260, arc: 0.8, icicles: 0 } });
      run(w, 0.5, () => {
        idle(b)();
        p.iframe = 99;
        p.x = hp.x;
        p.y = hp.y;
      });
      run(w, 1.4, () => {
        idle(b)();
        p.iframe = 99;
      });
      const moved = Math.hypot(p.x - b.x, p.y - b.y) - d0;
      if (sheltered) expect(moved).toBeLessThan(4);
      else expect(moved).toBeGreaterThan(60);
    }
  });

  it('Hrimfang’s war cry brings his huscarls in through the doors and hounds to his side, never more than four', () => {
    const { w, b } = arena('jarl-hrimfang');
    const p = w.player;
    const following = (): Enemy[] => w.enemies.filter((e) => !e.dead && !e.boss && e.room === b.room);
    use(b, { id: 'rime:warcry', p: { enemies: ['giant-huscarl', 'giant-huscarl'], hounds: 3 } });
    run(w, 1.6, () => {
      idle(b)();
      p.iframe = 99;
    });
    const adds = following();
    expect(adds).toHaveLength(4);
    const huscarls = adds.filter((e) => e.def.id === 'giant-huscarl');
    expect(huscarls).toHaveLength(2);
    // each came in by a door of the hall
    const doors = (w.map.doors[b.room] ?? []).map((i) => at(i % w.map.w, Math.floor(i / w.map.w)));
    for (const h of huscarls) expect(Math.min(...doors.map((d) => Math.hypot(d.x - h.homeX, d.y - h.homeY)))).toBeLessThan(4 * TILE);
    expect(adds.filter((e) => e.def.id === 'rime-hound').every((e) => Math.hypot(e.homeX - b.x, e.homeY - b.y) < 60)).toBe(true);
    // again: no room for more
    use(b, { id: 'rime:warcry', p: { enemies: ['giant-huscarl'], hounds: 2 } });
    run(w, 1.6, () => {
      idle(b)();
      p.iframe = 99;
    });
    expect(following()).toHaveLength(4);
  });
});
