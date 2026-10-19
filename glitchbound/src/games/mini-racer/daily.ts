import { autopilot, RaceSim } from './sim';
import { buildTrack, rng, validateTrack, type Surface, type ThemeId, type TrackDef, type TrackType } from './track';

/**
 * The daily track: a fresh circuit generated from the date, the same for everyone on that day.
 * Pure and deterministic; the generator retries until the road doesn't overlap itself.
 */

export function hashDay(day: string): number {
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Local calendar day as YYYY-MM-DD (matches the arcade's daily). */
export function todayKey(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

const THEMES: { theme: ThemeId; type: TrackType; offroad: Surface; names: string[] }[] = [
  { theme: 'bay', type: 'circuit', offroad: 'sand', names: ['Coral Coast', 'Lagoon Loop', 'Palm Parade', 'Seashell Sprint'] },
  { theme: 'frost', type: 'snow', offroad: 'snow', names: ['Glacier Glide', 'Sleet Street', 'Polar Pretzel', 'Igloo Ring'] },
  { theme: 'canyon', type: 'rally', offroad: 'sand', names: ['Mesa Rush', 'Dusty Twist', 'Cactus Corner', 'Red Rock Ring'] },
];

function attempt(day: string, seed: number): TrackDef {
  const r = rng(seed);
  const style = THEMES[Math.floor(r() * THEMES.length)]!;
  const n = 9 + Math.floor(r() * 4);
  const rx = 1350 + r() * 300;
  const ry = 900 + r() * 250;
  const cx = rx + 300;
  const cy = ry + 300;
  const phase = r() * Math.PI * 2;
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const ang = phase + (i / n) * Math.PI * 2 + (r() - 0.5) * (Math.PI / n) * 0.8;
    // Alternate deep and shallow radii for bends, never too close to the middle.
    const rad = 0.5 + r() * 0.5;
    points.push([Math.round(cx + Math.cos(ang) * rx * rad), Math.round(cy + Math.sin(ang) * ry * rad)]);
  }
  const zoneStart = 0.2 + r() * 0.4;
  const z1 = r() * 0.6;
  return {
    id: `daily-${day}`,
    name: style.names[Math.floor(r() * style.names.length)]!,
    blurb: 'A brand-new circuit every day, the same for everyone. One race a day, so make it count.',
    theme: style.theme,
    type: style.type,
    width: 150 + Math.floor(r() * 3) * 6,
    offroad: style.offroad,
    points,
    // The track type shapes the surfaces: tarmac circuits, long icy stretches on snow, dirt and gravel on rally.
    zones:
      style.type === 'circuit'
        ? []
        : style.type === 'snow'
          ? [{ from: zoneStart, to: zoneStart + 0.3 + r() * 0.1, surface: 'ice' }]
          : [
              { from: zoneStart, to: zoneStart + 0.15 + r() * 0.08, surface: 'dirt' },
              { from: (zoneStart + 0.45) % 1, to: (zoneStart + 0.57) % 1, surface: 'gravel' },
            ],
    patches: [
      { at: 0.08 + z1 * 0.2, off: 0, len: 70, wide: 60, surface: 'boost' },
      { at: 0.55 + r() * 0.3, off: (r() - 0.5) * 50, len: 70, wide: 60, surface: 'boost' },
      { at: 0.35 + r() * 0.15, off: (r() < 0.5 ? -1 : 1) * 30, len: 110, wide: 70, surface: style.theme === 'frost' ? 'snow' : 'mud' },
    ],
    obstacles: [0.25, 0.5, 0.75].map((base) => ({
      at: base + (r() - 0.5) * 0.1,
      off: (r() < 0.5 ? -1 : 1) * 52,
      r: 16 + Math.floor(r() * 5),
      kind: style.theme === 'canyon' ? 'rock' : r() < 0.5 ? 'tires' : 'cone',
    })),
    checkpoints: 8,
    par: 0,
    seed: seed ^ 0x5bd1e995,
  };
}

/**
 * Gold time for a generated track: the autopilot's flying lap, a touch faster, rounded to 0.1 s. Returns
 * null if the autopilot can't lap it cleanly at full (automatic) speed: a bend is too tight.
 */
function parFor(def: TrackDef): number | null {
  const sim = new RaceSim(buildTrack(def));
  for (let i = 0; i < 120 * 90 && sim.lap.laps.length < 2; i++) {
    for (const e of sim.step(autopilot(sim))) if (e.type === 'missed' || e.type === 'rescue') return null;
  }
  const lap = sim.lap.laps[1];
  return lap?.valid ? Math.round(lap.time * 0.985 * 10) * 100 : null;
}

export function dailyTrack(day: string): TrackDef {
  const base = hashDay(`mini-racer-${day}`);
  for (let i = 0; i < 40; i++) {
    const def = attempt(day, (base + Math.imul(i, 0x9e3779b1)) >>> 0);
    if (validateTrack(buildTrack(def)).length > 0) continue;
    const par = parFor(def);
    if (par === null) continue;
    def.par = par;
    return def;
  }
  // Practically unreachable; a safe oval keeps the day playable.
  const def = attempt(day, base);
  def.points = [
    [400, 600],
    [1200, 350],
    [2000, 600],
    [2200, 1100],
    [1200, 1450],
    [300, 1100],
  ];
  def.par = parFor(def) ?? Math.round((buildTrack(def).path.length / 330) * 10) * 100;
  return def;
}

/** Id of the reroll-able random track (one slot, so bests and ghosts never pile up). */
export const RANDOM_ID = 'random';

/** A freshly generated track from any seed, for endless variety beyond the daily. */
export function randomTrack(seed: number): TrackDef {
  return { ...dailyTrack(`free-${seed >>> 0}`), id: RANDOM_ID, blurb: 'A freshly generated track. Roll a new one whenever you like.' };
}
