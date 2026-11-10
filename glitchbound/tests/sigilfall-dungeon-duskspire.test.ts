/**
 * Duskspire (level 60), the Hallow King's frozen citadel and the last fight of the story: over the Bone Bridge, through the Hall of Kneeling Dead, past Ser Maltheus to Vaelor on his throne of ice,
 * played through by the bot (tests/sigilfall-bot.ts): every class clears it at the level cap with the gear a
 * player would have by then, room by room, without getting stuck, and the last boss is a real fight. Its
 * bosses' attacks all exist and its rooms are registered.
 * And Lady Cendre's vigil: the dead she raises creep after the hero only while their back is turned, go still when
 * faced, and seize a hero they reach. And the Hallow King's own (sim/patterns/hallow-king.ts): his court kneeling and
 * rising, the Crown's call for Elyra's sigils and every power a sigil gives him, the Sun's glare that spares only his
 * shadow, the hero's own beaten foes remembered, and his family walking up the hall to him in his summer hour.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS, MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
// (after the patterns' index: a boss's own file imported first would meet itself half-loaded through combat)
import { vigilOfCendre } from '../src/games/sigilfall/sim/patterns/duskspire';
import { adriftOf, courtOf, crownOf, walkersOf } from '../src/games/sigilfall/sim/patterns/hallow-king';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { endScene } from '../src/games/sigilfall/sim/scene';
import { newWorld, play, readyHero, clearsWithRetry } from './sigilfall-bot';
import { gearAt, HARD_DEATHS } from './sigilfall-bot';

const REGION = 'duskspire';
const LEVEL = Math.min(MAX_LEVEL, REGIONS[REGION].level + 1);
const BOSS_ORDER = ['lady-cendre', 'hollow-guard', 'vaelor'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: Duskspire', () => {
  it('has its bosses in order, each in phases, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    for (const id of BOSS_ORDER) {
      expect(BOSSES[id]!.phases.length, id).toBeGreaterThanOrEqual(2);
      for (const ph of BOSSES[id]!.phases) for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
    }
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears Duskspire at level ${LEVEL}`, { timeout: 270_000 }, () => {
      const { w, r } = clearsWithRetry((seed) => {
        const w = newWorld(REGION, readyHero(cls as ClassId, LEVEL, gearAt(LEVEL)), seed);
        return { w, r: play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom }) };
      });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(HARD_DEATHS);
      // Vaelor is the hardest fight of the story, not a few seconds of burst
      expect(r.bossTimes['vaelor']).toBeGreaterThan(90);
    });
  }

  /** A hero in the Hall of Kneeling Dead, Lady Cendre up and doing only what she is told. */
  function hall(): { w: World; b: Enemy; step: (secs: number, aim: number | null) => void } {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss === 'lady-cendre')!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    if (w.scene) endScene(w, true);
    const b = w.boss()!;
    expect(b.def.id).toBe('lady-cendre');
    b.boss!.queue = [];
    b.boss!.pattern = null;
    const step = (secs: number, aim: number | null): void => {
      for (let k = 0; k < secs * 60; k++) {
        if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
        w.input = { ...emptyInput(), aim };
        w.step(1 / 60);
      }
    };
    return { w, b, step };
  }

  it('Lady Cendre’s dead keep still while the hero faces them, creep after them while their back is turned, and seize them', () => {
    const { w, b, step } = hall();
    const p = w.player;
    p.iframe = 99;
    b.boss!.queue = [{ id: 'dusk:vigil', w: 1, cd: 0, p: { count: 1, creep: 60, mul: 1.2 } }];
    b.boss!.rest = 0;
    step(1.5, 0);
    const d = vigilOfCendre(b)[0]!;
    expect(d).toBeTruthy();
    // put it to the hero's east, and face east: it stays where it is
    d.x = p.x + 90;
    d.y = p.y;
    step(1, 0);
    expect(Math.hypot(d.x - p.x, d.y - p.y)).toBeCloseTo(90, 0);
    // the hero turns west: it comes
    step(0.5, Math.PI);
    const near = Math.hypot(d.x - p.x, d.y - p.y);
    expect(near).toBeLessThan(80);
    // and when it reaches them, it seizes them and crumbles
    p.iframe = 0;
    const hp = p.hp;
    step(2, Math.PI);
    expect(p.hp).toBeLessThan(hp);
    expect(d.dead).toBe(true);
  });
  /** A hero in the throne room, the Hallow King up and doing only what he is told. */
  function throne(): { w: World; b: Enemy; step: (secs: number) => void; cast: (id: string, p?: Record<string, number | string>) => void } {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss === 'vaelor')!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    if (w.scene) endScene(w, true);
    const b = w.boss()!;
    expect(b.def.id).toBe('vaelor');
    const step = (secs: number): void => {
      for (let k = 0; k < secs * 60; k++) {
        if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
        w.input = emptyInput();
        w.step(1 / 60);
      }
    };
    // (his entrance plays out first: the court kneels, the Hollowing begins)
    step(2.5);
    b.boss!.queue = [];
    b.boss!.pattern = null;
    const cast = (id: string, p: Record<string, number | string> = {}): void => {
      b.boss!.queue = [{ id: id as never, w: 1, cd: 0, p }];
      b.boss!.rest = 0;
    };
    return { w, b, step, cast };
  }

  it('the Hallow King’s court kneels below his throne, and rises at his word', () => {
    const { w, b, step, cast } = throne();
    w.player.iframe = 99;
    const court = courtOf(b);
    expect(court.length).toBeGreaterThanOrEqual(6);
    expect(court.every((c) => c.def.id === 'court-of-the-dead' && c.y > b.y)).toBe(true);
    const before = court.length;
    cast('king:rise', { count: 2 });
    step(2);
    expect(courtOf(b).length).toBe(before - 2);
    expect(w.enemies.filter((e) => !e.dead && e.def.id === 'kneeling-dead').length).toBeGreaterThanOrEqual(2);
  });

  it('the Crown’s call: a sigil struck flies home to Elyra; one that reaches him is his, with its power, until he is hurt enough to lose it', () => {
    const { w, b, step, cast } = throne();
    w.player.iframe = 99;
    expect(crownOf(b)).toEqual(['stone']);
    expect(w.crown).toEqual(['stone']);
    cast('king:call', { count: 2, speed: 40 });
    step(1.6);
    const [a, c] = adriftOf(b);
    expect(a && c).toBeTruthy();
    // struck: home it goes
    hitEnemy(w, a!, 5, 'physical', { depth: 0 });
    step(0.2);
    expect(adriftOf(b).length).toBe(1);
    // the other reaches him: the Crown takes it, and shows it
    c!.x = b.x + b.r + 4;
    c!.y = b.y;
    step(0.2);
    const took = c!.def.id.replace('sigil-of-', '');
    expect(crownOf(b)).toEqual(['stone', took]);
    expect(w.crown).toEqual(['stone', took]);
    // its power is his: a sigil cast now may be the one he took
    let used = false;
    for (let k = 0; k < 12 && !used; k++) {
      cast('king:sigil');
      step(0.1);
      used = b.boss!.pattern?.use.id === 'king:sigil' && (b.boss!.pattern?.data.pw ?? -1) !== 0;
      step(6);
    }
    expect(used).toBe(true);
    // hurt him by a twentieth of his health: it breaks loose
    b.hp -= b.maxHp * 0.06;
    step(0.2);
    expect(crownOf(b)).toEqual(['stone']);
  });

  for (const sig of ['stone', 'embers', 'sun', 'thorns', 'frost', 'veil', 'tides']) {
    it(`the ${sig} sigil’s power threatens the hero and ends`, () => {
      const { w, b, step, cast } = throne();
      const from = { x: b.x, y: b.y, foes: w.enemies.filter((e) => !e.dead).length };
      // (the Tides raise this fight's dead: give it some)
      if (sig === 'tides') for (const c of courtOf(b).slice(0, 3)) hitEnemy(w, c, 1e6, 'physical', { depth: 0 });
      step(0.5);
      cast('king:sigil', { force: sig });
      let threat = false;
      let started = false;
      let ended = false;
      for (let k = 0; k < 12 * 60; k++) {
        w.player.iframe = 99;
        step(1 / 60);
        if (b.boss!.pattern?.use.id === 'king:sigil') started = true;
        else if (started) ended = true;
        threat ||=
          w.telegraphs.some((t) => t.owner !== -2 && !t.dead) ||
          w.fields.some((f) => f.hostile) ||
          Math.hypot(b.x - from.x, b.y - from.y) > 20 ||
          w.enemies.filter((e) => !e.dead).length > from.foes;
      }
      expect(started).toBe(true);
      expect(threat).toBe(true);
      expect(ended).toBe(true);
    });
  }

  it('the Sun sigil’s glare burns everything but the King’s own shadow, south of him down the hall', () => {
    const { w, b, cast } = throne();
    const p = w.player;
    for (const [dx, hurt] of [
      [0, false],
      [140, true],
    ] as const) {
      p.x = b.x + dx;
      p.y = b.y + 90;
      p.hp = p.maxHp;
      p.iframe = 0;
      for (const e of w.enemies) if (e !== b) e.dead = true;
      cast('king:sigil', { force: 'sun' });
      for (let k = 0; k < 3.2 * 60; k++) {
        p.x = b.x + dx;
        p.y = b.y + 90;
        p.iframe = 0;
        w.input = emptyInput();
        w.step(1 / 60);
        if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
      }
      // (the Hollowing drains a little all the while: the glare is what takes a twentieth at once)
      expect(p.maxHp - p.hp > p.maxHp * 0.05, `${dx}`).toBe(hurt);
    }
  });

  it('the Crown remembers the hero’s own beaten foes, and makes them soldiers again', () => {
    const { w, step, cast } = throne();
    w.player.iframe = 99;
    cast('king:remembered', { count: 2, life: 20 });
    step(2);
    const echoes = w.enemies.filter((e) => !e.dead && e.def.id.startsWith('echo-of-'));
    expect(echoes.length).toBe(2);
  });

  it('one summer’s hour: his queen and children walk up the hall to him, the Host comes for them and holds them; reaching him, he lets go', () => {
    const { w, b, step, cast } = throne();
    const p = w.player;
    p.iframe = 99;
    // (the hero up by the throne, away from the door the walkers come in at)
    p.x = b.x + 60;
    p.y = b.y + 20;
    cast('king:summer', { speed: 30, hunters: 3 });
    step(1.5);
    const walkers = walkersOf(b);
    expect(walkers.length).toBe(2);
    expect(w.kin.length).toBe(2);
    // the Host comes out of the walls for them, not for the hero, and holds them where it reaches them
    let held = false;
    for (let k = 0; k < 8 && !held; k++) {
      p.x = b.x + 60;
      p.y = b.y + 20;
      const at = walkers.map((x) => ({ x: x.x, y: x.y }));
      step(0.5);
      held = walkers.some((x, i) => Math.hypot(x.x - at[i]!.x, x.y - at[i]!.y) < 0.5);
    }
    expect(held).toBe(true);
    // the way cleared, they reach him: he is open to every blow, and wounded
    for (const e of w.enemies) if (e !== b && !e.def.id.startsWith('court')) e.dead = true;
    const hp = b.hp;
    for (let k = 0; k < 40 && walkersOf(b).length === 2; k++) step(0.5);
    expect(walkersOf(b).length).toBeLessThan(2);
    expect(b.boss!.dazed).toBeGreaterThan(0);
    expect(b.hp).toBeLessThan(hp);
  });
});
