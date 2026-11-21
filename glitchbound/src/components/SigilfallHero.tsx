import type { CSSProperties } from 'react';
import { useT } from '../i18n';
import { SECTION_GAMES } from '../catalog/catalog';
import { useLiveCatalog } from '../platform/liveCatalog';
import { Link } from '../router/router';
import { Icon } from './Icon';
import './SigilfallHero.css';

/** What the game holds, counted from its data. */
const FACTS = ['8 heroes', '5 acts', '12 dungeons', 'Co-op for 4'];
const EMBERS = Array.from({ length: 8 }, (_, i) => ({ '--x': `${8 + ((i * 37) % 84)}%`, '--d': `${(i % 7) * 1.1}s`, '--t': `${6 + (i % 5) * 1.6}s` }) as CSSProperties);
/** How wide the card's picture is drawn (the card is at most 940 wide: SigilfallHero.css), for the browser's pick. */
export const SIZES = '(max-width: 980px) 100vw, 940px';
/**
 * The arcade's own toys drifting round the card (the site's shapes: a ring, a pill, a triangle, a star, a ball, a
 * plus), each with its place, size, color, how long it takes to bob and turn, and when it starts.
 */
const TOYS: { k: 'ring' | 'pill' | 'tri' | 'star' | 'ball' | 'plus' | 'spark'; x: string; y: string; s: number; c: string; t: number; d: number; r: number }[] = [
  { k: 'ring', x: '6%', y: '18%', s: 46, c: 'var(--teal)', t: 7, d: 0, r: -20 },
  { k: 'pill', x: '12%', y: '72%', s: 70, c: 'var(--yellow)', t: 9, d: -2, r: -24 },
  { k: 'tri', x: '89%', y: '14%', s: 54, c: 'var(--lime)', t: 8, d: -1, r: 18 },
  { k: 'star', x: '92%', y: '70%', s: 62, c: 'var(--orange)', t: 10, d: -3, r: 0 },
  { k: 'ball', x: '82%', y: '88%', s: 34, c: 'var(--coral)', t: 6, d: -4, r: 0 },
  { k: 'plus', x: '3%', y: '48%', s: 30, c: 'var(--magenta)', t: 8, d: -5, r: 12 },
  { k: 'ball', x: '20%', y: '10%', s: 20, c: 'var(--violet)', t: 7, d: -1.5, r: 0 },
  { k: 'plus', x: '96%', y: '40%', s: 24, c: 'var(--cyan)', t: 9, d: -6, r: -10 },
  { k: 'spark', x: '24%', y: '86%', s: 18, c: 'var(--yellow)', t: 3.2, d: -0.4, r: 0 },
  { k: 'spark', x: '76%', y: '6%', s: 22, c: 'var(--yellow)', t: 3.8, d: -1.8, r: 0 },
  { k: 'spark', x: '70%', y: '94%', s: 14, c: 'var(--cyan)', t: 2.9, d: -2.6, r: 0 },
];

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
 * The first thing on the site: Sigilfall as the arcade's star, on a card, not across the whole page (the owner,
 * 2026-11-21: "the banner in the main page should be smaller, glitchbound's arcade idea is to be a small indie
 * single/multiplayer fun games, sigilfall should be the extra amazing game that there is, make sure the arcade has
 * astonishing graphics around sigilfall's banner, however, make the actual banner better and way smaller/narrower").
 * The card: its key art (the Wardens' Sanctum at night, all eight heroes and two Sigil Drakes, rendered from the game's
 * own 3D: scripts/sigilfall-key-art.mjs), a ribbon calling it the arcade's original, its name in gold, a line and one
 * button, in a gold rim that catches the light now and then. Round it, the arcade's stage: a halo of light turning
 * slowly behind the card and the site's own toys drifting about it, so it reads as the prize of the arcade rather than
 * a site of its own. The banner sells nothing (the owner had the Gloamknight's pack tag taken off, 2026-11-12).
 */
export function SigilfallHero() {
  const t = useT();
  const game = useSigilfall();
  const words = useLiveCatalog().raw.banner;
  if (!game) return null;
  const href = `${game.section!.path}?play=1`;
  return (
    <section className="sfh" aria-labelledby="sfh-title">
      <div className="sfh-stage" aria-hidden="true">
        <i className="sfh-halo" />
        <i className="sfh-rays" />
        {TOYS.map((y, i) => (
          <i key={i} className={`sfh-toy is-${y.k}`} style={{ '--x': y.x, '--y': y.y, '--s': `${y.s}px`, '--c': y.c, '--t': `${y.t}s`, '--d': `${y.d}s`, '--r': `${y.r}deg` } as CSSProperties} />
        ))}
      </div>
      <div className="sfh-card">
        <Link href={href} className="sfh-art" tabIndex={-1} aria-hidden="true">
          <picture>
            <source type="image/avif" srcSet="/games/sigilfall/key-art-1600.avif 1600w, /games/sigilfall/key-art-2400.avif 2400w" sizes={SIZES} />
            <img src="/games/sigilfall/key-art-1600.webp" srcSet="/games/sigilfall/key-art-1600.webp 1600w, /games/sigilfall/key-art-2400.webp 2400w" sizes={SIZES} alt="" width={1600} height={660} decoding="sync" fetchPriority="high" />
          </picture>
          {EMBERS.map((style, i) => (
            <i key={i} className="sfh-ember" style={style} />
          ))}
        </Link>
        {/* (the studio's name and a word: kept in English, as the name is) */}
        <span className="sfh-ribbon">GlitchBound original</span>
        <div className="sfh-copy">
          <p className="sfh-kicker">{words?.kicker || t(BANNER_DEFAULTS.kicker)}</p>
          <h1 id="sfh-title" className="sfh-title">
            <img src="/games/sigilfall/logo.svg" alt="Sigilfall" width={673} height={168} decoding="sync" />
          </h1>
          <p className="sfh-hook">{words?.hook || t(BANNER_DEFAULTS.hook)}</p>
          <div className="sfh-actions">
            <Link href={href} className="sfh-cta">
              {words?.cta || t(BANNER_DEFAULTS.cta)} <Icon name="arrowRight" size={18} />
            </Link>
            <ul className="sfh-facts">
              {FACTS.map((f) => (
                <li key={f}>{t(f)}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
