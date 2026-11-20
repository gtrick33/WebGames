import { PROPS } from './props';
import type { PlacedMarkerDef, PropFace } from './types';

/**
 * What was set down by hand in a land with the placement editor (POLISH_PLAN.md piece 15: ui/PlaceEditor.tsx, on the
 * dev server with `?place` in the address): the set pieces placed into the generated lands, the hubs' dressing. One
 * file a land, `data/placed/<land>.json`, a list of props at tiles.
 *
 * They stand exactly where they were put. What the land generated there makes way for them, as it does for anything
 * bigger (sim/map.ts `settled`), so a generated tree or crate never stands in a hand-placed one.
 */
export interface HandPlaced {
  /** The tile, across and down. */
  tx: number;
  ty: number;
  /** A prop of data/props.ts, with a tint after a colon if it takes one ('giant-skull:#8e7a70'). */
  prop: string;
  /** Which way its front looks, when not south (toward the camera). */
  face?: PropFace;
  /** Nobody walks through it. */
  solid?: boolean;
}

const FACES: readonly string[] = ['n', 'e', 'w'];

/** Whether an entry can stand in a land: a known prop at a whole tile, its front one of the four ways. */
export function validPlaced(p: unknown): p is HandPlaced {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  const tile = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1000;
  if (!tile(o.tx) || !tile(o.ty) || typeof o.prop !== 'string') return false;
  const [name, tint] = o.prop.split(':');
  if (!name || !PROPS[name] || (tint !== undefined && !/^#[0-9a-f]{6}$/i.test(tint))) return false;
  if (o.face !== undefined && !FACES.includes(o.face as string)) return false;
  if (o.solid !== undefined && typeof o.solid !== 'boolean') return false;
  return Object.keys(o).every((k) => k === 'tx' || k === 'ty' || k === 'prop' || k === 'face' || k === 'solid');
}

// (eager: a land's map is built in one go, and the files are small)
const FILES = import.meta.glob<unknown>('./placed/*.json', { eager: true, import: 'default' });

/** Every land's hand-placed things by land id; an entry that can't stand (a prop since renamed) is left out. */
export const HAND_PLACED: Record<string, HandPlaced[]> = Object.fromEntries(
  Object.entries(FILES).map(([path, list]) => [path.replace(/^.*\/([a-z0-9-]+)\.json$/, '$1'), Array.isArray(list) ? list.filter(validPlaced) : []]),
);

// (on the dev server the editor holds the change already: a file it writes doesn't reload the game under it)
if (import.meta.hot) import.meta.hot.accept();

/** A land's hand-placed things as the markers its map stands (sim/map.ts parseRegion). */
export function handMarkers(region: string, from: Record<string, readonly HandPlaced[]> = HAND_PLACED): PlacedMarkerDef[] {
  return (from[region] ?? []).map((p) => ({ tx: p.tx, ty: p.ty, marker: { kind: 'prop', prop: p.prop, ...(p.solid ? { solid: true } : {}), ...(p.face ? { face: p.face } : {}) } }));
}
