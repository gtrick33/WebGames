import type { ClassId } from '../data/types';
import { CLASS_IDS } from '../data/classes';
import { PRESETS, styleOfBar } from './abilities';
import { isHealer } from './bot';
import type { Format } from './ranks';

/**
 * Who stands beside the player in 2v2 and 3v3 when there aren't enough people for their side. The owner: "for
 * teammates, you should be able to select a class for 2v2 or 3v3 if u dont have a teammate, however, you can also
 * select a random option that pairs you in the 2v2 and 3v3 with the most balanced team each time and for 3v3 u should
 * always have 1 healer and 1 dps, for 2v2 depending on the class, it should be either healer or another dps that has
 * good synergy with your class".
 *
 * Each empty place on the player's side is either a class and one of its ready-made setups (PRESETS[cls][i]), or
 * Random. A person who joins the side always takes a place before the computer does; the choices are kept per format
 * with the rest of the Ring's save (arena/ladder.ts `RingSave.mates`), and go to a room with the player's pick
 * (net/ringRoom.ts `Pick.mates`), so that the empty places of a side in a room or a found match are filled the same way
 * on every screen.
 *
 * How Random decides, from measurements, not from guesses. The computer played every team the ready-made setups can
 * make, no class twice on a side, against the same 400 (2v2) or 240 (3v3) opponents: random teams drawn as
 * tests/sigilfall-ring-balance.test.ts draws them (60% of 2v2 teams and 80% of 3v3 teams bring a healer), on every
 * arena in turn, at the three levels of skill it uses there, both sides played by arena/bot.ts. PAIRS holds the % of
 * those matches each pair of setups won in 2v2 (all 112 pairs), TRIOS the % each three won in 3v3 (the 216 teams with
 * one or two healers). That is "synergy" and "balance" here: how often the two or three of them win together against
 * a spread of teams, which already counts a class's combos with another's holds, a melee fighter living longer beside
 * a healer, two killers with nobody to keep them standing, and so on.
 *
 * Random then takes the team that wins most with the player's own setup (a setup they changed counts as the
 * ready-made one it shares most abilities with, `specOf`), within the rules:
 * - 3v3: the player's teammates are always exactly one healer and one damage setup (a healer's setup: its basic
 *   ability heals a friend, as arena/bot.ts `isHealer` says). A healing player so gets a second healer, and the
 *   numbers agree: their best three with another healer won 90-92%, with two damage setups 82-85%;
 * - 2v2: a healer or a damage setup, whichever pair wins more; a healing player is never given a second healer;
 * - a class chosen for another place, or played by a person on the side, is never taken again.
 * Teams within NEAR points of the best are as good as it, as far as 400 matches can tell (one pair's share moves about
 * 2.5 points from one set of 400 to another), and Random picks among them by the match's seed: the most balanced team
 * each time, not always the same face.
 *
 * The numbers are from 2026-11-16's abilities (the fixed playstyles). When the balance moves a lot they can be measured again: RING_SYNERGY=1
 * npx vitest run tests/sigilfall-ring-teammates.test.ts prints fresh tables in this file's form (it takes a while).
 */

/** One of the ready-made setups: a class and which of its PRESETS. */
export interface Spec {
  cls: ClassId;
  preset: number;
}

/** What the player chose for an empty place on their side. */
export type MateChoice = Spec | 'random';

/** Within this many points of the best team, a team is as good as the best (see above). */
export const NEAR = 3;

/** Every ready-made setup, in a fixed order (class by class, as CLASS_IDS, then as PRESETS). */
export const SPECS: Spec[] = CLASS_IDS.flatMap((cls) => PRESETS[cls].map((_, preset) => ({ cls, preset })));

export const healerSpec = (s: Spec): boolean => isHealer({ bar: PRESETS[s.cls][s.preset]?.bar ?? [] });

const order = (s: Spec): number => SPECS.findIndex((x) => x.cls === s.cls && x.preset === s.preset);
/** A team's name in the tables: its setups in SPECS order, as `warrior0+priest0`. */
export const teamKey = (team: readonly Spec[]): string =>
  [...team]
    .sort((a, b) => order(a) - order(b))
    .map((s) => `${s.cls}${s.preset}`)
    .join('+');

/** The playstyle a bar is (abilities.ts styleOfBar: its own, or the one it shares most abilities with). */
export function specOf(cls: ClassId, bar: readonly string[]): Spec {
  return { cls, preset: PRESETS[cls].indexOf(styleOfBar(cls, bar)) };
}

/** % of 2v2 matches each pair of ready-made setups won together (see the top of this file). */
export const PAIRS: Record<string, number> = {
  'warrior0+mage0': 40, 'warrior0+mage1': 38, 'warrior0+ranger0': 31, 'warrior0+ranger1': 37, 'warrior0+paladin0': 68,
  'warrior0+paladin1': 35, 'warrior0+priest0': 65, 'warrior0+priest1': 33, 'warrior0+warlock0': 33,
  'warrior0+warlock1': 39, 'warrior0+druid0': 62, 'warrior0+druid1': 33, 'warrior0+gloamknight0': 37,
  'warrior0+gloamknight1': 49, 'warrior1+mage0': 34, 'warrior1+mage1': 28, 'warrior1+ranger0': 33,
  'warrior1+ranger1': 28, 'warrior1+paladin0': 65, 'warrior1+paladin1': 26, 'warrior1+priest0': 66,
  'warrior1+priest1': 33, 'warrior1+warlock0': 25, 'warrior1+warlock1': 33, 'warrior1+druid0': 65,
  'warrior1+druid1': 28, 'warrior1+gloamknight0': 31, 'warrior1+gloamknight1': 21, 'mage0+ranger0': 44,
  'mage0+ranger1': 35, 'mage0+paladin0': 71, 'mage0+paladin1': 25, 'mage0+priest0': 68, 'mage0+priest1': 34,
  'mage0+warlock0': 25, 'mage0+warlock1': 33, 'mage0+druid0': 64, 'mage0+druid1': 31, 'mage0+gloamknight0': 30,
  'mage0+gloamknight1': 39, 'mage1+ranger0': 40, 'mage1+ranger1': 36, 'mage1+paladin0': 57, 'mage1+paladin1': 31,
  'mage1+priest0': 56, 'mage1+priest1': 41, 'mage1+warlock0': 25, 'mage1+warlock1': 27, 'mage1+druid0': 52,
  'mage1+druid1': 30, 'mage1+gloamknight0': 28, 'mage1+gloamknight1': 38, 'ranger0+paladin0': 73,
  'ranger0+paladin1': 25, 'ranger0+priest0': 70, 'ranger0+priest1': 34, 'ranger0+warlock0': 32,
  'ranger0+warlock1': 30, 'ranger0+druid0': 65, 'ranger0+druid1': 38, 'ranger0+gloamknight0': 26,
  'ranger0+gloamknight1': 36, 'ranger1+paladin0': 67, 'ranger1+paladin1': 27, 'ranger1+priest0': 59,
  'ranger1+priest1': 38, 'ranger1+warlock0': 22, 'ranger1+warlock1': 25, 'ranger1+druid0': 61, 'ranger1+druid1': 25,
  'ranger1+gloamknight0': 22, 'ranger1+gloamknight1': 36, 'paladin0+priest0': 38, 'paladin0+priest1': 69,
  'paladin0+warlock0': 68, 'paladin0+warlock1': 68, 'paladin0+druid0': 41, 'paladin0+druid1': 71,
  'paladin0+gloamknight0': 70, 'paladin0+gloamknight1': 70, 'paladin1+priest0': 50, 'paladin1+priest1': 25,
  'paladin1+warlock0': 28, 'paladin1+warlock1': 35, 'paladin1+druid0': 47, 'paladin1+druid1': 28,
  'paladin1+gloamknight0': 35, 'paladin1+gloamknight1': 30, 'priest0+warlock0': 54, 'priest0+warlock1': 59,
  'priest0+druid0': 38, 'priest0+druid1': 62, 'priest0+gloamknight0': 60, 'priest0+gloamknight1': 63,
  'priest1+warlock0': 22, 'priest1+warlock1': 25, 'priest1+druid0': 60, 'priest1+druid1': 28,
  'priest1+gloamknight0': 28, 'priest1+gloamknight1': 29, 'warlock0+druid0': 54, 'warlock0+druid1': 27,
  'warlock0+gloamknight0': 26, 'warlock0+gloamknight1': 34, 'warlock1+druid0': 62, 'warlock1+druid1': 44,
  'warlock1+gloamknight0': 39, 'warlock1+gloamknight1': 32, 'druid0+gloamknight0': 56, 'druid0+gloamknight1': 63,
  'druid1+gloamknight0': 30, 'druid1+gloamknight1': 35,
};

/** % of 3v3 matches each three won together, for every three with one or two healers. */
export const TRIOS: Record<string, number> = {
  'warrior0+mage0+paladin0': 84, 'warrior0+mage0+priest0': 81, 'warrior0+mage0+druid0': 81,
  'warrior0+mage1+paladin0': 85, 'warrior0+mage1+priest0': 85, 'warrior0+mage1+druid0': 82,
  'warrior0+ranger0+paladin0': 75, 'warrior0+ranger0+priest0': 74, 'warrior0+ranger0+druid0': 73,
  'warrior0+ranger1+paladin0': 82, 'warrior0+ranger1+priest0': 76, 'warrior0+ranger1+druid0': 75,
  'warrior0+paladin0+priest0': 88, 'warrior0+paladin0+priest1': 76, 'warrior0+paladin0+warlock0': 75,
  'warrior0+paladin0+warlock1': 79, 'warrior0+paladin0+druid0': 92, 'warrior0+paladin0+druid1': 76,
  'warrior0+paladin0+gloamknight0': 80, 'warrior0+paladin0+gloamknight1': 80, 'warrior0+paladin1+priest0': 54,
  'warrior0+paladin1+druid0': 54, 'warrior0+priest0+warlock0': 68, 'warrior0+priest0+warlock1': 71,
  'warrior0+priest0+druid0': 90, 'warrior0+priest0+druid1': 71, 'warrior0+priest0+gloamknight0': 76,
  'warrior0+priest0+gloamknight1': 73, 'warrior0+priest1+druid0': 77, 'warrior0+warlock0+druid0': 70,
  'warrior0+warlock1+druid0': 73, 'warrior0+druid0+gloamknight0': 75, 'warrior0+druid0+gloamknight1': 78,
  'warrior1+mage0+paladin0': 70, 'warrior1+mage0+priest0': 66, 'warrior1+mage0+druid0': 73,
  'warrior1+mage1+paladin0': 68, 'warrior1+mage1+priest0': 65, 'warrior1+mage1+druid0': 67,
  'warrior1+ranger0+paladin0': 76, 'warrior1+ranger0+priest0': 73, 'warrior1+ranger0+druid0': 66,
  'warrior1+ranger1+paladin0': 60, 'warrior1+ranger1+priest0': 55, 'warrior1+ranger1+druid0': 51,
  'warrior1+paladin0+priest0': 86, 'warrior1+paladin0+priest1': 75, 'warrior1+paladin0+warlock0': 56,
  'warrior1+paladin0+warlock1': 62, 'warrior1+paladin0+druid0': 83, 'warrior1+paladin0+druid1': 59,
  'warrior1+paladin0+gloamknight0': 72, 'warrior1+paladin0+gloamknight1': 67, 'warrior1+paladin1+priest0': 43,
  'warrior1+paladin1+druid0': 42, 'warrior1+priest0+warlock0': 51, 'warrior1+priest0+warlock1': 63,
  'warrior1+priest0+druid0': 84, 'warrior1+priest0+druid1': 55, 'warrior1+priest0+gloamknight0': 66,
  'warrior1+priest0+gloamknight1': 63, 'warrior1+priest1+druid0': 78, 'warrior1+warlock0+druid0': 57,
  'warrior1+warlock1+druid0': 54, 'warrior1+druid0+gloamknight0': 62, 'warrior1+druid0+gloamknight1': 59,
  'mage0+ranger0+paladin0': 74, 'mage0+ranger0+priest0': 70, 'mage0+ranger0+druid0': 66, 'mage0+ranger1+paladin0': 64,
  'mage0+ranger1+priest0': 57, 'mage0+ranger1+druid0': 55, 'mage0+paladin0+priest0': 69, 'mage0+paladin0+priest1': 68,
  'mage0+paladin0+warlock0': 60, 'mage0+paladin0+warlock1': 67, 'mage0+paladin0+druid0': 68,
  'mage0+paladin0+druid1': 56, 'mage0+paladin0+gloamknight0': 61, 'mage0+paladin0+gloamknight1': 77,
  'mage0+paladin1+priest0': 42, 'mage0+paladin1+druid0': 39, 'mage0+priest0+warlock0': 48,
  'mage0+priest0+warlock1': 60, 'mage0+priest0+druid0': 67, 'mage0+priest0+druid1': 52,
  'mage0+priest0+gloamknight0': 56, 'mage0+priest0+gloamknight1': 69, 'mage0+priest1+druid0': 77,
  'mage0+warlock0+druid0': 53, 'mage0+warlock1+druid0': 55, 'mage0+druid0+gloamknight0': 56,
  'mage0+druid0+gloamknight1': 68, 'mage1+ranger0+paladin0': 68, 'mage1+ranger0+priest0': 59,
  'mage1+ranger0+druid0': 63, 'mage1+ranger1+paladin0': 51, 'mage1+ranger1+priest0': 44, 'mage1+ranger1+druid0': 51,
  'mage1+paladin0+priest0': 51, 'mage1+paladin0+priest1': 66, 'mage1+paladin0+warlock0': 48,
  'mage1+paladin0+warlock1': 54, 'mage1+paladin0+druid0': 53, 'mage1+paladin0+druid1': 51,
  'mage1+paladin0+gloamknight0': 60, 'mage1+paladin0+gloamknight1': 70, 'mage1+paladin1+priest0': 45,
  'mage1+paladin1+druid0': 42, 'mage1+priest0+warlock0': 42, 'mage1+priest0+warlock1': 47, 'mage1+priest0+druid0': 54,
  'mage1+priest0+druid1': 48, 'mage1+priest0+gloamknight0': 59, 'mage1+priest0+gloamknight1': 67,
  'mage1+priest1+druid0': 73, 'mage1+warlock0+druid0': 43, 'mage1+warlock1+druid0': 48,
  'mage1+druid0+gloamknight0': 64, 'mage1+druid0+gloamknight1': 69, 'ranger0+paladin0+priest0': 76,
  'ranger0+paladin0+priest1': 65, 'ranger0+paladin0+warlock0': 56, 'ranger0+paladin0+warlock1': 64,
  'ranger0+paladin0+druid0': 68, 'ranger0+paladin0+druid1': 62, 'ranger0+paladin0+gloamknight0': 65,
  'ranger0+paladin0+gloamknight1': 74, 'ranger0+paladin1+priest0': 47, 'ranger0+paladin1+druid0': 45,
  'ranger0+priest0+warlock0': 53, 'ranger0+priest0+warlock1': 53, 'ranger0+priest0+druid0': 73,
  'ranger0+priest0+druid1': 55, 'ranger0+priest0+gloamknight0': 60, 'ranger0+priest0+gloamknight1': 67,
  'ranger0+priest1+druid0': 76, 'ranger0+warlock0+druid0': 56, 'ranger0+warlock1+druid0': 50,
  'ranger0+druid0+gloamknight0': 57, 'ranger0+druid0+gloamknight1': 71, 'ranger1+paladin0+priest0': 61,
  'ranger1+paladin0+priest1': 65, 'ranger1+paladin0+warlock0': 43, 'ranger1+paladin0+warlock1': 51,
  'ranger1+paladin0+druid0': 57, 'ranger1+paladin0+druid1': 50, 'ranger1+paladin0+gloamknight0': 55,
  'ranger1+paladin0+gloamknight1': 63, 'ranger1+paladin1+priest0': 37, 'ranger1+paladin1+druid0': 35,
  'ranger1+priest0+warlock0': 39, 'ranger1+priest0+warlock1': 43, 'ranger1+priest0+druid0': 59,
  'ranger1+priest0+druid1': 43, 'ranger1+priest0+gloamknight0': 51, 'ranger1+priest0+gloamknight1': 65,
  'ranger1+priest1+druid0': 75, 'ranger1+warlock0+druid0': 45, 'ranger1+warlock1+druid0': 38,
  'ranger1+druid0+gloamknight0': 54, 'ranger1+druid0+gloamknight1': 59, 'paladin0+priest0+warlock0': 52,
  'paladin0+priest0+warlock1': 64, 'paladin0+priest0+druid1': 60, 'paladin0+priest0+gloamknight0': 69,
  'paladin0+priest0+gloamknight1': 81, 'paladin0+priest1+warlock0': 65, 'paladin0+priest1+warlock1': 74,
  'paladin0+priest1+druid0': 67, 'paladin0+priest1+druid1': 68, 'paladin0+priest1+gloamknight0': 71,
  'paladin0+priest1+gloamknight1': 63, 'paladin0+warlock0+druid0': 53, 'paladin0+warlock0+druid1': 48,
  'paladin0+warlock0+gloamknight0': 54, 'paladin0+warlock0+gloamknight1': 57, 'paladin0+warlock1+druid0': 61,
  'paladin0+warlock1+druid1': 57, 'paladin0+warlock1+gloamknight0': 54, 'paladin0+warlock1+gloamknight1': 67,
  'paladin0+druid0+gloamknight0': 63, 'paladin0+druid0+gloamknight1': 78, 'paladin0+druid1+gloamknight0': 55,
  'paladin0+druid1+gloamknight1': 63, 'paladin1+priest0+warlock0': 47, 'paladin1+priest0+warlock1': 56,
  'paladin1+priest0+druid0': 65, 'paladin1+priest0+druid1': 55, 'paladin1+priest0+gloamknight0': 55,
  'paladin1+priest0+gloamknight1': 56, 'paladin1+priest1+druid0': 70, 'paladin1+warlock0+druid0': 61,
  'paladin1+warlock1+druid0': 52, 'paladin1+druid0+gloamknight0': 62, 'paladin1+druid0+gloamknight1': 54,
  'priest0+warlock0+druid0': 52, 'priest0+warlock0+druid1': 40, 'priest0+warlock0+gloamknight0': 47,
  'priest0+warlock0+gloamknight1': 66, 'priest0+warlock1+druid0': 61, 'priest0+warlock1+druid1': 50,
  'priest0+warlock1+gloamknight0': 55, 'priest0+warlock1+gloamknight1': 67, 'priest0+druid0+gloamknight0': 66,
  'priest0+druid0+gloamknight1': 79, 'priest0+druid1+gloamknight0': 52, 'priest0+druid1+gloamknight1': 63,
  'priest1+warlock0+druid0': 49, 'priest1+warlock1+druid0': 48, 'priest1+druid0+gloamknight0': 59,
  'priest1+druid0+gloamknight1': 69, 'warlock0+druid0+gloamknight0': 46, 'warlock0+druid0+gloamknight1': 62,
  'warlock1+druid0+gloamknight0': 48, 'warlock1+druid0+gloamknight1': 59,
};

/**
 * How well a side does together, in % of matches won: measured for a pair or a three of ready-made setups; a three not
 * measured (no healer in it, or three) by the mean of its pairs.
 */
export function teamScore(team: readonly Spec[]): number {
  if (team.length < 2) return 50;
  const k = teamKey(team);
  const got = team.length === 2 ? PAIRS[k] : TRIOS[k];
  if (got !== undefined) return got;
  if (team.length === 2) return 50;
  const pairs: number[] = [];
  for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) pairs.push(teamScore([team[i]!, team[j]!]));
  return pairs.reduce((a, b) => a + b, 0) / pairs.length;
}

/** A choice as it can be used: a known class and a setup it has, else Random. */
export function cleanChoice(v: unknown): MateChoice {
  if (!v || typeof v !== 'object') return 'random';
  const c = v as Record<string, unknown>;
  if (typeof c.cls !== 'string' || !CLASS_IDS.includes(c.cls as ClassId)) return 'random';
  const cls = c.cls as ClassId;
  const preset = typeof c.preset === 'number' && Number.isInteger(c.preset) && c.preset >= 0 && c.preset < PRESETS[cls].length ? c.preset : 0;
  return { cls, preset };
}

/** The choices for a format's empty places, one for each (Random where nothing was chosen). */
export function choicesFor(kept: unknown, format: Format): MateChoice[] {
  const list = Array.isArray(kept) ? kept : [];
  return Array.from({ length: Math.max(0, format - 1) }, (_, i) => (list[i] === 'random' ? 'random' : cleanChoice(list[i])));
}

/**
 * The choices as they will be honored by a player of `cls`: one of their own class, or of a class an earlier place
 * already took, becomes Random (no class twice on a side). What the setup screen shows.
 */
export const honored = (cls: ClassId, choices: readonly MateChoice[]): MateChoice[] => slotsFor((choices.length + 1) as Format, [cls], choices);

/** For a room's word: `priest-0`, or `random`. */
export const choiceWord = (c: MateChoice): string => (c === 'random' ? 'random' : `${c.cls}-${c.preset}`);
export function choiceFromWord(w: unknown): MateChoice {
  if (typeof w !== 'string' || w === 'random') return 'random';
  const at = w.lastIndexOf('-');
  return cleanChoice({ cls: w.slice(0, at), preset: Number(w.slice(at + 1)) });
}

/**
 * What each place the people on a side (`side`: their classes, the chooser first) leave empty will hold, before Random
 * is worked out. A class someone on the side already plays, or an earlier place took, becomes Random, in its place.
 * When people have taken places, Random ones give way first, then the last ones chosen.
 */
export function slotsFor(format: Format, side: readonly ClassId[], choices: readonly MateChoice[]): MateChoice[] {
  const empty = Math.max(0, format - side.length);
  const taken = new Set<ClassId>(side);
  const slots: MateChoice[] = Array.from({ length: Math.max(empty, choices.length) }, (_, i) => {
    const c = choices[i] ?? 'random';
    if (c === 'random' || taken.has(c.cls)) return 'random';
    taken.add(c.cls);
    return c;
  });
  while (slots.length > empty) {
    const at = slots.lastIndexOf('random');
    slots.splice(at >= 0 ? at : slots.length - 1, 1);
  }
  return slots;
}

/**
 * The computer's teammates for a side: one for each place the people on it (`side`, the player whose choices these are
 * first) leave empty. A person always takes a place before the computer (slotsFor: which choices give way), and a
 * choice of a class a person on the side already plays becomes Random. `seed` picks between teams equally good
 * (NEAR), the same on every screen of a room.
 */
export function fillSide(format: Format, side: readonly Spec[], choices: readonly MateChoice[], seed: number): Spec[] {
  const fits = bestFits(format, side, choices);
  return fits.length ? fits[Math.abs(Math.floor(seed)) % fits.length]! : [];
}

/**
 * Every team Random picks between for a side (each as fillSide gives it, the chosen places where they were), best
 * first: those within NEAR points of the best that keep to the rules at the top of this file.
 */
export function bestFits(format: Format, side: readonly Spec[], choices: readonly MateChoice[]): Spec[][] {
  if (!side.length) return [];
  const slots = slotsFor(format, side.map((s) => s.cls), choices);
  const open = slots.filter((c) => c === 'random').length;
  if (!open) return [slots as Spec[]];
  const chosen = slots.filter((c): c is Spec => c !== 'random');
  const taken = new Set<ClassId>([...side.map((s) => s.cls), ...chosen.map((c) => c.cls)]);
  // the teammates already settled: people beside the player, and the places chosen
  const healersIn = [...side.slice(1), ...chosen].filter(healerSpec).length;
  const pool = SPECS.filter((s) => !taken.has(s.cls));
  // every way to fill the Random places: setups of classes not on the side, none twice
  const ways: Spec[][] = [];
  const grow = (from: number, got: Spec[]): void => {
    if (got.length === open) {
      ways.push(got);
      return;
    }
    for (let i = from; i < pool.length; i++) if (!got.some((g) => g.cls === pool[i]!.cls)) grow(i + 1, [...got, pool[i]!]);
  };
  grow(0, []);
  const keeps = (way: Spec[]): boolean => {
    const healers = way.filter(healerSpec).length;
    // 3v3: one healer among the teammates, and the rest damage
    if (format === 3) return healersIn === 0 ? healers === 1 : healers === 0;
    // 2v2: a healer or a damage setup, never a second healer beside a healing player
    return !(healerSpec(side[0]!) && healers > 0);
  };
  const allowed = ways.filter(keeps);
  const scored = (allowed.length ? allowed : ways).map((way) => ({ way, score: teamScore([...side, ...chosen, ...way]) }));
  if (!scored.length) return [];
  const best = Math.max(...scored.map((x) => x.score));
  return scored
    .filter((x) => x.score >= best - NEAR)
    .sort((a, b) => b.score - a.score || teamKey(a.way).localeCompare(teamKey(b.way)))
    .map(({ way }) => {
      // (a healer goes last, as a team is usually read: the fighters, then who keeps them standing)
      const left = [...way].sort((a, b) => Number(healerSpec(a)) - Number(healerSpec(b)));
      return slots.map((c) => (c === 'random' ? left.shift()! : c));
    });
}

/** The setup of a class that does best beside a player's: what a place starts on when its class is chosen. */
export function bestPreset(me: Spec, cls: ClassId): number {
  let best = 0;
  PRESETS[cls].forEach((_, i) => {
    if (teamScore([me, { cls, preset: i }]) > teamScore([me, { cls, preset: best }])) best = i;
  });
  return best;
}

