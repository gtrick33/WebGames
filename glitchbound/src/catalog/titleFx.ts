/**
 * The looks a Sigilfall title can wear: a small moving light over its letters, like an enchantment on a blade. Every
 * title the game gives has one picked by how hard it is to earn (progress/titles.ts), the hardest wearing the finest;
 * a title an admin gives (Admin › Sigilfall) wears the one the admin chose. Shared by the game and the admin page, so
 * both draw a title the same way (components/TitleFx.tsx and its stylesheet).
 */

export const TITLE_FX_IDS = ['plain', 'gleam', 'verdant', 'tide', 'gilded', 'blood', 'frost', 'ember', 'arcane', 'storm', 'void', 'radiant', 'starfall', 'ashfire'] as const;

export type TitleFxId = (typeof TITLE_FX_IDS)[number];

export interface TitleFxDef {
  id: TitleFxId;
  /** What the admin page calls it. */
  name: string;
  /** What it looks like, in a few words. */
  blurb: string;
  /** How fine it is, 0 (none) to 6 (the finest there is). */
  tier: number;
}

export const TITLE_FX: readonly TitleFxDef[] = [
  { id: 'plain', name: 'Plain', blurb: 'No light, just the words.', tier: 0 },
  { id: 'gleam', name: 'Gleam', blurb: 'A soft white sheen that passes over now and then.', tier: 1 },
  { id: 'verdant', name: 'Verdant', blurb: 'A living green glow that breathes.', tier: 1 },
  { id: 'tide', name: 'Tide', blurb: 'Sea-blue light rolling through like a wave.', tier: 2 },
  { id: 'gilded', name: 'Gilded', blurb: 'Polished gold with a bright glint.', tier: 2 },
  { id: 'blood', name: 'Blood', blurb: 'Dark red that beats like a heart and runs down.', tier: 2 },
  { id: 'frost', name: 'Frost', blurb: 'Ice-white letters with cold sparkles.', tier: 3 },
  { id: 'ember', name: 'Ember', blurb: 'Flickering flame from below.', tier: 3 },
  { id: 'arcane', name: 'Arcane', blurb: 'Violet runelight shifting through its colors.', tier: 4 },
  { id: 'storm', name: 'Storm', blurb: 'Crackling lightning blue that flashes.', tier: 4 },
  { id: 'void', name: 'Void', blurb: 'Letters of night with a purple rim, pulling light in.', tier: 5 },
  { id: 'radiant', name: 'Radiant', blurb: 'Holy gold-white light shining out.', tier: 5 },
  { id: 'starfall', name: 'Starfall', blurb: 'A night sky drifting through, with stars that twinkle.', tier: 5 },
  { id: 'ashfire', name: 'Ashfire', blurb: 'Molten gold and fire flowing through, embers rising: the finest.', tier: 6 },
];

const BY_ID = new Map<string, TitleFxDef>(TITLE_FX.map((f) => [f.id, f]));

export const isTitleFx = (v: unknown): v is TitleFxId => typeof v === 'string' && BY_ID.has(v);

/** An effect by its id (an unknown one is plain). */
export const titleFx = (id: string | null | undefined): TitleFxDef => BY_ID.get(id ?? '') ?? TITLE_FX[0]!;

/** The longest a title an admin gives can be. */
export const TITLE_MAX = 40;

/** A title as typed by an admin, tidied (control characters out, spaces folded), or '' if nothing usable is left. */
export function cleanTitle(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return (
    [...raw]
      // (control characters, and the invisible ones that turn text around or hide in it)
      .filter((ch) => {
        const c = ch.codePointAt(0)!;
        return c >= 0x20 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202e) && !(c >= 0x2066 && c <= 0x2069);
      })
      .join('')
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_MAX)
    .trim();
}

/**
 * Whether a title reads before the name ("Blooded Ash", "Stablemaster Ash") or after it ("Ash the Kingslayer",
 * "Ash, Champion of the Starfall"): after when it starts small ("the", "of") or names something it is "of".
 */
export const titleGoesAfter = (title: string): boolean => /^(the|of) /i.test(title) || / of /i.test(title);
