import { GALLOWS_KEEP } from './dungeons/gallows';
import { SMUGGLERS_GROTTO } from './dungeons/grotto';
import type { Marker, RegionDef, RegionId } from './types';
import { EMBERWICK } from './zones/emberwick';
import { ZONES } from './zones';

/*
 * The world: hand-laid tile maps (16 px tiles). Letters are terrain unless the region lists them as a
 * marker (an NPC, a chest, an enemy pack...), which stands on the region's floor. Lowercase letters
 * listed in `encounters` are room floors: walking onto one starts that room's fight and seals its doors.
 *
 * Terrain:  # wall   . floor   , flowers/ferns   = path   : cobblestone   ~ water   b bridge
 *           T tree   t bush   r rock   f fence   h/H house (H = its corner)   j pillar   Q brazier
 *           Z cracked wall (breaks when hit)   D door (closes during a room's fight)   % overgrown
 *           hedge you can walk through   k brambles (hurt)
 */

const WHISPERWOOD_MAP = [
  '######################################################################################',
  '######################################################################################',
  '######################################################################################',
  '############..#############################...t#######################################',
  '###########t...##########################...C..#######################################',
  '##########.S...t#################.#####..,.......bb...##.tt......##########XX#########',
  '#########........t.############....###....,......bb...T==========.t......#...t########',
  '########....,.......#########.......#......===4..bb======================,..,...######',
  '########...,,.R.....%%%#......,.....#..=======...bb======......==============..e.#####',
  '########............%%%........3.,..========.....bb.......t...t......,.======....#####',
  '########...........%%%%......,..,=======......,,.bb.,..t.#######..................####',
  '########...........###.r......========...........bb..###################t..==,...#####',
  '#########tt.t##...####...,...======...,..........~~.#####################..==...######',
  '######################.....=====......##t...##############################.==..#######',
  '######################...=====........#########################.##########.==.t#######',
  '######################..=====........########################....#########.==..#######',
  '#######################====.........#########################.....########.==.########',
  '######################===..........#######################..T.....########.DD.########',
  '################..t.#===.2.###....#######....############..p......#####gggggggggg#####',
  '###############.....====.t##############.....~~..tt#####......6.,.###gggggggggggggg###',
  '######...######.....===..###############t...~~......t...=====....p##gggggggggggggggg##',
  '###...W...#####....===.,.###############....~~..,..=====5===p===..#gggggggggggggggggg#',
  '###t..,....####....==.............ttt.t.....bb.===========..======DDgggggggggggggggg##',
  '###..P....,..t.=============================bb=======.....,.======DDgggggggggrgggggg##',
  '###=========================================bb===,,...,..t..#######ggggggggggggggggg##',
  '##.==============..,...............,,..,,...bb.....,...t###########ggggrgggggggggggg##',
  '##t..................1.....,...t..........r.bb.......,t############gggggggggGgggggg###',
  '##..,..............,==...t..############....~~=....t..#############ggggggggggggggggg##',
  '##...........#......===.################.....~~=..##################ggggggggggggrggg##',
  '##........#####......===.##############..#...~~==.#################ggggggggggggggggg##',
  '###################...===.###########.....##..~~==t#########======DDgggggggggggggggg##',
  '######################.===.#########.......###~~==..........t=====DDggggggggggggggg###',
  '#######################t===T.#.....T.,..,.t####~~================.##gggggggggggggg####',
  '########################.====..,......~~~..#####~==============...####gggggggggggg####',
  '#########################.=====..,...~~~~~.######~...........W....######gggggggg######',
  '##########################..=====.....~~~..t#####~......t.........####################',
  '###########################...======........####.bb...#########t.#####################',
  '###########################....,==7======..,....,bb....t...###########################',
  '###########################t,.....==============,bb.........t#########################',
  '###########################..kk.~~~~~..==========bb==========..#######################',
  '###########################....~~~~~~~..,.....===bb============.######################',
  '############################..C.~~~~~....kk..t..,bb....9....====.#.t..################',
  '##################################tkk..8..#####..bb..........====.......##############',
  '###################################.....,.######.~~.,.....###.====.......#############',
  '####################################.....#######~~....tt#####..,==.......#############',
  '#####################################..#########~~t.##########....C...T.##############',
  '##############################################################t.......################',
  '################################################################.....#################',
  '###################################################################t##################',
  '######################################################################################',
];

const CRYPT_MAP = [
  '########################################################',
  '################eeeeeeeeeeeeeeeeeeeeeeee################',
  '###############eeeeeeeeeeeeeeeeeeeeeeeeee###############',
  '##############eeeeeeeeeeeeeeeeeeeeeeeeeeee##############',
  '#############eeeeeejeeeeeeeeeeeeeeeejeeeeee#############',
  '############eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee############',
  '############eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee############',
  '############eeeeeeeeeeeeeeeMeeeeeeeeeeeeeeee############',
  '############eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee############',
  '############eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee############',
  '############eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee############',
  '############eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee############',
  '###########eeeeeeeejeeeeeeeeeeeeeeeejeeeeee#############',
  '###########DDDeeeeeeeeeeeeeeeeeeeeeeeeeeee##############',
  '###########...#eeeeeeeeeeeeeeeeeeeeeeeeee###############',
  '###########...##eeeeeeeeeeeeeeeeeeeeeeee################',
  '###########...##########################################',
  '###########DDD##########################################',
  '######dddddddddddddd#################cccccccccccc#######',
  '#####dddddddddddddddd###############cccccccccccccc######',
  '####dddddddddddddddddd#############cccccccccccccccc#####',
  '####ddddjddddddddddddd############ccccjccccccccjcccc####',
  '####ddddddddddddddddddD..........Dcccccccccccccccccc####',
  '####ddddddddddddddddddD..........DccccccccOccccccccc####',
  '####ddddddddddddddddddD..........Dcccccccccccccccccc####',
  '####dddddddddddddddddd############cccccccccccccccccc####',
  '####dddddddddddddjdddd############ccccjccccccccjcccc####',
  '####dddddddddddddddddd#############cccccccccccccccc#####',
  '#####Cddddddddddddddd###############cccccccccccccc######',
  '######dddddddddddddd#################cccccccccccc#######',
  '#########################################DDD############',
  '#########################################...############',
  '#########################################...############',
  '#########################################DDD############',
  '######aaaaaaaaaaaaaa################bbbbbbbbbbbbbb######',
  '#####aaaaaaaaaaaaaaaa##############bbbbbbbbbbbbbbbb#####',
  '####aaaaaaaaaaaaaaaaaa############bbbbbbbbbbbbbbbbbb####',
  '####aaaajaaaaaaaajaaaa############bbbbjbbbbbbbbjbbbb####',
  '####aaaaaaaaaaaaaaaaaaD..........Dbbbbbbbbbbbbbbbbbb####',
  '####aaaaaaaaaaaaaaaaaaD..........Dbbbbbbbbbbbbbbbbbb####',
  '####aaaaaaaaaaaaaaaaaaD..........Dbbbbbbbbbbbbbbbbbb####',
  '####aaaaaaaaaaaaaaaaaa############bbbbbbbbbbbbbbbbbb####',
  '####aaaajaaaaaaaajaaaa############bbbbjbbbbbbbbjbbbb####',
  '####aaaaaaaaaaaaaaaaaa############bbbbbbbbbbbbbbbbbb####',
  '#####aaaaaaaaaaaaaaaa##############bbbbbbbbbbbbbbbC#####',
  '######aaaaaaaaaaaaaa################bbbbbbbbbbbbbb######',
  '###########DDD##########################################',
  '###########...##########################################',
  '###########...##########################################',
  '##........#...#####..................###################',
  '##........#...#####..C.Q........Q....###################',
  '##..S.....#..........................###################',
  '##........Z..........................###################',
  '##........#..........................###################',
  '##........#########..................###################',
  '##........#########........P.........###################',
  '##........#########.Q..............Q.###################',
  '###################..................###################',
  '###########################XX###########################',
  '########################################################',
  '########################################################',
];

const forestMarkers: Record<string, Marker> = {
  P: { kind: 'start' },
  W: { kind: 'waystone' },
  '1': { kind: 'pack', enemies: ['moss-slime', 'moss-slime', 'moss-slime'] },
  '2': { kind: 'pack', enemies: ['goblin-slinger', 'goblin-slinger', 'moss-slime'] },
  '3': { kind: 'pack', enemies: ['goblin-slinger', 'bark-beetle', 'goblin-slinger'] },
  '4': { kind: 'pack', enemies: ['bark-beetle', 'moss-slime', 'moss-slime'], elite: true },
  '5': { kind: 'pack', enemies: ['tusk-boar', 'tusk-boar'] },
  '6': { kind: 'pack', enemies: ['thorn-sprite', 'thorn-sprite', 'goblin-slinger'] },
  '7': { kind: 'pack', enemies: ['thorn-sprite', 'moss-slime', 'moss-slime', 'moss-slime'] },
  '8': { kind: 'pack', enemies: ['thorn-sprite', 'tusk-boar'], elite: true },
  '9': { kind: 'pack', enemies: ['tusk-boar', 'bark-beetle', 'tusk-boar'] },
  e: { kind: 'pack', enemies: ['goblin-slinger', 'goblin-slinger', 'goblin-slinger'], elite: true },
  C: { kind: 'chest', id: 'ww-chest', tier: 'common' },
  S: { kind: 'chest', id: 'ww-grove', tier: 'epic', once: true },
  R: { kind: 'shrine', id: 'hidden-grove' },
  X: { kind: 'exit', to: 'crypt', label: 'The Hollow Crypt' },
  p: { kind: 'hazard', hazard: 'spore' },
  G: { kind: 'boss', boss: 'grimtusk' },
};

const cryptMarkers: Record<string, Marker> = {
  P: { kind: 'start' },
  X: { kind: 'exit', to: 'whisperwood', label: 'Back to the Whisperwood' },
  C: { kind: 'chest', id: 'hc-chest', tier: 'rare' },
  S: { kind: 'chest', id: 'hc-vault', tier: 'epic', once: true },
  O: { kind: 'boss', boss: 'ossric' },
  M: { kind: 'boss', boss: 'morgrave' },
};

/** The hand-laid regions: the town, the first wood, and the dungeons. */
const HAND_LAID: Record<string, RegionDef> = {
  emberwick: EMBERWICK,
  whisperwood: {
    id: 'whisperwood',
    name: 'Whisperwood',
    subtitle: 'An old forest, restless since the Rift opened',
    theme: 'forest',
    kind: 'wild',
    level: 3,
    levels: [2, 6],
    at: [44, 42],
    dark: false,
    safe: false,
    music: 'forest',
    map: WHISPERWOOD_MAP,
    markers: forestMarkers,
    encounters: [{ id: 'den', floor: 'g', waves: [], boss: 'grimtusk', title: 'Grimtusk’s Den' }],
    blurb: 'Slimes, goblins, boars and worse. Somewhere in the east, the alpha that leads them.',
  },
  crypt: {
    id: 'crypt',
    name: 'The Hollow Crypt',
    subtitle: 'Where the Rift first opened',
    theme: 'crypt',
    kind: 'dungeon',
    level: 7,
    levels: [7, 9],
    at: [50, 34],
    dark: true,
    safe: false,
    music: 'crypt',
    map: CRYPT_MAP,
    markers: cryptMarkers,
    encounters: [
      {
        id: 'hall',
        floor: 'a',
        title: 'The Bone Hall',
        waves: [{ enemies: ['skeleton', 'skeleton', 'skeleton'] }, { enemies: ['skeleton', 'skeleton', 'skeleton-archer', 'skeleton-archer'] }],
      },
      {
        id: 'ossuary',
        floor: 'b',
        title: 'The Ossuary',
        waves: [{ enemies: ['bone-hound', 'bone-hound', 'skeleton-archer', 'skeleton-archer'] }, { enemies: ['crypt-guardian', 'skeleton', 'skeleton'] }, { enemies: ['crypt-guardian'], elite: true }],
      },
      { id: 'gate', floor: 'c', waves: [], boss: 'ossric', checkpoint: true, title: 'The Hollow Gate' },
      {
        id: 'chapel',
        floor: 'd',
        title: 'The Rift Chapel',
        checkpoint: true,
        waves: [{ enemies: ['rift-acolyte', 'rift-acolyte', 'skeleton', 'skeleton'] }, { enemies: ['rift-acolyte', 'bone-hound', 'bone-hound', 'skeleton-archer'] }, { enemies: ['rift-acolyte', 'skeleton', 'skeleton'], elite: true }],
      },
      { id: 'sanctum', floor: 'e', waves: [], boss: 'morgrave', checkpoint: true, title: 'The Sanctum' },
    ],
    blurb: 'Rooms that seal behind you, the Warden at the gate, and Morgrave at the heart of the Rift.',
  },
  'gallows-keep': GALLOWS_KEEP,
  'smugglers-grotto': SMUGGLERS_GROTTO,
};

/** Every region: the hand-laid ones and the generated zones. */
export const REGIONS = { ...HAND_LAID, ...Object.fromEntries(ZONES.map((z) => [z.region.id, z.region])) } as Record<RegionId, RegionDef>;

/** Every region, in the order the world map lists them. */
export const REGION_IDS = Object.keys(REGIONS) as RegionId[];

/** Difficulty tiers: enemy level bonus, health and damage on top, loot and experience bonus. */
export const TIERS = [
  { name: 'Normal', levels: 0, hp: 1, dmg: 1, loot: 1, xp: 1, color: '#d8dce6' },
  { name: 'Heroic', levels: 6, hp: 1.9, dmg: 1.4, loot: 1.5, xp: 1.3, color: '#4fb0ff' },
  { name: 'Mythic', levels: 12, hp: 4, dmg: 2.1, loot: 2.2, xp: 1.6, color: '#ff6ad5' },
] as const;

/** Optional modifiers for Heroic and Mythic runs: harder enemies, more rewards. */
export const RIFT_MODS = {
  fortified: { name: 'Fortified', text: 'Enemies have 40% more health.', bonus: 0.25 },
  hasted: { name: 'Hasted', text: 'Enemies move and attack 20% faster.', bonus: 0.25 },
  volatile: { name: 'Volatile', text: 'Enemies explode a moment after they die.', bonus: 0.2 },
} as const;
export type RiftMod = keyof typeof RIFT_MODS;
