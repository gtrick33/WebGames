import { account, api } from './account';

/**
 * What a game master has asked this player's Sigilfall to do (Admin › Sigilfall; progress/gm.ts carries it out). Guests
 * have none, and a failed request only means the orders wait for the next look.
 */
export interface ServerOrder {
  id: string;
  slot: number;
  created: number;
  kind: string;
  payload: Record<string, unknown>;
}

export async function waitingOrders(): Promise<ServerOrder[]> {
  if (!account.state.me) return [];
  try {
    return (await api<{ orders: ServerOrder[] }>('/api/sigilfall/orders')).orders;
  } catch {
    return [];
  }
}

export async function reportOrders(done: { id: string; result: string }[]): Promise<void> {
  if (!done.length || !account.state.me) return;
  try {
    await api('/api/sigilfall/orders', { body: { done } });
  } catch {
    // They stay open and come round again; a hero remembers what's been done (Character.gm), so nothing happens twice.
  }
}
