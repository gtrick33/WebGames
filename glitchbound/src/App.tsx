import { lazy, Suspense, useEffect } from 'react';
import { getGame } from './catalog/catalog';
import { CrashNotice, ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
// The game page's code loads on its own (pages/loadGamePage.ts); its styles stay in the main sheet, in their usual order.
import './components/Burst.css';
import './components/DailyCard.css';
import './components/GameStage.css';
import './components/GameTile.css';
import './components/ChallengeFriends.css';
import './components/Leaderboard.css';
import './pages/GamePage.css';
import { gamePageModule, loadGamePage, preloadGamePage } from './pages/loadGamePage';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { ArcadeEntrance } from './components/Entrance';
import { MusicControl } from './components/MusicControl';
import { NoticeBanner } from './components/NoticeBanner';
import { SeasonLayer } from './components/SeasonLayer';
import { ShareHost } from './components/ShareHost';
import { DiscordBar } from './discord/DiscordBar';
import { track } from './platform/analytics';
import { useAccount } from './platform/account';
import { useEmbedHost } from './platform/embed';
import { DISCORD } from './platform/env';
import { useLiveCatalog } from './platform/liveCatalog';
import { visitInfo } from './platform/visit';
import { Link, matchRoute, setPagePreloader, useLocation, type Route } from './router/router';
import { fresh } from './platform/freshBuild';
import { previewing } from './platform/preview';
import { lazyPage } from './platform/lazyPage';

// Pages most visitors never open are separate chunks, so the first load stays small on any phone.
// Not needed for the first paint: loads right after it (it registers the "Rate this game" opener).
// The footer sits below every page: it loads right after the page itself.
const Footer = lazy(fresh(() => import('./components/Footer').then((m) => ({ default: m.Footer }))));
const FeedbackPrompt = lazy(fresh(() => import('./components/FeedbackPrompt').then((m) => ({ default: m.FeedbackPrompt }))));
// Preloaded wherever it is likely next, so a game page doesn't wait for it (pages/loadGamePage.ts).
const GamePage = lazy(gamePageModule);
const DailyPage = lazyPage(() => import('./pages/DailyPage').then((m) => m.DailyPage));
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage').then((m) => m.PrivacyPage));
const TermsPage = lazyPage(() => import('./pages/TermsPage').then((m) => m.TermsPage));
const AboutPage = lazyPage(() => import('./pages/AboutPage').then((m) => m.AboutPage));
const ContactPage = lazyPage(() => import('./pages/ContactPage').then((m) => m.ContactPage));
const AdminPage = lazyPage(() => import('./pages/AdminPage').then((m) => m.AdminPage));
const LeaderboardsPage = lazyPage(() => import('./pages/LeaderboardsPage').then((m) => m.LeaderboardsPage));
const ProfilePage = lazyPage(() => import('./pages/ProfilePage').then((m) => m.ProfilePage));
const BugReportPage = lazyPage(() => import('./pages/BugReportPage').then((m) => m.BugReportPage));
const PartyPage = lazyPage(() => import('./party/ui/PartyPage').then((m) => m.PartyPage));
const LivePage = lazyPage(() => import('./pages/LivePage').then((m) => m.LivePage));
const SignInPage = lazyPage(() => import('./pages/SignInPage').then((m) => m.SignInPage));
const ChallengePage = lazyPage(() => import('./pages/ChallengePage').then((m) => m.ChallengePage));
const ChallengesPage = lazyPage(() => import('./pages/ChallengePage').then((m) => m.ChallengesPage));
const DiscordPage = lazyPage(() => import('./pages/DiscordPage').then((m) => m.DiscordPage));

// What each page needs before it can show: the router loads it before switching pages, so the switch never
// shows an empty page with the footer pulled up under the header (the home page and the 404 are always here).
const PAGE_CODE: Partial<Record<Route['name'], () => Promise<unknown> | undefined>> = {
  game: preloadGamePage,
  section: preloadGamePage,
  daily: DailyPage.preload,
  privacy: PrivacyPage.preload,
  terms: TermsPage.preload,
  about: AboutPage.preload,
  contact: ContactPage.preload,
  admin: AdminPage.preload,
  leaderboards: LeaderboardsPage.preload,
  me: ProfilePage.preload,
  bugs: BugReportPage.preload,
  party: PartyPage.preload,
  live: LivePage.preload,
  signin: SignInPage.preload,
  challenge: ChallengePage.preload,
  challenges: ChallengesPage.preload,
  discord: DiscordPage.preload,
};
setPagePreloader((pathname) => PAGE_CODE[matchRoute(pathname).name]?.());

function Page() {
  const { pathname, search } = useLocation();
  const route = matchRoute(pathname);
  const live = useLiveCatalog();
  const challengeParam = new URLSearchParams(search).get('challenge') ?? '';
  const { me } = useAccount();
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'daily':
      return <DailyPage />;
    case 'privacy':
      return <PrivacyPage />;
    case 'terms':
      return <TermsPage />;
    case 'about':
      return <AboutPage />;
    case 'contact':
      return <ContactPage />;
    case 'leaderboards':
      return <LeaderboardsPage />;
    case 'me':
      return <ProfilePage />;
    case 'party':
      return <PartyPage />;
    case 'live':
      return <LivePage />;
    case 'bugs':
      return <BugReportPage />;
    case 'admin':
      return <AdminPage />;
    case 'signin':
      return <SignInPage />;
    case 'challenges':
      return <ChallengesPage />;
    case 'challenge':
      return <ChallengePage key={route.id} id={route.id} />;
    case 'discord':
      // The Discord Activity stays a 404 until its client ID is configured.
      return DISCORD.enabled ? <DiscordPage /> : <NotFound />;
    case 'game':
    case 'section': {
      // Hidden games are closed to players; admins and QA testers can still open them to preview and test.
      // A section game (Sigilfall) that is hidden is the whole section switched off.
      const game = getGame(route.slug, live.all);
      return game && (!live.settings(game.slug).hidden || me?.role) ? <GamePage key={`${game.slug}:${challengeParam}`} game={game} /> : <NotFound />;
    }
    default:
      return <NotFound />;
  }
}

export function App() {
  const { pathname } = useLocation();
  // Inside the Discord Activity the arcade's header and footer give way to a slim bar.
  const embedded = !!useEmbedHost();
  useEffect(() => {
    track('page_view', { path: matchRoute(pathname).name, ...visitInfo() });
  }, [pathname]);
  // The game page's code comes while the page is idle, so opening a game from a tile doesn't wait for it.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 2000));
    // ...and so do the small tabs of the header, so switching to them is instant on a phone too (no hover to warm
    // them there). Party Mode is a big chunk: it loads when a finger or the mouse reaches its tab.
    idle(() => {
      void loadGamePage().catch(() => undefined);
      for (const page of [DailyPage, LeaderboardsPage]) void page.preload()?.catch(() => undefined);
    });
  }, []);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {!embedded && <ArcadeEntrance />}
      {embedded ? <DiscordBar /> : <Header />}
      <NoticeBanner />
      {previewing && (
        <p className="preview-badge" role="status">
          Preview · not published yet
        </p>
      )}
      <ShareHost />
      <main id="main" tabIndex={-1}>
        <ErrorBoundary
          key={pathname}
          fallback={(reset) => (
            <div className="wrap info-page">
              <h1 className="info-title">Something glitched.</h1>
              <p className="info-lead">This page hit an unexpected error. The rest of the arcade is fine.</p>
              <div className="nf-actions">
                <button className="btn btn-primary" onClick={reset}>
                  Try again
                </button>
                <Link href="/" className="btn">
                  Go home
                </Link>
              </div>
            </div>
          )}
        >
          <Suspense fallback={<div className="wrap page-loading" role="status" aria-label="Loading" />}>
            <Page />
          </Suspense>
        </ErrorBoundary>
      </main>
      {!embedded && (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      )}
      <MusicControl />
      <Suspense fallback={null}>
        <FeedbackPrompt />
      </Suspense>
      <SeasonLayer />
    </>
  );
}

/** The app with a last line of defense: a crash outside any page (say, storage the browser blocks) shows a notice, not a white page. */
export function Root() {
  return (
    <ErrorBoundary fallback={() => <CrashNotice />}>
      <App />
    </ErrorBoundary>
  );
}
