import { lazy, Suspense } from 'react';
import { useAccount } from '../platform/account';
import { AdSlot } from '../components/AdSlot';
import { Arcade } from '../components/Arcade';
import { FlagshipRow } from '../components/FlagshipRow';
import { FreeBanner } from '../components/FreeBanner';
import { Hero } from '../components/Hero';
import { PartyBanner } from '../components/PartyBanner';
import { TodaysDailies } from '../components/TodaysDailies';
import { YourArcade } from '../components/Sections';
import { usePageMeta } from '../platform/meta';
import { useInitialHashScroll } from '../router/router';
import { fresh } from '../platform/freshBuild';

// Below the fold (and the quests are for members only): their code loads after the first paint.
const QuestBoard = lazy(fresh(() => import('../components/Quests').then((m) => ({ default: m.QuestBoard }))));
const NotifyForm = lazy(fresh(() => import('../components/Notify').then((m) => ({ default: m.NotifyForm }))));

/**
 * One clear path for a newcomer: the hero (today's pick, Surprise me), the four flagship games, then
 * Today (the day's theme, the daily challenge and the flagship dailies still open), then every game
 * by mood and Party Mode. Returning devices get "Continue playing" below; guests the free-and-no-sign-up
 * promise, members their quests. The daily challenge in full lives on /daily.
 */
export function Home() {
  usePageMeta({ path: '/' });
  useInitialHashScroll();
  const { me } = useAccount();
  return (
    <>
      <Hero />
      <FlagshipRow />
      <TodaysDailies variant="featured" headingLevel={2} />
      <Arcade />
      <PartyBanner />
      {!me && <FreeBanner />}
      <YourArcade />
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
