/**
 * The ping a party fight shows (co-op, The Ring, The Vigil): the round trip between this player's game and the host's,
 * which every message makes through the room (net/link.ts measures each player's own leg). Under 120 ms a fight feels
 * at hand; past 250 ms what others do is visibly late.
 */
export type PingTone = 'good' | 'fair' | 'poor';

export const pingTone = (ms: number): PingTone => (ms < 120 ? 'good' : ms < 250 ? 'fair' : 'poor');

/** Shows a ping in a HUD element (written straight to it, every frame, with no React render): hidden until measured. */
export function showPing(el: HTMLElement | null, ms: number): void {
  if (!el) return;
  const text = ms > 0 ? `Ping ${Math.round(ms)} ms` : '';
  if (el.textContent !== text) el.textContent = text;
  const tone = ms > 0 ? pingTone(ms) : '';
  if (el.dataset.tone !== tone) el.dataset.tone = tone;
  el.hidden = !text;
}
