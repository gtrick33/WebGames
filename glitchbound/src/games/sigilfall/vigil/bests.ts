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

/** The longest night per land and per class, on this device: `{ land: { class: seconds } }`. */
const CLASS_KEY = 'sigilfall.vigil.classBests';

export function readClassBests(): Record<string, Record<string, number>> {
  try {
    const raw = JSON.parse(localStorage.getItem(CLASS_KEY) ?? '{}') as unknown;
    const out: Record<string, Record<string, number>> = {};
    if (raw && typeof raw === 'object')
      for (const [land, per] of Object.entries(raw)) {
        if (!per || typeof per !== 'object') continue;
        for (const [cls, n] of Object.entries(per)) if (typeof n === 'number' && n >= 0) (out[land] ??= {})[cls] = n;
      }
    return out;
  } catch {
    return {};
  }
}

/** A night held with a class: kept if it is that class's longest in that land. */
export function saveClassBest(map: string, cls: string, t: number): void {
  try {
    const all = readClassBests();
    const per = (all[map] ??= {});
    per[cls] = Math.max(per[cls] ?? 0, Math.floor(t));
    localStorage.setItem(CLASS_KEY, JSON.stringify(all));
  } catch {
    /* a browser that keeps nothing */
  }
}

/** The evolutions found, on this device: the ids of the spells that have evolved in some night. */
const CODEX_KEY = 'sigilfall.vigil.codex';

export function readCodex(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CODEX_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Spells evolved in a night: added to the codex. Returns the ones it hadn't seen before. */
export function addToCodex(ids: Iterable<string>): string[] {
  const have = readCodex();
  const fresh = [...ids].filter((id) => !have.has(id));
  if (!fresh.length) return [];
  for (const id of fresh) have.add(id);
  try {
    localStorage.setItem(CODEX_KEY, JSON.stringify([...have]));
  } catch {
    /* nothing kept */
  }
  return fresh;
}

/** Whether this device has kept a watch before (the first night opens with how it is played). */
const TAUGHT_KEY = 'sigilfall.vigil.taught';
export function vigilTaught(): boolean {
  try {
    return !!localStorage.getItem(TAUGHT_KEY);
  } catch {
    return true;
  }
}
export function markVigilTaught(): void {
  try {
    localStorage.setItem(TAUGHT_KEY, '1');
  } catch {
    /* nothing kept */
  }
}

/** The Vigil's titles: held this long in any one night, anywhere (progress/titles.ts). */
export const VIGIL_TITLES: readonly { id: string; name: string; secs: number }[] = [
  { id: 'vigil-5', name: 'Watchkeeper', secs: 300 },
  { id: 'vigil-10', name: 'Nightwarden', secs: 600 },
  { id: 'vigil-15', name: 'Dawnbringer', secs: 900 },
];
