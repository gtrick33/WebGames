import { useEffect, useState } from 'react';
import './Entrance.css';

const DURATION_MS = 1900;

function shouldPlay(): boolean {
  if (typeof window === 'undefined') return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  // Only when a visitor arrives at (or reloads) the arcade itself; deep links to games load straight in.
  return window.location.pathname === '/' || window.location.pathname === '/index.html';
}

/**
 * The arcade entrance: a toy-box cabinet rises, a coin drops, the screen flashes READY and the
 * camera dives into the screen to reveal the site. About 1.9 s; any click, key or scroll skips it.
 */
export function ArcadeEntrance() {
  const [show, setShow] = useState(shouldPlay);

  // The inline script in index.html covered the first paint; hand over once we have rendered.
  useEffect(() => {
    document.documentElement.classList.remove('entrance-pending');
  }, []);

  useEffect(() => {
    if (!show) return;
    const done = (): void => setShow(false);
    const t = window.setTimeout(done, DURATION_MS);
    window.addEventListener('keydown', done, { once: true });
    window.addEventListener('wheel', done, { once: true, passive: true });
    window.addEventListener('touchmove', done, { once: true, passive: true });
    document.documentElement.classList.add('entrance-on');
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', done);
      window.removeEventListener('wheel', done);
      window.removeEventListener('touchmove', done);
      document.documentElement.classList.remove('entrance-on');
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className="entrance" aria-hidden="true" onClick={() => setShow(false)}>
      <div className="ent-floor" />
      <div className="ent-cabinet">
        <div className="ent-marquee">
          <span>GLITCH</span>
          <span className="ent-marquee-b">BOUND</span>
        </div>
        <div className="ent-screen">
          <span className="ent-insert">INSERT COIN</span>
          <span className="ent-ready">PLAYER 1 READY</span>
          <span className="ent-scan" />
        </div>
        <div className="ent-panel">
          <i className="ent-stick" />
          <i className="ent-btn b1" />
          <i className="ent-btn b2" />
          <i className="ent-btn b3" />
        </div>
        <div className="ent-slot">
          <i className="ent-coin" />
        </div>
      </div>
      <span className="ent-skip mono">Click to skip</span>
    </div>
  );
}
