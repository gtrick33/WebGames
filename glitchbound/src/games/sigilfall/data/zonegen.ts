import { clamp, hash2, noise2, rng } from '../core/math';
import { buildingRows, villageHouses } from './buildingArt';
import { THEMES } from './themes';
import type { Marker, PlacedMarkerDef, RegionDef, RegionId, StoryCond, Theme } from './types';

/*
 * The wilds are generated, not drawn: a zone is a seeded description (its size, how wooded it is, its
 * water, its towns, its sights and its ways out) that this turns into the same tile map and markers a
 * hand-laid region has. The same spec always makes the same map, so a zone never changes under a
 * player, and a big world costs a few hundred lines of description instead of thousands of map rows.
 *
 * Steps: border and woods from noise, water (lakes, a river or the sea), clearings for towns and
 * sights, roads joining them (a spanning tree of straight runs and right-angle turns, bridged over
 * water), the villages (houses along streets) and sights themselves, copses and rocks, beaches, small
 * scenes in the open ground, packs of enemies in the open (their level rising with distance from the
 * way in), and finally a pass that connects anything cut off.
 */

export type Side = 'n' | 's' | 'e' | 'w';
export type PoiKind = 'camp' | 'den' | 'ruin' | 'farm' | 'nest' | 'wreck' | 'grove' | 'cave';

export interface HubSpec {
  /** Where, as fractions of the map. */
  at: [number, number];
  npcs: string[];
  houses: number;
  /** People who stand here only while a condition holds (someone who leaves with the story). */
  when?: Record<string, StoryCond>;
  /** A wall round the village, open where the roads come in (a place that expects to be attacked): a walled hold. */
  wall?: boolean;
  /** How the village is laid out (`town`); by default one of the open plans, chosen by its place. */
  plan?: VillagePlan;
}

/** A crossroads with its square, a cobbled market street, houses round a green, or a walled hold. */
export type VillagePlan = 'cross' | 'street' | 'green' | 'court';

export interface ExitSpec {
  side: Side;
  /** Where along that side (0-1). */
  at: number;
  to: RegionId;
  label: string;
  minLevel?: number;
  /** A quest that must be done before the road opens (the King's Road to the Crown City). */
  needs?: string;
}

export interface PoiSpec {
  at: [number, number];
  /** Radius of the clearing, in tiles. */
  r: number;
  kind: PoiKind;
  /** Packs in it (each a list of enemy ids). */
  packs: string[][];
  /** Their level (otherwise from where the sight is). */
  level?: number;
  /** The first pack is led by an elite. */
  elite?: boolean;
  /** A named enemy in the middle that comes back slowly when killed. */
  rare?: string;
  /** Discovering it counts for explore objectives. */
  spot?: { id: string; name: string };
  chest?: 'common' | 'rare' | 'epic';
  /** A way down: a dungeon's door. */
  entrance?: { to: RegionId; label: string; minLevel?: number };
  /** A building standing at the sight (a lighthouse on its point, a watchtower), its door toward the middle. */
  landmark?: { style: Extract<Marker, { kind: 'building' }>['style']; w: number; h: number; name?: string };
  /** Its packs (and its named enemy) only while this holds: a blockade's guards, the dead at a shrine. */
  when?: StoryCond;
}

/**
 * What the story puts in a zone (STORY_BIBLE.md §4): people, props, fires, plumes and named places, each
 * near an anchor and shown only while its condition holds. Placed after everything else on free ground,
 * so adding one never moves anything the zone already had.
 */
export interface StoryMark {
  /**
   * 'hub' (the first town) or 'hub:N', a sight's spot id, 'exit:<region>' (a way out, inside the map),
   * 'house:N' (the Nth house of the towns, its roof), 'gate' (a walled town's north gate) or 'shore:<anchor>'
   * (the water's edge nearest it).
   */
  near: string;
  /** Tiles from the anchor. */
  dx?: number;
  dy?: number;
  marker: Marker;
  when?: StoryCond;
}

export interface ZoneSpec {
  w: number;
  h: number;
  seed: number;
  /** Enemy levels at `from` and at the farthest point; packs in between scale along. */
  levels: [number, number];
  from: [number, number];
  /** 0-1: how much of the land is woods. */
  forest: number;
  /** Per 100 open tiles. */
  scatter: { trees: number; bushes: number; rocks: number; flowers: number };
  water?: { kind: 'lakes'; amount: number } | { kind: 'river'; from: Side; to: Side } | { kind: 'sea'; side: Side; depth: number };
  /** Sand along the water; 'dunes' adds drifts inland; 'all' is desert. */
  sand?: 'shore' | 'dunes' | 'all';
  hubs: HubSpec[];
  exits: ExitSpec[];
  pois: PoiSpec[];
  /** Packs in the open: compositions by stretch of the level gradient (0 near `from`, 1 far). */
  wild: { band: [number, number]; packs: string[][] }[];
  /** How many packs in the open. */
  wildCount: number;
  /** The story's dressing. */
  story?: StoryMark[];
}

export interface GeneratedZone {
  map: string[];
  placed: PlacedMarkerDef[];
}

/* Tile letters (see regions.ts). */
const WALL = 35; // '#'
const FLOOR = 46; // '.'
const DECO = 44; // ','
const PATH = 61; // '='
const COBBLE = 58; // ':'
const WATER = 126; // '~'
const BRIDGE = 98; // 'b'
const TREE = 84; // 'T'
const BUSH = 116; // 't'
const ROCK = 114; // 'r'
const FENCE = 102; // 'f'
const RAMPART = 124; // '|'
const HOUSE = 104; // 'h'
const HOUSE_ANCHOR = 72; // 'H'
const PILLAR = 106; // 'j'
const SAND = 115; // 's'

const WALKABLE = new Set([FLOOR, DECO, PATH, COBBLE, BRIDGE, SAND]);
/** A village's reach from its square, in tiles (the half-axes of its clearing). */
/** How far a village reaches from its square, east and west, north and south (tiles). */
const VX = 20;
const VY = 13;
const PLANS: VillagePlan[] = ['cross', 'street', 'green'];
type BuildingStyle = Extract<Marker, { kind: 'building' }>['style'];

/** What stands in each plan's square (plan coordinates: east, south of the waystone's tile). */
const SQUARE_CROSS: [number, number, string][] = [
  [-3, -2, 'well'],
  [-2, -4, 'market-cart'],
  [3, -4, 'market-cart'],
  [-3, -4, 'crate'],
  [4, -4, 'barrel'],
  [-4, -3, 'lamp'],
  [5, -3, 'lamp'],
  [4, -2, 'notice'],
  [3, -3, 'market-goods'],
  [-3, 2, 'wagon'],
  [-4, -1, 'sacks'],
  [5, -1, 'bench'],
  [4, 2, 'hay'],
];
const SQUARE_STREET: [number, number, string][] = [
  [-3, 1, 'fountain'],
  [4, 1, 'well'],
  [-6, 0, 'lamp'],
  [7, 0, 'lamp'],
  [-10, 0, 'bench'],
  [11, 0, 'bench'],
  [2, -1, 'notice'],
];
const SQUARE_GREEN: [number, number, string][] = [
  [-1, -2, 'well'],
  [3, -2, 'notice'],
  [-4, -4, 'statue'],
  [-6, -4, 'flowerbed'],
  [-2, -4, 'flowerbed'],
  [-7, -2, 'bench'],
  [-5, 3, 'market-cart'],
  [-7, 3, 'market-cart'],
  [-3, 4, 'crate'],
  [-6, 5, 'barrel'],
  [-8, 4, 'market-goods'],
  [6, 2, 'bench'],
  [-8, -5, 'lamp'],
  [9, -5, 'lamp'],
  [-8, 5, 'lamp'],
  [9, 5, 'lamp'],
  [7, -1, 'flowerbed'],
];
const SQUARE_COURT: [number, number, string][] = [
  [-3, -2, 'fountain'],
  [4, -2, 'well'],
  [-4, 2, 'market-cart'],
  [3, 2, 'market-cart'],
  [-5, -3, 'lamp'],
  [6, -3, 'lamp'],
  [-5, 0, 'crate'],
  [5, 2, 'barrel'],
  [-2, 2, 'market-goods'],
];

/**
 * Small scenes for the open land between the sights, so the wilds read as land people use rather than an empty
 * field: a woodcutter's clearing, a travellers' camp, a sheep pen, a fenced field, a wayside shrine, graves, a
 * broken-down wagon, standing stones, a pond, a ruined wall, a flower meadow, bones, a war camp, an old well.
 * Each is drawn as rows of tiles: '.' stays open ground; a key is a prop (solid or not) or a ground kind. Their
 * props have names of their own (a 'camp-tent', a 'wagon', a 'menhir'), so they are never taken for the story's.
 */
type SceneCell = number | { prop: string; solid?: boolean };
const P = (prop: string, solid = false): SceneCell => ({ prop, solid });
const SCENES: Record<string, { rows: string[]; key: Record<string, SceneCell> }> = {
  woodcut: { rows: ['s..L.', '.Wc..', 'L..s.', '..s..'], key: { s: P('stump'), L: P('log'), W: P('woodpile', true), c: P('chopping-block', true) } },
  camp: { rows: ['.T...T.', '.......', '.b.F.p.', '...x...'], key: { T: P('camp-tent', true), F: P('campfire', true), b: P('bedroll'), p: P('cauldron', true), x: P('crate', true) } },
  pen: { rows: ['ffffff', 'f.h..f', 'f...hf', 'ft...f', 'ff..ff'], key: { f: FENCE, h: P('hay', true), t: P('trough', true) } },
  field: { rows: ['fffffff', 'f,,,,,f', 'f,,S,,f', 'f,,,,,f', 'fff.fff'], key: { f: FENCE, ',': DECO, S: P('scarecrow', true) } },
  shrine: { rows: ['b.S.b', '.....', 'l.n.l'], key: { S: P('statue', true), b: P('flowerbed', true), l: P('torch', true), n: P('bench', true) } },
  graves: { rows: ['g.c.g', '.....', 'c.g.c', '..l..'], key: { g: P('gravestone', true), c: P('grave-cross', true), l: P('torch', true) } },
  graveyard: { rows: ['fffffff', 'fg.c.gf', 'f.....f', 'fc.g.cf', 'f.....f', 'fff.fff', '.l...l.'], key: { f: FENCE, g: P('gravestone', true), c: P('grave-cross', true), l: P('lamp', true) } },
  wagon: { rows: ['.x..', 'kC.s', '.b..'], key: { C: P('wagon', true), x: P('crate', true), b: P('barrel', true), s: P('sacks'), k: P('debris') } },
  stones: { rows: ['..R..', 'R...R', '.....', 'R...R', '..R..'], key: { R: P('menhir', true) } },
  pond: { rows: ['.~~~.', '~~~~~', '~~~~~', '.~~~.'], key: { '~': WATER } },
  ruin: { rows: ['||.||', 'j...|', '.r.r.'], key: { '|': RAMPART, j: PILLAR, r: P('rubble') } },
  meadow: { rows: ['.,,,.', ',,,,,', ',,,,,', '.,,,.'], key: { ',': DECO } },
  bones: { rows: ['k...s', '..d..', 's.k..'], key: { k: P('skulls'), s: P('bone-heap'), d: P('debris') } },
  warcamp: { rows: ['T...T', '..F..', 'r.R.x'], key: { T: P('camp-tent', true), F: P('campfire', true), r: P('weapon-rack', true), R: P('red-banner', true), x: P('crate', true) } },
  well: { rows: ['.b.', 'xWx'], key: { W: P('well', true), b: P('bucket'), x: P('barrel', true) } },
};
/** Which scenes belong in which kind of land (a woodcutter in the wood, graves on the moor, a war camp at the front). */
const SCENES_FOR: Record<'vale' | 'wood' | 'high' | 'dry' | 'wet' | 'grim' | 'war', string[]> = {
  vale: ['woodcut', 'camp', 'pen', 'field', 'shrine', 'wagon', 'pond', 'meadow', 'well', 'meadow'],
  wood: ['woodcut', 'camp', 'shrine', 'stones', 'pond', 'meadow', 'ruin', 'woodcut'],
  high: ['camp', 'stones', 'ruin', 'wagon', 'woodcut', 'pond'],
  dry: ['camp', 'ruin', 'stones', 'wagon', 'bones', 'ruin'],
  wet: ['camp', 'pond', 'ruin', 'wagon', 'stones', 'graves', 'pond'],
  grim: ['graveyard', 'stones', 'ruin', 'graves', 'camp', 'bones', 'graveyard'],
  war: ['warcamp', 'bones', 'ruin', 'wagon', 'graves', 'warcamp'],
};
const sceneLand = (t: Theme | null): keyof typeof SCENES_FOR => {
  switch (t) {
    case 'forest':
    case 'fey':
    case 'jungle':
      return 'wood';
    case 'mountain':
    case 'storm':
    case 'peaks':
    case 'snow':
    case 'pale':
      return 'high';
    case 'desert':
      return 'dry';
    case 'marsh':
    case 'plague':
    case 'sunken':
    case 'gloam':
    case 'blight':
      return 'wet';
    case 'barrow':
    case 'moor':
    case 'haunted':
    case 'deadlake':
    case 'rift':
      return 'grim';
    case 'warfront':
    case 'bonefield':
    case 'volcanic':
      return 'war';
    default:
      return 'vale';
  }
};
const OPEN = new Set([FLOOR, DECO, SAND]);

/** Two octaves of value noise, 0..1. */
const fbm = (x: number, y: number, seed: number): number => noise2(x, y, seed) * 0.7 + noise2(x * 2.3, y * 2.3, seed + 1) * 0.3;

/**
 * Lands are laid out at this share of their spec's size on each axis (about two thirds of the area they had):
 * the owner found them "vast" and "empty", their sights and villages far apart with open grass between. Every
 * place keeps its share of the map, so the land keeps its shape, only closer together.
 */
export const ZONE_SCALE = 0.8;

export function generateZone(spec: ZoneSpec, theme: Theme | null = null): GeneratedZone {
  return new ZoneBuilder(spec, theme).build();
}

class ZoneBuilder {
  private readonly w: number;
  private readonly h: number;
  private readonly g: Uint8Array;
  /** Reserved tiles (roads, towns, clearings): nothing is scattered on them. */
  private readonly lock: Uint8Array;
  private readonly placed: PlacedMarkerDef[] = [];
  private readonly r: () => number;
  /** Tiles markers stand on (they count as walkable). */
  private readonly marked = new Set<number>();
  private readonly packSpots: [number, number][] = [];
  /** A walled town's north gate (the road's gap in its palisade). */
  private gate: [number, number] | null = null;
  /** Each town house's top-left tile, in the order built (story fires go on their roofs). */
  private readonly houses: [number, number][] = [];
  /** The villages' middles: roads keep a straight run through them, packs and scenes keep out. */
  private readonly hubAt: [number, number][] = [];

  constructor(
    private readonly spec: ZoneSpec,
    private readonly theme: Theme | null,
  ) {
    this.w = Math.round(spec.w * ZONE_SCALE);
    this.h = Math.round(spec.h * ZONE_SCALE);
    this.g = new Uint8Array(this.w * this.h).fill(FLOOR);
    this.lock = new Uint8Array(this.w * this.h);
    this.r = rng(spec.seed);
  }

  build(): GeneratedZone {
    const s = this.spec;
    this.border();
    this.water();
    this.woods();
    const hubs = s.hubs.map((hb) => this.tileOf(hb.at));
    const pois = s.pois.map((p) => this.tileOf(p.at));
    const exits = s.exits.map((e) => this.exitTiles(e));
    // clearings first, so roads and buildings have room
    this.hubAt.push(...hubs);
    hubs.forEach(([x, y], i) => this.clearVillage(x, y, s.hubs[i]!));
    pois.forEach(([x, y], i) => this.clear(x, y, s.pois[i]!.r));
    exits.forEach((e) => this.corridor(e.edge, e.inner));
    // roads reach the towns, the ways out and every sight (trails to the wilder ones)
    this.roads([...hubs, ...exits.map((e) => e.inner), ...pois]);
    s.hubs.forEach((hb, i) => this.town(hubs[i]![0], hubs[i]![1], hb));
    s.pois.forEach((p, i) => this.sight(pois[i]![0], pois[i]![1], p));
    s.exits.forEach((e, i) => this.put(exits[i]!.edge[0], exits[i]!.edge[1], { kind: 'exit', to: e.to, label: e.label, ...(e.minLevel ? { minLevel: e.minLevel } : {}), ...(e.needs ? { needs: e.needs } : {}) }));
    this.scatter();
    this.beaches();
    this.dress(pois);
    this.roadLamps();
    const start = hubs[0] ?? exits[0]!.inner;
    // on the main road through the square (every village plan keeps it open)
    this.put(start[0], start[1] + 1, { kind: 'start' });
    this.wildPacks(hubs, exits.map((e) => e.inner), pois);
    this.connect(start);
    this.story(hubs, pois, exits.map((e) => e.inner));
    const map: string[] = [];
    for (let y = 0; y < this.h; y++) map.push(String.fromCharCode(...this.g.subarray(y * this.w, (y + 1) * this.w)));
    return { map, placed: this.placed };
  }

  /* --------------------------------------------------------------- helpers */

  private idx(x: number, y: number): number {
    return y * this.w + x;
  }

  private inside(x: number, y: number, m = 0): boolean {
    return x >= m && y >= m && x < this.w - m && y < this.h - m;
  }

  private at(x: number, y: number): number {
    return this.inside(x, y) ? this.g[this.idx(x, y)]! : WALL;
  }

  private set(x: number, y: number, c: number): void {
    if (this.inside(x, y, 1)) this.g[this.idx(x, y)] = c;
  }

  private tileOf(at: [number, number]): [number, number] {
    return [Math.round(clamp(at[0], 0.04, 0.96) * (this.w - 1)), Math.round(clamp(at[1], 0.04, 0.96) * (this.h - 1))];
  }

  private put(x: number, y: number, marker: Marker, when?: StoryCond): void {
    this.placed.push({ tx: x, ty: y, marker, ...(when ? { when } : {}) });
    this.marked.add(this.idx(x, y));
  }

  /** Level of a pack at a tile: rising from `from` to the farthest corner. */
  private levelAt(x: number, y: number): number {
    const [fx, fy] = this.tileOf(this.spec.from);
    const far = Math.max(...[0, this.w - 1].flatMap((cx) => [0, this.h - 1].map((cy) => Math.hypot(cx - fx, cy - fy))));
    const t = clamp(Math.hypot(x - fx, y - fy) / (far * 0.85), 0, 1);
    const [lo, hi] = this.spec.levels;
    return Math.round(lo + (hi - lo) * t);
  }

  private gradient(x: number, y: number): number {
    const [lo, hi] = this.spec.levels;
    return hi === lo ? 0 : (this.levelAt(x, y) - lo) / (hi - lo);
  }

  /** Clears a disc to open ground and reserves it. */
  private clear(cx: number, cy: number, r: number): void {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inside(x, y, 2)) continue;
        // a ragged edge, so clearings don't look stamped
        const d = Math.hypot(x - cx, y - cy) + (hash2(x, y, this.spec.seed + 3) - 0.5) * 1.6;
        if (d > r) continue;
        const i = this.idx(x, y);
        if (this.g[i] !== WATER || d < r - 2) this.g[i] = FLOOR;
        this.lock[i] = 1;
      }
    }
  }

  /* ---------------------------------------------------------------- terrain */

  private border(): void {
    const sea = this.spec.water?.kind === 'sea' ? this.spec.water.side : null;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d: Record<Side, number> = { w: x, e: this.w - 1 - x, n: y, s: this.h - 1 - y };
        const thick = 2 + fbm(x / 7, y / 7, this.spec.seed + 11) * 5;
        for (const side of ['n', 's', 'e', 'w'] as Side[]) {
          if (d[side] >= thick) continue;
          // the sea side is open water to the edge instead
          this.g[this.idx(x, y)] = side === sea ? WATER : WALL;
        }
      }
    }
  }

  private water(): void {
    const wt = this.spec.water;
    if (!wt) return;
    const seed = this.spec.seed + 21;
    if (wt.kind === 'sea') {
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const along = wt.side === 'n' || wt.side === 's' ? x : y;
          const depth = wt.side === 'w' ? x : wt.side === 'e' ? this.w - 1 - x : wt.side === 'n' ? y : this.h - 1 - y;
          const size = wt.side === 'n' || wt.side === 's' ? this.h : this.w;
          const coast = size * wt.depth + (fbm(along / 16, 0.5, seed) - 0.5) * 26 + (noise2(along / 5, 3.3, seed + 1) - 0.5) * 5;
          if (depth < coast) this.g[this.idx(x, y)] = WATER;
        }
      }
    } else if (wt.kind === 'lakes') {
      for (let y = 3; y < this.h - 3; y++) {
        for (let x = 3; x < this.w - 3; x++) {
          if (fbm(x / 13, y / 13, seed) > 1 - wt.amount * 0.55) this.g[this.idx(x, y)] = WATER;
        }
      }
    } else {
      const a = this.sidePoint(wt.from, 0.3 + this.r() * 0.4);
      const b = this.sidePoint(wt.to, 0.3 + this.r() * 0.4);
      for (const [x, y] of this.meander(a, b, 0.22)) {
        const width = 1.3 + noise2(x / 9, y / 9, seed) * 1.4;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy) <= width) this.set(x + dx, y + dy, WATER);
      }
    }
  }

  private sidePoint(side: Side, t: number): [number, number] {
    const x = side === 'w' ? 0 : side === 'e' ? this.w - 1 : Math.round(t * (this.w - 1));
    const y = side === 'n' ? 0 : side === 's' ? this.h - 1 : Math.round(t * (this.h - 1));
    return [x, y];
  }

  /** Woods: the densest parts are canopy you can't enter, ringed by single trees. */
  private woods(): void {
    const f = this.spec.forest;
    if (f <= 0) return;
    const seed = this.spec.seed + 31;
    const n = new Float32Array(this.w * this.h);
    const vals: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = fbm(x / 15, y / 15, seed);
        n[this.idx(x, y)] = v;
        if (this.g[this.idx(x, y)] === FLOOR) vals.push(v);
      }
    }
    vals.sort((a, b) => a - b);
    const thr = vals[Math.floor(vals.length * (1 - f))] ?? 1;
    for (let i = 0; i < n.length; i++) {
      if (this.g[i] !== FLOOR) continue;
      const v = n[i]!;
      if (v > thr + 0.035) this.g[i] = WALL;
      else if (v > thr) this.g[i] = hash2(i, 7, seed) < 0.7 ? TREE : BUSH;
    }
  }

  /** A wandering line of tiles from a to b. */
  private meander(a: [number, number], b: [number, number], wiggle: number): [number, number][] {
    let pts: [number, number][] = [a, b];
    for (let depth = 0; depth < 4; depth++) {
      const next: [number, number][] = [pts[0]!];
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1]!;
        const [x1, y1] = pts[i]!;
        const len = Math.hypot(x1 - x0, y1 - y0);
        const off = (this.r() - 0.5) * len * wiggle;
        next.push([(x0 + x1) / 2 + (-(y1 - y0) / (len || 1)) * off, (y0 + y1) / 2 + ((x1 - x0) / (len || 1)) * off], pts[i]!);
      }
      pts = next;
    }
    const out: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!;
      const [x1, y1] = pts[i]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / steps);
        const y = Math.round(y0 + ((y1 - y0) * k) / steps);
        const last = out[out.length - 1];
        if (!last || last[0] !== x || last[1] !== y) out.push([x, y]);
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ roads */

  private exitTiles(e: ExitSpec): { edge: [number, number]; inner: [number, number] } {
    const edge = this.sidePoint(e.side, clamp(e.at, 0.08, 0.92));
    const [dx, dy] = e.side === 'w' ? [1, 0] : e.side === 'e' ? [-1, 0] : e.side === 'n' ? [0, 1] : [0, -1];
    return { edge, inner: [edge[0] + dx * 10, edge[1] + dy * 10] };
  }

  /** A three-wide gap through the border from the edge to the inner point. */
  private corridor(edge: [number, number], inner: [number, number]): void {
    const steps = Math.max(Math.abs(inner[0] - edge[0]), Math.abs(inner[1] - edge[1]));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(edge[0] + ((inner[0] - edge[0]) * k) / steps);
      const y = Math.round(edge[1] + ((inner[1] - edge[1]) * k) / steps);
      for (let d = -2; d <= 2; d++) {
        const tx = edge[0] === inner[0] ? x + d : x;
        const ty = edge[1] === inner[1] ? y + d : y;
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const i = this.idx(tx, ty);
        this.g[i] = Math.abs(d) <= 1 ? PATH : FLOOR;
        this.lock[i] = 1;
      }
    }
  }

  /** Roads join every node: a minimum spanning tree, each edge a two-wide road (`road`). */
  private roads(nodes: [number, number][]): void {
    if (nodes.length < 2) return;
    const inTree = [0];
    const rest = nodes.map((_, i) => i).slice(1);
    while (rest.length) {
      let best = [-1, -1, Infinity];
      for (const a of inTree) {
        for (const b of rest) {
          const d = Math.hypot(nodes[a]![0] - nodes[b]![0], nodes[a]![1] - nodes[b]![1]);
          if (d < best[2]!) best = [a, b, d];
        }
      }
      const [a, b] = best as [number, number, number];
      this.road(nodes[a]!, nodes[b]!);
      inTree.push(b);
      rest.splice(rest.indexOf(b), 1);
    }
  }

  /**
   * A two-wide road from a to b, laid the way the art pack's own maps lay them: straight runs and right-angle
   * turns, here a Z (along the longer way, across, along again; a road stepping across the grid tile by tile
   * reads as a staircase). Out of a village the first run is long enough to be its street.
   */
  private road(a: [number, number], b: [number, number]): void {
    const [ax, ay] = a;
    const [bx, by] = b;
    const along = Math.abs(bx - ax) >= Math.abs(by - ay);
    const [a0, b0] = along ? [ax, bx] : [ay, by];
    let bend = Math.round(a0 + (b0 - a0) * (0.35 + this.r() * 0.3));
    const span = Math.abs(b0 - a0);
    const hubA = this.hubAt.some(([hx, hy]) => hx === ax && hy === ay);
    const hubB = this.hubAt.some(([hx, hy]) => hx === bx && hy === by);
    const run = Math.min(span, 32);
    if (hubA && Math.abs(bend - a0) < run) bend = a0 + Math.sign(b0 - a0) * run;
    if (hubB && Math.abs(b0 - bend) < run) bend = b0 - Math.sign(b0 - a0) * run;
    const tiles: [number, number][] = [[ax, ay]];
    let x = ax;
    let y = ay;
    const go = (tx: number, ty: number): void => {
      while (x !== tx || y !== ty) {
        if (x !== tx) x += Math.sign(tx - x);
        else y += Math.sign(ty - y);
        tiles.push([x, y]);
      }
    };
    if (along) {
      go(bend, ay);
      go(bend, by);
    } else {
      go(ax, bend);
      go(bx, bend);
    }
    go(bx, by);
    for (const [tx0, ty0] of tiles) {
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        const tx = tx0 + dx;
        const ty = ty0 + dy;
        if (!this.inside(tx, ty, 2)) continue;
        const i = this.idx(tx, ty);
        const here = this.g[i]!;
        if (here === COBBLE || here === HOUSE || here === HOUSE_ANCHOR) continue;
        this.g[i] = here === WATER || here === BRIDGE ? BRIDGE : PATH;
        this.lock[i] = 1;
      }
      // the road's shoulders are cleared of trees
      for (let dy = -1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          const tx = tx0 + dx;
          const ty = ty0 + dy;
          if (!this.inside(tx, ty, 2)) continue;
          const i = this.idx(tx, ty);
          const c = this.g[i]!;
          if (c === WALL || c === TREE || c === BUSH || c === ROCK) this.g[i] = FLOOR;
        }
      }
    }
  }

  /* ------------------------------------------------------------ towns, sights */

  /** A village's ground: a clearing round its square, near rectangular (its streets run straight to its edge); a hold's, the whole of its walls. */
  private clearVillage(cx: number, cy: number, hub: HubSpec): void {
    const walled = this.planOf(hub, cx, cy) === 'court';
    for (let y = cy - VY - 1; y <= cy + VY + 1; y++) {
      for (let x = cx - VX - 1; x <= cx + VX + 1; x++) {
        if (!this.inside(x, y, 2)) continue;
        const d = walled && Math.abs(x - cx) <= 19 && y >= cy - 13 && y <= cy + 10 ? 0 : ((x - cx) / VX) ** 4 + ((y - cy) / VY) ** 4 + (hash2(x, y, this.spec.seed + 4) - 0.5) * 0.12;
        if (d > 1) continue;
        const i = this.idx(x, y);
        if (this.g[i] !== WATER || d < 0.5) this.g[i] = FLOOR;
        this.lock[i] = 1;
      }
    }
  }

  /**
   * A village built the way the owner's references are (VISUAL_BIBLE.md §1): small, and full. Houses stand
   * shoulder to shoulder along its streets, each with its door on one; a small square where the roads meet is
   * crowded with stalls, a well, a cart and goods; an inn, a smithy, a stable, a chapel with its graveyard stand
   * among the houses; gardens, an orchard and a pond fill the quarters; and something stands at every step,
   * barrels and crates and benches by the doors, lamps along the streets. Villages are not alike: each is one of
   * four plans (a crossroads, a market street, a village green, a walled hold), mirrored or not, in its land's
   * own roofs. Lots that don't fit the ground are skipped, so a village by water or woods is just smaller.
   */
  private town(cx: number, cy: number, hub: HubSpec): void {
    const seed = this.spec.seed;
    const theme = this.theme ?? 'farm';
    const plan = this.planOf(hub, cx, cy);
    const flip = hash2(cx, cy, seed + 73) < 0.5 ? 1 : -1;
    const looks = villageHouses(theme);
    // plan coordinates: dx east (mirrored, about the middle of the two-wide road north and south), dy south
    const X = (dx: number): number => (flip > 0 ? cx + dx : cx + 1 - dx);
    const Y = (dy: number): number => cy + dy;
    const xs = (d0: number, d1: number): [number, number] => [Math.min(X(d0), X(d1)), Math.max(X(d0), X(d1))];
    const free = (x: number, y: number): boolean => this.inside(x, y, 2) && !this.marked.has(this.idx(x, y));
    const open = (x: number, y: number): boolean => free(x, y) && OPEN.has(this.at(x, y));
    const pave = (dx0: number, dy0: number, dx1: number, dy1: number, c = PATH): void => {
      const [x0, x1] = xs(dx0, dx1);
      for (let y = Y(Math.min(dy0, dy1)); y <= Y(Math.max(dy0, dy1)); y++) {
        for (let x = x0; x <= x1; x++) {
          if (!this.inside(x, y, 2) || this.marked.has(this.idx(x, y))) continue;
          const k = this.at(x, y);
          if (OPEN.has(k) || k === TREE || k === BUSH || k === ROCK || (c === COBBLE && k === PATH)) {
            this.set(x, y, c);
            this.lock[this.idx(x, y)] = 1;
          }
        }
      }
    };
    const prop = (dx: number, dy: number, name: string, solid = true): boolean => {
      const x = X(dx);
      const y = Y(dy);
      if (!open(x, y) && !(free(x, y) && (this.at(x, y) === COBBLE || this.at(x, y) === PATH))) return false;
      this.put(x, y, { kind: 'prop', prop: name, solid });
      return true;
    };
    const pick = (list: readonly string[], x: number, y: number, salt: number): string => list[Math.floor(hash2(x, y, seed + salt) * list.length) % list.length]!;
    /** A building on a lot `w` by `h` whose front row is `front`, its door on the street below; false if it won't fit. */
    const build = (style: BuildingStyle, dx: number, front: number, w: number, h = 3, art?: string): boolean => {
      const [x0] = xs(dx, dx + w - 1);
      const y0 = Y(front) - h + 1;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (!open(x, y)) return false;
      const step = this.at(x0 + Math.floor(w / 2), y0 + h);
      if ((step !== PATH && step !== COBBLE && step !== BRIDGE) || this.marked.has(this.idx(x0 + Math.floor(w / 2), y0 + h))) return false;
      // a steep roof rises over the ground behind its lot: that ground stays clear of streets and other houses
      for (let y = y0 - (buildingRows(style, theme, art) - h); y < y0; y++) for (let x = x0; x < x0 + w; x++) if (!open(x, y)) return false;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, HOUSE);
      this.put(x0, y0 + h - 1, { kind: 'building', style, w, h, ...(art ? { art: `rk:${art}` } : {}) });
      if (style === 'house') this.houses.push([x0, y0]);
      return true;
    };
    /** Houses side by side along a street from `dx` outward (east for 1, west for -1), up to `count`. */
    const row = (dx: number, dir: 1 | -1, front: number, count: number): void => {
      let x = dx;
      for (let n = 0, k = 0; n < count && k < count * 2 + 2; k++) {
        const big = hash2(X(x), Y(front), seed + 75) < 0.28;
        const w = big || k % 2 === 1 ? 4 : 3;
        const art = big ? pick(looks.big, X(x), Y(front), 77) : pick(looks.small, X(x), Y(front), 79);
        if (build('house', dir > 0 ? x : x - w + 1, front, w, 3, art)) n++;
        x += dir * w;
      }
    };
    /** A small cobbled square, its corners cut like the pack's own. */
    const square = (dx0: number, dy0: number, dx1: number, dy1: number): void => {
      for (let dy = dy0; dy <= dy1; dy++) for (let dx = dx0; dx <= dx1; dx++) if (!((dx === dx0 || dx === dx1) && (dy === dy0 || dy === dy1))) pave(dx, dy, dx, dy, COBBLE);
    };
    /** A fenced garden in rows of greens, with a scarecrow and a gate in its south side. */
    const garden = (dx0: number, dy0: number, dx1: number, dy1: number): void => {
      const [x0, x1] = xs(dx0, dx1);
      const [y0, y1] = [Y(dy0), Y(dy1)];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!open(x, y)) return;
      const gate = Math.round((x0 + x1) / 2);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, x === x0 || x === x1 || y === y0 || y === y1 ? (y === y1 && x === gate ? FLOOR : FENCE) : DECO);
      this.put(gate, Math.round((y0 + y1) / 2), { kind: 'prop', prop: 'scarecrow', solid: true });
    };
    /** A pond with reeds at its edge and a boat drawn up beside it. */
    const pond = (dx0: number, dy0: number, dx1: number, dy1: number): void => {
      if (this.theme === 'volcanic') return;
      const [x0, x1] = xs(dx0, dx1);
      const [y0, y1] = [Y(dy0), Y(dy1)];
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const rx = (x1 - x0) / 2 + 0.5;
      const ry = (y1 - y0) / 2 + 0.5;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!open(x, y)) return;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (((x - mx) / rx) ** 2 + ((y - my) / ry) ** 2 <= 0.85) this.set(x, y, WATER);
      if (open(x1, y0 - 1)) this.put(x1, y0 - 1, { kind: 'prop', prop: 'boat' });
      if (open(x0, y1 + 1)) this.put(x0, y1 + 1, { kind: 'prop', prop: 'bench', solid: true });
    };
    /** Fruit trees in rows a little off true. */
    const orchard = (dx0: number, dy0: number, dx1: number, dy1: number): void => {
      for (let dy = dy0; dy <= dy1; dy += 2) for (let dx = dx0; dx <= dx1; dx += 3) if (open(X(dx), Y(dy)) && hash2(X(dx), Y(dy), seed + 83) < 0.85) this.set(X(dx), Y(dy), TREE);
    };
    /** A chapel on the street with its graveyard beside it, walled in iron (worldScenery.ts), a lamp at the gate. */
    const chapel = (dx: number, front: number, dir: 1 | -1): void => {
      if (!build('temple', dir > 0 ? dx : dx - 2, front, 3, 4)) return;
      const gx = dir > 0 ? dx + 4 : dx - 9;
      const [x0, x1] = xs(gx, gx + 5);
      const [y0, y1] = [Y(front - 5), Y(front)];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!open(x, y)) return;
      const gate = Math.round((x0 + x1) / 2);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const edge = x === x0 || x === x1 || y === y0 || y === y1;
          if (edge) this.set(x, y, y === y1 && x === gate ? FLOOR : FENCE);
          else if ((y - y0) % 2 === 1 && x !== gate) this.put(x, y, { kind: 'prop', prop: hash2(x, y, seed + 85) < 0.6 ? 'gravestone' : 'grave-cross', solid: true });
        }
      }
      if (open(gate - 1, y1 + 1)) this.put(gate - 1, y1 + 1, { kind: 'prop', prop: 'lamp', solid: true });
    };
    // the waystone, and the people the story put here around it
    this.put(cx, cy - 1, { kind: 'waystone' });
    const crowd: [number, number][] = [
      [-2, 1],
      [3, 1],
      [-3, -1],
      [4, -1],
      [-1, 2],
      [2, -2],
    ];
    hub.npcs.forEach((npc, i) => {
      const [dx, dy] = crowd[i % crowd.length]!;
      const [tx, ty] = this.free(X(dx), Y(dy));
      this.put(tx, ty, { kind: 'npc', npc }, hub.when?.[npc]);
    });
    // the roads in (the land's own roads arrive along these lines from the square)
    pave(0, -VY, 1, VY);
    pave(-VX, 0, VX + 1, 1);
    switch (plan) {
      case 'cross': {
        // the square where the roads cross, the inn and the smithy west of it, the stable and a tall shop east
        square(-4, -4, 5, 2);
        pave(-17, -5, 18, -5);
        pave(-17, 6, 18, 6);
        build('tavern', -11, -1, 5);
        build('smithy', -16, -1, 4);
        build('hall', 7, -1, 4);
        build('shop', 12, -1, 4);
        // the rows of houses fronting the north street and the south street
        row(-1, -1, -6, 4);
        row(2, 1, -6, 2);
        chapel(11, -6, 1);
        row(-1, -1, 5, 5);
        row(2, 1, 5, 5);
        // the quarters behind: a garden, an orchard, a pond, fruit trees behind the north row
        garden(-16, 8, -9, 12);
        orchard(-6, 8, -2, 12);
        pond(6, 8, 13, 11);
        orchard(-15, -12, 16, -10);
        for (const [dx, dy, name] of SQUARE_CROSS) prop(dx, dy, name);
        break;
      }
      case 'street': {
        // a cobbled market street, stalls along its south side, the houses fronting it and the lanes behind
        square(-13, -1, 14, 3);
        pave(-17, -6, 18, -6);
        pave(-17, 8, 18, 8);
        build('tavern', -7, -2, 5);
        build('shop', 3, -2, 4);
        row(-8, -1, -2, 4);
        row(7, 1, -2, 4);
        row(-1, -1, -7, 5);
        row(2, 1, -7, 3);
        chapel(12, -7, 1);
        row(-1, -1, 7, 4);
        build('smithy', 2, 7, 4);
        row(6, 1, 7, 4);
        for (let dx = -12; dx <= 13; dx += 3) prop(dx, 3, (dx / 3) % 2 === 0 ? 'market-cart' : pick(['market-goods', 'basket', 'crate', 'barrel', 'sacks'], X(dx), cy, 87));
        garden(-16, 10, -9, 13);
        pond(7, 10, 14, 13);
        orchard(-15, -12, 16, -10);
        for (const [dx, dy, name] of SQUARE_STREET) prop(dx, dy, name);
        break;
      }
      case 'green': {
        // a green where the roads cross, ringed by a road: four lawns (old trees, a pond, flowerbeds round a
        // statue, a corner of market stalls) and a little cobbled plaza at the crossing; houses round it, facing
        // it from the north and backing on it from the south; the inn and the hall on its sides
        pave(-9, -6, 10, -6);
        pave(-9, 6, 10, 6);
        pave(-17, 10, 18, 10);
        square(-2, -2, 3, 2);
        pond(4, 3, 8, 5);
        // old trees on the lawns, close set, and flowers in the grass under them
        for (let dy = -5; dy <= 5; dy += 2) for (let dx = -9; dx <= 10; dx += 2) if (Math.abs(dx) > 3 && hash2(X(dx), Y(dy), seed + 95) < (dy < 0 ? 0.6 : 0.3)) if (open(X(dx), Y(dy))) this.set(X(dx), Y(dy), TREE);
        for (let dy = -5; dy <= 5; dy++) for (let dx = -9; dx <= 10; dx++) if (open(X(dx), Y(dy)) && hash2(X(dx), Y(dy), seed + 97) < 0.25) this.put(X(dx), Y(dy), { kind: 'prop', prop: 'flowers' });
        row(-1, -1, -7, 4);
        row(2, 1, -7, 2);
        chapel(9, -7, 1);
        row(-1, -1, 9, 4);
        row(2, 1, 9, 4);
        build('tavern', -16, -1, 5);
        build('hall', 12, -1, 4);
        pave(-18, 5, -11, 5);
        pave(12, 5, 19, 5);
        build('house', -15, 4, 4, 3, pick(looks.big, cx - 15, cy + 4, 77));
        build('smithy', 13, 4, 4);
        orchard(-15, -12, 16, -11);
        for (const [dx, dy, name] of SQUARE_GREEN) prop(dx, dy, name);
        break;
      }
      case 'court': {
        // a stone wall with a tower at each corner, open where the roads come in; the lord's keep and the
        // workshops along the north street, the inn and a training yard either side of the courtyard with its
        // fountain and stalls, a row of houses along the south street
        const [wx0, wx1] = xs(-17, 18);
        const [wy0, wy1] = [Y(-12), Y(9)];
        for (let y = wy0; y <= wy1; y++) for (let x = wx0; x <= wx1; x++) if ((x === wx0 || x === wx1 || y === wy0 || y === wy1) && OPEN.has(this.at(x, y)) && !this.marked.has(this.idx(x, y))) this.set(x, y, RAMPART);
        for (const [x, y] of [
          [wx0, wy0],
          [wx1, wy0],
          [wx0, wy1],
          [wx1, wy1],
        ] as const)
          if (this.at(x, y) === RAMPART) this.put(x, y, { kind: 'prop', prop: 'watchtower', solid: true });
        if (WALKABLE.has(this.at(cx, wy0))) this.gate = [cx, wy0];
        for (const x of [cx - 1, cx + 2]) if (this.at(x, wy0) === RAMPART && !this.marked.has(this.idx(x, wy0))) this.put(x, wy0, { kind: 'prop', prop: 'watchtower', solid: true });
        pave(-16, -4, 17, -4);
        pave(-16, 6, 17, 6);
        square(-5, -3, 6, 2);
        if (!build('keep', -16, -5, 9, 4)) build('hall', -12, -5, 5);
        row(-1, -1, -5, 2);
        build('tavern', 3, -5, 5);
        build('hall', 9, -5, 4);
        row(14, 1, -5, 1);
        // under the north street only what stands three rows high (a tall roof would reach the street)
        build('smithy', -11, -1, 4);
        row(-12, -1, -1, 1);
        // the training yard
        pave(8, -3, 16, -1);
        for (const [dx, dy, name] of [
          [9, -2, 'scarecrow'],
          [12, -2, 'scarecrow'],
          [15, -3, 'target'],
          [15, -1, 'target'],
          [8, -3, 'weapon-rack'],
          [11, -3, 'armor-stand'],
        ] as const)
          prop(dx, dy, name);
        row(-1, -1, 5, 5);
        row(2, 1, 5, 5);
        for (const [dx, dy, name] of SQUARE_COURT) prop(dx, dy, name);
        for (const [dx, dy, name] of [
          [-14, 8, 'hay'],
          [-10, 8, 'woodpile'],
          [-5, 8, 'well'],
          [6, 8, 'crate'],
          [11, 8, 'hay'],
          [15, 8, 'woodpile'],
        ] as const)
          prop(dx, dy, name);
        break;
      }
    }
    this.villageStreets(cx, cy, seed);
    // the green: flowers in drifts on the open ground, the clearing's edge planted
    for (let y = cy - VY; y <= cy + VY; y++) {
      for (let x = cx - VX; x <= cx + VX; x++) {
        if (!open(x, y) || this.at(x, y) !== FLOOR) continue;
        const d = ((x - cx) / VX) ** 4 + ((y - cy) / VY) ** 4;
        const nearRoad = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => [PATH, COBBLE, BRIDGE, HOUSE, FENCE, RAMPART].includes(this.at(x + dx, y + dy))));
        if (nearRoad) continue;
        const h = hash2(x, y, seed + 67);
        if (d > 0.7 && h < 0.14) this.set(x, y, h < 0.09 ? TREE : BUSH);
        else if (noise2(x / 4, y / 4, seed + 69) > 0.6) this.set(x, y, DECO);
      }
    }
  }

  private planOf(hub: HubSpec, cx: number, cy: number): VillagePlan {
    return hub.plan ?? (hub.wall ? 'court' : PLANS[Math.floor(hash2(cx, cy, this.spec.seed + 71) * PLANS.length)]!);
  }

  /**
   * Something at every step along a village's streets (the references: never a bare wall or an empty verge):
   * barrels, crates, sacks, woodpiles and flowerbeds by the houses, benches and lamps along the street, flowers
   * at the foot of the walls. Never two side by side, so nothing walls a lane off, and never before a door.
   */
  private villageStreets(cx: number, cy: number, seed: number): void {
    const BY_HOUSE = ['barrel', 'crate', 'sacks', 'woodpile', 'flowerbed', 'planter', 'basket', 'pot', 'barrel', 'bench', 'keg', 'flowerbed'];
    const near = (x: number, y: number, kinds: number[]): boolean => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => kinds.includes(this.at(x + dx!, y + dy!)));
    const crowded = (x: number, y: number): boolean => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => (dx || dy) && this.marked.has(this.idx(x + dx, y + dy))));
    let lampAt = -99;
    for (let y = cy - VY; y <= cy + VY; y++) {
      for (let x = cx - VX; x <= cx + VX; x++) {
        if (!this.inside(x, y, 3) || this.marked.has(this.idx(x, y)) || this.at(x, y) !== FLOOR) continue;
        // before a door: the tile under a lot's middle (the step) and its sides stay clear
        if (this.at(x, y - 1) === HOUSE && this.placed.some((p) => p.marker.kind === 'building' && p.ty === y - 1 && Math.abs(p.tx + Math.floor(p.marker.w / 2) - x) <= 1)) continue;
        if (crowded(x, y)) continue;
        const street = near(x, y, [PATH, COBBLE]);
        const house = near(x, y, [HOUSE]);
        const h = hash2(x, y, seed + 91);
        if (house && street && h < 0.55) this.put(x, y, { kind: 'prop', prop: BY_HOUSE[Math.floor(hash2(x, y, seed + 93) * BY_HOUSE.length)]!, solid: true });
        else if (street && x - lampAt > 5 && h < 0.3) {
          this.put(x, y, { kind: 'prop', prop: 'lamp', solid: true });
          lampAt = x;
        } else if (house && h < 0.5) this.put(x, y, { kind: 'prop', prop: h < 0.3 ? 'flowers' : 'hedge' });
      }
    }
  }

  /** A 4×3 house (with a free tile around it), if the ground allows. */
  private house(x0: number, y0: number): boolean {
    for (let y = y0 - 1; y <= y0 + 3; y++) {
      for (let x = x0 - 1; x <= x0 + 4; x++) {
        const c = this.at(x, y);
        if (!this.inside(x, y, 3) || c === PATH || c === COBBLE || c === WATER || c === BRIDGE || c === HOUSE || c === HOUSE_ANCHOR || this.marked.has(this.idx(x, y))) return false;
      }
    }
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 4; x++) this.set(x, y, y === y0 + 2 && x === x0 ? HOUSE_ANCHOR : HOUSE);
    return true;
  }

  private sight(cx: number, cy: number, p: PoiSpec): void {
    const r = p.r;
    const seed = this.spec.seed + cx * 31 + cy;
    const ring = (n: number, rad: number, fn: (x: number, y: number, k: number) => void): void => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + hash2(k, seed, 5) * 0.6;
        fn(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad * 0.8), k);
      }
    };
    const free = (x: number, y: number): boolean => OPEN.has(this.at(x, y)) && !this.marked.has(this.idx(x, y));
    switch (p.kind) {
      case 'camp':
        if (free(cx, cy)) this.put(cx, cy, { kind: 'prop', prop: 'campfire', solid: true });
        ring(3, r * 0.55, (x, y) => free(x, y) && this.put(x, y, { kind: 'prop', prop: 'tent', solid: true }));
        ring(4, r * 0.8, (x, y, k) => free(x, y) && this.put(x, y, { kind: 'prop', prop: k % 2 ? 'crate' : 'barrel', solid: true }));
        break;
      case 'den':
        ring(Math.round(r * 2.2), r - 0.5, (x, y, k) => k % 3 !== 0 && free(x, y) && this.set(x, y, ROCK));
        ring(4, r * 0.4, (x, y) => free(x, y) && this.put(x, y, { kind: 'prop', prop: 'bones' }));
        break;
      case 'ruin':
        ring(Math.round(r * 1.6), r * 0.7, (x, y, k) => free(x, y) && this.set(x, y, k % 3 === 0 ? ROCK : PILLAR));
        // the old floor: whole in the middle, broken at its edge (single stones dotted about read as noise)
        for (let y = cy - 2; y <= cy + 2; y++) {
          for (let x = cx - 3; x <= cx + 3; x++) {
            const rim = Math.abs(x - cx) === 3 || Math.abs(y - cy) === 2;
            if (free(x, y) && (!rim || hash2(x, y, seed) < 0.55)) this.set(x, y, COBBLE);
          }
        }
        break;
      case 'farm': {
        // a fenced field of crops with a gate toward the middle of the map
        const fw = Math.max(4, r - 2);
        const fh = Math.max(3, r - 4);
        for (let y = cy - fh; y <= cy + fh; y++) {
          for (let x = cx - fw; x <= cx + fw; x++) {
            if (!free(x, y)) continue;
            const edge = y === cy - fh || y === cy + fh || x === cx - fw || x === cx + fw;
            const gate = (y === cy + fh && Math.abs(x - cx) <= 1) || (x === cx - fw && Math.abs(y - cy) <= 1);
            this.set(x, y, edge ? (gate ? FLOOR : FENCE) : DECO);
          }
        }
        this.house(cx + fw + 2, cy - 2);
        break;
      }
      case 'nest':
        ring(Math.round(r * 2), r - 1, (x, y, k) => k % 2 === 0 && free(x, y) && this.set(x, y, k % 4 ? BUSH : ROCK));
        ring(3, r * 0.3, (x, y) => free(x, y) && this.put(x, y, { kind: 'prop', prop: 'eggs' }));
        break;
      case 'wreck':
        if (free(cx, cy)) this.put(cx, cy, { kind: 'prop', prop: 'wreck', solid: true });
        ring(5, r * 0.7, (x, y, k) => free(x, y) && this.put(x, y, { kind: 'prop', prop: k % 2 ? 'crate' : 'barrel', solid: true }));
        break;
      case 'grove':
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (free(x, y) && Math.hypot(x - cx, y - cy) < r - 1 && hash2(x, y, seed) < 0.45) this.set(x, y, DECO);
        ring(Math.round(r * 1.5), r - 0.5, (x, y, k) => k % 2 === 0 && free(x, y) && this.set(x, y, TREE));
        break;
      case 'cave':
        ring(Math.round(r * 2.6), r - 0.5, (x, y, k) => k % 4 !== 0 && free(x, y) && this.set(x, y, ROCK));
        break;
    }
    if (p.landmark) {
      const { style, w, h, name } = p.landmark;
      const x0 = cx - Math.floor(w / 2);
      const y0 = cy - h - 1;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, HOUSE);
      this.put(x0, y0 + h - 1, { kind: 'building', style, w, h, ...(name ? { name } : {}) });
    }
    if (p.entrance) this.put(cx, cy, { kind: 'exit', to: p.entrance.to, label: p.entrance.label, ...(p.entrance.minLevel ? { minLevel: p.entrance.minLevel } : {}) });
    if (p.spot) this.put(cx, cy + (p.entrance ? 2 : 0), { kind: 'spot', id: p.spot.id, name: p.spot.name, r: Math.max(4, r - 1) });
    if (p.chest) {
      const [x, y] = this.near(cx + 2, cy - 2);
      this.put(x, y, { kind: 'chest', id: `poi-${cx}-${cy}`, tier: p.chest });
    }
    const level = p.level ?? this.levelAt(cx, cy);
    p.packs.forEach((enemies, k) => {
      const a = (k / Math.max(1, p.packs.length)) * Math.PI * 2 + 0.7;
      const [x, y] = this.near(Math.round(cx + Math.cos(a) * r * 0.5), Math.round(cy + Math.sin(a) * r * 0.45));
      this.put(x, y, { kind: 'pack', enemies, level, ...(p.elite && k === 0 ? { elite: true } : {}) }, p.when);
      this.packSpots.push([x, y]);
    });
    if (p.rare) {
      const [x, y] = this.near(cx, cy + 1);
      this.put(x, y, { kind: 'pack', enemies: [p.rare], level: level + 1, rare: true }, p.when);
      this.packSpots.push([x, y]);
    }
  }

  /** The nearest free open tile to (x, y). */
  private near(x: number, y: number): [number, number] {
    for (let rad = 0; rad < 8; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (this.inside(tx, ty, 2) && WALKABLE.has(this.at(tx, ty)) && !this.marked.has(this.idx(tx, ty))) return [tx, ty];
        }
      }
    }
    this.set(x, y, FLOOR);
    return [x, y];
  }

  /* ----------------------------------------------------------- the open land */

  /**
   * What stands in the open land, placed the way land grows rather than sprinkled: trees gather in copses
   * (where a slow noise field is high; the clearings between stay open), bushes grow as undergrowth along
   * a copse's edge, rocks break out in clusters, and flowers lie in meadows away from the trees. The
   * spec's numbers keep meaning about the same share of the land; only where things stand changes (a
   * playtester's "goofy" look was mostly lone trees and rocks dotted evenly everywhere).
   */
  private scatter(): void {
    const sc = this.spec.scatter;
    const seed = this.spec.seed + 41;
    for (let y = 2; y < this.h - 2; y++) {
      for (let x = 2; x < this.w - 2; x++) {
        const i = this.idx(x, y);
        if (this.g[i] !== FLOOR || this.lock[i] || this.marked.has(i)) continue;
        const h = hash2(x, y, seed) * 100;
        const copse = fbm(x / 7, y / 7, seed + 3);
        // 0 over the clearings, rising toward a copse's heart
        const inCopse = clamp((copse - 0.46) / 0.2, 0, 1);
        // the band where a copse meets the open: its undergrowth
        const edge = clamp(1 - Math.abs(copse - 0.43) / 0.07, 0, 1);
        const outcrop = clamp((fbm(x / 5, y / 5, seed + 7) - 0.62) / 0.2, 0, 1);
        const pTree = sc.trees * 4.4 * inCopse;
        const pBush = sc.bushes * 3 * edge;
        const pRock = sc.rocks * 6 * outcrop;
        if (h < pTree) this.g[i] = TREE;
        else if (h < pTree + pBush) this.g[i] = BUSH;
        else if (h < pTree + pBush + pRock) this.g[i] = ROCK;
        else if (copse < 0.4 && noise2(x / 5, y / 5, seed) > 1 - sc.flowers / 28) this.g[i] = DECO;
      }
    }
  }

  /** Sand along the water (or everywhere, for deserts). */
  private beaches(): void {
    const mode = this.spec.sand;
    if (!mode) return;
    const seed = this.spec.seed + 51;
    for (let y = 1; y < this.h - 1; y++) {
      for (let x = 1; x < this.w - 1; x++) {
        const i = this.idx(x, y);
        if (this.g[i] !== FLOOR && this.g[i] !== DECO) continue;
        if (mode === 'all') {
          this.g[i] = SAND;
          continue;
        }
        if (mode === 'dunes' && fbm(x / 9, y / 9, seed + 7) > 0.66) {
          this.g[i] = SAND;
          continue;
        }
        const reach = 2 + Math.floor(noise2(x / 6, y / 6, seed) * (mode === 'dunes' ? 7 : 4));
        let shore = false;
        for (let dy = -reach; dy <= reach && !shore; dy++) for (let dx = -reach; dx <= reach && !shore; dx++) if (this.at(x + dx, y + dy) === WATER && Math.hypot(dx, dy) <= reach) shore = true;
        if (shore) this.g[i] = SAND;
      }
    }
  }

  /**
   * The open land dressed: small scenes (SCENES) in the land's kind scattered between the sights, well clear of
   * the roads, the villages and each other, about one to every 240 open tiles; and the roads' shoulders with a
   * stone, a flower clump or a bush now and then.
   */
  private dress(pois: [number, number][]): void {
    const kinds = SCENES_FOR[sceneLand(this.theme)];
    const rand = rng(this.spec.seed + 913);
    let openTiles = 0;
    for (let i = 0; i < this.g.length; i++) if (OPEN.has(this.g[i]!) && !this.lock[i]) openTiles++;
    const want = Math.round(openTiles / 240);
    const done: [number, number][] = [];
    const BUSY = new Set([PATH, BRIDGE, COBBLE, HOUSE, HOUSE_ANCHOR, FENCE, RAMPART]);
    const start = Math.floor(rand() * kinds.length);
    for (let tries = 0; tries < want * 80 && done.length < want; tries++) {
      const sc = SCENES[kinds[(start + done.length) % kinds.length]!]!;
      const h = sc.rows.length;
      const w = Math.max(...sc.rows.map((r) => r.length));
      const x0 = 4 + Math.floor(rand() * (this.w - w - 8));
      const y0 = 4 + Math.floor(rand() * (this.h - h - 8));
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      if (this.hubAt.some(([hx, hy]) => ((cx - hx) / (VX + 6)) ** 2 + ((cy - hy) / (VY + 5)) ** 2 < 1)) continue;
      if (pois.some(([px, py], k) => Math.hypot(px - cx, py - cy) < this.spec.pois[k]!.r + 5)) continue;
      if (done.some(([px, py]) => Math.hypot(px - cx, py - cy) < 13)) continue;
      let ok = true;
      for (let dy = -2; dy < h + 2 && ok; dy++) {
        for (let dx = -2; dx < w + 2 && ok; dx++) {
          const x = x0 + dx;
          const y = y0 + dy;
          if (!this.inside(x, y, 3)) {
            ok = false;
            break;
          }
          const i = this.idx(x, y);
          const cell = sc.rows[dy]?.[dx];
          if (cell !== undefined && cell !== ' ') ok = OPEN.has(this.g[i]!) && !this.lock[i] && !this.marked.has(i);
          else if (BUSY.has(this.g[i]!) || this.marked.has(i)) ok = false;
        }
      }
      if (!ok) continue;
      sc.rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          const ch = row[dx]!;
          const x = x0 + dx;
          const y = y0 + dy;
          if (ch === ' ') continue;
          this.lock[this.idx(x, y)] = 1;
          const cell = sc.key[ch];
          if (cell === undefined) continue;
          if (typeof cell === 'number') this.set(x, y, cell);
          else this.put(x, y, { kind: 'prop', prop: cell.prop, solid: !!cell.solid });
        }
      });
      done.push([cx, cy]);
    }
    // the roads' shoulders
    for (let i = 0; i < this.g.length; i++) {
      if (this.g[i] !== PATH) continue;
      const x = i % this.w;
      const y = (i - x) / this.w;
      const hh = hash2(x, y, this.spec.seed + 917);
      if (hh > 0.06) continue;
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        const j = this.idx(x + dx, y + dy);
        if (!this.inside(x + dx, y + dy, 3) || !OPEN.has(this.g[j]!) || this.lock[j] || this.marked.has(j)) continue;
        this.g[j] = hh < 0.015 ? ROCK : hh < 0.025 ? BUSH : DECO;
        break;
      }
    }
  }

  /**
   * A frightening land's roads are lit (THEMES dread): a lamp post every dozen tiles or so on a road's shoulder,
   * out past the villages (they light their own), so a traveller walks from one pool of light to the next. Placed
   * by position, not by the land's random numbers, so nothing else in the land moves for them.
   */
  private roadLamps(): void {
    if (!this.theme || !THEMES[this.theme].dread?.lamps) return;
    const lit: [number, number][] = [];
    for (let i = 0; i < this.g.length; i++) {
      if (this.g[i] !== PATH) continue;
      const x = i % this.w;
      const y = (i - x) / this.w;
      if (this.hubAt.some(([hx, hy]) => ((x - hx) / (VX + 2)) ** 2 + ((y - hy) / (VY + 2)) ** 2 < 1)) continue;
      if (lit.some(([lx, ly]) => Math.abs(lx - x) + Math.abs(ly - y) < 12)) continue;
      // on the shoulder, one side or the other
      const sides: [number, number][] = (x + y) % 2
        ? [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ]
        : [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ];
      for (const [dx, dy] of sides) {
        const j = this.idx(x + dx, y + dy);
        if (!this.inside(x + dx, y + dy, 3) || !OPEN.has(this.g[j]!) || this.marked.has(j)) continue;
        this.put(x + dx, y + dy, { kind: 'prop', prop: 'lamp', solid: false });
        lit.push([x, y]);
        break;
      }
    }
  }

  private wildPacks(hubs: [number, number][], ways: [number, number][], pois: [number, number][]): void {
    const s = this.spec;
    let made = 0;
    // the land is smaller (ZONE_SCALE), and so is its count, a little less than in proportion
    const count = Math.round(s.wildCount * ZONE_SCALE);
    for (let tries = 0; tries < count * 60 && made < count; tries++) {
      const x = 3 + Math.floor(this.r() * (this.w - 6));
      const y = 3 + Math.floor(this.r() * (this.h - 6));
      const i = this.idx(x, y);
      if (!OPEN.has(this.g[i]!) || this.marked.has(i)) continue;
      // never in a village
      if (hubs.some(([hx, hy]) => ((x - hx) / (VX + 4)) ** 2 + ((y - hy) / (VY + 3)) ** 2 < 1)) continue;
      // nor in a sight (its own packs are its business: a blockade lifted leaves it empty)
      if (pois.some(([px, py], k) => Math.hypot(px - x, py - y) < this.spec.pois[k]!.r + 3)) continue;
      if (ways.some(([ex, ey]) => Math.hypot(ex - x, ey - y) < 9)) continue;
      if (this.packSpots.some(([px, py]) => Math.hypot(px - x, py - y) < 9)) continue;
      const t = this.gradient(x, y);
      const bands = s.wild.filter((b) => t >= b.band[0] - 0.05 && t <= b.band[1] + 0.05);
      const band = bands.length ? bands[Math.floor(this.r() * bands.length)]! : s.wild[0]!;
      const enemies = band.packs[Math.floor(this.r() * band.packs.length)]!;
      this.put(x, y, { kind: 'pack', enemies, level: this.levelAt(x, y), ...(this.r() < 0.06 ? { elite: true } : {}) });
      this.packSpots.push([x, y]);
      made++;
    }
  }

  /**
   * Everything a player should reach is reached: markers cut off by woods or water get a path to the
   * nearest reached ground, and open pockets nobody can get into are filled in.
   */
  private connect(start: [number, number]): void {
    const walk = (i: number): boolean => WALKABLE.has(this.g[i]!) || this.marked.has(i);
    const flood = (): Uint8Array => {
      const seen = new Uint8Array(this.w * this.h);
      const q = [this.idx(start[0], start[1])];
      seen[q[0]!] = 1;
      while (q.length) {
        const i = q.pop()!;
        const x = i % this.w;
        const y = (i - x) / this.w;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (!this.inside(nx, ny)) continue;
          const j = this.idx(nx, ny);
          if (seen[j] || !walk(j)) continue;
          seen[j] = 1;
          q.push(j);
        }
      }
      return seen;
    };
    let seen = flood();
    for (const m of this.placed) {
      const i = this.idx(m.tx, m.ty);
      if (seen[i]) continue;
      // walk toward the start until we meet reached ground, clearing as we go
      let x = m.tx;
      let y = m.ty;
      for (let guard = 0; guard < this.w + this.h && !seen[this.idx(x, y)]; guard++) {
        const c = this.g[this.idx(x, y)]!;
        if (!walk(this.idx(x, y))) this.g[this.idx(x, y)] = c === WATER ? BRIDGE : FLOOR;
        if (Math.abs(start[0] - x) > Math.abs(start[1] - y)) x += Math.sign(start[0] - x);
        else y += Math.sign(start[1] - y);
      }
      seen = flood();
    }
    for (let i = 0; i < seen.length; i++) if (!seen[i] && WALKABLE.has(this.g[i]!)) this.g[i] = this.g[i] === BRIDGE ? WATER : WALL;
  }

  /* -------------------------------------------------------------- the story */

  /** Places the story's dressing near its anchors, on ground the land already left free. */
  private story(hubs: [number, number][], pois: [number, number][], ways: [number, number][]): void {
    for (const sm of this.spec.story ?? []) {
      const base = this.anchor(sm.near, hubs, pois, ways);
      const x = base[0] + (sm.dx ?? 0);
      const y = base[1] + (sm.dy ?? 0);
      const m = sm.marker;
      // flames go on the roof itself
      if (m.kind === 'fire') {
        this.put(x, y, m, sm.when);
        continue;
      }
      const [tx, ty] = this.free(x, y);
      // nothing the story stands up may close a road
      const marker = m.kind === 'prop' && m.solid && !OPEN.has(this.at(tx, ty)) ? { ...m, solid: false } : m;
      this.put(tx, ty, marker, sm.when);
    }
  }

  private anchor(near: string, hubs: [number, number][], pois: [number, number][], ways: [number, number][]): [number, number] {
    if (near === 'hub' || near.startsWith('hub:')) {
      const h = hubs[near === 'hub' ? 0 : Number(near.slice(4))];
      if (h) return h;
    } else if (near.startsWith('house:')) {
      const h = this.houses[Number(near.slice(6))];
      if (h) return [h[0] + 1, h[1]];
    } else if (near.startsWith('exit:')) {
      const i = this.spec.exits.findIndex((e) => e.to === near.slice(5));
      if (i >= 0) return ways[i]!;
    } else if (near === 'gate') {
      if (this.gate) return this.gate;
    } else if (near.startsWith('shore:')) {
      return this.shore(this.anchor(near.slice(6), hubs, pois, ways));
    } else {
      const i = this.spec.pois.findIndex((p) => p.spot?.id === near);
      if (i >= 0) return pois[i]!;
    }
    throw new Error(`zone ${this.spec.seed}: no story anchor '${near}'`);
  }

  /** The walkable tile nearest (x, y) with water beside it. */
  private shore(from: [number, number]): [number, number] {
    const seen = new Uint8Array(this.w * this.h);
    const q = [this.idx(from[0], from[1])];
    seen[q[0]!] = 1;
    for (let head = 0; head < q.length; head++) {
      const i = q[head]!;
      const x = i % this.w;
      const y = (i - x) / this.w;
      const sides: [number, number][] = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      if (WALKABLE.has(this.g[i]!) && sides.some(([sx, sy]) => this.at(sx, sy) === WATER)) return [x, y];
      for (const [sx, sy] of sides) {
        if (!this.inside(sx, sy, 1)) continue;
        const j = this.idx(sx, sy);
        if (seen[j] || this.g[j] === WATER) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    return from;
  }

  /** The nearest walkable tile nobody stands on, without carving anything. */
  private free(x: number, y: number): [number, number] {
    for (let rad = 0; rad < 10; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (this.inside(tx, ty, 2) && WALKABLE.has(this.at(tx, ty)) && !this.marked.has(this.idx(tx, ty))) return [tx, ty];
        }
      }
    }
    return [x, y];
  }
}

/** A wild region whose map is generated the first time something looks at it. */
export function wildRegion(base: Omit<RegionDef, 'kind' | 'map' | 'markers' | 'placed' | 'encounters' | 'level'>, spec: ZoneSpec): RegionDef {
  let made: GeneratedZone | null = null;
  const get = (): GeneratedZone => (made ??= generateZone(spec, base.theme));
  return {
    ...base,
    kind: 'wild',
    level: spec.levels[0],
    markers: {},
    encounters: [],
    holds: {
      // what the story adds (a road that opens, a person who comes, a place to look at) counts for routes too
      exits: [...spec.exits.map((e) => e.to), ...spec.pois.flatMap((p) => (p.entrance ? [p.entrance.to] : [])), ...(spec.story ?? []).flatMap((m) => (m.marker.kind === 'exit' ? [m.marker.to] : []))],
      npcs: [...spec.hubs.flatMap((h) => h.npcs), ...(spec.story ?? []).flatMap((m) => (m.marker.kind === 'npc' ? [m.marker.npc] : []))],
      spots: [...spec.pois.flatMap((p) => (p.spot ? [p.spot.id] : [])), ...(spec.story ?? []).flatMap((m) => (m.marker.kind === 'spot' ? [m.marker.id] : []))],
      // roads the story keeps shut until a quest is done
      needs: Object.fromEntries([...spec.exits, ...(spec.story ?? []).flatMap((m) => (m.marker.kind === 'exit' ? [m.marker] : []))].flatMap((e) => (e.needs ? [[e.to, e.needs]] : []))),
    },
    get map() {
      return get().map;
    },
    get placed() {
      return get().placed;
    },
  };
}
