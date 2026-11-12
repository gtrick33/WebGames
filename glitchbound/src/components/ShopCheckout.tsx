import { useEffect, useRef, useState } from 'react';
import { PRODUCTS, type Product } from '../catalog/shop';
import type { ShopText } from '../i18n/shopTypes';
import { api, ApiError } from '../platform/account';

type W = ShopText['shop'];

/** An item's name and description in the reader's language, while it still reads as the code wrote it (an item an admin made or renamed reads as they wrote it). */
export function itemText(t: ShopText, p: Product): { name: string; blurb: string } {
  const mine = t.items[p.id];
  const code = PRODUCTS.find((x) => x.id === p.id);
  if (!mine || !code) return { name: p.name, blurb: p.blurb };
  return { name: p.name === code.name ? mine.name : p.name, blurb: p.blurb === code.blurb ? mine.blurb : p.blurb };
}

/** The class names the checkout is drawn with: the site's own, or those of a game that shows it inside itself. */
export interface CheckoutLook {
  box: string;
  small: string;
  row: string;
  pay: string;
  cancel: string;
}
const SITE_LOOK: CheckoutLook = { box: 'shop-checkout', small: 'info-small', row: 'reset-row', pay: 'btn btn-primary', cancel: 'btn btn-ghost' };

/**
 * The last step before paying: the two statements, each ticked by hand, and the price again. It opens inside the item's
 * own panel, scrolled into view with the focus on it, so it shows up where the button was pressed. The statements are in
 * the language the buyer reads, and the purchase records which (the confirmation email repeats them in it).
 *
 * One checkout for the whole site: the shop page shows it, and so does the shop inside Sigilfall (`back` then brings
 * the buyer home to the game after paying, and `look` dresses it as the game's own panels are dressed). The statements,
 * the price and the request are the same wherever it is shown.
 */
export function Checkout({ product, name, price, lang, w, onClose, back, look = SITE_LOOK }: { product: Product; name: string; price: string; lang: string; w: W; onClose: () => void; back?: 'sigilfall'; look?: CheckoutLook }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    title.current?.focus({ preventScroll: true });
  }, []);
  const [now, setNow] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = (): void => {
    setBusy(true);
    setError('');
    api<{ url: string }>('/api/shop/checkout', { body: { product: product.id, agreeNow: now, agreeAge: age, lang, ...(back ? { back } : {}) } })
      .then((r) => window.location.assign(r.url))
      .catch((e: unknown) => {
        setBusy(false);
        setError(e instanceof ApiError && e.code === 'already_yours' ? w.already : w.failed);
      });
  };
  return (
    <div className={look.box} role="group" aria-labelledby={`shop-buy-${product.id}`}>
      <h3 id={`shop-buy-${product.id}`} ref={title} tabIndex={-1}>
        {name}: {price}
      </h3>
      <p className={look.small}>{w.checkoutNote}</p>
      <label className={look.small}>
        <input type="checkbox" checked={now} onChange={(e) => setNow(e.target.checked)} /> {w.agreeNow}
      </label>
      <label className={look.small}>
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /> {w.agreeAge}
      </label>
      {error && <p role="alert">{error}</p>}
      <div className={look.row}>
        <button className={look.pay} disabled={!now || !age || busy} onClick={go}>
          {w.pay}
        </button>
        <button className={look.cancel} onClick={onClose}>
          {w.cancel}
        </button>
      </div>
    </div>
  );
}
