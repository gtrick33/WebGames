/**
 * A harder game (the owner, 2026-11-15, after a level 34 mage walked through the Tomb of the Sun King without drinking a
 * potion): "scale down the dmg for every class this is insane, i want the game to feel hard af and be super rewarding when
 * you beat a boss"; "all the different bosses' abilities don't really matter whether they hit you or not, we want this
 * to matter ... the beam spell he did hurt me for around 10% of my health, we want every boss, every mob to feel
 * challenging and intimidating with huge damage spike".
 *
 * - Every hero's blows are half what they were from level 14 (none of it at level 4, where the first boss is met), the
 *   same for every class and every kind of blow, and the ultimate fills as fast as it did.
 * - A boss has half its health, everything in its room with it, so its fight is as long as it was; its blows hit harder
 *   and take at least a share of the hero's own health, however well they are dressed. Its barrages, the ground it
 *   leaves and the burns it lays wear a hero down as they did.
 * - The rank and file hit harder, and the blows they wind up for harder still; those in a boss's room don't.
 * - Heroic, Mythic and Riftstone keep their own measure: a Riftstone run's clock was set against the old blows.
 * - What every dungeon asks of the play-bot is in the dungeon tests (HARD_DEATHS).
 */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, hardening, HERO_DAMAGE, heroDamage } from '../src/games/sigilfall/data/classes';
import { BLOW_FLOOR, blowFloor, heroPower, hitEnemy } from '../src/games/sigilfall/sim/combat';
import { BOSS_DAMAGE, BOSS_HEALTH, bossDamage, emptyInput, MOB_DAMAGE, World, type World as W } from '../src/games/sigilfall/sim/world';
import { SPIKE } from '../src/games/sigilfall/sim/ai';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { ENEMIES, enemyScale } from '../src/games/sigilfall/data/enemies';
import { TILE } from '../src/games/sigilfall/sim/map';
import { newWorld, readyHero } from './sigilfall-bot';

const step = (w: W, s: number): void => {
  for (let t = 0; t < s; t += 1 / 60) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

/** A hero in a dungeon's boss room, the boss up and holding still. */
function bossRoom(level: number, region = 'tomb-of-the-sun-king' as const, cls: (typeof CLASS_IDS)[number] = 'mage'): { w: W; b: NonNullable<ReturnType<W['boss']>> } {
  const w = newWorld(region, readyHero(cls, level, 'rare'));
  const enc = [...w.encounters].reverse().find((e) => !!e.def.boss)!;
  for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
  const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
  for (let k = 0; k < 5; k++) w.step(1 / 60);
  const b = w.boss()!;
  b.boss!.rest = 999;
  return { w, b };
}

describe('Sigilfall: a harder game', () => {
  it('every hero hits half as hard from level 14, as hard as ever at level 4, and in between it grows', () => {
    expect(HERO_DAMAGE).toBe(0.5);
    expect(heroDamage(4)).toBe(1);
    expect(heroDamage(14)).toBe(0.5);
    expect(heroDamage(60)).toBe(0.5);
    expect(heroDamage(9)).toBeCloseTo(0.75);
    expect(hardening(3)).toBe(0);
    for (const cls of CLASS_IDS) {
      const w = newWorld('sunscorch', readyHero(cls, 34, 'rare'));
      w.enemies = [];
      const e = w.addEnemy('moss-slime', w.player.x + 4000, w.player.y, 34, { room: -1, pack: 0 });
      e.hp = e.maxHp = 1e9;
      e.def = { ...e.def, armor: 0, resist: {} };
      w.settings = { ...w.settings };
      // (no crit: the hero's chance taken away for the measure)
      w.build.stats = { ...w.build.stats, crit: 0 };
      const dealt = hitEnemy(w, e, 100, 'fire', { depth: 0 });
      expect(dealt, cls).toBe(Math.round(100 * heroPower(w, 'fire')));
      expect(heroPower(w, 'fire') / heroDamage(34), cls).toBeCloseTo((1 + 0.12 * 33) * (1 + ((w.build.stats.power ?? 0) + (w.build.stats.fire ?? 0)) / 100));
    }
  });

  it('a boss has half its health and hits harder; the rank and file hit harder; and those in its room do not', () => {
    expect(BOSS_HEALTH).toBe(HERO_DAMAGE);
    expect(BOSS_DAMAGE).toBeGreaterThan(1);
    expect(MOB_DAMAGE).toBeGreaterThan(1);
    expect(SPIKE).toBeGreaterThan(1);
    // (the first boss of all is met as it always was; the boss's own blows grow to the whole of it by level 30)
    expect(bossDamage(4)).toBe(1);
    expect(bossDamage(30)).toBe(BOSS_DAMAGE);
    const { w, b } = bossRoom(36);
    const add = w.addEnemy('tomb-scarab', b.x + 40, b.y, b.level, { room: b.room, pack: -1, spawn: true });
    const out = w.addEnemy('tomb-scarab', b.x + 40, b.y, b.level, { room: -1, pack: -1 });
    expect(add.maxHp).toBe(Math.round(out.maxHp * BOSS_HEALTH));
    expect(add.dmg * MOB_DAMAGE).toBeCloseTo(out.dmg);
  });

  it('a boss’s blow takes at least its floor of the hero’s health, however much of it they have', () => {
    for (const gear of [1, 3]) {
      const { w, b } = bossRoom(36);
      const p = w.player;
      p.maxHp = p.hp = Math.round(p.maxHp * gear);
      p.shield = 0;
      // a cleave of half again the boss's damage, from the boss's own turn
      w.asBoss(b, () => w.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: 30, r2: 0, angle: 0, len: 0, dur: 0.2, dmg: b.dmg * 1.5, knock: 0, tone: 'enemy', owner: -1, linger: 0 }));
      const before = p.hp;
      for (let i = 0; i < 30 && p.hp === before; i++) {
        p.iframe = 0;
        w.step(1 / 60);
      }
      expect(before - p.hp, `${gear}× health`).toBeGreaterThanOrEqual(Math.floor(p.maxHp * blowFloor(1.5, 1)) - 1);
      expect(blowFloor(1.5, 1)).toBeCloseTo(BLOW_FLOOR * 1.5);
    }
  });

  it('a boss’s barrage and the ground it leaves hurt shot for shot and tick for tick as they did', () => {
    const { w, b } = bossRoom(36);
    w.asBoss(b, () => {
      w.spawnProjectile({ x: b.x, y: b.y, vx: 0, vy: 0, r: 3, life: 10, dmg: 100, type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'stone', color: '#fff', hostile: true, child: false, knock: 0 });
      w.spawnField({ x: b.x, y: b.y, r: 10, dur: 2, tick: 0.5, dmg: 100, type: 'poison', status: { status: 'poison', dur: 2, power: 100 }, look: 'poison', hostile: true, depth: 0, spec: null, onHit: false });
    });
    expect(w.projectiles[w.projectiles.length - 1]!.dmg).toBeCloseTo(100 / bossDamage(b.level));
    const f = w.fields[w.fields.length - 1]!;
    expect(f.dmg).toBeCloseTo(100 / bossDamage(b.level));
    expect(f.status!.power).toBeCloseTo(100 / bossDamage(b.level));
    // and what it leaves to happen a moment later is still its doing
    w.asBoss(b, () => w.after(0.1, () => w.spawnField({ x: b.x, y: b.y, r: 10, dur: 2, tick: 0.5, dmg: 100, type: 'poison', look: 'poison', hostile: true, depth: 0, spec: null, onHit: false })));
    step(w, 0.2);
    expect(w.fields[w.fields.length - 1]!.dmg).toBeCloseTo(100 / bossDamage(b.level));
  });

  it('Heroic, Mythic and Riftstone keep their own measure: health to match the hero’s blows, and the old blows', () => {
    const hero = readyHero('warrior', 60, 'epic');
    const key = new World({ region: 'tomb-of-the-sun-king', tier: 2, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed: 1, key: 3, affixes: [], handIns: false });
    const mythic = newWorld('tomb-of-the-sun-king', readyHero('warrior', 60, 'epic'), 1, 2);
    const normal = newWorld('tomb-of-the-sun-king', readyHero('warrior', 60, 'epic'), 1, 0);
    expect(key.keyRun).not.toBeNull();
    for (const w of [key, mythic]) {
      expect(w.ownMeasure).toBe(true);
      expect(w.bossBoost(60)).toBe(1);
      const e = w.addEnemy('tomb-scarab', 0, 0, 60, { room: -1, pack: -1 });
      const def = ENEMIES['tomb-scarab']!;
      const mul = w as unknown as { hpMul(boss: boolean): number; dmgMul(boss: boolean): number };
      expect(e.maxHp).toBe(Math.round(def.hp * enemyScale(60).hp * mul.hpMul(false) * heroDamage(60)));
      expect(e.dmg).toBeCloseTo(def.dmg * enemyScale(60).dmg * mul.dmgMul(false));
    }
    expect(normal.ownMeasure).toBe(false);
    expect(normal.bossBoost(60)).toBe(BOSS_DAMAGE);
  });
});
