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
    lore: 'Forged for the warden who carried the Stone Sigil under the mountain, and came back alone.',
    drake: { name: 'Ironhide Drake', coat: '#4a4f5a', wings: '#7a1f26', tack: '#20242c', glow: '#ff6a4a', lore: 'Its scales turn blades. Its temper turns everything else.' },
  },
  mage: {
    cls: 'mage',
    sigil: 'Frost',
    title: 'Sigil-warden of Frost',
    head: { name: 'Warden’s Rimecrown', icon: 'hood', tint: '#2a3a7a', mat: 'cloth' },
    chest: { name: 'Warden’s Winter Robe', icon: 'robe', tint: '#31418a', mat: 'cloth' },
    lore: 'Woven in the Rimeheld’s first winter. The hem has never once thawed.',
    drake: { name: 'Rimewing Drake', coat: '#2f4f9f', wings: '#9fd4ff', tack: '#141a3a', glow: '#d8f0ff', lore: 'It hatched in a snowstorm and has been looking for a colder one ever since.' },
  },
  ranger: {
    cls: 'ranger',
    sigil: 'Tides',
    title: 'Sigil-warden of Tides',
    head: { name: 'Warden’s Tidehood', icon: 'hood', tint: '#1f4a5a', mat: 'leather' },
    chest: { name: 'Warden’s Saltcoat', icon: 'jerkin', tint: '#27596a', mat: 'leather' },
    lore: 'It still smells of the sea, however far inland you carry it.',
    drake: { name: 'Tideborn Drake', coat: '#2a6a7a', wings: '#7ad8c8', tack: '#16303a', glow: '#b8fff0', lore: 'It swims better than it flies, and is deeply annoyed that nobody asks.' },
  },
  priest: {
    cls: 'priest',
    sigil: 'Sun',
    title: 'Sigil-warden of the Sun',
    head: { name: 'Warden’s Sunhalo', icon: 'crown', tint: '#f4e2a8', mat: 'gold' },
    chest: { name: 'Warden’s Dawn Vestment', icon: 'robe', tint: '#f2ead2', mat: 'cloth' },
    lore: 'It has never been washed, and has never needed to be.',
    drake: { name: 'Dawnscale Drake', coat: '#efe2c0', wings: '#ffc76a', tack: '#8a6a2a', glow: '#fff2c0', lore: 'It wakes before the sun, and takes the credit.' },
  },
  paladin: {
    cls: 'paladin',
    sigil: 'Embers',
    title: 'Sigil-warden of Embers',
    head: { name: 'Warden’s Oathhelm', icon: 'helm', tint: '#d8a838', mat: 'gold' },
    chest: { name: 'Warden’s Emberplate', icon: 'plate', tint: '#e0b040', mat: 'gold' },
    lore: 'Every dent was sworn to. Nobody has ever hammered one out.',
    drake: { name: 'Emberbound Drake', coat: '#b8552e', wings: '#ffd080', tack: '#5a1f26', glow: '#ffe28a', lore: 'It swore to carry one rider. It has never said what happens after.' },
  },
  warlock: {
    cls: 'warlock',
    sigil: 'Veil',
    title: 'Sigil-warden of the Veil',
    head: { name: 'Warden’s Veiled Cowl', icon: 'hood', tint: '#1f1a2a', mat: 'cloth' },
    chest: { name: 'Warden’s Pact Robe', icon: 'robe', tint: '#2a1f3a', mat: 'cloth' },
    lore: 'The stitching is a contract. Don’t read it too closely.',
    drake: { name: 'Veilmaw Drake', coat: '#3a2a4a', wings: '#6a2a9a', tack: '#0e0a14', glow: '#8bff6a', lore: 'It breathes out cold ash, and something in the ash breathes back.' },
  },
  druid: {
    cls: 'druid',
    sigil: 'Thorns',
    title: 'Sigil-warden of Thorns',
    head: { name: 'Warden’s Antler Crown', icon: 'crown', tint: '#8a6a3a', mat: 'leather' },
    chest: { name: 'Warden’s Living Bark', icon: 'robe', tint: '#5a4a24', mat: 'leather' },
    lore: 'It was a tree first. It would like you to remember that.',
    drake: { name: 'Thornback Drake', coat: '#5a5a28', wings: '#6aa84a', tack: '#2a1f12', glow: '#c8ff9a', lore: 'Birds nest on its spines. It pretends not to have noticed.' },
  },
  gloamknight: {
    cls: 'gloamknight',
    sigil: null,
    title: 'Warden of the Gloam',
    head: { name: 'Warden’s Duskhelm', icon: 'helm', tint: '#2e2a3a', mat: 'plate' },
    chest: { name: 'Warden’s Gloamplate', icon: 'plate', tint: '#3a3448', mat: 'plate' },
    lore: 'Made for the knight who held the Gloam Gate while the seven rode away. Nobody wrote a song about it. The plate remembers anyway.',
    drake: { name: 'Duskmantle Drake', coat: '#2c2a36', wings: '#7a52b0', tack: '#3a1a26', glow: '#c8a8ff', lore: 'It flies only at the edges of the day, and lands before anyone can say which edge.' },
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
  { at: 1, title: 'The first stone', text: 'It is warm, and it hums like a held note, and it glows the same violet as everything the Ash Crown has touched. Close your hand on it and you are somewhere the Crown remembers, at the hour it went wrong. The Crown keeps everything it has fed on. It keeps it badly.' },
  { at: 2, title: 'Seven pairs of hands', text: 'Seven Sigil-wardens broke the Starlight Crown so that nobody could ever do what Vaelor did. The songs give them seven different ends. The stones remember something the songs left out: they drew lots for who would have to forget.' },
  { at: 3, title: 'A cold room', text: 'In this memory Vaelor is not a king. He is a father at a bedside in a cold room in the first week of winter. He is asking a physician how long, and he already knows the answer, and he asks again.' },
  { at: 5, title: 'The first coin', text: 'You watch Maelis Crane take his first coin of ash-gold. It weighs nothing, and it is always cold. He closes his hand around it anyway and stands there a long while, as if it might warm up.' },
  { at: 7, title: 'What the sigils took', text: 'A girl learns her letters at a herbwife’s table, laughing at her own bad handwriting. This never happened to anyone you know, because the person it happened to can no longer remember it. The Crown can. It keeps everything the sigils take, and it is saving it for something.' },
  { at: 10, title: 'Something counting', text: 'Past the tenth stone the memories stop being only memories. Something in here is counting the heroes who come through. It stops when it reaches you, and then it starts again. To go deeper you will have to have stood before the Ash Crown yourself: the stones won’t open further for someone who only knows the story from inside them.' },
  { at: 15, title: 'Two small chairs', text: 'A nursery in Vaelmoor, and two small chairs. Queen Ysane sets them straight every evening, in every memory the stones hold, and every evening she looks up, straight at you, and asks whether it is over yet.' },
  { at: 20, title: 'The warden who stayed', text: 'At last you find the seventh warden, the one who lost the draw. They never left. They have been sitting here at the bottom of the Crown’s memory for three hundred years, keeping it from forgetting the one thing that would end it. They look up, and they know you. “You took your time,” they say. “Sit. It’s your turn to tell me how it ends.”' },
];

/** How high the stones go until a hero's account of the story is their own: past this, the campaign must be done. */
export const RIFT_CAP_UNFINISHED = 10;

/** How many of the dungeons (by level) a hero's stone can reach: three at first, one more every other level. */
export const riftPoolSize = (keystone: number): number => 3 + Math.floor(keystone / 2);
