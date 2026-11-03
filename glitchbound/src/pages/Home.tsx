import { lazy, Suspense } from 'react';
import { useAccount } from '../platform/account';
import { AdSlot } from '../components/AdSlot';
import { Arcade } from '../components/Arcade';
import { FreeBanner } from '../components/FreeBanner';
import { SigilfallHero, useSigilfall } from '../components/SigilfallHero';
import { YourArcade } from '../components/Sections';
import { usePageMeta } from '../platform/meta';
import { useInitialHashScroll } from '../router/router';
import { fresh } from '../platform/freshBuild';

// Below the fold: their code loads after the first paint (the quests are for members only).
// The arcade's welcome is under Sigilfall now, so it can wait too: its fallback holds the place, so nothing jumps.
const Hero = lazy(fresh(() => import('../components/Hero').then((m) => ({ default: m.Hero }))));
const FlagshipRow = lazy(fresh(() => import('../components/FlagshipRow').then((m) => ({ default: m.FlagshipRow }))));
const bands = fresh(() => import('../components/HomeBands'));
const HomeTop = lazy(() => bands().then((m) => ({ default: m.HomeTop })));
const PlayTogether = lazy(() => bands().then((m) => ({ default: m.PlayTogether })));
const QuestBoard = lazy(fresh(() => import('../components/Quests').then((m) => ({ default: m.QuestBoard }))));
const NotifyForm = lazy(fresh(() => import('../components/Notify').then((m) => ({ default: m.NotifyForm }))));

/**
 * One clear path for a newcomer, each thing once: Sigilfall, the site's flagship, then what the arcade is
 * (today's pick, Surprise me, the promise and the game wall), where returning players left off, the best games, Today (the day's theme over the daily challenge and a few quick dailies), the whole arcade,
 * playing together (live games and Party Mode), and the free promise with the optional account.
 */
export function Home() {
  usePageMeta({ path: '/' });
  useInitialHashScroll();
  const { me } = useAccount();
  const sigilfall = useSigilfall();
  return (
    <>
      <SigilfallHero />
      <Suspense fallback={<div className="hero-holder" />}>
        <Hero first={!sigilfall} />
        <YourArcade />
        <FlagshipRow />
      </Suspense>
      <Suspense fallback={null}>
        <HomeTop />
      </Suspense>
      <Arcade />
      <Suspense fallback={null}>
        <PlayTogether />
      </Suspense>
      {!me && <FreeBanner />}
      <Suspense fallback={null}>
        {me && (
          <div className="wrap section">
            <QuestBoard compact />
          </div>
        )}
        {me && <FreeBanner />}
        <NotifyForm />
      </Suspense>
      <div className="wrap">
        <AdSlot placement="home" />
      </div>
    </>
  );
}
