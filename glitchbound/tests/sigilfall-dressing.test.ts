/**
 * What stands in each land belongs there and is the right size beside a person (the owner, looking at Emberdeep and
 * Hollowmere: "there's flowers on the lava land", "the church is too small compared to the npcs and the boat is
 * huge", "the statues are also stacked", "check how small the towers are", "random water bowls spread around").
 * These hold for every land the story goes through:
 * - a land of ash, bone, snow or drowned stone has no flowerbeds, planters or hay: what a rule sets down there is
 *   set down as that land would have it (data/props.ts dressedFor);
 * - a building's model has ground enough to stand at its size: a house three tiles across, a tower two, a chapel
 *   four, where its lot is that wide (data/buildingArt.ts);
 * - there is one statue to a square and one banner to a spot: nothing of a one-of-a-kind sort stands beside another;
 * - a basket of fish is not a tub of water, and Emberdeep's keep can be walked to over its bridge;
 * - nothing that grew shut anyone in, and nothing is set down where a wall hides it.
 */
import { describe, expect, it } from 'vitest';
import { MODEL_FOOT, modelOnLot } from '../src/games/sigilfall/data/buildingArt';
import { DOOR_BLOCKS } from '../src/games/sigilfall/data/greatworks';
import { barrenThemes, dressedFor, keepsApart, PROPS } from '../src/games/sigilfall/data/props';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { isRetired } from '../src/games/sigilfall/data/retired';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { builtProp } from '../src/games/sigilfall/render3d/propsBuilt';
import { spawnFolk } from '../src/games/sigilfall/sim/folk';
import { circleHitsWall, K, parseRegion, TILE, type TileMap } from '../src/games/sigilfall/sim/map';

const LANDS = (Object.keys(REGIONS) as RegionId[]).filter((id) => !isRetired(id) && REGIONS[id].kind !== 'dungeon' && !REGIONS[id].interior);
const WILDS = LANDS.filter((id) => REGIONS[id].kind === 'wild');
const maps = new Map<RegionId, TileMap>();
const mapOf = (id: RegionId): TileMap => {
  let m = maps.get(id);
  if (!m) maps.set(id, (m = parseRegion(REGIONS[id])));
  return m;
};
const base = (prop: string): string => prop.split(':')[0]!;

/** The least ground each kind of building stands on, in tiles across (as much of it as its lot has). */
const LEAST: Record<string, number> = { house: 3, shop: 4, smithy: 4, hall: 5, temple: 4, tavern: 5, inn: 5, tower: 2 };

describe('Sigilfall: what stands in each land', () => {
  it('sets nothing green down on ash, bone, snow or drowned stone', () => {
    const barren = new Set<string>(barrenThemes());
    let lands = 0;
    for (const id of WILDS) {
      const def = REGIONS[id];
      if (!barren.has(def.theme)) continue;
      lands++;
      const m = mapOf(id);
      const props = [...m.markers.flatMap((pm) => (pm.marker.kind === 'prop' ? [pm.marker.prop] : [])), ...m.buildings.flatMap((b) => b.yard.map((y) => y.prop))];
      for (const prop of props) expect(dressedFor(def.theme, prop), `${id}: ${prop}`).toBe(prop);
      for (const name of ['flowers', 'planter', 'flowerbed', 'hay']) expect(props.map(base), `${id}: ${name}`).not.toContain(name);
    }
    // Emberdeep, Hollowmere, the Pale Reach, Rimeheld, Highwall, the barrows and the rest
    expect(lands).toBeGreaterThanOrEqual(8);
    // and a green land keeps its flowers
    expect(dressedFor('farm', 'flowerbed')).toBe('flowerbed');
    expect(dressedFor('volcanic', 'flowers:#ff0000')).toBe('skulls');
  });

  it('gives every building ground enough for its model to stand at its size', () => {
    let seen = 0;
    for (const id of LANDS) {
      const m = mapOf(id);
      for (const b of m.buildings) {
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        for (let y = b.lot.ty; y < b.lot.ty + b.lot.h; y++) {
          for (let x = b.lot.tx; x < b.lot.tx + b.lot.w; x++) {
            if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.kind[y * m.w + x] !== K.House) continue;
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x + 1);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y + 1);
          }
        }
        const what = `${id}: ${b.name ?? b.style} at ${b.lot.tx},${b.lot.ty}`;
        expect(x1, what).toBeGreaterThan(x0);
        const least = Math.min(b.lot.w, b.style === 'tower' && b.lot.w >= 4 ? 3 : (LEAST[b.style] ?? 0));
        expect(x1 - x0, `${what}: ground across`).toBeGreaterThanOrEqual(least);
        // and what stands on it is no toy: at least two tiles across, a person and a half
        const stands = modelOnLot(b.style, b.lot, b.pics[0]?.grim === true, x0, x1, y0, y1, b.door?.[0] ?? null)!;
        const foot = MODEL_FOOT[stands.m]!;
        expect((foot[2] - foot[0]) * stands.sx, `${what}: ${stands.m} across`).toBeGreaterThanOrEqual(2);
        // (the wooden watchtower is as wide as it's tall: never on ground too narrow for it to rise over a guard)
        if (stands.m === 'b_watchtower') expect(x1 - x0, what).toBeGreaterThanOrEqual(3);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(200);
  });

  it('never sets two of a one-of-a-kind thing side by side', () => {
    for (const id of WILDS) {
      const m = mapOf(id);
      const placed = (REGIONS[id].placed ?? []).filter((p) => p.marker.kind === 'prop' && !p.when).map((p) => ({ name: base((p.marker as { prop: string }).prop), tx: p.tx, ty: p.ty }));
      for (let i = 0; i < placed.length; i++) {
        const a = placed[i]!;
        const reach = keepsApart(a.name);
        if (!reach) continue;
        for (let j = i + 1; j < placed.length; j++) {
          const b = placed[j]!;
          if (b.name !== a.name) continue;
          expect(Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty)), `${id}: ${a.name} at ${a.tx},${a.ty} and ${b.tx},${b.ty}`).toBeGreaterThan(reach);
        }
      }
      // a building's own yard: no two of a kind shoulder to shoulder, none beside the town's own
      for (const b of m.buildings) {
        for (const y of b.yard) {
          const twin = b.yard.find((o) => o !== y && o.prop === y.prop && Math.abs(o.tx - y.tx) <= 1 && Math.abs(o.ty - y.ty) <= 1);
          expect(twin, `${id}: two ${y.prop} in one yard at ${y.tx},${y.ty}`).toBeUndefined();
          const reach = keepsApart(y.prop);
          if (!reach) continue;
          const near = placed.find((p) => p.name === base(y.prop) && Math.max(Math.abs(p.tx - y.tx), Math.abs(p.ty - y.ty)) <= reach);
          expect(near, `${id}: a yard's ${y.prop} at ${y.tx},${y.ty} beside the town's`).toBeUndefined();
        }
      }
    }
  });

  it('keeps a great dark keep clear of yard things, which its model would stand on', () => {
    let keeps = 0;
    for (const id of LANDS) {
      for (const b of mapOf(id).buildings) {
        if (b.style !== 'keep' || !b.pics[0]?.grim) continue;
        keeps++;
        expect(b.yard, `${id}: ${b.name ?? 'keep'}`).toHaveLength(0);
      }
    }
    expect(keeps).toBeGreaterThanOrEqual(1);
  });

  it('draws a basket of fish as a basket of fish, and a wreck no bigger than a boat', () => {
    expect(PROPS.fish!.m).not.toBe(PROPS.trough!.m);
    expect(builtProp(PROPS.fish!.m!)).not.toBeNull();
    // (Hollowmere's wreck: once two hundred pixels of hull beside a chapel two tiles wide)
    expect(PROPS['great-wreck']!.w!).toBeLessThanOrEqual(5 * TILE);
    // a village green's tree is big, not the wood's giant
    expect(PROPS['green-oak']!.w!).toBeLessThan(PROPS['ancient-oak']!.w! * 0.75);
  });

  /** Everywhere a hero's width can get to from where the land is entered, on a grid fine enough for the lanes of a camp. */
  const STEP = 4;
  function walked(m: TileMap): (tx: number, ty: number, within?: number) => boolean {
    const W = Math.floor((m.w * TILE) / STEP);
    const H = Math.floor((m.h * TILE) / STEP);
    const seen = new Uint8Array(W * H);
    const open = (i: number, j: number): boolean => !circleHitsWall(m, i * STEP, j * STEP, 6);
    const start = m.markers.find((pm) => pm.marker.kind === 'start')!;
    const si = Math.round(((start.tx + 0.5) * TILE) / STEP);
    let sj = Math.round(((start.ty + 0.5) * TILE) / STEP);
    for (let r = 0; r < 12 && !open(si, sj); r++) sj++;
    const queue: number[] = [sj * W + si];
    seen[sj * W + si] = 1;
    while (queue.length) {
      const at = queue.pop()!;
      const i = at % W;
      const j = Math.floor(at / W);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= W || b >= H || seen[b * W + a] || !open(a, b)) continue;
        seen[b * W + a] = 1;
        queue.push(b * W + a);
      }
    }
    return (tx, ty, within = 0) => {
      const r = Math.ceil((within * TILE) / STEP);
      const ci = Math.round(((tx + 0.5) * TILE) / STEP);
      const cj = Math.round(((ty + 0.5) * TILE) / STEP);
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) if (i >= 0 && j >= 0 && i < W && j < H && seen[j * W + i]) return true;
      return false;
    };
  }

  it("lets a hero walk to Emberdeep's keep over its bridge", () => {
    const m = mapOf('emberdeep');
    const keep = m.buildings.find((b) => b.style === 'keep')!;
    const reach = walked(m);
    // the ground before its doors, across the lot's front
    let reached = 0;
    for (let x = keep.lot.tx; x < keep.lot.tx + keep.lot.w; x++) if (reach(x, keep.lot.ty + keep.lot.h)) reached++;
    expect(reached).toBeGreaterThanOrEqual(4);
  });

  it('leaves every pack, person, chest and waystone of every land where a hero can walk to it', { timeout: 120_000 }, () => {
    // (a camp's lookout grown wider, a house grown to its lot: nothing that was made bigger shut anyone in)
    let seen = 0;
    for (const id of WILDS) {
      const m = mapOf(id);
      const reach = walked(m);
      for (const pm of m.markers) {
        const k = pm.marker.kind;
        if (k !== 'pack' && k !== 'npc' && k !== 'chest' && k !== 'waystone' && k !== 'boss') continue;
        seen++;
        expect(reach(pm.tx, pm.ty, 1.5), `${id}: ${k} at ${pm.tx},${pm.ty}`).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(500);
  });

  it('sets nothing down where a wall or a house hides it from the camera', () => {
    const RISE = Math.tan((50 * Math.PI) / 180);
    let props = 0;
    for (const id of LANDS) {
      const m = mapOf(id);
      const tall = (i: number): number => (m.kind[i] === K.Wall || m.kind[i] === K.Rampart ? 3.3 : m.kind[i] === K.House ? 3.6 : 0);
      for (const pm of m.markers) {
        if (pm.marker.kind !== 'prop' || pm.when) continue;
        const def = PROPS[base(pm.marker.prop)];
        if (!def || !def.m || def.flat || (def.h ?? 0) > 2.2 * TILE) continue;
        props++;
        const up = (def.h ?? 12) / TILE / 2;
        const south = pm.ty + 1;
        if (south >= m.h) continue;
        // (right behind it: the tile to its south stands taller than the line of sight to its middle)
        expect(tall(south * m.w + pm.tx) > up + 1.5 * RISE, `${id}: ${pm.marker.prop} at ${pm.tx},${pm.ty} behind a wall`).toBe(false);
      }
    }
    expect(props).toBeGreaterThan(1200);
    // nor does a pack wait right behind one (a bone catapult behind a ruin's wall, only its arm showing)
    let packs = 0;
    for (const id of WILDS) {
      const m = mapOf(id);
      const wall = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < m.w && y < m.h && (m.kind[y * m.w + x] === K.Rampart || m.kind[y * m.w + x] === K.House);
      for (const pm of m.markers) {
        if (pm.marker.kind !== 'pack') continue;
        packs++;
        // (it stands about its marker, a tile either way: none of that ground has a built wall within three tiles south of it)
        for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const d of [1, 2, 3]) expect(wall(pm.tx + dx, pm.ty + dy + d) && !wall(pm.tx + dx, pm.ty + dy), `${id}: a pack at ${pm.tx},${pm.ty} behind a wall`).toBe(false);
      }
    }
    expect(packs).toBeGreaterThan(300);
  });

  it('garrisons a war camp: guards at their posts, catapults at its sides, a few standards and no field of them', () => {
    for (const id of ['highwall', 'pale-reach'] as const) {
      const m = mapOf(id);
      const props = m.markers.flatMap((pm) => (pm.marker.kind === 'prop' && !pm.when ? [base(pm.marker.prop)] : []));
      const count = (name: string): number => props.filter((p) => p === name).length;
      expect(count('guard-post'), `${id}: guard posts`).toBeGreaterThanOrEqual(8);
      expect(count('catapult'), `${id}: catapults`).toBeGreaterThanOrEqual(2);
      expect(count('armory'), `${id}: armories`).toBeGreaterThanOrEqual(1);
      expect(count('red-banner') + count('blue-banner') + count('flag'), `${id}: standards`).toBeLessThanOrEqual(4);
      // the story raises three more at most, whatever the hero did
      const story = (REGIONS[id].placed ?? []).filter((p) => p.when && p.marker.kind === 'prop' && ['red-banner', 'blue-banner', 'flag'].includes(base(p.marker.prop)));
      expect(story.length, `${id}: the story's standards`).toBeLessThanOrEqual(6);
      // and the guards are there: soldiers who stand, and soldiers who walk the lanes
      const squares = m.markers.filter((pm) => pm.marker.kind === 'waystone').map((pm) => ({ x: (pm.tx + 0.5) * TILE, y: (pm.ty + 0.5) * TILE }));
      const { folk } = spawnFolk(m, 7, false, squares);
      expect(folk.filter((f) => f.posted).length, `${id}: guards`).toBeGreaterThanOrEqual(8);
      expect(folk.filter((f) => f.soldier && !f.posted).length, `${id}: soldiers about`).toBeGreaterThanOrEqual(3);
      for (const f of folk.filter((x) => x.posted)) expect(circleHitsWall(m, f.x, f.y, 5), `${id}: a guard in a wall at ${Math.floor(f.x / TILE)},${Math.floor(f.y / TILE)}`).toBe(false);
    }
    // a village has no soldiers
    const village = mapOf('thornvale');
    expect(spawnFolk(village, 7, false, village.markers.filter((pm) => pm.marker.kind === 'waystone').map((pm) => ({ x: (pm.tx + 0.5) * TILE, y: (pm.ty + 0.5) * TILE }))).folk.some((f) => f.soldier)).toBe(false);
  });

  it("leaves nothing standing inside a built gate's stone, and trees back from a chapel", () => {
    // (a road's lamp stood inside Duskspire's arch)
    for (const [land, door] of Object.entries(DOOR_BLOCKS)) {
      const m = mapOf(land as RegionId);
      const at = m.markers.find((pm) => pm.marker.kind === 'exit' && pm.marker.to === door.to)!;
      for (const pm of m.markers) {
        if (pm.marker.kind !== 'prop' || pm.marker.prop === 'block' || pm.marker.prop.startsWith('great')) continue;
        const inside = door.rects.some(([x0, y0, x1, y1]) => pm.tx - at.tx >= x0 && pm.tx - at.tx <= x1 && pm.ty - at.ty >= y0 && pm.ty - at.ty <= y1);
        expect(inside, `${land}: ${pm.marker.prop} inside the gate to ${door.to}`).toBe(false);
      }
    }
    // (the owner, of the Knights' Chapel: "still colliding with the trees"; and of the clearing that followed, cut far
    // back along a ruled line: "this is horrendous", "it has to be natural")
    let chapels = 0;
    let cleared = 0;
    let wooded = 0;
    for (const id of WILDS) {
      const m = mapOf(id);
      for (const b of m.buildings) {
        if (b.style !== 'temple') continue;
        chapels++;
        // nothing growing right against it: a tile to each side, two behind and before
        for (let y = b.lot.ty - 2; y < b.lot.ty + b.lot.h + 2; y++) {
          for (let x = b.lot.tx - 1; x < b.lot.tx + b.lot.w + 1; x++) {
            if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
            expect(m.kind[y * m.w + x] === K.Tree, `${id}: a tree at ${x},${y} against the chapel at ${b.lot.tx},${b.lot.ty}`).toBe(false);
            if (x >= 4 && y >= 4 && x < m.w - 4 && y < m.h - 4 && y < b.lot.ty + b.lot.h) expect(m.kind[y * m.w + x] === K.Wall, `${id}: deep wood at ${x},${y} against the chapel at ${b.lot.tx},${b.lot.ty}`).toBe(false);
          }
        }
        // and the wood is still there round it: ten tiles out, a chapel that stood in a wood stands in one
        for (let y = b.lot.ty - 12; y < b.lot.ty + b.lot.h + 12; y++) {
          for (let x = b.lot.tx - 12; x < b.lot.tx + b.lot.w + 12; x++) {
            if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
            const far = x < b.lot.tx - 9 || x >= b.lot.tx + b.lot.w + 9 || y < b.lot.ty - 9 || y >= b.lot.ty + b.lot.h + 9;
            if (!far) cleared += m.kind[y * m.w + x] === K.Floor ? 1 : 0;
            else wooded += m.kind[y * m.w + x] === K.Tree || m.kind[y * m.w + x] === K.Wall ? 1 : 0;
          }
        }
      }
    }
    expect(wooded).toBeGreaterThan(200);
    expect(cleared).toBeGreaterThan(200);
    // and no more of the deep wood than touches it: the Knights' Chapel stands hard against Highwall's eastern wood,
    // one open tile at its flank and the trees right behind that (two and three tiles of it taken left a bare strip
    // "free of props" where "players can venture")
    const hw = mapOf('highwall');
    const knights = hw.buildings.find((b) => b.style === 'temple' && b.lot.tx > 100)!;
    for (let y = knights.lot.ty; y < knights.lot.ty + knights.lot.h; y++) {
      expect(hw.solid[y * hw.w + knights.lot.tx + knights.lot.w], `open at its flank, row ${y}`).toBe(0);
      expect(hw.kind[y * hw.w + knights.lot.tx + knights.lot.w + 1], `wood behind that, row ${y}`).toBe(K.Wall);
    }
    expect(chapels).toBeGreaterThanOrEqual(10);
  });
});
