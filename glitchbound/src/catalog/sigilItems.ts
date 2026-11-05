/**
 * Sigilfall items in the shop: mounts and Wardrobe looks. A shop item carries a `sigil` spec that says how the game
 * draws it: a mount's body, colors, built-on extras and glow, or one of the shop's armor sets in its own colors or an
 * admin's. Sigilfall builds them from the live shop list (src/games/sigilfall/progress/shopGoods.ts), so Admin › Ads &
 * shop can make a new one without a code change. They change only how a hero looks: every mount runs at the pace every
 * other mount does, and a look never touches a stat.
 *
 * Only the drake, hart and boar bodies can be sold (the horse pack's license doesn't clearly allow selling changed
 * horses: src/games/sigilfall/LEGAL_REVIEW.md), and the armor is KayKit's (CC0) and shapes built in code.
 */

export type SigilBody = 'drake' | 'deer' | 'boar';
export type SigilGlow = 'embers' | 'stars' | 'sparks' | 'motes' | 'flames';
export type SigilSet = 'crownforged' | 'celestine' | 'gloamquill';
export type SigilSlot = 'head' | 'chest';

export interface SigilMountSpec {
  kind: 'mount';
  body: SigilBody;
  coat: string;
  /** Mane, tail and hooves; a drake's wings. */
  mane: string;
  /** Saddle and blanket. */
  tack: string;
  /** Armor plates, horns and runes' settings, where the extras put some. */
  plate: string;
  /** Pieces built onto the body (MOUNT_EXTRAS for its body). */
  extras: string[];
  /** What's in the air round it, and the color of everything on it that glows. */
  glow?: { kind: SigilGlow; color: string };
}

export interface SigilLookSpec {
  kind: 'look';
  slot: SigilSlot;
  set: SigilSet;
  /** Four colors (#rrggbb) in place of the set's own: its main color, its trim, its cloth and what glows. */
  colors?: string[];
}

export type SigilSpec = SigilMountSpec | SigilLookSpec;

export const SIGIL_BODIES: readonly { id: SigilBody; label: string }[] = [
  { id: 'drake', label: 'Drake, with wings' },
  { id: 'deer', label: 'Hart' },
  { id: 'boar', label: 'War-boar' },
];

/** What can be built onto each body. Extras in one group exclude each other (a hart has one pair of antlers). */
export const MOUNT_EXTRAS: Record<SigilBody, readonly { id: string; label: string; group?: string }[]> = {
  drake: [
    { id: 'plates', label: 'Armor plates down the neck, back and tail' },
    { id: 'crown', label: 'A crown of horns' },
    { id: 'veins', label: 'Glowing veins in the wings' },
    { id: 'crystals', label: 'Crystal spines' },
    { id: 'runes', label: 'Glowing runes' },
    { id: 'flametail', label: 'A burning tail' },
  ],
  deer: [
    { id: 'elk', label: 'Broad elk antlers', group: 'antlers' },
    { id: 'flame-antlers', label: 'Antlers of flame', group: 'antlers' },
    { id: 'crystal-antlers', label: 'Antlers of crystal', group: 'antlers' },
    { id: 'plates', label: 'Plated barding' },
    { id: 'runes', label: 'Glowing runes' },
  ],
  boar: [
    { id: 'plates', label: 'Spiked back plates' },
    { id: 'helm', label: 'A horned brow helm' },
    { id: 'rune-tusks', label: 'Tusks banded with glowing runes' },
    { id: 'runes', label: 'Glowing runes' },
  ],
};

export const SIGIL_GLOWS: readonly { id: SigilGlow; label: string }[] = [
  { id: 'embers', label: 'Embers rising off it' },
  { id: 'stars', label: 'Stars round its hooves' },
  { id: 'sparks', label: 'Crackling sparks' },
  { id: 'motes', label: 'Drifting motes of light' },
  { id: 'flames', label: 'Flames at its feet' },
];

/** The shop's armor sets, each a helmet and a chest, in their own colors (main, trim, cloth, glow). */
export const SIGIL_SETS: readonly { id: SigilSet; label: string; colors: string[] }[] = [
  { id: 'crownforged', label: 'Crownforged: black plate and gold, a crown of horns, a burning visor', colors: ['#2e2b36', '#f2b740', '#8e1a2c', '#ff8a2a'] },
  { id: 'celestine', label: 'Celestine: white and silver, a ring of stars, a cape of night', colors: ['#eef2fb', '#c8d4ec', '#22306a', '#bfe2ff'] },
  { id: 'gloamquill', label: 'Gloamquill: black feathers, a beaked mask, glowing eyes', colors: ['#2a2336', '#8a5cc8', '#33293f', '#62f0d8'] },
];

export const sigilSetOf = (id: string): (typeof SIGIL_SETS)[number] | undefined => SIGIL_SETS.find((s) => s.id === id);

const HEX = /^#[0-9a-f]{6}$/;
const hexOf = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return HEX.test(s) ? s : null;
};
const objOf = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v ? (v as Record<string, unknown>) : {});

/** A Sigilfall item as an admin sent it, or null when it isn't one the game can draw (a horse is never one). */
export function sanitizeSigil(v: unknown): SigilSpec | null {
  const o = objOf(v);
  if (o.kind === 'mount') {
    const body = SIGIL_BODIES.find((b) => b.id === o.body)?.id;
    const coat = hexOf(o.coat);
    const mane = hexOf(o.mane);
    const tack = hexOf(o.tack);
    if (!body || !coat || !mane || !tack) return null;
    const extras: string[] = [];
    const groups = new Set<string>();
    for (const raw of Array.isArray(o.extras) ? o.extras.slice(0, 12) : []) {
      const x = MOUNT_EXTRAS[body].find((e) => e.id === raw);
      if (!x || extras.includes(x.id) || (x.group && groups.has(x.group))) continue;
      if (x.group) groups.add(x.group);
      extras.push(x.id);
    }
    const g = objOf(o.glow);
    const glowKind = SIGIL_GLOWS.find((k) => k.id === g.kind)?.id;
    const glowColor = hexOf(g.color);
    return { kind: 'mount', body, coat, mane, tack, plate: hexOf(o.plate) ?? '#6e7280', extras, ...(glowKind && glowColor ? { glow: { kind: glowKind, color: glowColor } } : {}) };
  }
  if (o.kind === 'look') {
    const slot = o.slot === 'head' || o.slot === 'chest' ? o.slot : null;
    const set = sigilSetOf(typeof o.set === 'string' ? o.set : '');
    if (!slot || !set) return null;
    const colors = Array.isArray(o.colors) ? o.colors.slice(0, 4).map(hexOf) : [];
    return { kind: 'look', slot, set: set.id, ...(colors.length === 4 && colors.every(Boolean) ? { colors: colors as string[] } : {}) };
  }
  return null;
}

/** The colors a look is drawn in: an admin's, or its set's own. */
export const sigilColors = (spec: SigilLookSpec): string[] => spec.colors ?? sigilSetOf(spec.set)?.colors ?? SIGIL_SETS[0]!.colors;
