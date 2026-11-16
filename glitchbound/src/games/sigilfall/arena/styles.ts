import type { ClassId } from '../data/types';
import { PRESETS, styleOfBar } from './abilities';

/**
 * How hard a class or a playstyle is to pick up, for someone who has never fought in an arena: shown beside each class
 * in the Ring's lobby and on each playstyle card (the owner, 2026-11-14: "i wanna make this game mode accessible for
 * every type of player").
 */
export type Ease = 'easy' | 'medium' | 'hard';

export const EASE_WORD: Record<Ease, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * Each class as a whole. Easy: few things to watch, and they work the moment they are pressed. Medium: a cast to stand
 * through, a heal to time, or a circle to place. Hard: the shroud, striking from behind and counting what to spend.
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
    arms: { line: 'Charge in, open a bleeding wound, then hew at it.', ease: 'easy' },
    pin: { line: 'Run them down, slow them, and bleed them dry.', ease: 'easy' },
  },
  mage: {
    fire: { line: 'Set them alight from afar, then burst the fire.', ease: 'medium' },
    frost: { line: 'Slow them, freeze them in place, then shatter the ice.', ease: 'medium' },
  },
  ranger: {
    sniper: { line: 'Shoot on the move; stun them with your hawk for the long shot.', ease: 'easy' },
    trapper: { line: 'Slow them and trap them while your volleys rain down.', ease: 'medium' },
  },
  priest: {
    healer: { line: 'Shield and heal your friends, with a blow between heals. Best with a team.', ease: 'medium' },
    shadow: { line: 'Curse them, then gnaw at the curse.', ease: 'medium' },
  },
  paladin: {
    holy: { line: 'Heal your friends, and pass a verdict on whoever your hammer stuns. Best with a team.', ease: 'easy' },
    ret: { line: 'Stun them with your hammer, then bring the blade down.', ease: 'easy' },
  },
  warlock: {
    curses: { line: 'Lay an agony on them with every dart, then make it bloom.', ease: 'medium' },
    grave: { line: 'Raise the dead to fight beside you, and fire past them.', ease: 'medium' },
  },
  druid: {
    heal: { line: 'Keep everyone alive with healing that grows over time. Best with a team.', ease: 'medium' },
    star: { line: 'Burn them with the moon, then rain starlight on the burn.', ease: 'medium' },
  },
  gloamknight: {
    reaver: { line: 'Drag them to you and reap them up close.', ease: 'medium' },
    shadow: { line: 'Hide, strike from behind, and spend your Nicks on one deep cut.', ease: 'hard' },
  },
};

/** A preset's playstyle: its line and how hard it is (a preset with none written says what its class is like). */
export function styleOf(cls: ClassId, presetId: string): Style {
  return STYLES[cls][presetId] ?? { line: '', ease: CLASS_EASE[cls] };
}

/** Which of its class's playstyles a bar is, whatever order its four are in: its index in PRESETS (a bar is always one of them, or read as the nearest). */
export function presetOfBar(cls: ClassId, bar: readonly string[]): number {
  return PRESETS[cls].indexOf(styleOfBar(cls, bar));
}

/**
 * The playstyle a bar plays as, by name. Each fighter's nameplate says it in small letters (the owner, 2026-11-15:
 * "somewhere in nameplate add the playstyle of the class with tiny shrift"), so a Pyre is told from a Rime at a glance.
 */
export function playstyleOf(cls: ClassId, bar: readonly string[]): string {
  return styleOfBar(cls, bar).name;
}
