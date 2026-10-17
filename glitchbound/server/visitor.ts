import { sha256, utcDay } from './http';

/**
 * An anonymous visitor key that changes every day: hash(day + IP + browser). The IP is never
 * stored, and keys cannot be linked across days. No cookies or local storage are involved.
 */
export async function visitorKey(request: Request, now = Date.now()): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  const ua = request.headers.get('user-agent') ?? '';
  return (await sha256(`${utcDay(now)}|${ip}|${ua}|glitchbound-v1`)).slice(0, 16);
}

export function browserFamily(ua: string): string {
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  return `${br} / ${os}`;
}
