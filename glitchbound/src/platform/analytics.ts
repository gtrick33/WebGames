import { ANALYTICS } from './env';

/**
 * Privacy-friendly analytics. Call `track()` from anywhere. Events go to our own /api/events
 * (first-party, cookieless: the server derives a daily-rotating anonymous visitor key and never
 * stores IPs) and, optionally, to Umami. Props are game slugs, categories, counts and scores only.
 * See docs/ANALYTICS.md.
 */
export type AnalyticsEvent =
  | 'page_view'
  | 'game_view'
  | 'game_start'
  | 'game_end'
  | 'replay_click'
  | 'game_close'
  | 'share_click'
  | 'daily_complete'
  | 'search'
  | 'category_select'
  | 'game_error'
  | 'favorite'
  | 'sign_in'
  | 'subscribe'
  | 'feedback_prompt'
  | 'feedback_sent'
  | 'bug_report'
  | 'daily_share';

export type Props = Record<string, string | number | boolean>;

export interface Sink {
  track(event: AnalyticsEvent, props: Props): void;
}

/** Recent events, readable from the console as `__glitchbound.events` (useful when testing). */
const recent: { event: AnalyticsEvent; props: Props; t: number }[] = [];

declare global {
  interface Window {
    umami?: { track(event: string, data?: Record<string, unknown>): void };
    __glitchbound?: { events: typeof recent };
  }
}

const consoleSink: Sink = { track: (e, p) => console.info('[analytics]', e, p) };

function umamiSink(websiteId: string, src: string): Sink {
  if (typeof document !== 'undefined' && !document.querySelector('script[data-website-id]')) {
    const s = document.createElement('script');
    s.defer = true;
    s.src = src;
    s.dataset.websiteId = websiteId;
    document.head.appendChild(s);
  }
  return { track: (e, p) => window.umami?.track(e, p) };
}

/** Batches events to /api/events; flushes every few seconds and when the page is hidden. */
function firstPartySink(): Sink {
  let queue: { name: AnalyticsEvent; props: Props }[] = [];
  let timer = 0;
  const flush = (useBeacon = false): void => {
    window.clearTimeout(timer);
    timer = 0;
    if (!queue.length) return;
    const body = JSON.stringify({ events: queue.splice(0, 25) });
    try {
      if (useBeacon && navigator.sendBeacon) navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
      else void fetch('/api/events', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined);
    } catch {
      /* never break the page */
    }
    if (queue.length) timer = window.setTimeout(() => flush(), 1000);
  };
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
  return {
    track: (name, props) => {
      queue.push({ name, props });
      if (queue.length > 200) queue = queue.slice(-200);
      if (queue.length >= 20) flush();
      else if (!timer) timer = window.setTimeout(() => flush(), 4000);
    },
  };
}

function createSinks(): Sink[] {
  const sinks: Sink[] = [];
  if (import.meta.env.DEV) sinks.push(consoleSink);
  if (import.meta.env.PROD && import.meta.env.MODE !== 'test') sinks.push(firstPartySink());
  if (ANALYTICS.provider === 'umami' && ANALYTICS.umamiWebsiteId) sinks.push(umamiSink(ANALYTICS.umamiWebsiteId, ANALYTICS.umamiSrc));
  return sinks;
}

let sinks: Sink[] | undefined;

export function track(event: AnalyticsEvent, props: Props = {}): void {
  recent.push({ event, props, t: Date.now() });
  if (recent.length > 100) recent.shift();
  if (typeof window === 'undefined') return;
  window.__glitchbound = { events: recent };
  try {
    sinks ??= createSinks();
    for (const s of sinks) s.track(event, props);
  } catch {
    // Analytics must never break the site.
  }
}

/** For tests. */
export function setSink(s: Sink | null): void {
  sinks = s ? [s] : [];
}

/* ------------------------------------------------------------------ crash + bug reports */

let reported = 0;

export function reportError(kind: string, message: string, game = ''): void {
  if (typeof window === 'undefined' || !import.meta.env.PROD || reported >= 8) return;
  reported++;
  try {
    void fetch('/api/errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, message: message.slice(0, 300), game, path: location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function installErrorReporting(): void {
  window.addEventListener('error', (e) => {
    // Ignore errors from third-party scripts (opaque "Script error.").
    if (!e.message || e.message === 'Script error.') return;
    reportError('js_error', `${e.message} @ ${(e.filename ?? '').split('/').pop()}:${e.lineno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r: unknown = e.reason;
    reportError('unhandled_rejection', r instanceof Error ? r.message : String(r));
  });
}
