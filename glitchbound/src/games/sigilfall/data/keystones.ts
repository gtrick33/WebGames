import { BOSSES } from './bosses';
import type { RegionDef } from './types';

/**
 * Riftstones: the endgame. After the Hollow King falls the Rift is still open, and Ysolde gives the hero a
 * Riftstone: any dungeon can be run at level 60 with the stone's level, +2 upward, against the clock. Every
 * level makes its enemies tougher (without end), and affixes join at +2, +4, +7 and +10, a new set each week.
 * Beat the clock and the stone grows (+1, +2 or +3 by how fast); miss it and it shrinks by one. Loot grows
 * with the stone to item level 70 at +10; beyond that higher stones pay in more items and Sigil Marks.
 */

/** The level every Riftstone run is fought at (enemies; bosses one more). */
export const KEY_LEVEL = 60;
/** The lowest stone. */
export const KEY_MIN = 2;
/** Seconds each death costs on the clock. */
export const KEY_DEATH = 10;

/** How much tougher enemies are at a stone's level (health and damage, against Normal at 60). */
export function keyScale(key: number): { hp: number; dmg: number } {
  return { hp: 1.6 * 1.1 ** key, dmg: 1.25 * 1.08 ** key };
}

/** The item level a stone's loot is made at. */
export const keyLoot = (key: number): number => Math.min(70, KEY_LEVEL + key);

/** Sigil Marks for finishing (more in time). */
export const keyMarks = (key: number, inTime: boolean): number => (inTime ? 3 + key : 1 + Math.floor(key / 2));

export type KeyAffix = 'fortified' | 'tyrannical' | 'bolstering' | 'sanguine' | 'raging' | 'bursting' | 'volatile' | 'hasted';

export const KEY_AFFIXES: Record<KeyAffix, { name: string; text: string }> = {
  fortified: { name: 'Fortified', text: 'Enemies other than bosses have 30% more health and deal 15% more damage.' },
  tyrannical: { name: 'Tyrannical', text: 'Bosses have 30% more health and deal 15% more damage.' },
  bolstering: { name: 'Bolstering', text: 'When an enemy dies, the others near it grow stronger.' },
  sanguine: { name: 'Sanguine', text: 'Fallen enemies leave a pool of blood that heals their friends and hurts you.' },
  raging: { name: 'Raging', text: 'Enemies other than bosses fly into a rage below 30% health.' },
  bursting: { name: 'Bursting', text: 'Every enemy that dies makes you bleed a little for a few seconds; the bleeding stacks.' },
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
    // from +10 both Fortified and Tyrannical
    { at: 10, affix: a[1]! },
  ];
}

/** The affixes a stone of this level carries this week. */
export const keyAffixes = (key: number, week: number): KeyAffix[] => weekAffixes(week).filter((x) => key >= x.at).map((x) => x.affix);

/** The week number of a date (weeks start on Monday, so everyone's week changes together). */
export const weekOf = (ms: number): number => Math.floor((ms / 86_400_000 + 3) / 7);

/**
 * The clock for a dungeon: a little over twice what a level-60 hero in good gear takes on a +2 stone, from
 * how many enemies its waves hold and how much health its bosses have (measured with the bot: those two
 * explain nearly all of a run's length).
 */
export function keyPar(r: Pick<RegionDef, 'encounters'>): number {
  const foes = r.encounters.reduce((a, e) => a + (e.boss ? 0 : e.waves.reduce((b, wv) => b + wv.enemies.length, 0)), 0);
  const bossHp = r.encounters.reduce((a, e) => a + (e.boss ? (BOSSES[e.boss]?.hp ?? 0) : 0), 0);
  return Math.round(2.2 * (20 + 2.6 * foes + 0.012 * bossHp));
}

/** How the stone changes when a run ends: by how far inside the clock it finished (or one down if not). */
export function keyUpgrade(time: number, par: number): number {
  if (time <= par * 0.6) return 3;
  if (time <= par * 0.8) return 2;
  if (time <= par) return 1;
  return -1;
}
