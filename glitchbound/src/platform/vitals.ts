import { track } from './analytics';

/**
 * How fast the site really is for the people on it: the three Core Web Vitals of each page load, measured in their own
 * browser and sent once to the anonymous stats when the page is hidden (the admin's dashboard shows the 75th percentile,
 * the figure Google judges a site by). Loaded on its own after start-up: the numbers are buffered by the browser.
 */
export function watchVitals(page: string): void {
  if (typeof PerformanceObserver === 'undefined') return;
  let lcp = 0;
  // Layout shift: the worst burst (shifts under a second apart, five seconds at most), as Google counts it.
  let cls = 0;
  let burst = 0;
  let burstStart = 0;
  let burstEnd = 0;
  // Slowest response to a tap or key per interaction; the worst of them, ignoring one in fifty as outliers.
  const interactions = new Map<number, number>();

  const watch = (type: string, read: (list: PerformanceEntryList) => void, extra: object = {}): void => {
    try {
      new PerformanceObserver((l) => read(l.getEntries())).observe({ type, buffered: true, ...extra });
    } catch {
      // This browser doesn't report this one.
    }
  };
  watch('largest-contentful-paint', (list) => {
    const last = list[list.length - 1];
    if (last) lcp = last.startTime;
  });
  watch('layout-shift', (list) => {
    for (const e of list as unknown as { value: number; startTime: number; hadRecentInput: boolean }[]) {
      if (e.hadRecentInput) continue;
      if (e.startTime - burstEnd > 1000 || e.startTime - burstStart > 5000) {
        burst = 0;
        burstStart = e.startTime;
      }
      burst += e.value;
      burstEnd = e.startTime;
      cls = Math.max(cls, burst);
    }
  });
  watch(
    'event',
    (list) => {
      for (const e of list as unknown as { interactionId?: number; duration: number }[]) {
        if (!e.interactionId) continue;
        interactions.set(e.interactionId, Math.max(interactions.get(e.interactionId) ?? 0, e.duration));
      }
    },
    { durationThreshold: 40 },
  );

  let sent = false;
  // On the document, which hears it before the stats' own listener on the window: the batch sent then includes this.
  document.addEventListener('visibilitychange', () => {
    if (sent || document.visibilityState !== 'hidden' || !lcp) return;
    sent = true;
    const worst = [...interactions.values()].sort((a, b) => b - a);
    const props: Record<string, string | number> = {
      page,
      device: matchMedia('(pointer: coarse)').matches ? 'phone' : 'computer',
      lcp: Math.round(lcp),
      cls: Math.round(cls * 1000) / 1000,
    };
    if (worst.length) props.inp = Math.round(worst[Math.floor(worst.length / 50)]!);
    track('web_vitals', props);
  });
}
