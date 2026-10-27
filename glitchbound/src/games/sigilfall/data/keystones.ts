import { BOSSES } from './bosses';
import type { RegionDef, RegionId } from './types';

/**
 * Riftstone and the Riftstone: the endgame past Mythic, climbed as Diablo's rifts are. Clearing Duskspire on
 * Mythic earns a Riftstone and opens Riftstone +1; any dungeon can be run at any level the stone has opened,
 * against the clock. Every level makes its enemies tougher (without end), and affixes join at +2, +4, +7 and
 * +10, a new set each week. Beat the clock and the next one, two or three levels open (by how fast); late, the
 * run still pays, and nothing is lost. Loot grows with the level, one item level a level past Mythic's, so
 * higher levels make better gear, and better gear (with Paragon points) the next level.
 */

/** The enemy level every Riftstone run is fought at: a level-60 dungeon on Mythic (bosses one more). */
export const KEY_LEVEL = 72;
/** The lowest level. */
export const KEY_MIN = 1;
/** Seconds each fall costs on the clock. */
export const KEY_DEATH = 10;
/** The highest item level loot is ever made at (Riftstone +28 and up). */
export const MAX_IL = 100;

/** Health and damage on top of an enemy's level at a stone's level: Mythic's, and more with every level. */
export function keyScale(key: number): { hp: number; dmg: number } {
  return { hp: 4 * 1.08 ** key, dmg: 2.1 * 1.05 ** key };
}

/** The item level a stone's loot is made at. */
export const keyLoot = (key: number): number => Math.min(MAX_IL, KEY_LEVEL + key);

/** Sigil Marks for finishing (more in time). */
export const keyMarks = (key: number, inTime: boolean): number => (inTime ? 4 + key : 1 + Math.floor(key / 2));

/** Items in the Rift's cache at the end of a run in time. */
export const keyCache = (key: number): number => 3 + Math.floor(key / 3);

export type KeyAffix = 'fortified' | 'tyrannical' | 'bolstering' | 'sanguine' | 'raging' | 'bursting' | 'volatile' | 'hasted';

export const KEY_AFFIXES: Record<KeyAffix, { name: string; text: string }> = {
  fortified: { name: 'Hardened', text: 'Enemies other than bosses have 30% more health and deal 15% more damage.' },
  tyrannical: { name: 'Crowned', text: 'Bosses have 30% more health and deal 15% more damage.' },
  bolstering: { name: 'Grieving', text: 'When an enemy dies, the others near it grow stronger.' },
  sanguine: { name: 'Festering', text: 'Fallen enemies leave a pool of blood that heals their friends and hurts you.' },
  raging: { name: 'Cornered', text: 'Enemies other than bosses fly into a rage below 30% health.' },
  bursting: { name: 'Splintering', text: 'Every enemy that dies makes you bleed a little for a few seconds; the bleeding stacks.' },
  volatile: { name: 'Volatile', text: 'Enemies explode a moment after they die.' },
  hasted: { name: 'Hasted', text: 'Enemies move and attack 20% faster.' },
};

/** The week's affixes for every stone level they come at (+2, +4, +7, +10), from a week number. */
export function weekAffixes(week: number): { at: number; affix: KeyAffix }[] {
  const a: KeyAffix[] = week % 2 === 0 ? ['fortified', 'tyrannical'] : ['tyrannical', 'fortified'];
  const b: KeyAffix[] = ['bolstering', 'sanguine', 'raging', 'bursting'];
  const c: KeyAffix[] = ['volatile', 'hasted'];
  return [
    { at: 2, affix: a[0]! },
    { at: 4, affix: b[week % b.length]! },
    { at: 7, affix: c[Math.floor(week / 2) % c.length]! },
    // from +10 both Hardened and Crowned
    { at: 10, affix: a[1]! },
  ];
}

/** The affixes a stone of this level carries this week. */
export const keyAffixes = (key: number, week: number): KeyAffix[] => weekAffixes(week).filter((x) => key >= x.at).map((x) => x.affix);

/** The week number of a date (weeks start on Monday, so everyone's week changes together). */
export const weekOf = (ms: number): number => Math.floor((ms / 86_400_000 + 3) / 7);

/**
 * Each dungeon's clock, in seconds: about 1.3 times what the play-bot's priest (the steadier of the slower
 * classes) takes on Riftstone +1 in Mythic gear (item level 72), rounded to 15 s. Measured on 2026-10-27; the
 * warrior is faster almost everywhere, so a quick class beats +1 by enough to open +4.
 */
const KEY_PARS: Partial<Record<RegionId, number>> = {
  crypt: 225,
  'gallows-keep': 240,
  'smugglers-grotto': 255,
  'rotmother-cistern': 450,
  'deepforge-halls': 600,
  'barrow-of-kings': 585,
  'tomb-of-the-sun-king': 630,
  'rimeheld-vault': 750,
  'siege-of-highwall': 510,
  blightheart: 735,
  'molten-throne': 750,
  'spire-of-the-rift': 645,
  duskspire: 960,
  'vaelmoor-remembered': 450,
  'crown-catacombs': 375,
};

/**
 * The clock for a dungeon: its measured one, or (a dungeon added since) one from how many enemies its waves
 * hold and how much health its bosses have, the two that explain most of a run's length.
 */
export function keyPar(r: Pick<RegionDef, 'id' | 'encounters'>): number {
  const set = KEY_PARS[r.id];
  if (set) return set;
  const foes = r.encounters.reduce((a, e) => a + (e.boss ? 0 : e.waves.reduce((b, wv) => b + wv.enemies.length, 0)), 0);
  const bossHp = r.encounters.reduce((a, e) => a + (e.boss ? (BOSSES[e.boss]?.hp ?? 0) : 0), 0);
  return Math.round((1.3 * (60 + 2.4 * foes + 0.028 * bossHp)) / 15) * 15;
}

/** How many levels a run opens above its own: by how far inside the clock it finished (−1: late, none). */
export function keyUpgrade(time: number, par: number): number {
  if (time <= par * 0.6) return 3;
  if (time <= par * 0.8) return 2;
  if (time <= par) return 1;
  return -1;
}
