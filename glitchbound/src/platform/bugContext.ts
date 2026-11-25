/**
 * Where a player was in a game when they went to report a bug: one short line the game leaves on the device, which the
 * Report a bug page shows to the player and sends with their report (src/pages/BugReportPage.tsx). It is the game's
 * own content only (a build, a level, a place): a game must never put a name or a save in it.
 */
const KEY = 'glitchbound.bugContext';
/** How long a line stays true: a report written tomorrow is not about where the player stood today. */
const FRESH_MS = 30 * 60_000;
const MAX = 160;

/** A game says where its player is now (called as often as the game saves). */
export function setBugContext(game: string, line: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ game, line: line.slice(0, MAX), at: Date.now() }));
  } catch {
    /* no storage: the report goes without it */
  }
}

/** The line a game left for a report about it, if it left one lately. */
export function bugContext(game: string, now = Date.now()): string {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { game?: unknown; line?: unknown; at?: unknown } | null;
    if (!raw || raw.game !== game || typeof raw.line !== 'string' || typeof raw.at !== 'number' || now - raw.at > FRESH_MS || now < raw.at) return '';
    return raw.line.slice(0, MAX);
  } catch {
    return '';
  }
}
