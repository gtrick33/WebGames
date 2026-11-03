import { readCookie } from './session';

/**
 * A guest's player key (challenges and rooms), kept by the server in an essential httpOnly cookie; the
 * browser's localStorage is only a cache of it. A guest whose storage is blocked, full or cleared keeps the
 * same seats as long as the cookie lasts (its key wins over the cached one; see functions/api/guest.ts).
 */
export const GUEST_COOKIE = 'gb_guest';
const DAYS = 400; // the longest a browser keeps a cookie

/** The shared key old clients sent when they couldn't keep one: everyone's key, so no one's. */
export const SHARED_FALLBACK_KEY = 'nostorage-device-key-0000';

export const validGuestKey = (v: unknown): v is string => typeof v === 'string' && v !== SHARED_FALLBACK_KEY && /^[A-Za-z0-9_-]{16,64}$/.test(v);

export function guestCookieKey(request: Request): string | null {
  const v = readCookie(request, GUEST_COOKIE);
  return validGuestKey(v) ? v : null;
}

export function guestCookie(key: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${GUEST_COOKIE}=${key}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`;
}

export function clearGuestCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${GUEST_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
