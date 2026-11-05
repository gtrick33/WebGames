import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BannerArt, FramedAvatar } from '../components/Looks';
import { openSignIn } from '../components/openSignIn';
import { gameUrl } from '../catalog/urls';
import type { LookKind, LookSpec } from '../catalog/looks';
import { AGREE_AGE, AGREE_AGE_BG, AGREE_NOW, AGREE_NOW_BG, offered, priceText, priceTextBg, PRODUCTS, type Product } from '../catalog/shop';
import { itemBg } from '../catalog/shopBg';
import { useLang } from '../i18n';
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

/** The shop's words, in English and in Bulgarian (the shop, its terms and the checkout are the parts sold in both). */
const WORDS = {
  en: {
    title: 'Shop',
    meta: 'Optional one-time extras for GlitchBound. Every game stays free to play.',
    lead: 'Every game stays free to play. These are optional extras, each paid for once: no subscriptions, no game currency and no random boxes. Most only change how things look; the Gloamknight Pack unlocks a new class to play in Sigilfall.',
    adminTest: 'Admin test: the shop is closed to players, and you can test a purchase here.',
    closed: 'The shop isn’t open yet, so nothing can be bought right now.',
    thanks: 'Thank you. Your purchase reaches your account as soon as the payment is confirmed, usually within a minute.',
    vat: 'VAT included, paid once',
    yours: 'This is yours.',
    wear: 'Wear it on your profile',
    inWardrobe: 'It’s in the Wardrobe of every hero on your account:',
    openSigilfall: 'open Sigilfall',
    notYet: 'Not on sale yet.',
    get: (name: string) => `Get ${name}`,
    signInFirst: 'Sign in first',
    signInWhy: 'Sign in so a purchase stays with your account.',
    kinds: { border: 'Borders', banner: 'Banners', icon: 'Profile icons' } as Record<LookKind, string>,
    sigilNote: 'Mounts and Wardrobe looks for every hero on your account. They change how your hero looks and nothing else: every mount runs at the same pace, and your stats always come from what you equip.',
    planned: 'Planned',
    termsBefore: 'See the ',
    termsLink: 'terms of sale',
    termsAfter: ' for your rights, refunds and who you are buying from.',
    inPack: 'In the pack',
    packClass: 'The Gloamknight',
    packClassWhat: 'Sigilfall’s eighth class, and two more hero slots',
    checkoutNote: 'VAT included. One payment, no subscription. Our payment provider, Stripe, takes the payment and sends your receipt.',
    already: 'This is already yours.',
    failed: 'The checkout could not open. Nothing was charged. Please try again.',
    pay: 'Continue to payment',
    cancel: 'Cancel',
    agreeNow: AGREE_NOW,
    agreeAge: AGREE_AGE,
  },
  bg: {
    title: 'Магазин',
    meta: 'Незадължителни еднократни покупки в GlitchBound. Всички игри остават безплатни.',
    lead: 'Всички игри остават безплатни. Това са незадължителни екстри, всяка платена веднъж: без абонаменти, без игрова валута и без случайни кутии. Повечето променят само как изглеждат нещата, а пакетът Gloamknight отключва нов клас в Sigilfall.',
    adminTest: 'Тест от администратор: магазинът е затворен за играчите, а ти можеш да тестваш покупка тук.',
    closed: 'Магазинът още не е отворен, затова в момента нищо не може да се купи.',
    thanks: 'Благодарим! Покупката ти стига до акаунта ти веднага щом плащането бъде потвърдено, обикновено до минута.',
    vat: 'с ДДС, плаща се веднъж',
    yours: 'Това е твое.',
    wear: 'Сложи го в профила си',
    inWardrobe: 'Намира се в Гардероба (Wardrobe) на всеки герой в акаунта ти:',
    openSigilfall: 'отвори Sigilfall',
    notYet: 'Още не се продава.',
    get: (name: string) => `Вземи ${name}`,
    signInFirst: 'Първо влез',
    signInWhy: 'Влез, за да остане покупката в акаунта ти.',
    kinds: { border: 'Рамки', banner: 'Банери', icon: 'Икони за профила' } as Record<LookKind, string>,
    sigilNote: 'Ездитни животни и облекла от Гардероба за всеки герой в акаунта ти. Те променят само как изглежда героят ти: всяко ездитно животно се движи с едно и също темпо, а показателите ти винаги идват от това, което екипираш.',
    planned: 'Предстоящи',
    termsBefore: 'Виж ',
    termsLink: 'условията за продажба',
    termsAfter: ' за правата си, връщането на пари и от кого купуваш.',
    inPack: 'В пакета',
    packClass: 'Gloamknight',
    packClassWhat: 'Осмият клас в Sigilfall и още две места за герои',
    checkoutNote: 'С ДДС. Едно плащане, без абонамент. Плащането се приема от нашия доставчик на плащания Stripe, който ти изпраща и разписката.',
    already: 'Това вече е твое.',
    failed: 'Плащането не можа да се отвори. Нищо не е таксувано. Опитай отново.',
    pay: 'Към плащането',
    cancel: 'Отказ',
    agreeNow: AGREE_NOW_BG,
    agreeAge: AGREE_AGE_BG,
  },
};
type Words = (typeof WORDS)['en'];

/**
 * The shop: one-time purchases, in plain words. No countdowns, no "last chance", no pressure, and the full price up
 * front (src/catalog/shop.ts has the rules). Until the shop is opened in Admin › Ads & shop it has no tab and nothing can
 * be bought, but the page can be read by its address, hidden from search: Stripe's reviewers must be able to see what is
 * sold and at what price, without a password. An admin can test a purchase here while it's closed.
 * In English, and in Bulgarian for a reader who chose it (with the terms of sale, the terms and privacy); other languages
 * read the English.
 */
export function ShopPage() {
  const bg = useLang() === 'bg';
  const w: Words = bg ? WORDS.bg : WORDS.en;
  const price = bg ? priceTextBg : priceText;
  usePageMeta({ title: w.title, description: w.meta, path: '/shop' });
  const money = useMoney();
  const items = useLiveCatalog().raw.shopItems ?? PRODUCTS;
  const { me } = useAccount();
  const [buying, setBuying] = useState<Product | null>(null);
  const canBuy = money.shop || !!me?.isAdmin;
  const owned = new Set(me?.owned ?? []);
  const bought = new URLSearchParams(window.location.search).get('bought');
  const now = items.filter((p) => !p.later && offered(p, money));
  const later = items.filter((p) => p.later && offered(p, money));
  const text = (p: Product): { name: string; blurb: string } => (bg ? itemBg(p) : p);
  const card = (p: Product) => (
    <section key={p.id} className="panel info-block">
      {p.look && <LookPreview spec={p.look} name={me?.nickname ?? 'GlitchBound'} src={me?.avatar} />}
      {p.sigil && <SigilPicture id={p.id} spec={p.sigil} />}
      {p.includes && <PackContents ids={p.includes} items={items} name={me?.nickname ?? 'GlitchBound'} src={me?.avatar} w={w} text={text} />}
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
              <Link href="/me#looks">{w.wear}</Link>.
            </>
          )}
          {p.sigil && (
            <>
              {' '}
              {w.inWardrobe} <Link href={gameUrl('sigilfall')}>{w.openSigilfall}</Link>.
            </>
          )}
        </p>
      ) : !canBuy ? (
        <p className="info-small">{w.notYet}</p>
      ) : me && buying?.id === p.id ? (
        <Checkout product={p} name={text(p).name} price={price(p.cents)} bg={bg} w={w} onClose={() => setBuying(null)} />
      ) : me ? (
        <button className="btn btn-primary" onClick={() => setBuying(p)}>
          {w.get(text(p).name)}
        </button>
      ) : (
        <button className="btn" onClick={() => openSignIn(w.signInWhy)}>
          {w.signInFirst}
        </button>
      )}
    </section>
  );
  const kinds: LookKind[] = ['border', 'banner', 'icon'];
  const extras = now.filter((p) => !p.look && !p.sigil);
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
      {sigil('mount').length + sigil('look').length > 0 && (
        <section className="shop-group shop-sigilfall" aria-labelledby="shop-sigilfall">
          <h2 id="shop-sigilfall" className="profile-h2">
            Sigilfall
          </h2>
          <p className="info-small">{w.sigilNote}</p>
          {sigil('mount').length > 0 && <div className="info-cols">{sigil('mount').map(card)}</div>}
          {sigil('look').length > 0 && <div className="info-cols">{sigil('look').map(card)}</div>}
        </section>
      )}
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
      <p className="info-small">
        {w.termsBefore}
        <Link href="/terms/sale">{w.termsLink}</Link>
        {w.termsAfter}
      </p>
    </div>
  );
}

/** What a pack gives, each thing as it looks: its own pieces are made for it and not sold on their own. */
function PackContents({ ids, items, name, src, w, text }: { ids: string[]; items: readonly Product[]; name: string; src?: string; w: Words; text: (p: Product) => { name: string } }) {
  const parts = ids.map((id) => items.find((p) => p.id === id)).filter((p): p is Product => !!p);
  return (
    <ul className="shop-pack" aria-label={w.inPack}>
      <li className="shop-pack-class">
        <strong>{w.packClass}</strong>
        <span className="info-small">{w.packClassWhat}</span>
      </li>
      {parts.map((p) => (
        <li key={p.id} className={p.sigil?.kind === 'mount' ? 'is-wide' : undefined}>
          {p.sigil && <SigilPicture id={p.id} spec={p.sigil} size={240} />}
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

/**
 * The last step before paying: the two statements, each ticked by hand, and the price again. It opens inside the item's
 * own panel, scrolled into view with the focus on it, so it shows up where the button was pressed. The statements are in
 * the language the buyer reads, and the purchase records which (the confirmation email repeats them in it).
 */
function Checkout({ product, name, price, bg, w, onClose }: { product: Product; name: string; price: string; bg: boolean; w: Words; onClose: () => void }) {
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
    api<{ url: string }>('/api/shop/checkout', { body: { product: product.id, agreeNow: now, agreeAge: age, lang: bg ? 'bg' : 'en' } })
      .then((r) => window.location.assign(r.url))
      .catch((e: unknown) => {
        setBusy(false);
        setError(e instanceof ApiError && e.code === 'already_yours' ? w.already : w.failed);
      });
  };
  return (
    <div className="shop-checkout" role="group" aria-labelledby={`shop-buy-${product.id}`}>
      <h3 id={`shop-buy-${product.id}`} ref={title} tabIndex={-1}>
        {name}: {price}
      </h3>
      <p className="info-small">{w.checkoutNote}</p>
      <label className="info-small">
        <input type="checkbox" checked={now} onChange={(e) => setNow(e.target.checked)} /> {w.agreeNow}
      </label>
      <label className="info-small">
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /> {w.agreeAge}
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="reset-row">
        <button className="btn btn-primary" disabled={!now || !age || busy} onClick={go}>
          {w.pay}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          {w.cancel}
        </button>
      </div>
    </div>
  );
}
