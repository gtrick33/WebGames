import type { RunStats } from '../game/world';

/**
 * When NEON RUSH is played inside a host page (the GlitchBound arcade), tell the host when a run
 * starts and ends, so it can keep personal bests and daily challenges. Only run numbers are sent,
 * never the player id or name. Does nothing when the game is not embedded.
 * Protocol: glitchbound/src/platform/contract.ts (source "glitchbound-game", version 1).
 */
type HostMessage = { type: 'ready' } | { type: 'start' } | { type: 'end'; score: number; stats: Record<string, number> } | { type: 'menu' };

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

/**
 * Messages the host page may send to the game. `challenge`: a friends' challenge round is on, so
 * every run uses this seed (the same traffic for every player); null ends it. `coins`: coins the
 * arcade's QA team or an admin gave this player; add them to the wallet. `menu`: whether the
 * arcade's game menu is available (it is in full screen); the game then shows a menu button that
 * sends `{ type: 'menu' }` back.
 */
export type HostCommand = { type: 'identity'; name: string } | { type: 'pause' } | { type: 'challenge'; seed: number | null } | { type: 'coins'; amount: number } | { type: 'menu'; available: boolean };

/** The most coins one gift may carry (the arcade allows up to 100,000 per grant, several at once). */
const MAX_GIFT = 10_000_000;

/**
 * Listens for commands from the host page (only from our direct parent window). Returns an
 * unsubscribe function. Does nothing when the game is not embedded.
 */
export function listenToHost(onCommand: (c: HostCommand) => void, win: Window | undefined = globalThis.window): () => void {
  if (!win || win.parent === win) return () => undefined;
  const handler = (e: MessageEvent): void => {
    if (e.source !== win.parent) return;
    const d = e.data as Record<string, unknown> | null;
    if (!d || typeof d !== 'object' || d.source !== 'glitchbound-host' || d.version !== 1) return;
    if (d.type === 'identity' && typeof d.name === 'string') onCommand({ type: 'identity', name: d.name.slice(0, 40) });
    else if (d.type === 'pause') onCommand({ type: 'pause' });
    else if (d.type === 'challenge' && (d.seed === null || (typeof d.seed === 'number' && Number.isInteger(d.seed)))) onCommand({ type: 'challenge', seed: d.seed === null ? null : d.seed | 0 });
    else if (d.type === 'menu' && typeof d.available === 'boolean') onCommand({ type: 'menu', available: d.available });
    else if (d.type === 'coins' && typeof d.amount === 'number' && Number.isInteger(d.amount) && d.amount > 0 && d.amount <= MAX_GIFT) onCommand({ type: 'coins', amount: d.amount });
  };
  win.addEventListener('message', handler);
  // Tell the host we are listening, so it can send the player's name now.
  notifyHost({ type: 'ready' }, win);
  return () => win.removeEventListener('message', handler);
}
