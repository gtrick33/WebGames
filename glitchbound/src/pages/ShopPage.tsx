import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BannerArt, FramedAvatar } from '../components/Looks';
import { openSignIn } from '../components/openSignIn';
import { gameUrl } from '../catalog/urls';
import type { LookKind, LookSpec } from '../catalog/looks';
import { AGREE_AGE, AGREE_NOW, priceText, PRODUCTS, type Product } from '../catalog/shop';
import { useLiveCatalog } from '../platform/liveCatalog';
import { api, ApiError, useAccount } from '../platform/account';
import { usePageMeta } from '../platform/meta';
import { useMoney } from '../platform/money';
import { Link } from '../router/router';
import './InfoPages.css';

/** A Sigilfall item's picture, from a file of its own: the site's first load names no extra file for it. */
const SigilPictureLazy = lazy(() => import('../components/SigilPicture').then((m) => ({ default: m.SigilPicture })));
const SigilPicture = (props: Parameters<typeof SigilPictureLazy>[0]) => (
  <Suspense fallback={<div className="sigil-pic" />}>
    <SigilPictureLazy {...props} />
  </Suspense>
);

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
  const card = (p: Product) => (
    <section key={p.id} className="panel info-block">
      {p.look && <LookPreview spec={p.look} name={me?.nickname ?? 'GlitchBound'} src={me?.avatar} />}
      {p.sigil && <SigilPicture id={p.id} spec={p.sigil} />}
      {p.includes && <PackContents ids={p.includes} items={items} name={me?.nickname ?? 'GlitchBound'} src={me?.avatar} />}
      <h2>{p.name}</h2>
      <p>{p.blurb}</p>
      <p>
        <strong>{priceText(p.cents)}</strong> <span className="info-small">VAT included, paid once</span>
      </p>
      {owned.has(p.id) ? (
        <p className="info-small">
          This is yours.
          {p.look && (
            <>
              {' '}
              <Link href="/me#looks">Wear it on your profile</Link>.
            </>
          )}
          {p.sigil && (
            <>
              {' '}
              It&rsquo;s in the Wardrobe of every hero on your account: <Link href={gameUrl('sigilfall')}>open Sigilfall</Link>.
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
  );
  const kinds: { kind: LookKind; title: string }[] = [
    { kind: 'border', title: 'Borders' },
    { kind: 'banner', title: 'Banners' },
    { kind: 'icon', title: 'Profile icons' },
  ];
  const extras = now.filter((p) => !p.look && !p.sigil);
  const sigil = (kind: 'mount' | 'look'): Product[] => now.filter((p) => p.sigil?.kind === kind);
  return (
    <div className="wrap info-page">
      <h1 className="info-title">Shop</h1>
      <p className="info-lead">Every game stays free to play. These are optional extras, each paid for once: no subscriptions, no game currency and no random boxes. Most only change how things look; the Gloamknight Pack unlocks a new class to play in Sigilfall.</p>
      {!money.shop && (
        <p className="info-small" role="status">
          {me?.isAdmin ? 'Admin test: the shop is closed to players, and you can test a purchase here.' : 'The shop isn’t open yet, so nothing can be bought right now.'}
        </p>
      )}
      {bought && <p className="info-small" role="status">Thank you. Your purchase reaches your account as soon as the payment is confirmed, usually within a minute.</p>}
      {extras.length > 0 && <div className="info-cols">{extras.map(card)}</div>}
      {kinds.map(({ kind, title }) => {
        const list = now.filter((p) => p.look?.kind === kind);
        return (
          list.length > 0 && (
            <section key={kind} className="shop-group" aria-labelledby={`shop-${kind}`}>
              <h2 id={`shop-${kind}`} className="profile-h2">
                {title}
              </h2>
              <div className="info-cols">{list.map(card)}</div>
            </section>
          )
        );
      })}
      {sigil('mount').length + sigil('look').length > 0 && (
        <section className="shop-group shop-sigilfall" aria-labelledby="shop-sigilfall">
          <h2 id="shop-sigilfall" className="profile-h2">
            Sigilfall
          </h2>
          <p className="info-small">
            Mounts and Wardrobe looks for every hero on your account. They change how your hero looks and nothing else: every mount runs at the same pace, and your stats always come from what you
            equip.
          </p>
          {sigil('mount').length > 0 && <div className="info-cols">{sigil('mount').map(card)}</div>}
          {sigil('look').length > 0 && <div className="info-cols">{sigil('look').map(card)}</div>}
        </section>
      )}
      <div className="info-cols">
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

/** What a pack gives, each thing as it looks: its own pieces are made for it and not sold on their own. */
function PackContents({ ids, items, name, src }: { ids: string[]; items: readonly Product[]; name: string; src?: string }) {
  const parts = ids.map((id) => items.find((p) => p.id === id)).filter((p): p is Product => !!p);
  return (
    <ul className="shop-pack" aria-label="In the pack">
      <li className="shop-pack-class">
        <strong>The Gloamknight</strong>
        <span className="info-small">Sigilfall&rsquo;s eighth class, and two more hero slots</span>
      </li>
      {parts.map((p) => (
        <li key={p.id} className={p.sigil?.kind === 'mount' ? 'is-wide' : undefined}>
          {p.sigil && <SigilPicture id={p.id} spec={p.sigil} size={240} />}
          {p.look?.kind === 'banner' && <BannerArt spec={p.look} className="shop-pack-banner" />}
          {p.look && p.look.kind !== 'banner' && <FramedAvatar name={name} src={src} size={64} border={p.look.kind === 'border' ? p.look : undefined} icon={p.look.kind === 'icon' ? p.look : undefined} />}
          <span className="info-small">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}

/** What a look is like before buying it: a border on your own picture, an icon as your picture, or the banner itself. */
function LookPreview({ spec, name, src }: { spec: LookSpec; name: string; src?: string }) {
  if (spec.kind === 'banner') {
    return (
      <div className="shop-look shop-look-banner">
        <BannerArt spec={spec} className="shop-look-art" />
      </div>
    );
  }
  return (
    <div className="shop-look shop-look-border">
      <FramedAvatar name={name} src={src} size={104} border={spec.kind === 'border' ? spec : undefined} icon={spec.kind === 'icon' ? spec : undefined} />
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
