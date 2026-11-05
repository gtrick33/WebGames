import { useEffect, useRef, useState } from 'react';
import { Banner, LookAvatar } from '../components/Looks';
import { openSignIn } from '../components/openSignIn';
import { isLook } from '../catalog/looks';
import { AGREE_AGE, AGREE_NOW, priceText, PRODUCTS, type Product } from '../catalog/shop';
import { useLiveCatalog } from '../platform/liveCatalog';
import { api, ApiError, useAccount } from '../platform/account';
import { usePageMeta } from '../platform/meta';
import { useMoney } from '../platform/money';
import { Link } from '../router/router';
import './InfoPages.css';

/**
 * The shop: one-time purchases, in plain words. No countdowns, no "last chance", no pressure, and the full price up
 * front (src/catalog/shop.ts has the rules). Until the shop is opened in Admin › Ads & shop it has no tab and nothing can
 * be bought, but the page can be read by its address, hidden from search: Stripe's reviewers must be able to see what is
 * sold and at what price, without a password. An admin can test a purchase here while it's closed.
 * English only for now: translate it before opening (docs/LEGAL-READINESS.md).
 */
export function ShopPage() {
  usePageMeta({ title: 'Shop', description: 'Optional one-time extras for GlitchBound. Every game stays free to play.', path: '/shop' });
  const money = useMoney();
  const items = useLiveCatalog().raw.shopItems ?? PRODUCTS;
  const { me } = useAccount();
  const [buying, setBuying] = useState<Product | null>(null);
  const canBuy = money.shop || !!me?.isAdmin;
  const owned = new Set(me?.owned ?? []);
  const bought = new URLSearchParams(window.location.search).get('bought');
  const now = items.filter((p) => !p.later && !p.hidden);
  const later = items.filter((p) => p.later && !p.hidden);
  return (
    <div className="wrap info-page">
      <h1 className="info-title">Shop</h1>
      <p className="info-lead">Every game stays free to play. These are optional extras, each paid for once: no subscriptions, no game currency and no random boxes. Nothing here helps you win.</p>
      {!money.shop && (
        <p className="info-small" role="status">
          {me?.isAdmin ? 'Admin test: the shop is closed to players, and you can test a purchase here.' : 'The shop isn’t open yet, so nothing can be bought right now.'}
        </p>
      )}
      {bought && <p className="info-small" role="status">Thank you. Your purchase reaches your account as soon as the payment is confirmed, usually within a minute.</p>}
      <div className="info-cols">
        {now.map((p) => (
          <section key={p.id} className="panel info-block">
            {isLook(p.id) && <LookPreview id={p.id} name={me?.nickname ?? 'GlitchBound'} src={me?.avatar} />}
            <h2>{p.name}</h2>
            <p>{p.blurb}</p>
            <p>
              <strong>{priceText(p.cents)}</strong> <span className="info-small">VAT included, paid once</span>
            </p>
            {owned.has(p.id) ? (
              <p className="info-small">
                This is yours.
                {isLook(p.id) && (
                  <>
                    {' '}
                    <Link href="/me#looks">Wear it on your profile</Link>.
                  </>
                )}
              </p>
            ) : !canBuy ? (
              <p className="info-small">Not on sale yet.</p>
            ) : me && buying?.id === p.id ? (
              <Checkout product={p} onClose={() => setBuying(null)} />
            ) : me ? (
              <button className="btn btn-primary" onClick={() => setBuying(p)}>
                Get {p.name}
              </button>
            ) : (
              <button className="btn" onClick={() => openSignIn('Sign in so a purchase stays with your account.')}>
                Sign in first
              </button>
            )}
          </section>
        ))}
        {later.length > 0 && (
          <section className="panel info-block">
            <h2>Planned</h2>
            <ul>
              {later.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}:</strong> {p.blurb}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="info-small">
        See the <Link href="/terms/sale">terms of sale</Link> for your rights, refunds and who you are buying from.
      </p>
    </div>
  );
}

/** What a border or banner looks like before buying it: on your own picture, or across a profile and a board row. */
function LookPreview({ id, name, src }: { id: string; name: string; src?: string }) {
  if (isLook(id, 'border')) {
    return (
      <div className="shop-look shop-look-border">
        <LookAvatar name={name} src={src} size={104} border={id} />
      </div>
    );
  }
  return (
    <div className="shop-look shop-look-banner">
      <Banner id={id} className="shop-look-art" />
    </div>
  );
}

/**
 * The last step before paying: the two statements, each ticked by hand, and the price again. It opens inside the item's
 * own panel, scrolled into view with the focus on it, so it shows up where the button was pressed.
 */
function Checkout({ product, onClose }: { product: Product; onClose: () => void }) {
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
    api<{ url: string }>('/api/shop/checkout', { body: { product: product.id, agreeNow: now, agreeAge: age } })
      .then((r) => window.location.assign(r.url))
      .catch((e: unknown) => {
        setBusy(false);
        setError(e instanceof ApiError && e.code === 'already_yours' ? 'This is already yours.' : 'The checkout could not open. Nothing was charged. Please try again.');
      });
  };
  return (
    <div className="shop-checkout" role="group" aria-labelledby={`shop-buy-${product.id}`}>
      <h3 id={`shop-buy-${product.id}`} ref={title} tabIndex={-1}>
        {product.name}: {priceText(product.cents)}
      </h3>
      <p className="info-small">VAT included. One payment, no subscription. Our payment provider, Stripe, takes the payment and sends your receipt.</p>
      <label className="info-small">
        <input type="checkbox" checked={now} onChange={(e) => setNow(e.target.checked)} /> {AGREE_NOW}
      </label>
      <label className="info-small">
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /> {AGREE_AGE}
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="reset-row">
        <button className="btn btn-primary" disabled={!now || !age || busy} onClick={go}>
          Continue to payment
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
