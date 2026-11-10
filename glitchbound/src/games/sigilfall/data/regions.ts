import { DUNGEONS } from './dungeons';
import { isRetired } from './retired';
import { shapeDungeon } from './dungeongen';
import { GALLOWS_KEEP } from './dungeons/gallows';
import { SMUGGLERS_GROTTO } from './dungeons/grotto';
import type { Marker, RegionDef, RegionId, PlacedMarkerDef } from './types';
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
  '####aaaaaaaaaaaaaaaaaaD..........DbbbbbbbbbNbbbbbbbb####',
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
  '1': { kind: 'pack', enemies: ['moss-slime', 'moss-slime', 'moss-slime', 'moss-slime'] },
  '2': { kind: 'pack', enemies: ['goblin-slinger', 'goblin-slinger', 'moss-slime'] },
  '3': { kind: 'pack', enemies: ['goblin-slinger', 'bark-beetle', 'goblin-slinger'] },
  '4': { kind: 'pack', enemies: ['bark-beetle', 'moss-slime', 'moss-slime'], elite: true },
  '5': { kind: 'pack', enemies: ['tusk-boar', 'tusk-boar', 'tusk-boar'] },
  '6': { kind: 'pack', enemies: ['thorn-sprite', 'thorn-sprite', 'goblin-slinger'] },
  '7': { kind: 'pack', enemies: ['thorn-sprite', 'moss-slime', 'moss-slime', 'moss-slime'] },
  '8': { kind: 'pack', enemies: ['thorn-sprite', 'tusk-boar'], elite: true },
  '9': { kind: 'pack', enemies: ['tusk-boar', 'bark-beetle', 'tusk-boar'] },
  e: { kind: 'pack', enemies: ['goblin-slinger', 'goblin-slinger', 'goblin-slinger'], elite: true },
  C: { kind: 'chest', id: 'ww-chest', tier: 'common' },
  S: { kind: 'chest', id: 'ww-grove', tier: 'epic', once: true },
  R: { kind: 'shrine', id: 'hidden-grove' },
  X: { kind: 'exit', to: 'briarhollow', label: 'South road: back to Briarhollow' },
  p: { kind: 'hazard', hazard: 'spore' },
  G: { kind: 'boss', boss: 'grimtusk' },
};

const cryptMarkers: Record<string, Marker> = {
  P: { kind: 'start' },
  X: { kind: 'exit', to: 'briarhollow', label: 'Up the stair into Briarhollow’s chapel' },
  C: { kind: 'chest', id: 'hc-chest', tier: 'rare' },
  S: { kind: 'chest', id: 'hc-vault', tier: 'epic', once: true },
  O: { kind: 'boss', boss: 'ossric' },
  M: { kind: 'boss', boss: 'morgrave' },
  N: { kind: 'boss', boss: 'coffin-matron' },
};

/**
 * A hand-laid map drawn larger (`s` times on each side): every tile becomes a block, each marker stays
 * once, on its block's first tile, on the ground around it (a den's floor, a road).
 */
function spreadMap(rows: string[], markers: Set<string>, s: number): string[] {
  const H = Math.round(rows.length * s);
  const W = Math.round(rows[0]!.length * s);
  const out: string[][] = [];
  for (let y = 0; y < H; y++) {
    const oy = Math.min(rows.length - 1, Math.floor(y / s));
    const line: string[] = [];
    for (let x = 0; x < W; x++) {
      const ox = Math.min(rows[0]!.length - 1, Math.floor(x / s));
      const ch = rows[oy]![ox]!;
      if (!markers.has(ch)) {
        line.push(ch);
        continue;
      }
      // the marker on its block's first tile; the rest of the block is the ground beside it
      const mid = Math.ceil(ox * s - 1e-9) === x && Math.ceil(oy * s - 1e-9) === y;
      const ground = [rows[oy]![ox - 1], rows[oy]![ox + 1], rows[oy - 1]?.[ox], rows[oy + 1]?.[ox]].find((c) => c && !markers.has(c) && c !== '#') ?? '.';
      line.push(mid ? ch : ground);
    }
    out.push(line);
  }
  return out.map((l) => l.join(''));
}

/**
 * More of the wood's packs on open ground the map left empty (it was drawn small): one every so often, well
 * away from the others, from the packs of its own `band` of the wood.
 */
function morePacks(map: string[], markers: Record<string, Marker>, bands: { from: number; to: number; packs: string[] }[], gap: number, seed: number): PlacedMarkerDef[] {
  const taken: [number, number][] = [];
  // where the hero arrives, travels from and leaves stays quiet: no pack within reach of it
  const calm: [number, number][] = [];
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y]!.length; x++) {
      const m = markers[map[y]![x]!];
      if (!m) continue;
      taken.push([x, y]);
      if (m.kind === 'start' || m.kind === 'waystone' || m.kind === 'exit') calm.push([x, y]);
    }
  }
  const out: PlacedMarkerDef[] = [];
  let r = seed;
  const rand = (): number => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let tries = 0; tries < 4000; tries++) {
    const x = 2 + Math.floor(rand() * (map[0]!.length - 4));
    const y = 2 + Math.floor(rand() * (map.length - 4));
    const open = (dx: number, dy: number): boolean => '.,'.includes(map[y + dy]?.[x + dx] ?? '#');
    if (!open(0, 0) || !open(1, 0) || !open(-1, 0) || !open(0, 1) || !open(0, -1)) continue;
    if (taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < gap)) continue;
    if (calm.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 20)) continue;
    const band = bands.find((b) => x / map[0]!.length >= b.from && x / map[0]!.length < b.to) ?? bands[0]!;
    const pack = markers[band.packs[Math.floor(rand() * band.packs.length)]!]!;
    out.push({ tx: x, ty: y, marker: pack });
    taken.push([x, y]);
  }
  return out;
}

/** The first wood, drawn small and laid out larger, with more of its creatures in the new room. */
const WHISPERWOOD_SPREAD = 1.4;
const WHISPERWOOD_BIG = spreadMap(WHISPERWOOD_MAP, new Set(Object.keys(forestMarkers)), WHISPERWOOD_SPREAD);
const WHISPERWOOD_MORE = morePacks(
  WHISPERWOOD_BIG,
  forestMarkers,
  [
    { from: 0, to: 0.4, packs: ['1', '2', '3', '5'] },
    { from: 0.4, to: 1, packs: ['5', '6', '7', '9'] },
  ],
  10,
  7717,
);

/** The hand-laid regions: the town, the first wood, and the dungeons. */
/** A great thing on a hand-laid map: on the clear ground nearest a place, standing on the tiles its model covers. */
function landmarkOn(map: readonly string[], placed: readonly PlacedMarkerDef[], prop: string, fx: number, fy: number, foot: number): PlacedMarkerDef[] {
  const h = map.length;
  const w = map[0]!.length;
  const cx = Math.round(fx * w);
  const cy = Math.round(fy * h);
  const clear = (x: number, y: number): boolean => {
    for (let dy = -foot - 1; dy <= foot + 1; dy++) {
      for (let dx = -foot - 1; dx <= foot + 1; dx++) {
        const c = map[y + dy]?.[x + dx];
        if ((c !== '.' && c !== ',') || placed.some((p) => p.tx === x + dx && p.ty === y + dy)) return false;
      }
    }
    return true;
  };
  for (let r = 0; r < 30; r++) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || !clear(x, y)) continue;
        const out: PlacedMarkerDef[] = [{ tx: x, ty: y, marker: { kind: 'prop', prop, solid: true } }];
        for (let dy = -foot; dy <= foot; dy++) for (let dx = -foot; dx <= foot; dx++) if (dx || dy) out.push({ tx: x + dx, ty: y + dy, marker: { kind: 'prop', prop: 'block', solid: false } });
        return out;
      }
    }
  }
  return [];
}

const HAND_LAID: Record<string, RegionDef> = {
  emberwick: EMBERWICK,
  whisperwood: {
    id: 'whisperwood',
    name: 'Whisperwood',
    subtitle: 'The old wood north of Briarhollow',
    theme: 'forest',
    kind: 'wild',
    level: 3,
    levels: [2, 6],
    at: [54, 61],
    dark: false,
    safe: false,
    music: 'whisperwood',
    map: WHISPERWOOD_BIG,
    markers: forestMarkers,
    placed: [...WHISPERWOOD_MORE, ...landmarkOn(WHISPERWOOD_BIG, WHISPERWOOD_MORE, 'ancient-oak', 0.42, 0.4, 1), ...landmarkOn(WHISPERWOOD_BIG, WHISPERWOOD_MORE, 'stone-arch', 0.72, 0.68, 1)],
    encounters: [{ id: 'den', floor: 'g', waves: [], boss: 'grimtusk', title: 'Grimtusk’s Den' }],
    blurb: 'Mosslings, poachers, wolves and worse, maddened by grieflight. Somewhere in the east, the alpha that leads them.',
  },
  crypt: {
    id: 'crypt',
    name: 'The Chapel Crypt',
    subtitle: 'Under Briarhollow’s chapel, older than the village',
    theme: 'crypt',
    kind: 'dungeon',
    // the Prologue's night ends here: a hero comes down the stair at about level 4
    level: 4,
    levels: [4, 6],
    at: [61, 53],
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
      // the Matron of the Ossuary and her shell game of coffins (sim/patterns/crypt.ts)
      { id: 'ossuary', floor: 'b', waves: [], boss: 'coffin-matron', checkpoint: true, title: 'The Ossuary' },
      { id: 'gate', floor: 'c', waves: [], boss: 'ossric', checkpoint: true, title: 'The Crypt Gate' },
      {
        id: 'chapel',
        floor: 'd',
        title: 'The Tear Chapel',
        checkpoint: true,
        waves: [{ enemies: ['rift-acolyte', 'rift-acolyte', 'skeleton', 'skeleton'] }, { enemies: ['rift-acolyte', 'bone-hound', 'bone-hound', 'skeleton-archer'] }, { enemies: ['rift-acolyte', 'skeleton', 'skeleton'], elite: true }],
      },
      { id: 'sanctum', floor: 'e', waves: [], boss: 'morgrave', checkpoint: true, title: 'The Sanctum' },
    ],
    blurb: 'Rooms that seal behind you, the old warden at the gate, and Morgrave at the reliquary.',
  },
  'gallows-keep': GALLOWS_KEEP,
  'smugglers-grotto': SMUGGLERS_GROTTO,
};

/** Every region: the hand-laid ones and the generated zones. */
export const REGIONS = {
  ...HAND_LAID,
  ...Object.fromEntries(ZONES.map((z) => [z.region.id, z.region])),
  ...Object.fromEntries(DUNGEONS.map((d) => [d.region.id, d.region])),
} as Record<RegionId, RegionDef>;

/** Every region of the world map, in the order it lists them (interiors are inside their towns, not on it). */
for (const r of Object.values(REGIONS) as RegionDef[]) if (r.kind === 'dungeon') shapeDungeon(r);

export const REGION_IDS = (Object.keys(REGIONS) as RegionId[]).filter((id) => !REGIONS[id].interior && !isRetired(id));

/** Difficulty tiers: enemy level bonus, health and damage on top, loot and experience bonus. */
export const TIERS = [
  { name: 'Normal', levels: 0, hp: 1, dmg: 1, loot: 1, xp: 1, color: '#d8dce6' },
  { name: 'Heroic', levels: 6, hp: 1.9, dmg: 1.4, loot: 1.5, xp: 1.3, color: '#4fb0ff' },
  { name: 'Mythic', levels: 12, hp: 4, dmg: 2.1, loot: 2.2, xp: 1.6, color: '#ff6ad5' },
] as const;

/** Optional modifiers for Heroic and Mythic runs: harder enemies, more rewards. */
export const RIFT_MODS = {
  fortified: { name: 'Hardened', text: 'Enemies have 40% more health.', bonus: 0.25 },
  hasted: { name: 'Hasted', text: 'Enemies move and attack 20% faster.', bonus: 0.25 },
  volatile: { name: 'Volatile', text: 'Enemies explode a moment after they die.', bonus: 0.2 },
} as const;
export type RiftMod = keyof typeof RIFT_MODS;
