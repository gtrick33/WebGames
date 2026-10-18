import { GAMES } from '../catalog/games';
import { latestGame } from '../catalog/catalog';
import { AdSlot } from '../components/AdSlot';
import { Arcade } from '../components/Arcade';
import { DailyCard } from '../components/DailyCard';
import { Hero } from '../components/Hero';
import { PartyBanner } from '../components/PartyBanner';
import { NotifyForm } from '../components/Notify';
import { TodaysDailies } from '../components/TodaysDailies';
import { QuestBoard } from '../components/Quests';
import { LatestRelease, Marquee, YourArcade } from '../components/Sections';
import { usePageMeta } from '../platform/meta';
import { useInitialHashScroll } from '../router/router';

/** Games first: a short intro, the catalogue, then quests, the daily challenge and the rest. */
export function Home() {
  usePageMeta({ path: '/' });
  useInitialHashScroll();
  const featured = latestGame() ?? GAMES[0]!;
  return (
    <>
      <Hero />
      <Arcade />
      <YourArcade />
      <PartyBanner />
      <div className="wrap section">
        <QuestBoard compact />
      </div>
      <div className="wrap section home-daily" id="daily">
        <DailyCard variant="band" />
        <TodaysDailies headingLevel={2} />
      </div>
      <LatestRelease game={featured} />
      <Marquee words={['Small games', 'Big obsessions', 'One more run', 'Beat your best', 'Your daily challenge starts here', 'No installs']} />
      <NotifyForm />
      <div className="wrap">
        <AdSlot placement="home" />
      </div>
    </>
  );
}
