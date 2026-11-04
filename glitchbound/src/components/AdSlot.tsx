import { useEffect, useRef } from 'react';
import { loadAdSense } from '../platform/adScript';
import { ADS } from '../platform/env';
import { embedHost } from '../platform/embed';
import { useAdFree } from '../platform/adFree';
import { bannersOn, useMoney } from '../platform/money';

/**
 * A banner ad (Google AdSense). Renders NOTHING unless the build has a publisher id and VITE_ADS_ENABLED=on, a slot id
 * is set for this placement, and the admins have switched banners on (Admin › Ads & shop).
 * Rules: never inside or next to a game (Google asks for 150 px at least), never on an adults-only page, none for a
 * member who bought the ad-free experience, always labeled, space reserved so the page doesn't jump, and Google's
 * script only loads when a slot is about to be seen. See docs/MONETIZATION.md.
 */
declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ placement, adult = false }: { placement: keyof typeof ADS.slots; adult?: boolean }) {
  const money = useMoney();
  const adFree = useAdFree();
  // No ads inside the Discord Activity (Discord's sandbox blocks the ad script anyway).
  const slot = embedHost() ? '' : ADS.slots[placement];
  const shown = placement === 'home' ? money.adsHome : money.adsGame;
  const on = bannersOn(money) && shown && !!slot && !adult && !adFree;
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof IntersectionObserver !== 'function') return;
    const watch = new IntersectionObserver(
      (seen) => {
        if (!seen.some((s) => s.isIntersecting)) return;
        watch.disconnect();
        loadAdSense(ADS.client);
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          // An ad failing must never affect the page.
        }
      },
      { rootMargin: '300px' },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, [on]);

  if (!on) return null;
  return (
    <aside className={`ad-slot ad-${placement}`} aria-label="Advertisement">
      <span className="ad-label mono">Advertisement</span>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADS.client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
        {...(ADS.test ? { 'data-adtest': 'on' } : {})}
      />
    </aside>
  );
}
