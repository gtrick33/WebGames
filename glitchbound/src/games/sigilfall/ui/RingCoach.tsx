import { useEffect } from 'react';

/**
 * The Ring tutorial's words (arena/tutorial.ts): a panel that says one thing at a time, how far along it is, and the
 * way on, and never blocks what it talks about. Used over the lobby and over the practice match.
 */
export function Coach({ n, of, title, text, note, at, onNext, nextLabel, onBack, onSkip, small }: { n: number; of: number; title: string; text: string; note?: string; at: 'top' | 'bottom'; onNext?: () => void; nextLabel?: string; onBack?: () => void; onSkip: () => void; small?: boolean }) {
  return (
    <aside className={`rb-coach is-${at}${small ? ' is-small' : ''}`} role="status" aria-live="polite" aria-label="Tutorial">
      <header>
        <small>
          Tutorial · {n} of {of}
        </small>
        <button type="button" className="rb-coach-skip" onClick={onSkip}>
          Skip tutorial
        </button>
      </header>
      <strong>{title}</strong>
      {!small && <p>{text}</p>}
      {note && <em className="rb-coach-note">{note}</em>}
      {(onBack || onNext) && (
        <footer>
          {onBack && (
            <button type="button" className="rb-btn is-small" onClick={onBack}>
              Back
            </button>
          )}
          {onNext && (
            <button type="button" className="rb-btn is-small is-gold" onClick={onNext}>
              {nextLabel ?? 'Next'}
            </button>
          )}
        </footer>
      )}
    </aside>
  );
}

/**
 * Lights up what a tutorial step talks about: every element marked `data-tut="<spot>"`. Looked for again now and then,
 * since what it talks about may only just be drawn (a page or a tab the step has just opened).
 */
export function useSpot(spot: string | null): void {
  useEffect(() => {
    if (!spot) return;
    const lit = new Set<HTMLElement>();
    let scrolled = false;
    const light = (): void => {
      for (const el of document.querySelectorAll<HTMLElement>(`[data-tut="${spot}"]`)) {
        if (lit.has(el)) continue;
        lit.add(el);
        el.classList.add('is-tut-spot');
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        }
      }
      for (const el of lit) {
        if (el.isConnected) continue;
        lit.delete(el);
      }
    };
    light();
    const id = window.setInterval(light, 250);
    return () => {
      window.clearInterval(id);
      for (const el of lit) el.classList.remove('is-tut-spot');
    };
  }, [spot]);
}
