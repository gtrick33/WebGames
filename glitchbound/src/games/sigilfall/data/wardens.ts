import type { ClassId, ItemDef } from './types';

/**
 * Seven Sigil-wardens broke the Starlight Crown into seven Crown Sigils (STORY_BIBLE.md). A hero who sees the whole
 * story through becomes the warden of the sigil closest to their calling: a title, a warden's armor and a Sigil
 * Drake, one set for each class, and only the campaign gives them. A Riftstone shortens the climb; it can't make a
 * warden.
 *
 * The songs count seven. There was an eighth warden who carried no sigil: the knight who held the Gloam Gate at dusk
 * while the seven rode away to hide theirs. A Gloamknight who sees the story through takes up that watch: the same
 * armor and drake as any warden, and still only seven sigils.
 */

/** The last quest of the story. */
export const CAMPAIGN_END = 'epilogue-the-camp-goes-home';

export interface WardenDef {
  cls: ClassId;
  /** The Crown Sigil the warden carried (the Gloam's warden carried none). */
  sigil: string | null;
  title: string;
  /** Armor: head and chest looks for the Wardrobe. */
  head: Pick<ItemDef, 'name' | 'icon' | 'tint' | 'mat'>;
  chest: Pick<ItemDef, 'name' | 'icon' | 'tint' | 'mat'>;
  lore: string;
  /** The drake's scales, its wings and its saddle. */
  drake: { name: string; coat: string; wings: string; tack: string; glow: string; lore: string };
}

export const WARDENS: Record<ClassId, WardenDef> = {
  warrior: {
    cls: 'warrior',
    sigil: 'Stone',
    title: 'Sigil-warden of Stone',
    head: { name: 'Warden’s Greathelm', icon: 'helm', tint: '#3a3f4a', mat: 'plate' },
    chest: { name: 'Warden’s Bloodplate', icon: 'plate', tint: '#7a1f26', mat: 'plate' },
    lore: 'Made for the warden who carried the Sigil of Stone.',
    drake: { name: 'Ironhide Drake', coat: '#4a4f5a', wings: '#7a1f26', tack: '#20242c', glow: '#ff6a4a', lore: 'Its scales are as hard as stone, and blades glance off them.' },
  },
  mage: {
    cls: 'mage',
    sigil: 'Frost',
    title: 'Sigil-warden of Frost',
    head: { name: 'Warden’s Rimecrown', icon: 'hood', tint: '#2a3a7a', mat: 'cloth' },
    chest: { name: 'Warden’s Winter Robe', icon: 'robe', tint: '#31418a', mat: 'cloth' },
    lore: 'Made for the warden who carried the Sigil of Frost. The hem is always cold.',
    drake: { name: 'Rimewing Drake', coat: '#2f4f9f', wings: '#9fd4ff', tack: '#141a3a', glow: '#d8f0ff', lore: 'It hatched in a Rimeheld snowstorm, and it loves the cold.' },
  },
  ranger: {
    cls: 'ranger',
    sigil: 'Tides',
    title: 'Sigil-warden of Tides',
    head: { name: 'Warden’s Tidehood', icon: 'hood', tint: '#1f4a5a', mat: 'leather' },
    chest: { name: 'Warden’s Saltcoat', icon: 'jerkin', tint: '#27596a', mat: 'leather' },
    lore: 'Made for the warden who carried the Sigil of Tides. It always smells of lake water.',
    drake: { name: 'Tideborn Drake', coat: '#2a6a7a', wings: '#7ad8c8', tack: '#16303a', glow: '#b8fff0', lore: 'It swims better than it flies.' },
  },
  priest: {
    cls: 'priest',
    sigil: 'Sun',
    title: 'Sigil-warden of the Sun',
    head: { name: 'Warden’s Sunhalo', icon: 'crown', tint: '#f4e2a8', mat: 'gold' },
    chest: { name: 'Warden’s Dawn Vestment', icon: 'robe', tint: '#f2ead2', mat: 'cloth' },
    lore: 'Made for the warden who carried the Sigil of the Sun. Dust never sticks to it.',
    drake: { name: 'Dawnscale Drake', coat: '#efe2c0', wings: '#ffc76a', tack: '#8a6a2a', glow: '#fff2c0', lore: 'It wakes before the sun every morning.' },
  },
  paladin: {
    cls: 'paladin',
    sigil: 'Embers',
    title: 'Sigil-warden of Embers',
    head: { name: 'Warden’s Oathhelm', icon: 'helm', tint: '#d8a838', mat: 'gold' },
    chest: { name: 'Warden’s Emberplate', icon: 'plate', tint: '#e0b040', mat: 'gold' },
    lore: 'Made for the warden who carried the Sigil of Embers. Every dent in it was taken keeping an oath.',
    drake: { name: 'Emberbound Drake', coat: '#b8552e', wings: '#ffd080', tack: '#5a1f26', glow: '#ffe28a', lore: 'It carries one rider for its whole life.' },
  },
  warlock: {
    cls: 'warlock',
    sigil: 'Veil',
    title: 'Sigil-warden of the Veil',
    head: { name: 'Warden’s Veiled Cowl', icon: 'hood', tint: '#1f1a2a', mat: 'cloth' },
    chest: { name: 'Warden’s Pact Robe', icon: 'robe', tint: '#2a1f3a', mat: 'cloth' },
    lore: 'Made for the warden who carried the Sigil of the Veil. Its stitches spell out an old binding.',
    drake: { name: 'Veilmaw Drake', coat: '#3a2a4a', wings: '#6a2a9a', tack: '#0e0a14', glow: '#8bff6a', lore: 'It breathes out cold ash.' },
  },
  druid: {
    cls: 'druid',
    sigil: 'Thorns',
    title: 'Sigil-warden of Thorns',
    head: { name: 'Warden’s Antler Crown', icon: 'crown', tint: '#8a6a3a', mat: 'leather' },
    chest: { name: 'Warden’s Living Bark', icon: 'robe', tint: '#5a4a24', mat: 'leather' },
    lore: 'Made for the warden who carried the Sigil of Thorns, from the bark of a living tree.',
    drake: { name: 'Thornback Drake', coat: '#5a5a28', wings: '#6aa84a', tack: '#2a1f12', glow: '#c8ff9a', lore: 'Birds nest on its spines, and it lets them.' },
  },
  gloamknight: {
    cls: 'gloamknight',
    sigil: null,
    title: 'Warden of the Gloam',
    head: { name: 'Warden’s Duskhelm', icon: 'helm', tint: '#2e2a3a', mat: 'plate' },
    chest: { name: 'Warden’s Gloamplate', icon: 'plate', tint: '#3a3448', mat: 'plate' },
    lore: 'Made for Ser Edric, the knight who held the Gloam Gate alone while the seven wardens rode away.',
    drake: { name: 'Duskmantle Drake', coat: '#2c2a36', wings: '#7a52b0', tack: '#3a1a26', glow: '#c8a8ff', lore: 'It flies only at dawn and at dusk.' },
  },
};

export const wardenLookId = (cls: ClassId, slot: 'head' | 'chest'): string => `warden-${cls}-${slot}`;

/** The armor as hand-made items: they exist for their looks and are never dropped or sold. */
export const WARDEN_ITEMS: ItemDef[] = Object.values(WARDENS).flatMap((w) =>
  (['head', 'chest'] as const).map((slot) => ({
    id: wardenLookId(w.cls, slot),
    slot,
    rarity: 'legendary' as const,
    cls: w.cls,
    stats: [{ stat: 'armor' as const, base: 1, per: 0 }],
    mods: [],
    lore: w.lore,
    minLevel: 60,
    special: true,
    ...w[slot],
  })),
);

/**
 * What the stones remember. A Riftstone is a splinter of grieflight: the Ash Crown turns memory into soldiers, and
 * it keeps what it has fed on. Each stone opens a dungeon as the Crown remembers it, which is why a hero can walk
 * in long before they could reach the place on foot. Fragments of the story come at these levels.
 */
export const ECHOES: { at: number; title: string; text: string }[] = [
  { at: 1, title: 'The first stone', text: 'This stone glows the same violet as everything the Ash Crown has touched. The Crown remembers every place it has fed on. Hold the stone, and you walk into one of those memories.' },
  { at: 2, title: 'Seven wardens', text: 'Three hundred years ago, seven Sigil-wardens broke the Starlight Crown into seven sigils and rode away to hide them. An eighth, Ser Edric, stayed behind at the Gloam Gate so the others could get away.' },
  { at: 3, title: 'A cold room', text: 'In this memory, Vaelor sits at his children’s bedside in the plague winter. He asks the physician how long they have. He already knows the answer.' },
  { at: 5, title: 'The first coin', text: 'You watch Lord Chancellor Maelis Crane take his first coin of ash-gold from the Pale Herald. It weighs nothing, and it is always cold. In return, Crane hands over the wardens’ old map of where the sigils are hidden.' },
  { at: 7, title: 'What the sigils took', text: 'A girl learns her letters at a herbwife’s table and laughs at her own handwriting. This is one of Elyra’s memories. A sigil took it from her, and she does not have it anymore.' },
  { at: 10, title: 'The deeper stones', text: 'The memories past the tenth stone are the Crown’s oldest and strongest. They will not open for you until you have faced the Hallow King yourself and finished the story.' },
  { at: 15, title: 'Two small chairs', text: 'A nursery in Vaelmoor, with two small chairs. Every evening in this memory, Queen Ysane straightens them and waits for her children. Then she looks straight at you and asks if it is over yet.' },
  { at: 20, title: 'The warden who stayed', text: 'At the bottom of the Crown’s memory is Ser Edric, the eighth warden, still holding the Gloam Gate at dusk. The Crown has kept his memory for three hundred years. He lowers his sword and asks you how the war ended.' },
];

/** How high the stones go until a hero's account of the story is their own: past this, the campaign must be done. */
export const RIFT_CAP_UNFINISHED = 10;

/** How many of the dungeons (by level) a hero's stone can reach: three at first, one more every other level. */
export const riftPoolSize = (keystone: number): number => 3 + Math.floor(keystone / 2);
