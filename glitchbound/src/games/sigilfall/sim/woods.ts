import { hash2 } from '../core/math';
import type { ThemeLook } from '../data/themes';

/**
 * What grows on a tile of a wood, and where on it: one answer for the picture (render3d/land.ts draws it) and for the
 * rules (sim/map.ts gives it a body). A wood is drawn thin, as the art set lays its own: a tree here and there, bushes,
 * a rock, tufts of grass and the floor showing between. Its tiles used to be solid from edge to edge all the same, so a
 * hero walked into nothing a pace from a trunk (the owner: "we want the trees to have the collision and you can still
 * freely roam around"). Now the edge of a wood is walked through, and what stops a walker there is what stands there.
 */

/** A land whose walls are woods (its trees are mostly trees: not a desert's cactus, not a rift's crystal). */
export const isWoody = (look: ThemeLook): boolean => !look.indoor && !look.cliffs && look.trees.filter((t) => t !== 'cactus' && t !== 'crystal').length * 2 > look.trees.length;

export interface Grown {
  what: 'tree' | 'bush' | 'rock' | 'tuft';
  /** Where it stands, in tiles. */
  x: number;
  z: number;
  /** How wide it is drawn (the picture's own measure: a bush's and a rock's size, 0 for a tree, whose kind sizes it). */
  size: number;
  /** How wide what a walker bumps into is, in tiles (0: nothing, it is walked through). */
  body: number;
}

/** A trunk, to a walker: as wide as it is drawn, and thin enough that a route goes past it (map.ts `THIN_POST`). */
const TRUNK = 0.23;

/**
 * One tile of a wood. `edge`: open ground is beside it (a wood's edge is a little thicker, so it reads as a wood).
 * `thick`: the first tiles of the wood that can't be walked into, where every tile carries a tree or a great bush, so
 * what stops a walker is there to see.
 */
export function woodAt(tx: number, ty: number, edge: boolean, thick = false): Grown | null {
  const r = hash2(tx, ty, 61);
  const j = thick ? 0.3 : 0.6;
  const x = tx + 0.5 + (hash2(tx, ty, 63) - 0.5) * j;
  const z = ty + 0.5 + (hash2(tx, ty, 67) - 0.5) * j;
  if (thick) return r < 0.6 ? { what: 'tree', x, z, size: 0, body: TRUNK } : { what: 'bush', x, z, size: 0.8 + hash2(tx, ty, 83) * 0.2, body: 0.6 };
  const treeAt = edge ? 0.5 : 0.32;
  if (r < treeAt) return { what: 'tree', x, z, size: 0, body: TRUNK };
  // (the undergrowth of a wood is pushed through, as its tufts are: only what is hard stops a walker. With a body to
  // every bush the edge of a wood was a maze of pockets, and whoever followed a route into one stood there pushing)
  if (r < treeAt + 0.25) return { what: 'bush', x, z, size: 0.5 + hash2(tx, ty, 83) * 0.25, body: 0 };
  if (r < treeAt + 0.28) {
    const size = 0.25 + hash2(tx, ty, 85) * 0.25;
    return { what: 'rock', x, z, size, body: Math.min(TRUNK, size * 0.7) };
  }
  if (r < treeAt + 0.45) return { what: 'tuft', x, z, size: 0.3 + hash2(tx, ty, 95) * 0.15, body: 0 };
  return null;
}

/**
 * What stands on a tree tile of the open land (land.ts `placeAll` draws it with the same numbers).
 * `near`: how many of the four tiles beside a tree tile are trees or wall (a thicket is thinned to the eye: some of its
 * trees are drawn as a bush or a rock). `wide`: the land's trees are crystals or cactus, wider at the foot than a trunk.
 */
export function treeOn(tx: number, ty: number, near: number, wide: boolean): Grown {
  const h = hash2(tx, ty, 77);
  const cx = tx + 0.5;
  const cz = ty + 0.5;
  if (near >= 3 && hash2(tx, ty, 57) < 0.42) {
    const x = cx + (h - 0.5) * 0.3;
    const z = cz + (hash2(tx, ty, 31) - 0.5) * 0.3;
    if (hash2(tx, ty, 59) < 0.93) {
      const size = 0.62 + hash2(tx, ty, 83) * 0.2;
      return { what: 'bush', x, z, size, body: size * 0.62 };
    }
    const size = 0.5 + hash2(tx, ty, 85) * 0.3;
    return { what: 'rock', x, z, size, body: size * 0.7 };
  }
  return { what: 'tree', x: cx + (h - 0.5) * 0.12, z: cz + (hash2(tx, ty, 31) - 0.5) * 0.12, size: 0, body: wide ? 0.6 : TRUNK };
}
