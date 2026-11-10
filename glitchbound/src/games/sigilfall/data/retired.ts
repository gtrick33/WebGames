import type { ExitSpec } from './zonegen';
import type { RegionId } from './types';

/**
 * The lands the story no longer goes through (STORY_BIBLE.md v3): built, kept here in full, but off the world map,
 * out of the routes and the quest log, and with no road into them. Their dungeons stay open as Riftstone runs.
 * To bring one back: take it out of RETIRED and give it its roads back below.
 */
export const RETIRED: ReadonlySet<RegionId> = new Set<RegionId>([
  'greyfen',
  'saltmarsh',
  'duskfen',
  'ironpeak',
  'stormwatch',
  'grimward',
  'sablewind',
  'vinecoil',
  'bonefields',
  'blightwood',
  'sunken-reaches',
  'riftscar',
]);

export const isRetired = (id: RegionId | undefined): boolean => !!id && RETIRED.has(id);

/**
 * Where a road that led into a retired land leads now, by the land it leaves from: to the next land of the story
 * (with a sign that says so), or nowhere (null: the road is gone).
 */
const REROUTE: Partial<Record<RegionId, Partial<Record<RegionId, { to: RegionId; label: string; minLevel?: number } | null>>>> = {
  brackenridge: { greyfen: { to: 'thornvale', label: 'South road: Millbrook and Thornvale', minLevel: 7 } },
  thornvale: {
    greyfen: { to: 'brackenridge', label: 'West road: Fernstead and the Brackenridge Hills' },
    saltmarsh: { to: 'amberfield', label: 'East road: the Amberfield and Hearthstead', minLevel: 15 },
  },
  amberfield: {
    saltmarsh: { to: 'thornvale', label: 'South road: Millbrook and Thornvale' },
    ironpeak: { to: 'ashen-barrows', label: 'North road: Lantern Hill and the Ashen Barrows', minLevel: 21 },
    stormwatch: null,
  },
  'ashen-barrows': {
    ironpeak: { to: 'amberfield', label: 'South road: the Amberfield' },
    grimward: { to: 'sunscorch', label: 'The long road south-east: the Sunscorch', minLevel: 28 },
  },
  sunscorch: {
    ironpeak: { to: 'ashen-barrows', label: 'The long road north-west: Lantern Hill' },
    sablewind: { to: 'glimmerwood', label: 'North: the Glimmerwood', minLevel: 30 },
    vinecoil: null,
  },
  glimmerwood: {
    grimward: { to: 'sunscorch', label: 'South: the Sunscorch' },
    blightwood: null,
  },
  'shattered-vale': { grimward: { to: 'rimeheld', label: 'South road: Frostgate and Rimeheld' } },
  highwall: { sablewind: null, bonefields: { to: 'gloamhollow', label: 'North: the Gloam and Lastlight', minLevel: 43 } },
  gloamhollow: { bonefields: { to: 'highwall', label: 'South: Highwall March' } },
  'weeping-woods': {
    bonefields: { to: 'emberdeep', label: 'East: the fires of Emberdeep', minLevel: 50 },
    blightwood: null,
    riftscar: null,
  },
  emberdeep: { bonefields: { to: 'weeping-woods', label: 'South: the Weeping Woods' } },
};

/** Roads the story needs that no land had (the way on from Rimeheld to the Tear). */
const ADDED: Partial<Record<RegionId, ExitSpec[]>> = {
  rimeheld: [{ side: 's', at: 0.5, to: 'shattered-vale', label: 'South: Shardwatch and the Shattered Vale', minLevel: 34 }],
  // the Crown City's west gate opens on the long road to the sands, and the sands have the road back
  sunscorch: [{ side: 'e', at: 0.45, to: 'emberwick', label: 'East: the long road to the Crown City' }],
};

/** A land's roads as the story has them now: none into a retired land, and the added ones. */
export function liveExits(from: RegionId, exits: readonly ExitSpec[]): ExitSpec[] {
  const out: ExitSpec[] = [];
  for (const e of exits) {
    if (!RETIRED.has(e.to)) {
      out.push(e);
      continue;
    }
    const to = REROUTE[from]?.[e.to];
    if (!to || out.some((o) => o.to === to.to) || exits.some((o) => o.to === to.to)) continue;
    const { minLevel: _old, ...rest } = e;
    void _old;
    out.push({ ...rest, to: to.to, label: to.label, ...(to.minLevel ? { minLevel: to.minLevel } : {}) });
  }
  for (const e of ADDED[from] ?? []) if (!out.some((o) => o.to === e.to)) out.push(e);
  return out;
}
