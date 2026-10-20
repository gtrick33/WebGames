import { SITE_URL } from './env';
import { isSyncedKey } from './syncKeys';

/**
 * www.glitchboundstudio.com and the Pages address serve the same site, but a browser keeps saves and
 * the sign-in per address: playing on one and then the other looks like progress vanished. Visitors
 * who have nothing saved on such an address are sent to the main one. Anyone with saves there stays,
 * so nothing is stranded (signed-in players' saves follow the account anyway, platform/cloudSave.ts).
 * Deploy previews (<hash>.glitchbound-d8m.pages.dev) are left alone for testing.
 */
const site = new URL(SITE_URL);
const ALIASES = new Set([`www.${site.hostname}`, 'glitchbound-d8m.pages.dev']);

function hasSaves(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (isSyncedKey(k) || k === 'neonrush.save')) return true;
    }
  } catch {
    /* storage blocked: nothing here to keep */
  }
  return false;
}

/** Moves a visitor on an alias address to the main one; true when the page is leaving. */
export function goToMainAddress(): boolean {
  if (!ALIASES.has(location.hostname) || hasSaves()) return false;
  location.replace(`${site.origin}${location.pathname}${location.search}${location.hash}`);
  return true;
}
