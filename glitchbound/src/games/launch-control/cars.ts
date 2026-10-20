/**
 * The roster: 33 original cars with recognisable silhouettes and invented makers (no real makes,
 * models or logos). Stats are the stock car; parts (parts.ts) build on them.
 */
export type Drive = 'rwd' | 'awd' | 'fwd';
/** Body silhouettes the renderer knows how to draw. */
export type BodyStyle = 'bug' | 'hatch' | 'coupe' | 'muscle' | 'pickup' | 'wagon' | 'roadster' | 'sedan' | 'buggy' | 'gt' | 'super' | 'hyper' | 'suv' | 'dragster' | 'van';

export interface CarDef {
  id: string;
  name: string;
  /** Invented marque. */
  maker: string;
  year: number;
  /** 1 (street) to 6 (legend). Drives prices, materials and which division it fits. */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  price: number;
  style: BodyStyle;
  hp: number;
  /** Peak torque, Nm. */
  torque: number;
  /** kg */
  mass: number;
  drive: Drive;
  gears: number;
  redline: number;
  /** Stock tyre grip multiplier. */
  grip: number;
  /** Drag area Cd·A in m². */
  drag: number;
  /** 0..1: how rarely parts fail when worn. */
  reliability: number;
  /** Stock paint. */
  color: string;
  blurb: string;
}

export const CARS: readonly CarDef[] = [
  // ---- Tier 1: street
  { id: 'bumble', name: 'Bumble', maker: 'Vossberg', year: 1967, tier: 1, price: 0, style: 'bug', hp: 72, torque: 110, mass: 820, drive: 'rwd', gears: 4, redline: 4800, grip: 0.9, drag: 0.72, reliability: 0.9, color: '#ffd23f', blurb: 'The round little classic everyone starts in. Slow, cheerful, unbreakable.' },
  { id: 'pico-pop', name: 'Pico Pop', maker: 'Pico', year: 2004, tier: 1, price: 1800, style: 'hatch', hp: 95, torque: 130, mass: 940, drive: 'fwd', gears: 5, redline: 6200, grip: 0.95, drag: 0.66, reliability: 0.85, color: '#ff6b9d', blurb: 'A city hatch with go-kart nerves. Light enough to surprise.' },
  { id: 'kestrel', name: 'Kestrel 1.6', maker: 'Kurogane', year: 1996, tier: 1, price: 2600, style: 'coupe', hp: 130, torque: 150, mass: 1050, drive: 'fwd', gears: 5, redline: 7600, grip: 0.95, drag: 0.6, reliability: 0.9, color: '#5ad1ff', blurb: 'Screaming little front-driver. Loves a high redline.' },
  { id: 'rustler', name: 'Rustler', maker: 'Hadley', year: 1978, tier: 1, price: 2200, style: 'pickup', hp: 150, torque: 300, mass: 1700, drive: 'rwd', gears: 4, redline: 4500, grip: 0.88, drag: 0.95, reliability: 0.8, color: '#e8562a', blurb: 'A farm truck with a big lazy V8. Torque for days, brakes optional.' },
  { id: 'longroof', name: 'Longroof', maker: 'Nordvik', year: 1988, tier: 1, price: 3200, style: 'wagon', hp: 165, torque: 240, mass: 1420, drive: 'rwd', gears: 5, redline: 6000, grip: 0.92, drag: 0.7, reliability: 0.95, color: '#8bd17c', blurb: 'The brick on wheels. Boxy, honest, built like a bank vault.' },
  { id: 'dune-bug', name: 'Dune Bug', maker: 'Ravelle', year: 1972, tier: 1, price: 2900, style: 'buggy', hp: 110, torque: 140, mass: 700, drive: 'rwd', gears: 4, redline: 5600, grip: 0.86, drag: 0.9, reliability: 0.7, color: '#ffa630', blurb: 'An open-wheel beach toy. Featherweight, wobbly, loud.' },
  // ---- Tier 2: club
  { id: 'vossberg-gti', name: 'Vossberg GTi', maker: 'Vossberg', year: 2015, tier: 2, price: 9000, style: 'hatch', hp: 220, torque: 350, mass: 1300, drive: 'fwd', gears: 6, redline: 6800, grip: 1.0, drag: 0.62, reliability: 0.9, color: '#e63946', blurb: 'The hot hatch that started it all: tidy, torquey, sensible shoes.' },
  { id: 'lazzaro', name: 'Lazzaro Spider', maker: 'Stallone', year: 2016, tier: 2, price: 11000, style: 'roadster', hp: 240, torque: 320, mass: 1120, drive: 'rwd', gears: 6, redline: 7000, grip: 1.02, drag: 0.6, reliability: 0.85, color: '#ff3b30', blurb: 'Little Italian roadster. Light and sweet, no roof needed.' },
  { id: 'tsubasa', name: 'Tsubasa R', maker: 'Kurogane', year: 1999, tier: 2, price: 14000, style: 'sedan', hp: 280, torque: 370, mass: 1360, drive: 'awd', gears: 5, redline: 7000, grip: 1.05, drag: 0.68, reliability: 0.85, color: '#2d6cdf', blurb: 'Rally-bred turbo sedan. All-wheel drive hooks up like glue.' },
  { id: 'stallion', name: "Stallion '69", maker: 'Bluegrass', year: 1969, tier: 2, price: 13000, style: 'muscle', hp: 335, torque: 540, mass: 1560, drive: 'rwd', gears: 4, redline: 5800, grip: 0.9, drag: 0.78, reliability: 0.8, color: '#1b4332', blurb: 'The big-block muscle coupe. Smokes its tyres if you look at it wrong.' },
  { id: 'kurogane-gt', name: 'Kurogane GT', maker: 'Kurogane', year: 1994, tier: 2, price: 16000, style: 'coupe', hp: 320, torque: 430, mass: 1510, drive: 'rwd', gears: 6, redline: 6800, grip: 1.0, drag: 0.63, reliability: 0.95, color: '#f4f4f4', blurb: 'Nineties turbo legend. Famously takes any amount of boost.' },
  { id: 'bayou-boss', name: 'Bayou Boss', maker: 'Hadley', year: 2020, tier: 2, price: 15000, style: 'pickup', hp: 400, torque: 600, mass: 2300, drive: 'awd', gears: 8, redline: 5800, grip: 0.95, drag: 1.0, reliability: 0.85, color: '#3d405b', blurb: 'A lifted truck with a supercharger. Subtle it is not.' },
  // ---- Tier 3: pro
  { id: 'rotary-rebel', name: 'Rotary Rebel', maker: 'Kurogane', year: 2002, tier: 3, price: 26000, style: 'coupe', hp: 280, torque: 310, mass: 1270, drive: 'rwd', gears: 5, redline: 8500, grip: 1.03, drag: 0.58, reliability: 0.65, color: '#ffb703', blurb: 'Tiny spinning engine, sky-high redline, fragile as glass.' },
  { id: 'brickhouse', name: 'Brickhouse T6', maker: 'Nordvik', year: 2019, tier: 3, price: 30000, style: 'wagon', hp: 350, torque: 480, mass: 1750, drive: 'awd', gears: 8, redline: 6500, grip: 1.02, drag: 0.7, reliability: 0.9, color: '#6c757d', blurb: 'Family wagon, turbo and supercharger. The school-run sleeper.' },
  { id: 'comet-ss', name: 'Comet SS', maker: 'Bluegrass', year: 2018, tier: 3, price: 38000, style: 'muscle', hp: 455, torque: 617, mass: 1680, drive: 'rwd', gears: 6, redline: 6500, grip: 1.02, drag: 0.74, reliability: 0.85, color: '#ff8500', blurb: 'Modern muscle with a huge V8 and a stick shift.' },
  { id: 'gullwing', name: "Gullwing '55", maker: 'Vossberg', year: 1955, tier: 3, price: 42000, style: 'gt', hp: 300, torque: 400, mass: 1300, drive: 'rwd', gears: 4, redline: 6000, grip: 0.9, drag: 0.6, reliability: 0.75, color: '#c0c0c0', blurb: 'Silver fifties grand tourer with doors that open upward.' },
  { id: 'panther', name: 'Panther Mk IV', maker: 'Ashford', year: 1965, tier: 3, price: 36000, style: 'gt', hp: 400, torque: 550, mass: 1450, drive: 'rwd', gears: 5, redline: 6200, grip: 0.95, drag: 0.6, reliability: 0.7, color: '#0b3d2e', blurb: 'British racing green with a big American heart.' },
  { id: 'sakura', name: 'Sakura Type-S', maker: 'Kurogane', year: 2023, tier: 3, price: 33000, style: 'hatch', hp: 315, torque: 420, mass: 1430, drive: 'fwd', gears: 6, redline: 7000, grip: 1.08, drag: 0.64, reliability: 0.95, color: '#ff4d8d', blurb: 'The sharpest front-driver ever built. Pink, obviously.' },
  // ---- Tier 4: elite
  { id: 'ironhide', name: 'Ironhide Z', maker: 'Kurogane', year: 2023, tier: 4, price: 60000, style: 'coupe', hp: 400, torque: 475, mass: 1590, drive: 'rwd', gears: 6, redline: 6800, grip: 1.05, drag: 0.63, reliability: 0.9, color: '#8ecae6', blurb: 'Twin-turbo sports coupe with retro lines.' },
  { id: 'falkon', name: 'Falkon Turbo S', maker: 'Vossberg', year: 2021, tier: 4, price: 120000, style: 'coupe', hp: 580, torque: 800, mass: 1640, drive: 'awd', gears: 8, redline: 7000, grip: 1.12, drag: 0.6, reliability: 0.95, color: '#ffffff', blurb: 'Rear-engined precision. Launches like it was fired.' },
  { id: 'vortex', name: 'Vortex GT-R', maker: 'Kurogane', year: 2017, tier: 4, price: 95000, style: 'coupe', hp: 600, torque: 650, mass: 1750, drive: 'awd', gears: 6, redline: 7000, grip: 1.12, drag: 0.66, reliability: 0.9, color: '#c9c9c9', blurb: 'The giant-slayer. Computers do half the driving; you do the rest.' },
  { id: 'widowmaker', name: 'Widowmaker', maker: 'Bluegrass', year: 2016, tier: 4, price: 110000, style: 'super', hp: 650, torque: 814, mass: 1540, drive: 'rwd', gears: 6, redline: 6400, grip: 1.05, drag: 0.65, reliability: 0.8, color: '#d62828', blurb: 'Ten cylinders, no electronics, no mercy.' },
  { id: 'ragazzo', name: 'Ragazzo V8', maker: 'Stallone', year: 2013, tier: 4, price: 140000, style: 'super', hp: 560, torque: 540, mass: 1480, drive: 'rwd', gears: 7, redline: 9000, grip: 1.1, drag: 0.6, reliability: 0.85, color: '#ff2a1a', blurb: 'Mid-engined Italian V8 that revs to nine thousand.' },
  { id: 'monarch', name: 'Monarch Phantom', maker: 'Ashford', year: 2019, tier: 4, price: 150000, style: 'sedan', hp: 560, torque: 900, mass: 2300, drive: 'awd', gears: 8, redline: 6000, grip: 1.0, drag: 0.72, reliability: 0.95, color: '#1d1238', blurb: 'A luxury barge with a twelve-cylinder whisper. Heavy, relentless.' },
  // ---- Tier 5: legend
  { id: 'toro', name: 'Toro Aventura', maker: 'Stallone', year: 2020, tier: 5, price: 320000, style: 'super', hp: 760, torque: 720, mass: 1600, drive: 'awd', gears: 7, redline: 8700, grip: 1.15, drag: 0.6, reliability: 0.85, color: '#c4f034', blurb: 'The wedge. V12, all-wheel drive, scissor doors.' },
  { id: 'stallone-812', name: 'Stallone 812', maker: 'Stallone', year: 2021, tier: 5, price: 350000, style: 'gt', hp: 790, torque: 718, mass: 1525, drive: 'rwd', gears: 7, redline: 8900, grip: 1.1, drag: 0.62, reliability: 0.8, color: '#e63946', blurb: 'Front-engined V12 grand tourer. Rear tyres live short lives.' },
  { id: 'wraith', name: 'Wraith GT3', maker: 'Vossberg', year: 2022, tier: 5, price: 230000, style: 'coupe', hp: 520, torque: 470, mass: 1420, drive: 'rwd', gears: 7, redline: 9000, grip: 1.2, drag: 0.58, reliability: 0.95, color: '#06d6a0', blurb: 'A road-legal race car. Light, loud, laser-guided.' },
  { id: 'hellion', name: 'Hellion Redeye', maker: 'Bluegrass', year: 2021, tier: 5, price: 180000, style: 'muscle', hp: 800, torque: 960, mass: 2000, drive: 'rwd', gears: 8, redline: 6500, grip: 1.08, drag: 0.76, reliability: 0.85, color: '#9b5de5', blurb: 'Supercharged muscle, drag radials from the factory.' },
  { id: 'elektra', name: 'Elektra Plaid', maker: 'Elektra', year: 2022, tier: 5, price: 260000, style: 'sedan', hp: 1000, torque: 1400, mass: 2160, drive: 'awd', gears: 1, redline: 20000, grip: 1.12, drag: 0.5, reliability: 0.95, color: '#f5f5f5', blurb: 'Electric sedan. One gear, instant torque, silent violence.' },
  { id: 'valkyr', name: 'Valkyr One', maker: 'Nordvik', year: 2019, tier: 5, price: 900000, style: 'hyper', hp: 1300, torque: 1280, mass: 1400, drive: 'rwd', gears: 7, redline: 8200, grip: 1.18, drag: 0.56, reliability: 0.75, color: '#ff8fab', blurb: 'Swedish hypercar. Thirteen hundred horsepower through two tyres.' },
  // ---- Tier 6: kings
  { id: 'veyr', name: 'Veyr Royale', maker: 'Ravelle', year: 2018, tier: 6, price: 2200000, style: 'hyper', hp: 1500, torque: 1600, mass: 1995, drive: 'awd', gears: 7, redline: 6700, grip: 1.2, drag: 0.6, reliability: 0.9, color: '#118ab2', blurb: 'Sixteen cylinders, four turbos, two-tone paint.' },
  { id: 'nitro-funny', name: 'Nitro Funny', maker: 'Hadley', year: 2024, tier: 6, price: 1500000, style: 'van', hp: 2500, torque: 3000, mass: 1100, drive: 'rwd', gears: 3, redline: 8500, grip: 2.4, drag: 0.9, reliability: 0.5, color: '#ffd166', blurb: 'A fibreglass shell over a nitro-fed monster. Rebuilt after every run.' },
  { id: 'rail', name: 'Rail Dragster', maker: 'Bluegrass', year: 2024, tier: 6, price: 3000000, style: 'dragster', hp: 3000, torque: 3600, mass: 1000, drive: 'rwd', gears: 3, redline: 8500, grip: 3.0, drag: 0.8, reliability: 0.55, color: '#ff006e', blurb: 'The long one. Nothing on this strip is faster.' },
];

export const DEFAULT_CAR = 'bumble';

const BY_ID = new Map(CARS.map((c) => [c.id, c]));
export const getCar = (id: string): CarDef => BY_ID.get(id) ?? CARS[0]!;

export const TIER_NAME: Record<CarDef['tier'], string> = { 1: 'Street', 2: 'Club', 3: 'Pro', 4: 'Elite', 5: 'Legend', 6: 'King' };
