/** Local calendar day key, e.g. "2026-10-17". */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole calendar days between two day keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const pa = parseDayKey(a);
  const pb = parseDayKey(b);
  if (!pa || !pb) return Number.NaN;
  return Math.round((pb - pa) / 86_400_000);
}

function parseDayKey(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
