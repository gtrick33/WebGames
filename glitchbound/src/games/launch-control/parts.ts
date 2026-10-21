import type { CarDef } from './cars';
import { clamp } from './util';

/** The six upgradeable parts. Each is its own component: its own level, condition, costs, look and stat mix. */
export const PARTS = ['engine', 'transmission', 'suspension', 'tyres', 'aero', 'looks'] as const;
export type PartId = (typeof PARTS)[number];
export const MAX_LEVEL = 8;

export const MATERIALS = ['scrap', 'alloy', 'carbon', 'chips', 'rubber'] as const;
export type Material = (typeof MATERIALS)[number];
export type Mats = Partial<Record<Material, number>>;

export const MATERIAL_INFO: Record<Material, { name: string; emoji: string; blurb: string }> = {
  scrap: { name: 'Scrap', emoji: '🔩', blurb: 'Bolts and brackets. Every win drops some.' },
  alloy: { name: 'Alloy', emoji: '🪙', blurb: 'Light metal for serious parts. Club division and up.' },
  carbon: { name: 'Carbon', emoji: '🧵', blurb: 'Woven carbon fibre. Pro division and up.' },
  chips: { name: 'Chips', emoji: '💾', blurb: 'Engine computers. Elite division and up.' },
  rubber: { name: 'Rubber', emoji: '⚫', blurb: 'Race compound for tyres.' },
};

export interface PartInfo {
  id: PartId;
  name: string;
  emoji: string;
  blurb: string;
  /** How it shows on the car. */
  look: string;
}

export const PART_INFO: Record<PartId, PartInfo> = {
  engine: { id: 'engine', name: 'Engine', emoji: '⚙️', blurb: 'Bigger turbo, hotter cams, higher redline. Heavier and a little less forgiving.', look: 'Hood scoop, twin pipes with flames' },
  transmission: { id: 'transmission', name: 'Transmission', emoji: '🕹️', blurb: 'Faster shifts and a stronger driveline.', look: 'Shift light on the rear window' },
  suspension: { id: 'suspension', name: 'Suspension', emoji: '🛞', blurb: 'Lighter coilovers and better weight transfer: more grip off the line, less wheel hop.', look: 'Lower, wider stance' },
  tyres: { id: 'tyres', name: 'Tyres', emoji: '🏁', blurb: 'Stickier compound and wider wheels. They wear out and need replacing.', look: 'Wider wheels, slicks' },
  aero: { id: 'aero', name: 'Aerodynamics', emoji: '🪽', blurb: 'Less drag for top-end speed, a touch of downforce for grip at speed.', look: 'Splitter, spoiler, diffuser' },
  looks: { id: 'looks', name: 'Looks', emoji: '✨', blurb: 'Fans pay: a bonus on every purse and a better sponsor deal.', look: 'Livery, underglow, chrome' },
};

export type Levels = Record<PartId, number>;
export type Condition = Record<PartId, number>;

/** What a part's levels add that you can see on the car (modelcar.ts draws them), by the level they arrive at. */
export const PART_VISUALS: Record<PartId, [number, string][]> = {
  engine: [[1, 'Bigger exhaust tips every level'], [3, 'Hood scoop'], [6, 'Twin exhausts that spit flames'], [8, 'Supercharger through the hood']],
  transmission: [[2, 'Shift light on the rear window'], [5, 'Wide LED shift bar']],
  suspension: [[1, 'Sits about 2 cm lower every level']],
  tyres: [[1, 'Bigger, wider wheels every level'], [5, 'Racing slicks']],
  aero: [[1, 'Ducktail spoiler'], [2, 'Front splitter'], [4, 'Rear wing'], [5, 'Diffuser fins'], [6, 'Canards'], [7, 'Big carbon wing with end plates']],
  looks: [[4, 'Lime underglow'], [7, 'Pink underglow and a pinstripe']],
};

export const stockLevels = (): Levels => ({ engine: 0, transmission: 0, suspension: 0, tyres: 0, aero: 0, looks: 0 });
export const freshCondition = (): Condition => ({ engine: 100, transmission: 100, suspension: 100, tyres: 100, aero: 100, looks: 100 });

/** Cash and materials for taking a part from `level - 1` to `level`. */
export function upgradeCost(car: CarDef, part: PartId, level: number): { cash: number; mats: Mats } {
  const base = Math.max(1500, car.price);
  const cash = Math.round((base * 0.06 * Math.pow(1.38, level - 1)) / 10) * 10;
  const t = car.tier;
  let mats: Mats = {};
  if (level <= 2) mats.scrap = 2 * level * t;
  else if (level <= 4) {
    mats.scrap = 4 * t;
    mats.alloy = (level - 2) * t;
  } else if (level <= 6) {
    mats.alloy = 3 * t;
    mats.carbon = (level - 4) * t;
  } else {
    mats.carbon = 3 * t;
    mats.chips = (level - 6) * t;
  }
  if (part === 'tyres') mats.rubber = level * t;
  if (part === 'looks') mats = { scrap: Math.ceil(level * t * 1.5) };
  return { cash, mats };
}

/** What a set of levels and conditions does to the stock car. Every part moves several numbers. */
export interface Effects {
  torqueMul: number;
  redlineAdd: number;
  /** kg added (turbo hardware) or removed (lightweight suspension). */
  massAdd: number;
  reliabilityAdd: number;
  /** Seconds a gear change takes (no drive). */
  shiftTime: number;
  driveEff: number;
  /** Grip multiplier at the launch (weight transfer). */
  launchGrip: number;
  /** How much of the grip stays when the tyres spin (wheel hop damping). */
  spinKeep: number;
  gripMul: number;
  /** Extra grip at speed from downforce (fraction per 100 km/h). */
  downforce: number;
  dragMul: number;
  fansMul: number;
  sponsorMul: number;
}

export function effectsOf(levels: Levels, cond: Condition): Effects {
  const c = (p: PartId): number => clamp(cond[p], 0, 100) / 100;
  return {
    torqueMul: (1 + 0.09 * levels.engine) * (0.85 + 0.15 * c('engine')),
    redlineAdd: 60 * levels.engine,
    massAdd: 4 * levels.engine - 6 * levels.suspension + 3 * levels.aero,
    reliabilityAdd: -0.02 * levels.engine + 0.01 * levels.transmission,
    shiftTime: (0.42 - 0.035 * levels.transmission) * (1 + 0.4 * (1 - c('transmission'))),
    driveEff: 0.84 + 0.01 * levels.transmission,
    launchGrip: (1 + 0.05 * levels.suspension) * (0.9 + 0.1 * c('suspension')),
    spinKeep: 0.72 + 0.025 * levels.suspension,
    gripMul: (1 + 0.06 * levels.tyres) * (0.72 + 0.28 * c('tyres')),
    downforce: 0.012 * levels.aero * (0.6 + 0.4 * c('aero')),
    dragMul: (1 - 0.055 * levels.aero) * (1 + 0.1 * (1 - c('aero'))),
    fansMul: 1 + 0.06 * levels.looks,
    sponsorMul: 1 + 0.03 * levels.looks,
  };
}

/** What the next level of a part changes, in words (the garage cards). */
export function levelGains(part: PartId): string[] {
  switch (part) {
    case 'engine':
      return ['+9% torque', '+60 rpm redline', '+4 kg', '−2% reliability'];
    case 'transmission':
      return ['−35 ms per shift', '+1% drive efficiency', '+1% reliability'];
    case 'suspension':
      return ['+5% launch grip', 'Less wheel hop', '−6 kg'];
    case 'tyres':
      return ['+6% grip', 'Wears per race'];
    case 'aero':
      return ['−5.5% drag', '+downforce at speed', '+3 kg'];
    case 'looks':
      return ['+6% purse from fans', '+3% sponsor pay'];
  }
}

/** Condition below which a part can fail in a race. */
export const RISKY = 30;

/** Wear from one race, by part. Spinning tyres and bouncing off the limiter cost extra. */
export function raceWear(input: { spinTime: number; limiterTime: number; missedShifts: number; dnf: boolean }): Condition {
  return {
    engine: 2.5 + input.limiterTime * 6,
    transmission: 1.5 + input.missedShifts * 2,
    suspension: 1.2 + input.spinTime * 1.5,
    tyres: 7 + input.spinTime * 8,
    aero: 0.6,
    looks: 0,
  };
}

export function applyWear(cond: Condition, wear: Condition): Condition {
  const out = { ...cond };
  for (const p of PARTS) out[p] = clamp(Math.round((out[p] - wear[p]) * 10) / 10, 0, 100);
  return out;
}

/** Cash to bring a part back to 100 %. */
export function repairCost(car: CarDef, part: PartId, cond: number): number {
  const base = Math.max(1500, car.price);
  const share: Record<PartId, number> = { engine: 0.05, transmission: 0.03, suspension: 0.02, tyres: 0.015, aero: 0.01, looks: 0 };
  return Math.round((base * share[part] * (100 - clamp(cond, 0, 100))) / 100 / 5) * 5;
}

/** Chance (0..1) that a part fails during one race. Only worn parts can fail; reliable cars fail less. */
export function failChance(cond: number, reliability: number): number {
  if (cond >= RISKY) return 0;
  return ((RISKY - cond) / RISKY) * 0.55 * (1.25 - clamp(reliability, 0, 1) * 0.75);
}

export const FAILURE_TEXT: Record<PartId, string> = {
  engine: 'Engine let go!',
  transmission: 'Gearbox jammed!',
  suspension: 'Wheel hop, lost the launch!',
  tyres: 'Tyre blowout!',
  aero: 'Spoiler flew off!',
  looks: 'Paint flaked off!',
};
