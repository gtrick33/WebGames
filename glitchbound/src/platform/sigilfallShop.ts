import { PRODUCTS, type Product } from '../catalog/shop';
import { account } from './account';
import { getLiveCatalog, subscribeLiveCatalog } from './liveCatalog';

/**
 * What Sigilfall needs from the site's shop (src/games/sigilfall/progress/shopGoods.ts): the items as the admins last
 * saved them, and what this account's purchases unlock right now. A guest owns nothing; a refund takes an item off.
 */
export function sigilfallShop(): { items: readonly Product[]; owned: readonly string[] } {
  return { items: getLiveCatalog().raw.shopItems ?? PRODUCTS, owned: account.get().me?.owned ?? [] };
}

/** Says whenever either changes (a sign-in, a purchase confirmed, the shop list saved). Returns how to stop. */
export function watchSigilfallShop(fn: () => void): () => void {
  const a = account.subscribe(fn);
  const b = subscribeLiveCatalog(fn);
  return () => {
    a();
    b();
  };
}
