import { useEffect, useRef, useState, type ReactNode } from 'react';
import { iconsReady } from '../render/art/gameIcons';

/** Never kept behind the veil longer than this, whatever hasn't come. */
const MAX_WAIT = 4500;
const FADE = 260;
/** The first intro stays long enough to be read rather than flicker. */
const INTRO_MIN = 1200;

/** Seen once a visit: after that a screen only waits for what it needs. */
let introSeen = false;

const settle = (p: Promise<unknown>): Promise<void> => p.then(
  () => undefined,
  () => undefined,
);
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function decodeImages(box: HTMLElement | null): Promise<unknown> {
  if (!box) return Promise.resolve();
  return Promise.all([...box.querySelectorAll('img')].map((i) => (i.getAttribute('src') && typeof i.decode === 'function' ? settle(i.decode()) : Promise.resolve())));
}

const INTRO_LINES = ['Lighting the sanctum', 'Waking the wardens', 'Sharpening old steel', 'Reading the sigils'];

/**
 * Holds a screen behind a veil until what it shows is really there: the type, the icons, every picture decoded, and
 * anything the screen itself says it's waiting for. The screen is mounted underneath all the while, so it has its
 * real size and nothing moves when the veil lifts. On the first screen of a visit the veil is the game's intro.
 */
export function ScreenGate({ children, intro = false, hold = false, tasks, label = 'Loading' }: { children: ReactNode; intro?: boolean; hold?: boolean; tasks?: () => Promise<unknown>[]; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [full] = useState(() => intro && !introSeen);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [gone, setGone] = useState(false);
  const [line] = useState(() => INTRO_LINES[Math.floor(Math.random() * INTRO_LINES.length)]!);

  useEffect(() => {
    let on = true;
    const began = performance.now();
    const fonts: Promise<unknown> = typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve();
    const list = [fonts, iconsReady, ...(tasks?.() ?? [])];
    let done = 0;
    const counted = list.map((p) =>
      settle(p).then(() => {
        done += 1;
        if (on) setProgress(done / (list.length + 1));
      }),
    );
    const everything = Promise.all(counted)
      // (a moment for what those let the screen draw: icons fill in, and their pictures have to decode too)
      .then(() => pause(30))
      .then(() => decodeImages(box.current));
    void Promise.race([everything, pause(MAX_WAIT)]).then(async () => {
      const left = (full ? INTRO_MIN : 0) - (performance.now() - began);
      if (left > 0) await pause(left);
      if (!on) return;
      introSeen = true;
      setProgress(1);
      setLoaded(true);
    });
    return () => {
      on = false;
    };
    // (what to wait for is settled when the screen opens)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = loaded && !hold;
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setGone(true), FADE);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div className="rb-gate" ref={box}>
      {children}
      {!gone && (
        <div className={`rb-veil${open ? ' is-out' : ''}${full ? ' is-intro' : ''}`} role="status" aria-label={label}>
          {full ? (
            <div className="rb-veil-intro">
              <i className="rb-veil-sigil" aria-hidden="true" />
              <span className="rb-veil-kicker">A GlitchBound adventure</span>
              <strong className="rb-veil-word">Sigilfall</strong>
              <span className="rb-veil-bar" aria-hidden="true">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
              <small>{line}</small>
            </div>
          ) : (
            <div className="rb-veil-small">
              <i className="rb-veil-sigil" aria-hidden="true" />
              <small>{label}</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
