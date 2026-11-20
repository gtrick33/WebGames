/**
 * The Ring: whoever is held stays held, and what floats over a fighter is a whole number. The owner, 2026-11-17:
 * "the rogue's stun doesnt exactly stun them as they can move around ... check stuns overall, fears, roots, etc any cc,
 * enemies shoulsnt be able to move through them", and "theres some random huge ass numbers floating around".
 *
 * Two things let a held fighter walk. A fear makes its target run, and it did so whatever else was on them: stunned by a
 * Nightblade and feared by the priest beside him, they ran. And a root went onto someone who could not be rooted just
 * then (a paladin in his stride), was shown on them, and held nothing. The long numbers were a shield cast late in a
 * match: it fades as healing does, by a share, and what it left of a hit was that share's decimals.
 *
 * Neither was what the owner had seen. Later that day: "rogues still dont stun, the target keeps moving, wtf, make it
 * non dispellable and make the target not move, increase atun from 1.5s to 2s make sure it actually stuns". The first
 * tests here gave the Nightblade no talents. With its ready-made ones it carries Throat Cut ("Dusk Ambush also silences
 * for 3 sec"), and the rules took a second hold from the same ability for the first one refreshed: the silence went on
 * in the stun's place, in the same instant, every time. Between computers its stuns lasted 0.03 to 0.16 of their 1.5
 * seconds against every playstyle. Two holds of different kinds now both stay on, Dusk Ambush stuns for 2 seconds, and
 * nothing that dispels can take it off.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS, ultOf, type Ability, type CcKind } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { DAMP_FROM, GATES, Match, type Fighter, type FighterSetup, type MatchEvent, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { TALENTS } from '../src/games/sigilfall/arena/talents';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { RingFx } from '../src/games/sigilfall/render/ring';

const STEP = 1 / 30;

interface Inside {
  rand: () => number;
  clock: number;
  damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): number;
  crowd(f: Fighter, ab: Ability, t: Fighter, cc: CcKind, dur: number): boolean;
  dispel(f: Fighter, t: Fighter): void;
  land(f: Fighter, ab: Ability, t: Fighter, area: boolean): void;
}
const inside = (m: Match): Inside => m as unknown as Inside;
const AB = (id: string): Ability => ABILITIES[id]!;

/** Two face to face with the gates open, no critical hits, the second with a great deal of health. */
function duel(a: ClassId, b: ClassId, styles: [number, number] = [0, 0], talents: string[] = []): { m: Match; me: Fighter; foe: Fighter } {
  const setup = (team: 0 | 1, cls: ClassId, p: number): FighterSetup => ({ team, cls, name: cls, bar: PRESETS[cls][p]!.bar, talents: team === 0 ? talents : [] });
  const m = new Match({ seed: 5, map: 'sands', fighters: [setup(0, a, styles[0]), setup(1, b, styles[1])] });
  m.step(GATES + 0.01, {});
  const [me, foe] = m.fighters as [Fighter, Fighter];
  me.x = 200;
  me.y = 125;
  foe.x = 216;
  foe.y = 125;
  for (const f of m.fighters) {
    f.mods.crit = 0;
    f.auras = [];
  }
  me.target = foe.id;
  foe.target = me.id;
  foe.hp = foe.maxHp = 50000;
  inside(m).rand = () => 0.99;
  m.events.length = 0;
  return { m, me, foe };
}
/** Runs it with the second fighter trying to walk away the whole time: how far they got. */
function walked(m: Match, foe: Fighter, seconds: number): number {
  const [x, y] = [foe.x, foe.y];
  for (let i = 0; i < seconds / STEP; i++) m.step(STEP, { [foe.id]: { mx: 1, my: 0.3 } });
  return Math.hypot(foe.x - x, foe.y - y);
}

describe('The Ring: whoever is held stays where they are', () => {
  it('a Nightblade’s Dusk Ambush stuns for a second and a half: its target does not take a step until it is over', () => {
    const { m, me, foe } = duel('gloamknight', 'warrior', [1, 0]);
    expect(m.press(me.id, 'g-veil')).toBeNull();
    m.step(STEP, {});
    expect(m.press(me.id, 'g-ambush')).toBeNull();
    // (it was two seconds until the healing spheres went and the Nightblade came out on top: 2026-11-20)
    expect(foe.auras.find((a) => a.cc === 'stun')?.dur).toBe(1.5);
    expect(AB('g-ambush').text).toContain('stunning for 1.5 sec');
    expect(walked(m, foe, 1.4)).toBe(0);
    // (and then they can)
    expect(walked(m, foe, 0.5)).toBeGreaterThan(5);
  });

  it('with Throat Cut, the Nightblade’s own ready-made talent, it stuns and silences: the silence does not take the stun’s place', () => {
    // (it did, in the instant both landed: the stun was called out over the target, and they walked off)
    const talents = PRESETS.gloamknight[1]!.talents;
    expect(talents).toContain('g-shadow-2a');
    const { m, me, foe } = duel('gloamknight', 'warrior', [1, 0], talents);
    expect(m.press(me.id, 'g-veil')).toBeNull();
    m.step(STEP, {});
    m.events.length = 0;
    expect(m.press(me.id, 'g-ambush')).toBeNull();
    expect(m.events.filter((e) => e.k === 'word' && e.id === foe.id).map((e) => (e as { word: string }).word)).toEqual(expect.arrayContaining(['Stunned', 'Silenced']));
    expect(foe.auras.filter((a) => a.cc).map((a) => [a.cc, a.dur])).toEqual([
      ['stun', 1.5],
      ['silence', 3],
    ]);
    expect(m.held(foe)?.cc).toBe('stun');
    expect(walked(m, foe, 1.4)).toBe(0);
    expect(m.held(foe)?.cc).toBe('stun');
    // the stun runs its two seconds and the silence its three
    expect(walked(m, foe, 0.5)).toBeGreaterThan(5);
    expect(m.held(foe)).toBeUndefined();
    expect(m.silenced(foe)).toBe(true);
    walked(m, foe, 0.7);
    expect(m.silenced(foe)).toBe(false);
  });

  it('nothing that dispels takes Dusk Ambush’s stun off', () => {
    expect(AB('g-ambush').sticky).toBe(true);
    const m = new Match({ seed: 5, map: 'sands', fighters: [
      { team: 0, cls: 'gloamknight', name: 'a', bar: PRESETS.gloamknight[1]!.bar, talents: PRESETS.gloamknight[1]!.talents },
      { team: 1, cls: 'warrior', name: 'b', bar: PRESETS.warrior[0]!.bar, talents: [] },
      { team: 1, cls: 'priest', name: 'c', bar: PRESETS.priest[0]!.bar, talents: [] },
    ] });
    m.step(GATES + 0.01, {});
    const [me, foe, healer] = m.fighters as [Fighter, Fighter, Fighter];
    foe.hp = foe.maxHp = 50000;
    inside(m).land(me, AB('g-ambush'), foe, false);
    const stun = foe.auras.find((a) => a.cc === 'stun')!;
    expect(stun.magic).toBe(false);
    // (their healer tries: the silence, which is no blade's work... is physical too; there is nothing for a dispel to take)
    inside(m).dispel(healer, foe);
    expect(foe.auras.some((a) => a.cc === 'stun')).toBe(true);
    // (and no ability or talent in the Ring dispels at all, as things stand)
    for (const ab of Object.values(ABILITIES)) expect(ab.effects.some((e) => e.k === 'dispel'), ab.name).toBe(false);
  });

  it('used again it holds just as long, as every hold does (no diminishing returns): a second and a half, then the same', () => {
    const { m, me, foe } = duel('gloamknight', 'warrior', [1, 0]);
    inside(m).land(me, AB('g-ambush'), foe, false);
    expect(foe.auras.find((a) => a.cc === 'stun')?.dur).toBe(1.5);
    walked(m, foe, 2.5);
    inside(m).land(me, AB('g-ambush'), foe, false);
    expect(foe.auras.find((a) => a.cc === 'stun')?.dur).toBe(1.5);
    // (what keeps it from coming round again at once is its own cooldown now, not only the shroud)
    expect(AB('g-ambush').cd).toBeGreaterThan(0);
  });

  it('whatever an ability and a talent put on someone in one use is all on them: no hold takes another’s place', () => {
    // every talent that adds a hold to an ability that already holds, tried by landing it
    let tried = 0;
    for (const cls of CLASS_IDS) {
      for (const tal of TALENTS[cls]) {
        for (const [id, tune] of Object.entries(tal.tune ?? {})) {
          const ab = ABILITIES[id] ?? PRESETS[cls].map((p) => ultOf(cls, p.ult)).find((a) => a.id === id);
          const own = (ab?.effects ?? []).filter((e) => e.k === 'cc').map((e) => (e as { cc: CcKind }).cc);
          const more = (tune.extra ?? []).filter((e) => e.k === 'cc').map((e) => (e as { cc: CcKind }).cc);
          if (!ab || !own.length || !more.length) continue;
          tried++;
          const style = PRESETS[cls].findIndex((p) => p.bar.includes(id) || p.ult === id);
          const m = new Match({ seed: 5, map: 'sands', fighters: [
            { team: 0, cls, name: 'a', bar: PRESETS[cls][Math.max(0, style)]!.bar, talents: [tal.id], ult: PRESETS[cls][Math.max(0, style)]!.ult },
            { team: 1, cls: 'warrior', name: 'b', bar: PRESETS.warrior[0]!.bar, talents: [] },
          ] });
          m.step(GATES + 0.01, {});
          const [me, foe] = m.fighters as [Fighter, Fighter];
          foe.hp = foe.maxHp = 50000;
          inside(m).land(me, ab, foe, false);
          expect(foe.auras.filter((a) => a.cc).map((a) => a.cc).sort(), `${tal.name} on ${ab.name}`).toEqual([...new Set([...own, ...more])].sort());
        }
      }
    }
    // (Throat Cut on Dusk Ambush, at the least)
    expect(tried).toBeGreaterThanOrEqual(1);
  });

  for (const cc of ['stun', 'incap', 'root'] as const) {
    it(`a ${cc} holds them, and a fear on top of it does not walk them out of it`, () => {
      const { m, me, foe } = duel('priest', 'warrior');
      expect(inside(m).crowd(me, AB('w-crack'), foe, cc, 2)).toBe(true);
      expect(walked(m, foe, 0.5)).toBe(0);
      // (the owner’s case: stunned by one of a side and feared by the other, they ran)
      expect(inside(m).crowd(me, AB('p-wail'), foe, 'fear', 2)).toBe(true);
      expect(foe.auras.filter((a) => a.cc).map((a) => a.cc).sort()).toEqual(['fear', cc].sort());
      expect(walked(m, foe, 1)).toBe(0);
      expect(m.pinned(foe)).toBe(true);
    });
  }

  it('a fear alone makes them run, but not where they choose: what they press counts for nothing', () => {
    const { m, me, foe } = duel('priest', 'warrior');
    expect(inside(m).crowd(me, AB('p-wail'), foe, 'fear', 2)).toBe(true);
    const a = { m: m, foe };
    const [x, y] = [foe.x, foe.y];
    for (let i = 0; i < 30; i++) m.step(STEP, { [foe.id]: { mx: 0, my: 0 } });
    expect(Math.hypot(a.foe.x - x, a.foe.y - y)).toBeGreaterThan(10);
    expect(m.held(foe)?.cc).toBe('fear');
    // (they can use nothing while it lasts)
    expect(m.blocked(foe, AB(PRESETS.warrior[0]!.bar[0]!), me)).not.toBeNull();
  });

  it('nothing roots whoever cannot be rooted just now, and what frees them takes the roots off', () => {
    const { m, me, foe } = duel('mage', 'paladin', [1, 1]);
    foe.target = foe.id;
    // rooted, then a paladin’s stride: the root is gone, not walked through
    expect(inside(m).crowd(me, AB('m-ring'), foe, 'root', 2)).toBe(true);
    expect(m.press(foe.id, 'd-stride')).toBeNull();
    expect(foe.auras.some((a) => a.cc === 'root')).toBe(false);
    // and a root thrown at them while it lasts does nothing, and says so
    m.events.length = 0;
    expect(inside(m).crowd(me, AB('m-ring'), foe, 'root', 2)).toBe(false);
    expect(foe.auras.some((a) => a.cc === 'root')).toBe(false);
    expect(m.events.some((e) => e.k === 'word' && e.id === foe.id && e.word === 'Immune')).toBe(true);
    expect(walked(m, foe, 0.5)).toBeGreaterThan(5);
  });

  it('in whole matches between computers, nobody who is stunned, dazed or rooted walks', () => {
    const specs = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((p) => ({ cls, p })));
    const kinds = new Set<string>();
    for (let g = 1; g <= 24; g++) {
      let s = g * 7919;
      const rand = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
      const size = 1 + (g % 3);
      const fighters: FighterSetup[] = [];
      for (const team of [0, 1] as const) {
        for (let i = 0; i < size; i++) {
          const x = specs[Math.floor(rand() * specs.length)]!;
          fighters.push({ team, cls: x.cls, name: `${x.p.name}${team}${i}`, bar: x.p.bar, talents: x.p.talents, ult: x.p.ult });
        }
      }
      const m = new Match({ seed: g, map: MAP_IDS[g % MAP_IDS.length]!, fighters });
      const brains = m.fighters.map((_, i) => newBrain(g * 31 + i));
      for (let i = 0; i < 30 * 160 && m.phase !== 'over'; i++) {
        const moves: Record<number, MoveInput> = {};
        for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.8, STEP);
        const before = m.fighters.map((f) => ({ x: f.x, y: f.y, dash: !!f.dash, pinned: !f.dead && m.pinned(f) && !m.aloft(f) }));
        m.step(STEP, moves);
        m.fighters.forEach((f, j) => {
          const b = before[j]!;
          // (held before the step and after it, and not being thrown or pulled by someone: they are where they were. Not a
          // step in which the hold broke and a new one landed: between the two they were free, and may take a step)
          const freed = m.events.some((e) => e.k === 'word' && e.id === f.id && e.word === 'Broke free');
          if (!b.pinned || f.dead || !m.pinned(f) || m.aloft(f) || b.dash || f.dash || freed) return;
          for (const a of f.auras) if (a.cc) kinds.add(a.cc);
          expect(Math.hypot(f.x - b.x, f.y - b.y), `match ${g}, ${f.name} at ${m.clock.toFixed(1)}s`).toBeLessThan(0.001);
        });
        m.events.length = 0;
      }
    }
    // (and it was tried on each kind)
    expect([...kinds].sort()).toEqual(expect.arrayContaining(['incap', 'root', 'stun']));
  });
});

describe('The Ring: what floats over a fighter is a whole number', () => {
  it('a shield cast as healing fades is a whole number, and so is what it leaves of a hit', () => {
    const { m, me, foe } = duel('priest', 'warrior');
    // (well into the fading: a share with a long tail of decimals)
    inside(m).clock = DAMP_FROM + 37.3;
    expect(m.dampening).toBeGreaterThan(0.3);
    expect(m.dampening).toBeLessThan(0.7);
    me.target = me.id;
    me.friend = me.id;
    expect(m.press(me.id, 'p-ward')).toBeNull();
    const ward = me.auras.find((a) => a.kind === 'absorb')!;
    expect(ward).toBeTruthy();
    expect(Number.isInteger(ward.n)).toBe(true);
    m.events.length = 0;
    inside(m).damage(foe, me, 400, true, AB('w-hew'));
    const nums = m.events.filter((e): e is Extract<MatchEvent, { k: 'num' }> => e.k === 'num');
    expect(nums.map((e) => e.kind).sort()).toEqual(['absorb', 'dmg']);
    for (const e of nums) expect(Number.isInteger(e.n), `${e.kind} ${e.n}`).toBe(true);
    expect(Number.isInteger(me.hp)).toBe(true);
  });

  it('in whole matches between computers, every number is whole, to the last second of the fading', () => {
    const specs = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((p) => ({ cls, p })));
    let seen = 0;
    for (let g = 1; g <= 16; g++) {
      // (a healer on each side: their shields are what went wrong, late)
      const healers = specs.filter((x) => x.p.healer);
      const pick = (i: number) => specs[(g * 7 + i * 5) % specs.length]!;
      const fighters: FighterSetup[] = ([0, 1] as const).flatMap((team) => [healers[(g + team) % healers.length]!, pick(team)].map((x, i) => ({ team, cls: x.cls, name: `${x.p.name}${team}${i}`, bar: x.p.bar, talents: x.p.talents, ult: x.p.ult })));
      const m = new Match({ seed: g, map: MAP_IDS[g % MAP_IDS.length]!, fighters });
      const brains = m.fighters.map((_, i) => newBrain(g * 31 + i));
      for (let i = 0; i < 30 * 160 && m.phase !== 'over'; i++) {
        const moves: Record<number, MoveInput> = {};
        for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.8, STEP);
        m.step(STEP, moves);
        for (const e of m.events) {
          if (e.k !== 'num') continue;
          seen++;
          expect(Number.isInteger(e.n), `match ${g} at ${m.clock.toFixed(1)}s: ${e.kind} ${e.n}`).toBe(true);
        }
        m.events.length = 0;
      }
    }
    expect(seen).toBeGreaterThan(2000);
  });

  it('and the screen writes a whole number whatever it is handed', () => {
    const { m, foe } = duel('priest', 'warrior');
    const fx = new RingFx();
    m.events.length = 0;
    m.events.push({ k: 'num', id: foe.id, n: 29.46982750000888, kind: 'dmg', crit: false }, { k: 'num', id: foe.id, n: 10.2, kind: 'dmg', crit: false });
    fx.take(m, () => {}, null);
    expect(fx.pops.map((p) => p.text)).toEqual(['40']);
  });
});
