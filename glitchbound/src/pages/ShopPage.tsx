import { lazy, Suspense, useState } from 'react';
import { BannerArt, FramedAvatar } from '../components/Looks';
import { Checkout, itemText } from '../components/ShopCheckout';
import { openSignIn } from '../components/openSignIn';
import { gameUrl } from '../catalog/urls';
import type { LookKind, LookSpec } from '../catalog/looks';
import { GLOAMKNIGHT_ITEM, offered, PRODUCTS, type Product } from '../catalog/shop';
import { fill, priceIn, rich, useShopText } from '../i18n/shopText';
import type { ShopText } from '../i18n/shopTypes';
import { useLiveCatalog } from '../platform/liveCatalog';
import { useAccount } from '../platform/account';
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
const SigilInspect = lazy(() => import('../components/SigilInspect').then((m) => ({ default: m.SigilInspect })));

/** A Sigilfall item's picture that opens it turning on a stand. */
function Inspectable({ product, label, onLook, size }: { product: Product; label: string; onLook: (p: Product) => void; size?: number }) {
  if (!product.sigil) return null;
  return (
    <button type="button" className="sigil-look" onClick={() => onLook(product)} aria-label={label} title={label}>
      <SigilPicture id={product.id} spec={product.sigil} size={size} />
    </button>
  );
}

/**
 * The shop: one-time purchases, in plain words. No countdowns, no "last chance", no pressure, and the full price up
 * front (src/catalog/shop.ts has the rules). Until the shop is opened in Admin › Ads & shop it has no tab and nothing can
 * be bought, but the page can be read by its address, hidden from search: Stripe's reviewers must be able to see what is
 * sold and at what price, without a password. An admin can test a purchase here while it's closed.
 * In the reader's language: its words, and the built-in items', come from src/i18n/shop/<code>.ts.
 */
export function ShopPage() {
  const { lang, words } = useShopText();
  return words ? <Shop lang={lang} t={words} /> : null;
}

type W = ShopText['shop'];

function Shop({ lang, t }: { lang: Parameters<typeof priceIn>[0]; t: ShopText }) {
  const w = t.shop;
  const price = (cents: number): string => priceIn(lang, cents);
  usePageMeta({ title: w.title, description: w.meta, path: '/shop' });
  const money = useMoney();
  const items = useLiveCatalog().raw.shopItems ?? PRODUCTS;
  const { me } = useAccount();
  const [buying, setBuying] = useState<Product | null>(null);
  const [looking, setLooking] = useState<Product | null>(null);
  const canBuy = money.shop || !!me?.isAdmin;
  const owned = new Set(me?.owned ?? []);
  const bought = new URLSearchParams(window.location.search).get('bought');
  const now = items.filter((p) => !p.later && offered(p, money));
  const later = items.filter((p) => p.later && offered(p, money));
  const text = (p: Product): { name: string; blurb: string } => itemText(t, p);
  const card = (p: Product) => (
    <section key={p.id} className="panel info-block">
      {p.look && <LookPreview spec={p.look} name={me?.nickname ?? 'GlitchBound'} src={me?.avatar} />}
      {p.sigil && <Inspectable product={p} label={fill(w.inspect, { name: text(p).name })} onLook={setLooking} />}
      {p.includes && <PackContents ids={p.includes} items={items} name={me?.nickname ?? 'GlitchBound'} src={me?.avatar} w={w} text={text} onLook={setLooking} />}
      <h2>{text(p).name}</h2>
      <p>{text(p).blurb}</p>
      <p>
        <strong>{price(p.cents)}</strong> <span className="info-small">{w.vat}</span>
      </p>
      {owned.has(p.id) ? (
        <p className="info-small">
          {w.yours}
          {p.look && (
            <>
              {' '}
              {rich(w.wear, { wear: (x) => <Link href="/me#looks">{x}</Link> })}
            </>
          )}
          {p.sigil && (
            <>
              {' '}
              {rich(w.inWardrobe, { open: (x) => <Link href={gameUrl('sigilfall')}>{x}</Link> })}
            </>
          )}
        </p>
      ) : !canBuy ? (
        <p className="info-small">{w.notYet}</p>
      ) : me && buying?.id === p.id ? (
        <Checkout product={p} name={text(p).name} price={price(p.cents)} lang={lang} w={w} onClose={() => setBuying(null)} />
      ) : me ? (
        <button className="btn btn-primary" onClick={() => setBuying(p)}>
          {fill(w.get, { name: text(p).name })}
        </button>
      ) : (
        <button className="btn" onClick={() => openSignIn(w.signInWhy)}>
          {w.signInFirst}
        </button>
      )}
    </section>
  );
  const kinds: LookKind[] = ['border', 'banner', 'icon'];
  // (the Gloamknight Pack is Sigilfall's: it heads the game's own group, not the page)
  const pack = now.filter((p) => p.id === GLOAMKNIGHT_ITEM);
  const extras = now.filter((p) => !p.look && !p.sigil && p.id !== GLOAMKNIGHT_ITEM);
  const sigil = (kind: 'mount' | 'look'): Product[] => now.filter((p) => p.sigil?.kind === kind);
  return (
    <div className="wrap info-page">
      <h1 className="info-title">{w.title}</h1>
      <p className="info-lead">{w.lead}</p>
      {!money.shop && (
        <p className="info-small" role="status">
          {me?.isAdmin ? w.adminTest : w.closed}
        </p>
      )}
      {bought && (
        <p className="info-small" role="status">
          {w.thanks}
        </p>
      )}
      {extras.length > 0 && <div className="info-cols">{extras.map(card)}</div>}
      {pack.length + sigil('mount').length + sigil('look').length > 0 && (
        <section className="shop-group shop-sigilfall" aria-labelledby="shop-sigilfall">
          <h2 id="shop-sigilfall" className="profile-h2">
            Sigilfall
          </h2>
          <p className="info-small">{w.sigilNote}</p>
          {pack.length > 0 && <div className="info-cols">{pack.map(card)}</div>}
          {sigil('mount').length > 0 && <div className="info-cols">{sigil('mount').map(card)}</div>}
          {sigil('look').length > 0 && <div className="info-cols">{sigil('look').map(card)}</div>}
        </section>
      )}
      {kinds.map((kind) => {
        const list = now.filter((p) => p.look?.kind === kind);
        return (
          list.length > 0 && (
            <section key={kind} className="shop-group" aria-labelledby={`shop-${kind}`}>
              <h2 id={`shop-${kind}`} className="profile-h2">
                {w.kinds[kind]}
              </h2>
              <div className="info-cols">{list.map(card)}</div>
            </section>
          )
        );
      })}
      <div className="info-cols">
        {later.length > 0 && (
          <section className="panel info-block">
            <h2>{w.planned}</h2>
            <ul>
              {later.map((p) => (
                <li key={p.id}>
                  <strong>{text(p).name}:</strong> {text(p).blurb}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="info-small">{rich(w.terms, { terms: (x) => <Link href="/terms/sale">{x}</Link> })}</p>
      {looking?.sigil && (
        <Suspense fallback={null}>
          <SigilInspect spec={looking.sigil} name={text(looking).name} hint={w.turnHint} close={w.close} onClose={() => setLooking(null)} />
        </Suspense>
      )}
    </div>
  );
}

/** What a pack gives, each thing as it looks: its own pieces are made for it and not sold on their own. */
function PackContents({ ids, items, name, src, w, text, onLook }: { ids: string[]; items: readonly Product[]; name: string; src?: string; w: W; text: (p: Product) => { name: string }; onLook: (p: Product) => void }) {
  const parts = ids.map((id) => items.find((p) => p.id === id)).filter((p): p is Product => !!p);
  return (
    <ul className="shop-pack" aria-label={w.inPack}>
      <li className="shop-pack-class">
        <strong>{w.packClass}</strong>
        <span className="info-small">{w.packClassWhat}</span>
      </li>
      {parts.map((p) => (
        <li key={p.id} className={p.sigil?.kind === 'mount' ? 'is-wide' : undefined}>
          {p.sigil && <Inspectable product={p} label={fill(w.inspect, { name: text(p).name })} onLook={onLook} size={240} />}
          {p.look?.kind === 'banner' && <BannerArt spec={p.look} className="shop-pack-banner" />}
          {p.look && p.look.kind !== 'banner' && <FramedAvatar name={name} src={src} size={64} border={p.look.kind === 'border' ? p.look : undefined} icon={p.look.kind === 'icon' ? p.look : undefined} />}
          <span className="info-small">{text(p).name}</span>
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
