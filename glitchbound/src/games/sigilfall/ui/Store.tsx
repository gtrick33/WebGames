import { useState } from 'react';
import { GLOAMKNIGHT_ITEM, offered, PRODUCTS, type Product } from '../../../catalog/shop';
import { openSignIn } from '../../../components/openSignIn';
import { Checkout, itemText, type CheckoutLook } from '../../../components/ShopCheckout';
import { SigilPicture } from '../../../components/SigilPicture';
import { fill, priceIn, rich, useShopText } from '../../../i18n/shopText';
import { useAccount } from '../../../platform/account';
import { useLiveCatalog } from '../../../platform/liveCatalog';
import { useMoney } from '../../../platform/money';
import { heldWeapon, heroDollUrl, heroLook } from '../render/sprites';
import { Frame } from './common';
import { Doll } from './Doll';

/**
 * Sigilfall's own shop: the Gloamknight Pack, the mounts and the Wardrobe looks, and nothing else of the site's. It
 * is the same shop as the site's page, shown where the things are used: the same items at the same prices, the same
 * two statements ticked by hand and the same checkout (components/ShopCheckout.tsx), which brings the buyer back here.
 *
 * It keeps the shop's rules (src/catalog/shop.ts): every price in full, one-time purchases, no countdowns and nothing
 * that makes a hero stronger. And it stays out of the way: nothing opens it but the player (the small button on the
 * title screen, the locked class on the hero screen, a line in the Wardrobe), it never comes up by itself, and nothing
 * in the game waits on it.
 */

/** Is there a shop to open? As the site's own tab: once it is opened in Admin › Ads & shop, and for an admin testing it. */
export function useStoreOpen(): boolean {
  const money = useMoney();
  const { me } = useAccount();
  return money.shop || !!me?.isAdmin;
}

/** The checkout dressed as the game's panels are. */
const LOOK: CheckoutLook = { box: 'rb-store-checkout', small: 'rb-small', row: 'rb-store-row', pay: 'rb-btn is-gold', cancel: 'rb-btn is-ghost' };

const isMount = (p: Product): boolean => p.sigil?.kind === 'mount';

export function StorePanel({ onClose, bought, focus }: { onClose: () => void; bought?: string | null; focus?: string | null }) {
  const { lang, words } = useShopText();
  const money = useMoney();
  const { me } = useAccount();
  const items = useLiveCatalog().raw.shopItems ?? PRODUCTS;
  const [buying, setBuying] = useState<string | null>(null);
  if (!words) return null;
  const w = words.shop;
  const canBuy = money.shop || !!me?.isAdmin;
  const owned = new Set(me?.owned ?? []);
  const text = (p: Product): { name: string; blurb: string } => itemText(words, p);
  const price = (p: Product): string => priceIn(lang, p.cents);
  const on = items.filter((p) => !p.later && offered(p, money));
  const pack = on.find((p) => p.id === GLOAMKNIGHT_ITEM);
  const mounts = on.filter(isMount);
  const looks = on.filter((p) => p.sigil && !isMount(p));
  const parts = (pack?.includes ?? []).map((id) => items.find((p) => p.id === id)).filter((p): p is Product => !!p);

  /** What the buyer can do about an item: it is theirs, they are buying it, they can, or they sign in first. */
  const action = (p: Product) =>
    owned.has(p.id) ? (
      <p className="rb-store-yours">{p.id === GLOAMKNIGHT_ITEM ? 'Yours. Make a Gloamknight from the hero screen.' : 'Yours. It’s in the Wardrobe of every hero.'}</p>
    ) : !canBuy ? (
      <p className="rb-small rb-dim">{w.notYet}</p>
    ) : !me ? (
      <button className="rb-btn is-small" onClick={() => openSignIn(w.signInWhy)}>
        {w.signInFirst}
      </button>
    ) : buying === p.id ? (
      <Checkout product={p} name={text(p).name} price={price(p)} lang={lang} w={w} onClose={() => setBuying(null)} back="sigilfall" look={LOOK} />
    ) : (
      <button className="rb-btn is-small is-gold" onClick={() => setBuying(p.id)}>
        {fill(w.get, { name: text(p).name })}
      </button>
    );
  const cost = (p: Product) => (
    <p className="rb-store-price">
      <strong>{price(p)}</strong> <span className="rb-small rb-dim">{w.vat}</span>
    </p>
  );
  const card = (p: Product) => (
    <li key={p.id} className={`rb-store-item${isMount(p) ? ' is-mount' : ''}${owned.has(p.id) ? ' is-owned' : ''}${buying === p.id ? ' is-buying' : ''}`}>
      {p.sigil && <SigilPicture id={p.id} spec={p.sigil} size={240} className="rb-store-pic" />}
      <div className="rb-store-words">
        <strong>{text(p).name}</strong>
        <span className="rb-small rb-dim">{text(p).blurb}</span>
        {cost(p)}
        {action(p)}
      </div>
    </li>
  );
  return (
    <Frame title="Shop" onClose={onClose} wide className="rb-store" label="Sigilfall shop">
      <div className="rb-store-body">
        <p className="rb-small rb-dim rb-store-lead">Optional, and each paid for once. {w.sigilNote}</p>
        {!money.shop && me?.isAdmin && (
          <p className="rb-small rb-store-note" role="status">
            {w.adminTest}
          </p>
        )}
        {bought && (
          <p className="rb-small rb-store-note is-good" role="status">
            {w.thanks}
          </p>
        )}
        {pack && (
          <section className={`rb-store-pack${focus === pack.id ? ' is-focus' : ''}${owned.has(pack.id) ? ' is-owned' : ''}`} aria-labelledby="rb-store-pack">
            <Doll className="rb-store-hero" src={heroDollUrl(heroLook('gloamknight', {}, {}, 'm'), 'down', 3, heldWeapon('gloamknight', undefined), false)} />
            <div className="rb-store-words">
              <h3 id="rb-store-pack">{text(pack).name}</h3>
              <p className="rb-small">{text(pack).blurb}</p>
              <ul className="rb-store-parts" aria-label={w.inPack}>
                <li>
                  <b>{w.packClass}</b>
                  <span className="rb-dim">{w.packClassWhat}</span>
                </li>
                {parts.map((x) => (
                  <li key={x.id}>
                    <b>{text(x).name}</b>
                  </li>
                ))}
              </ul>
              {cost(pack)}
              {action(pack)}
            </div>
          </section>
        )}
        {mounts.length > 0 && (
          <section aria-labelledby="rb-store-mounts">
            <h3 id="rb-store-mounts" className="rb-store-h">
              Mounts
            </h3>
            <ul className="rb-store-list">{mounts.map(card)}</ul>
          </section>
        )}
        {looks.length > 0 && (
          <section aria-labelledby="rb-store-looks">
            <h3 id="rb-store-looks" className="rb-store-h">
              Wardrobe looks
            </h3>
            <ul className="rb-store-list">{looks.map(card)}</ul>
          </section>
        )}
        {!pack && mounts.length + looks.length === 0 && <p className="rb-dim">Nothing is on sale right now.</p>}
        <p className="rb-small rb-dim rb-store-terms">
          {rich(w.terms, {
            terms: (x) => (
              <a href="/terms/sale" target="_blank" rel="noopener">
                {x}
              </a>
            ),
          })}
        </p>
      </div>
    </Frame>
  );
}
