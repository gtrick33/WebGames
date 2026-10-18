import { useAccount } from '../platform/account';
import { AdSlot } from '../components/AdSlot';
import { Arcade } from '../components/Arcade';
import { FreeBanner } from '../components/FreeBanner';
import { Hero } from '../components/Hero';
import { PartyBanner } from '../components/PartyBanner';
import { NotifyForm } from '../components/Notify';
import { ThemeStrip } from '../components/ThemeStrip';
import { TodaysDailies } from '../components/TodaysDailies';
import { QuestBoard } from '../components/Quests';
import { YourArcade } from '../components/Sections';
import { usePageMeta } from '../platform/meta';
import { useInitialHashScroll } from '../router/router';

/**
 * Kept short on purpose: what to play now (today's pick, Surprise me, the theme of the day, today's dailies), then the
 * games by mood. Newcomers see the free-and-no-sign-up promise first; members see their quests.
 * The daily challenge in full lives on /daily.
 */
export function Home() {
  usePageMeta({ path: '/' });
  useInitialHashScroll();
  const { me } = useAccount();
  return (
    <>
      <Hero />
      {!me && <FreeBanner />}
      <ThemeStrip />
      <TodaysDailies variant="row" headingLevel={2} />
      <Arcade />
      <YourArcade />
      <PartyBanner />
      {me && (
        <div className="wrap section">
          <QuestBoard compact />
        </div>
      )}
      {me && <FreeBanner />}
      <NotifyForm />
      <div className="wrap">
        <AdSlot placement="home" />
      </div>
    </>
  );
}
