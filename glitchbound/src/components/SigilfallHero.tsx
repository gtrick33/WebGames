import type { CSSProperties } from 'react';
import { useT } from '../i18n';
import { SECTION_GAMES } from '../catalog/catalog';
import { useLiveCatalog } from '../platform/liveCatalog';
import { Link } from '../router/router';
import { Icon } from './Icon';
import './SigilfallHero.css';

/** What the game holds, counted from its data. */
const FACTS = ['7 heroes', '5 acts', '12 dungeons', 'Co-op for 4'];
const EMBERS = Array.from({ length: 9 }, (_, i) => ({ '--x': `${8 + ((i * 41) % 86)}%`, '--d': `${(i % 5) * 1.7}s`, '--t': `${9 + (i % 4) * 2.5}s` }) as CSSProperties);

/** Sigilfall, unless an admin has hidden it. */
export function useSigilfall() {
  const live = useLiveCatalog();
  const game = SECTION_GAMES.find((g) => g.slug === 'sigilfall');
  return game && !live.settings(game.slug).hidden ? game : undefined;
}

/**
 * The first thing on the site: the night outside Sigilfall's title screen, its name in gold and a real
 * moment of play. The look comes from the composition (the ranges, the castle, the framed picture), never
 * from light laid over the screen. The last range is painted in the page's own background, so the
 * world runs into the arcade below it, in the day theme as in the night one.
 */
export function SigilfallHero() {
  const t = useT();
  const game = useSigilfall();
  if (!game) return null;
  return (
    <section className="sfh" aria-labelledby="sfh-title">
      <div className="sfh-sky" aria-hidden="true">
        <i className="sfh-stars" />
        <i className="sfh-moon" />
        <svg className="sfh-land" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
          <path className="sfh-range-3" d="M0 250 L90 190 L170 230 L260 160 L340 215 L430 150 L520 210 L600 170 L690 225 L780 140 L870 205 L935 168 L950 158 L1066 158 L1130 186 L1200 200 L1200 400 L0 400 Z" />
          <path className="sfh-range-2" d="M0 300 L120 230 L210 280 L330 215 L440 285 L560 240 L650 290 L760 245 L880 300 L990 235 L1100 285 L1200 250 L1200 400 L0 400 Z" />
          <g className="sfh-castle" transform="translate(30 152)">
            <path d="M800 160 L812 150 L812 98 L806 98 L806 86 L830 86 L830 98 L824 98 L824 150 L846 150 L846 112 L840 112 L840 100 L866 100 L866 112 L860 112 L860 150 L882 150 L882 92 L876 92 L876 78 L889 64 L902 78 L902 92 L896 92 L896 150 L912 160 Z" />
            <path className="sfh-banner" d="M889 64 L889 44 L904 50 L889 56" />
            <rect className="sfh-window" x="886" y="104" width="6" height="10" />
            <rect className="sfh-window" x="850" y="122" width="5" height="8" />
            <rect className="sfh-window" x="815" y="112" width="5" height="8" />
          </g>
          <path className="sfh-range-1" d="M0 350 L150 300 L260 340 L380 290 L520 345 L640 310 L760 350 L900 300 L1030 345 L1200 305 L1200 400 L0 400 Z" />
          <path className="sfh-range-0" d="M0 384 L180 356 L360 380 L560 360 L760 384 L980 358 L1200 378 L1200 400 L0 400 Z" />
        </svg>
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
          <p className="sfh-sub">{t('A whole fantasy RPG that plays right in your browser. Choose your hero, gather your gear and close the Rift, alone or with friends.')}</p>
          <div className="sfh-actions">
            <Link href={`${game.section!.path}?play=1`} className="sfh-cta">
              {t('Enter the Rift')} <Icon name="arrowRight" size={20} />
            </Link>
            <a href="#quick-games" className="sfh-quiet">
              {t('Or play a quick game')}
            </a>
          </div>
          <ul className="sfh-facts">
            {FACTS.map((f) => (
              <li key={f}>{t(f)}</li>
            ))}
          </ul>
        </div>

        <figure className="sfh-shot">
          <img src="/games/sigilfall/hero-shot.webp" alt={t('A hero with sword and shield on a castle forecourt at night, between braziers and red banners')} width={980} height={612} decoding="sync" fetchPriority="high" />
          <figcaption>{t('Real gameplay, on a phone or a computer')}</figcaption>
        </figure>
      </div>
    </section>
  );
}
