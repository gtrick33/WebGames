/**
 * The Ring after the owner's notes of 2026-11-11: "let's make all the spells hit the target, without any misses",
 * "aoe spells could be a targeted projected area that you place, e.g. meteor", "instant low dmg spells could skip the
 * projectile phase", "buff the healing with 20% ... for the 2v2s and 35% for 3v3s", "make them 50% bigger with more
 * obstacles and healing spheres".
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, DASH, kitOf, PRESETS, SUPERS, type Ability } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { ARENA_H, ARENA_W, MAP_IDS, MAPS } from '../src/games/sigilfall/arena/maps';
import { BASE_SPEED, CLASS_DMG, GATES, HEAL_BY_SIZE, HERO_R, Match, ORB_EVERY, ORB_FIRST, ORB_HEAL, RANGED, type FighterSetup, type MatchEvent, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;
const fighter = (team: 0 | 1, cls: ClassId, bar?: string[]): FighterSetup => ({ team, cls, name: cls, bar: bar ?? PRESETS[cls][0]!.bar });
const EVERY: Ability[] = [...Object.values(ABILITIES), DASH];
const PLACED = EVERY.filter((a) => a.aim === 'ground');

/** A match with its gates open and everyone on open ground in front of the left entry: `foes` stand 70 off, a little apart. */
function open(cls: ClassId, bar: string[], foes: ClassId[] = ['warrior']): Match {
  const m = new Match({ seed: 5, map: 'sands', fighters: [fighter(0, cls, bar), ...foes.map((c) => fighter(1, c))] });
  m.step(GATES + 0.01, {});
  const me = m.fighters[0]!;
  me.x = 70;
  me.y = ARENA_H / 2;
  me.charge = 1;
  m.fighters.slice(1).forEach((f, i) => {
    f.x = 140 + i * 9;
    f.y = ARENA_H / 2 + i * 7;
  });
  me.target = 1;
  return m;
}

/** Presses a placed ability and, when it has a cast, waits the cast out: back with its patch on the ground. */
function place(m: Match, ab: Ability, point?: { x: number; y: number }, moves: Record<number, MoveInput> = {}): string | null {
  const why = m.press(0, ab.id, point);
  if (why) return why;
  for (let i = 0; i < 200 && m.fighters[0]!.cast; i++) m.step(STEP, moves);
  m.events.length = 0;
  return null;
}

/** Steps a match, keeping what happened. */
function run(m: Match, seconds: number, moves: Record<number, MoveInput> = {}): MatchEvent[] {
  const seen: MatchEvent[] = [];
  for (let i = 0; i < seconds / STEP; i++) {
    m.step(STEP, moves);
    seen.push(...m.events);
    m.events.length = 0;
  }
  return seen;
}

describe('The Ring: what is aimed at someone lands on them', () => {
  it('only a spell with a cast, or a super, flies; everything quick lands at once', () => {
    for (const ab of EVERY) {
      if (ab.bolt) expect(ab.cast > 0 || !!ab.super, `${ab.id} flies`).toBe(true);
      if (ab.zip) {
        expect(ab.cast, ab.id).toBe(0);
        expect(ab.bolt, ab.id).toBeFalsy();
        expect(ab.aim, ab.id).toBe('enemy');
      }
      // (nothing says it can be dodged any more, but what is placed)
      if (ab.aim !== 'ground') expect(ab.text, ab.id).not.toMatch(/dodge/i);
    }
    const m = open('ranger', ['r-swift', 'r-hobble', 'r-hush', 'r-hawk']);
    const foe = m.fighters[1]!;
    expect(m.press(0, 'r-swift')).toBeNull();
    expect(m.bolts).toHaveLength(0);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    // (an arrow that silences a cast does so the moment it is loosed)
    foe.cast = { ab: 'w-hew', target: 0, t: 0, dur: 2, channel: false, next: 0, pushed: 0 };
    expect(m.press(0, 'r-hush')).toBeNull();
    expect(foe.cast).toBeNull();
  });
});

describe('The Ring: what is placed', () => {
  it('every class that fights from range has one, with a patch and a fall, and says so', () => {
    for (const cls of CLASS_IDS) {
      if (!RANGED.has(cls)) continue;
      const mine = [...kitOf(cls), SUPERS[cls]].filter((a) => a.aim === 'ground');
      expect(mine.length, cls).toBeGreaterThanOrEqual(1);
    }
    expect(PLACED.length).toBeGreaterThanOrEqual(5);
    for (const ab of PLACED) {
      expect(ab.area, ab.id).toBeGreaterThan(20);
      expect(ab.fall, ab.id).toBeGreaterThan(0.2);
      expect(ab.fall, ab.id).toBeLessThanOrEqual(1);
      expect(ab.range, ab.id).toBeGreaterThan(100);
      expect(ab.bolt, ab.id).toBeFalsy();
      expect(ab.text, ab.id).toMatch(/patch of ground|where you choose/);
      // a patch is wider than a fighter walks while it falls: placed on someone, it lands on them
      expect(ab.area!, ab.id).toBeGreaterThanOrEqual(BASE_SPEED * ab.fall! * 1.1);
    }
  });

  it('with no point given (a computer player), it goes under the target: seen first, then it lands on everyone standing there', () => {
    for (const ab of PLACED) {
      const cls = ab.cls as ClassId;
      const m = open(cls, kitOf(cls).filter((a) => !a.super).slice(0, 3).map((a) => a.id).concat(ab.super ? [] : [ab.id]).slice(-4), ['warrior', 'mage']);
      if (!ab.super && !m.fighters[0]!.bar.includes(ab.id)) m.fighters[0]!.bar[0] = ab.id;
      const [, one, two] = m.fighters as [typeof m.fighters[0], typeof m.fighters[0], typeof m.fighters[0]];
      expect(place(m, ab), ab.id).toBeNull();
      expect(m.zones, ab.id).toHaveLength(1);
      const z = m.zones[0]!;
      expect([z.x, z.y, z.r]).toEqual([one.x, one.y, ab.area]);
      // (nothing yet: it is on its way)
      run(m, ab.fall! - 0.1);
      expect(one.hp, ab.id).toBe(one.maxHp);
      const seen = run(m, 0.2);
      expect(m.zones, ab.id).toHaveLength(0);
      expect(seen.some((e) => e.k === 'zone' && e.ab === ab.id), ab.id).toBe(true);
      expect(one.hp, ab.id).toBeLessThan(one.maxHp);
      expect(two.hp, ab.id).toBeLessThan(two.maxHp);
    }
  });

  it('once it is falling, walking does not get out from under it; a Swift Step does', () => {
    for (const ab of PLACED) {
      const cls = ab.cls as ClassId;
      const fate = (how: 'walk' | 'step'): number => {
        const m = open(cls, [ab.super ? kitOf(cls)[0]!.id : ab.id]);
        const foe = m.fighters[1]!;
        // (it is on the ground: only now can they know)
        expect(place(m, ab), ab.id).toBeNull();
        foe.dirX = 1;
        foe.dirY = 0;
        if (how === 'step') expect(m.press(1, DASH.id)).toBeNull();
        run(m, ab.fall! + 0.2, { 1: { mx: 1, my: 0 } });
        return foe.maxHp - foe.hp;
      };
      expect(fate('walk'), `${ab.id} walk`).toBeGreaterThan(0);
      expect(fate('step'), `${ab.id} step`).toBe(0);
    }
  });

  it('placed by hand, it goes where its user says: brought back into reach, and not where they can’t see', () => {
    const ab = ABILITIES['r-wind']!;
    const m = open('ranger', ['r-wind']);
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    // off to one side of the target: they are spared, the ground there is not
    expect(m.press(0, 'r-wind', { x: me.x + 60, y: me.y + 90 })).toBeNull();
    expect([m.zones[0]!.x, m.zones[0]!.y]).toEqual([me.x + 60, me.y + 90]);
    run(m, 1);
    expect(foe.hp).toBe(foe.maxHp);
    // past its reach: as far as it goes, that way
    me.cds = {};
    me.gcd = 0;
    expect(m.press(0, 'r-wind', { x: me.x + 4000, y: me.y })).toBeNull();
    expect(m.zones[0]!.x).toBeCloseTo(me.x + ab.range, 5);
    expect(m.zones[0]!.y).toBeCloseTo(me.y, 5);
    run(m, 1);
    // behind stone: not from here
    me.cds = {};
    me.gcd = 0;
    const p = m.pillars[0]!;
    me.x = p.x - 40;
    me.y = p.y + p.h / 2;
    expect(m.press(0, 'r-wind', { x: p.x + p.w + 30, y: p.y + p.h / 2 })).toBe('Out of sight');
    expect(m.zones).toHaveLength(0);
    // and a point means nothing to what isn't placed
    foe.x = me.x - 20;
    foe.y = me.y;
    me.bar = ['r-swift'];
    expect(m.press(0, 'r-swift', { x: 9999, y: 9999 })).toBeNull();
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });

  it('one with a cast is aimed when the cast begins: it comes down there, wherever they have gone', () => {
    const ab = ABILITIES['m-pyre']!;
    expect(ab.aim).toBe('ground');
    expect(ab.cast).toBeGreaterThan(1);
    const fate = (walks: boolean): number => {
      const m = open('mage', ['m-pyre']);
      const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
      const was = { x: foe.x, y: foe.y };
      expect(m.press(0, 'm-pyre')).toBeNull();
      expect(me.cast?.at).toEqual(was);
      // (nothing on the ground while it is being cast)
      run(m, 0.5, walks ? { 1: { mx: 1, my: 0 } } : {});
      expect(m.zones).toHaveLength(0);
      run(m, ab.cast - 0.5 + 0.05, walks ? { 1: { mx: 1, my: 0 } } : {});
      expect([m.zones[0]!.x, m.zones[0]!.y]).toEqual([was.x, was.y]);
      run(m, ab.fall! + 0.1, walks ? { 1: { mx: 1, my: 0 } } : {});
      return foe.maxHp - foe.hp;
    };
    expect(fate(false)).toBeGreaterThan(0);
    expect(fate(true)).toBe(0);
  });

  it('goes over a room’s wire with everything else', () => {
    const m = open('mage', ['m-lash']);
    expect(m.press(0, 'm-super')).toBeNull();
    const copy = new Match({ seed: 5, map: 'sands', fighters: [fighter(0, 'mage', ['m-lash']), fighter(1, 'warrior')] });
    copy.restore(JSON.parse(JSON.stringify(m.snapshot())) as ReturnType<Match['snapshot']>);
    expect(copy.zones).toEqual(m.zones);
    expect(copy.orbs).toEqual(m.orbs);
    // (between the host's words, a player's own copy lets it keep falling)
    copy.coast(0.3, null, null);
    expect(copy.zones[0]!.t).toBeCloseTo(m.zones[0]!.t - 0.3, 5);
  });

  it('the computer places its own, and they land', () => {
    let placed = 0;
    let hit = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const m = new Match({ seed, map: MAP_IDS[seed % 3]!, fighters: [fighter(0, 'mage', PRESETS.mage[0]!.bar), fighter(1, 'ranger', ['r-swift', 'r-wind', 'r-hobble', 'r-venom'])] });
      const brains = m.fighters.map((_, i) => newBrain(seed * 31 + i));
      let under = false;
      for (let i = 0; i < 30 * 200 && m.phase !== 'over'; i++) {
        const moves: Record<number, MoveInput> = {};
        for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.7, STEP);
        m.step(STEP, moves);
        for (const e of m.events) {
          if (e.k === 'zone') {
            placed++;
            under = true;
          } else if (e.k === 'land' && under && ABILITIES[e.ab]?.aim === 'ground') hit++;
        }
        under = false;
        m.events.length = 0;
      }
    }
    expect(placed).toBeGreaterThan(6);
    expect(hit).toBeGreaterThan(placed * 0.4);
  });
});

describe('The Ring: no class much above or below the rest', () => {
  it('each wins about half its matches when the computer plays every fighting setup against every other', () => {
    // (the owner, once shots stopped missing: "adjust the dmg so each class is somewhat balanced". The computer is
    // not a person: this guards the shares in CLASS_DMG against a change that tips one class over, no more.)
    const heals = (bar: string[]): boolean => bar.some((id) => ABILITIES[id]?.role === 'heal' && ABILITIES[id]?.aim === 'friend');
    const setups = (c: ClassId): (typeof PRESETS)[ClassId] => {
      const l = PRESETS[c].filter((p) => !heals(p.bar));
      return l.length ? l : [PRESETS[c][0]!];
    };
    const wins: Record<string, number> = {};
    const games: Record<string, number> = {};
    for (const a of CLASS_IDS) {
      for (const b of CLASS_IDS) {
        if (a >= b) continue;
        for (const pa of setups(a)) {
          for (const pb of setups(b)) {
            for (let seed = 1; seed <= 12; seed++) {
              const flip = seed % 2 === 1;
              const fa: FighterSetup = { team: flip ? 1 : 0, cls: a, name: a, bar: pa.bar, talents: pa.talents };
              const fb: FighterSetup = { team: flip ? 0 : 1, cls: b, name: b, bar: pb.bar, talents: pb.talents };
              const m = new Match({ seed, map: MAP_IDS[seed % 3]!, fighters: flip ? [fb, fa] : [fa, fb] });
              const brains = m.fighters.map((_, i) => newBrain(seed * 31 + i));
              for (let i = 0; i < 30 * 340 && m.phase !== 'over'; i++) {
                const moves: Record<number, MoveInput> = {};
                for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, seed % 2 ? 0.9 : 0.6, STEP);
                m.step(STEP, moves);
                m.events.length = 0;
              }
              // (a class counts the same however many setups it has)
              const w = 1 / setups(a).length / setups(b).length;
              games[a] = (games[a] ?? 0) + w;
              games[b] = (games[b] ?? 0) + w;
              if (m.winner === (flip ? 1 : 0)) wins[a] = (wins[a] ?? 0) + w;
              if (m.winner === (flip ? 0 : 1)) wins[b] = (wins[b] ?? 0) + w;
            }
          }
        }
      }
    }
    for (const c of CLASS_IDS) {
      const share = (wins[c] ?? 0) / games[c]!;
      expect(share, `${c} wins ${Math.round(share * 100)}% at ${CLASS_DMG[c]}`).toBeGreaterThan(0.36);
      expect(share, `${c} wins ${Math.round(share * 100)}% at ${CLASS_DMG[c]}`).toBeLessThan(0.64);
    }
  }, 180_000);
});

describe('The Ring: healing in bigger fights', () => {
  it('is a fifth stronger in 2v2 and 35% stronger in 3v3', () => {
    expect(HEAL_BY_SIZE.slice(1)).toEqual([1, 1.2, 1.35]);
    const healed = (size: number): number => {
      const side = (team: 0 | 1): FighterSetup[] => Array.from({ length: size }, () => fighter(team, 'druid', ['l-bloom', 'l-regrow', 'l-rejuv', 'l-moon']));
      const m = new Match({ seed: 9, map: 'sands', fighters: [...side(0), ...side(1)] });
      expect(m.healK).toBe(HEAL_BY_SIZE[size]);
      m.step(GATES + 0.01, {});
      const me = m.fighters[0]!;
      me.hp = 100;
      expect(m.press(0, 'l-bloom')).toBeNull();
      return me.hp - 100;
    };
    const one = healed(1);
    expect(one).toBeGreaterThan(100);
    expect(healed(2) / one).toBeCloseTo(1.2, 1);
    expect(healed(3) / one).toBeCloseTo(1.35, 1);
  });
});

describe('The Ring: bigger grounds', () => {
  const free = (id: string, x: number, y: number, pad: number): boolean => !MAPS[id]!.pillars.some((p) => x > p.x - pad && x < p.x + p.w + pad && y > p.y - pad && y < p.y + p.h + pad);

  it('half again as much ground, with more stone on it, the same from either end', () => {
    expect((ARENA_W * ARENA_H) / (548 * 250)).toBeGreaterThanOrEqual(1.5);
    expect((ARENA_W * ARENA_H) / (548 * 250)).toBeLessThan(1.7);
    const before: Record<string, number> = { sands: 4, frost: 5, forge: 3 };
    for (const id of MAP_IDS) {
      const stones = MAPS[id]!.pillars.filter((p) => !p.wall);
      expect(stones.length, id).toBeGreaterThanOrEqual(before[id]! + 3);
      for (const p of stones) {
        // its twin, turned half a circle about the middle
        expect(stones.some((q) => Math.abs(q.x - (ARENA_W - p.x - p.w)) < 0.01 && Math.abs(q.y - (ARENA_H - p.y - p.h)) < 0.01 && q.w === p.w && q.h === p.h), `${id} ${p.x},${p.y}`).toBe(true);
        // no two stones run into each other, and a fighter can pass between any two
        for (const q of stones) {
          if (q === p) continue;
          const gapX = Math.max(q.x - (p.x + p.w), p.x - (q.x + q.w));
          const gapY = Math.max(q.y - (p.y + p.h), p.y - (q.y + q.h));
          expect(Math.max(gapX, gapY), `${id} ${p.x},${p.y} and ${q.x},${q.y}`).toBeGreaterThanOrEqual(HERO_R * 2 + 4);
        }
        expect(p.x > 60 && p.x + p.w < ARENA_W - 60 && p.y > HERO_R * 2 + 6 && p.y + p.h < ARENA_H - HERO_R * 2 - 6, `${id} ${p.x},${p.y} off the walls`).toBe(true);
      }
      for (const team of MAPS[id]!.spawns) for (const [x, y] of team) expect(free(id, x, y, HERO_R), `${id} spawn`).toBe(true);
      const m = new Match({ seed: 1, map: id, fighters: [fighter(0, 'warrior'), fighter(1, 'mage')] });
      const s = m.sigilSpot();
      expect(free(id, s.x, s.y, 10), `${id} sigil`).toBe(true);
    }
  });

  it('healing spheres rise on each, give part of a life to whoever is hurt, and rise again', () => {
    for (const id of MAP_IDS) {
      const spots = MAPS[id]!.orbs;
      expect(spots.length, id).toBe(4);
      for (const [x, y] of spots) {
        expect(free(id, x, y, HERO_R + 9), `${id} sphere ${x},${y}`).toBe(true);
        expect(spots.some(([qx, qy]) => Math.abs(qx - (ARENA_W - x)) < 0.01 && Math.abs(qy - (ARENA_H - y)) < 0.01), `${id} sphere ${x},${y} has its twin`).toBe(true);
        // (not behind a stone: nothing stands within 70 to its south, in its column)
        expect(MAPS[id]!.pillars.some((p) => !p.wall && x > p.x - 12 && x < p.x + p.w + 12 && p.y > y && p.y - y < 70), `${id} sphere ${x},${y} is in the open`).toBe(false);
        // (reachable before the Gloam starts to close)
        expect(x > 50 && x < ARENA_W - 50 && y > 30 && y < ARENA_H - 30, id).toBe(true);
      }
    }
    const m = new Match({ seed: 3, map: 'sands', fighters: [fighter(0, 'warrior'), fighter(1, 'mage')] });
    m.step(GATES + 0.01, {});
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    foe.x = ARENA_W - 30;
    const o = m.orbs[0]!;
    me.x = o.x;
    me.y = o.y;
    me.hp = Math.round(me.maxHp / 2);
    // not there yet
    run(m, 1);
    expect(me.hp).toBe(Math.round(me.maxHp / 2));
    me.x = 60;
    run(m, ORB_FIRST);
    // unhurt, it is left for someone who needs it
    me.hp = me.maxHp;
    me.x = o.x;
    run(m, 0.2);
    expect(m.clock).toBeGreaterThanOrEqual(o.at);
    me.hp = Math.round(me.maxHp / 2);
    const seen = run(m, 0.1);
    expect(me.hp - Math.round(me.maxHp / 2)).toBe(Math.round(me.maxHp * ORB_HEAL));
    expect(seen.some((e) => e.k === 'orb' && e.id === 0)).toBe(true);
    expect(o.at).toBeGreaterThan(m.clock + ORB_EVERY - 1);
    // gone until then
    me.hp = Math.round(me.maxHp / 2);
    run(m, 1);
    expect(me.hp).toBe(Math.round(me.maxHp / 2));
  });
});
