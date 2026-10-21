import { useEffect, useRef, useState } from 'react';
import type { CarDef } from './cars';
import { loadModel, fileFor, modelSettled, preloadShared } from './models';
import type { Sfx } from './sound';

/** The longest the intro waits for the network before letting the player in anyway. */
const MAX_WAIT_MS = 15000;
/** One red light every this long while loading (five make the full gantry). */
const LIGHT_MS = 420;
/** Once loaded, the remaining lights come on this fast, then they go out. */
const RUSH_MS = 120;
const TAGLINES = ['Nail the launch.', 'Hit every shift.', 'Tune the fastest car on the strip.', 'Beat the King.'];

/** Whether the cars the first screen needs are already in memory (then there is no intro at all). */
export const introNeeded = (defs: readonly CarDef[]): boolean => defs.some((d) => !modelSettled(d));

/**
 * The opening: a race-day title card that plays while the first screen's cars load. The five start
 * lights come on one by one with "Loading" in the middle of the screen; when everything is in, the
 * last lights snap on, they go out, GO!, and the card lifts away. Sounds only once audio is unlocked.
 */
export function Intro({ defs, sfx, onDone }: { defs: readonly CarDef[]; sfx: () => Sfx; onDone: () => void }) {
  const [lit, setLit] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [out, setOut] = useState(false);
  const [line, setLine] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  // the loading itself: the shared palettes, then each body; a stalled network never traps the player
  useEffect(() => {
    let alive = true;
    const files = [...new Set(defs.map(fileFor))];
    const total = files.length + 1;
    let n = 0;
    const tick = (): void => {
      n++;
      if (alive) setProgress(n / total);
    };
    const all = preloadShared()
      .then(tick)
      .then(() => Promise.all(files.map((f) => loadModel(f).then(tick))));
    const cap = new Promise((r) => window.setTimeout(r, MAX_WAIT_MS));
    void Promise.race([all, cap]).then(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [defs]);

  // the lights: one by one while loading, quickly the rest once loaded, then out
  useEffect(() => {
    if (out) return;
    if (lit >= 5) {
      if (!loaded) return;
      const id = window.setTimeout(() => {
        setOut(true);
        sfx().green();
      }, 260);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(
      () => {
        setLit((l) => l + 1);
        sfx().amber();
      },
      loaded ? RUSH_MS : LIGHT_MS,
    );
    return () => window.clearTimeout(id);
  }, [lit, loaded, out, sfx]);

  useEffect(() => {
    if (!out) return;
    const id = window.setTimeout(() => done.current(), 700);
    return () => window.clearTimeout(id);
  }, [out]);

  useEffect(() => {
    const id = window.setInterval(() => setLine((l) => (l + 1) % TAGLINES.length), 1600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`lc-intro${out ? ' is-out' : ''}${lit >= 5 && !loaded ? ' is-holding' : ''}`} role="status" aria-live="polite" aria-label={loaded ? 'Ready' : 'Loading Launch Control'}>
      <div className="lc-intro-road" aria-hidden="true">
        <i className="lc-intro-lane" />
        <i className="lc-intro-lane is-right" />
        <i className="lc-intro-dash" />
      </div>
      <div className="lc-intro-gantry" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`lc-intro-pod${!out && i < lit ? ' is-on' : ''}`}>
            <i />
            <i />
          </span>
        ))}
      </div>
      <div className="lc-intro-title" aria-hidden="true">
        <span className="lc-logo-word lc-intro-word">
          Launch<b>Control</b>
        </span>
        <span key={line} className="lc-intro-tag">
          {TAGLINES[line]}
        </span>
      </div>
      <div className="lc-intro-loading">
        {out ? (
          <b className="lc-intro-go">GO!</b>
        ) : (
          <>
            <span className="lc-intro-label mono">
              Loading<i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
            <span className="lc-intro-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
            </span>
          </>
        )}
      </div>
      <svg className="lc-intro-car" viewBox="0 0 260 110" aria-hidden="true">
        <g className="lc-intro-smoke">
          <circle cx="22" cy="86" r="14" />
          <circle cx="8" cy="74" r="10" />
          <circle cx="34" cy="70" r="9" />
        </g>
        <path className="lc-intro-wing" d="M30 26h34l-6 22H40z" />
        <path className="lc-intro-body" d="M40 74c-6-16 0-30 14-34l40-6c20-14 50-18 76-10l38 12c22 4 40 12 46 24 4 8 2 14-6 16H52c-6 0-10-0-12-2z" />
        <path className="lc-intro-glass" d="M104 36c14-10 36-12 56-6l10 14H98z" />
        <path className="lc-intro-stripe" d="M60 60h190" />
        <circle className="lc-intro-wheel" cx="76" cy="82" r="22" />
        <circle className="lc-intro-hub" cx="76" cy="82" r="8" />
        <circle className="lc-intro-wheel" cx="214" cy="86" r="16" />
        <circle className="lc-intro-hub" cx="214" cy="86" r="6" />
      </svg>
    </div>
  );
}
