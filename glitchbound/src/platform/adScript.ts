/** Google's ad script, added once, and only when an ad is really about to be used (never with ads switched off). */
let added = false;

export function loadAdSense(client: string, test = false): void {
  if (added) return;
  added = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  s.crossOrigin = 'anonymous';
  // (Google's testing mode for the optional reward ads: never on for real traffic)
  if (test) s.setAttribute('data-adbreak-test', 'on');
  document.head.appendChild(s);
}

interface GoogleFc {
  callbackQueue: (Record<string, () => void> | (() => void))[];
  showRevocationMessage?: () => void;
}

/** Opens Google's consent message again, so a visitor can change what they chose (the footer's "Ad choices"). */
export function openAdChoices(): void {
  const w = window as unknown as { googlefc?: GoogleFc };
  w.googlefc = w.googlefc ?? { callbackQueue: [] };
  w.googlefc.callbackQueue.push(() => w.googlefc?.showRevocationMessage?.());
}
