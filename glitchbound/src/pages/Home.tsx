import { lazy, Suspense } from 'react';
import { useAccount } from '../platform/account';
import { AdSlot } from '../components/AdSlot';
import { Arcade } from '../components/Arcade';
import { FreeBanner } from '../components/FreeBanner';
import { Hero } from '../components/Hero';
import { PartyBanner } from '../components/PartyBanner';
import { ThemeStrip } from '../components/ThemeStrip';
import { TodaysDailies } from '../components/TodaysDailies';
import { YourArcade } from '../components/Sections';
import { usePageMeta } from '../platform/meta';
import { useInitialHashScroll } from '../router/router';
import { fresh } from '../platform/freshBuild';

// Below the fold (and the quests are for members only): their code loads after the first paint.
const QuestBoard = lazy(fresh(() => import('../components/Quests').then((m) => ({ default: m.QuestBoard }))));
const NotifyForm = lazy(fresh(() => import('../components/Notify').then((m) => ({ default: m.NotifyForm }))));

/**
 * Kept short on purpose: what to play now (today's pick, Surprise me, six games, the theme of the day, today's dailies),
 * then the games by mood. Newcomers get the free-and-no-sign-up promise right after the games; members see their quests.
 * The daily challenge in full lives on /daily.
 */
export function Home() {
  usePageMeta({ path: '/' });
  useInitialHashScroll();
  const { me } = useAccount();
  return (
    <>
      <Hero />
      <ThemeStrip />
      <TodaysDailies variant="row" headingLevel={2} />
      <Arcade />
      {!me && <FreeBanner />}
      <YourArcade />
      <PartyBanner />
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
