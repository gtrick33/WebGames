/**
 * The roster: 28 original cars under invented makers and names, each on its own body (RG Poly's city
 * cars low down, Cosmo's off-roaders, police cars and exotics higher up: models.ts), and each with one
 * signature trait that changes how it drives (TRAIT_INFO). No real make, model or logo appears
 * anywhere. Stats are the stock car; parts (parts.ts) build on them; `shape` is what the fallback 3D
 * builder draws when a model can't load.
 */
export type Drive = 'rwd' | 'awd' | 'fwd';

export type CabinKind = 'notch' | 'fast' | 'hatch' | 'wagon' | 'open' | 'cab' | 'bug' | 'none';
export type LightStyle = 'slim' | 'round' | 'rect' | 'popup' | 'quad' | 'bar';
export type TailStyle = 'bar' | 'round' | 'rect' | 'split' | 'strip';
export type GrilleStyle = 'wide' | 'slim' | 'oval' | 'none' | 'twin' | 'mesh' | 'upright';
/** What makes a car itself on the strip (sim.ts reads it; the garage shows it as a badge). */
export type Trait = 'light' | 'turbo' | 'torque' | 'revs' | 'electric' | 'pursuit' | 'awd' | 'nitro';

export const TRAIT_INFO: Record<Trait, { name: string; icon: string; blurb: string }> = {
  light: { name: 'Featherweight', icon: '🪶', blurb: 'Lighter, and a perfect shift snaps through in half the time.' },
  turbo: { name: 'Turbo', icon: '🌀', blurb: 'Soft low down, then the boost hits hard late in every gear.' },
  torque: { name: 'Big torque', icon: '💪', blurb: 'Pulls hardest off the line and low in each gear. Easy to spin.' },
  revs: { name: 'Rev monster', icon: '🎵', blurb: '700 rpm more, tighter greens and a harder kick from a perfect shift.' },
  electric: { name: 'Electric overdrive', icon: '⚡', blurb: 'No gears: tap when the charge meter peaks for a surge, five times a run.' },
  pursuit: { name: 'Pursuit special', icon: '🚨', blurb: 'The most forgiving launch on the strip: perfect up to 0.36 s.' },
  awd: { name: 'All-wheel grip', icon: '🛞', blurb: 'Four driven wheels: it never spins away a launch or a shift.' },
  nitro: { name: 'Nitrous', icon: '🔥', blurb: 'One big shot a run: from second gear on, hold the button down to fire it.' },
};

export type Feature = 'wing' | 'bigwing' | 'lip' | 'scoop' | 'vents' | 'sidepipes' | 'roofscoop' | 'bed' | 'rails' | 'fins' | 'bullbar' | 'chrome' | 'canopy' | 'wide' | 'targa' | 'hump';

/** The recipe the 3D builder turns into a body. Lengths in metres, x fractions run 0 (tail) to 1 (nose). */
export interface Shape {
  len: number;
  width: number;
  /** Heights: nose top, cowl (hood rear), belt line (door top), rear deck, tail top, body clearance. */
  nose: number;
  cowl: number;
  belt: number;
  deck: number;
  tail: number;
  clear: number;
  cabin: { from: number; to: number; roofFrom: number; roofTo: number; roof: number; taper: number; kind: CabinKind };
  wheels: { r: number; rearR?: number; front: number; rear: number; w: number };
  lights: LightStyle;
  tails: TailStyle;
  grille: GrilleStyle;
  features: Feature[];
  /** Doors per side: where the seam lines go. */
  doors: 1 | 2;
}

export interface CarDef {
  id: string;
  name: string;
  maker: string;
  year: number;
  /** 1 (street) to 6 (king). Drives prices, materials and which division it fits. */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  price: number;
  /** The real-world body type, for the dealer's filter chips. */
  kind: string;
  hp: number;
  torque: number;
  mass: number;
  drive: Drive;
  gears: number;
  redline: number;
  grip: number;
  drag: number;
  reliability: number;
  color: string;
  blurb: string;
  trait: Trait;
  shape: Shape;
}

type Arch = 'supermini' | 'hatch' | 'sedan' | 'coupe' | 'muscle' | 'gt' | 'sports' | 'super' | 'hyper' | 'roadster' | 'wagon' | 'pickup' | 'suv' | 'bug' | 'buggy' | 'funny' | 'dragster' | 'limo';

const ARCH: Record<Arch, Shape> = {
  supermini: { len: 3.9, width: 1.72, nose: 0.72, cowl: 0.86, belt: 0.98, deck: 0.98, tail: 0.86, clear: 0.2, cabin: { from: 0.06, to: 0.62, roofFrom: 0.12, roofTo: 0.46, roof: 1.5, taper: 0.2, kind: 'hatch' }, wheels: { r: 0.3, front: 0.84, rear: 0.17, w: 0.2 }, lights: 'rect', tails: 'rect', grille: 'slim', features: [], doors: 2 },
  hatch: { len: 4.25, width: 1.78, nose: 0.68, cowl: 0.86, belt: 0.98, deck: 0.98, tail: 0.84, clear: 0.18, cabin: { from: 0.05, to: 0.6, roofFrom: 0.12, roofTo: 0.44, roof: 1.46, taper: 0.2, kind: 'hatch' }, wheels: { r: 0.32, front: 0.84, rear: 0.17, w: 0.22 }, lights: 'slim', tails: 'rect', grille: 'wide', features: [], doors: 2 },
  sedan: { len: 4.7, width: 1.82, nose: 0.66, cowl: 0.84, belt: 0.96, deck: 0.9, tail: 0.74, clear: 0.17, cabin: { from: 0.2, to: 0.62, roofFrom: 0.3, roofTo: 0.48, roof: 1.42, taper: 0.22, kind: 'notch' }, wheels: { r: 0.33, front: 0.83, rear: 0.17, w: 0.23 }, lights: 'slim', tails: 'bar', grille: 'wide', features: [], doors: 2 },
  coupe: { len: 4.5, width: 1.84, nose: 0.6, cowl: 0.8, belt: 0.92, deck: 0.88, tail: 0.72, clear: 0.16, cabin: { from: 0.16, to: 0.6, roofFrom: 0.34, roofTo: 0.5, roof: 1.3, taper: 0.24, kind: 'fast' }, wheels: { r: 0.33, front: 0.83, rear: 0.17, w: 0.25 }, lights: 'slim', tails: 'bar', grille: 'wide', features: [], doors: 1 },
  muscle: { len: 4.85, width: 1.92, nose: 0.74, cowl: 0.9, belt: 1.0, deck: 0.94, tail: 0.8, clear: 0.16, cabin: { from: 0.18, to: 0.6, roofFrom: 0.3, roofTo: 0.47, roof: 1.38, taper: 0.22, kind: 'fast' }, wheels: { r: 0.34, front: 0.83, rear: 0.17, w: 0.27 }, lights: 'quad', tails: 'split', grille: 'wide', features: ['scoop'], doors: 1 },
  gt: { len: 4.75, width: 1.9, nose: 0.6, cowl: 0.78, belt: 0.9, deck: 0.84, tail: 0.7, clear: 0.15, cabin: { from: 0.12, to: 0.56, roofFrom: 0.28, roofTo: 0.44, roof: 1.28, taper: 0.26, kind: 'fast' }, wheels: { r: 0.34, front: 0.82, rear: 0.16, w: 0.27 }, lights: 'slim', tails: 'round', grille: 'oval', features: [], doors: 1 },
  sports: { len: 4.3, width: 1.82, nose: 0.6, cowl: 0.76, belt: 0.9, deck: 0.86, tail: 0.7, clear: 0.15, cabin: { from: 0.1, to: 0.6, roofFrom: 0.26, roofTo: 0.48, roof: 1.28, taper: 0.26, kind: 'fast' }, wheels: { r: 0.33, front: 0.83, rear: 0.16, w: 0.26 }, lights: 'slim', tails: 'round', grille: 'slim', features: [], doors: 1 },
  super: { len: 4.6, width: 1.98, nose: 0.5, cowl: 0.72, belt: 0.88, deck: 0.92, tail: 0.76, clear: 0.13, cabin: { from: 0.28, to: 0.7, roofFrom: 0.36, roofTo: 0.55, roof: 1.18, taper: 0.3, kind: 'fast' }, wheels: { r: 0.34, front: 0.8, rear: 0.17, w: 0.3 }, lights: 'slim', tails: 'round', grille: 'none', features: ['vents', 'lip'], doors: 1 },
  hyper: { len: 4.7, width: 2.04, nose: 0.5, cowl: 0.7, belt: 0.86, deck: 0.92, tail: 0.74, clear: 0.12, cabin: { from: 0.26, to: 0.68, roofFrom: 0.34, roofTo: 0.52, roof: 1.16, taper: 0.32, kind: 'fast' }, wheels: { r: 0.35, front: 0.8, rear: 0.17, w: 0.33 }, lights: 'slim', tails: 'bar', grille: 'none', features: ['vents', 'bigwing', 'roofscoop'], doors: 1 },
  roadster: { len: 3.95, width: 1.74, nose: 0.6, cowl: 0.78, belt: 0.88, deck: 0.86, tail: 0.72, clear: 0.15, cabin: { from: 0.2, to: 0.6, roofFrom: 0.3, roofTo: 0.5, roof: 1.22, taper: 0.26, kind: 'open' }, wheels: { r: 0.31, front: 0.82, rear: 0.17, w: 0.23 }, lights: 'popup', tails: 'round', grille: 'oval', features: [], doors: 1 },
  wagon: { len: 4.8, width: 1.84, nose: 0.68, cowl: 0.86, belt: 0.98, deck: 0.98, tail: 0.88, clear: 0.17, cabin: { from: 0.04, to: 0.6, roofFrom: 0.07, roofTo: 0.46, roof: 1.5, taper: 0.18, kind: 'wagon' }, wheels: { r: 0.33, front: 0.83, rear: 0.16, w: 0.23 }, lights: 'rect', tails: 'rect', grille: 'wide', features: [], doors: 2 },
  pickup: { len: 5.4, width: 1.98, nose: 0.9, cowl: 1.06, belt: 1.16, deck: 1.12, tail: 1.06, clear: 0.3, cabin: { from: 0.42, to: 0.68, roofFrom: 0.46, roofTo: 0.6, roof: 1.78, taper: 0.16, kind: 'cab' }, wheels: { r: 0.37, front: 0.82, rear: 0.2, w: 0.26 }, lights: 'rect', tails: 'rect', grille: 'upright', features: ['bed'], doors: 1 },
  suv: { len: 4.8, width: 1.96, nose: 0.86, cowl: 1.04, belt: 1.14, deck: 1.14, tail: 1.02, clear: 0.26, cabin: { from: 0.05, to: 0.62, roofFrom: 0.08, roofTo: 0.5, roof: 1.76, taper: 0.16, kind: 'wagon' }, wheels: { r: 0.36, front: 0.83, rear: 0.17, w: 0.26 }, lights: 'rect', tails: 'rect', grille: 'upright', features: [], doors: 2 },
  bug: { len: 4.05, width: 1.6, nose: 0.62, cowl: 0.8, belt: 0.96, deck: 0.8, tail: 0.58, clear: 0.22, cabin: { from: 0.2, to: 0.66, roofFrom: 0.32, roofTo: 0.5, roof: 1.5, taper: 0.28, kind: 'bug' }, wheels: { r: 0.3, front: 0.82, rear: 0.2, w: 0.18 }, lights: 'round', tails: 'round', grille: 'none', features: ['chrome'], doors: 1 },
  buggy: { len: 3.2, width: 1.6, nose: 0.5, cowl: 0.62, belt: 0.7, deck: 0.66, tail: 0.5, clear: 0.3, cabin: { from: 0.3, to: 0.62, roofFrom: 0.4, roofTo: 0.5, roof: 1.0, taper: 0.2, kind: 'open' }, wheels: { r: 0.34, front: 0.8, rear: 0.2, w: 0.28 }, lights: 'round', tails: 'round', grille: 'none', features: ['chrome'], doors: 1 },
  funny: { len: 5.6, width: 2.0, nose: 0.52, cowl: 0.78, belt: 0.92, deck: 1.0, tail: 0.86, clear: 0.2, cabin: { from: 0.1, to: 0.52, roofFrom: 0.22, roofTo: 0.4, roof: 1.36, taper: 0.22, kind: 'fast' }, wheels: { r: 0.3, rearR: 0.5, front: 0.84, rear: 0.14, w: 0.4 }, lights: 'slim', tails: 'bar', grille: 'none', features: ['bigwing', 'hump'], doors: 1 },
  dragster: { len: 7.4, width: 0.8, nose: 0.3, cowl: 0.36, belt: 0.42, deck: 0.7, tail: 0.6, clear: 0.12, cabin: { from: 0.08, to: 0.2, roofFrom: 0.1, roofTo: 0.16, roof: 1.0, taper: 0.1, kind: 'none' }, wheels: { r: 0.22, rearR: 0.52, front: 0.93, rear: 0.1, w: 0.44 }, lights: 'slim', tails: 'strip', grille: 'none', features: ['rails', 'bigwing', 'canopy'], doors: 1 },
  limo: { len: 5.5, width: 1.96, nose: 0.84, cowl: 0.98, belt: 1.08, deck: 1.02, tail: 0.86, clear: 0.18, cabin: { from: 0.2, to: 0.6, roofFrom: 0.28, roofTo: 0.48, roof: 1.6, taper: 0.18, kind: 'notch' }, wheels: { r: 0.36, front: 0.82, rear: 0.17, w: 0.25 }, lights: 'rect', tails: 'rect', grille: 'upright', features: ['chrome'], doors: 2 },
};

type ShapeTweak = Partial<Omit<Shape, 'cabin' | 'wheels'>> & { cabin?: Partial<Shape['cabin']>; wheels?: Partial<Shape['wheels']> };
function shape(arch: Arch, t: ShapeTweak = {}): Shape {
  const base = ARCH[arch];
  return { ...base, ...t, cabin: { ...base.cabin, ...(t.cabin ?? {}) }, wheels: { ...base.wheels, ...(t.wheels ?? {}) }, features: t.features ?? base.features };
}

type Stats = Pick<CarDef, 'hp' | 'torque' | 'mass' | 'drive' | 'gears' | 'redline' | 'grip' | 'drag' | 'reliability'>;
const st = (hp: number, torque: number, mass: number, drive: Drive, gears: number, redline: number, grip: number, drag: number, reliability: number): Stats => ({ hp, torque, mass, drive, gears, redline, grip, drag, reliability });

const car = (id: string, name: string, maker: string, year: number, tier: CarDef['tier'], price: number, kind: string, s: Stats, color: string, trait: Trait, blurb: string, sh: Shape): CarDef => ({ id, name, maker, year, tier, price, kind, ...s, color, blurb, trait, shape: sh });

export const CARS: readonly CarDef[] = [
  // ---- Tier 1: street
  car('bumble', 'Bumble', 'Vossberg', 1972, 1, 0, 'Classic sedan', st(100, 150, 780, 'rwd', 4, 5200, 0.95, 0.68, 0.9), '#ff9f07', 'light', 'The round-eyed little family sedan everyone starts in. Slow, cheerful, and so light it shifts in a blink.', shape('sedan', { len: 4.1 })),
  car('pico-pop', 'Pico Pop', 'Pico', 1981, 1, 1600, 'City car', st(110, 165, 920, 'fwd', 5, 6400, 0.92, 0.64, 0.85), '#f3729b', 'turbo', 'A pink shoebox with a turbo the size of a melon. Nothing, nothing, then everything.', shape('supermini', { lights: 'round', grille: 'slim' })),
  car('rustler', 'Rustler', 'Hadley', 1974, 1, 2200, 'Pickup', st(215, 395, 1630, 'rwd', 4, 4800, 0.96, 0.92, 0.8), '#c82221', 'torque', 'A farm truck with a wooden bed and a big lazy V8. Torque for days, brakes optional.', shape('pickup', { len: 5.2, nose: 0.98, cowl: 1.1, lights: 'round', grille: 'upright', features: ['bed', 'chrome'] })),
  car('dune-bug', 'Trailhound', 'Nordvik', 1986, 1, 2800, 'Off-roader', st(160, 285, 1370, 'awd', 5, 5600, 0.94, 0.86, 0.95), '#6f8a3c', 'awd', 'A soft-top four-by-four on chunky tyres. It never spins away a launch, mud or tarmac.', shape('suv', { len: 4.2 })),
  car('cabbie', 'Night Cab', 'Hadley', 1988, 1, 3200, 'Taxi', st(200, 295, 1430, 'rwd', 4, 5400, 0.97, 0.72, 0.95), '#ffc21a', 'revs', 'Retired from the city rank with a million miles on it, rebuilt so often it now revs like a race engine.', shape('sedan', { lights: 'rect', tails: 'rect' })),
  car('longroof', 'Tow Mule', 'Hadley', 1979, 1, 3800, 'Tow truck', st(205, 325, 1450, 'rwd', 5, 5200, 0.94, 0.7, 0.95), '#f2b705', 'turbo', 'The breakdown truck that dragged half this strip home. Turbo diesel, crane and all.', shape('pickup', { lights: 'round', grille: 'upright', features: ['bed'] })),
  // ---- Tier 2: club
  car('griffon', 'Griffon 4WD', 'Ravelle', 1986, 2, 7500, 'Rally sedan', st(185, 250, 1200, 'awd', 5, 6800, 0.88, 0.62, 0.85), '#d3d2d5', 'awd', 'The silver brick with four driven wheels that won every snowy rally of its decade.', shape('supermini', { len: 3.9, nose: 0.66, lights: 'rect', tails: 'rect', grille: 'slim', cabin: { kind: 'hatch', taper: 0.16 } })),
  car('kestrel', 'Kestrel 1.6', 'Kurogane', 1984, 2, 8500, 'Compact', st(210, 220, 980, 'fwd', 6, 7800, 1.01, 0.6, 0.9), '#62c6e0', 'revs', 'A little Japanese compact that screams all the way past eight thousand.', shape('sedan', { len: 4.1, lights: 'slim', tails: 'bar', grille: 'slim' })),
  car('vossberg-gti', 'Vossberg GTi', 'Vossberg', 1983, 2, 9500, 'Hot hatch', st(220, 320, 1160, 'fwd', 6, 6800, 0.97, 0.62, 0.9), '#d62828', 'light', 'The hot hatch that started it all: tidy, light, and a lip spoiler from the factory.', shape('hatch', { grille: 'slim', features: ['lip'] })),
  car('astro', 'Astro Turbo', 'Brennheim', 1979, 2, 11000, 'Sedan', st(220, 325, 1350, 'rwd', 5, 6600, 0.9, 0.63, 0.9), '#2a9d8f', 'turbo', 'A long, sensible sedan with a turbo it never mentions. Until the top of second gear.', shape('sedan')),
  car('breadbox', 'Breadbox', 'Hadley', 1991, 2, 12500, 'Van', st(370, 620, 1850, 'rwd', 4, 5600, 1.02, 0.92, 0.9), '#c9b458', 'torque', 'A bakery van with a crate V8 where the flour used to go. Still smells of fresh bread.', shape('suv', { len: 4.9, cabin: { roof: 1.9 } })),
  car('interceptor', 'Interceptor', 'Hadley', 1992, 2, 14000, 'Police sedan', st(365, 510, 1580, 'rwd', 4, 5800, 1.11, 0.72, 0.95), '#1f1f2b', 'pursuit', 'Ex-highway patrol, sold at auction with the light bar still on. Built to catch speeders.', shape('sedan', { lights: 'rect', tails: 'rect' })),
  // ---- Tier 3: pro
  car('stallion', "Stallion '69", 'Bluegrass', 1969, 3, 22000, 'Big sedan', st(385, 610, 1560, 'rwd', 4, 5800, 0.91, 0.78, 0.8), '#6a2c91', 'torque', 'A big-block V8 in a tall family sedan. Smokes its tyres if you look at it wrong.', shape('sedan', { nose: 0.78, lights: 'quad', features: ['chrome'] })),
  car('sakura', 'Sakura Type-S', 'Kurogane', 1995, 3, 26000, 'Rally hatch', st(245, 310, 1240, 'awd', 6, 7400, 0.86, 0.62, 0.95), '#f6548b', 'light', 'A stripped rally hatch: no rear seats, no carpet, no mercy. Shifts before you finish blinking.', shape('hatch', { features: ['wing', 'lip'] })),
  car('tsubasa', 'Tsubasa R', 'Kurogane', 1989, 3, 30000, 'Sports sedan', st(335, 400, 1430, 'awd', 6, 7000, 0.93, 0.66, 0.85), '#3b54b6', 'turbo', 'Rally-bred turbo sedan with a wing from the factory. Lazy below four thousand, savage above.', shape('sedan', { len: 4.4, lights: 'rect', tails: 'rect', features: ['wing'] })),
  car('night-patrol', 'Night Patrol', 'Bluegrass', 1996, 3, 34000, 'Police sedan', st(475, 635, 1680, 'rwd', 5, 6200, 1.04, 0.7, 0.95), '#f2f2f2', 'pursuit', 'The pursuit special: heavy-duty everything and a V8 tuned to chase anything on this strip.', shape('sedan', { lights: 'rect', tails: 'rect' })),
  car('bayou-boss', 'Bayou Boss', 'Hadley', 1999, 3, 40000, 'Luxury SUV', st(610, 890, 2170, 'awd', 6, 5800, 1.18, 0.9, 0.95), '#1f1f1f', 'awd', 'A blacked-out luxury four-by-four with a supercharged V8. Big, heavy, and it never spins.', shape('suv')),
  // ---- Tier 4: elite
  car('ironhide', 'Ironhide Z', 'Kurogane', 1978, 4, 60000, 'Muscle sedan', st(520, 560, 1500, 'rwd', 6, 6800, 1.05, 0.63, 0.9), '#f7d02c', 'turbo', 'Twin turbos, retro lines and a wing you could slice bread with.', shape('muscle')),
  car('redline', 'Redline', 'Bluegrass', 1970, 4, 75000, 'Muscle', st(630, 865, 1720, 'rwd', 5, 6200, 1.09, 0.68, 0.85), '#e11d1b', 'torque', 'Long, low, red and loud. The muscle sedan everyone had on their wall.', shape('muscle', { len: 5.0 })),
  car('vortex', 'Vortex GT-R', 'Kurogane', 1995, 4, 95000, 'Sports coupe', st(555, 600, 1630, 'awd', 6, 7400, 1.05, 0.64, 0.9), '#3d2ea7', 'revs', 'The giant-slayer, wing and all. Revs like a bike and kicks like a mule when you nail a shift.', shape('coupe', { features: ['bigwing'] })),
  car('falkon', 'Falkon Turbo S', 'Vossberg', 1991, 4, 115000, 'Rally hatch', st(585, 750, 1570, 'awd', 7, 7000, 1.07, 0.6, 0.95), '#292929', 'awd', 'Black, winged, all-wheel drive. Launches like it was fired.', shape('hatch', { features: ['bigwing'] })),
  car('monarch', 'Monarch Phantom', 'Ashford', 1958, 4, 140000, 'Luxury cruiser', st(785, 1145, 2070, 'rwd', 6, 6000, 1.18, 0.72, 0.95), '#2f6fd6', 'nitro', 'A fifties land yacht with fins, chrome and a bottle of nitrous in the trunk. Heavy until you open the valve.', shape('limo')),
  // ---- Tier 5: legend
  car('hellion', 'Hellion Redeye', 'Bluegrass', 2019, 5, 190000, 'Muscle', st(980, 1175, 1750, 'rwd', 8, 6500, 1.25, 0.7, 0.85), '#2a4fd6', 'torque', 'Supercharged modern muscle with twin stripes and drag radials from the factory.', shape('muscle', { len: 5.0 })),
  car('elektra', 'Elektra Plaid', 'Elektra', 2022, 5, 260000, 'Electric', st(790, 1110, 2220, 'awd', 1, 20000, 0.95, 0.5, 0.95), '#f2f2f2', 'electric', 'An electric coupe with three motors and no gearbox. Silent, then violent.', shape('sedan', { lights: 'slim', grille: 'none' })),
  car('stallone-812', 'Stallone 812', 'Stallone', 2021, 5, 350000, 'Supercar', st(935, 850, 1460, 'rwd', 7, 8900, 1.24, 0.6, 0.8), '#d41e1e', 'revs', 'A long-nosed V12, red as a stop sign, that howls to nearly ten thousand.', shape('super')),
  // ---- Tier 6: kings (the wildest last)
  car('peregrine', 'Peregrine 720', 'Ashford', 2019, 6, 1100000, 'Supercar', st(1240, 1240, 1380, 'rwd', 7, 8000, 1.31, 0.56, 0.85), '#ff7a1a', 'turbo', 'A carbon-tub supercar with two turbos the size of beach balls. Nothing below five thousand, then warp.', shape('super', { features: ['vents', 'wing'] })),
  car('toro', 'Toro Aventura', 'Stallone', 2020, 6, 1600000, 'Hypercar', st(1420, 1310, 1520, 'awd', 7, 8700, 1.33, 0.58, 0.85), '#9bd32a', 'awd', 'The Italian wedge: V12, four driven wheels and a wing like a diving board. It simply does not spin.', shape('super', { features: ['vents', 'bigwing'] })),
  car('rail', 'Nightrail', 'Bluegrass', 2024, 6, 3000000, 'Hypercar', st(2085, 2505, 1280, 'rwd', 7, 8500, 1.65, 0.56, 0.6), '#141418', 'nitro', 'Black on black, built for one thing, with nitrous on tap. Nothing on this strip is faster.', shape('hyper')),
];

export const DEFAULT_CAR = 'bumble';

const BY_ID = new Map(CARS.map((c) => [c.id, c]));
export const getCar = (id: string): CarDef => BY_ID.get(id) ?? CARS[0]!;

export const TIER_NAME: Record<CarDef['tier'], string> = { 1: 'Street', 2: 'Club', 3: 'Pro', 4: 'Elite', 5: 'Legend', 6: 'King' };
