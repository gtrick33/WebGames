/**
 * The roster: 40 original cars whose silhouettes follow familiar real-world shapes (a French
 * supermini, a German hot hatch, an American muscle coupe, an Italian V12 wedge, a Swedish
 * hypercar…) under invented makers and names. No real make, model or logo appears anywhere.
 * Stats are the stock car; parts (parts.ts) build on them; `shape` is what the 3D builder draws.
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
  car('bumble', 'Bumble', 'Vossberg', 1967, 1, 0, 'Classic', st(100, 150, 780, 'rwd', 4, 5200, 0.95, 0.68, 0.9), '#ffd23f', 'The round little rear-engined classic everyone starts in. Slow, cheerful, unbreakable.', shape('bug')),
  car('pico-pop', 'Pico Pop', 'Pico', 2004, 1, 1800, 'Supermini', st(122, 165, 900, 'fwd', 5, 6400, 0.98, 0.64, 0.85), '#ff6b9d', 'A French city hatch with go-kart nerves. Light enough to surprise.', shape('supermini', { lights: 'round', grille: 'slim' })),
  car('pico-dot', 'Pico Dot', 'Pico', 2019, 1, 2400, 'Supermini', st(134, 220, 1150, 'fwd', 6, 6300, 1.0, 0.64, 0.9), '#2d6cdf', 'Tiny, boxy, round-eyed and far quicker than it looks.', shape('supermini', { len: 3.8, belt: 1.0, lights: 'round', tails: 'round', grille: 'twin', cabin: { roof: 1.46, taper: 0.14 } })),
  car('griffon', 'Griffon 1.9', 'Ravelle', 1988, 1, 2800, 'Hot hatch', st(130, 160, 880, 'fwd', 5, 6800, 0.98, 0.62, 0.8), '#f4f4f4', 'The eighties hot hatch that taught a generation to lift off mid-corner.', shape('supermini', { len: 3.7, nose: 0.66, lights: 'rect', tails: 'rect', grille: 'slim', cabin: { kind: 'hatch', taper: 0.16 } })),
  car('kestrel', 'Kestrel 1.6', 'Kurogane', 1996, 1, 2600, 'Coupe', st(130, 150, 1050, 'fwd', 5, 7600, 0.95, 0.6, 0.9), '#5ad1ff', 'Screaming little Japanese front-driver. Loves a high redline.', shape('sports', { len: 4.4, nose: 0.62, belt: 0.92, lights: 'slim', tails: 'bar', grille: 'slim', cabin: { from: 0.1, kind: 'fast' } })),
  car('astro', 'Astro 2.0', 'Brennheim', 2012, 1, 3000, 'Hatch', st(180, 230, 1250, 'fwd', 6, 6600, 1.0, 0.63, 0.9), '#c4f034', 'A sensible German hatch with a turbo it rarely mentions.', shape('hatch')),
  car('rustler', 'Rustler', 'Hadley', 1978, 1, 2200, 'Pickup', st(205, 370, 1650, 'rwd', 4, 4800, 0.92, 0.92, 0.8), '#e8562a', 'A farm truck with a big lazy V8. Torque for days, brakes optional.', shape('pickup', { len: 5.2, nose: 0.98, cowl: 1.1, lights: 'round', grille: 'upright', features: ['bed', 'chrome', 'bullbar'] })),
  car('longroof', 'Longroof 240', 'Nordvik', 1988, 1, 3200, 'Wagon', st(210, 300, 1380, 'rwd', 5, 6200, 0.95, 0.68, 0.95), '#8bd17c', 'The Swedish brick on wheels. Boxy, honest, built like a bank vault.', shape('wagon', { lights: 'rect', grille: 'upright', cabin: { taper: 0.12, roof: 1.48 } })),
  car('dune-bug', 'Dune Bug', 'Ravelle', 1972, 1, 2900, 'Buggy', st(110, 140, 700, 'rwd', 4, 5600, 0.86, 0.9, 0.7), '#ffa630', 'An open-wheel beach toy. Featherweight, wobbly, loud.', shape('buggy')),
  // ---- Tier 2: club
  car('vossberg-gti', 'Vossberg GTi', 'Vossberg', 2015, 2, 9000, 'Hot hatch', st(220, 350, 1300, 'fwd', 6, 6800, 1.0, 0.62, 0.9), '#e63946', 'The hot hatch that started it all: tidy, torquey, tartan seats.', shape('hatch', { grille: 'slim', features: ['lip'] })),
  car('lazzaro', 'Lazzaro Spider', 'Stallone', 2016, 2, 11000, 'Roadster', st(240, 320, 1120, 'rwd', 6, 7000, 1.02, 0.6, 0.85), '#ff3b30', 'A little Italian roadster. Light and sweet, no roof needed.', shape('roadster', { lights: 'slim', grille: 'oval' })),
  car('tsubasa', 'Tsubasa R', 'Kurogane', 1999, 2, 14000, 'Rally sedan', st(280, 370, 1360, 'awd', 5, 7000, 1.05, 0.68, 0.85), '#2d6cdf', 'Rally-bred turbo sedan with a bonnet scoop. All-wheel drive hooks up like glue.', shape('sedan', { len: 4.4, lights: 'rect', tails: 'rect', grille: 'wide', features: ['scoop', 'bigwing'] })),
  car('stallion', "Stallion '69", 'Bluegrass', 1969, 2, 13000, 'Muscle', st(335, 540, 1560, 'rwd', 4, 5800, 0.9, 0.78, 0.8), '#1b4332', 'The big-block pony coupe. Smokes its tyres if you look at it wrong.', shape('muscle', { len: 4.75, nose: 0.78, lights: 'quad', tails: 'split', grille: 'wide', features: ['scoop', 'chrome'] })),
  car('kurogane-gt', 'Kurogane GT', 'Kurogane', 1994, 2, 16000, 'Coupe', st(320, 430, 1510, 'rwd', 6, 6800, 1.0, 0.63, 0.95), '#f4f4f4', 'Nineties Japanese turbo legend with the big hoop wing. Takes any amount of boost.', shape('gt', { len: 4.5, lights: 'slim', tails: 'round', grille: 'slim', features: ['bigwing'] })),
  car('kaiser', 'Kaiser 3', 'Brennheim', 1990, 2, 12000, 'Sports sedan', st(215, 230, 1200, 'rwd', 5, 7200, 1.0, 0.64, 0.9), '#ffffff', 'The boxy Bavarian sports sedan with box flares and a snarl.', shape('sedan', { len: 4.35, nose: 0.7, belt: 0.98, lights: 'quad', tails: 'rect', grille: 'twin', cabin: { taper: 0.14, roof: 1.38 }, features: ['wide', 'lip'] })),
  car('bayou-boss', 'Bayou Boss', 'Hadley', 2020, 2, 15000, 'Pickup', st(400, 600, 2300, 'awd', 8, 5800, 0.95, 0.99, 0.85), '#3d405b', 'A lifted truck with a supercharger. Subtle it is not.', shape('pickup', { clear: 0.42, wheels: { r: 0.42, w: 0.32 }, lights: 'slim', grille: 'upright', features: ['bed', 'scoop'] })),
  // ---- Tier 3: pro
  car('rotary-rebel', 'Rotary Rebel', 'Kurogane', 2002, 3, 26000, 'Sports', st(280, 310, 1270, 'rwd', 5, 8500, 1.03, 0.58, 0.65), '#ffb703', 'Tiny spinning engine, pop-up lights, sky-high redline, fragile as glass.', shape('sports', { nose: 0.56, lights: 'popup', tails: 'round', grille: 'none', features: ['wing'] })),
  car('brickhouse', 'Brickhouse T6', 'Nordvik', 2019, 3, 30000, 'Wagon', st(350, 480, 1750, 'awd', 8, 6500, 1.02, 0.7, 0.9), '#6c757d', 'A Swedish family wagon, turbo and supercharger. The school-run sleeper.', shape('wagon', { lights: 'slim', tails: 'bar', grille: 'wide', cabin: { taper: 0.22 } })),
  car('comet-ss', 'Comet SS', 'Bluegrass', 2018, 3, 38000, 'Muscle', st(455, 617, 1680, 'rwd', 6, 6500, 1.02, 0.74, 0.85), '#ff8500', 'Modern muscle with a huge V8 and a stick shift.', shape('muscle', { nose: 0.7, lights: 'slim', tails: 'bar', grille: 'wide', features: ['lip'] })),
  car('gullwing', "Gullwing '55", 'Vossberg', 1955, 3, 42000, 'Classic GT', st(300, 400, 1300, 'rwd', 4, 6000, 0.9, 0.6, 0.75), '#c0c0c0', 'Silver fifties grand tourer with doors that open upward.', shape('gt', { len: 4.5, nose: 0.66, belt: 0.92, lights: 'round', tails: 'round', grille: 'oval', features: ['chrome'], cabin: { roof: 1.3, taper: 0.3 } })),
  car('panther', 'Panther Mk IV', 'Ashford', 1965, 3, 36000, 'Classic GT', st(400, 550, 1450, 'rwd', 5, 6200, 0.95, 0.6, 0.7), '#0b3d2e', 'British racing green, a long bonnet and a big American heart.', shape('gt', { len: 4.8, nose: 0.62, lights: 'round', tails: 'round', grille: 'oval', features: ['chrome'], cabin: { from: 0.14, to: 0.5, roofFrom: 0.26, roofTo: 0.4 } })),
  car('sakura', 'Sakura Type-S', 'Kurogane', 2023, 3, 33000, 'Hot hatch', st(315, 420, 1430, 'fwd', 6, 7000, 1.08, 0.64, 0.95), '#ff4d8d', 'The sharpest front-driver ever built. Pink, obviously.', shape('hatch', { len: 4.55, nose: 0.62, lights: 'slim', tails: 'bar', grille: 'mesh', features: ['bigwing', 'vents', 'lip'] })),
  car('marlin', 'Marlin Spider', 'Stallone', 1991, 3, 28000, 'Roadster', st(280, 300, 1200, 'rwd', 5, 7500, 1.0, 0.6, 0.8), '#118ab2', 'An open Italian two-seater with a shark nose.', shape('roadster', { len: 4.2, lights: 'slim', grille: 'oval', features: ['chrome'] })),
  // ---- Tier 4: elite
  car('ironhide', 'Ironhide Z', 'Kurogane', 2023, 4, 60000, 'Sports', st(400, 475, 1590, 'rwd', 6, 6800, 1.05, 0.63, 0.9), '#8ecae6', 'Twin-turbo sports coupe with retro lines.', shape('sports', { len: 4.4, lights: 'slim', tails: 'bar', grille: 'wide', features: ['lip'] })),
  car('falkon', 'Falkon Turbo S', 'Vossberg', 2021, 4, 120000, 'Sports', st(580, 800, 1640, 'awd', 8, 7000, 1.12, 0.6, 0.95), '#ffffff', 'Rear-engined precision with the round lamps. Launches like it was fired.', shape('sports', { len: 4.55, nose: 0.62, deck: 0.9, tail: 0.76, lights: 'round', tails: 'bar', grille: 'none', features: ['wing', 'vents'], cabin: { from: 0.12, to: 0.62, roofFrom: 0.3, roofTo: 0.5, roof: 1.3, taper: 0.3, kind: 'fast' } })),
  car('vortex', 'Vortex GT-R', 'Kurogane', 2017, 4, 95000, 'Supercoupe', st(600, 650, 1750, 'awd', 6, 7000, 1.12, 0.66, 0.9), '#c9c9c9', 'The Japanese giant-slayer. Computers do half the driving; you do the rest.', shape('coupe', { len: 4.7, width: 1.9, lights: 'slim', tails: 'round', grille: 'wide', features: ['wing', 'lip'] })),
  car('sterling', 'Sterling GT', 'Brennheim', 2018, 4, 130000, 'GT', st(577, 700, 1640, 'rwd', 7, 7000, 1.1, 0.6, 0.9), '#2a9d8f', 'A long-nosed German GT with a grille like a shark grin.', shape('gt', { len: 4.55, nose: 0.6, lights: 'slim', tails: 'bar', grille: 'wide', features: ['lip'] })),
  car('widowmaker', 'Widowmaker', 'Bluegrass', 2016, 4, 110000, 'Supercar', st(650, 814, 1540, 'rwd', 6, 6400, 1.05, 0.65, 0.8), '#d62828', 'Ten cylinders, side pipes, no electronics, no mercy.', shape('gt', { len: 4.5, width: 1.94, nose: 0.56, lights: 'slim', tails: 'round', grille: 'oval', features: ['sidepipes', 'bigwing', 'vents'] })),
  car('ragazzo', 'Ragazzo V8', 'Stallone', 2013, 4, 140000, 'Supercar', st(560, 540, 1480, 'rwd', 7, 9000, 1.1, 0.6, 0.85), '#ff2a1a', 'Mid-engined Italian V8 that revs to nine thousand.', shape('super', { lights: 'slim', tails: 'round', grille: 'none' })),
  car('monarch', 'Monarch Phantom', 'Ashford', 2019, 4, 150000, 'Luxury', st(560, 900, 2300, 'awd', 8, 6000, 1.0, 0.72, 0.95), '#1d1238', 'A luxury barge with a twelve-cylinder whisper. Heavy, relentless.', shape('limo')),
  car('longbow', 'Longbow RS', 'Vossberg', 2020, 4, 115000, 'Wagon', st(592, 800, 2075, 'awd', 8, 6800, 1.1, 0.68, 0.9), '#5e548e', 'A German super-wagon: six hundred horses and a dog guard.', shape('wagon', { len: 4.95, width: 1.95, lights: 'slim', tails: 'bar', grille: 'mesh', features: ['lip'], cabin: { taper: 0.24 } })),
  // ---- Tier 5: legend
  car('toro', 'Toro Aventura', 'Stallone', 2020, 5, 320000, 'Supercar', st(760, 720, 1600, 'awd', 7, 8700, 1.15, 0.6, 0.85), '#c4f034', 'The Italian wedge. V12, all-wheel drive, scissor doors.', shape('super', { len: 4.8, width: 2.03, nose: 0.46, lights: 'slim', tails: 'rect', features: ['vents', 'lip', 'roofscoop'] })),
  car('stallone-812', 'Stallone 812', 'Stallone', 2021, 5, 350000, 'GT', st(790, 718, 1525, 'rwd', 7, 8900, 1.1, 0.62, 0.8), '#e63946', 'Front-engined V12 grand tourer. Rear tyres live short lives.', shape('gt', { len: 4.66, width: 1.97, nose: 0.56, lights: 'slim', tails: 'round', grille: 'oval', features: ['vents', 'lip'] })),
  car('peregrine', 'Peregrine 720', 'Ashford', 2019, 5, 310000, 'Supercar', st(710, 770, 1420, 'rwd', 7, 8500, 1.15, 0.58, 0.85), '#ff8500', 'A British carbon-tub supercar with eye-socket headlights.', shape('super', { len: 4.55, nose: 0.48, lights: 'slim', tails: 'strip', features: ['vents', 'wing'] })),
  car('wraith', 'Wraith GT3', 'Vossberg', 2022, 5, 230000, 'Track car', st(520, 470, 1420, 'rwd', 7, 9000, 1.2, 0.58, 0.95), '#06d6a0', 'A road-legal race car. Light, loud, laser-guided.', shape('sports', { len: 4.57, nose: 0.6, deck: 0.9, lights: 'round', tails: 'bar', grille: 'none', features: ['bigwing', 'vents', 'lip'], cabin: { from: 0.12, to: 0.62, roofFrom: 0.3, roofTo: 0.5, roof: 1.28, taper: 0.3 } })),
  car('hellion', 'Hellion Redeye', 'Bluegrass', 2021, 5, 180000, 'Muscle', st(800, 960, 2000, 'rwd', 8, 6500, 1.08, 0.76, 0.85), '#9b5de5', 'Supercharged American muscle, drag radials from the factory.', shape('muscle', { len: 5.0, width: 1.98, lights: 'quad', tails: 'bar', grille: 'wide', features: ['scoop', 'wide'] })),
  car('elektra', 'Elektra Plaid', 'Elektra', 2022, 5, 260000, 'Electric', st(1000, 1400, 2160, 'awd', 1, 20000, 1.12, 0.5, 0.95), '#f5f5f5', 'Electric sedan. One gear, instant torque, silent violence.', shape('sedan', { len: 4.98, width: 1.96, nose: 0.6, lights: 'slim', tails: 'bar', grille: 'none', cabin: { from: 0.14, to: 0.64, roofFrom: 0.28, roofTo: 0.5, roof: 1.42, taper: 0.26, kind: 'fast' } })),
  car('valkyr', 'Valkyr One', 'Nordvik', 2019, 5, 900000, 'Hypercar', st(1300, 1280, 1400, 'rwd', 7, 8200, 1.18, 0.56, 0.75), '#ff8fab', 'Swedish hypercar with a dihedral-door silhouette. Thirteen hundred horsepower through two tyres.', shape('hyper', { lights: 'slim', tails: 'bar' })),
  // ---- Tier 6: kings
  car('veyr', 'Veyr Royale', 'Ravelle', 2018, 6, 2200000, 'Hypercar', st(1500, 1600, 1995, 'awd', 7, 6700, 1.2, 0.6, 0.9), '#118ab2', 'Sixteen cylinders, four turbos, a horseshoe grille and two-tone paint.', shape('hyper', { len: 4.55, width: 2.04, nose: 0.56, lights: 'quad', tails: 'strip', grille: 'oval', features: ['vents', 'wing'], cabin: { roof: 1.2, taper: 0.3 } })),
  car('zephyr', 'Zephyr Tempesta', 'Arcadia', 2017, 6, 2600000, 'Hypercar', st(790, 1100, 1350, 'rwd', 7, 6800, 1.18, 0.57, 0.8), '#5e60ce', 'Italian art on wheels: twin-turbo V12, quad exhausts in a bundle, carbon everywhere.', shape('hyper', { len: 4.6, nose: 0.5, lights: 'quad', tails: 'round', grille: 'none', features: ['vents', 'bigwing', 'roofscoop'] })),
  car('nova', 'Elektra Nova', 'Elektra', 2023, 6, 2100000, 'Electric hypercar', st(1900, 2360, 2150, 'awd', 1, 20000, 1.25, 0.56, 0.9), '#8ecae6', 'Four motors, no gears, and the quickest launch on the strip.', shape('hyper', { len: 4.75, width: 2.0, lights: 'slim', tails: 'strip', grille: 'none', features: ['vents', 'lip'] })),
  car('nitro-funny', 'Nitro Funny', 'Hadley', 2024, 6, 1500000, 'Funny car', st(2500, 3000, 1100, 'rwd', 3, 8500, 2.4, 0.9, 0.5), '#ffd166', 'A fibreglass shell over a nitro-fed monster. Rebuilt after every run.', shape('funny')),
  car('rail', 'Rail Dragster', 'Bluegrass', 2024, 6, 3000000, 'Dragster', st(3000, 3600, 1000, 'rwd', 3, 8500, 3.0, 0.8, 0.55), '#ff006e', 'The long one. Nothing on this strip is faster.', shape('dragster')),
];

export const DEFAULT_CAR = 'bumble';

const BY_ID = new Map(CARS.map((c) => [c.id, c]));
export const getCar = (id: string): CarDef => BY_ID.get(id) ?? CARS[0]!;

export const TIER_NAME: Record<CarDef['tier'], string> = { 1: 'Street', 2: 'Club', 3: 'Pro', 4: 'Elite', 5: 'Legend', 6: 'King' };
