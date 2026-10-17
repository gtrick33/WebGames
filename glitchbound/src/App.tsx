import { useEffect, useState } from 'react';
import { getGame } from './catalog/catalog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { DailyPage } from './pages/DailyPage';
import { GamePage } from './pages/GamePage';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { PrivacyPage } from './pages/PrivacyPage';
import { Link, matchRoute, useLocation } from './router/router';

/** A 0.7 s branded wipe on the first page view of a session. Never blocks input. */
function Intro() {
  const [show] = useState(() => {
    try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || sessionStorage.getItem('gb.intro')) return false;
      sessionStorage.setItem('gb.intro', '1');
      return true;
    } catch {
      return false;
    }
  });
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setDone(true), 1100);
    return () => window.clearTimeout(t);
  }, [show]);
  if (!show || done) return null;
  return (
    <div className="intro" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

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
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Intro />
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
    </>
  );
}
