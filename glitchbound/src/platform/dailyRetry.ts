/**
 * One extra try at a game's own daily, after watching an optional ad (or with the ad-free purchase). The game itself
 * doesn't change: its save simply forgets today's round, so it offers today's daily again. The try is unranked
 * (src/pages/GamePage.tsx sends it nowhere), so nobody climbs a board by watching ads.
 */
const STORES: Record<string, string> = {
  'color-recall': 'glitchbound.color-recall',
  'letter-pinch': 'glitchbound.letter-pinch',
  'launch-control': 'glitchbound.launch-control',
  'color-lab': 'glitchbound.color-lab',
  'spot-the-glitch': 'glitchbound.spot-the-glitch',
  'wheres-the-ball': 'glitchbound.wheres-the-ball',
  'wing-it': 'glitchbound.wing-it',
  crosswire: 'glitchbound.crosswire',
  'wait-what': 'glitchbound.wait-what',
  'to-scale': 'glitchbound.to-scale',
  'gut-check': 'glitchbound.gut-check',
  fussbox: 'glitchbound.fussbox',
  belot: 'glitchbound.belot',
  backgammon: 'glitchbound.backgammon',
  'crater-crew': 'glitchbound.crater-crew',
};

const USED = 'glitchbound.dailyRetries';

function used(day: string): string[] {
  try {
    const o = JSON.parse(localStorage.getItem(USED) ?? '{}') as { day?: string; games?: unknown };
    return o.day === day && Array.isArray(o.games) ? (o.games as string[]) : [];
  } catch {
    return [];
  }
}

/** One extra try per game per day, and only for games whose save we know how to rewind. */
export const canRetryDaily = (slug: string, day: string): boolean => slug in STORES && !used(day).includes(slug);

/** Forgets today's round in the game's save. False if there was nothing to forget, or no storage. */
export function retryDaily(slug: string, day: string): boolean {
  const key = STORES[slug];
  if (!key || used(day).includes(slug)) return false;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const save = JSON.parse(raw) as { daily?: Record<string, unknown>; days?: Record<string, unknown>; progress?: { day?: string } };
    const book = save.daily?.[day] !== undefined ? save.daily : save.days?.[day] !== undefined ? save.days : null;
    if (!book) return false;
    delete book[day];
    if (save.progress?.day === day) delete save.progress;
    localStorage.setItem(key, JSON.stringify(save));
    localStorage.setItem(USED, JSON.stringify({ day, games: [...used(day), slug] }));
    return true;
  } catch {
    return false;
  }
}
