/**
 * When to ask for a rating. Polite by design: only after a few finished rounds, only in the lobby,
 * at most every 10 days, never again for 60 days after an answer, and never after three "not now"s.
 * State lives on this device only.
 */
export const FEEDBACK_KEY = 'glitchbound.feedback';
export const MIN_ROUNDS = 3;
export const ASK_EVERY_DAYS = 10;
export const QUIET_AFTER_SENT_DAYS = 60;
export const MAX_DISMISSALS = 3;
/** Seconds in the lobby before the card slides in. */
export const LOBBY_DELAY_S = 15;

export interface FeedbackState {
  lastShown: number;
  sentAt: number;
  dismissals: number;
}

const DAY = 86400_000;

export const emptyFeedback = (): FeedbackState => ({ lastShown: 0, sentAt: 0, dismissals: 0 });

export function readFeedback(): FeedbackState {
  try {
    const o = JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? '{}') as Partial<FeedbackState>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    return { lastShown: n(o.lastShown), sentAt: n(o.sentAt), dismissals: Math.floor(n(o.dismissals)) };
  } catch {
    return emptyFeedback();
  }
}

export function writeFeedback(s: FeedbackState): void {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the card may simply ask again another day */
  }
}

/** Whether the lobby may ask now. */
export function shouldAsk(s: FeedbackState, roundsPlayed: number, now: number): boolean {
  if (roundsPlayed < MIN_ROUNDS) return false;
  if (s.dismissals >= MAX_DISMISSALS) return false;
  if (s.sentAt && now - s.sentAt < QUIET_AFTER_SENT_DAYS * DAY) return false;
  if (s.lastShown && now - s.lastShown < ASK_EVERY_DAYS * DAY) return false;
  return true;
}

/* Anyone (footer link, game page) can open the card on demand. */
type Opener = (game?: string) => void;
let opener: Opener | null = null;
export const registerFeedbackOpener = (fn: Opener | null): void => {
  opener = fn;
};
export const openFeedback = (game?: string): void => opener?.(game);
