import type { DiscordSDK } from '@discord/embedded-app-sdk';
import { api } from '../platform/account';
import { setPlayerKey } from '../platform/challenges';
import { setEmbedHost } from '../platform/embed';
import { DISCORD } from '../platform/env';
import { setSessionName } from '../platform/playerName';

/**
 * The Discord Activity's connection (docs/discord-activity.md): the SDK handshake, signing in with
 * the player's Discord account, and who else is in the call. The SDK loads only here.
 */

export interface DiscordSession {
  sdk: DiscordSDK;
  /** The same for everyone in this call: it picks the call's challenge or room. */
  instanceId: string;
  user: { id: string; name: string };
}

export interface Participant {
  id: string;
  name: string;
}

let started: Promise<DiscordSession> | null = null;

/** Connects once per visit (a failed attempt can be retried). */
export function startDiscord(): Promise<DiscordSession> {
  started ??= connect().catch((err: unknown) => {
    started = null;
    throw err;
  });
  return started;
}

async function connect(): Promise<DiscordSession> {
  const { DiscordSDK } = await import('@discord/embedded-app-sdk');
  const sdk = new DiscordSDK(DISCORD.clientId);
  // Outside Discord (a copied launch link) nobody answers the handshake.
  await Promise.race([sdk.ready(), new Promise((_, reject) => window.setTimeout(() => reject(new Error('Discord did not answer')), 20_000))]);
  // Discord asks the player once to let GlitchBound see their name ("identify" only).
  const { code } = await sdk.commands.authorize({ client_id: DISCORD.clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify'] });
  const auth = await api<{ access_token: string; user: { id: string; name: string }; key: string }>('/api/discord/token', { body: { code } });
  await sdk.commands.authenticate({ access_token: auth.access_token });
  setPlayerKey(auth.key);
  setSessionName(auth.user.name);
  setEmbedHost({ kind: 'discord', invite: () => void sdk.commands.openInviteDialog().catch(() => undefined) });
  return { sdk, instanceId: sdk.instanceId, user: auth.user };
}

type RawParticipant = { id: string; username: string; global_name?: string | null; nickname?: string };
const named = (list: RawParticipant[]): Participant[] => list.map((u) => ({ id: u.id, name: u.nickname || u.global_name || u.username }));

/** Who has the Activity open in this call, now and as it changes. Returns the unsubscribe. */
export function watchParticipants(sdk: DiscordSDK, onChange: (list: Participant[]) => void): () => void {
  let live = true;
  const update = (e: { participants: RawParticipant[] }): void => {
    if (live) onChange(named(e.participants));
  };
  sdk.commands.getInstanceConnectedParticipants().then(update, () => undefined);
  void sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', update).catch(() => undefined);
  return () => {
    live = false;
    void sdk.unsubscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', update).catch(() => undefined);
  };
}

export type CallGames = Record<'wait-what' | 'crass-act', { ref: string; players: number } | null>;

/** What is already running in the call. */
export const callGames = (instanceId: string): Promise<{ games: CallGames }> => api(`/api/discord/play?instanceId=${encodeURIComponent(instanceId)}`);

/** The call's challenge (Wait, What?) or room (Crass Act), started by whoever picks it first. */
export const playInCall = (instanceId: string, game: 'wait-what' | 'crass-act', name: string, key: string): Promise<{ challenge?: string; room?: string }> =>
  api('/api/discord/play', { body: { instanceId, game, name, key } });
