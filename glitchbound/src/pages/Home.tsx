import { GAMES } from '../catalog/games';
import { latestGame } from '../catalog/catalog';
import { AdSlot } from '../components/AdSlot';
import { Arcade } from '../components/Arcade';
import { DailyCard } from '../components/DailyCard';
import { Hero } from '../components/Hero';
import { LatestRelease, Marquee, YourArcade } from '../components/Sections';
import { usePageMeta } from '../platform/meta';
import { useInitialHashScroll } from '../router/router';

export function Home() {
  usePageMeta({ path: '/' });
  useInitialHashScroll();
  const featured = latestGame() ?? GAMES[0]!;
  return (
    <>
      <Hero featured={featured} />
      <div className="wrap section home-daily" id="daily">
        <DailyCard variant="band" />
      </div>
      <YourArcade />
      <LatestRelease game={featured} />
      <Marquee words={['One more round', 'Then another', 'No installs', 'Beat your best', 'New daily at midnight']} />
      <div className="wrap">
        <AdSlot placement="home" />
      </div>
      <Arcade />
    </>
  );
}
