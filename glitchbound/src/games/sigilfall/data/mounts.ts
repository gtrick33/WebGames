import type { ClassId, PerkId, RegionId } from './types';
import { WARDENS } from './wardens';

/**
 * Mounts (blueprint §6.4–6.6, COLLECTION_SYSTEM_DESIGN.md §3): ground mounts the hero summons outside fights.
 * Every mount moves at the same speed (no "best mount"); they differ in how they look and where they come
 * from. Each is a painted quadruped (render/art/mount.ts) built from one body with its own proportions,
 * coat, tack and extras, drawn in layers around the rider so the hero's gear and Wardrobe looks show.
 */

export type MountBody = 'horse' | 'deer' | 'boar' | 'drake';

/** Where a mount comes from. Every source is deterministic: no mount is a random drop. */
export type MountSource =
  | { kind: 'quest'; quest: string }
  | { kind: 'perk'; perk: PerkId }
  /** Clear every one of these dungeons on this difficulty tier (or higher). */
  | { kind: 'clears'; regions: RegionId[]; tier: number }
  /** Finish the whole story as this class. */
  | { kind: 'campaign'; cls: ClassId }
  /** This many points on the site's Trophy Shelf. */
  | { kind: 'shelf'; points: number };

export interface MountDef {
  id: string;
  name: string;
  /** One line of lore for the collection page. */
  lore: string;
  /** Where it comes from, as the collection page says it (never spoils a story beat). */
  from: string;
  source: MountSource;
  body: MountBody;
  coat: string;
  /** Mane, tail and hooves. */
  mane: string;
  /** Saddle and bridle. */
  tack: string;
  /** Barding over the body (warhorses), or none. */
  barding?: string;
  /** Antlers (deer), tusks (boar), a blaze down the face, socks on the legs. */
  antlers?: 'hart' | 'elk';
  tusks?: boolean;
  blaze?: boolean;
  socks?: boolean;
  /** A prestige mount's touch: embers off the mane, stars round the hooves (kept small). */
  glow?: { kind: 'embers' | 'stars'; color: string };
  /** The collection's grouping: an everyday mount, a story mount or a challenge's prize. */
  tier: 'travel' | 'story' | 'prestige';
}

export const MOUNTS: MountDef[] = [
  {
    id: 'briarhollow-chestnut',
    name: 'Briarhollow Chestnut',
    lore: 'A plough horse from Dunmore’s farms, steady as a fence post. She has carried grain, children and one very surprised priest.',
    from: 'Act I: when Dunmore’s riders join the camp',
    source: { kind: 'quest', quest: 'camp-riders' },
    body: 'horse',
    coat: '#8a4a26',
    mane: '#3a2216',
    tack: '#6a4428',
    blaze: true,
    tier: 'travel',
  },
  {
    id: 'gullport-strider',
    name: 'Gullport Strider',
    lore: 'A grey cob that grew up on the quay and is afraid of nothing except gulls.',
    from: 'Gullport: the harbor’s gift after Captain Saltbeard',
    source: { kind: 'perk', perk: 'mount' },
    body: 'horse',
    coat: '#9a9aa4',
    mane: '#e8e6e0',
    tack: '#2a4a6a',
    socks: true,
    tier: 'travel',
  },
  {
    id: 'royal-warhorse',
    name: 'Royal Warhorse',
    lore: 'Bred in the Ember Keep’s stables for the Regent’s champions, and barded in the colors of Aster.',
    from: 'Act II: the champion of the Starfall Festival',
    source: { kind: 'quest', quest: 'festival-the-champion' },
    body: 'horse',
    coat: '#2a2026',
    mane: '#141016',
    tack: '#c8ccd8',
    barding: '#8a1a2a',
    tier: 'story',
  },
  {
    id: 'mirefen-boar',
    name: 'Mirefen Boar',
    lore: 'The Low Wick folk ride them through mud no horse would cross. This one bites, but only people it dislikes.',
    from: 'Act II: Low Wick, once the plague is burned out',
    source: { kind: 'quest', quest: 'low-wick-fires' },
    body: 'boar',
    coat: '#5a4636',
    mane: '#2a2018',
    tack: '#4a5a2a',
    tusks: true,
    tier: 'story',
  },
  {
    id: 'glimmer-hart',
    name: 'Glimmer Hart',
    lore: 'The forest clans do not tame their harts. They ask, and sometimes a hart says yes.',
    from: 'Act III: the forest clans’ answer',
    source: { kind: 'quest', quest: 'the-clans-decide' },
    body: 'deer',
    coat: '#b07a46',
    mane: '#f0e0c0',
    tack: '#3a6a3a',
    antlers: 'hart',
    tier: 'story',
  },
  {
    id: 'frost-elk',
    name: 'Rimeheld Elk',
    lore: 'A jarl’s elk, broad as a door, with frost in its beard from the first snow to the last.',
    from: 'Act III: the jarls of Rimeheld',
    source: { kind: 'quest', quest: 'the-vault-of-rime' },
    body: 'deer',
    coat: '#c8c0b0',
    mane: '#7a6a5a',
    tack: '#2a4a7a',
    antlers: 'elk',
    tier: 'story',
  },
  {
    id: 'deepforge-war-boar',
    name: 'Deepforge War-Boar',
    lore: 'Kragholt’s dwarves ride boars into the deep roads, in iron as thick as a door. This one has been to the bottom and back.',
    from: 'Act II: the dwarves of the Deepforge, once their forge is theirs again',
    source: { kind: 'quest', quest: 'forgemaster-grold' },
    body: 'boar',
    coat: '#4a3a30',
    mane: '#1e1814',
    tack: '#8a2a1a',
    barding: '#6e7280',
    tusks: true,
    tier: 'story',
  },
  {
    id: 'sunhouse-courser',
    name: 'Sun-House Courser',
    lore: 'The desert houses breed their coursers for heat and pride. The gold on the barding is real. So is the sand in it.',
    from: 'Act III: the sun houses, once their oath is answered',
    source: { kind: 'quest', quest: 'the-sun-king' },
    body: 'horse',
    coat: '#8a5a2e',
    mane: '#f2ead8',
    tack: '#a82a3a',
    barding: '#e8c060',
    socks: true,
    tier: 'story',
  },
  {
    id: 'lastlight-hart',
    name: 'Lastlight Hart',
    lore: 'It came to the fire at Lastlight the night Elyra was carried out of the Gloam Gate, and would not leave her side until she slept.',
    from: 'Act IV: the night under the Gloam Gate',
    source: { kind: 'quest', quest: 'the-gloam-gate' },
    body: 'deer',
    coat: '#e8e4dc',
    mane: '#a8b0c8',
    tack: '#2a3a6a',
    antlers: 'hart',
    glow: { kind: 'stars', color: '#fff2c8' },
    tier: 'story',
  },
  {
    id: 'ashen-nightmare',
    name: 'Ashen Nightmare',
    lore: 'A charger of the Barrow’s honor guard that would not lie down when its rider did. Its mane still smolders.',
    from: 'Challenge: clear the Barrow of Kings on Heroic',
    source: { kind: 'clears', regions: ['barrow-of-kings'], tier: 1 },
    body: 'horse',
    coat: '#24202a',
    mane: '#3a3440',
    tack: '#4a3a5a',
    barding: '#5a5262',
    glow: { kind: 'embers', color: '#ff9a4a' },
    tier: 'prestige',
  },
  {
    id: 'crownfall-destrier',
    name: 'Crownfall Destrier',
    lore: 'The Hallow King’s own warhorse, which waited in Duskspire’s stable for three hundred years for someone worth carrying. Ash on its barding, starlight in its mane.',
    from: 'Challenge: clear Duskspire and the Crown’s memory on Heroic, after the story’s end',
    source: { kind: 'clears', regions: ['duskspire', 'vaelmoor-remembered'], tier: 1 },
    body: 'horse',
    coat: '#1a1822',
    mane: '#e8dca8',
    tack: '#8a6a2a',
    barding: '#6a6478',
    blaze: true,
    glow: { kind: 'stars', color: '#ffe8a8' },
    tier: 'prestige',
  },
  {
    id: 'starlit-charger',
    name: 'Starlit Charger',
    lore: 'They say the first king of Aster rode it out of the night sky. They say a lot of things about the first king.',
    from: 'Challenge: clear every dungeon of Acts II and III on Mythic',
    source: { kind: 'clears', regions: ['rotmother-cistern', 'deepforge-halls', 'barrow-of-kings', 'tomb-of-the-sun-king', 'rimeheld-vault', 'siege-of-highwall'], tier: 2 },
    body: 'horse',
    coat: '#2b3a6e',
    mane: '#8ad0ff',
    tack: '#c8d4f0',
    glow: { kind: 'stars', color: '#cfe0ff' },
    tier: 'prestige',
  },
  {
    id: 'cabinet-courser',
    name: 'Cabinet Courser',
    lore: 'Nobody knows who left it tied up behind the arcade. It only answers to people who have played everything.',
    from: 'The site’s Trophy Shelf: 100 points',
    source: { kind: 'shelf', points: 100 },
    body: 'horse',
    coat: '#3a1d7a',
    mane: '#f6c453',
    tack: '#1c1130',
    blaze: true,
    tier: 'prestige',
  },
  ...Object.values(WARDENS).map(
    (w): MountDef => ({
      id: `drake-${w.cls}`,
      name: w.drake.name,
      lore: w.drake.lore,
      from: `Finish the story as a ${w.cls}`,
      source: { kind: 'campaign', cls: w.cls },
      body: 'drake',
      coat: w.drake.coat,
      mane: w.drake.wings,
      tack: w.drake.tack,
      glow: { kind: 'embers', color: w.drake.glow },
      tier: 'prestige',
    }),
  ),
];

export const MOUNT_DEFS: Record<string, MountDef> = Object.fromEntries(MOUNTS.map((m) => [m.id, m]));
