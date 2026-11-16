/**
 * The Ring's computer teammates in 2v2 and 3v3 (arena/teammates.ts), after the owner's notes: "for teammates, you
 * should be able to select a class for 2v2 or 3v3 if u dont have a teammate, however, you can also select a random
 * option that pairs you in the 2v2 and 3v3 with the most balanced team each time and for 3v3 u should always have 1
 * healer and 1 dps, for 2v2 depending on the class, it should be either healer or another dps that has good synergy
 * with your class".
 *
 * The last block measures the tables Random reads, and is skipped unless RING_SYNERGY is set:
 *   RING_SYNERGY=1 npx vitest run tests/sigilfall-ring-teammates.test.ts
 * (RING_SYNERGY_N2 / RING_SYNERGY_N3: how many opponents each team meets, 400 and 240 by default; it takes hours on
 * one core at those numbers.)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { readRing, writeRing } from '../src/games/sigilfall/arena/ladder';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { Match, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { bestFits, bestPreset, choiceFromWord, choicesFor, choiceWord, fillSide, healerSpec, honored, NEAR, PAIRS, SPECS, specOf, teamKey, teamScore, TRIOS, type MateChoice, type Spec } from '../src/games/sigilfall/arena/teammates';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { act, cleanPick, join, newRoom, viewFor } from '../src/games/sigilfall/net/ringRoom';
import { setupFromRoom } from '../src/games/sigilfall/ui/RingScreen';

const R = (): MateChoice => 'random';
const classesApart = (team: Spec[]): boolean => new Set(team.map((s) => s.cls)).size === team.length;

describe('The Ring: the tables Random reads', () => {
  it('every pair of ready-made setups and every three with one or two healers was measured', () => {
    const healers = SPECS.filter(healerSpec);
    // the three healing setups: the priest's, the paladin's and the druid's
    expect(healers.map((s) => s.cls).sort()).toEqual(['druid', 'paladin', 'priest']);
    let pairs = 0;
    let trios = 0;
    for (let a = 0; a < SPECS.length; a++)
      for (let b = a + 1; b < SPECS.length; b++) {
        if (SPECS[a]!.cls === SPECS[b]!.cls) continue;
        pairs++;
        expect(PAIRS[teamKey([SPECS[a]!, SPECS[b]!])], teamKey([SPECS[a]!, SPECS[b]!])).toBeTypeOf('number');
        for (let c = b + 1; c < SPECS.length; c++) {
          const t = [SPECS[a]!, SPECS[b]!, SPECS[c]!];
          const h = t.filter(healerSpec).length;
          if (!classesApart(t) || h < 1 || h > 2) continue;
          trios++;
          expect(TRIOS[teamKey(t)], teamKey(t)).toBeTypeOf('number');
        }
      }
    expect(Object.keys(PAIRS)).toHaveLength(pairs);
    expect(Object.keys(TRIOS)).toHaveLength(trios);
    for (const v of [...Object.values(PAIRS), ...Object.values(TRIOS)]) expect(v >= 0 && v <= 100).toBe(true);
  });

  it('a team is named the same whichever order it is given in', () => {
    const a: Spec = { cls: 'priest', preset: 0 };
    const b: Spec = { cls: 'warrior', preset: 1 };
    expect(teamKey([a, b])).toBe(teamKey([b, a]));
    expect(teamScore([a, b])).toBe(PAIRS[teamKey([b, a])]);
  });
});

describe('The Ring: Random teammates', () => {
  it('3v3: always exactly one healer and one damage setup beside you, whoever you are', () => {
    for (const me of SPECS) {
      for (let seed = 0; seed < 24; seed++) {
        const mates = fillSide(3, [me], [R(), R()], seed);
        expect(mates, `${teamKey([me])} seed ${seed}`).toHaveLength(2);
        expect(mates.filter(healerSpec)).toHaveLength(1);
        expect(classesApart([me, ...mates])).toBe(true);
      }
    }
  });

  it('3v3: of all the teams that keep that rule, Random brings one of the best', () => {
    for (const me of SPECS) {
      const all: number[] = [];
      for (const h of SPECS.filter(healerSpec)) for (const d of SPECS.filter((s) => !healerSpec(s))) if (classesApart([me, h, d])) all.push(teamScore([me, h, d]));
      const best = Math.max(...all);
      for (const t of bestFits(3, [me], [R(), R()])) expect(teamScore([me, ...t])).toBeGreaterThanOrEqual(best - NEAR);
    }
  });

  it('2v2: a healer or a damage setup, picked from the best pairs for your setup', () => {
    const roles = new Set<boolean>();
    for (const me of SPECS) {
      const others = SPECS.filter((s) => s.cls !== me.cls && !(healerSpec(me) && healerSpec(s)));
      const scores = others.map((s) => teamScore([me, s])).sort((a, b) => a - b);
      const best = scores[scores.length - 1]!;
      const median = scores[Math.floor(scores.length / 2)]!;
      for (let seed = 0; seed < 16; seed++) {
        const [mate, extra] = fillSide(2, [me], [R()], seed);
        expect(extra).toBeUndefined();
        expect(mate!.cls).not.toBe(me.cls);
        // never two healers, and only a pair that wins as much as the best, as far as the measuring can tell
        if (healerSpec(me)) expect(healerSpec(mate!)).toBe(false);
        expect(teamScore([me, mate!])).toBeGreaterThanOrEqual(best - NEAR);
        expect(teamScore([me, mate!])).toBeGreaterThanOrEqual(median);
        if (!healerSpec(me)) roles.add(healerSpec(mate!));
      }
    }
    // (whichever pair wins more. On 2026-11-14's abilities both kinds of answer came up, a healer for most and another
    // damage dealer for the Rime; on the fixed playstyles of 2026-11-16 a healer is every damage setup's best second)
    expect(roles.has(true)).toBe(true);
  });

  it('the same seed gives the same team: every screen of a room agrees', () => {
    const me: Spec = { cls: 'mage', preset: 1 };
    expect(fillSide(3, [me], [R(), R()], 77)).toEqual(fillSide(3, [me], [R(), R()], 77));
  });
});

describe('The Ring: chosen teammates', () => {
  const me: Spec = { cls: 'warrior', preset: 0 };

  it('a chosen class and setup is honored, in its place', () => {
    expect(fillSide(2, [me], [{ cls: 'mage', preset: 1 }], 3)).toEqual([{ cls: 'mage', preset: 1 }]);
    expect(fillSide(3, [me], [{ cls: 'ranger', preset: 1 }, { cls: 'paladin', preset: 1 }], 3)).toEqual([
      { cls: 'ranger', preset: 1 },
      { cls: 'paladin', preset: 1 },
    ]);
  });

  it('3v3, one chosen and one Random: Random completes one healer and one damage setup', () => {
    for (let seed = 0; seed < 12; seed++) {
      const [a, b] = fillSide(3, [me], [{ cls: 'priest', preset: 0 }, R()], seed);
      expect(a).toEqual({ cls: 'priest', preset: 0 });
      expect(healerSpec(b!)).toBe(false);
      const [c, d] = fillSide(3, [me], [R(), { cls: 'mage', preset: 0 }], seed);
      expect(d).toEqual({ cls: 'mage', preset: 0 });
      expect(healerSpec(c!)).toBe(true);
      expect(classesApart([me, a!, b!])).toBe(true);
      expect(classesApart([me, c!, d!])).toBe(true);
    }
  });

  it('no class twice on a side: your own class, or one taken already, becomes Random', () => {
    expect(honored('warrior', [{ cls: 'warrior', preset: 1 }, { cls: 'mage', preset: 0 }])).toEqual(['random', { cls: 'mage', preset: 0 }]);
    expect(honored('warrior', [{ cls: 'mage', preset: 0 }, { cls: 'mage', preset: 1 }])).toEqual([{ cls: 'mage', preset: 0 }, 'random']);
    for (let seed = 0; seed < 12; seed++) {
      const got = fillSide(3, [me], [{ cls: 'warrior', preset: 1 }, { cls: 'druid', preset: 0 }], seed);
      expect(classesApart([me, ...got])).toBe(true);
      expect(got[1]).toEqual({ cls: 'druid', preset: 0 });
      const twice = fillSide(3, [me], [{ cls: 'priest', preset: 0 }, { cls: 'priest', preset: 1 }], seed);
      expect(classesApart([me, ...twice])).toBe(true);
    }
  });

  it('a person on the side takes a place before the computer', () => {
    const friend: Spec = { cls: 'priest', preset: 0 };
    // two people in a 3v3: one place left, and the first choice takes it
    expect(fillSide(3, [me, friend], [{ cls: 'mage', preset: 1 }, { cls: 'druid', preset: 0 }], 1)).toEqual([{ cls: 'mage', preset: 1 }]);
    // a Random place gives way before a chosen one
    expect(fillSide(3, [me, friend], [R(), { cls: 'ranger', preset: 1 }], 1)).toEqual([{ cls: 'ranger', preset: 1 }]);
    // the friend plays the class chosen first: the next choice takes the place
    expect(fillSide(3, [me, friend], [{ cls: 'priest', preset: 1 }, { cls: 'ranger', preset: 0 }], 1)).toEqual([{ cls: 'ranger', preset: 0 }]);
    // with a healing friend, Random brings damage; with a fighting friend, a healer
    for (let seed = 0; seed < 8; seed++) {
      expect(healerSpec(fillSide(3, [me, friend], [R(), R()], seed)[0]!)).toBe(false);
      expect(healerSpec(fillSide(3, [me, { cls: 'mage', preset: 0 }], [R(), R()], seed)[0]!)).toBe(true);
    }
    // a full side: nobody from the computer
    expect(fillSide(2, [me, friend], [{ cls: 'mage', preset: 0 }], 1)).toEqual([]);
  });

  it('a changed setup counts as the ready-made one it is closest to', () => {
    // (a bar kept from when abilities were chosen one by one: the playstyle it shares most with)
    expect(specOf('priest', ['p-mend', 'p-renew', 'p-smite', 'p-lance'])).toEqual({ cls: 'priest', preset: 0 });
    expect(specOf('priest', ['p-gnaw', 'p-curse', 'p-hush', 'p-mend'])).toEqual({ cls: 'priest', preset: 1 });
    expect(specOf('warrior', PRESETS.warrior[1]!.bar)).toEqual({ cls: 'warrior', preset: 1 });
  });

  it('choosing a class starts on its setup that does best beside yours', () => {
    const p = bestPreset(me, 'paladin');
    expect(teamScore([me, { cls: 'paladin', preset: p }])).toBeGreaterThanOrEqual(teamScore([me, { cls: 'paladin', preset: 1 - p }]));
  });
});

describe('The Ring: teammate choices are kept, and go to a room', () => {
  beforeEach(() => localStorage.clear());

  it('kept per format with the rest of the save, and anything broken read as Random', () => {
    const save = readRing();
    writeRing({ ...save, mates: { 2: [{ cls: 'priest', preset: 0 }], 3: ['random', { cls: 'mage', preset: 1 }] } });
    const back = readRing();
    expect(choicesFor(back.mates?.[2], 2)).toEqual([{ cls: 'priest', preset: 0 }]);
    expect(choicesFor(back.mates?.[3], 3)).toEqual(['random', { cls: 'mage', preset: 1 }]);
    expect(choicesFor(undefined, 3)).toEqual(['random', 'random']);
    expect(choicesFor([{ cls: 'dragon', preset: 0 }, { cls: 'mage', preset: 9 }], 3)).toEqual(['random', { cls: 'mage', preset: 0 }]);
    expect(choicesFor('nonsense', 2)).toEqual(['random']);
  });

  it('a choice travels as a word and comes back the same', () => {
    for (const c of [R(), { cls: 'gloamknight' as ClassId, preset: 1 }, { cls: 'priest' as ClassId, preset: 0 }]) expect(choiceFromWord(choiceWord(c))).toEqual(c);
    expect(choiceFromWord('dragon-0')).toBe('random');
    expect(cleanPick({ team: 0, cls: 'mage', bar: [], oath: 'iron', talents: [], mates: ['priest-0', 'random'] })?.mates).toEqual(['priest-0', 'random']);
    expect(cleanPick({ team: 0, cls: 'mage', bar: [], oath: 'iron', talents: [], mates: ['priest-0', 'random', 'mage-1'] })?.mates).toBeUndefined();
    expect(cleanPick({ team: 0, cls: 'mage', bar: [], oath: 'iron', talents: [], mates: ['<script>'] })?.mates).toBeUndefined();
  });

  it('in a room, the empty places of a side hold what its first player chose, and both ends agree', () => {
    const KEYS = ['aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb', 'cccccccccccccccccccc'];
    const s = newRoom('ABCD', 0, 42);
    for (const [i, k] of KEYS.entries()) expect(join(s, k, `P${i}`, 0)).toBeNull();
    const pick = (team: 0 | 1, cls: ClassId, mates?: string[]) => ({ team, cls, bar: PRESETS[cls][0]!.bar, oath: 'iron', talents: PRESETS[cls][0]!.talents, ...(mates ? { mates } : {}) });
    act(s, KEYS[0]!, { t: 'setup', format: 3, map: 'sands' }, 1);
    // blue: one player who chose a ranger and Random; red: a player and a friend, with Random
    expect(act(s, KEYS[0]!, { t: 'pick', pick: pick(0, 'warrior', ['ranger-1', 'random']) }, 1)).toBeNull();
    expect(act(s, KEYS[1]!, { t: 'pick', pick: pick(1, 'mage', ['random', 'random']) }, 1)).toBeNull();
    expect(act(s, KEYS[2]!, { t: 'pick', pick: pick(1, 'priest') }, 1)).toBeNull();
    act(s, KEYS[0]!, { t: 'start' }, 1);
    const a = setupFromRoom(viewFor(s, KEYS[0]!)!);
    const b = setupFromRoom(viewFor(s, KEYS[1]!)!);
    expect(a.setup).toEqual(b.setup);
    const blue = a.setup.fighters.filter((f) => f.team === 0);
    const red = a.setup.fighters.filter((f) => f.team === 1);
    expect(blue.map((f) => f.cls).slice(0, 2)).toEqual(['warrior', 'ranger']);
    expect(blue[1]!.bar).toEqual(PRESETS.ranger[1]!.bar);
    // Random beside a warrior and a ranger: the healer
    expect(healerSpec(specOf(blue[2]!.cls, blue[2]!.bar))).toBe(true);
    // the friend took a place; with a priest among them, the computer's one is damage
    expect(red).toHaveLength(3);
    expect(red.filter((f) => f.seat !== undefined)).toHaveLength(2);
    expect(healerSpec(specOf(red[2]!.cls, red[2]!.bar))).toBe(false);
    for (const side of [blue, red]) expect(new Set(side.map((f) => f.cls)).size).toBe(3);
  });
});

/* ------------------------------------------------------------------ measuring the tables (RING_SYNERGY=1) */

const STEP = 1 / 30;

/** Opponent teams drawn as tests/sigilfall-ring-balance.test.ts draws them: the same list for every team measured. */
function opponents(size: 2 | 3, n: number): Spec[][] {
  let s = 4242 + size;
  const rand = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  return Array.from({ length: n }, () => {
    const out: Spec[] = [];
    if (rand() < (size === 3 ? 0.8 : 0.6)) {
      const hs = SPECS.filter(healerSpec);
      out.push(hs[Math.floor(rand() * hs.length)]!);
    }
    while (out.length < size) {
      const pool = SPECS.filter((x) => !healerSpec(x) && !out.some((o) => o.cls === x.cls));
      out.push(pool[Math.floor(rand() * pool.length)]!);
    }
    return out;
  });
}

function play(us: Spec[], them: Spec[], g: number): number {
  const fighters: FighterSetup[] = [us, them].flatMap((list, t) => list.map((x, i) => ({ team: t as 0 | 1, cls: x.cls, name: `${x.cls}${t}${i}`, bar: PRESETS[x.cls][x.preset]!.bar, talents: PRESETS[x.cls][x.preset]!.talents })));
  const m = new Match({ seed: g, map: MAP_IDS[g % MAP_IDS.length]!, fighters });
  const brains = m.fighters.map((_, i) => newBrain(g * 31 + i));
  const skill = [0.6, 0.9, 0.75][g % 3]!;
  for (let i = 0; i < 30 * 400 && m.phase !== 'over'; i++) {
    const moves: Record<number, MoveInput> = {};
    for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, skill, STEP);
    m.step(STEP, moves);
    m.events.length = 0;
  }
  return m.winner === null ? 0.5 : m.winner === 0 ? 1 : 0;
}

describe.skipIf(!process.env.RING_SYNERGY)('The Ring: measuring how teams do together', () => {
  it('prints PAIRS and TRIOS for arena/teammates.ts', () => {
    const n2 = Number(process.env.RING_SYNERGY_N2 ?? 400);
    const n3 = Number(process.env.RING_SYNERGY_N3 ?? 240);
    const measure = (team: Spec[], opp: Spec[][]): number => Math.round((opp.reduce((w, o, g) => w + play(team, o, 1000 + g), 0) / opp.length) * 100);
    const pairs: string[] = [];
    const trios: string[] = [];
    const o2 = opponents(2, n2);
    const o3 = opponents(3, n3);
    for (let a = 0; a < SPECS.length; a++)
      for (let b = a + 1; b < SPECS.length; b++) {
        const t = [SPECS[a]!, SPECS[b]!];
        if (classesApart(t)) pairs.push(`'${teamKey(t)}': ${measure(t, o2)}`);
        for (let c = b + 1; c < SPECS.length; c++) {
          const u = [SPECS[a]!, SPECS[b]!, SPECS[c]!];
          const h = u.filter(healerSpec).length;
          if (classesApart(u) && h >= 1 && h <= 2) trios.push(`'${teamKey(u)}': ${measure(u, o3)}`);
        }
      }
    console.info(`PAIRS (${n2} matches each):\n${pairs.join(', ')}\n\nTRIOS (${n3} matches each):\n${trios.join(', ')}`);
    expect(pairs.length).toBeGreaterThan(0);
  }, 24 * 3600_000);
});
