/** Car definitions. Purely cosmetic: every car has the same speed, handling and hitbox. */

export type StripeStyle = 'none' | 'center' | 'dual' | 'side' | 'circuit' | 'checker' | 'pixel' | 'chevron';

/** Body class: each is drawn with its own original silhouette. */
export type CarShape = 'sport' | 'formula' | 'stock' | 'wedge' | 'exotic' | 'muscle' | 'cyber' | 'hover' | 'rally' | 'proto';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

/** Animated GPU shader applied to the car body. */
export type ShaderFx = 'none' | 'holo' | 'chrome' | 'plasma' | 'glitch' | 'lava' | 'galaxy' | 'pearl';

export type TrailStyle = 'ribbon' | 'flame' | 'spark' | 'rainbow' | 'laser' | 'pixel' | 'smoke' | 'stardust' | 'lightning';

export type SkinUnlock =
  | { type: 'starter' }
  | { type: 'coins'; price: number }
  | { type: 'level'; level: number }
  | { type: 'achievement'; achievementId: string };

export interface SkinDef {
  id: string;
  name: string;
  tagline: string;
  shape: CarShape;
  rarity: Rarity;
  /** Body gradient from front to back. */
  body: [number, number];
  accent: number;
  glass: number;
  stripe: StripeStyle;
  stripeColor: number;
  glow: number;
  trail: [number, number];
  trailStyle: TrailStyle;
  shader: ShaderFx;
  finish: 'gloss' | 'matte' | 'metal';
  /** Race number painted on stock cars and formula cars. */
  number?: number;
  unlock: SkinUnlock;
}

export const DEFAULT_SKIN_ID = 'neon_cyan';

export const SHAPE_LABEL: Record<CarShape, string> = {
  sport: 'Street', formula: 'Formula', stock: 'Stock car', wedge: 'Hypercar', exotic: 'Grand tourer',
  muscle: 'Muscle', cyber: 'Cyber', hover: 'Hover', rally: 'Rally', proto: 'Prototype',
};
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };
export const SHADER_LABEL: Record<ShaderFx, string> = {
  none: '', holo: 'Holographic', chrome: 'Chrome sheen', plasma: 'Plasma', glitch: 'Glitch', lava: 'Molten', galaxy: 'Galaxy', pearl: 'Pearlescent',
};
export const TRAIL_LABEL: Record<TrailStyle, string> = {
  ribbon: 'Neon ribbon', flame: 'Flame trail', spark: 'Spark trail', rainbow: 'Rainbow trail', laser: 'Twin lasers',
  pixel: 'Pixel trail', smoke: 'Smoke trail', stardust: 'Stardust', lightning: 'Lightning',
};

type LegacyDef = Omit<SkinDef, 'shape' | 'rarity' | 'trailStyle' | 'shader'> & Partial<Pick<SkinDef, 'shape' | 'rarity' | 'trailStyle' | 'shader'>>;

const CLASSIC: LegacyDef[] = [
  {
    id: 'neon_cyan', name: 'Neon Cyan', tagline: 'The original street glow.',
    body: [0x10e6ff, 0x0a6bd6], accent: 0xffffff, glass: 0x0b1b33, stripe: 'center', stripeColor: 0xe8fdff,
    glow: 0x19f0ff, trail: [0x19f0ff, 0x2a5bff], finish: 'gloss', unlock: { type: 'starter' },
  },
  {
    id: 'crimson', name: 'Crimson Racer', tagline: 'Red means go.',
    body: [0xff3b4f, 0x9e0b2a], accent: 0xffd2d8, glass: 0x1d0b12, stripe: 'dual', stripeColor: 0xffffff,
    glow: 0xff2a55, trail: [0xff2a55, 0xff9a3c], finish: 'gloss', rarity: 'common', unlock: { type: 'coins', price: 300 },
  },
  {
    id: 'lime_circuit', name: 'Lime Circuit', tagline: 'Wired for speed. Reach level 3.',
    body: [0x9dff3a, 0x1f9e4a], accent: 0x0b2410, glass: 0x08160c, stripe: 'circuit', stripeColor: 0x0d3b16,
    glow: 0x9dff3a, trail: [0x9dff3a, 0x00ffa8], finish: 'matte', trailStyle: 'spark', unlock: { type: 'level', level: 3 },
  },
  {
    id: 'vaporwave', name: 'Purple Vaporwave', tagline: 'Sunset on a VHS tape.',
    body: [0xc86bff, 0x5a1fd1], accent: 0xff7ad9, glass: 0x160a2b, stripe: 'chevron', stripeColor: 0xff9be6,
    glow: 0xb45cff, trail: [0xff5fd2, 0x7a5cff], finish: 'gloss', unlock: { type: 'coins', price: 600 },
  },
  {
    id: 'midnight', name: 'Midnight Black', tagline: 'Stealth with a neon edge.',
    body: [0x2a2f3d, 0x0b0d14], accent: 0x39ffe0, glass: 0x05060a, stripe: 'side', stripeColor: 0x39ffe0,
    glow: 0x39ffe0, trail: [0x39ffe0, 0x1b6cff], finish: 'matte', unlock: { type: 'coins', price: 900 },
  },
  {
    id: 'sunset', name: 'Sunset Blaze', tagline: 'Chasing the last light.',
    body: [0xffb238, 0xff3d7f], accent: 0xfff1c9, glass: 0x2a0c1a, stripe: 'center', stripeColor: 0xfff1c9,
    glow: 0xff7a3d, trail: [0xffb238, 0xff3d7f], finish: 'gloss', trailStyle: 'flame', rarity: 'rare', unlock: { type: 'coins', price: 1200 },
  },
  {
    id: 'retro_arcade', name: 'Retro Arcade', tagline: 'Insert coin. Drive 3000 m in one run.',
    body: [0x2f6bff, 0x1a2a8c], accent: 0xffe14a, glass: 0x0a0f2e, stripe: 'pixel', stripeColor: 0xffe14a,
    glow: 0xffe14a, trail: [0xffe14a, 0xff4ad8], finish: 'matte', trailStyle: 'pixel', rarity: 'epic', unlock: { type: 'achievement', achievementId: 'dist_3000' },
  },
  {
    id: 'gold', name: 'Gold Edition', tagline: 'For the high rollers.',
    body: [0xfff0a0, 0xc8860c], accent: 0x3a2400, glass: 0x1d1405, stripe: 'dual', stripeColor: 0x6b4300,
    glow: 0xffd23d, trail: [0xffe680, 0xffa600], finish: 'metal', shader: 'chrome', trailStyle: 'stardust', rarity: 'legendary', unlock: { type: 'coins', price: 2500 },
  },
  {
    id: 'aurora', name: 'Aurora Gradient', tagline: 'Northern lights on wheels. Reach level 8.',
    body: [0x3dffc4, 0x8a4dff], accent: 0xe9fff8, glass: 0x081a22, stripe: 'none', stripeColor: 0xffffff,
    glow: 0x63ffd9, trail: [0x3dffc4, 0xb36bff], finish: 'gloss', shader: 'holo', trailStyle: 'rainbow', rarity: 'epic', unlock: { type: 'level', level: 8 },
  },
  {
    id: 'phantom', name: 'Phantom Chrome', tagline: 'Barely there. 100 lifetime near misses.',
    body: [0xf2f6ff, 0x8d97b3], accent: 0x6a7cff, glass: 0x10131f, stripe: 'checker', stripeColor: 0x1b2040,
    glow: 0xc9d6ff, trail: [0xe3ecff, 0x6a7cff], finish: 'metal', shader: 'pearl', trailStyle: 'smoke', rarity: 'epic', unlock: { type: 'achievement', achievementId: 'near_100_total' },
  },
];


/** Compact builder for the extended line-up. */
function car(
  id: string, name: string, tagline: string, shape: CarShape, rarity: Rarity, unlock: SkinUnlock | number,
  c: { body: [number, number]; accent?: number; glass?: number; stripe?: StripeStyle; stripeColor?: number; glow?: number;
    trail?: [number, number]; trailStyle?: TrailStyle; shader?: ShaderFx; finish?: SkinDef['finish']; number?: number },
): SkinDef {
  return {
    id, name, tagline, shape, rarity,
    unlock: typeof unlock === 'number' ? { type: 'coins', price: unlock } : unlock,
    body: c.body,
    accent: c.accent ?? 0xffffff,
    glass: c.glass ?? 0x0a0d1a,
    stripe: c.stripe ?? 'none',
    stripeColor: c.stripeColor ?? 0xffffff,
    glow: c.glow ?? c.body[0],
    trail: c.trail ?? [c.glow ?? c.body[0], c.body[1]],
    trailStyle: c.trailStyle ?? 'ribbon',
    shader: c.shader ?? 'none',
    finish: c.finish ?? 'gloss',
    number: c.number,
  };
}
const lvl = (level: number): SkinUnlock => ({ type: 'level', level });
const ach = (achievementId: string): SkinUnlock => ({ type: 'achievement', achievementId });

const EXTENDED: SkinDef[] = [
  // Formula: open wheels, wings, halo.
  car('f_volt', 'Volt F', 'Pure downforce in electric blue.', 'formula', 'rare', 900, { body: [0x2ee6ff, 0x0d3fb8], stripeColor: 0xffffff, stripe: 'center', trailStyle: 'laser', number: 5 }),
  car('f_scarlet', 'Scarlet Apex', 'Late braking, early glory.', 'formula', 'rare', 1100, { body: [0xff2d3d, 0x8a0018], stripeColor: 0xffe14a, stripe: 'dual', trailStyle: 'flame', trail: [0xff7a2a, 0xffd23d], number: 16 }),
  car('f_azure', 'Azure Arrow', 'Polished to a mirror finish.', 'formula', 'epic', 2400, { body: [0x9fd8ff, 0x2a5cff], finish: 'metal', shader: 'chrome', trailStyle: 'laser', glow: 0x6ab8ff, number: 44 }),
  car('f_toxic', 'Toxic Wing', 'Reach level 10. Hazard-grade green.', 'formula', 'epic', lvl(10), { body: [0xc6ff1a, 0x2a7a00], stripe: 'checker', stripeColor: 0x0b1a00, trailStyle: 'spark', glow: 0xb6ff2a, number: 10 }),
  car('f_shadow', 'Shadow Formula', 'Now you see it.', 'formula', 'legendary', 6000, { body: [0x2a2240, 0x07050f], accent: 0xb46bff, stripe: 'side', stripeColor: 0xb46bff, glow: 0xa54dff, shader: 'glitch', trailStyle: 'lightning', trail: [0xb46bff, 0x4de1ff], finish: 'matte', number: 13 }),
  car('f_golden', 'Golden Grid', 'Pole position, every time.', 'formula', 'legendary', 7500, { body: [0xfff0a0, 0xc8860c], accent: 0x3a2400, finish: 'metal', shader: 'chrome', trailStyle: 'stardust', glow: 0xffd23d, trail: [0xffe680, 0xffa600], number: 1 }),
  car('f_prism', 'Prism F', 'Splits light into speed.', 'formula', 'mythic', 15000, { body: [0xf2f0ff, 0xb9b2ff], shader: 'holo', trailStyle: 'rainbow', glow: 0xffffff, number: 0 }),

  // Stock cars: wide, boxy, numbered.
  car('st_thunder', 'Thunder #7', 'Built for the long oval.', 'stock', 'common', 400, { body: [0x2f6bff, 0x1830a0], stripe: 'side', stripeColor: 0xffd23d, number: 7 }),
  car('st_blaze', 'Blaze #24', 'Paint scorched at the edges.', 'stock', 'rare', 900, { body: [0xff7a1a, 0xc8200a], stripe: 'chevron', stripeColor: 0xffe14a, trailStyle: 'flame', number: 24 }),
  car('st_ice', 'Ice Cold #12', 'Calm under pressure.', 'stock', 'rare', 1000, { body: [0xe9fbff, 0x6fd3ff], accent: 0x0a4a7a, stripe: 'dual', stripeColor: 0x1a8cff, glow: 0x8fe9ff, trailStyle: 'spark', number: 12 }),
  car('st_liberty', 'Liberty #76', 'Stars on the hood, stripes on the trunk.', 'stock', 'epic', 2600, { body: [0xf4f4ff, 0x2a3a9e], stripe: 'checker', stripeColor: 0xff2a4a, glow: 0xff4a6a, trailStyle: 'laser', trail: [0xff2a4a, 0x3a6bff], number: 76 }),
  car('st_oval', 'Oval King #3', 'Play 100 runs.', 'stock', 'epic', ach('games_100'), { body: [0x1a1a1a, 0x050505], accent: 0xff2a2a, stripe: 'side', stripeColor: 0xff2a2a, glow: 0xff2a2a, finish: 'matte', trailStyle: 'smoke', number: 3 }),
  car('st_molten', 'Molten #99', 'Runs hotter than the asphalt.', 'stock', 'legendary', 5500, { body: [0xff9a1a, 0x7a0a00], shader: 'lava', trailStyle: 'flame', glow: 0xff6a1a, trail: [0xffb020, 0xff3a0a], number: 99 }),
  car('st_legend', 'Neon Legend #1', 'The champion of the night league.', 'stock', 'mythic', 14000, { body: [0xff3fd2, 0x22e4ff], shader: 'plasma', trailStyle: 'lightning', glow: 0xff7af0, trail: [0xff3fd2, 0x22e4ff], number: 1 }),

  // Wedge hypercars: sharp, low, angular.
  car('wd_verde', 'Verde Wedge', 'Angles all the way down.', 'wedge', 'rare', 1200, { body: [0x8dff2a, 0x2a9e0a], accent: 0x0a1a00, stripe: 'none', glow: 0x9dff3a }),
  car('wd_arancio', 'Arancio Blade', 'Cuts the night in half.', 'wedge', 'rare', 1300, { body: [0xffa21a, 0xd0500a], glow: 0xffa21a, trailStyle: 'spark' }),
  car('wd_giallo', 'Giallo Fang', 'Yellow means fast.', 'wedge', 'epic', 2800, { body: [0xfff23a, 0xffa800], accent: 0x1a1400, stripe: 'center', stripeColor: 0x111111, glow: 0xffe14a, trailStyle: 'laser' }),
  car('wd_nero', 'Nero Stealth', 'Reach level 15. Radar hates it.', 'wedge', 'epic', lvl(15), { body: [0x23262f, 0x08090d], accent: 0x39ffe0, glow: 0x39ffe0, finish: 'matte', trailStyle: 'smoke' }),
  car('wd_venom', 'Viola Venom', 'A sting of ultraviolet.', 'wedge', 'legendary', 6500, { body: [0xc04dff, 0x4a0a9e], shader: 'glitch', glow: 0xd06bff, trailStyle: 'lightning', trail: [0xd06bff, 0x22e4ff] }),
  car('wd_spectre', 'Bianco Spectre', 'Pearl white, ghost quiet.', 'wedge', 'legendary', 7000, { body: [0xffffff, 0xcfd6e8], accent: 0x7a8cff, shader: 'pearl', glow: 0xdfe6ff, trailStyle: 'stardust' }),
  car('wd_inferno', 'Inferno Wedge', 'Forged in a volcano.', 'wedge', 'mythic', 16000, { body: [0xffb020, 0x8a0a00], shader: 'lava', glow: 0xff5a0a, trailStyle: 'flame', trail: [0xffe14a, 0xff3a0a] }),

  // Grand tourers: flowing curves, long hood.
  car('ex_corsa', 'Corsa Rossa', 'Curves in classic racing red.', 'exotic', 'rare', 1400, { body: [0xff2a3a, 0xa0001a], stripe: 'none', glow: 0xff3a4a }),
  car('ex_azzurro', 'Azzurro GT', 'Coastal-road blue.', 'exotic', 'rare', 1500, { body: [0x6ad0ff, 0x1a6ad0], stripe: 'dual', stripeColor: 0xffffff, trailStyle: 'spark' }),
  car('ex_riviera', 'Riviera Sunset', 'Chasing golden hour.', 'exotic', 'epic', 3000, { body: [0xffb238, 0xff3d7f], glow: 0xff7a3d, trailStyle: 'rainbow', trail: [0xffb238, 0xff3d7f] }),
  car('ex_emerald', 'Emerald GT', 'Deep green, deeper engine note.', 'exotic', 'epic', 3200, { body: [0x2affb0, 0x00603a], finish: 'metal', glow: 0x2affb0, trailStyle: 'laser' }),
  car('ex_noir', 'Noir Velvet', 'Drive 5,000 m in a single run.', 'exotic', 'legendary', ach('dist_5000'), { body: [0x2a1a3a, 0x050208], accent: 0xff3fd2, stripe: 'side', stripeColor: 0xff3fd2, glow: 0xff3fd2, finish: 'matte', shader: 'plasma', trailStyle: 'stardust' }),
  car('ex_champagne', 'Champagne GT', 'Celebrate every overtake.', 'exotic', 'legendary', 7500, { body: [0xfff6d6, 0xd8b06a], accent: 0x5a3a00, finish: 'metal', shader: 'chrome', glow: 0xffe6a0, trailStyle: 'stardust', trail: [0xfff2c0, 0xffc860] }),
  car('ex_galaxy', 'Galaxy GT', 'A whole universe on four wheels.', 'exotic', 'mythic', 18000, { body: [0x3a1a8a, 0x05021a], shader: 'galaxy', glow: 0x8a6bff, trailStyle: 'stardust', trail: [0xb9a6ff, 0x4de1ff] }),

  // Muscle: wide hood, scoop, twin stripes.
  car('mu_cherry', 'Cherry Bomb', 'Loud, proud and red.', 'muscle', 'common', 350, { body: [0xff2a4a, 0x9e0a20], stripe: 'dual', stripeColor: 0xffffff }),
  car('mu_cobalt', 'Cobalt Brute', 'All torque, no apologies.', 'muscle', 'common', 450, { body: [0x2a7aff, 0x0a2a8a], stripe: 'dual', stripeColor: 0xffffff, trailStyle: 'smoke' }),
  car('mu_desert', 'Desert Hammer', 'Sand-blasted and unstoppable.', 'muscle', 'rare', 800, { body: [0xd8b06a, 0x7a5a2a], accent: 0x2a1a00, stripe: 'center', stripeColor: 0x2a1a00, finish: 'matte', trailStyle: 'smoke' }),
  car('mu_hotrod', 'Hot Rod Flame', 'Flames are faster. Everyone knows.', 'muscle', 'epic', 2200, { body: [0x1a1a2a, 0x05050a], stripe: 'chevron', stripeColor: 0xff7a1a, glow: 0xff7a1a, trailStyle: 'flame', trail: [0xffd23d, 0xff3a0a] }),
  car('mu_vapor', 'Vapor Muscle', 'Pastel power from 1986.', 'muscle', 'epic', 2500, { body: [0x7ae8ff, 0xff7ad9], stripe: 'dual', stripeColor: 0xffffff, glow: 0xff9be6, trailStyle: 'rainbow' }),
  car('mu_chrome', 'Chrome Beast', 'Reach level 20. Mirror-polished V8 energy.', 'muscle', 'legendary', lvl(20), { body: [0xf0f4ff, 0x7a8299], finish: 'metal', shader: 'chrome', glow: 0xe0e8ff, trailStyle: 'spark', trail: [0xffffff, 0x8ab4ff] }),

  // Cyber: low-poly slab.
  car('cy_steel', 'Steel Slab', 'Brutalist on wheels.', 'cyber', 'common', 500, { body: [0xb8c0cc, 0x5a6270], accent: 0x22e4ff, finish: 'metal' }),
  car('cy_coder', 'Code Runner', 'Compiled for speed.', 'cyber', 'rare', 1200, { body: [0x0a2a10, 0x020a04], accent: 0x3dff6a, stripe: 'circuit', stripeColor: 0x3dff6a, glow: 0x3dff6a, trailStyle: 'pixel', trail: [0x3dff6a, 0x0aff9a] }),
  car('cy_bunker', 'Neon Bunker', 'Armored in light.', 'cyber', 'epic', 2600, { body: [0x2a2f45, 0x10131f], accent: 0xff3fd2, stripe: 'side', stripeColor: 0xff3fd2, glow: 0xff3fd2, trailStyle: 'laser', trail: [0xff3fd2, 0x22e4ff] }),
  car('cy_glitch', 'Glitch Rig', 'Error 404: competition not found.', 'cyber', 'legendary', 6000, { body: [0x22e4ff, 0xff3fd2], shader: 'glitch', trailStyle: 'pixel', glow: 0x7af0ff }),
  car('cy_void', 'Void Walker', 'Drive 100 km in total.', 'cyber', 'mythic', ach('lifetime_100km'), { body: [0x0a0614, 0x000000], accent: 0x8a5cff, shader: 'galaxy', glow: 0x8a5cff, trailStyle: 'lightning', trail: [0x8a5cff, 0x22e4ff] }),

  // Hover: no wheels, glowing thrusters.
  car('hv_mint', 'Mint Glider', 'Floats like a breeze.', 'hover', 'rare', 1000, { body: [0x9affd8, 0x1ab890], glow: 0x5affc8, trailStyle: 'spark' }),
  car('hv_coral', 'Coral Drift', 'Reef colors, zero friction.', 'hover', 'rare', 1100, { body: [0xff9a8a, 0xff4a7a], glow: 0xff7a9a, trailStyle: 'ribbon' }),
  car('hv_plasma', 'Plasma Skiff', 'Runs on bottled lightning.', 'hover', 'epic', 3000, { body: [0x4de1ff, 0x8a2aff], shader: 'plasma', glow: 0x6ab8ff, trailStyle: 'lightning' }),
  car('hv_solar', 'Solar Sail', 'Reach a x8 near miss combo.', 'hover', 'epic', ach('combo_8'), { body: [0xffe14a, 0xff7a1a], glow: 0xffd23d, trailStyle: 'flame', trail: [0xffe14a, 0xff7a1a] }),
  car('hv_aurora', 'Aurora Skimmer', 'Reach level 25. Northern lights, bottled.', 'hover', 'legendary', lvl(25), { body: [0x3dffc4, 0x8a4dff], shader: 'holo', glow: 0x63ffd9, trailStyle: 'rainbow' }),
  car('hv_quantum', 'Quantum Ghost', 'Exists in every lane at once.', 'hover', 'mythic', 20000, { body: [0xe6f0ff, 0x8a9cff], shader: 'galaxy', glow: 0xc9d6ff, trailStyle: 'stardust', trail: [0xffffff, 0x8a9cff] }),

  // Rally: hatchback, light pod, mud flaps.
  car('ra_mud', 'Mud Runner', 'Dirty and proud of it.', 'rally', 'common', 300, { body: [0x7a9e3a, 0x3a5a1a], stripe: 'side', stripeColor: 0xffe14a, trailStyle: 'smoke', number: 8 }),
  car('ra_snow', 'Snow Fox', 'Sideways on ice.', 'rally', 'common', 450, { body: [0xffffff, 0xb8d8ff], accent: 0x1a5aff, stripe: 'chevron', stripeColor: 0x1a5aff, glow: 0xb8e8ff, number: 21 }),
  car('ra_works', 'Works Rally', 'Factory team livery.', 'rally', 'rare', 1000, { body: [0x1a3aff, 0x0a1a6a], stripe: 'dual', stripeColor: 0xffd23d, trailStyle: 'spark', number: 4 }),
  car('ra_dune', 'Dune Raider', 'Kicks up a sandstorm.', 'rally', 'epic', 2200, { body: [0xffc86a, 0xc86a1a], accent: 0x2a1400, stripe: 'checker', stripeColor: 0x2a1400, finish: 'matte', trailStyle: 'smoke', number: 33 }),
  car('ra_night', 'Night Stage', 'Light pod on full beam.', 'rally', 'legendary', 5000, { body: [0x10131f, 0x05060a], accent: 0x22e4ff, stripe: 'side', stripeColor: 0x22e4ff, glow: 0x22e4ff, trailStyle: 'lightning', number: 0 }),

  // Prototypes: enclosed cockpit, shark fin.
  car('lm_endurance', 'Endurance 24', 'Built to last all night.', 'proto', 'rare', 1300, { body: [0x2affd8, 0x0a6a8a], stripe: 'center', stripeColor: 0x0a1a2a, trailStyle: 'laser', number: 24 }),
  car('lm_bullet', 'Silver Bullet', 'Aerodynamics in liquid metal.', 'proto', 'epic', 2700, { body: [0xe8eef8, 0x8a96aa], finish: 'metal', shader: 'chrome', glow: 0xdfe8ff, trailStyle: 'laser', trail: [0xffffff, 0x8ab4ff] }),
  car('lm_hyper', 'Hyper Proto', 'Collect 100 coins in a single run.', 'proto', 'epic', ach('coins_100_run'), { body: [0xffd23d, 0x1a1a1a], stripe: 'side', stripeColor: 0x111111, glow: 0xffd23d, trailStyle: 'spark', number: 100 }),
  car('lm_spectrum', 'Spectrum LMP', 'Every color, all at once.', 'proto', 'legendary', 8000, { body: [0xffffff, 0xd8d0ff], shader: 'holo', glow: 0xffffff, trailStyle: 'rainbow' }),
  car('lm_photon', 'Photon', 'Reach level 30. Faster than light (visually).', 'proto', 'mythic', lvl(30), { body: [0x7af0ff, 0x2a4dff], shader: 'plasma', glow: 0x9af4ff, trailStyle: 'laser', trail: [0xffffff, 0x4de1ff] }),
];

export const SKINS: readonly SkinDef[] = [
  ...CLASSIC.map((d) => ({ shape: 'sport' as const, rarity: d.unlock.type === 'starter' ? ('common' as const) : ('rare' as const), trailStyle: 'ribbon' as const, shader: 'none' as const, ...d })),
  ...EXTENDED,
];

const byId = new Map(SKINS.map((s) => [s.id, s]));

export function getSkin(id: string): SkinDef {
  return byId.get(id) ?? (byId.get(DEFAULT_SKIN_ID) as SkinDef);
}

export function isKnownSkin(id: string): boolean {
  return byId.has(id);
}

export function describeUnlock(skin: SkinDef): string {
  switch (skin.unlock.type) {
    case 'starter':
      return 'Starter car';
    case 'coins':
      return `${skin.unlock.price.toLocaleString('en-US')} coins`;
    case 'level':
      return `Reach level ${skin.unlock.level}`;
    case 'achievement':
      return 'Achievement reward';
  }
}
