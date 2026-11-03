import { useRef, type CSSProperties } from 'react';
import { useT } from '../i18n';
import { SECTION_GAMES } from '../catalog/catalog';
import { useLiveCatalog } from '../platform/liveCatalog';
import { Link } from '../router/router';
import { Icon } from './Icon';
import './SigilfallHero.css';

/** What the game holds, counted from its data. */
const FACTS = ['7 heroes', '5 acts', '12 dungeons', 'Co-op for 4'];
const EMBERS = Array.from({ length: 16 }, (_, i) => ({ '--x': `${38 + ((i * 37) % 60)}%`, '--d': `${(i % 7) * 1.3}s`, '--t': `${7 + (i % 5) * 2}s` }) as CSSProperties);

/** Sigilfall, unless an admin has hidden it. */
export function useSigilfall() {
  const live = useLiveCatalog();
  const game = SECTION_GAMES.find((g) => g.slug === 'sigilfall');
  return game && !live.settings(game.slug).hidden ? game : undefined;
}

/**
 * The first thing on the site: a banner of Sigilfall's key art (the Wardens' Sanctum, its heroes in their sigil armor
 * and a Sigil Drake, composed from the game's own art), its name in gold and one button. It's kept short so the arcade
 * shows on the first screen too, and a cue on its bottom edge says there's more below.
 */
export function SigilfallHero() {
  const t = useT();
  const game = useSigilfall();
  const banner = useRef<HTMLElement>(null);
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
          <source media="(max-width: 700px)" srcSet="/games/sigilfall/key-art-960.webp" />
          <img src="/games/sigilfall/key-art.webp" alt="" width={1920} height={1000} decoding="sync" fetchPriority="high" />
        </picture>
        <i className="sfh-beam" />
        {EMBERS.map((style, i) => (
          <i key={i} className="sfh-ember" style={style} />
        ))}
      </div>

      <div className="wrap sfh-inner">
        <div className="sfh-copy">
          <p className="sfh-kicker">{t('A GlitchBound adventure')}</p>
          <h1 id="sfh-title" className="sfh-title">
            Sigilfall
          </h1>
          <p className="sfh-hook">{t('The bell stopped ringing three weeks ago. Tonight, they come for what sleeps under the chapel.')}</p>
          <div className="sfh-actions">
            <Link href={`${game.section!.path}?play=1`} className="sfh-cta">
              {t('Enter the Rift')} <Icon name="arrowRight" size={20} />
            </Link>
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
