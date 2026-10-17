import { ANALYTICS } from './env';

/**
 * Lightweight, privacy-friendly analytics seam. Call `track()` from anywhere; the configured sink
 * decides what happens. No cookies, no personal data: event props are game slugs, categories,
 * counts and scores only. See docs/ANALYTICS.md.
 */
export type AnalyticsEvent =
  | 'game_view'
  | 'game_start'
  | 'game_end'
  | 'replay_click'
  | 'share_click'
  | 'daily_complete'
  | 'search'
  | 'category_select'
  | 'game_error';

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

/** Umami (https://umami.is): cookieless; page views are tracked by its script, events via umami.track. */
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

function createSink(): Sink | null {
  if (ANALYTICS.provider === 'console') return consoleSink;
  if (ANALYTICS.provider === 'umami' && ANALYTICS.umamiWebsiteId) return umamiSink(ANALYTICS.umamiWebsiteId, ANALYTICS.umamiSrc);
  return null;
}

let sink: Sink | null | undefined;

export function track(event: AnalyticsEvent, props: Props = {}): void {
  recent.push({ event, props, t: Date.now() });
  if (recent.length > 100) recent.shift();
  if (typeof window !== 'undefined') window.__glitchbound = { events: recent };
  try {
    if (sink === undefined) sink = createSink();
    sink?.track(event, props);
  } catch {
    // Analytics must never break the site.
  }
}

/** For tests. */
export function setSink(s: Sink | null): void {
  sink = s;
}
