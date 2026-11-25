import type { ThingLook } from './types';

/**
 * What a quest's thing in the world looks like (sim/tasks.ts puts them down, render3d/worldCast.ts draws them): a
 * model from the packs every land loads, how tall it stands in world pixels, and what becomes of it once the hero has
 * done with it.
 */
export interface ThingDef {
  model: string;
  h: number;
  tint?: readonly [number, number, number];
  /** Once used: burnt black and smoking, lit, gone, opened (darker), or left as it is. */
  after: 'burnt' | 'lit' | 'gone' | 'opened' | 'same';
  /** A person, not a model: sitting bound until freed, then on their feet and away. */
  person?: boolean;
  /** Its light before it is used, so it is found at a glance. */
  glow: string;
}

export const THINGS: Record<ThingLook, ThingDef> = {
  nest: { model: 'log_stack', h: 13, tint: [0.75, 0.6, 0.45], after: 'burnt', glow: '#ffb04d' },
  crate: { model: 'p_crate_A_big', h: 13, after: 'opened', glow: '#ffe08a' },
  barrel: { model: 'p_barrel', h: 13, after: 'opened', glow: '#ffe08a' },
  sack: { model: 'p_sack', h: 10, after: 'gone', glow: '#ffe08a' },
  cart: { model: 'p_wheelbarrow', h: 14, after: 'opened', glow: '#ffe08a' },
  brazier: { model: 'fire-basket', h: 15, tint: [0.6, 0.6, 0.65], after: 'lit', glow: '#ffb04d' },
  campfire: { model: 'campfire_stones', h: 7, tint: [0.7, 0.7, 0.7], after: 'lit', glow: '#ffb04d' },
  banner: { model: 'p_flag_blue', h: 26, after: 'same', glow: '#9ad0ff' },
  grave: { model: 'grave_A', h: 12, after: 'same', glow: '#c8b0ff' },
  runestone: { model: 'statue_obelisk', h: 22, after: 'lit', glow: '#9ad0ff' },
  altar: { model: 'altar-stone', h: 12, after: 'lit', glow: '#ffe08a' },
  shrine: { model: 'shrine', h: 18, after: 'lit', glow: '#ffe08a' },
  tent: { model: 'p_tent', h: 22, after: 'burnt', glow: '#ffb04d' },
  boat: { model: 'p_boat', h: 9, after: 'burnt', glow: '#ffb04d' },
  weapons: { model: 'p_weaponrack', h: 16, after: 'opened', glow: '#ffe08a' },
  bones: { model: 'ribcage', h: 8, after: 'same', glow: '#c8b0ff' },
  tracks: { model: 'bone_A', h: 3, after: 'gone', glow: '#ffe08a' },
  herb: { model: 'flower_purpleA', h: 8, after: 'gone', glow: '#9cffd0' },
  mushroom: { model: 'mushroom_tanTall', h: 9, after: 'gone', glow: '#9cffd0' },
  ore: { model: 'p_resource_stone', h: 10, after: 'gone', glow: '#9ad0ff' },
  coffin: { model: 'coffin', h: 9, after: 'opened', glow: '#c8b0ff' },
  books: { model: 'shelf_small_books', h: 14, after: 'opened', glow: '#ffe08a' },
  well: { model: 'b_well', h: 20, after: 'same', glow: '#9ad0ff' },
  lantern: { model: 'lantern_standing', h: 18, tint: [0.6, 0.6, 0.65], after: 'lit', glow: '#ffb04d' },
  totem: { model: 'post_skull', h: 20, after: 'burnt', glow: '#ff6a4d' },
  captive: { model: 'p_sack', h: 10, after: 'gone', person: true, glow: '#9cffd0' },
  statue: { model: 'statue_head', h: 16, after: 'same', glow: '#9ad0ff' },
  log: { model: 'log', h: 7, after: 'gone', glow: '#ffe08a' },
  anvil: { model: 'anvil', h: 10, after: 'same', glow: '#ffb04d' },
  chest: { model: 'chest', h: 13, after: 'opened', glow: '#ffe08a' },
  notice: { model: 'sign', h: 15, after: 'gone', glow: '#ff6a4d' },
  gibbet: { model: 'post_skull', h: 24, after: 'opened', glow: '#c8b0ff' },
  candle: { model: 'candle_triple', h: 9, tint: [0.7, 0.7, 0.75], after: 'lit', glow: '#ffd27a' },
  spear: { model: 'p_weaponrack', h: 15, after: 'same', glow: '#ffe08a' },
  shelter: { model: 'b_tent', h: 20, tint: [0.6, 0.6, 0.6], after: 'lit', glow: '#9cffd0' },
  rod: { model: 'post_lantern', h: 20, tint: [0.9, 0.75, 0.4], after: 'lit', glow: '#c8b0ff' },
};
