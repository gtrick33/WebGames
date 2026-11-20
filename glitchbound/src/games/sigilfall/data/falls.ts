import { deathSound } from './voices';

/** How each kind goes down, by the same names as the sound it makes falling (data/voices.ts deathSound). */
export type Fall = 'bone' | 'ghost' | 'slime' | 'bug' | 'heavy' | 'beast' | 'person';
const FALLS: Readonly<Record<string, Fall>> = { dieBone: 'bone', dieGhost: 'ghost', dieSlime: 'slime', dieBug: 'bug', dieOgre: 'heavy', dieBeast: 'beast', die: 'person' };

/**
 * How a creature dies to the eye (POLISH_PLAN.md piece 6): bones fly apart, a shade rises and thins away, a slime
 * bursts, a shell cracks, a great one lands in a cloud of dust, a beast or a person falls. Only a look, as the sound is.
 */
export function fallOf(def: { id: string; sprite: string }): Fall {
  return FALLS[deathSound(def)] ?? 'person';
}
