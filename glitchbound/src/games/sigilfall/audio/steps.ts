import type { Theme } from '../data/types';
import { K, TILE, tileAt } from '../sim/map';
import type { World } from '../sim/world';

/**
 * Footsteps (POLISH_PLAN.md piece 25): the hero's feet heard on what they walk on, a step every stride. Only a sound: the
 * rules never hear it.
 */
export type Ground = 'grass' | 'stone' | 'wood' | 'snow' | 'sand';

/** The lands whose open ground is snow, sand, or stone underfoot (a dungeon's floors, a citadel's flags). */
const SNOW: ReadonlySet<Theme> = new Set<Theme>(['snow', 'peaks', 'icecave']);
const SAND: ReadonlySet<Theme> = new Set<Theme>(['desert', 'coast']);
const STONE: ReadonlySet<Theme> = new Set<Theme>(['crypt', 'cave', 'keep', 'temple', 'lavacave', 'citadel', 'cistern', 'riftspire', 'greathall', 'volcanic', 'mountain']);
const PLANKS: ReadonlySet<Theme> = new Set<Theme>(['tavern']);

/** What the hero stands on: the tile under them first (a road's cobbles, a bridge's planks), then the land's own ground. */
export function groundAt(w: World, x: number, y: number): Ground | null {
  const i = tileAt(w.map, x, y);
  if (i < 0) return null;
  const kind = w.map.kind[i];
  const theme = w.region.theme;
  if (kind === K.Water) return null;
  if (kind === K.Bridge || kind === K.Door || PLANKS.has(theme)) return 'wood';
  if (kind === K.Cobble || kind === K.Rampart || STONE.has(theme)) return 'stone';
  if (kind === K.Sand || SAND.has(theme)) return 'sand';
  if (SNOW.has(theme)) return 'snow';
  return 'grass';
}

/** The sound a step makes on each ground (audio/samples.ts). */
export const STEP_SOUND: Readonly<Record<Ground, string>> = { grass: 'stepGrass', stone: 'stepStone', wood: 'stepWood', snow: 'stepSnow', sand: 'stepSand' };

/** How far the hero goes between two steps (world px): about a tile, as a walk is drawn. */
export const STRIDE = TILE * 1.05;

/**
 * Counts the hero's way across the ground and says when a foot comes down: the sound to play, or null. Not riding (the
 * horse is heard otherwise), not in the air of a dodge, not in a scene, not down.
 */
export class Steps {
  private x = NaN;
  private y = NaN;
  private gone = 0;
  private world: World | null = null;

  step(w: World): string | null {
    const p = w.player;
    if (w !== this.world || !Number.isFinite(this.x)) {
      this.world = w;
      this.x = p.x;
      this.y = p.y;
      this.gone = 0;
      return null;
    }
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    this.x = p.x;
    this.y = p.y;
    // (a jump across the land, a cut or a door, is not a step)
    if (d > TILE * 2 || p.dead || p.riding || p.dash || w.scene) {
      this.gone = 0;
      return null;
    }
    this.gone += d;
    // (a hair under a stride, as sums of small steps come out, is a stride)
    if (this.gone + 1e-6 < STRIDE) return null;
    this.gone -= STRIDE;
    const ground = groundAt(w, p.x, p.y);
    return ground ? STEP_SOUND[ground] : null;
  }
}
