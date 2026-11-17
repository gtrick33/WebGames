import type { ClassId } from '../data/types';
import { PRESETS, styleOfBar } from './abilities';

/**
 * How hard a class or a playstyle is to pick up, for someone who has never fought in an arena: shown beside each class
 * in the Ring's lobby and on each playstyle card (the owner, 2026-11-14: "i wanna make this game mode accessible for
 * every type of player").
 */
export type Ease = 'easy' | 'medium' | 'hard';

/** Said in one word, in its own color wherever it is shown: Easy green, Medium yellow, Hard red (Game.css is-easy, is-medium, is-hard). */
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

/**
 * How each class fights, in a word or two: melee or ranged, and whether it heals (the owner, 2026-11-17: "from range
 * could be replaced with ranged, and the other type should be melee").
 */
export const CLASS_WAY: Record<ClassId, string> = {
  warrior: 'Melee',
  paladin: 'Melee, heals',
  ranger: 'Ranged',
  mage: 'Ranged',
  priest: 'Ranged, heals',
  druid: 'Ranged, heals',
  warlock: 'Ranged',
  gloamknight: 'Melee',
};

export interface Style {
  /** What it plays like, in one line. */
  line: string;
  ease: Ease;
}

/** Each ready-made build as a playstyle (abilities.ts PRESETS), by the preset's id. */
export const STYLES: Record<ClassId, Record<string, Style>> = {
  warrior: {
    arms: { line: 'Melee bruiser. Open a bleed, then hit it hard.', ease: 'easy' },
    pin: { line: 'Melee chaser. Slow them and bleed them out.', ease: 'easy' },
  },
  mage: {
    fire: { line: 'Ranged burst. Ignite, then detonate.', ease: 'medium' },
    frost: { line: 'Ranged control. Slow, freeze, shatter.', ease: 'medium' },
  },
  ranger: {
    sniper: { line: 'Ranged marksman. Stun, then one heavy shot.', ease: 'easy' },
    trapper: { line: 'Ranged control. Traps, slows and poison.', ease: 'medium' },
  },
  priest: {
    healer: { line: 'Healer for 2v2 and 3v3. Shields and steady heals.', ease: 'medium' },
    shadow: { line: 'Ranged caster. Curses and silence.', ease: 'medium' },
  },
  paladin: {
    holy: { line: 'Healer for 2v2 and 3v3. Quick heals and a stun.', ease: 'easy' },
    ret: { line: 'Melee burst. Stun, then strike.', ease: 'easy' },
  },
  warlock: {
    curses: { line: 'Ranged caster. Damage over time and drain.', ease: 'medium' },
    grave: { line: 'Summoner. The dead fight for you.', ease: 'medium' },
  },
  druid: {
    heal: { line: 'Healer for 2v2 and 3v3. Healing over time and roots.', ease: 'medium' },
    star: { line: 'Ranged caster. Burn, then starlight.', ease: 'medium' },
  },
  gloamknight: {
    reaver: { line: 'Melee drain. Pull them in and reap.', ease: 'medium' },
    shadow: { line: 'Stealth melee. Build Nicks, spend them on one cut.', ease: 'hard' },
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
