import { daysBetween, dayKey } from './dates';

const LAST_KEY = 'glitchbound.lastVisit';
const SESSION_KEY = 'glitchbound.visitSent';

export interface VisitInfo {
  visit: 'new' | 'returning';
  /** Whole days since the previous visit on this device (0 = earlier today), capped at 60. */
  gap_days: number;
}

/**
 * Whether this browser has been here before, for retention numbers without any identifier: only
 * "new/returning" and the gap in days leave the device. Returns info once per tab session, null after.
 */
export function visitInfo(now: Date = new Date(), local: Storage = localStorage, session: Storage = sessionStorage): VisitInfo | null {
  try {
    if (session.getItem(SESSION_KEY)) return null;
    session.setItem(SESSION_KEY, '1');
    const today = dayKey(now);
    const last = local.getItem(LAST_KEY);
    local.setItem(LAST_KEY, today);
    if (!last || !/^\d{4}-\d{2}-\d{2}$/.test(last)) return { visit: 'new', gap_days: 0 };
    return { visit: 'returning', gap_days: Math.min(60, Math.max(0, daysBetween(last, today))) };
  } catch {
    return null; // storage blocked: report nothing rather than guess
  }
}
