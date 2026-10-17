/** Gameplay tuning. All distances are in logical world units (the road is LANES * LANE_WIDTH wide). */
export const LANES = 4;
export const LANE_WIDTH = 92;
export const ROAD_WIDTH = LANES * LANE_WIDTH;
/** Logical width that must always be visible (road plus a little scenery). */
export const VIEW_MIN_WIDTH = 520;
/** Logical height that must always be visible. */
export const VIEW_MIN_HEIGHT = 760;
export const UNITS_PER_METER = 20;

export const PLAYER = {
  width: 46,
  height: 84,
  hitW: 34,
  hitH: 70,
  /** Distance from the bottom of the view to the player's center. */
  bottomOffset: 150,
  laneChangeTime: 0.14,
} as const;

/** Hazards and pickups approach at this fraction of the player's speed (traffic drives forward too). */
export const APPROACH_FACTOR = 0.62;
/** Fixed simulation step. */
export const SIM_DT = 1 / 120;

export const HAZARD_SIZES = {
  car: { w: 48, h: 88, hitW: 40, hitH: 78 },
  sport: { w: 46, h: 82, hitW: 38, hitH: 72 },
  truck: { w: 56, h: 150, hitW: 48, hitH: 140 },
  drone: { w: 44, h: 44, hitW: 32, hitH: 32 },
} as const;
export type HazardKind = keyof typeof HAZARD_SIZES;

export const COIN_RADIUS = 15;
export const PICKUP_RADIUS = 22;
export const MAGNET_RADIUS = 260;

export const POWERUPS = {
  magnet: { duration: 8 },
  shield: { duration: 12 },
  double: { duration: 10 },
} as const;
export type PowerUpKind = keyof typeof POWERUPS;

export const SCORE = {
  perMeter: 1,
  perCoin: 10,
  nearMissBase: 25,
  maxCombo: 8,
  comboWindow: 2.5,
} as const;

export interface Difficulty {
  /** Player speed in units / second. */
  speed: number;
  /** Seconds (in approach time) between hazard rows. */
  rowGapTime: number;
  /** Probability weights for blocking 1, 2 or 3 lanes in a row. */
  blockWeights: [number, number, number];
  truckChance: number;
  droneChance: number;
  laneChangerChance: number;
}

/** Difficulty curve: a smooth function of distance travelled in meters. */
export function difficultyAt(meters: number): Difficulty {
  const t = 1 - Math.exp(-Math.max(0, meters) / 2600);
  const speed = 560 + 600 * t;
  const rowGapTime = 1.1 - 0.5 * t;
  let blockWeights: [number, number, number];
  if (meters < 250) blockWeights = [1, 0, 0];
  else if (meters < 900) blockWeights = [0.55, 0.45, 0];
  else if (meters < 2000) blockWeights = [0.3, 0.5, 0.2];
  else blockWeights = [0.18, 0.47, 0.35];
  return {
    speed,
    rowGapTime,
    blockWeights,
    truckChance: meters < 400 ? 0 : 0.12 + 0.12 * t,
    droneChance: meters < 600 ? 0 : 0.1 + 0.1 * t,
    laneChangerChance: meters < 1200 ? 0 : 0.18 + 0.2 * t,
  };
}

export function laneCenter(lane: number): number {
  return (lane - (LANES - 1) / 2) * LANE_WIDTH;
}
