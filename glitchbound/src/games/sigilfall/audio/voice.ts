import type { Body } from '../progress/character';

/**
 * Voices (POLISH_PLAN.md piece 26): the hero's efforts as a blow goes in, their cry when one lands on them, their breath
 * as they dodge, their fall, their shout at a boss brought down; and the companions' shouts as they call out in a fight.
 * Free recordings (CC0): a man's (RPG Male Adventurer, wolfwoot) and three women's (RPG Voice Starter Pack, Cici Fyre),
 * built by scripts/sigilfall-sounds.mjs. Spoken lines wait for recordings of their own (the owner, 2026-11-19: "voice
 * system and CC0 grunts"); `LINES` is where a recorded line would be named, by the words it says.
 */
export type VoiceKind = 'attack' | 'big' | 'hurt' | 'death' | 'jump' | 'victory';

/** A voice: the man's, each of the women's, and the man's pitched lower for the companions. */
type VoiceId = 'm' | 'mLow' | 'f1' | 'f2' | 'f3' | 'f3High';

/** The sound each voice makes for each kind (audio/samples.ts); a woman's voice has no fall or victory of its own. */
const SAYS: Readonly<Record<VoiceId, Partial<Record<VoiceKind, string>>>> = {
  m: { attack: 'voMAttack', big: 'voMBig', hurt: 'voMHurt', death: 'voMDeath', jump: 'voMJump', victory: 'voMVictory' },
  mLow: { attack: 'voMShout' },
  f1: { attack: 'voF1Attack', big: 'voF1Big', hurt: 'voF1Hurt', death: 'voF1Death', jump: 'voF1Jump' },
  f2: { attack: 'voF2Attack' },
  f3: { attack: 'voF3Attack' },
  f3High: { attack: 'voF3Shout' },
};

/** The companions who call out in a fight, and their voices (the rest of the story's people are read, not heard). */
const COMPANIONS: Readonly<Record<string, VoiceId>> = {
  mara: 'f2',
  'mara-venn': 'f2',
  'captain-mara': 'f2',
  'mara-at-the-muster': 'f2',
  'mara-at-the-reach': 'f2',
  elyra: 'f3',
  nyx: 'f3High',
  'nyx-at-the-lock': 'f3High',
  cael: 'mLow',
  orren: 'mLow',
  'orren-praying': 'mLow',
};

/** The sound for someone making a sound of this kind, or null (nobody's voice, or none for it). */
export function voiceSound(who: string, kind: VoiceKind, body: Body): string | null {
  const voice: VoiceId | undefined = who === 'hero' ? (body === 'f' ? 'f1' : 'm') : COMPANIONS[who];
  return voice ? (SAYS[voice][kind] ?? null) : null;
}

/** Spoken lines with a recording of their own, by the words they say (none yet: each waits for its recording). */
export const LINES: Readonly<Record<string, string>> = {};
