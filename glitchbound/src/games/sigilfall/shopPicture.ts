import type { SigilSpec } from '../../catalog/sigilItems';
import { shopLookOf, shopMountOf } from './progress/shopGoods';
import { heroLook } from './render/sprites';
import { shopLookPicture, shopMountPicture, warmPortraits } from './render3d/portrait';

/**
 * Pictures of Sigilfall's shop items for the site's own pages (the shop, the admin's item builder): the game's models,
 * as the game builds them, photographed once. The site loads this only when a page asks for one, since it brings the
 * game's renderer with it. Null where there's no WebGL, or if the models never come.
 */
export async function sigilPicture(spec: SigilSpec, size: number): Promise<string | null> {
  try {
    await warmPortraits();
  } catch {
    return null;
  }
  // (a mount's model is fetched the first time it's asked for: it comes in a moment later)
  for (let tries = 0; tries < 100; tries++) {
    const url = draw(spec, size);
    if (url) return url;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  return null;
}

function draw(spec: SigilSpec, size: number, turn?: number): string | null {
  if (spec.kind === 'mount') return shopMountPicture(shopMountOf('sigil-preview', '', '', spec), Math.round(size * 1.25), size, turn);
  const look = shopLookOf('sigil-preview', '', spec);
  const hero = heroLook('paladin', {}, { [spec.slot]: look }, 'm');
  return spec.slot === 'head' ? shopLookPicture(hero, true, size, size, turn) : shopLookPicture(hero, false, size, Math.round(size * 1.25), turn);
}

/**
 * An item turning on a stand, for looking it over before buying: `frames` pictures all the way round, each handed to
 * `got` as it's drawn (the first straight away, the rest a few at a time so the page stays live). Stops when `live` says.
 */
export async function sigilSpin(spec: SigilSpec, size: number, frames: number, got: (i: number, url: string) => void, live: () => boolean): Promise<boolean> {
  try {
    await warmPortraits();
  } catch {
    return false;
  }
  const turnAt = (i: number): number => (spec.kind === 'mount' ? Math.PI / 2 - 0.62 : 0.5) + (i / frames) * Math.PI * 2;
  let first: string | null = null;
  for (let tries = 0; tries < 100 && !first; tries++) {
    if (!live()) return false;
    first = draw(spec, size, turnAt(0));
    if (!first) await new Promise((ok) => setTimeout(ok, 100));
  }
  if (!first) return false;
  got(0, first);
  for (let i = 1; i < frames; i++) {
    if (i % 3 === 0) await new Promise((ok) => setTimeout(ok, 0));
    if (!live()) return false;
    const url = draw(spec, size, turnAt(i));
    if (url) got(i, url);
  }
  return true;
}
