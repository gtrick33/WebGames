/** Car skin definitions. Purely cosmetic: skins never change handling, speed or hitboxes. */

export type StripeStyle = 'none' | 'center' | 'dual' | 'side' | 'circuit' | 'checker' | 'pixel' | 'chevron';

export type SkinUnlock =
  | { type: 'starter' }
  | { type: 'coins'; price: number }
  | { type: 'level'; level: number }
  | { type: 'achievement'; achievementId: string };

export interface SkinDef {
  id: string;
  name: string;
  tagline: string;
  /** Body gradient from front to back. */
  body: [number, number];
  accent: number;
  glass: number;
  stripe: StripeStyle;
  stripeColor: number;
  glow: number;
  trail: [number, number];
  finish: 'gloss' | 'matte' | 'metal';
  unlock: SkinUnlock;
}

export const DEFAULT_SKIN_ID = 'neon_cyan';

export const SKINS: readonly SkinDef[] = [
  {
    id: 'neon_cyan', name: 'Neon Cyan', tagline: 'The original street glow.',
    body: [0x10e6ff, 0x0a6bd6], accent: 0xffffff, glass: 0x0b1b33, stripe: 'center', stripeColor: 0xe8fdff,
    glow: 0x19f0ff, trail: [0x19f0ff, 0x2a5bff], finish: 'gloss', unlock: { type: 'starter' },
  },
  {
    id: 'crimson', name: 'Crimson Racer', tagline: 'Red means go.',
    body: [0xff3b4f, 0x9e0b2a], accent: 0xffd2d8, glass: 0x1d0b12, stripe: 'dual', stripeColor: 0xffffff,
    glow: 0xff2a55, trail: [0xff2a55, 0xff9a3c], finish: 'gloss', unlock: { type: 'coins', price: 300 },
  },
  {
    id: 'lime_circuit', name: 'Lime Circuit', tagline: 'Wired for speed. Reach level 3.',
    body: [0x9dff3a, 0x1f9e4a], accent: 0x0b2410, glass: 0x08160c, stripe: 'circuit', stripeColor: 0x0d3b16,
    glow: 0x9dff3a, trail: [0x9dff3a, 0x00ffa8], finish: 'matte', unlock: { type: 'level', level: 3 },
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
    glow: 0xff7a3d, trail: [0xffb238, 0xff3d7f], finish: 'gloss', unlock: { type: 'coins', price: 1200 },
  },
  {
    id: 'retro_arcade', name: 'Retro Arcade', tagline: 'Insert coin. Drive 3000 m in one run.',
    body: [0x2f6bff, 0x1a2a8c], accent: 0xffe14a, glass: 0x0a0f2e, stripe: 'pixel', stripeColor: 0xffe14a,
    glow: 0xffe14a, trail: [0xffe14a, 0xff4ad8], finish: 'matte', unlock: { type: 'achievement', achievementId: 'dist_3000' },
  },
  {
    id: 'gold', name: 'Gold Edition', tagline: 'For the high rollers.',
    body: [0xfff0a0, 0xc8860c], accent: 0x3a2400, glass: 0x1d1405, stripe: 'dual', stripeColor: 0x6b4300,
    glow: 0xffd23d, trail: [0xffe680, 0xffa600], finish: 'metal', unlock: { type: 'coins', price: 2500 },
  },
  {
    id: 'aurora', name: 'Aurora Gradient', tagline: 'Northern lights on wheels. Reach level 8.',
    body: [0x3dffc4, 0x8a4dff], accent: 0xe9fff8, glass: 0x081a22, stripe: 'none', stripeColor: 0xffffff,
    glow: 0x63ffd9, trail: [0x3dffc4, 0xb36bff], finish: 'gloss', unlock: { type: 'level', level: 8 },
  },
  {
    id: 'phantom', name: 'Phantom Chrome', tagline: 'Barely there. 100 lifetime near misses.',
    body: [0xf2f6ff, 0x8d97b3], accent: 0x6a7cff, glass: 0x10131f, stripe: 'checker', stripeColor: 0x1b2040,
    glow: 0xc9d6ff, trail: [0xe3ecff, 0x6a7cff], finish: 'metal', unlock: { type: 'achievement', achievementId: 'near_100_total' },
  },
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
