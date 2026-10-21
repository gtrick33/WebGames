/**
 * The roster: 50 original cars under invented makers and names, from a round-eyed family sedan on
 * RG Poly's city bodies to supercars and hypercars on Cosmo's (models.ts). No real make, model or
 * logo appears anywhere. Stats are the stock car; parts (parts.ts) build on them; `shape` is what
 * the fallback 3D builder draws when a model can't load.
 */
export type Drive = 'rwd' | 'awd' | 'fwd';

export type CabinKind = 'notch' | 'fast' | 'hatch' | 'wagon' | 'open' | 'cab' | 'bug' | 'none';
export type LightStyle = 'slim' | 'round' | 'rect' | 'popup' | 'quad' | 'bar';
export type TailStyle = 'bar' | 'round' | 'rect' | 'split' | 'strip';
export type GrilleStyle = 'wide' | 'slim' | 'oval' | 'none' | 'twin' | 'mesh' | 'upright';
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

const car = (id: string, name: string, maker: string, year: number, tier: CarDef['tier'], price: number, kind: string, s: Stats, color: string, blurb: string, sh: Shape): CarDef => ({ id, name, maker, year, tier, price, kind, ...s, color, blurb, shape: sh });

export const CARS: readonly CarDef[] = [
  // ---- Tier 1: street
  car('bumble', 'Bumble', 'Vossberg', 1972, 1, 0, 'Classic sedan', st(100, 150, 780, 'rwd', 4, 5200, 0.95, 0.68, 0.9), '#ff9f07', 'The round-eyed little family sedan everyone starts in. Slow, cheerful, unbreakable.', shape('sedan', { len: 4.1 })),
  car('pico-pop', 'Pico Pop', 'Pico', 1981, 1, 1800, 'City car', st(122, 165, 900, 'fwd', 5, 6400, 0.98, 0.64, 0.85), '#f3729b', 'A pink shoebox with go-kart nerves. Light enough to surprise.', shape('supermini', { lights: 'round', grille: 'slim' })),
  car('pico-dot', 'Pico Dot', 'Pico', 1984, 1, 2400, 'City car', st(134, 220, 1150, 'fwd', 6, 6300, 1.0, 0.64, 0.9), '#4093f2', 'Tiny, boxy, bolt upright and far quicker than it looks.', shape('supermini', { len: 3.8, belt: 1.0, lights: 'round', tails: 'round', grille: 'twin', cabin: { roof: 1.46, taper: 0.14 } })),
  car('griffon', 'Griffon 1.9', 'Ravelle', 1986, 1, 2800, 'Boxy sedan', st(130, 160, 880, 'fwd', 5, 6800, 0.98, 0.62, 0.8), '#d3d2d5', 'The silver brick that taught a generation to lift off mid-corner.', shape('supermini', { len: 3.7, nose: 0.66, lights: 'rect', tails: 'rect', grille: 'slim', cabin: { kind: 'hatch', taper: 0.16 } })),
  car('kestrel', 'Kestrel 1.6', 'Kurogane', 1984, 1, 2600, 'Compact', st(130, 150, 1050, 'fwd', 5, 7600, 0.95, 0.6, 0.9), '#62c6e0', 'A little Japanese compact that screams all the way to its redline.', shape('sedan', { len: 4.1, lights: 'slim', tails: 'bar', grille: 'slim' })),
  car('astro', 'Astro 2.0', 'Brennheim', 1979, 1, 3000, 'Sedan', st(180, 230, 1250, 'fwd', 6, 6600, 1.0, 0.63, 0.9), '#1d6dbd', 'A long, sensible sedan with a turbo it rarely mentions.', shape('sedan')),
  car('rustler', 'Rustler', 'Hadley', 1974, 1, 2200, 'Pickup', st(205, 370, 1650, 'rwd', 4, 4800, 0.92, 0.92, 0.8), '#c82221', 'A farm truck with a wooden bed and a big lazy V8. Torque for days, brakes optional.', shape('pickup', { len: 5.2, nose: 0.98, cowl: 1.1, lights: 'round', grille: 'upright', features: ['bed', 'chrome'] })),
  car('longroof', 'Tow Mule', 'Hadley', 1979, 1, 3200, 'Tow truck', st(210, 300, 1380, 'rwd', 5, 6200, 0.95, 0.68, 0.95), '#e23f2b', 'The breakdown truck that dragged half this strip home. Now it races, crane and all.', shape('pickup', { lights: 'round', grille: 'upright', features: ['bed'] })),
  car('dune-bug', 'Greenback', 'Vossberg', 1975, 1, 2900, 'Classic sedan', st(110, 140, 700, 'rwd', 4, 5600, 0.86, 0.9, 0.7), '#209731', "Bumble's lighter, louder cousin. Same round eyes, half the sense.", shape('sedan', { len: 4.1 })),
  car('cabbie', 'Night Cab', 'Hadley', 1988, 1, 3400, 'Taxi', st(190, 300, 1500, 'rwd', 4, 5400, 0.94, 0.72, 0.95), '#ff9f07', 'Retired from the city rank with a million miles on it. The meter still runs.', shape('sedan', { lights: 'rect', tails: 'rect' })),
  // ---- Tier 2: club
  car('vossberg-gti', 'Vossberg GTi', 'Vossberg', 1983, 2, 9000, 'Hot hatch', st(220, 350, 1300, 'fwd', 6, 6800, 1.0, 0.62, 0.9), '#3952b5', 'The hot hatch that started it all: tidy, torquey, a lip spoiler from the factory.', shape('hatch', { grille: 'slim', features: ['lip'] })),
  car('lazzaro', 'Lazzaro Corsa', 'Stallone', 1971, 2, 11000, 'Classic sedan', st(240, 320, 1120, 'rwd', 6, 7000, 1.02, 0.6, 0.85), '#ee1c1e', 'An Italian family sedan with a twin-cam heart and a red-hot temper.', shape('sedan', { len: 4.1 })),
  car('tsubasa', 'Tsubasa R', 'Kurogane', 1989, 2, 14000, 'Sports sedan', st(280, 370, 1360, 'awd', 5, 7000, 1.05, 0.68, 0.85), '#3b54b6', 'Rally-bred turbo sedan with a wing from the factory. All-wheel drive hooks up like glue.', shape('sedan', { len: 4.4, lights: 'rect', tails: 'rect', features: ['wing'] })),
  car('stallion', "Stallion '69", 'Bluegrass', 1969, 2, 13000, 'Big sedan', st(335, 540, 1560, 'rwd', 4, 5800, 0.9, 0.78, 0.8), '#ff9f07', 'A big-block V8 in a tall family sedan. Smokes its tyres if you look at it wrong.', shape('sedan', { nose: 0.78, lights: 'quad', features: ['chrome'] })),
  car('kurogane-gt', 'Kurogane GT', 'Kurogane', 1992, 2, 16000, 'Hot hatch', st(320, 430, 1510, 'rwd', 6, 6800, 1.0, 0.63, 0.95), '#dd7f2b', 'A Japanese pocket rocket with a turbo the size of its engine. Takes any amount of boost.', shape('hatch', { features: ['wing'] })),
  car('kaiser', 'Kaiser 3', 'Brennheim', 1980, 2, 12000, 'Sports sedan', st(215, 230, 1200, 'rwd', 5, 7200, 1.0, 0.64, 0.9), '#282828', 'The long black sports sedan with a straight six and a snarl.', shape('sedan', { len: 4.5, lights: 'quad', tails: 'rect', grille: 'twin' })),
  car('bayou-boss', 'Bayou Boss', 'Hadley', 1983, 2, 15000, 'Pickup', st(400, 600, 2300, 'awd', 8, 5800, 0.95, 0.99, 0.85), '#1f1f1f', 'A black pickup with a supercharger poking out. Subtle it is not.', shape('pickup', { lights: 'round', grille: 'upright', features: ['bed', 'scoop'] })),
  car('interceptor', 'Interceptor', 'Hadley', 1992, 2, 13500, 'Police sedan', st(300, 420, 1650, 'rwd', 4, 5800, 0.97, 0.72, 0.95), '#1f1f2b', 'Ex-highway patrol, sold at auction with the light bar still on. Built to catch speeders.', shape('sedan', { lights: 'rect', tails: 'rect' })),
  // ---- Tier 3: pro
  car('rotary-rebel', 'Rotary Rebel', 'Kurogane', 1985, 3, 26000, 'Sports sedan', st(280, 310, 1270, 'rwd', 5, 8500, 1.03, 0.58, 0.65), '#dcba1f', 'Tiny spinning engine, sky-high redline, a ducktail wing, fragile as glass.', shape('sedan', { len: 4.2, features: ['wing'] })),
  car('brickhouse', 'Brickhouse T6', 'Nordvik', 1987, 3, 30000, 'Sleeper', st(350, 480, 1750, 'awd', 8, 6500, 1.02, 0.7, 0.9), '#1d1d1d', 'A black shoebox hiding a turbo and a supercharger. The school-run sleeper.', shape('supermini', { len: 3.8, cabin: { roof: 1.5 } })),
  car('comet-ss', 'Comet SS', 'Bluegrass', 1976, 3, 38000, 'Big sedan', st(455, 617, 1680, 'rwd', 6, 6500, 1.02, 0.74, 0.85), '#fd9f09', "Black hood, huge V8, stick shift. The family sedan's evil twin.", shape('sedan', { nose: 0.74, lights: 'quad' })),
  car('gullwing', 'Silver Gull', 'Vossberg', 1977, 3, 42000, 'Compact', st(300, 400, 1300, 'rwd', 4, 6000, 0.9, 0.6, 0.75), '#d3d2d5', 'A white compact with a race engine behind its polite little face.', shape('sedan', { len: 4.1 })),
  car('panther', 'Panther Mk IV', 'Ashford', 1974, 3, 36000, 'Big sedan', st(400, 550, 1450, 'rwd', 5, 6200, 0.95, 0.6, 0.7), '#48a780', 'Racing green, a long bonnet and a big American heart.', shape('sedan', { nose: 0.74, lights: 'round', features: ['chrome'] })),
  car('sakura', 'Sakura Type-S', 'Kurogane', 1995, 3, 33000, 'Hot hatch', st(315, 420, 1430, 'fwd', 6, 7000, 1.08, 0.64, 0.95), '#f6548b', 'The sharpest front-driver ever built. Pink, obviously.', shape('hatch', { features: ['wing', 'lip'] })),
  car('marlin', 'Marlin RS', 'Stallone', 1988, 3, 28000, 'Sports sedan', st(280, 300, 1200, 'rwd', 5, 7500, 1.0, 0.6, 0.8), '#2f95a0', 'Teal, low and slippery, with a shark-fin spoiler on the boot.', shape('sedan', { len: 4.2, features: ['wing'] })),
  car('night-patrol', 'Night Patrol', 'Bluegrass', 1996, 3, 32000, 'Police sedan', st(420, 560, 1700, 'rwd', 5, 6200, 1.0, 0.7, 0.95), '#e3e3e3', 'The pursuit special: heavy-duty everything and a V8 tuned to chase anything on this strip.', shape('sedan', { lights: 'rect', tails: 'rect' })),
  // ---- Tier 4: elite
  car('ironhide', 'Ironhide Z', 'Kurogane', 1978, 4, 60000, 'Muscle sedan', st(400, 475, 1590, 'rwd', 6, 6800, 1.05, 0.63, 0.9), '#ff9f07', 'Twin turbos, retro lines and tail fins you could slice bread with.', shape('muscle')),
  car('falkon', 'Falkon Turbo S', 'Vossberg', 1991, 4, 120000, 'Rally hatch', st(580, 800, 1640, 'awd', 8, 7000, 1.12, 0.6, 0.95), '#292929', 'Black, winged, all-wheel drive. Launches like it was fired.', shape('hatch', { features: ['bigwing'] })),
  car('vortex', 'Vortex GT-R', 'Kurogane', 1995, 4, 95000, 'Sports coupe', st(600, 650, 1750, 'awd', 6, 7000, 1.12, 0.66, 0.9), '#3d2ea7', 'The giant-slayer, wing and all. Computers do half the driving; you do the rest.', shape('coupe', { features: ['bigwing'] })),
  car('sterling', 'Sterling GT', 'Brennheim', 1971, 4, 130000, 'Muscle', st(577, 700, 1640, 'rwd', 7, 7000, 1.1, 0.6, 0.9), '#4e8efc', 'A long-hooded coupe in electric blue with a grin full of chrome.', shape('muscle', { len: 5.0 })),
  car('widowmaker', 'Widowmaker', 'Bluegrass', 1990, 4, 110000, 'Hot hatch', st(650, 814, 1540, 'rwd', 6, 6400, 1.05, 0.65, 0.8), '#a81e19', 'Red, striped, ten cylinders where four should be. No electronics, no mercy.', shape('hatch', { features: ['wing'] })),
  car('ragazzo', 'Ragazzo V8', 'Stallone', 1993, 4, 140000, 'Rally hatch', st(560, 540, 1480, 'rwd', 7, 9000, 1.1, 0.6, 0.85), '#ad1e1a', 'An Italian rally special that revs to nine thousand.', shape('hatch', { features: ['bigwing'] })),
  car('monarch', 'Monarch Phantom', 'Ashford', 1958, 4, 150000, 'Luxury cruiser', st(560, 900, 2300, 'awd', 8, 6000, 1.0, 0.72, 0.95), '#2f6fd6', 'A fifties land yacht with fins, chrome and a twelve-cylinder whisper. Heavy, relentless.', shape('limo')),
  car('longbow', 'Longbow RS', 'Vossberg', 1981, 4, 115000, 'Muscle sedan', st(592, 800, 2075, 'awd', 8, 6800, 1.1, 0.68, 0.9), '#da201f', 'A super-sedan in racing stripes: six hundred horses and room for the dog.', shape('muscle')),
  car('blue-thunder', 'Blue Thunder', 'Kurogane', 1994, 4, 125000, 'Rally hatch', st(560, 700, 1450, 'awd', 6, 7600, 1.12, 0.62, 0.9), '#3a54bd', 'A works rally car let loose on tarmac: blue, white and sideways.', shape('hatch', { features: ['bigwing'] })),
  // ---- Tier 5: legend
  car('toro', 'Toro Aventura', 'Stallone', 2020, 5, 320000, 'Supercar', st(760, 720, 1600, 'awd', 7, 8700, 1.15, 0.6, 0.85), '#9bd32a', 'The Italian wedge: V12, all-wheel drive and a wing like a diving board.', shape('super', { features: ['vents', 'bigwing'] })),
  car('stallone-812', 'Stallone 812', 'Stallone', 2021, 5, 350000, 'Supercar', st(790, 718, 1525, 'rwd', 7, 8900, 1.1, 0.62, 0.8), '#d41e1e', 'A long-nosed V12, red as a stop sign. Rear tyres live short lives.', shape('super')),
  car('peregrine', 'Peregrine 720', 'Ashford', 2019, 5, 310000, 'Supercar', st(710, 770, 1420, 'rwd', 7, 8500, 1.15, 0.58, 0.85), '#ff7a1a', 'A carbon-tub supercar with a fixed wing and eye-socket lamps.', shape('super', { features: ['vents', 'wing'] })),
  car('wraith', 'Wraith GT3', 'Vossberg', 1990, 5, 230000, 'Track car', st(520, 470, 1420, 'rwd', 7, 9000, 1.2, 0.58, 0.95), '#1f1f1f', 'A road-legal race sedan in black and white. Light, loud, laser-guided.', shape('sedan', { len: 4.2, features: ['wing'] })),
  car('hellion', 'Hellion Redeye', 'Bluegrass', 1970, 5, 180000, 'Muscle', st(800, 960, 2000, 'rwd', 8, 6500, 1.08, 0.76, 0.85), '#2a4fd6', 'Supercharged muscle with twin stripes and drag radials from the factory.', shape('muscle', { len: 5.0 })),
  car('elektra', 'Elektra Plaid', 'Elektra', 2022, 5, 260000, 'Electric', st(1000, 1400, 2160, 'awd', 1, 20000, 1.12, 0.5, 0.95), '#f2f2f2', 'An electric four-door with a coupe roof. One gear, instant torque, silent violence.', shape('sedan', { lights: 'slim', grille: 'none' })),
  car('valkyr', 'Valkyr One', 'Nordvik', 2019, 5, 900000, 'Hypercar', st(1300, 1280, 1400, 'rwd', 7, 8200, 1.18, 0.56, 0.75), '#c9ccd3', 'A Swedish hypercar like a folded blade. Thirteen hundred horsepower through two tyres.', shape('hyper')),
  car('redline', 'Redline', 'Bluegrass', 1970, 5, 420000, 'Muscle', st(850, 980, 1850, 'rwd', 8, 6800, 1.12, 0.66, 0.85), '#e11d1b', 'Long, low, red and loud. The muscle coupe everyone has on their wall.', shape('muscle', { len: 5.0 })),
  // ---- Tier 6: kings (the wildest last)
  car('royal-flush', 'Royal Flush', 'Ashford', 1972, 6, 1500000, 'Muscle', st(2000, 2400, 1600, 'awd', 7, 7600, 1.35, 0.58, 0.8), '#4332b5', 'Royal purple with white stripes. Every card in the deck, all at once.', shape('muscle', { len: 5.0 })),
  car('goldrush', 'Goldrush', 'Ravelle', 1973, 6, 1800000, 'Muscle', st(1700, 1900, 1700, 'awd', 7, 7200, 1.25, 0.58, 0.85), '#e3b341', 'Gold paint, black stripes and a supercharger whine you can hear from the stands.', shape('muscle', { len: 5.0 })),
  car('nova', 'Elektra Nova', 'Elektra', 2023, 6, 2100000, 'Electric', st(1900, 2360, 2150, 'awd', 1, 20000, 1.25, 0.56, 0.9), '#5ad1ff', 'Four motors under a sleek four-door shell, and the quickest launch on the strip.', shape('sedan', { lights: 'slim', grille: 'none' })),
  car('zephyr', 'Zephyr Tempesta', 'Arcadia', 2017, 6, 2300000, 'Supercar', st(790, 1100, 1350, 'rwd', 7, 6800, 1.18, 0.57, 0.8), '#202026', 'Black on black, a twin-turbo V12 and quad exhausts in a bundle.', shape('super')),
  car('veyr', 'Veyr Royale', 'Ravelle', 2018, 6, 2500000, 'Hypercar', st(1500, 1600, 1995, 'awd', 7, 6700, 1.2, 0.6, 0.9), '#1f4fd8', 'Sixteen cylinders, four turbos, a fixed wing and two-tone paint.', shape('hyper', { features: ['vents', 'wing'] })),
  car('nitro-funny', 'Nitro Hornet', 'Hadley', 2024, 6, 2700000, 'Nitro supercar', st(2500, 3000, 1100, 'rwd', 3, 8500, 2.4, 0.9, 0.5), '#ff7a00', 'A winged wedge with a nitro-fed monster behind the seats. Rebuilt after every run.', shape('super', { features: ['bigwing'] })),
  car('rail', 'Nightrail', 'Bluegrass', 2024, 6, 3000000, 'Hypercar', st(3000, 3600, 1000, 'rwd', 3, 8500, 3.0, 0.8, 0.55), '#141418', 'Black on black, built for one thing. Nothing on this strip is faster.', shape('hyper')),
];

export const DEFAULT_CAR = 'bumble';

const BY_ID = new Map(CARS.map((c) => [c.id, c]));
export const getCar = (id: string): CarDef => BY_ID.get(id) ?? CARS[0]!;

export const TIER_NAME: Record<CarDef['tier'], string> = { 1: 'Street', 2: 'Club', 3: 'Pro', 4: 'Elite', 5: 'Legend', 6: 'King' };
