import { useEffect } from 'react';
import { getGame } from './catalog/catalog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { DailyPage } from './pages/DailyPage';
import { GamePage } from './pages/GamePage';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { PrivacyPage } from './pages/PrivacyPage';
import { AdminPage } from './pages/AdminPage';
import { LeaderboardsPage } from './pages/LeaderboardsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SignInPage } from './pages/SignInPage';
import { ArcadeEntrance } from './components/Entrance';
import { MusicControl } from './components/MusicControl';
import { track } from './platform/analytics';
import { Link, matchRoute, useLocation } from './router/router';

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
    track('page_view', { path: matchRoute(pathname).name });
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
          <Page />
        </ErrorBoundary>
      </main>
      <Footer />
      <MusicControl />
    </>
  );
}
