import { REGIONS } from '../data/regions';
import type { RegionId, Theme } from '../data/types';

/**
 * The color of a land's own light, as it shows at the ways into it (the owner: "the color of the next zone: if it is
 * purple-ish mostly, the glow should be purple"). Each is taken from what the land itself mostly is when you stand in it:
 * its ground and its leaves, lifted to a light. A land with hardly any color (ash, snow, a dead lake) has the pale
 * color of its air; the volcano's is its lava.
 */
const LAND: Partial<Record<Theme, string>> = {
  village: '#c4e06e',
  farm: '#b2dc5c',
  forest: '#78de7c',
  plains: '#e4d65c',
  autumn: '#ffa64a',
  barrow: '#b6b2d8',
  desert: '#ffc862',
  fey: '#5ee0c6',
  snow: '#bfe6ff',
  rift: '#b88aff',
  warfront: '#d8b06c',
  haunted: '#7cc2e0',
  volcanic: '#ff7a3a',
  deadlake: '#a6c8d2',
  pale: '#ced8fa',
  coast: '#7ae8ff',
  marsh: '#b8e070',
  plague: '#c8f070',
  mountain: '#d8e4ff',
  storm: '#8ab8ff',
  moor: '#d0a0ff',
  jungle: '#7affa0',
  blight: '#c0ff6a',
  peaks: '#e0ecff',
  sunken: '#6ae0d8',
  bonefield: '#f0e6c8',
  gloam: '#d08aff',
};

/** A deep place's light is its own fire's (render/rooms.ts): a crypt's cold blue, a forge's orange, the rift's violet. */
const DEEP: Partial<Record<Theme, string>> = {
  crypt: '#8ab4ff',
  cave: '#ffb466',
  cistern: '#7ee0b2',
  keep: '#ffb070',
  icecave: '#90d8ff',
  temple: '#ffd072',
  lavacave: '#ff7030',
  citadel: '#b4acff',
  roots: '#b8e062',
  riftspire: '#d184ff',
};

/** The few whose light is their own. */
const OWN: Record<string, string> = {
  // a summer three hundred years gone
  'vaelmoor-remembered': '#ffe9b0',
};

/** The color of the light at a way into `to`. */
export function zoneLight(to: string): string {
  const own = OWN[to];
  if (own) return own;
  const r = REGIONS[to as RegionId];
  if (!r) return '#ffd66a';
  if (r.kind === 'dungeon') return DEEP[r.theme] ?? '#ffc878';
  return LAND[r.theme] ?? '#ffd66a';
}

/** The warm light of a lit room, at the door of a house that can be gone into; daylight, at its door from inside. */
export const DOOR_LIGHT = '#ffd28a';
export const DAY_LIGHT = '#dfeeff';
