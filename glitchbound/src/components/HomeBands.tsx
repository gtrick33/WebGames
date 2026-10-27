/**
 * The home page's bands below the best games, in one chunk that loads after the first paint (the
 * startup budget is nearly full, and none of this is on the first screen):
 *
 * - HomeTop: SigilfallBand and TodayBand, which sit between the best games and the arcade.
 * - SigilfallBand: the RPG's cinematic doorway, the night sky and the gold title of its own world.
 * - TodayBand: the day's theme as the header of today's challenge, with a few quick dailies the rows
 *   above did not show yet (the rest are one link away on /daily).
 * - PlayTogether: live games on everyone's own device and Party Mode's pass-the-phone games, side by side.
 */
import { lazy, Suspense, useEffect, type CSSProperties } from 'react';
import { tGame, useT } from '../i18n';
import { multiplayerGames } from '../catalog/multiplayer';
import { orderByLayout } from '../catalog/settings';
import { gameUrl, playPath, SECTION_GAMES } from '../catalog/catalog';
import type { GameEntry } from '../catalog/types';
import { dayKey } from '../platform/dates';
import { useDaily, useNow } from '../platform/hooks';
import { useLiveCatalog } from '../platform/liveCatalog';
import { useStreakDays } from '../platform/streak';
import { useSave } from '../platform/store';
import { themeGames } from '../platform/themes';
import { useFlagships } from '../platform/useFlagships';
import { fresh } from '../platform/freshBuild';
import { Link } from '../router/router';
import { DailyCard } from './DailyCard';
import { Icon } from './Icon';
import { LiveBadge } from './LiveBadge';
import { ThemeStrip } from './ThemeStrip';
import './HomeBands.css';
import './PartyBanner.css';

const PartyCards = lazy(fresh(() => import('./PartyCards').then((m) => ({ default: m.PartyCards }))));

/**
 * The bands between the best games and the arcade. They arrive after the first paint, above the
 * arcade: a visit to /#arcade is scrolled there again once they are in, so it still lands on the games.
 */
export function HomeTop() {
  useEffect(() => {
    if (window.location.hash === '#arcade' && window.scrollY > 0) document.getElementById('arcade')?.scrollIntoView();
  }, []);
  return (
    <>
      <SigilfallBand />
      <TodayBand />
    </>
  );
}

/** How many quick dailies the Today band offers: enough to start a habit, few enough to finish. */
const QUICK = 4;

export function TodayBand() {
  const t = useT();
  const live = useLiveCatalog();
  const save = useSave();
  const now = useNow(60_000);
  const today = dayKey(now);
  const daily = useDaily(now, useStreakDays());
  const { list: flagships, theme } = useFlagships();
  const dailies = live.games.filter((g) => g.ownDaily && g.released <= today && !live.settings(g.slug).maintenance);
  const finished = new Set(save.gameDailies[today] ?? []);
  const doneCount = dailies.filter((g) => finished.has(g.slug)).length;
  // Not the best games (they are right above) nor the challenge's game (its card is right here):
  // the day's theme first, then the rest in the arcade's order.
  const shown = new Set([...flagships.map((f) => f.game.slug), daily?.challenge.game.slug]);
  const quick = [...new Set([...themeGames(theme, dailies), ...dailies])].filter((g) => !finished.has(g.slug) && !shown.has(g.slug)).slice(0, QUICK);
  return (
    <section className="wrap today-band" aria-label={t('Today')}>
      <ThemeStrip embedded level={2} />
      <div className="today-band-grid">
        <DailyCard variant="hero" headingLevel={3} />
        {dailies.length > 0 && (
          <div className="today-quick">
            <h3 className="today-quick-title">{t('Quick dailies')}</h3>
            <p className="today-quick-sub">{t('A fresh puzzle in each, the same for everyone. New at midnight.')}</p>
            {quick.length > 0 ? (
              <ul className="today-quick-list">
                {quick.map((g) => (
                  <li key={g.slug}>
                    <Link href={gameUrl(g.slug)} className="quick-chip" data-accent={g.accent}>
                      <img src={g.art.tile} alt="" width={52} height={52} loading="lazy" style={{ background: g.art.bg }} />
                      <span className="quick-text">
                        <strong>{g.title}</strong>
                        <span>{t(g.ownDaily!.label)}</span>
                      </span>
                      <Icon name="play" size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="today-quick-done">
                <Icon name="check" size={18} /> {t('Every quick daily is done. Nice!')}
              </p>
            )}
            <Link href="/daily" className="today-all">
              {doneCount > 0 ? t('{a} of {b} dailies done', { a: doneCount, b: dailies.length }) : t('See all {n} dailies', { n: dailies.length })} <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/** The facts on the Sigilfall band: what the game has, counted from its data. */
const SIGILFALL_FACTS = ['7 heroes', '5 acts', '12 dungeons', 'Co-op for 4'];

export function SigilfallBand() {
  const t = useT();
  const live = useLiveCatalog();
  const game = SECTION_GAMES.find((g) => g.slug === 'sigilfall');
  if (!game || live.settings(game.slug).hidden) return null;
  return (
    <section className="wrap sf-band" aria-labelledby="sf-band-title">
      <Link href={game.section!.path} className="sf-card">
        <span className="sf-sky" aria-hidden="true">
          <span className="sf-stars" />
          <span className="sf-moon" />
          <span className="sf-peaks" />
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} className="sf-ember" style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 5) * 1.3}s`, '--s': `${7 + (i % 4) * 2.2}s` } as CSSProperties} />
          ))}
        </span>
        <span className="sf-copy">
          <span className="sf-kicker">{t('A GlitchBound adventure')}</span>
          <span className="sf-title-row">
            <span className="sf-sigil" aria-hidden="true" />
            <h2 id="sf-band-title" className="sf-title">
              Sigilfall
            </h2>
          </span>
          <span className="sf-sub">{t('A whole fantasy RPG that plays right in your browser. Choose your hero, gather your gear and close the Rift, alone or with friends.')}</span>
          <span className="sf-facts">
            {SIGILFALL_FACTS.map((f) => (
              <span key={f}>{t(f)}</span>
            ))}
          </span>
          <span className="sf-cta">
            {t('Enter the Rift')} <Icon name="arrowRight" size={20} />
          </span>
        </span>
        <span className="sf-art" aria-hidden="true">
          <img src={game.art.wide} alt="" width={1200} height={480} loading="lazy" decoding="async" />
        </span>
      </Link>
    </section>
  );
}

function LiveCard({ g }: { g: GameEntry }) {
  const t = useT();
  return (
    <li className="live-card" data-accent={g.accent}>
      <img src={g.art.tile} alt="" width={84} height={84} loading="lazy" style={{ background: g.art.bg }} />
      <span className="live-card-text">
        <Link href={playPath(g)} className="live-card-link">
          {g.title}
        </Link>
        <span>{tGame(g.tagline)}</span>
        <span className="live-card-meta">
          <LiveBadge game={g} />
          {g.live && <span className="mono">{t('{n} players', { n: g.live.players })}</span>}
        </span>
      </span>
    </li>
  );
}

export function PlayTogether() {
  const t = useT();
  const live = useLiveCatalog();
  const flagships = new Set(useFlagships().list.map((f) => f.game.slug));
  const games = orderByLayout(live.games, live.layout).filter((g) => !live.settings(g.slug).maintenance);
  const all = multiplayerGames(games, live.raw.multiplayer);
  // A best game is already a big card above (with its live label): here it would only repeat itself.
  const list = all.filter((g) => !flagships.has(g.slug));
  const online = list.length ? list : all;
  return (
    <section className="wrap section together" aria-labelledby="together-title">
      <div className="together-head">
        <p className="eyebrow">
          <Icon name="party" size={16} /> {t('Play together')}
        </p>
        <h2 id="together-title" className="together-title">
          {t('Better with friends')}
        </h2>
        <p className="together-sub">{t('Play live, each on your own phone, or pass one phone around the room.')}</p>
      </div>
      <div className="together-grid">
        {online.length > 0 && (
          <div className="together-col" aria-labelledby="together-live">
            <h3 id="together-live" className="together-col-title">
              <span className="together-dot" aria-hidden="true" /> {t('Live online')}
            </h3>
            <ul className="live-cards">
              {online.map((g) => (
                <LiveCard key={g.slug} g={g} />
              ))}
            </ul>
          </div>
        )}
        <div className="together-col" aria-label={t('Party Mode')}>
          <Link href="/party" className="party-banner">
            <span className="party-banner-emoji" aria-hidden="true">
              🎉🃏🎲
            </span>
            <span className="party-banner-text">
              <span className="eyebrow">{t('Party Mode')}</span>
              <strong>{t('Got friends over? Pass the phone.')}</strong>
              <span>{t('Impostor, charades, Never Have I Ever and more. Pass one phone around, or everyone plays on their own.')}</span>
            </span>
            <span className="party-banner-go mono" aria-hidden="true">
              {t('Let’s party →')}
            </span>
          </Link>
          <Suspense fallback={null}>
            <PartyCards />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
