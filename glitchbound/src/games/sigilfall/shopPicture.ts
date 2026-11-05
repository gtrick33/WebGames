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

function draw(spec: SigilSpec, size: number): string | null {
  if (spec.kind === 'mount') return shopMountPicture(shopMountOf('sigil-preview', '', '', spec), Math.round(size * 1.25), size);
  const look = shopLookOf('sigil-preview', '', spec);
  const hero = heroLook('paladin', {}, { [spec.slot]: look }, 'm');
  return spec.slot === 'head' ? shopLookPicture(hero, true, size, size) : shopLookPicture(hero, false, size, Math.round(size * 1.25));
}
