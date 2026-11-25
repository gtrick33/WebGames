import { useEffect, useState } from 'react';
import { packLoad } from '../render3d/pack';

/** The most of its bar the wait fills: the title's own veil (ui/ScreenGate.tsx) takes it from there. */
export const WARM_BAR = 0.9;
/** Whether the wait was shown this visit: the title's veil then starts its bar where this one stopped. */
export const warmed = { shown: false };

const mb = (bytes: number): string => (bytes / 1_048_576).toFixed(1);

/**
 * The wait before the title: the game's models have to come before any screen can show a hero. On a good line it is
 * a moment; on a slow phone line it was half a minute of an empty black box (NINE_PLAN.md piece 7). It is the intro's
 * own veil now, with a bar that fills as the files come and how much of them has.
 */
export function Warming() {
  const [, tick] = useState(0);
  useEffect(() => {
    warmed.shown = true;
    const t = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);
  const { got, total, files, done } = packLoad;
  // by bytes where the server says the sizes; by files where it doesn't
  const share = total > 0 ? got / total : files > 0 ? done / files : 0;
  return (
    <div className="rb-warm" role="status" aria-label="Loading">
      <div className="rb-veil is-intro">
        <div className="rb-veil-intro">
          <i className="rb-veil-sigil" aria-hidden="true" />
          <span className="rb-veil-kicker">A GlitchBound adventure</span>
          <img className="rb-veil-word" src="/games/sigilfall/logo.svg" alt="Sigilfall" width={673} height={168} />
          <span className="rb-veil-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(Math.min(1, share) * WARM_BAR * 100)}%` }} />
          </span>
          <small>{total > 0 ? `Gathering the heroes: ${mb(got)} of ${mb(total)} MB` : 'Gathering the heroes'}</small>
        </div>
      </div>
    </div>
  );
}
