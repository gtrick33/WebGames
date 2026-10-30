import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playerOf } from '../server/challenges';
import type { Ctx, Env } from '../server/http';
import { onRequestPost as guestPost } from '../functions/api/guest';

const realLocal = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
const realSession = Object.getOwnPropertyDescriptor(window, 'sessionStorage')!;

/** What Chrome and Safari do when the player blocks site data: the getter itself throws. */
function blockStorage(which: 'localStorage' | 'sessionStorage' = 'localStorage'): void {
  Object.defineProperty(window, which, {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
}

afterEach(() => {
  Object.defineProperty(window, 'localStorage', realLocal);
  Object.defineProperty(window, 'sessionStorage', realSession);
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('a browser that blocks storage', () => {
  it('still gets the arcade, not a blank page (PS-03)', async () => {
    blockStorage();
    vi.resetModules(); // module-init reads run again with storage blocked
    const { Root } = await import('../src/App');
    window.history.replaceState(null, '', '/');
    render(<Root />);
    expect(screen.getByRole('heading', { level: 1, name: /Small games\.\s*Big obsessions\./ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('visitInfo reports nothing instead of throwing', async () => {
    blockStorage();
    const { visitInfo } = await import('../src/platform/visit');
    expect(visitInfo()).toBeNull();
  });

  it('shows a storage notice instead of a white page when the app crashes anyway', async () => {
    blockStorage();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { ErrorBoundary, CrashNotice } = await import('../src/components/ErrorBoundary');
    const Boom = (): never => {
      throw new Error('boom');
    };
    render(
      <ErrorBoundary fallback={() => <CrashNotice />}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/Your browser is blocking storage.*nothing will be saved/);
  });
});

describe('guest keys without storage (PS-04)', () => {
  it('gives each storage-blocked visit its own random key, kept for the visit', async () => {
    blockStorage();
    const a = (await import('../src/platform/challenges')).playerKey();
    expect(a).toMatch(/^[a-z0-9]{24}$/);
    expect(a).not.toBe('nostorage-device-key-0000');
    expect((await import('../src/platform/challenges')).playerKey()).toBe(a);
    // a reload in the same tab keeps it (sessionStorage still works)...
    vi.resetModules();
    expect((await import('../src/platform/challenges')).playerKey()).toBe(a);
    // ...another tab or device is someone else
    sessionStorage.clear();
    vi.resetModules();
    expect((await import('../src/platform/challenges')).playerKey()).not.toBe(a);
  });

  it('still works when writes fail and sessionStorage is blocked too', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('', 'QuotaExceededError');
    });
    const { playerKey } = await import('../src/platform/challenges');
    const a = playerKey();
    expect(a).toMatch(/^[a-z0-9]{24}$/);
    expect(playerKey()).toBe(a);
    vi.resetModules();
    blockStorage('sessionStorage');
    expect((await import('../src/platform/challenges')).playerKey()).not.toBe(a);
  });

  it('the server refuses the old shared fallback key', async () => {
    const env = {} as Env; // no session cookie: currentUser never reaches the database
    const req = (key: string) => new Request(`https://x.test/api/challenges?key=${key}`);
    expect(await playerOf(env, req('nostorage-device-key-0000'), null)).toBeNull();
    expect(await playerOf(env, req('abcdefghijklmnop1234'), null)).toBe('g:abcdefghijklmnop1234');
  });
});

describe('the server keeps the guest key (gb_guest cookie)', () => {
  const ctx = (body: unknown, cookie = '') =>
    ({ request: new Request('https://x.test/api/guest', { method: 'POST', headers: { origin: 'https://x.test', 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }), env: {} }) as unknown as Ctx;
  const keyOf = async (res: Response) => ((await res.json()) as { key: string }).key;

  it('adopts the key the browser keeps, then its cookie wins', async () => {
    const first = await guestPost(ctx({ key: 'keptkeptkeptkept1234' }));
    expect(await keyOf(first)).toBe('keptkeptkeptkept1234');
    expect(first.headers.get('set-cookie')).toMatch(/^gb_guest=keptkeptkeptkept1234; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
    // storage was cleared and a new key made: the cookie brings the old one back
    expect(await keyOf(await guestPost(ctx({ key: 'newnewnewnewnew12345' }, 'gb_guest=keptkeptkeptkept1234')))).toBe('keptkeptkeptkept1234');
    // storage blocked: the visit's own key, else a fresh one; never the old shared key
    expect(await keyOf(await guestPost(ctx({ hint: 'hinthinthinthint1234' })))).toBe('hinthinthinthint1234');
    const fresh = await keyOf(await guestPost(ctx({ key: 'nostorage-device-key-0000' }, 'gb_guest=nostorage-device-key-0000')));
    expect(fresh).toMatch(/^[a-z0-9]{24}$/);
    // other sites can't read or set it
    const foreign = new Request('https://x.test/api/guest', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' });
    expect((await guestPost({ request: foreign, env: {} } as unknown as Ctx)).status).toBe(403);
  });

  it('counts the cookie as the guest when a request has no usable key', async () => {
    const req = new Request('https://x.test/api/challenges?key=nostorage-device-key-0000', { headers: { cookie: 'gb_guest=keptkeptkeptkept1234' } });
    expect(await playerOf({} as Env, req, null)).toBe('g:keptkeptkeptkept1234');
  });

  it('a storage-blocked browser gets its key back from the server', async () => {
    blockStorage();
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ key: 'keptkeptkeptkept1234' }), { status: 200 }));
    const { playerKey, syncGuestKey } = await import('../src/platform/challenges');
    const visit = playerKey();
    await syncGuestKey();
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({ hint: visit });
    expect(playerKey()).toBe('keptkeptkeptkept1234');
  });

  it('a browser whose storage was cleared caches the server key again', async () => {
    localStorage.setItem('glitchbound.playerKey', 'newnewnewnewnew12345');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ key: 'keptkeptkeptkept1234' }), { status: 200 }));
    const { playerKey, syncGuestKey } = await import('../src/platform/challenges');
    await syncGuestKey();
    expect(localStorage.getItem('glitchbound.playerKey')).toBe('keptkeptkeptkept1234');
    expect(playerKey()).toBe('keptkeptkeptkept1234');
  });
});
