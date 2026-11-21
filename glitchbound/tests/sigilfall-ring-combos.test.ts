/**
 * The Ring's combos after the owner's notes of 2026-11-16: "combos to be done with your basic spell or even ur ult",
 * "talents should be played around the combos and make the spells more fun", and what a combo can be besides one
 * ability after another: "orb could give you on screen effects ... where the ice lance like spell deals 3x dmg, or maybe
 * have the icicles stacked every time u deal frost bolt and launching ice lance fires them", "nightknife basic spells -
 * increases combo points ... eviscerate spell that consumes those combo points, the more the points the bigger the dmg".
 *
 * Three things, each tried here for every talent that has it and then by hand for each playstyle: points that one
 * ability builds and another spends; a boon that lights an ability up for one use (drawn at the edges of the screen:
 * tests/sigilfall-ring-boons.test.tsx); and what a talent makes of one ability by name.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, BOONS, CLASS_DMG, PRESETS, type Ability, type CcKind } from '../src/games/sigilfall/arena/abilities';
import { TALENT_BY_ID, TALENTS, type Talent } from '../src/games/sigilfall/arena/talents';
import { CRIT_K, GATES, HERO_R, HIT_K, Match, THRALL, type Fighter, type MoveInput, type Punch } from '../src/games/sigilfall/arena/sim';
import { TutorialRun, tutorialSetup } from '../src/games/sigilfall/arena/tutorial';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;

/** What the tests reach into: the rules' own steps, taken one at a time. */
interface Inside {
  rand: () => number;
  damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): number;
  crowd(f: Fighter, ab: Ability, t: Fighter, cc: CcKind, dur: number): boolean;
  land(f: Fighter, ab: Ability, t: Fighter, area: boolean, scale?: number, p?: Punch): void;
  arm(f: Fighter, ab: Ability): Punch;
  went(f: Fighter, ab: Ability): void;
  ticked(f: Fighter, ab: Ability): void;
  grant(f: Fighter, id: string, n?: number): void;
  give(f: Fighter, ab: Ability, on: 'land' | 'tick' | 'cast', crit?: boolean, full?: boolean): void;
  speedOf(f: Fighter): number;
}
const inside = (m: Match): Inside => m as unknown as Inside;
/** Every chance comes up (0) or none does (0.99). With no critical hits (fight() takes them away), numbers can be compared. */
const luck = (m: Match, v: 0 | 0.99): void => {
  inside(m).rand = () => v;
};

interface Who {
  team: 0 | 1;
  cls: ClassId;
  /** Its playstyle, by its place among the class's two (the one its talents belong to, when not said). */
  style?: number;
  talents?: string[];
  at?: [number, number];
}
/**
 * A fight with its gates open, no critical hits and no luck, each standing where told (or the first of each side face
 * to face, at arm's length), the first of each side aiming at the other's first.
 */
function fight(list: Who[]): Match {
  const styleOf = (w: Who) => {
    const spec = (w.talents ?? []).map((id) => TALENT_BY_ID[id]?.spec).find((x) => !!x);
    return w.style !== undefined ? PRESETS[w.cls][w.style]! : (PRESETS[w.cls].find((p) => p.id === spec) ?? PRESETS[w.cls][0]!);
  };
  const m = new Match({ seed: 5, map: 'sands', fighters: list.map((w) => ({ team: w.team, cls: w.cls, name: w.cls, bar: styleOf(w).bar, talents: w.talents ?? [] })) });
  m.step(GATES + 0.01, {});
  const firsts = [m.fighters.find((f) => f.team === 0)!, m.fighters.find((f) => f.team === 1)!];
  m.fighters.forEach((f, i) => {
    const w = list[i]!;
    const [x, y] = w.at ?? (f === firsts[0] ? [200, 125] : f === firsts[1] ? [215, 125] : [200 + (f.team ? 40 : -40), 150]);
    f.x = x;
    f.y = y;
    f.mods.crit = 0;
    f.auras = [];
    f.target = firsts[f.team ? 0 : 1]!.id;
    f.dirX = f.team ? -1 : 1;
    f.dirY = 0;
  });
  luck(m, 0.99);
  m.events.length = 0;
  return m;
}
const wait = (m: Match, seconds: number, moves: Record<number, MoveInput> = {}): void => {
  for (let i = 0; i < seconds / STEP; i++) m.step(STEP, moves);
};
const AB = (id: string): Ability => ABILITIES[id]!;
const has = (f: Fighter, ab: string, kind?: string): boolean => f.auras.some((a) => a.ab === ab && (!kind || a.kind === kind));
const boon = (f: Fighter, id: string): number => f.boons.find((b) => b.id === id)?.n ?? 0;
/** A fighter with one talent against a warrior (with plenty of health, so nothing kills), and the two of them. */
function duel(cls: ClassId, talent: string | null, foe: ClassId = 'warrior', style?: number): { m: Match; me: Fighter; foe: Fighter } {
  const m = fight([{ team: 0, cls, talents: talent ? [talent] : [], style }, { team: 1, cls: foe }]);
  const [me, f] = m.fighters as [Fighter, Fighter];
  f.hp = f.maxHp = 50000;
  return { m, me, foe: f };
}
/** Presses an ability with nothing to wait for, and says what it took off the target (a cast is waited out). */
function strike(m: Match, me: Fighter, foe: Fighter, id: string): number {
  me.gcd = 0;
  const hp = foe.hp;
  expect(m.press(me.id, id), id).toBeNull();
  for (let i = 0; i < 90 && (me.cast || m.bolts.length); i++) m.step(STEP, {});
  return hp - foe.hp;
}
const words = (m: Match): string[] => m.events.flatMap((e) => (e.k === 'word' && e.combo ? [e.word] : []));
const ALL: Talent[] = Object.values(TALENTS).flat();

describe('The Ring: points, built by one ability and spent by another', () => {
  it('every talent that gives points names what builds them and what spends them, and the rules do as it says', () => {
    const withPoints = ALL.filter((t) => t.points);
    // (one for each playstyle that has none of its own: every playstyle but the Nightblade, who is born with them; the
    // Gravecaller, whose talent of that kind is a third of the dead; and the Starseer, whose count to a fourth star
    // needs no spending)
    const without = CLASS_IDS.flatMap((c) => PRESETS[c].filter((p) => !p.points && !withPoints.some((t) => t.cls === c && t.spec === p.id)).map((p) => p.name));
    expect(without.sort()).toEqual(['Gravecaller', 'Starseer']);
    expect(new Set(withPoints.map((t) => `${t.cls}/${t.spec}`)).size).toBe(withPoints.length);
    for (const t of withPoints) {
      const { m, me, foe } = duel(t.cls, t.id);
      const pts = t.points!;
      expect(me.points, t.id).toEqual(pts);
      expect(me.pts).toBe(0);
      const builders = Object.entries(t.tune!).filter(([, x]) => x.build);
      const spenders = Object.entries(t.tune!).filter(([, x]) => x.spend);
      expect(builders.length, t.id).toBeGreaterThanOrEqual(1);
      expect(spenders.length, t.id).toBe(1);
      // a spender is never the thing pressed all the time: it is no builder itself
      expect(builders.some(([id]) => id === spenders[0]![0]), t.id).toBe(false);
      for (const [id, x] of builders) {
        me.pts = 0;
        const on = x.build!.on ?? 'land';
        const friendly = AB(id).aim === 'friend';
        const once = (): void => {
          if (on === 'tick') inside(m).ticked(me, AB(id));
          else if (on === 'cast') inside(m).went(me, AB(id));
          else inside(m).land(me, AB(id), friendly ? me : foe, false);
        };
        once();
        expect(me.pts, `${t.id}: ${id} builds`).toBe(Math.min(pts.max, x.build!.n));
        for (let i = 0; i < pts.max + 2; i++) once();
        expect(me.pts, `${t.id}: no more than ${pts.max}`).toBe(pts.max);
      }
      // the spender: lit when no more can be held, and every point spent makes it that much stronger
      const [sid, sx] = spenders[0]!;
      expect(m.lit(me, AB(sid), foe), t.id).toBe(`${pts.max} ${pts.name}`);
      const p = inside(m).arm(me, AB(sid));
      expect(p.k, t.id).toBeCloseTo(1 + sx.spend!.per * pts.max, 5);
      expect(p.pts).toBe(pts.max);
      expect(p.full).toBe(true);
      expect(me.pts).toBe(0);
      expect(m.lit(me, AB(sid), null), t.id).toBeNull();
      // (and with none to spend it is the ability it always was)
      expect(inside(m).arm(me, AB(sid)).k).toBe(1);
      // its words say how many, and how much each is worth
      expect(t.text, t.id).toContain(`up to ${pts.max}`);
      expect(t.text, t.id).toContain(`${Math.round(sx.spend!.per * 100)}%`);
    }
  });

  it('without the talent a playstyle has none: nothing is built, nothing is spent, nothing is shown', () => {
    for (const cls of CLASS_IDS) {
      for (const [i, p] of PRESETS[cls].entries()) {
        const { m, me, foe } = duel(cls, null, 'warrior', i);
        if (p.points) continue;
        expect(me.points, p.name).toBeNull();
        for (const id of p.bar) if (AB(id).aim === 'enemy') inside(m).land(me, AB(id), foe, false);
        expect(me.pts, p.name).toBe(0);
      }
    }
  });

  it('Rimeshards: each Rime Spear that lands leaves one, and Frostfang looses them all', () => {
    // (the owner: "have the icicles stacked every time u deal frost bolt and launching ice lance fires them")
    const { m, me, foe } = duel('mage', 'm-frost-1b');
    const plain = strike(m, me, foe, 'm-fang');
    me.cds = {};
    // (a shard for a spear that lands, not for one still in the air)
    me.gcd = 0;
    expect(m.press(0, 'm-spear')).toBeNull();
    expect(me.pts).toBe(0);
    wait(m, 1);
    expect(me.pts).toBe(1);
    for (let i = 0; i < 3; i++) strike(m, me, foe, 'm-spear');
    expect(me.pts).toBe(4);
    foe.auras = [];
    const loosed = strike(m, me, foe, 'm-fang');
    expect(loosed / plain).toBeCloseTo(1 + 0.3 * 4, 1);
    expect(me.pts).toBe(0);
    // loosed with three or more, it is a combo landed
    expect(me.score.combos).toBe(1);
  });

  it('Mounting Ire: Hock Cut builds it, Rending Cut spends it on blow and bleed alike, and Run Them Down fills it', () => {
    const { m, me, foe } = duel('warrior', 'w-pin-1a');
    for (let i = 0; i < 3; i++) strike(m, me, foe, 'w-hamstring');
    expect(me.pts).toBe(3);
    strike(m, me, foe, 'w-bleed');
    expect(me.pts).toBe(0);
    const bleed = foe.auras.find((a) => a.ab === 'w-bleed' && a.kind === 'dot')!;
    // (its combo on a hobbled target, and 20% for each of the three)
    const dot = AB('w-bleed').effects.find((e) => e.k === 'dot') as { n: number; dur: number };
    expect(bleed.n).toBeCloseTo((dot.n / dot.dur) * AB('w-bleed').combo!.mult * (1 + 0.2 * 3), 3);
    me.charge = 1;
    expect(m.press(0, 'w-super2')).toBeNull();
    expect(me.pts).toBe(5);
  });

  it('Ripening: a point of Rot for each time the Creeping Agony burns, spent by Hex Bloom', () => {
    const { m, me, foe } = duel('warlock', 'k-curses-1a', 'warrior');
    strike(m, me, foe, 'k-dart');
    expect(me.pts).toBe(0);
    wait(m, 3.1);
    expect(me.pts).toBe(3);
    me.pts = 5;
    const p = inside(m).arm(me, AB('k-bloom'));
    expect(p.k).toBeCloseTo(2, 5);
  });

  it('Oathsworn: each Dawn’s Touch swears one, and Verdict spends them on a blow that heals the friend most hurt', () => {
    const m = fight([{ team: 0, cls: 'paladin', talents: ['d-holy-1a'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'mage', at: [180, 130] }]);
    const [pal, foe, friend] = m.fighters as [Fighter, Fighter, Fighter];
    foe.hp = foe.maxHp = 50000;
    pal.friend = pal.id;
    for (let i = 0; i < 4; i++) {
      pal.gcd = 0;
      expect(m.press(0, 'd-flash')).toBeNull();
      wait(m, 1);
    }
    expect(pal.pts).toBe(3);
    friend.hp = 300;
    pal.gcd = 0;
    const hp = foe.hp;
    expect(m.press(0, 'd-judge')).toBeNull();
    const dealt = hp - foe.hp;
    const plain = AB('d-judge').effects.find((e) => e.k === 'dmg') as { n: number };
    expect(dealt).toBeGreaterThan(plain.n * CLASS_DMG.paladin * (1 + 0.3 * 3));
    expect(pal.pts).toBe(0);
    // (healed for what it dealt, as a heal is: a little under its number, more in no bigger fight than this)
    expect(friend.hp).toBeGreaterThan(300 + dealt * 0.7);
    expect(friend.hp).toBeLessThanOrEqual(300 + dealt * 1.6);
  });

  it('Counted Prayers: Knit Wounds counts them, and Ward of Faith spends them on a stronger ward', () => {
    const { m, me } = duel('priest', 'p-healer-1b');
    me.friend = me.id;
    me.pts = 3;
    me.gcd = 0;
    expect(m.press(0, 'p-ward')).toBeNull();
    const ward = (AB('p-ward').effects.find((e) => e.k === 'absorb') as { n: number }).n;
    expect(me.auras.find((a) => a.ab === 'p-ward' && a.kind === 'absorb')!.n).toBe(Math.round(ward * (1 + 0.2 * 3)));
    expect(me.pts).toBe(0);
  });
});

describe('The Ring: boons, that light an ability up', () => {
  /** Every talent that gives a boon, with what gives it and what uses it. */
  const givers = ALL.flatMap((t) => Object.entries(t.tune ?? {}).flatMap(([id, x]) => (x.gives ?? []).map((g) => ({ t, id, g }))));

  it('every boon is given by something and used by something of the same playstyle, and says what it does', () => {
    const used = new Set<string>();
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        const mine = [...p.bar, p.ult].map(AB);
        const talents = ALL.filter((t) => t.cls === cls && t.spec === p.id);
        const gives = [...mine.flatMap((a) => a.gives ?? []), ...talents.flatMap((t) => Object.values(t.tune ?? {}).flatMap((x) => x.gives ?? []))].map((g) => g.boon);
        const uses = [...mine.flatMap((a) => a.uses ?? []), ...talents.flatMap((t) => Object.values(t.tune ?? {}).flatMap((x) => x.uses ?? []))].map((u) => u.boon);
        for (const b of gives) expect(uses, `${p.name}: nothing uses ${b}`).toContain(b);
        for (const b of uses) expect(gives, `${p.name}: nothing gives ${b}`).toContain(b);
        for (const b of gives) used.add(b);
      }
    }
    expect([...used].sort()).toEqual(Object.keys(BOONS).sort());
    for (const b of Object.values(BOONS)) {
      expect(b.text, b.id).toMatch(/^(Your next|While) .*\.$/);
      expect(b.dur, b.id).toBeGreaterThanOrEqual(6);
      expect(b.dur, b.id).toBeLessThanOrEqual(10);
    }
    // every class has one at least that lights the screen, in a manner of its own
    for (const cls of CLASS_IDS) {
      const looks = new Set(ALL.filter((t) => t.cls === cls).flatMap((t) => Object.values(t.tune ?? {}).flatMap((x) => (x.gives ?? []).map((g) => BOONS[g.boon]!))).filter((b) => !b.quiet).map((b) => b.look));
      expect(looks.size, cls).toBeGreaterThanOrEqual(1);
      for (const other of CLASS_IDS) {
        if (other === cls) continue;
        const theirs = new Set(ALL.filter((t) => t.cls === other).flatMap((t) => Object.values(t.tune ?? {}).flatMap((x) => (x.gives ?? []).map((g) => BOONS[g.boon]!.look))));
        for (const l of looks) expect(theirs.has(l), `${cls} and ${other} both ${l}`).toBe(false);
      }
    }
  });

  it('each is given when its talent says: as it lands, as it burns, as it goes off, by chance or by count', () => {
    expect(givers.length).toBeGreaterThanOrEqual(16);
    for (const { t, id, g } of givers) {
      const { m, me, foe } = duel(t.cls, t.id);
      const def = BOONS[g.boon]!;
      const on = g.on ?? 'land';
      const once = (p: Punch = { k: 1 }): void => {
        if (on === 'tick') inside(m).ticked(me, AB(id));
        else if (on === 'cast') inside(m).went(me, AB(id));
        // (a trap lands when it catches someone, not when it is laid: its own test is below)
        else if (AB(id).effects.some((e) => e.k === 'trap')) inside(m).give(me, AB(id), 'land');
        else inside(m).land(me, AB(id), AB(id).aim === 'friend' || AB(id).aim === 'self' ? me : foe, false, 1, p);
      };
      // with no luck, and before its count: nothing (unless it is given every time)
      luck(m, 0.99);
      once();
      const sure = g.chance === undefined && !g.every && !g.full;
      expect(boon(me, g.boon), `${t.id}: ${id} unlucky`).toBe(sure ? 1 : 0);
      // with luck (or a full spend, or the count reached): given, and its light is asked for
      luck(m, 0);
      me.boons = [];
      me.counts = {};
      m.events.length = 0;
      for (let i = 0; i < (g.every ?? 1); i++) once({ k: 1, full: true });
      expect(boon(me, g.boon), `${t.id}: ${id} gives ${g.boon}`).toBe(1);
      expect(m.events.some((e) => e.k === 'boon' && e.id === me.id && e.boon === g.boon), t.id).toBe(true);
      // held as many times as it can be, and no more
      for (let i = 0; i < 4 * (g.every ?? 1); i++) once({ k: 1, full: true });
      expect(boon(me, g.boon), `${t.id}: at most ${def.max ?? 1}`).toBe(def.max ?? 1);
      // not used, it runs out
      wait(m, def.dur + 0.2);
      if (on !== 'tick') expect(boon(me, g.boon), `${t.id}: ${g.boon} runs out`).toBe(0);
      // its words name the boon and how it comes
      // (most are named for it; one that isn't speaks of it)
      expect(t.name === def.name || t.text.toLowerCase().includes(def.name.toLowerCase().replace(/ed$/, '')), `${t.id} names ${def.name}`).toBe(true);
      if (g.chance !== undefined) expect(t.text, t.id).toContain(`${Math.round(g.chance * 100)}% chance`);
      if (g.crit) expect(t.text, t.id).toMatch(/always on a critical hit/);
      if (g.every) expect(t.text, t.id).toMatch(/Every third/);
    }
  });

  it('each makes of its ability what its talent says, for one use: instant, ready at once, stronger, and then it is gone', () => {
    const users = [...ALL.flatMap((t) => Object.entries(t.tune ?? {}).flatMap(([id, x]) => (x.uses ?? []).map((u) => ({ cls: t.cls, talent: t.id as string | null, style: undefined as number | undefined, id, u })))), ...CLASS_IDS.flatMap((cls) => PRESETS[cls].flatMap((p, style) => p.bar.flatMap((id) => (AB(id).uses ?? []).map((u) => ({ cls, talent: null as string | null, style: style as number | undefined, id, u })))))];
    expect(users.length).toBeGreaterThanOrEqual(18);
    for (const { cls, talent, style, id, u } of users) {
      const { m, me, foe } = duel(cls, talent, 'warrior', style);
      const ab = AB(id);
      const def = BOONS[u.boon]!;
      const tag = `${talent ?? cls}: ${id} with ${u.boon}`;
      expect(m.lit(me, ab, foe) === def.name, `${tag} unlit`).toBe(false);
      inside(m).grant(me, u.boon);
      // lit by the boon's own name, and by nothing else first
      expect(m.lit(me, ab, foe), tag).toBe(def.name);
      const how = m.how(me, ab).uses.find((x) => x.boon === u.boon)!;
      if (how.instant) {
        expect(ab.cast, tag).toBeGreaterThan(0);
        expect(m.castOf(me, ab), tag).toBe(0);
      }
      if (how.nocd) {
        expect(ab.cd, tag).toBeGreaterThan(0);
        me.cds[id] = 5;
        expect(m.blocked(me, ab, ab.aim === 'friend' ? me : foe), tag).toBeNull();
      }
      const p = inside(m).arm(me, ab);
      expect(p.k, tag).toBeCloseTo(how.mult ?? 1, 5);
      expect(!!p.crit, tag).toBe(!!how.crit);
      expect(!!p.combo, tag).toBe(!!how.asCombo);
      expect(p.drink, tag).toBe(how.drink);
      expect(p.build, tag).toBe(how.build);
      expect(p.extra?.length ?? 0, tag).toBe(how.extra?.length ?? 0);
      // used up, unless it works for as long as it lasts; and called out by name as it lands
      expect(boon(me, u.boon), tag).toBe(how.keep ? 1 : 0);
      expect(p.said, tag).toBe(how.keep ? undefined : def.name);
      if (!how.keep && how.nocd) expect(m.blocked(me, ab, ab.aim === 'friend' ? me : foe), tag).toBe('Not ready yet');
    }
  });

  it('Red Mist: a lucky Hew brings it on, and the Gash it lights is ready at once, harder, and starts no cooldown', () => {
    const { m, me, foe } = duel('warrior', 'w-arms-1a');
    strike(m, me, foe, 'w-hew');
    expect(boon(me, 'mist')).toBe(0);
    const plain = strike(m, me, foe, 'w-gash');
    foe.auras = [];
    expect(me.cds['w-gash']).toBeGreaterThan(5);
    expect(m.press(0, 'w-gash')).toBe('Not ready yet');
    luck(m, 0);
    strike(m, me, foe, 'w-hew');
    expect(boon(me, 'mist')).toBe(1);
    foe.auras = [];
    const cd = me.cds['w-gash']!;
    m.events.length = 0;
    const lit = strike(m, me, foe, 'w-gash');
    expect(lit / plain).toBeCloseTo(1.5, 1);
    expect(words(m)).toContain('Red Mist');
    expect(boon(me, 'mist')).toBe(0);
    // (the cooldown it had is left running, no longer and no shorter)
    expect(me.cds['w-gash']).toBeCloseTo(cd, 1);
    expect(me.score.combos).toBeGreaterThanOrEqual(1);
    // and always on a critical hit, whatever the luck
    const c = duel('warrior', 'w-arms-1a');
    c.me.mods.crit = 1;
    strike(c.m, c.me, c.foe, 'w-hew');
    expect(boon(c.me, 'mist')).toBe(1);
  });

  it('Hoarfrost: the globe’s chill gives it, twice over at most, and the Frostfang it lights shatters as if they were frozen', () => {
    // (the owner: "orb could give you on screen effects ... where the ice lance like spell deals 3x dmg")
    const { m, me, foe } = duel('mage', 'm-frost-1a');
    const plain = strike(m, me, foe, 'm-fang');
    luck(m, 0);
    me.gcd = 0;
    expect(m.press(0, 'm-globe')).toBeNull();
    wait(m, 0.4);
    expect(boon(me, 'hoar')).toBe(1);
    wait(m, 2.1);
    expect(boon(me, 'hoar')).toBe(2);
    luck(m, 0.99);
    // (out of the globe: nothing more, and what it left on them wears off)
    foe.x += 120;
    wait(m, 2);
    foe.x -= 120;
    foe.auras = [];
    expect(m.comboReady(me, AB('m-fang'), foe)).toBeNull();
    expect(m.lit(me, AB('m-fang'), foe)).toBe('Hoarfrost');
    m.events.length = 0;
    const lit = strike(m, me, foe, 'm-fang');
    expect(lit / plain).toBeCloseTo(AB('m-fang').combo!.mult, 1);
    expect(words(m)).toContain('Shatter');
    expect(boon(me, 'hoar')).toBe(1);
    // ready at once: the second straight after the first
    expect(strike(m, me, foe, 'm-fang') / plain).toBeCloseTo(AB('m-fang').combo!.mult, 1);
    expect(boon(me, 'hoar')).toBe(0);
    expect(m.press(0, 'm-fang')).toBe('Not ready yet');
  });

  it('Cinderheart: lit by a critical Ember Lash, and the Flashburn it lights is ready at once and a critical hit', () => {
    const { m, me, foe } = duel('mage', 'm-fire-1a');
    const plain = strike(m, me, foe, 'm-burn');
    foe.auras = [];
    me.mods.crit = 1;
    strike(m, me, foe, 'm-lash');
    expect(boon(me, 'cinder')).toBe(1);
    me.mods.crit = 0;
    foe.auras = [];
    expect(me.cds['m-burn']).toBeGreaterThan(0);
    const lit = strike(m, me, foe, 'm-burn');
    expect(lit / plain).toBeCloseTo(CRIT_K, 1);
    expect(boon(me, 'cinder')).toBe(0);
  });

  it('Still Breath: every third Swift Shot, and the Long Draw it lights is loosed at once, on the move', () => {
    const { m, me, foe } = duel('ranger', 'r-sniper-1a');
    strike(m, me, foe, 'r-swift');
    strike(m, me, foe, 'r-swift');
    expect(boon(me, 'breath')).toBe(0);
    strike(m, me, foe, 'r-swift');
    expect(boon(me, 'breath')).toBe(1);
    me.cds['r-aimed'] = 6;
    me.gcd = 0;
    const hp = foe.hp;
    expect(m.press(0, 'r-aimed')).toBeNull();
    // (no cast: it is in the air, or landed, at once)
    expect(me.cast).toBeNull();
    wait(m, 0.5);
    expect(foe.hp).toBeLessThan(hp);
    expect(boon(me, 'breath')).toBe(0);
  });

  it('Answered Prayer: a Bright Rebuke is answered, twice over at most, and the Knit Wounds it lights is instant and heals more', () => {
    const { m, me, foe } = duel('priest', 'p-healer-1a');
    me.friend = me.id;
    const heal = (): number => {
      me.hp = 200;
      me.gcd = 0;
      expect(m.press(0, 'p-mend')).toBeNull();
      const instant = !me.cast;
      wait(m, 1);
      return instant ? -(me.hp - 200) : me.hp - 200;
    };
    const plain = heal();
    expect(plain).toBeGreaterThan(0);
    strike(m, me, foe, 'p-smite');
    me.cds = {};
    strike(m, me, foe, 'p-smite');
    me.cds = {};
    strike(m, me, foe, 'p-smite');
    expect(boon(me, 'answer')).toBe(2);
    // (instant: said here as a negative, so that the two can be told apart)
    const lit = heal();
    expect(lit).toBeLessThan(0);
    expect(-lit / plain).toBeCloseTo(1.3, 1);
    expect(boon(me, 'answer')).toBe(1);
  });

  it('Blood Up, Dire Portent, Gathering Dark, Verdant Surge and Falling Star: given as their burn ticks on someone', () => {
    for (const [cls, talent, burn, b] of [
      ['warrior', 'w-pin-1b', 'w-bleed', 'bloodup'],
      ['priest', 'p-shadow-1a', 'p-curse', 'omen'],
      ['warlock', 'k-curses-1b', 'k-dart', 'gathering'],
      ['druid', 'l-heal-1b', 'l-petal', 'surge'],
      ['druid', 'l-star-1a', 'l-moon', 'star'],
    ] as const) {
      const { m, me, foe } = duel(cls, talent);
      strike(m, me, foe, burn);
      expect(boon(me, b), talent).toBe(0);
      luck(m, 0);
      // (given by the burn, a second later, not by the blow that lit it)
      wait(m, 1.1);
      expect(boon(me, b), talent).toBe(1);
      // and nothing of anyone else's burning on them gives it
      const other = duel(cls, talent);
      luck(other.m, 0);
      other.foe.auras.push({ ab: burn, kind: 'dot', src: other.foe.id, t: 5, dur: 5, harmful: true, magic: true, n: 5, next: 0.5 });
      wait(other.m, 1.1);
      expect(boon(other.me, b), `${talent}: another's burn`).toBe(0);
    }
  });

  it('Grave Chill: each claw of the dead may send one, and it makes the next Gloom Bolt instant', () => {
    const { m, me, foe } = duel('warlock', 'k-grave-1a');
    Object.assign(foe, { x: 260, y: 125 });
    strike(m, me, foe, 'k-raise');
    luck(m, 0);
    wait(m, 4);
    expect(m.fighters.filter((f) => f.pet && !f.dead)).toHaveLength(2);
    expect(boon(me, 'chill')).toBe(2);
    expect(m.castOf(me, AB('k-bolt'))).toBe(0);
    void THRALL;
  });

  it('Baited: an enemy caught in the trap, and the Serpent Volley it lights is ready at once', () => {
    const { m, me, foe } = duel('ranger', 'r-trapper-1a');
    Object.assign(foe, { x: 300, y: 125 });
    strike(m, me, foe, 'r-trap');
    expect(boon(me, 'baited')).toBe(0);
    wait(m, 1.1);
    Object.assign(foe, { x: me.x, y: me.y });
    wait(m, 0.1);
    expect(m.held(foe)?.cc).toBe('incap');
    expect(boon(me, 'baited')).toBe(1);
    me.cds['r-wind'] = 7;
    expect(m.blocked(me, AB('r-wind'), foe)).toBeNull();
    expect(inside(m).arm(me, AB('r-wind')).k).toBeCloseTo(1.5, 5);
  });

  it('Dawnfire: the Hammerfall it lights sets them ablaze; Hungering Edge: the Night Reaping it lights drinks half', () => {
    const d = duel('paladin', 'd-ret-1b');
    inside(d.m).grant(d.me, 'dawnfire');
    strike(d.m, d.me, d.foe, 'd-fall');
    expect(has(d.foe, 'd-fall', 'dot')).toBe(true);
    expect(boon(d.me, 'dawnfire')).toBe(0);
    d.foe.auras = [];
    d.me.cds = {};
    strike(d.m, d.me, d.foe, 'd-fall');
    expect(has(d.foe, 'd-fall', 'dot')).toBe(false);

    const g = duel('gloamknight', 'g-reaver-1b');
    inside(g.m).grant(g.me, 'hunger');
    g.me.hp = 300;
    const dealt = strike(g.m, g.me, g.foe, 'g-reap');
    // (a fifth of what it dealt, and the little the reaping heals of itself)
    expect(g.me.hp - 300).toBeGreaterThanOrEqual(Math.round(dealt * 0.2));
    expect(g.me.hp - 300).toBeLessThanOrEqual(Math.round(dealt * 0.5) + 20);
  });

  it('Second Dusk: a Closing Cut that spends all five brings it, and the Nightknife it lights cuts as if from behind and leaves two', () => {
    const { m, me, foe } = duel('gloamknight', 'g-shadow-1a');
    me.pts = 4;
    strike(m, me, foe, 'g-cut');
    expect(boon(me, 'dusk')).toBe(0);
    me.pts = 5;
    strike(m, me, foe, 'g-cut');
    expect(boon(me, 'dusk')).toBe(1);
    // face to face, free: no Unseen Edge of its own
    foe.auras = [];
    expect(m.comboReady(me, AB('g-knife'), foe)).toBeNull();
    const plain = (AB('g-knife').effects[0] as { n: number }).n * CLASS_DMG.gloamknight;
    m.events.length = 0;
    const dealt = strike(m, me, foe, 'g-knife');
    expect(dealt).toBeGreaterThan(plain * AB('g-knife').combo!.mult);
    expect(words(m)).toContain('Unseen Edge');
    expect(me.pts).toBe(3);
    expect(boon(me, 'dusk')).toBe(0);
  });

  it('Roll and Nock: Spring Away nocks an arrow as it goes, for a Swift Shot twice as hard', () => {
    const { m, me, foe } = duel('ranger', 'r-sniper-2b');
    Object.assign(foe, { x: 260, y: 125 });
    const plain = strike(m, me, foe, 'r-swift');
    expect(m.press(0, 'r-leap')).toBeNull();
    expect(boon(me, 'nocked')).toBe(1);
    wait(m, 0.5);
    expect(strike(m, me, foe, 'r-swift') / plain).toBeCloseTo(2, 1);
    expect(boon(me, 'nocked')).toBe(0);
  });

  it('a boon’s ability is lit before a combo’s, and a super is lit like any other', () => {
    const { m, me, foe } = duel('mage', 'm-frost-1a');
    foe.auras.push({ ab: 'l-roots', kind: 'cc', cc: 'root', src: foe.id, t: 5, dur: 5, harmful: true, magic: true, n: 0, took: 0 });
    expect(m.lit(me, AB('m-fang'), foe)).toBe('Shatter');
    inside(m).grant(me, 'hoar');
    expect(m.lit(me, AB('m-fang'), foe)).toBe('Hoarfrost');
    // nothing is lit behind the gates, or for the fallen
    me.dead = true;
    expect(m.lit(me, AB('m-fang'), foe)).toBeNull();
    const w = duel('warrior', null);
    w.foe.auras.push({ ab: 'w-gash', kind: 'dot', src: w.me.id, t: 5, dur: 8, harmful: true, magic: false, n: 1, next: 9 });
    expect(w.m.lit(w.me, AB('w-super'), w.foe)).toBe('Aftershock');
  });
});

describe('The Ring: what a talent makes of an ability, by name', () => {
  it('whatever more a talent makes an ability deal is said in its words, at its class’s share', () => {
    let said = 0;
    for (const t of ALL) {
      for (const x of Object.values(t.tune ?? {})) {
        for (const e of [...(x.extra ?? []), ...(x.foes ?? []), ...(x.nth?.extra ?? []), ...(x.uses ?? []).flatMap((u) => u.extra ?? [])]) {
          if (e.k !== 'dmg' && e.k !== 'dot') continue;
          said++;
          expect(t.text, `${t.id} says ${Math.round(e.n * CLASS_DMG[t.cls])}`).toMatch(new RegExp(`\\b${Math.round(e.n * CLASS_DMG[t.cls])}\\b`));
        }
      }
      if (t.does?.k === 'corpse') expect(t.text, t.id).toMatch(new RegExp(`\\b${Math.round(t.does.n * CLASS_DMG[t.cls])}\\b`));
    }
    expect(said).toBeGreaterThanOrEqual(6);
  });

  it('sooner back, quicker cast, longer hold: each as its talent says', () => {
    let n = 0;
    for (const t of ALL) {
      for (const [id, x] of Object.entries(t.tune ?? {})) {
        const ab = AB(id);
        const { m, me, foe } = duel(t.cls, t.id);
        if (x.cd !== undefined && !ab.veiled) {
          n++;
          inside(m).grant(me, 'none');
          // (pressed where it can go: a friend's on themself, an enemy's at arm's length, a rouse with the dead standing)
          me.friend = me.id;
          me.pts = 5;
          if (ab.effects.some((e) => e.k === 'frenzy')) strike(m, me, foe, 'k-raise');
          me.fought = m.clock;
          me.gcd = 0;
          expect(m.press(0, id), `${t.id}: ${id}`).toBeNull();
          for (let i = 0; i < 60 && me.cast; i++) m.step(STEP, {});
          expect(me.cds[id]! + (ab.cast ? 0 : 0), `${t.id}: ${id} cooldown`).toBeGreaterThan(ab.cd * x.cd - 1.2);
          expect(me.cds[id], `${t.id}: ${id} cooldown`).toBeLessThanOrEqual(ab.cd * x.cd + 0.001);
        }
        if (x.cast !== undefined) {
          n++;
          expect(m.castOf(me, ab), `${t.id}: ${id} cast`).toBeCloseTo(ab.cast * x.cast, 5);
        }
      }
    }
    expect(n).toBeGreaterThanOrEqual(14);
    // longer holds
    for (const [cls, talent, id, cc] of [
      ['mage', 'm-fire-2b', 'm-toad', 'incap'],
      ['priest', 'p-healer-2b', 'p-wail', 'fear'],
      ['paladin', 'd-holy-2c', 'd-hammer', 'stun'],
      ['druid', 'l-star-2a', 'l-roots', 'root'],
    ] as const) {
      const held = (tal: string | null): number => {
        const { m, me, foe } = duel(cls, tal, 'warrior', PRESETS[cls].findIndex((p) => p.id === TALENT_BY_ID[talent]!.spec));
        strike(m, me, foe, id);
        return foe.auras.find((a) => a.cc === cc)!.dur;
      };
      expect(held(talent) / held(null), talent).toBeCloseTo(TALENT_BY_ID[talent]!.tune![id]!.dur!, 2);
    }
    // (a trap's hold too, set as the trap is laid)
    const snare = duel('ranger', 'r-trapper-2a');
    strike(snare.m, snare.me, snare.foe, 'r-trap');
    expect(snare.m.traps[0]!.dur).toBeCloseTo(2.5 * 1.4, 5);
  });

  it('the warrior: Thunderous Rush stuns, Ricochet leaps on, Warpath and Run Down quicken, Crippling Blows slow harder, Bonebreaker breaks', () => {
    const rush = duel('warrior', 'w-arms-2a');
    Object.assign(rush.foe, { x: 300, y: 125 });
    strike(rush.m, rush.me, rush.foe, 'w-rush');
    expect(rush.m.held(rush.foe)?.cc).toBe('stun');

    const m = fight([{ team: 0, cls: 'warrior', talents: ['w-arms-2b'] }, { team: 1, cls: 'mage', at: [260, 125] }, { team: 1, cls: 'ranger', at: [290, 140] }]);
    const [w, a, b] = m.fighters as [Fighter, Fighter, Fighter];
    strike(m, w, a, 'w-hurl');
    expect(m.held(a)?.cc).toBe('stun');
    expect(m.held(b)?.cc).toBe('stun');
    expect(m.events.some((e) => e.k === 'streak' && e.id === a.id && e.to === b.id)).toBe(true);

    for (const talent of ['w-arms-2c', 'w-pin-2c']) {
      const p = duel('warrior', talent);
      Object.assign(p.foe, { x: 300, y: 125 });
      p.me.auras.push({ ab: 'm-spear', kind: 'slow', src: 1, t: 4, dur: 4, harmful: true, magic: true, n: 0.4 });
      strike(p.m, p.me, p.foe, 'w-rush');
      expect(p.me.auras.some((x) => x.kind === 'speed' && x.ab === 'w-rush'), talent).toBe(true);
      // (Warpath shakes the slow off and lets nothing more hold; Run Down only runs)
      expect(p.me.auras.some((x) => x.kind === 'slow' && x.ab === 'm-spear'), talent).toBe(talent === 'w-pin-2c');
      expect(p.me.auras.some((x) => x.kind === 'free'), talent).toBe(talent === 'w-arms-2c');
    }

    const c = duel('warrior', 'w-pin-2a');
    strike(c.m, c.me, c.foe, 'w-hamstring');
    const slow = c.foe.auras.find((x) => x.ab === 'w-hamstring' && x.kind === 'slow')!;
    expect([slow.n, slow.dur]).toEqual([0.45, 3]);

    const bone = (talent: string | null): number => {
      const x = duel('warrior', talent, 'warrior', 1);
      return strike(x.m, x.me, x.foe, 'w-crack');
    };
    // (a small blow, in whole numbers: three times to within the rounding)
    expect(bone('w-pin-2b') / bone(null)).toBeCloseTo(3, 0);
  });

  it('the mage: Blazing Trail scorches where they left, Quickfold quickens, Ice Step springs back, Deep Winter keeps the globe and frees the spear', () => {
    const t = duel('mage', 'm-fire-2a');
    const hp = t.foe.hp;
    t.me.dirX = -1;
    expect(t.m.press(0, 'm-blink')).toBeNull();
    expect(t.foe.hp).toBeLessThan(hp);
    expect(has(t.foe, 'm-blink', 'slow')).toBe(true);
    expect(t.me.x).toBeLessThan(140);

    const q = duel('mage', 'm-fire-2c');
    expect(q.m.press(0, 'm-blink')).toBeNull();
    expect(has(q.me, 'm-blink', 'speed')).toBe(true);

    const s = duel('mage', 'm-frost-2c');
    const x = s.me.x;
    expect(s.m.press(0, 'm-ring')).toBeNull();
    wait(s.m, 1.2);
    expect(s.m.held(s.foe)?.cc).toBe('stun');
    expect(x - s.me.x).toBeGreaterThan(50);

    const d = duel('mage', 'm-frost-1c');
    expect(d.m.castOf(d.me, AB('m-spear'))).toBeGreaterThan(0);
    strike(d.m, d.me, d.foe, 'm-globe');
    wait(d.m, 0.4);
    // (it kept the globe half as long again until 2026-11-17: the instant spear alone was already the best of its row)
    expect(d.m.fields[0]!.dur).toBeCloseTo(AB('m-globe').field!.dur, 5);
    // (while it is out: instant, still twice as hard, and the boon is kept)
    expect(d.m.castOf(d.me, AB('m-spear'))).toBe(0);
    const p = inside(d.m).arm(d.me, AB('m-spear'));
    expect(p.k).toBe(2);
    expect(boon(d.me, 'globe')).toBe(1);
  });

  it('the ranger: Talon Rake rakes, Burr Scatter slows those near, Slow Venom slows and cuts healing', () => {
    const r = duel('ranger', 'r-sniper-2a');
    strike(r.m, r.me, r.foe, 'r-hawk');
    expect(has(r.foe, 'r-hawk', 'dot')).toBe(true);
    const b = duel('ranger', 'r-sniper-2c');
    expect(b.m.press(0, 'r-leap')).toBeNull();
    expect(b.foe.auras.find((a) => a.ab === 'r-leap' && a.kind === 'slow')?.n).toBe(0.5);
    const v = duel('ranger', 'r-trapper-2c');
    strike(v.m, v.me, v.foe, 'r-venom');
    expect(has(v.foe, 'r-venom', 'slow') && has(v.foe, 'r-venom', 'antiheal') && has(v.foe, 'r-venom', 'dot')).toBe(true);
  });

  it('the priest: Sheltering Ward guards, Echoing Silence slows, Dusk Step blinks', () => {
    const w = duel('priest', 'p-healer-2c');
    w.me.friend = w.me.id;
    expect(w.m.press(0, 'p-ward')).toBeNull();
    expect(w.me.auras.find((a) => a.ab === 'p-ward' && a.kind === 'guard')?.n).toBe(0.15);
    const e = duel('priest', 'p-shadow-2b');
    strike(e.m, e.me, e.foe, 'p-hush');
    expect(e.m.silenced(e.foe)).toBe(true);
    expect(has(e.foe, 'p-hush', 'slow')).toBe(true);
    const d = duel('priest', 'p-shadow-2c');
    const x = d.me.x;
    d.me.dirX = -1;
    expect(d.m.press(0, 'p-dusk')).toBeNull();
    expect(x - d.me.x).toBeGreaterThan(50);
    expect(has(d.me, 'p-dusk', 'guard')).toBe(true);
  });

  it('the paladin: Shared Dawn heals every other friend, Leaping Hammer stuns a second, Wings of Dawn ward', () => {
    const m = fight([{ team: 0, cls: 'paladin', talents: ['d-holy-1b'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'mage', at: [180, 130] }]);
    const [pal, , friend] = m.fighters as [Fighter, Fighter, Fighter];
    pal.hp = 400;
    friend.hp = 400;
    pal.friend = pal.id;
    expect(m.press(0, 'd-flash')).toBeNull();
    wait(m, 1);
    const mine = pal.hp - 400;
    expect(mine).toBeGreaterThan(40);
    expect((friend.hp - 400) / mine).toBeCloseTo(0.8, 1);

    const n = fight([{ team: 0, cls: 'paladin', talents: ['d-ret-2b'] }, { team: 1, cls: 'mage', at: [260, 125] }, { team: 1, cls: 'ranger', at: [290, 140] }]);
    strike(n, n.fighters[0]!, n.fighters[1]!, 'd-hammer');
    expect(n.held(n.fighters[1]!)?.cc).toBe('stun');
    expect(n.held(n.fighters[2]!)?.cc).toBe('stun');

    const w = duel('paladin', 'd-ret-2c');
    expect(w.m.press(0, 'd-stride')).toBeNull();
    expect(w.me.auras.find((a) => a.ab === 'd-stride' && a.kind === 'absorb')?.n).toBe(100);
  });

  it('the warlock: Lingering Dread is instant, Thirsting drinks more and guards, a Third Grave, a Barrow Howl, Hungering Dead, and an Ashburst', () => {
    const l = duel('warlock', 'k-curses-2b');
    Object.assign(l.foe, { x: 260, y: 125 });
    expect(l.m.press(0, 'k-dread')).toBeNull();
    expect(l.me.cast).toBeNull();

    const drink = (talent: string | null): number => {
      const x = duel('warlock', talent);
      x.me.gcd = 0;
      expect(x.m.press(0, 'k-drain')).toBeNull();
      if (talent) expect(x.me.auras.find((a) => a.ab === 'k-drain' && a.kind === 'guard')?.n).toBe(0.2);
      const hp = x.foe.hp;
      wait(x.m, 3.2);
      return hp - x.foe.hp;
    };
    // (its ticks are whole numbers: at the warlock's 0.87 the measure lands a hair past 1.35)
    expect(drink('k-curses-2c') / drink(null)).toBeGreaterThan(1.25);
    expect(drink('k-curses-2c') / drink(null)).toBeLessThan(1.36);

    const g = duel('warlock', 'k-grave-1b');
    strike(g.m, g.me, g.foe, 'k-raise');
    expect(g.m.fighters.filter((f) => f.pet && !f.dead)).toHaveLength(3);

    const h = duel('warlock', 'k-grave-2b');
    Object.assign(h.foe, { x: 280, y: 125 });
    strike(h.m, h.me, h.foe, 'k-raise');
    strike(h.m, h.me, h.foe, 'k-dread');
    for (const p of h.m.fighters.filter((f) => f.pet)) expect(p.auras.some((a) => a.kind === 'fury')).toBe(true);

    const d = duel('warlock', 'k-grave-2c');
    strike(d.m, d.me, d.foe, 'k-raise');
    expect(d.m.press(0, 'k-frenzy')).toBeNull();
    expect(d.me.auras.find((a) => a.ab === 'k-frenzy' && a.kind === 'absorb')?.n).toBe(100);

    // Ashburst: one of the dead cut down beside an enemy, and one whose time is up
    const a = duel('warlock', 'k-grave-1c');
    strike(a.m, a.me, a.foe, 'k-raise');
    const [p1, p2] = a.m.fighters.filter((f) => f.pet) as [Fighter, Fighter];
    Object.assign(p1, { x: a.foe.x + 10, y: a.foe.y });
    Object.assign(p2, { x: a.foe.x - 300, y: a.foe.y });
    let hp = a.foe.hp;
    inside(a.m).damage(a.foe, p1, 9999, true, AB('w-hew'));
    expect(p1.dead).toBe(true);
    expect(hp - a.foe.hp).toBe(Math.round(60 * CLASS_DMG.warlock));
    // (too far off to catch anyone: nothing)
    hp = a.foe.hp;
    inside(a.m).damage(a.foe, p2, 9999, true, AB('w-hew'));
    expect(a.foe.hp).toBe(hp);
    // and without the talent the dead only fall
    const n = duel('warlock', null, 'warrior', 1);
    strike(n.m, n.me, n.foe, 'k-raise');
    const q = n.m.fighters.find((f) => f.pet)!;
    Object.assign(q, { x: n.foe.x + 10, y: n.foe.y });
    hp = n.foe.hp;
    inside(n.m).damage(n.foe, q, 9999, true, AB('w-hew'));
    expect(n.foe.hp).toBe(hp);
  });

  it('the druid: Gripping Roots is instant, Antler Rush throws back, Moonlit Path slows, a Fourth Star falls, a Wandering Light casts at a run', () => {
    const g = duel('druid', 'l-heal-2b');
    expect(g.m.press(0, 'l-roots')).toBeNull();
    expect(g.me.cast).toBeNull();
    expect(g.m.rooted(g.foe)).toBe(true);

    const a = duel('druid', 'l-star-2b');
    const d0 = Math.hypot(a.foe.x - a.me.x, a.foe.y - a.me.y);
    expect(a.m.press(0, 'l-bound')).toBeNull();
    wait(a.m, 0.3);
    expect(Math.hypot(a.foe.x - a.me.x, a.foe.y - a.me.y)).toBeGreaterThan(d0 + 40);

    const p = duel('druid', 'l-star-2c');
    strike(p.m, p.me, p.foe, 'l-moon');
    expect(p.foe.auras.find((x) => x.ab === 'l-moon' && x.kind === 'slow')?.n).toBe(0.3);

    const s = duel('druid', 'l-star-1b');
    const hits = [0, 1, 2, 3, 4].map(() => strike(s.m, s.me, s.foe, 'l-lash'));
    // (a blow of its own, at the druid's share: what its words say, and a blow's own edge over its number)
    expect(hits[3]! - hits[0]!).toBe(Math.round(130 * CLASS_DMG.druid * HIT_K));
    expect(hits[4]).toBe(hits[0]);
    expect(words(s.m)).toContain('Fourth Star');

    const w = duel('druid', 'l-star-1c');
    const free = inside(w.m).speedOf(w.me);
    expect(w.m.press(0, 'l-lash')).toBeNull();
    expect(w.me.cast).not.toBeNull();
    expect(inside(w.m).speedOf(w.me)).toBe(free);
    const plain = duel('druid', null, 'warrior', 1);
    expect(plain.m.press(0, 'l-lash')).toBeNull();
    expect(inside(plain.m).speedOf(plain.me)).toBeLessThan(free);
  });

  it('the Gloamknight: Iron Grip roots, Crushing Hand crushes, Bloodied Edge bleeds by the Nick, Throat Cut silences, Smoke Step is back sooner', () => {
    const i = duel('gloamknight', 'g-reaver-2a');
    Object.assign(i.foe, { x: 300, y: 125 });
    strike(i.m, i.me, i.foe, 'g-chain');
    expect(i.m.rooted(i.foe)).toBe(true);
    expect(has(i.foe, 'g-chain', 'slow')).toBe(true);

    const c = duel('gloamknight', 'g-reaver-2c');
    const dealt = strike(c.m, c.me, c.foe, 'g-hand');
    expect(dealt).toBe(Math.round(60 * CLASS_DMG.gloamknight * HIT_K));
    expect(c.m.held(c.foe)?.cc).toBe('stun');
    expect(has(c.foe, 'g-hand', 'antiheal')).toBe(true);

    const b = duel('gloamknight', 'g-shadow-1b');
    b.me.pts = 5;
    strike(b.m, b.me, b.foe, 'g-cut');
    const bleed = b.foe.auras.find((x) => x.ab === 'g-cut' && x.kind === 'dot')!;
    expect(bleed.n * bleed.dur).toBeCloseTo(20 * (1 + 0.8 * 5), 3);

    const t = duel('gloamknight', 'g-shadow-2a');
    b.me.fought = undefined;
    inside(t.m).grant(t.me, 'none');
    (t.m as unknown as { veil(f: Fighter, ab: Ability | null): void }).veil(t.me, null);
    strike(t.m, t.me, t.foe, 'g-ambush');
    expect(t.m.silenced(t.foe)).toBe(true);

    const s = duel('gloamknight', 'g-shadow-2b');
    s.me.fought = s.m.clock;
    expect(s.m.press(0, 'g-veil')).toBeNull();
    expect(s.me.cds['g-veil']).toBeCloseTo(30 * 0.66, 1);
    expect(has(s.me, 'g-veil', 'speed')).toBe(true);
    void HERO_R;
  });
});

describe('The Ring: a combo is taught as what it is', () => {
  const run = (m: Match, tut: TutorialRun, seconds: number): void => {
    for (let i = 0; i < seconds / STEP; i++) {
      m.step(STEP, { 1: tut.free ? { mx: 0, my: 0 } : tut.foeMove() });
      tut.after(STEP);
      m.events = [];
    }
  };
  const lesson = (cls: ClassId, style: number): { m: Match; tut: TutorialRun } => {
    const p = PRESETS[cls][style]!;
    const m = new Match(tutorialSetup({ team: 0, cls, name: 'You', bar: [...p.bar], talents: [...p.talents], ult: p.ult }, 7));
    const tut = new TutorialRun(m, 0, 1);
    m.openSoon();
    run(m, tut, 3.2);
    tut.i = tut.steps.indexOf('ability');
    (tut as unknown as { advance: () => void }).advance();
    expect(tut.id).toBe('combo');
    return { m, tut };
  };
  const KEYS = { touch: false, ab: ['1', '2', '3', '4'], dash: 'Space', super: 'Q', nextFoe: 'Tab', nextFriend: 'F', closeIn: true };

  it('the Nightblade’s: Nicks built with the knife and spent on the cut', () => {
    const { m, tut } = lesson('gloamknight', 1);
    const v = tut.view(KEYS);
    expect(v.text).toMatch(/Nightknife builds Nicks, and Closing Cut spends them all/);
    expect(v.text).toMatch(/three times/);
    expect(v.short).toMatch(/Nightknife \(1\) three times, then Closing Cut \(2\)/);
    const [me, foe] = m.fighters as [Fighter, Fighter];
    Object.assign(me, { x: foe.x - 16, y: foe.y });
    me.auras = [];
    for (let i = 0; i < 3; i++) {
      me.gcd = 0;
      expect(m.press(0, 'g-knife')).toBeNull();
      run(m, tut, 0.1);
      Object.assign(me, { x: foe.x - 16, y: foe.y });
    }
    expect(tut.id).toBe('combo');
    me.gcd = 0;
    expect(m.press(0, 'g-cut')).toBeNull();
    run(m, tut, 0.1);
    expect(tut.id).toBe('circle');
  });

  it('the Rime’s: held with the clasp, shattered with the fang, the partner brought near enough to be caught', () => {
    const { m, tut } = lesson('mage', 1);
    expect(tut.view(KEYS).text).toMatch(/Frostclasp sets up Frostfang/);
    const [me, foe] = m.fighters as [Fighter, Fighter];
    // (the partner walks in, from the far entry here, to where the snare reaches)
    run(m, tut, 10);
    expect(Math.hypot(foe.x - me.x, foe.y - me.y)).toBeLessThan(AB('m-ring').range);
    expect(m.press(0, 'm-ring')).toBeNull();
    run(m, tut, 1);
    expect(foe.auras.some((a) => a.cc === 'stun')).toBe(true);
    me.gcd = 0;
    expect(m.press(0, 'm-fang')).toBeNull();
    // (the fang is seen crossing, and the lesson is learnt as it lands)
    run(m, tut, 0.5);
    expect(tut.id).toBe('circle');
  });

  it('every playstyle has one to teach, with both its abilities on the bar, and its step can be passed', () => {
    for (const cls of CLASS_IDS) {
      for (const [i, p] of PRESETS[cls].entries()) {
        const { tut } = lesson(cls, i);
        const v = tut.view(KEYS);
        expect(v.next, p.name).toBe(false);
        expect(v.short.length, p.name).toBeGreaterThan(10);
        expect(v.text, p.name).not.toMatch(/undefined/);
      }
    }
  });
});
