import { hash2 } from '../core/math';
import type { Marker, PlacedMarkerDef, RegionDef } from './types';

/*
 * How a dungeon feels (the rule of the Diablo games): rooms a little too tight for what is in them, a corridor
 * to the next, and every wall saying what happened here. The maps were drawn for a smaller world, so here each
 * room's floor is drawn in around its middle to fighting size, the doors keep a short passage in, and the room is
 * dressed for the place it is: a crypt's sarcophagi, a forge's coal and anvils, a smuggler's stacked cargo. A boss's
 * chamber keeps its size (its attacks are measured to it) and is dressed only with what can be walked over.
 */

/** A room's floor at most this many tiles across and deep: about one screen. */
const ROOM_W = 15;
const ROOM_H = 11;

type Piece = [dx: number, dy: number, prop: string];

interface Dress {
  /** Against the north wall, in full view. */
  wall: string[];
  /** Against the east and west walls. */
  side: string[];
  /** The fire in a far corner. */
  corner: string;
  /** Pairs standing out from the walls of a larger room. */
  pillar?: string;
  /** What the middle of a room is for, one set a room in turn. */
  core: Piece[][];
  /** Small things underfoot. */
  bits: string[];
  /**
   * What makes its great rooms great (the owner: "dungeons don't feel special"): a nave, two rows of tall columns the
   * length of the room with a carpet down the middle of it.
   */
  nave?: { column: string; runner?: string };
  /** One room in this many has a pool let into its floor, of whatever the place runs with (its theme's water). */
  pools?: number;
  /** What stands behind the north wall of the boss's chamber (greatworks.ts). */
  backdrop?: string;
  /** The carpet from the boss's door to the foot of it. */
  carpet?: string;
}

/** Things nobody bumps into. */
const SOFT = new Set(['bones', 'skulls', 'rubble', 'debris', 'candles', 'coin-pile', 'spores', 'eggs', 'runner', 'rug', 'flowers', 'sacks', 'bone-heap', 'log']);

const DRESS: Record<string, Dress> = {
  // under the chapel: the village's old dead, and something older
  crypt: {
    wall: ['sarcophagus', 'gravestone', 'candles', 'grave-cross', 'sarcophagus'],
    side: ['sarcophagus', 'broken-column', 'coffin'],
    corner: 'iron-torch',
    pillar: 'column',
    core: [
      [[0, 0, 'altar'], [-2, 1, 'candles'], [2, 1, 'candles']],
      [[-2, -1, 'sarcophagus'], [2, -1, 'sarcophagus'], [-2, 2, 'sarcophagus'], [2, 2, 'sarcophagus']],
      [[0, -1, 'statue'], [-1, 1, 'candles'], [1, 1, 'candles']],
    ],
    bits: ['bones', 'skulls', 'rubble', 'candles', 'bone-heap'],
    carpet: '#3a2a4a',
    nave: { column: 'tall-column' },
    backdrop: 'reliquary-wall',
  },
  // a bandit hold in a hill: gibbets, stolen goods and a barracks that stinks
  'gallows-keep': {
    wall: ['skull-banner', 'weapon-rack', 'cage', 'crates-stack', 'big-barrel'],
    side: ['cage', 'big-barrel', 'crates-stack', 'trunk'],
    corner: 'brazier',
    core: [
      [[0, -1, 'skull-banner'], [-2, 1, 'cage'], [2, 1, 'cage']],
      [[0, 0, 'table'], [-2, 0, 'stool'], [2, 0, 'stool'], [0, 2, 'keg']],
      [[-2, 0, 'weapon-rack'], [2, 0, 'target'], [0, 2, 'campfire']],
    ],
    bits: ['rubble', 'bones', 'sacks', 'skulls'],
    carpet: '#4a2a1a',
    backdrop: 'gang-gallows',
  },
  // a sea cave full of someone else's cargo
  'smugglers-grotto': {
    wall: ['crates-stack', 'big-barrel', 'casks', 'trunk', 'lumber-pile'],
    side: ['crates-stack', 'big-barrel', 'trunk', 'keg'],
    corner: 'lantern',
    core: [
      [[0, 0, 'boat'], [-3, 2, 'crate'], [3, 2, 'barrel']],
      [[0, 0, 'campfire'], [-2, 1, 'keg'], [2, 1, 'trunk']],
      [[-2, -1, 'crates-stack'], [2, -1, 'crates-stack'], [0, 2, 'gold-chest']],
    ],
    bits: ['sacks', 'rubble', 'log'],
    pools: 3,
    backdrop: 'grotto-wreck',
  },
  // a city's drowned drains, and what breeds there
  'rotmother-cistern': {
    wall: ['big-barrel', 'cauldron', 'stone-heap', 'thorns'],
    side: ['big-barrel', 'stone-heap', 'cauldron'],
    corner: 'lantern',
    pillar: 'broken-column',
    core: [
      [[0, 0, 'cauldron'], [-2, 0, 'clay-pot'], [2, 0, 'clay-pot'], [0, 2, 'spores']],
      [[-2, 0, 'big-barrel'], [2, 0, 'big-barrel'], [0, 1, 'eggs']],
      [[0, 0, 'rubble-heap'], [-2, 2, 'spores'], [2, 2, 'spores']],
    ],
    bits: ['eggs', 'spores', 'bones', 'rubble'],
    nave: { column: 'mossy-column' },
    pools: 2,
    backdrop: 'rot-vats',
  },
  // the dwarves' great forge, run now by the dead
  'deepforge-halls': {
    wall: ['weapon-rack', 'coal-heap', 'forge', 'crates-stack', 'anvil', 'great-banner'],
    side: ['coal-heap', 'stone-heap', 'big-barrel', 'weapon-rack'],
    corner: 'brazier',
    pillar: 'great-column',
    core: [
      [[0, 0, 'forge'], [-3, 1, 'anvil'], [3, 1, 'anvil'], [0, 2, 'grindstone']],
      [[-2, 0, 'coal-heap'], [2, 0, 'stone-heap'], [0, 2, 'cart']],
      [[-3, 0, 'anvil'], [3, 0, 'anvil'], [0, -1, 'armor-stand']],
    ],
    bits: ['rubble', 'bones', 'rubble', 'skulls'],
    carpet: '#3a2a28',
    nave: { column: 'great-column' },
    pools: 2,
    backdrop: 'great-furnace',
  },
  // kings under the hill, their gold still round them
  'barrow-of-kings': {
    wall: ['great-banner', 'sarcophagus', 'statue', 'gold-chest', 'sarcophagus'],
    side: ['sarcophagus', 'lion', 'coffin'],
    corner: 'iron-torch',
    pillar: 'great-column',
    core: [
      [[0, 0, 'sarcophagus'], [-2, 1, 'coin-pile'], [2, 1, 'coin-pile'], [-3, -1, 'lion'], [3, -1, 'lion']],
      [[0, -1, 'statue'], [-2, 1, 'candles'], [2, 1, 'candles']],
      [[-2, 0, 'sarcophagus'], [2, 0, 'sarcophagus'], [0, 2, 'gold-chest']],
    ],
    bits: ['bones', 'skulls', 'candles', 'rubble', 'coin-pile'],
    carpet: '#6a1a2a',
    nave: { column: 'great-column', runner: '#6a1a2a' },
    backdrop: 'seated-kings',
  },
  // a desert king's tomb: obelisks, canopic jars, sand drifted in
  'tomb-of-the-sun-king': {
    wall: ['standing-stone', 'urn', 'lion', 'urn', 'statue'],
    side: ['urn', 'lion', 'standing-stone'],
    corner: 'brazier',
    pillar: 'column',
    core: [
      [[0, 0, 'altar'], [-3, 0, 'urn'], [3, 0, 'urn']],
      [[-2, -1, 'standing-stone'], [2, -1, 'standing-stone'], [0, 2, 'sarcophagus']],
      [[0, -1, 'statue'], [-2, 1, 'urn'], [2, 1, 'urn']],
    ],
    bits: ['rubble', 'bones', 'urn', 'skulls'],
    carpet: '#b08a3a',
    nave: { column: 'sand-column', runner: '#b08a3a' },
    backdrop: 'sun-throne',
  },
  // a giants' vault locked in ice
  'rimeheld-vault': {
    wall: ['ice-crystal', 'trunk', 'stone-heap', 'ice-crystal', 'gold-chest'],
    side: ['ice-crystal', 'stone-heap', 'trunk'],
    corner: 'brazier',
    pillar: 'ice-crystal',
    core: [
      [[0, 0, 'ice-crystal'], [-2, 1, 'trunk'], [2, 1, 'trunk']],
      [[-2, 0, 'ice-crystal'], [2, 0, 'ice-crystal'], [0, 2, 'rubble-heap']],
      [[0, -1, 'statue'], [-3, 1, 'ice-crystal'], [3, 1, 'ice-crystal']],
    ],
    bits: ['rubble', 'bones', 'skulls'],
    nave: { column: 'ice-column' },
    pools: 3,
    backdrop: 'vault-door',
  },
  // a fortress under siege, every hall a barracks
  'siege-of-highwall': {
    wall: ['banner-red', 'weapon-rack', 'crates-stack', 'armor-stand', 'banner-shield'],
    side: ['big-barrel', 'weapon-rack', 'crates-stack', 'cot'],
    corner: 'brazier',
    pillar: 'great-column',
    core: [
      [[0, 0, 'war-table'], [-3, 2, 'stool'], [3, 2, 'stool']],
      [[-2, 0, 'cot'], [2, 0, 'cot'], [0, 2, 'campfire']],
      [[-3, 0, 'weapon-rack'], [3, 0, 'armor-stand'], [0, 1, 'crate']],
    ],
    bits: ['rubble', 'bones', 'sacks'],
    carpet: '#7a1a1a',
    nave: { column: 'great-column', runner: '#7a1a1a' },
    backdrop: 'inner-ward-gate',
  },
  // the rotten heart of the wood: roots for walls
  blightheart: {
    wall: ['root-tangle', 'great-mushroom', 'thorns', 'root-tangle'],
    side: ['root-tangle', 'thorns', 'great-mushroom'],
    corner: 'lantern',
    pillar: 'root-tangle',
    core: [
      [[0, 0, 'root-tangle'], [-2, 1, 'spores'], [2, 1, 'spores'], [-3, -1, 'great-mushroom'], [3, -1, 'great-mushroom']],
      [[-2, 0, 'great-mushroom'], [2, 0, 'great-mushroom'], [0, 2, 'thorns']],
      [[0, -1, 'thorns'], [-2, 1, 'eggs'], [2, 1, 'eggs']],
    ],
    bits: ['spores', 'eggs', 'bones'],
    pools: 2,
    backdrop: 'thorn-throne',
  },
  // the Host's throne in a burning mountain
  'molten-throne': {
    wall: ['skull-banner', 'ember-rock', 'coal-heap', 'forge', 'ember-rock'],
    side: ['ember-rock', 'coal-heap', 'skull-banner'],
    corner: 'brazier',
    pillar: 'ember-rock',
    core: [
      [[0, 0, 'forge'], [-3, 0, 'skull-banner'], [3, 0, 'skull-banner']],
      [[-2, 0, 'ember-rock'], [2, 0, 'ember-rock'], [0, 2, 'bone-heap']],
      [[0, -1, 'statue'], [-2, 1, 'brazier'], [2, 1, 'brazier']],
    ],
    bits: ['rubble', 'skulls', 'bones', 'bone-heap'],
    carpet: '#5a1a10',
    nave: { column: 'black-column' },
    pools: 2,
    backdrop: 'ashkar-throne',
  },
  // a tower that is coming apart between worlds
  'spire-of-the-rift': {
    wall: ['rift-crystal', 'great-column', 'bookshelf', 'rift-crystal'],
    side: ['rift-crystal', 'broken-column', 'bookshelf'],
    corner: 'lantern',
    pillar: 'great-column',
    core: [
      [[0, 0, 'rift-crystal'], [-2, 2, 'candles'], [2, 2, 'candles']],
      [[-3, 0, 'rift-crystal'], [3, 0, 'rift-crystal'], [0, -1, 'altar']],
      [[0, -1, 'statue'], [-2, 1, 'broken-column'], [2, 1, 'broken-column']],
    ],
    bits: ['candles', 'rubble', 'skulls'],
    carpet: '#3a2a6a',
    nave: { column: 'black-column', runner: '#3a2a6a' },
    backdrop: 'tear-shards',
  },
  // the Hallow King's own citadel, three hundred winters deep: a dead court kept in rime, ice grown up the walls
  duskspire: {
    wall: ['ice-crystal', 'banner-blue', 'statue', 'ice-column', 'banner-blue', 'ice-crystal'],
    side: ['ice-crystal', 'lion', 'statue', 'coffin'],
    corner: 'iron-torch',
    pillar: 'ice-column',
    core: [
      [[0, 0, 'ice-crystal'], [-3, -1, 'lion'], [3, -1, 'lion'], [-2, 2, 'bones'], [2, 2, 'bones']],
      [[0, 0, 'longtable'], [-3, 2, 'chair'], [3, 2, 'chair'], [0, -2, 'ice-crystal']],
      [[0, -1, 'statue'], [-2, 1, 'ice-crystal'], [2, 1, 'ice-crystal']],
    ],
    bits: ['bones', 'skulls', 'rubble', 'candles'],
    carpet: '#2a3a6a',
    nave: { column: 'ice-column', runner: '#2a3a6a' },
    backdrop: 'hallow-throne',
  },
  // under the Crown City: the old royal dead, and who hides among them
  'crown-catacombs': {
    wall: ['sarcophagus', 'banner-blue', 'candles', 'sarcophagus', 'cage'],
    side: ['coffin', 'sarcophagus', 'broken-column'],
    corner: 'iron-torch',
    pillar: 'column',
    core: [
      [[-2, 0, 'sarcophagus'], [2, 0, 'sarcophagus'], [0, 2, 'candles']],
      [[0, 0, 'altar'], [-2, 1, 'candles'], [2, 1, 'candles']],
    ],
    bits: ['bones', 'skulls', 'candles', 'rubble'],
    nave: { column: 'tall-column' },
  },
};

const OPENINGS = new Set(['D', '.', 'Z', '%']);
const SOLID_TERRAIN = new Set(['#', 'j', 'Q', '~', '|']);

function shape(def: RegionDef, source: readonly string[], given: readonly PlacedMarkerDef[], dress: Dress): { map: string[]; placed: PlacedMarkerDef[] } {
  const H = source.length;
  const W = source[0]!.length;
  const g = source.map((r) => [...r.padEnd(W, '#')]);
  const at = (x: number, y: number): string => g[y]?.[x] ?? '#';
  const legend = def.markers as Record<string, Marker | undefined>;
  const floors = new Set(def.encounters.map((e) => e.floor));
  const label: string[][] = g.map((r) => r.map((c) => (floors.has(c) ? c : '')));
  const ADJ = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  // what stands on a room's floor (a marker, a pillar, a pool) is part of the room
  for (let pass = 0; pass < 4; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = at(x, y);
        if (label[y]![x] || c === '#' || OPENINGS.has(c)) continue;
        for (const [dx, dy] of ADJ) {
          const l = label[y + dy]?.[x + dx];
          if (l) {
            label[y]![x] = l;
            break;
          }
        }
      }
    }
  }
  const placed: PlacedMarkerDef[] = [...given];
  const lanes = new Set<number>();
  const id = (x: number, y: number): number => y * W + x;
  const rooms = [...floors];
  rooms.forEach((L) => {
    let x0 = W;
    let x1 = 0;
    let y0 = H;
    let y1 = 0;
    let boss = false;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (label[y]![x] !== L) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        if (legend[at(x, y)]?.kind === 'boss') boss = true;
      }
    }
    if (x1 < x0 || boss) return;
    const rw = x1 - x0 + 1;
    const rh = y1 - y0 + 1;
    if (rw <= ROOM_W && rh <= ROOM_H) return;
    // the middle of the room as it was drawn (its pillars and pools where they were), corners cut
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const hw = Math.min(rw, ROOM_W) / 2;
    const hh = Math.min(rh, ROOM_H) / 2;
    let keep = new Set<number>();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (label[y]![x] !== L || SOLID_TERRAIN.has(at(x, y))) continue;
        const ex = hw - Math.abs(x - cx);
        const ey = hh - Math.abs(y - cy);
        if (ex > 0 && ey > 0 && ex + ey > 2) keep.add(id(x, y));
      }
    }
    // no slivers, and one floor: what a crop leaves one tile wide goes, and so does anything cut off from the most of it
    for (let pass = 0; pass < 2; pass++) {
      const thin = [...keep].filter((i) => ADJ.filter(([dx, dy]) => keep.has(id((i % W) + dx, Math.floor(i / W) + dy))).length < 2);
      for (const i of thin) keep.delete(i);
    }
    let main = new Set<number>();
    const seen = new Set<number>();
    for (const i of keep) {
      if (seen.has(i)) continue;
      const part = new Set<number>([i]);
      const q = [i];
      seen.add(i);
      while (q.length) {
        const c = q.pop()!;
        for (const [dx, dy] of ADJ) {
          const n = id((c % W) + dx, Math.floor(c / W) + dy);
          if (keep.has(n) && !seen.has(n)) {
            seen.add(n);
            part.add(n);
            q.push(n);
          }
        }
      }
      if (part.size > main.size) main = part;
    }
    keep = main;
    if (!keep.size) return;
    // (what stood on it stays: its floor only ever came from the room's own)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (label[y]![x] !== L || !SOLID_TERRAIN.has(at(x, y))) continue;
        const ex = hw - Math.abs(x - cx);
        const ey = hh - Math.abs(y - cy);
        if (ex > 0 && ey > 0 && ADJ.some(([dx, dy]) => keep.has(id(x + dx, y + dy)))) keep.add(id(x, y));
      }
    }
    /** Something solid stands here: no way through. */
    const stands = (x: number, y: number): boolean => {
      const c = at(x, y);
      const m = legend[c];
      return SOLID_TERRAIN.has(c) || (m?.kind === 'prop' && m.solid === true);
    };
    // the doors keep their way in: a passage as wide as the door, straight to what is left of the floor
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (label[y]![x] !== L) continue;
        const m = legend[at(x, y)];
        for (const [dx, dy] of ADJ) {
          const n = at(x + dx, y + dy);
          const isWay = OPENINGS.has(n) || legend[n]?.kind === 'exit' || m?.kind === 'exit';
          if (!isWay || label[y + dy]?.[x + dx] === L) continue;
          // straight in, turning only if the door was off to one side of what is left: the shortest way across
          // the old floor from here to the new, preferring to go straight on
          const from = new Map<number, number>([[id(x, y), -1]]);
          const queue: [number, number][] = [[x, y]];
          let reached = -1;
          for (let head = 0; head < queue.length && reached < 0; head++) {
            const [qx, qy] = queue[head]!;
            if (keep.has(id(qx, qy)) && !stands(qx, qy)) {
              reached = id(qx, qy);
              break;
            }
            for (const [ax, ay] of [[-dx, -dy], ...ADJ] as const) {
              const nx = qx + ax;
              const ny = qy + ay;
              if (label[ny]?.[nx] !== L || from.has(id(nx, ny)) || stands(nx, ny)) continue;
              from.set(id(nx, ny), id(qx, qy));
              queue.push([nx, ny]);
            }
          }
          for (let at2 = reached; at2 >= 0; at2 = from.get(at2) ?? -1) if (!keep.has(at2)) lanes.add(at2);
        }
      }
    }
    // the floor comes in; what was on the part that goes moves in with it, unless it was only dressing
    const moving: string[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (label[y]![x] !== L || keep.has(id(x, y)) || lanes.has(id(x, y))) continue;
        const c = at(x, y);
        const m = legend[c];
        if (m && m.kind !== 'prop') moving.push(c);
        g[y]![x] = '#';
        label[y]![x] = '';
      }
    }
    for (const c of moving) {
      let best: [number, number] | null = null;
      let far = Infinity;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (at(x, y) !== L) continue;
          const d = Math.hypot(x - cx, y - cy) + hash2(x, y, 3);
          if (d < far) {
            far = d;
            best = [x, y];
          }
        }
      }
      if (best) g[best[1]]![best[0]] = c;
    }
  });

  /* ---------------------------------------------------------------- the dressing */

  const taken = new Set<number>(given.map((p) => id(p.tx, p.ty)));
  const clearOf = (x: number, y: number): boolean => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const c = at(x + dx, y + dy);
        if (c === 'D' || c === 'Z' || lanes.has(id(x + dx, y + dy)) || legend[c]?.kind === 'exit') return false;
      }
    }
    return true;
  };
  // what can't be walked through: solid dressing keeps two clear tiles from all of it, so nobody is ever boxed in
  const hard = new Set<number>(given.filter((p) => p.marker.kind === 'prop' && p.marker.solid).map((p) => id(p.tx, p.ty)));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = at(x, y);
      const m = legend[c];
      if ((c !== '#' && SOLID_TERRAIN.has(c)) || (m?.kind === 'prop' && m.solid === true)) hard.add(id(x, y));
    }
  }
  const crowded = (x: number, y: number, room: number): boolean => {
    for (let dy = -room; dy <= room; dy++) for (let dx = -room; dx <= room; dx++) if (hard.has(id(x + dx, y + dy))) return true;
    return false;
  };
  const put = (x: number, y: number, prop: string, solid: boolean, room = 2): boolean => {
    const i = id(x, y);
    if (taken.has(i) || lanes.has(i)) return false;
    const c = at(x, y);
    if (!floors.has(c) && c !== '.') return false;
    if (solid) {
      if (crowded(x, y, room)) return false;
      hard.add(i);
    }
    taken.add(i);
    placed.push({ tx: x, ty: y, marker: { kind: 'prop', prop, solid } });
    return true;
  };
  const solidOf = (name: string, boss: boolean): boolean => !boss && !SOFT.has(name) && name !== 'lantern';

  rooms.forEach((L, index) => {
    const cells: [number, number][] = [];
    let x0 = W;
    let x1 = 0;
    let y0 = H;
    let y1 = 0;
    let boss = false;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (label[y]![x] !== L) continue;
        if (legend[at(x, y)]?.kind === 'boss') boss = true;
        if (at(x, y) !== L) continue;
        cells.push([x, y]);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    if (!cells.length) return;
    const rw = x1 - x0 + 1;
    const rh = y1 - y0 + 1;
    const cx = Math.round((x0 + x1) / 2);
    const cy = Math.round((y0 + y1) / 2);
    const seed = index * 17 + 3;
    // what stands behind the boss's wall, rising out of the dark over it, and the way up to it: only where nothing but
    // rock lies behind that wall (a dungeon with a boss in more than one room may have another room or a passage up
    // there, and a thing that tall in it would stand in front of whoever fights in it)
    const rockBehind = (): boolean => {
      // (from two rows behind the wall, where it rises: a nook between the wall and it is in front of it, not hidden)
      for (let y = y0 - 13; y <= y0 - 3; y++) {
        for (let x = cx - 7; x <= cx + 7; x++) if (y >= 0 && x >= 0 && x < W && !SOLID_TERRAIN.has(at(x, y))) return false;
      }
      return true;
    };
    if (boss && dress.backdrop && rockBehind()) placed.push({ tx: cx, ty: y0 - 1, marker: { kind: 'prop', prop: `great:${dress.backdrop}` } });
    // (a carpet lies under whatever stands on it, so it has no gaps)
    if (boss && dress.carpet) for (let y = y0; y <= y1; y++) if (label[y]![cx] === L && !SOLID_TERRAIN.has(at(cx, y))) placed.push({ tx: cx, ty: y, marker: { kind: 'prop', prop: `runner:${dress.carpet}`, solid: false } });
    // fires down both sides of a boss's chamber (nothing in it stops anyone: its fight is measured to the room)
    if (boss && rw >= 14) {
      for (let y = y0 + 2; y <= y1 - 1; y += 4) {
        for (const x of [x0 + 2, x1 - 2]) if (clearOf(x, y)) put(x, y, dress.corner, false);
      }
    }
    // a pool let into the floor, with room to walk all the way round it
    if (!boss && dress.pools && index % dress.pools === 0 && rw >= 9 && rh >= 8) {
      const px = Math.max(2, Math.floor(rw / 4));
      const py = Math.max(1, Math.floor(rh / 5));
      const walkable = (x: number, y: number): boolean => at(x, y) === L && !taken.has(id(x, y)) && !hard.has(id(x, y));
      let room = true;
      for (let y = cy - py - 2; y <= cy + py + 2 && room; y++) for (let x = cx - px - 2; x <= cx + px + 2 && room; x++) if (!walkable(x, y) && !lanes.has(id(x, y))) room = false;
      for (let y = cy - py; y <= cy + py && room; y++) for (let x = cx - px; x <= cx + px && room; x++) if (lanes.has(id(x, y))) room = false;
      if (room) {
        for (let y = cy - py; y <= cy + py; y++) {
          for (let x = cx - px; x <= cx + px; x++) {
            // (its corners rounded off: a pool, not a tank)
            if ((x === cx - px || x === cx + px) && (y === cy - py || y === cy + py)) continue;
            g[y]![x] = '~';
            hard.add(id(x, y));
          }
        }
      }
    }
    // a nave: tall columns in two rows the length of a great room, a carpet down the middle
    const great = !boss && rw >= 12 && rh >= 8;
    if (great && dress.nave) {
      const ay = Math.floor(rh / 2) - 2;
      for (let x = x0 + 2; x <= x1 - 2; x += 3) {
        for (const py of [cy - ay, cy + ay]) if (clearOf(x, py)) put(x, py, dress.nave.column, true, 1);
      }
      if (dress.nave.runner) for (let x = x0 + 1; x <= x1 - 1; x++) put(x, cy, `runner:${dress.nave.runner}`, false);
    }
    // what the room is for, at its middle
    if (!boss && rw >= 8 && rh >= 6 && dress.core.length) {
      for (const [dx, dy, prop] of dress.core[index % dress.core.length]!) {
        const px = cx + dx;
        const py = cy + dy;
        if (clearOf(px, py)) put(px, py, prop, solidOf(prop, false), 1);
      }
    }
    // columns in pairs, standing out from the walls of a room big enough to have aisles
    if (dress.pillar && !boss && rw >= 11 && rh >= 8 && !(great && dress.nave)) {
      const ax = Math.floor(rw / 2) - 3;
      const ay = Math.floor(rh / 2) - 2;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const px = cx + sx * ax;
          const py = cy + sy * ay;
          if (clearOf(px, py)) put(px, py, dress.pillar, true);
        }
      }
    }
    // along the north wall, at a steady step: what a wall in this place has against it
    let next = x0 + 1 + (seed % 2);
    let n = seed;
    for (const [x, y] of [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
      if (x < next || at(x, y - 1) !== '#' || !clearOf(x, y)) continue;
      const prop = dress.wall[n++ % dress.wall.length]!;
      if (put(x, y, prop, solidOf(prop, boss))) next = x + 3 + Math.floor(hash2(x, y, seed) * 2);
    }
    // along the sides, sparer; never crowding a corner
    for (const [x, y] of cells) {
      const west = at(x - 1, y) === '#';
      const east = at(x + 1, y) === '#';
      if ((!west && !east) || at(x, y - 1) === '#' || at(x, y + 1) === '#' || !clearOf(x, y) || (y - y0) % 4 !== 1) continue;
      const prop = dress.side[(y + (west ? 0 : 1) + seed) % dress.side.length]!;
      put(x, y, prop, solidOf(prop, boss));
    }
    // a fire in each far corner
    for (const [x, y] of cells) {
      if (at(x, y - 1) === '#' && (at(x - 1, y) === '#' || at(x + 1, y) === '#') && clearOf(x, y)) put(x, y, dress.corner, solidOf(dress.corner, boss));
    }
    // small things underfoot, drifting along the walls more than the middle
    const want = Math.round(cells.length / 17);
    let done = 0;
    for (let k = 0; k < cells.length * 2 && done < want; k++) {
      const [x, y] = cells[Math.floor(hash2(k, seed, 7) * cells.length)]!;
      const edge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
      if (edge > 2 && hash2(x, y, seed + 1) > 0.25) continue;
      if (put(x, y, dress.bits[(k + seed) % dress.bits.length]!, false)) done++;
    }
  });

  // the way in is lit and dressed a little too, and everything stays reachable
  const start = g.flatMap((r, y) => r.map((c, x) => ({ c, x, y }))).find(({ c }) => legend[c]?.kind === 'start');
  const wanted: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if ((legend[c] && legend[c]!.kind !== 'prop') || c === 'D' || c === 'Z') wanted.push([x, y]);
    }
  }
  if (start) {
    const blocks = (x: number, y: number, solid: Set<number>): boolean => {
      const c = at(x, y);
      return SOLID_TERRAIN.has(c) || legend[c]?.kind === 'prop' && (legend[c] as Extract<Marker, { kind: 'prop' }>).solid === true || solid.has(id(x, y));
    };
    const reaches = (solid: Set<number>): boolean => {
      const seen = new Uint8Array(W * H);
      const q = [[start.x, start.y]] as [number, number][];
      seen[id(start.x, start.y)] = 1;
      while (q.length) {
        const [x, y] = q.pop()!;
        for (const [dx, dy] of ADJ) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[id(nx, ny)] || blocks(nx, ny, solid)) continue;
          seen[id(nx, ny)] = 1;
          q.push([nx, ny]);
        }
      }
      return wanted.every(([x, y]) => seen[id(x, y)] || ADJ.some(([dx, dy]) => seen[id(x + dx, y + dy)]));
    };
    const solidOfPlaced = (): Set<number> => new Set(placed.filter((p) => p.marker.kind === 'prop' && p.marker.solid).map((p) => id(p.tx, p.ty)));
    // (dressing never closes a way: last laid, first lifted, until every door and chest can be walked to)
    let guard = 0;
    while (!reaches(solidOfPlaced()) && guard++ < 400) {
      for (let i = placed.length - 1; i >= given.length; i--) {
        const p = placed[i]!;
        if (p.marker.kind === 'prop' && p.marker.solid) {
          placed.splice(i, 1);
          break;
        }
      }
    }
  }
  return { map: g.map((r) => r.join('')), placed };
}

/** Gives a dungeon its tight rooms and its dressing, the first time something looks at its map. */
export function shapeDungeon(def: RegionDef): void {
  const dress = DRESS[def.id];
  if (!dress) return;
  const source = def.map;
  const given = def.placed ?? [];
  let made: ReturnType<typeof shape> | null = null;
  const get = (): ReturnType<typeof shape> => (made ??= shape(def, source, given, dress));
  Object.defineProperty(def, 'map', { get: () => get().map, enumerable: true, configurable: true });
  Object.defineProperty(def, 'placed', { get: () => get().placed, enumerable: true, configurable: true });
}
