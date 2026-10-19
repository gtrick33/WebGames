import { beforeEach, describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { nicknameCandidates, levelForXp, questsForDay, validateNickname, xpForLevel } from '../src/platform/progression';
import { resetGoogleKeyCache, verifyGoogleIdToken } from '../server/google';
import { clientDay, longestStreak } from '../server/members';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const b64url = (data: Uint8Array | string): string =>
  Buffer.from(typeof data === 'string' ? data : data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function makeKey() {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { pair, jwk: { ...jwk, kid: 'k1' } };
}

async function token(key: CryptoKey, claims: Record<string, unknown>, kid = 'k1'): Promise<string> {
  const h = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const p = b64url(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(sig)}`;
}

describe('Google ID token verification', () => {
  const now = Date.now();
  const good = { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '123', email: 'Player@Example.com', email_verified: true, name: 'Pat', given_name: 'Pat', exp: Math.floor(now / 1000) + 600 };
  let keys: Awaited<ReturnType<typeof makeKey>>;
  let fetcher: typeof fetch;

  beforeEach(async () => {
    resetGoogleKeyCache();
    keys = await makeKey();
    fetcher = (async () => new Response(JSON.stringify({ keys: [keys.jwk] }))) as typeof fetch;
  });

  it('accepts a valid token and normalizes the email', async () => {
    const id = await verifyGoogleIdToken(await token(keys.pair.privateKey, good), CLIENT_ID, now, fetcher);
    expect(id).toMatchObject({ sub: '123', email: 'player@example.com', name: 'Pat' });
  });

  it.each([
    ['wrong audience', { aud: 'someone-else' }, 'bad_audience'],
    ['wrong issuer', { iss: 'https://evil.example' }, 'bad_issuer'],
    ['expired', { exp: Math.floor(now / 1000) - 3600 }, 'expired'],
    ['unverified email', { email_verified: false }, 'email_not_verified'],
  ])('rejects %s', async (_name, patch, reason) => {
    await expect(verifyGoogleIdToken(await token(keys.pair.privateKey, { ...good, ...patch }), CLIENT_ID, now, fetcher)).rejects.toThrow(reason);
  });

  it('rejects a token signed by another key', async () => {
    const other = await makeKey();
    await expect(verifyGoogleIdToken(await token(other.pair.privateKey, good), CLIENT_ID, now, fetcher)).rejects.toThrow('bad_signature');
  });

  it('rejects tampered claims', async () => {
    const t = await token(keys.pair.privateKey, good);
    const [h, , s] = t.split('.');
    const forged = `${h}.${b64url(JSON.stringify({ ...good, email: 'admin@example.com' }))}.${s}`;
    await expect(verifyGoogleIdToken(forged, CLIENT_ID, now, fetcher)).rejects.toThrow('bad_signature');
  });

  it('rejects unknown key ids and malformed tokens', async () => {
    await expect(verifyGoogleIdToken(await token(keys.pair.privateKey, good, 'nope'), CLIENT_ID, now, fetcher)).rejects.toThrow('unknown_key');
    await expect(verifyGoogleIdToken('a.b', CLIENT_ID, now, fetcher)).rejects.toThrow('malformed_token');
  });
});

describe('levels', () => {
  it('follows the triangular XP curve', () => {
    expect([0, 99, 100, 299, 300, 600, 1000].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 4, 5]);
    for (let l = 1; l < 30; l++) expect(levelForXp(xpForLevel(l))).toBe(l);
  });
});

describe('member quests', () => {
  it('gives three distinct quests, stable for a member and day', () => {
    const a = questsForDay('user-1', '2026-10-20', GAMES, false);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((q) => q.kind)).size).toBe(3);
    expect(questsForDay('user-1', '2026-10-20', GAMES, false)).toEqual(a);
    expect(a[0]?.kind).toBe('rounds');
  });
  it('differs between members and days, and skips the favorite quest once one exists', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(questsForDay(`u${i}`, '2026-10-20', GAMES, false).map((q) => q.id).join('|'));
    expect(seen.size).toBeGreaterThan(5);
    for (let i = 0; i < 40; i++) expect(questsForDay(`u${i}`, '2026-10-21', GAMES, true).some((q) => q.kind === 'favorite')).toBe(false);
  });
  it('uses reachable targets from the registry', () => {
    for (let i = 0; i < 60; i++) {
      const m = questsForDay(`p${i}`, '2026-11-01', GAMES, true).find((q) => q.kind === 'metric');
      if (!m) continue;
      const tpl = GAMES.find((g) => g.slug === m.game)!.daily!.find((d) => d.metric === m.metric)!;
      expect(tpl.targets.slice(0, 2)).toContain(m.target);
    }
  });
  it('names the game once in a game quest', () => {
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const m = questsForDay(`n${i}`, '2026-11-02', GAMES, true).find((q) => q.kind === 'metric');
      if (!m) continue;
      const title = GAMES.find((g) => g.slug === m.game)!.title;
      expect(m.label.split(title).length - 1, m.label).toBe(1);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe('nicknames', () => {
  it('validates length, characters and blocked words', () => {
    expect(validateNickname('Ace_99')).toBeNull();
    expect(validateNickname('ab')).not.toBeNull();
    expect(validateNickname('<script>')).not.toBeNull();
    expect(validateNickname('GlitchBoundAdmin')).not.toBeNull();
    expect(validateNickname(42)).not.toBeNull();
  });
  it('generates a valid default', () => {
    expect(nicknameCandidates('Sava Hristov', 'Sava', 'seed')[0]).toBe('Sava Hristov');
    for (const c of [...nicknameCandidates('', '', 'seed'), ...nicknameCandidates('Ünïcødé Name!!', '', 'x')]) expect(validateNickname(c)).toBeNull();
    expect(nicknameCandidates('', '', 'seed').length).toBeGreaterThan(1);
  });
});

describe('server helpers', () => {
  it('accepts the player’s local day only within a day of UTC', () => {
    const now = Date.parse('2026-10-20T23:30:00Z');
    expect(clientDay('2026-10-21', now)).toBe('2026-10-21');
    expect(clientDay('2026-10-19', now)).toBe('2026-10-19');
    expect(clientDay('2026-10-25', now)).toBe('2026-10-20');
    expect(clientDay('garbage', now)).toBe('2026-10-20');
  });
  it('finds the longest daily streak', () => {
    expect(longestStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06'])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});
