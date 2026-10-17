/**
 * Verifies a Google Identity Services ID token (the "credential" from Sign in with Google) using
 * Google's published keys. No client secret is needed: the token is RS256-signed by Google.
 * https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

let cache: { keys: Jwk[]; until: number } | null = null;

async function googleKeys(fetcher: typeof fetch): Promise<Jwk[]> {
  if (cache && cache.until > Date.now()) return cache.keys;
  const res = await fetcher(CERTS_URL);
  if (!res.ok) throw new Error('google_keys_unavailable');
  const body = (await res.json()) as { keys: Jwk[] };
  cache = { keys: body.keys, until: Date.now() + 3600_000 };
  return body.keys;
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  givenName: string;
  picture: string;
}

export async function verifyGoogleIdToken(token: string, clientId: string, now = Date.now(), fetcher: typeof fetch = fetch): Promise<GoogleIdentity> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed_token');
  const [h, p, sig] = parts as [string, string, string];
  const header = b64urlJson<{ alg: string; kid: string }>(h);
  if (header.alg !== 'RS256') throw new Error('bad_alg');
  const jwk = (await googleKeys(fetcher)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown_key');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('bad_signature');

  const c = b64urlJson<Record<string, unknown>>(p);
  if (!ISSUERS.includes(String(c.iss))) throw new Error('bad_issuer');
  if (c.aud !== clientId) throw new Error('bad_audience');
  if (typeof c.exp !== 'number' || c.exp * 1000 < now - 60_000) throw new Error('expired');
  if (c.email_verified !== true && c.email_verified !== 'true') throw new Error('email_not_verified');
  if (typeof c.sub !== 'string' || typeof c.email !== 'string') throw new Error('missing_claims');
  return {
    sub: c.sub,
    email: c.email.toLowerCase(),
    name: typeof c.name === 'string' ? c.name.slice(0, 80) : '',
    givenName: typeof c.given_name === 'string' ? c.given_name : '',
    picture: typeof c.picture === 'string' && c.picture.startsWith('https://') ? c.picture.slice(0, 300) : '',
  };
}

/** For tests. */
export function resetGoogleKeyCache(): void {
  cache = null;
}
