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
import { FeedbackPrompt } from './components/FeedbackPrompt';
import { track } from './platform/analytics';
import { visitInfo } from './platform/visit';
import { Link, matchRoute, useLocation } from './router/router';

// Pages most visitors never open are separate chunks, so the first load stays small on any phone.
const DailyPage = lazy(() => import('./pages/DailyPage').then((m) => ({ default: m.DailyPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const LeaderboardsPage = lazy(() => import('./pages/LeaderboardsPage').then((m) => ({ default: m.LeaderboardsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const BugReportPage = lazy(() => import('./pages/BugReportPage').then((m) => ({ default: m.BugReportPage })));
const PartyPage = lazy(() => import('./party/ui/PartyPage').then((m) => ({ default: m.PartyPage })));
const SignInPage = lazy(() => import('./pages/SignInPage').then((m) => ({ default: m.SignInPage })));

function Page() {
  const { pathname } = useLocation();
  const route = matchRoute(pathname);
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
    case 'game': {
      const game = getGame(route.slug);
      return game ? <GamePage key={game.slug} game={game} /> : <NotFound />;
    }
    default:
      return <NotFound />;
  }
}

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    track('page_view', { path: matchRoute(pathname).name, ...visitInfo() });
  }, [pathname]);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ArcadeEntrance />
      <Header />
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
      <Footer />
      <MusicControl />
      <FeedbackPrompt />
    </>
  );
}
