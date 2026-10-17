import type { RunStats } from '../game/world';

/**
 * When NEON RUSH is played inside a host page (the GlitchBound arcade), tell the host when a run
 * starts and ends, so it can keep personal bests and daily challenges. Only run numbers are sent,
 * never the player id or name. Does nothing when the game is not embedded.
 * Protocol: glitchbound/src/platform/contract.ts (source "glitchbound-game", version 1).
 */
type HostMessage = { type: 'start' } | { type: 'end'; score: number; stats: Record<string, number> };

export function notifyHost(message: HostMessage, win: Pick<Window, 'parent'> | undefined = globalThis.window): void {
  if (!win || win.parent === win) return;
  try {
    // The payload is not sensitive, and the host checks our origin, so any parent may listen.
    win.parent.postMessage({ source: 'glitchbound-game', version: 1, ...message }, '*');
  } catch {
    // Never let the host integration affect the game.
  }
}

export function runEndMessage(stats: RunStats): HostMessage {
  return {
    type: 'end',
    score: stats.score,
    stats: { meters: Math.floor(stats.meters), coins: stats.coins, nearMisses: stats.nearMisses },
  };
}
