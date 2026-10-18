import { lazy, Suspense, useEffect } from 'react';
import { getGame } from './catalog/catalog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { GamePage } from './pages/GamePage';
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
import { Link, matchRoute, useLocation } from './router/router';
import { fresh } from './platform/freshBuild';

// Pages most visitors never open are separate chunks, so the first load stays small on any phone.
// Not needed for the first paint: loads right after it (it registers the "Rate this game" opener).
const FeedbackPrompt = lazy(fresh(() => import('./components/FeedbackPrompt').then((m) => ({ default: m.FeedbackPrompt }))));
const DailyPage = lazy(fresh(() => import('./pages/DailyPage').then((m) => ({ default: m.DailyPage }))));
const PrivacyPage = lazy(fresh(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage }))));
const AdminPage = lazy(fresh(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage }))));
const LeaderboardsPage = lazy(fresh(() => import('./pages/LeaderboardsPage').then((m) => ({ default: m.LeaderboardsPage }))));
const ProfilePage = lazy(fresh(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))));
const BugReportPage = lazy(fresh(() => import('./pages/BugReportPage').then((m) => ({ default: m.BugReportPage }))));
const PartyPage = lazy(fresh(() => import('./party/ui/PartyPage').then((m) => ({ default: m.PartyPage }))));
const SignInPage = lazy(fresh(() => import('./pages/SignInPage').then((m) => ({ default: m.SignInPage }))));
const ChallengePage = lazy(fresh(() => import('./pages/ChallengePage').then((m) => ({ default: m.ChallengePage }))));
const ChallengesPage = lazy(fresh(() => import('./pages/ChallengePage').then((m) => ({ default: m.ChallengesPage }))));
const DiscordPage = lazy(fresh(() => import('./pages/DiscordPage').then((m) => ({ default: m.DiscordPage }))));

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
    case 'leaderboards':
      return <LeaderboardsPage />;
    case 'me':
      return <ProfilePage />;
    case 'party':
      return <PartyPage />;
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
    case 'game': {
      // Hidden games are closed to players; admins can still open them to preview.
      const game = getGame(route.slug, live.all);
      return game && (!live.settings(game.slug).hidden || me?.isAdmin) ? <GamePage key={`${game.slug}:${challengeParam}`} game={game} /> : <NotFound />;
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
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {!embedded && <ArcadeEntrance />}
      {embedded ? <DiscordBar /> : <Header />}
      <NoticeBanner />
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
      {!embedded && <Footer />}
      <MusicControl />
      <Suspense fallback={null}>
        <FeedbackPrompt />
      </Suspense>
      <SeasonLayer />
    </>
  );
}
