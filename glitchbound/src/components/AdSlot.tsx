import { useEffect, useRef } from 'react';
import { ADS } from '../platform/env';
import { embedHost } from '../platform/embed';

/**
 * Optional display ad (Google AdSense). Renders NOTHING unless VITE_ADSENSE_CLIENT is a valid
 * publisher id, VITE_ADS_ENABLED=on, and a slot id is configured for this placement.
 * Rules: never inside or over a game, always labelled, space reserved to avoid layout shift.
 * See docs/MONETIZATION.md.
 */
declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptAdded = false;
function loadAdSense(client: string): void {
  if (scriptAdded) return;
  scriptAdded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

export function AdSlot({ placement }: { placement: keyof typeof ADS.slots }) {
  // No ads inside the Discord Activity (Discord's sandbox blocks the ad script anyway).
  const slot = embedHost() ? '' : ADS.slots[placement];
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ADS.enabled || !slot || !ref.current) return;
    loadAdSense(ADS.client);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // An ad failing must never affect the page.
    }
  }, [slot]);

  if (!ADS.enabled || !slot) return null;
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
