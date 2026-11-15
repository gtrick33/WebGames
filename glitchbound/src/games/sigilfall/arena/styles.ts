import type { ClassId } from '../data/types';
import { PRESETS } from './abilities';

/**
 * How hard a class or a playstyle is to pick up, for someone who has never fought in an arena: shown beside each class
 * in the Ring's lobby and on each playstyle card (the owner, 2026-11-14: "i wanna make this game mode accessible for
 * every type of player").
 */
export type Ease = 'easy' | 'medium' | 'hard';

export const EASE_WORD: Record<Ease, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * Each class as a whole. Easy: few things to watch, and they work the moment they are pressed. Medium: a cast to stand
 * through, a heal to time, or a circle to place. Hard: the shroud and striking from behind.
 */
export const CLASS_EASE: Record<ClassId, Ease> = {
  warrior: 'easy',
  paladin: 'easy',
  ranger: 'easy',
  mage: 'medium',
  priest: 'medium',
  druid: 'medium',
  warlock: 'medium',
  gloamknight: 'hard',
};

/** How each class fights, in two words: whether it closes in or keeps away, and whether it heals. */
export const CLASS_WAY: Record<ClassId, string> = {
  warrior: 'Up close',
  paladin: 'Up close, heals',
  ranger: 'From range',
  mage: 'From range',
  priest: 'From range, heals',
  druid: 'From range, heals',
  warlock: 'From range',
  gloamknight: 'Up close',
};

export interface Style {
  /** What it plays like, in one line. */
  line: string;
  ease: Ease;
}

/** Each ready-made build as a playstyle (abilities.ts PRESETS), by the preset's id. */
export const STYLES: Record<ClassId, Record<string, Style>> = {
  warrior: {
    arms: { line: 'Charge in, open a bleeding wound, then hit it hard.', ease: 'easy' },
    pin: { line: 'Run them down and slow them so they can’t get away.', ease: 'easy' },
  },
  mage: {
    fire: { line: 'Set them alight from afar, then drop a great fire on them.', ease: 'medium' },
    frost: { line: 'Freeze them in place, then shatter the ice.', ease: 'medium' },
  },
  ranger: {
    sniper: { line: 'Shoot from far away: poison them, then loose a heavy shot.', ease: 'easy' },
    trapper: { line: 'Lay traps and slow them while your arrows rain down.', ease: 'medium' },
  },
  priest: {
    healer: { line: 'Heal and shield yourself and your friends. Best with a team.', ease: 'medium' },
    shadow: { line: 'Curse them, scare them off, and burn them with light.', ease: 'medium' },
  },
  paladin: {
    holy: { line: 'Heal yourself and your friends, and stun whoever comes close.', ease: 'easy' },
    ret: { line: 'Stun them with your hammer, then strike hard up close.', ease: 'easy' },
  },
  warlock: {
    curses: { line: 'Stack curses that eat away at them while you keep your distance.', ease: 'medium' },
    grave: { line: 'Raise the dead to fight beside you.', ease: 'hard' },
  },
  druid: {
    heal: { line: 'Keep everyone alive with healing that grows over time. Best with a team.', ease: 'medium' },
    star: { line: 'Root them and toss them about, then rain starlight on them.', ease: 'medium' },
  },
  gloamknight: {
    reaver: { line: 'Lunge in and cut them down up close.', ease: 'medium' },
    shadow: { line: 'Hide in the shadows, then strike from behind.', ease: 'hard' },
  },
};

/** A preset's playstyle: its line and how hard it is (a preset with none written says what its class is like). */
export function styleOf(cls: ClassId, presetId: string): Style {
  return STYLES[cls][presetId] ?? { line: '', ease: CLASS_EASE[cls] };
}

/** Which ready-made build a bar is, whatever order its five are in: its index in PRESETS, or -1 for a bar of one's own. */
export function presetOfBar(cls: ClassId, bar: readonly string[]): number {
  return PRESETS[cls].findIndex((p) => p.bar.length === bar.length && p.bar.every((id) => bar.includes(id)));
}

/**
 * The playstyle a bar plays as: the ready-made build it shares the most abilities with (the first on a tie), by name.
 * Each fighter's nameplate says it in small letters (the owner, 2026-11-15: "somewhere in nameplate add the playstyle
 * of the class with tiny shrift"), so a Pyre is told from a Rime at a glance.
 */
export function playstyleOf(cls: ClassId, bar: readonly string[]): string {
  let best = PRESETS[cls][0]!;
  let most = -1;
  for (const p of PRESETS[cls]) {
    const n = p.bar.filter((id) => bar.includes(id)).length;
    if (n > most) {
      most = n;
      best = p;
    }
  }
  return best.name;
}
