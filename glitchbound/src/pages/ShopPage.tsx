import { useState } from 'react';
import { openSignIn } from '../components/openSignIn';
import { AGREE_AGE, AGREE_NOW, priceText, PRODUCTS, type Product } from '../catalog/shop';
import { useLiveCatalog } from '../platform/liveCatalog';
import { api, ApiError, useAccount } from '../platform/account';
import { usePageMeta } from '../platform/meta';
import { useMoney } from '../platform/money';
import { Link } from '../router/router';
import { NotFound } from './NotFound';
import './InfoPages.css';

/**
 * The shop: one-time purchases, in plain words. No countdowns, no "last chance", no pressure, and the full price up
 * front (src/catalog/shop.ts has the rules). Hidden until the shop is opened in Admin › Ads & shop; staff can see it.
 * English only for now: translate it before opening (docs/LEGAL-READINESS.md).
 */
export function ShopPage() {
  usePageMeta({ title: 'Shop', description: 'Optional one-time extras for GlitchBound. Every game stays free to play.', path: '/shop' });
  const money = useMoney();
  const items = useLiveCatalog().raw.shopItems ?? PRODUCTS;
  const { me } = useAccount();
  const [buying, setBuying] = useState<Product | null>(null);
  if (!money.shop && !me?.role) return <NotFound />;
  const owned = new Set(me?.owned ?? []);
  const bought = new URLSearchParams(window.location.search).get('bought');
  const now = items.filter((p) => !p.later && !p.hidden);
  const later = items.filter((p) => p.later && !p.hidden);
  return (
    <div className="wrap info-page">
      <h1 className="info-title">Shop</h1>
      <p className="info-lead">Every game stays free to play. These are optional extras, each paid for once: no subscriptions, no game currency and no random boxes. Nothing here helps you win.</p>
      {!money.shop && <p className="info-small">Staff preview: the shop is closed to players.</p>}
      {bought && <p className="info-small" role="status">Thank you. Your purchase reaches your account as soon as the payment is confirmed, usually within a minute.</p>}
      <div className="info-cols">
        {now.map((p) => (
          <section key={p.id} className="panel info-block">
            <h2>{p.name}</h2>
            <p>{p.blurb}</p>
            <p>
              <strong>{priceText(p.cents)}</strong> <span className="info-small">VAT included, paid once</span>
            </p>
            {owned.has(p.id) ? (
              <p className="info-small">This is yours.</p>
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
      {buying && <Checkout product={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}

/** The last step before paying: the two statements, each ticked by hand, and the price again. */
function Checkout({ product, onClose }: { product: Product; onClose: () => void }) {
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
    <section className="panel info-block" aria-labelledby="shop-buy">
      <h2 id="shop-buy">
        {product.name}: {priceText(product.cents)}
      </h2>
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
    </section>
  );
}
