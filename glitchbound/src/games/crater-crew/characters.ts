/**
 * The eight critters a crew can be. Each has its own shape (render/critters.ts draws them) and a
 * crew color for its scarf, name tag and health bar, all far apart so every crew is told apart at a
 * glance. Pure data.
 */

export const CHAR_IDS = ['frog', 'fox', 'penguin', 'robot', 'slime', 'owl', 'bunny', 'duck'] as const;
export type CharId = (typeof CHAR_IDS)[number];
export const isCharId = (v: unknown): v is CharId => typeof v === 'string' && (CHAR_IDS as readonly string[]).includes(v);

export interface CharDef {
  id: CharId;
  name: string;
  /** The crew color: scarf, name tag, health bar. */
  color: string;
  /** A darker shade of it, for outlines and text on light tags. */
  dark: string;
}

export const CHARS: Record<CharId, CharDef> = {
  frog: { id: 'frog', name: 'Frog', color: '#3fcf5a', dark: '#1d7a31' },
  fox: { id: 'fox', name: 'Fox', color: '#ff8a1f', dark: '#a84d00' },
  penguin: { id: 'penguin', name: 'Penguin', color: '#3b82f6', dark: '#1e4aa8' },
  robot: { id: 'robot', name: 'Robot', color: '#16d6c4', dark: '#0a7a70' },
  slime: { id: 'slime', name: 'Slime', color: '#a855f7', dark: '#6b21a8' },
  owl: { id: 'owl', name: 'Owl', color: '#ef4444', dark: '#991b1b' },
  bunny: { id: 'bunny', name: 'Bunny', color: '#ff6fb5', dark: '#b0336f' },
  duck: { id: 'duck', name: 'Duck', color: '#facc15', dark: '#8a6a00' },
};

/** A character nobody in `taken` has yet (the first free one after `from`). */
export function freeChar(taken: readonly CharId[], from: CharId = 'frog'): CharId {
  const start = CHAR_IDS.indexOf(from);
  for (let i = 0; i < CHAR_IDS.length; i++) {
    const c = CHAR_IDS[(start + i) % CHAR_IDS.length]!;
    if (!taken.includes(c)) return c;
  }
  return from;
}
