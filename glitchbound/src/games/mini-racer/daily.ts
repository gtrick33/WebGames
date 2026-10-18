import { autopilot, RaceSim } from './sim';
import { buildTrack, rng, validateTrack, type Surface, type ThemeId, type TrackDef } from './track';

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

const THEMES: { theme: ThemeId; offroad: Surface; zone: Surface; names: string[] }[] = [
  { theme: 'bay', offroad: 'sand', zone: 'dirt', names: ['Coral Coast', 'Lagoon Loop', 'Palm Parade', 'Seashell Sprint'] },
  { theme: 'frost', offroad: 'snow', zone: 'ice', names: ['Glacier Glide', 'Sleet Street', 'Polar Pretzel', 'Igloo Ring'] },
  { theme: 'canyon', offroad: 'sand', zone: 'dirt', names: ['Mesa Rush', 'Dusty Twist', 'Cactus Corner', 'Red Rock Ring'] },
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
    blurb: 'A brand-new circuit every day. Same track for everyone until midnight.',
    theme: style.theme,
    width: 150 + Math.floor(r() * 3) * 6,
    offroad: style.offroad,
    points,
    zones: [{ from: zoneStart, to: zoneStart + 0.1 + r() * 0.08, surface: style.zone }],
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

/** Gold time for a generated track: the autopilot's best flying lap, a touch faster, rounded to 0.1 s. */
function parFor(def: TrackDef): number {
  const sim = new RaceSim(buildTrack(def));
  for (let i = 0; i < 120 * 90 && sim.lap.laps.length < 2; i++) sim.step(autopilot(sim));
  const lap = sim.lap.laps[1] ?? sim.lap.laps[0];
  const t = lap?.valid ? lap.time : sim.track.path.length / 330;
  return Math.round(t * 0.985 * 10) * 100;
}

export function dailyTrack(day: string): TrackDef {
  const base = hashDay(`mini-racer-${day}`);
  for (let i = 0; i < 40; i++) {
    const def = attempt(day, (base + Math.imul(i, 0x9e3779b1)) >>> 0);
    if (validateTrack(buildTrack(def)).length === 0) {
      def.par = parFor(def);
      return def;
    }
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
  def.par = parFor(def);
  return def;
}
