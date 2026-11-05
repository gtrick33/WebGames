import { useRef, type CSSProperties } from 'react';
import { useT } from '../i18n';
import { SECTION_GAMES } from '../catalog/catalog';
import { useAccount } from '../platform/account';
import { useLiveCatalog } from '../platform/liveCatalog';
import { useMoney } from '../platform/money';
import { Link } from '../router/router';
import { Icon } from './Icon';
import './SigilfallHero.css';

/** What the game holds, counted from its data. */
const FACTS = ['8 heroes', '5 acts', '12 dungeons', 'Co-op for 4'];
const EMBERS = Array.from({ length: 10 }, (_, i) => ({ '--x': `${40 + ((i * 37) % 58)}%`, '--d': `${(i % 7) * 1.3}s`, '--t': `${7 + (i % 5) * 2}s` }) as CSSProperties);
/** A tall screen gets the picture composed for it; the words go under it there (SigilfallHero.css, seo.ts). */
const TALL = '(max-width: 760px), (max-aspect-ratio: 13/10)';

/** The banner's words unless an admin has changed them (Admin › Home page). */
export const BANNER_DEFAULTS = {
  kicker: 'Free fantasy RPG in your browser',
  hook: 'The bell stopped ringing three weeks ago. Tonight, they come for what sleeps under the chapel.',
  cta: 'Play free',
} as const;

/** Sigilfall, unless an admin has hidden it. */
export function useSigilfall() {
  const live = useLiveCatalog();
  const game = SECTION_GAMES.find((g) => g.slug === 'sigilfall');
  return game && !live.settings(game.slug).hidden ? game : undefined;
}

/**
 * The first thing on the site: a banner of Sigilfall's key art (the Wardens' Sanctum at night, all seven heroes in their
 * sigil armor and two Sigil Drakes, composed from the game's own 3D), its name in gold and one button. A cue on its
 * bottom edge says there's more below. The Gloamknight, the class sold in the shop, stands in front of it: with the shop
 * open he and his tag are a link to the Gloamknight Pack, before that to the game.
 */
export function SigilfallHero() {
  const t = useT();
  const game = useSigilfall();
  const words = useLiveCatalog().raw.banner;
  const banner = useRef<HTMLElement>(null);
  // the Gloamknight stands in front of the picture; once the shop is open (or for an admin) he leads to his pack
  const money = useMoney();
  const { me } = useAccount();
  const pack = money.shop || !!me?.isAdmin;
  if (!game) return null;
  const showMore = (): void => {
    const bottom = banner.current?.getBoundingClientRect().bottom ?? 400;
    const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
    window.scrollBy({ top: bottom - header, behavior: 'smooth' });
  };
  return (
    <>
    <section className="sfh" ref={banner} aria-labelledby="sfh-title">
      <div className="sfh-art" aria-hidden="true">
        <picture>
          <source media={TALL} type="image/avif" srcSet="/games/sigilfall/key-art-phone.avif" />
          <source media={TALL} type="image/webp" srcSet="/games/sigilfall/key-art-phone.webp" />
          <source type="image/avif" srcSet="/games/sigilfall/key-art-1600.avif 1600w, /games/sigilfall/key-art-2400.avif 2400w" sizes="100vw" />
          <img src="/games/sigilfall/key-art-1600.webp" srcSet="/games/sigilfall/key-art-1600.webp 1600w, /games/sigilfall/key-art-2400.webp 2400w" sizes="100vw" alt="" width={1600} height={660} decoding="sync" fetchPriority="high" />
        </picture>
        {EMBERS.map((style, i) => (
          <i key={i} className="sfh-ember" style={style} />
        ))}
      </div>
      <Link href={pack ? '/shop' : `${game.section!.path}?play=1`} className="sfh-gk" aria-label={pack ? `${t('New class')}: ${t('Gloamknight Pack')}` : 'Sigilfall'}>
        <img src="/games/sigilfall/gloamknight.webp" alt="" width={415} height={560} decoding="async" />
        {pack && (
          <span className="sfh-gk-tag">
            <b>{t('New class')}</b>
            <span>
              {t('Gloamknight Pack')} <Icon name="arrowRight" size={14} />
            </span>
          </span>
        )}
      </Link>

      <div className="sfh-inner">
        <div className="sfh-copy">
          <p className="sfh-kicker">{words?.kicker || t(BANNER_DEFAULTS.kicker)}</p>
          <h1 id="sfh-title" className="sfh-title">
            <img src="/games/sigilfall/logo.svg" alt="Sigilfall" width={673} height={168} decoding="sync" />
          </h1>
          <p className="sfh-hook">{words?.hook || t(BANNER_DEFAULTS.hook)}</p>
          <div className="sfh-actions">
            <Link href={`${game.section!.path}?play=1`} className="sfh-cta">
              {words?.cta || t(BANNER_DEFAULTS.cta)} <Icon name="arrowRight" size={20} />
            </Link>
            <span className="sfh-note">{t('No download. No sign-up.')}</span>
          </div>
          <ul className="sfh-facts">
            {FACTS.map((f) => (
              <li key={f}>{t(f)}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
    <button type="button" className="sfh-more" onClick={showMore}>
      {t('More games below')} <Icon name="chevronDown" size={18} />
    </button>
    </>
  );
}
