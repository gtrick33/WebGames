/** Cosmetics: bought with earned cash only. Helmets and suits dress the driver; paints, liveries and wheels dress the car; environments are where you race. */
export type CosmeticKind = 'helmet' | 'suit' | 'paint' | 'livery' | 'wheels' | 'env';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  price: number;
  /** Main color(s): a helmet's shell and visor stripe, a suit's cloth, a paint's hex. */
  colors: string[];
  /** Ladder rank needed before it is for sale (0 = always). */
  rank?: number;
}

export const HELMETS: Cosmetic[] = [
  { id: 'h-white', kind: 'helmet', name: 'Classic White', price: 0, colors: ['#f4f4f4', '#1d1238'] },
  { id: 'h-red', kind: 'helmet', name: 'Rocket Red', price: 400, colors: ['#e63946', '#ffffff'] },
  { id: 'h-sky', kind: 'helmet', name: 'Sky Blue', price: 400, colors: ['#5ad1ff', '#ffffff'] },
  { id: 'h-lime', kind: 'helmet', name: 'Lime Bolt', price: 900, colors: ['#c4f034', '#1d1238'] },
  { id: 'h-flame', kind: 'helmet', name: 'Flame Job', price: 1800, colors: ['#1d1238', '#ff8500'], rank: 4 },
  { id: 'h-checker', kind: 'helmet', name: 'Checkered', price: 1800, colors: ['#ffffff', '#1d1238'], rank: 4 },
  { id: 'h-pink', kind: 'helmet', name: 'Bubblegum', price: 2500, colors: ['#ff6b9d', '#ffd23f'], rank: 8 },
  { id: 'h-gold', kind: 'helmet', name: 'Gold Leaf', price: 6000, colors: ['#ffd166', '#8a5a00'], rank: 12 },
  { id: 'h-teal', kind: 'helmet', name: 'Reef', price: 6000, colors: ['#06d6a0', '#073b4c'], rank: 12 },
  { id: 'h-violet', kind: 'helmet', name: 'Ultraviolet', price: 15000, colors: ['#9b5de5', '#f15bb5'], rank: 20 },
  { id: 'h-chrome', kind: 'helmet', name: 'Chrome Dome', price: 40000, colors: ['#d9d9d9', '#118ab2'], rank: 28 },
  { id: 'h-king', kind: 'helmet', name: 'The Crown', price: 150000, colors: ['#ffd23f', '#ff006e'], rank: 36 },
];

export const SUITS: Cosmetic[] = [
  { id: 's-navy', kind: 'suit', name: 'Navy Overalls', price: 0, colors: ['#1d3557'] },
  { id: 's-red', kind: 'suit', name: 'Red Racer', price: 600, colors: ['#d62828'] },
  { id: 's-white', kind: 'suit', name: 'Pit White', price: 600, colors: ['#f1f1f1'] },
  { id: 's-lime', kind: 'suit', name: 'Hi-Vis', price: 1500, colors: ['#c4f034'], rank: 6 },
  { id: 's-orange', kind: 'suit', name: 'Tangerine', price: 3000, colors: ['#ff8500'], rank: 10 },
  { id: 's-black', kind: 'suit', name: 'Stealth', price: 8000, colors: ['#1a1a1a'], rank: 16 },
  { id: 's-teal', kind: 'suit', name: 'Lagoon', price: 20000, colors: ['#06d6a0'], rank: 24 },
  { id: 's-gold', kind: 'suit', name: 'Champion Gold', price: 100000, colors: ['#ffd166'], rank: 34 },
];

export const PAINTS: Cosmetic[] = [
  { id: 'p-stock', kind: 'paint', name: 'Factory', price: 0, colors: [''] },
  { id: 'p-white', kind: 'paint', name: 'Pearl White', price: 500, colors: ['#f5f5f5'] },
  { id: 'p-red', kind: 'paint', name: 'Rosso', price: 500, colors: ['#e63946'] },
  { id: 'p-blue', kind: 'paint', name: 'Bay Blue', price: 500, colors: ['#2d6cdf'] },
  { id: 'p-yellow', kind: 'paint', name: 'Banana', price: 800, colors: ['#ffd23f'] },
  { id: 'p-lime', kind: 'paint', name: 'Acid Lime', price: 1200, colors: ['#c4f034'], rank: 4 },
  { id: 'p-pink', kind: 'paint', name: 'Flamingo', price: 1200, colors: ['#ff6b9d'], rank: 4 },
  { id: 'p-orange', kind: 'paint', name: 'Sunset', price: 1500, colors: ['#ff8500'], rank: 8 },
  { id: 'p-teal', kind: 'paint', name: 'Lagoon', price: 2500, colors: ['#06d6a0'], rank: 8 },
  { id: 'p-violet', kind: 'paint', name: 'Grape', price: 4000, colors: ['#9b5de5'], rank: 14 },
  { id: 'p-black', kind: 'paint', name: 'Midnight', price: 6000, colors: ['#22223b'], rank: 18 },
  { id: 'p-gold', kind: 'paint', name: 'Liquid Gold', price: 50000, colors: ['#ffd166'], rank: 30 },
];

export const LIVERIES: Cosmetic[] = [
  { id: 'l-none', kind: 'livery', name: 'Clean', price: 0, colors: [] },
  { id: 'l-stripes', kind: 'livery', name: 'Racing Stripes', price: 700, colors: ['#ffffff'] },
  { id: 'l-roundel', kind: 'livery', name: 'Number 7', price: 900, colors: ['#ffffff', '#1d1238'] },
  { id: 'l-swoosh', kind: 'livery', name: 'Side Swoosh', price: 1800, colors: ['#1d1238'], rank: 6 },
  { id: 'l-flames', kind: 'livery', name: 'Hot Rod Flames', price: 3500, colors: ['#ff8500', '#ffd23f'], rank: 10 },
  { id: 'l-checker', kind: 'livery', name: 'Checker Tail', price: 3500, colors: ['#ffffff', '#1d1238'], rank: 10 },
  { id: 'l-camo', kind: 'livery', name: 'Splatter Camo', price: 8000, colors: ['#1d3557', '#06d6a0'], rank: 18 },
  { id: 'l-rainbow', kind: 'livery', name: 'Rainbow Bar', price: 25000, colors: ['#e63946', '#ffd23f', '#06d6a0', '#2d6cdf'], rank: 26 },
];

export const WHEELS: Cosmetic[] = [
  { id: 'w-steel', kind: 'wheels', name: 'Steelies', price: 0, colors: ['#555'] },
  { id: 'w-classic', kind: 'wheels', name: 'Classic Five', price: 800, colors: ['#cfcfcf'] },
  { id: 'w-mesh', kind: 'wheels', name: 'Mesh', price: 2000, colors: ['#e0e0e0'], rank: 6 },
  { id: 'w-star', kind: 'wheels', name: 'Starburst', price: 4000, colors: ['#ffd23f'], rank: 12 },
  { id: 'w-turbine', kind: 'wheels', name: 'Turbine', price: 9000, colors: ['#1d1238'], rank: 20 },
  { id: 'w-deep', kind: 'wheels', name: 'Deep Dish Gold', price: 30000, colors: ['#ffd166'], rank: 30 },
];

export const ENVS: Cosmetic[] = [
  { id: 'e-desert', kind: 'env', name: 'Sunset Strip', price: 0, colors: ['#ffb703'] },
  { id: 'e-harbor', kind: 'env', name: 'Harbor Mile', price: 5000, colors: ['#5ad1ff'], rank: 8 },
  { id: 'e-alpine', kind: 'env', name: 'Alpine Run', price: 20000, colors: ['#8bd17c'], rank: 16 },
  { id: 'e-fair', kind: 'env', name: 'Lantern Fair', price: 60000, colors: ['#ff6b9d'], rank: 24 },
];

export const COSMETICS: Record<CosmeticKind, Cosmetic[]> = { helmet: HELMETS, suit: SUITS, paint: PAINTS, livery: LIVERIES, wheels: WHEELS, env: ENVS };
export const KIND_NAME: Record<CosmeticKind, string> = { helmet: 'Helmets', suit: 'Suits', paint: 'Paint', livery: 'Liveries', wheels: 'Wheels', env: 'Strips' };

const ALL = new Map<string, Cosmetic>();
for (const list of Object.values(COSMETICS)) for (const c of list) ALL.set(c.id, c);
export const getCosmetic = (id: string): Cosmetic | undefined => ALL.get(id);
/** The free default of each kind. */
export const DEFAULTS: Record<CosmeticKind, string> = { helmet: 'h-white', suit: 's-navy', paint: 'p-stock', livery: 'l-none', wheels: 'w-steel', env: 'e-desert' };
