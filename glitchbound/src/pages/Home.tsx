import { GAMES } from '../catalog/games';
import { latestGame } from '../catalog/catalog';
import { AdSlot } from '../components/AdSlot';
import { Arcade } from '../components/Arcade';
import { DailyCard } from '../components/DailyCard';
import { Hero } from '../components/Hero';
import { NotifyForm } from '../components/Notify';
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
      <div className="wrap section">
        <QuestBoard compact />
      </div>
      <div className="wrap section home-daily" id="daily">
        <DailyCard variant="band" />
      </div>
      <LatestRelease game={featured} />
      <Marquee words={['One more round', 'Then another', 'No installs', 'Beat your best', 'New daily at midnight']} />
      <NotifyForm />
      <div className="wrap">
        <AdSlot placement="home" />
      </div>
    </>
  );
}
