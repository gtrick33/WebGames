/** The Vigil's longest nights, per land, on this device. */

const BEST_KEY = 'sigilfall.vigil.bests';
/** Before the lands, one number: the Whisperwood's. */
const OLD_BEST_KEY = 'sigilfall.vigil.best';

export function readBests(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as unknown;
    const out: Record<string, number> = {};
    if (raw && typeof raw === 'object') for (const [k, n] of Object.entries(raw)) if (typeof n === 'number' && n >= 0) out[k] = n;
    const old = Number(localStorage.getItem(OLD_BEST_KEY)) || 0;
    if (old > (out.whisperwood ?? 0)) out.whisperwood = old;
    return out;
  } catch {
    return {};
  }
}

export function saveBest(map: string, t: number): void {
  try {
    const all = readBests();
    all[map] = Math.max(all[map] ?? 0, Math.floor(t));
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    /* a browser that keeps nothing: the run still counted */
  }
}

/** The longest night anywhere. */
export const longestNight = (): number => Math.max(0, ...Object.values(readBests()));
