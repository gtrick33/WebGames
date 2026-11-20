import type { PlacedMarkerDef } from './types';

/**
 * Every land's map as a file (the owner's call of 2026-11-19: every land hand-built, POLISH_PLAN.md):
 * `data/maps/<land>.json`, the land's rows (a letter a tile, as data/regions.ts reads them) and everything placed on
 * them, the story's conditions with them. The lands the generator made were frozen to these files exactly as it made
 * them (scripts/sigilfall-freeze-lands.mjs). From then on the file is the land: it is worked by hand, and nothing about
 * it is generated when it loads.
 */
export interface LandMap {
  /** Worked by hand since it was frozen: the generator has no say in it any more. */
  hand?: boolean;
  map: string[];
  placed: PlacedMarkerDef[];
}

// (eager: a land's map is built in one go when the hero arrives, and the files are a few KB each, gzipped)
const FILES = import.meta.glob<LandMap>('./maps/*.json', { eager: true, import: 'default' });

/** Every land's map file, by land id. */
export const LAND_MAPS: Readonly<Record<string, LandMap>> = Object.fromEntries(Object.entries(FILES).map(([path, m]) => [path.replace(/^.*\/([a-z0-9-]+)\.json$/, '$1'), m]));
