import type { GameEntry } from '../catalog/types';
import { account, api } from './account';

/**
 * Coins that QA or an admin gave the signed-in player for one game (games with `wallet` in the
 * registry). Each grant is handed out once: the game adds the amount to its own wallet right away.
 * Guests and failed requests get nothing, and the coins wait for the next time.
 */
export async function claimCoins(game: string): Promise<{ amount: number; notes: string[] }> {
  if (!account.state.me) return { amount: 0, notes: [] };
  try {
    return await api<{ amount: number; notes: string[] }>('/api/coins/claim', { body: { game } });
  } catch {
    return { amount: 0, notes: [] };
  }
}

/**
 * Embedded games (NEON RUSH) get their coins over the host bridge once they are listening (the
 * `coins` host command, neon-rush/src/analytics/embed.ts). Only same-site embeds hold a wallet.
 */
export async function handOver(game: GameEntry, frame: HTMLIFrameElement | null): Promise<void> {
  if (game.runtime.kind !== 'embed' || !game.runtime.url.startsWith('/')) return;
  const { amount } = await claimCoins(game.slug);
  if (amount > 0) frame?.contentWindow?.postMessage({ source: 'glitchbound-host', version: 1, type: 'coins', amount }, location.origin);
}
