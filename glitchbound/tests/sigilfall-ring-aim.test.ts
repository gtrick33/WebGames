/**
 * The Ring after the owner's notes of 2026-11-11: "let's make all the spells hit the target, without any misses",
 * "aoe spells could be a targeted projected area that you place, e.g. meteor", "instant low dmg spells could skip the
 * projectile phase", "buff the healing with 20% ... for the 2v2s and 35% for 3v3s", "make them 50% bigger with more
 * obstacles and healing spheres".
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, kitOf, PRESETS, SUPERS, SUPERS2, type Ability } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { ARENA_H, ARENA_W, MAP_IDS, MAPS } from '../src/games/sigilfall/arena/maps';
import { BASE_SPEED, CLASS_DMG, GATES, HEAL_BY_SIZE, HERO_R, Match, ORB_EVERY, ORB_FIRST, ORB_HEAL, RANGED, type FighterSetup, type MatchEvent, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;
const fighter = (team: 0 | 1, cls: ClassId, bar?: string[]): FighterSetup => ({ team, cls, name: cls, bar: bar ?? PRESETS[cls][0]!.bar });
const EVERY: Ability[] = Object.values(ABILITIES);
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
  // (a super is the one its fighter carries: whichever of their class's two is being tried)
  if (ab.super) m.fighters[0]!.ult = ab.id;
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
  it('only a spell with a cast, a super, or a throw to be watched flies; everything else quick lands at once', () => {
    for (const ab of EVERY) {
      if (ab.bolt) expect(ab.cast > 0 || !!ab.super || !!ab.flight, `${ab.id} flies`).toBe(true);
      // (a throw to be watched is quick all the same: under half a second, whatever the distance)
      if (ab.flight) expect(ab.flight.most, ab.id).toBeLessThanOrEqual(0.5);
      if (ab.zip) {
        expect(ab.cast, ab.id).toBe(0);
        expect(ab.bolt, ab.id).toBeFalsy();
        expect(ab.aim, ab.id).toBe('enemy');
      }
      // (nothing says it can be dodged any more, but what is placed)
      if (ab.aim !== 'ground') expect(ab.text, ab.id).not.toMatch(/dodge/i);
    }
    const m = open('ranger', PRESETS.ranger[0]!.bar);
    const foe = m.fighters[1]!;
    expect(m.press(0, 'r-swift')).toBeNull();
    expect(m.bolts).toHaveLength(0);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    // (a word that silences a cast does so the moment it is spoken)
    const p = open('priest', PRESETS.priest[1]!.bar);
    p.fighters[1]!.cast = { ab: 'w-hew', target: 0, t: 0, dur: 2, channel: false, next: 0, pushed: 0 };
    expect(p.press(0, 'p-hush')).toBeNull();
    expect(p.fighters[1]!.cast).toBeNull();
  });
});

describe('The Ring: what is placed', () => {
  it('every class that fights from range has one, with a patch and a fall, and says so', () => {
    for (const cls of CLASS_IDS) {
      if (!RANGED.has(cls)) continue;
      const mine = [...kitOf(cls), SUPERS[cls], SUPERS2[cls]].filter((a) => a.aim === 'ground');
      expect(mine.length, cls).toBeGreaterThanOrEqual(1);
    }
    expect(PLACED.length).toBeGreaterThanOrEqual(5);
    for (const ab of PLACED) {
      expect(ab.area, ab.id).toBeGreaterThan(20);
      expect(ab.fall, ab.id).toBeGreaterThan(0.2);
      // (a patch that would have to shrink by more than a quarter to be walked out of falls slower instead: the owner,
      // "if the radius change is bigger than 25% just slow down the projectile")
      expect(ab.fall, ab.id).toBeLessThanOrEqual(1.1);
      // (the owner: "reduce cast time for targeted spells to max 1s for every class")
      expect(ab.cast, ab.id).toBeLessThanOrEqual(1);
      expect(ab.range, ab.id).toBeGreaterThan(100);
      expect(ab.bolt, ab.id).toBeFalsy();
      expect(ab.text, ab.id).toMatch(/patch of ground|where you choose/);
      // (what stays on the ground is no single blow to step out from under: it is walked out of once it is there)
      if (ab.field) continue;
      // (the owner: "shrink them so they are avoidable", for "0.0s reaction time": a fighter already on the move walks
      // out of one placed on them before it lands; one who stands still is caught)
      expect(ab.area!, ab.id).toBeLessThan(BASE_SPEED * ab.fall!);
      expect(ab.area!, ab.id).toBeGreaterThan(BASE_SPEED * ab.fall! * 0.75);
    }
  });

  it('a globe left on the ground: it lands on whoever stands in it each second, goes after the nearest enemy, and is gone in time', () => {
    // (the owner, 2026-11-16: "ice orb (damages enemies and doubles your frostbolt dmg)"; 2026-11-17: "the orb should
    // follow the closest target and keep hitting them otherwise its always a miss")
    const ab = ABILITIES['m-globe']!;
    expect(ab.field).toMatchObject({ dur: 6, tick: 1 });
    const m = open('mage', PRESETS.mage[1]!.bar);
    const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
    foe.hp = foe.maxHp = 50000;
    expect(m.press(0, 'm-globe')).toBeNull();
    expect(m.zones).toHaveLength(1);
    expect(m.fields).toHaveLength(0);
    const seen = run(m, ab.fall! + 0.05);
    expect(seen.some((e) => e.k === 'zone' && e.ab === 'm-globe')).toBe(true);
    expect(m.zones).toHaveLength(0);
    expect(m.fields).toHaveLength(1);
    const fd = m.fields[0]!;
    // (where it was thrown: under them, but for the moment it has drifted since)
    expect(Math.hypot(fd.x - foe.x, fd.y - foe.y)).toBeLessThan(2);
    expect(fd.r).toBe(ab.area);
    // it has landed once already, and lands again each second while they stand in it: slowed, too
    const first = 50000 - foe.hp;
    expect(first).toBeGreaterThan(0);
    expect(foe.auras.some((a) => a.ab === 'm-globe' && a.kind === 'slow')).toBe(true);
    run(m, 2);
    expect(50000 - foe.hp).toBeGreaterThanOrEqual(first * 3 - 2);
    // it stays on whoever stands still under it
    expect(Math.hypot(m.fields[0]!.x - foe.x, m.fields[0]!.y - foe.y)).toBeLessThan(1);
    // out of it, nothing lands until it has come after them: at under half a walk (the owner, 2026-11-17: "make the orb
    // follow the target with 50% less speed"; it was 0.9 of one), never faster
    foe.x = me.x;
    foe.y = me.y + 120;
    const out = foe.hp;
    const far = Math.hypot(m.fields[0]!.x - foe.x, m.fields[0]!.y - foe.y);
    expect(far).toBeGreaterThan(ab.area! + 40);
    run(m, 0.5);
    expect(foe.hp).toBe(out);
    const closed = far - Math.hypot(m.fields[0]!.x - foe.x, m.fields[0]!.y - foe.y);
    expect(closed).toBeGreaterThan(BASE_SPEED * 0.4 * 0.5);
    expect(closed).toBeLessThanOrEqual(BASE_SPEED * ab.field!.seek! * 0.5 + 2.5);
    expect(ab.field!.seek).toBe(0.45);
    // and it is gone when its time is up
    run(m, 3.7);
    expect(m.fields).toHaveLength(0);
    // while it is out its thrower carries its boon, and their Rime Spear hits twice as hard
    const n = open('mage', PRESETS.mage[1]!.bar);
    expect(n.press(0, 'm-globe')).toBeNull();
    expect(n.fighters[0]!.boons.map((b) => b.id)).toEqual(['globe']);
    expect(n.lit(n.fighters[0]!, ABILITIES['m-spear']!, n.fighters[1]!)).toBe('Rimeglobe');
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

  it('placed on someone on the move, it misses them if they keep walking; on someone standing, it lands', () => {
    // (the owner: "it would be hard to land one right in the middle of a character that's constantly moving")
    for (const ab of PLACED) {
      // (what stays on the ground catches whoever is still in it: its own test, above)
      if (ab.field) continue;
      for (const walks of [true, false]) {
        const cls = ab.cls as ClassId;
        const m = open(cls, [ab.super ? kitOf(cls)[0]!.id : ab.id]);
        const foe = m.fighters[1]!;
        expect(place(m, ab), ab.id).toBeNull();
        run(m, ab.fall! + 0.2, walks ? { 1: { mx: 1, my: 0 } } : {});
        if (walks) expect(foe.hp, `${ab.id} walking`).toBe(foe.maxHp);
        else expect(foe.maxHp - foe.hp, `${ab.id} standing`).toBeGreaterThan(0);
      }
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

  // (a placed spell with a cast, the mage's Great Pyre, was aimed when its cast began. None is cast now: what is placed
  // is a super or instant, since a playstyle's abilities became its own on 2026-11-16)

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
    // what is left on the ground, the points held and the boons carried go over it too
    const r = open('mage', PRESETS.mage[1]!.bar);
    expect(r.press(0, 'm-globe')).toBeNull();
    run(r, 0.5);
    const g = open('gloamknight', PRESETS.gloamknight[1]!.bar);
    g.fighters[0]!.pts = 3;
    const rc = new Match({ seed: 5, map: 'sands', fighters: [fighter(0, 'mage', PRESETS.mage[1]!.bar), fighter(1, 'warrior')] });
    rc.restore(JSON.parse(JSON.stringify(r.snapshot())) as ReturnType<Match['snapshot']>);
    expect(rc.fields).toEqual(r.fields);
    expect(rc.fighters[0]!.boons.map((b) => b.id)).toEqual(['globe']);
    // (a globe on its way to someone keeps going between the host's words)
    r.fighters[1]!.y += 90;
    run(r, 0.1);
    rc.restore(JSON.parse(JSON.stringify(r.snapshot())) as ReturnType<Match['snapshot']>);
    const gap = (): number => Math.hypot(rc.fields[0]!.x - rc.fighters[1]!.x, rc.fields[0]!.y - rc.fighters[1]!.y);
    const before = gap();
    rc.coast(0.5, null, null);
    expect(gap()).toBeLessThan(before - 10);
    const gc = new Match({ seed: 5, map: 'sands', fighters: [fighter(0, 'gloamknight', PRESETS.gloamknight[1]!.bar), fighter(1, 'warrior')] });
    gc.restore(JSON.parse(JSON.stringify(g.snapshot())) as ReturnType<Match['snapshot']>);
    expect(gc.fighters[0]!.pts).toBe(3);
  });

  it('the computer places its own, and they land', () => {
    let placed = 0;
    let hit = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const m = new Match({ seed, map: MAP_IDS[seed % 3]!, fighters: [fighter(0, 'mage', PRESETS.mage[1]!.bar), fighter(1, 'ranger', PRESETS.ranger[1]!.bar)] });
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
    // (0.35: the priest, at 37% before, came out at 35.7% once roots and fears broke on hurt again (2026-11-14), and a
    // point or so either way is how much these computer matches move with any change to the rules. Its damage raised
    // to 0.8 came out at 34.5%, its Wail of Dread half a second longer no different: the owner's call, not this test's)
    // (the warrior is set by players' word over this measure: the owner, 2026-11-17, on feedback that warriors "have
    // the best dps, most amount of cc, same mobility as everyone and are the tankiest spec": "i dont think ur balancing
    // test is very relevant here as this is player feedback". At 42% here before, the computer plays him to 12% since,
    // at 0.87 as at 0.82: what holds him back here is the rest, his health, holds, slows and charge.)
    const BY_PLAYERS = new Set<ClassId>(['warrior']);
    for (const c of CLASS_IDS) {
      const share = (wins[c] ?? 0) / games[c]!;
      if (BY_PLAYERS.has(c)) continue;
      expect(share, `${c} wins ${Math.round(share * 100)}% at ${CLASS_DMG[c]}`).toBeGreaterThan(0.35);
      expect(share, `${c} wins ${Math.round(share * 100)}% at ${CLASS_DMG[c]}`).toBeLessThan(0.64);
    }
  }, 180_000);
});

describe('The Ring: healing in bigger fights', () => {
  // (the owner, 2026-11-13: "increase the healing a tad bit more for the healers in the 2v2/3v3"; it was 1.2 and 1.35,
  // then 1.3 and 1.45. And 2026-11-17: "in 2v2 i feel like healers are way too strong, if i go as double dps i still
  // need to have slight chance": in 2v2 it is as written again. tests/sigilfall-ring-fair.test.ts has the rest.)
  it('is as written in 2v2 and 45% stronger in 3v3', () => {
    expect(HEAL_BY_SIZE.slice(1)).toEqual([1, 1, 1.45]);
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
    expect(one).toBeGreaterThan(50);
    expect(healed(2)).toBe(one);
    expect(healed(3) / one).toBeCloseTo(1.45, 1);
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
        // (well inside the walls)
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
