import { useEffect } from 'react';
import { track } from '../../../platform/analytics';
import type { SigilEngine } from '../engine';
import { modeStopProps } from '../progress/telemetry';

/**
 * A mode that draws itself (the Ring, the Vigil) says so while it is up: a bug report written from it names it, and a
 * player who leaves it (back to the title, or the page hidden or left) is counted as a stop there, with the minutes
 * they stayed and nothing else (progress/telemetry.ts).
 */
export function usePlayedMode(engine: SigilEngine | undefined, mode: 'ring' | 'vigil'): void {
  useEffect(() => {
    const from = performance.now();
    let sent = false;
    engine?.setPlaying(mode);
    const stop = (): void => {
      if (sent) return;
      sent = true;
      track('game_stop', modeStopProps(mode, (performance.now() - from) / 60_000));
    };
    // (a phone's player hides the page and never leaves it; one who comes back stops again later)
    const seen = (): void => {
      if (document.hidden) stop();
      else sent = false;
    };
    document.addEventListener('visibilitychange', seen);
    window.addEventListener('pagehide', stop);
    return () => {
      stop();
      if (engine?.playing === mode) engine.setPlaying(null);
      document.removeEventListener('visibilitychange', seen);
      window.removeEventListener('pagehide', stop);
    };
  }, [engine, mode]);
}
