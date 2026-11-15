import { useEffect, useState } from 'react';

/**
 * The Ring tutorial's words (arena/tutorial.ts): a panel that says one thing at a time, how far along it is, and the
 * way on, and never blocks what it talks about. Used over the lobby, and in a match under the clock, between the
 * nameplates (`inline`): there a step done by doing it says only what to do (`short`), the rest a press away, so that
 * the panel stays off the fight and the buttons.
 */
export function Coach({ n, of, title, text, short, note, at, inline, onNext, nextLabel, onBack, onSkip, small }: { n: number; of: number; title: string; text: string; short?: string; note?: string; at?: 'top' | 'bottom' | 'side'; inline?: boolean; onNext?: () => void; nextLabel?: string; onBack?: () => void; onSkip: () => void; small?: boolean }) {
  const [more, setMore] = useState(false);
  const brief = !!short && !more;
  return (
    <aside className={`rb-coach${inline ? ' is-inline' : ` is-${at ?? 'bottom'}`}${small ? ' is-small' : ''}`} role="status" aria-live="polite" aria-label="Tutorial">
      <header>
        <small>
          Tutorial · {n} of {of}
        </small>
        <button type="button" className="rb-coach-skip" onClick={onSkip}>
          Skip tutorial
        </button>
      </header>
      <strong>{title}</strong>
      {!small && <p>{brief ? short : text}</p>}
      {!small && short && (
        <button type="button" className="rb-coach-more" onClick={() => setMore((x) => !x)} aria-expanded={more}>
          {more ? 'Less' : 'More'}
        </button>
      )}
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

/**
 * Every part of a screen named at once (the owner: "show everything initially"): each element marked
 * `data-tut="<spot>"` is lit and wears its label, a word pinned above it (`data-tut-label`, drawn by the stylesheet as
 * the element's own, so it stays with it however the game's picture is scaled or turned on a phone). Looked for again
 * now and then, as useSpot, since a page or tab may only just have been drawn.
 */
export function useLabels(labels: readonly { spot: string; text: string }[] | null | undefined): void {
  const key = labels ? labels.map((l) => `${l.spot}:${l.text}`).join('|') : '';
  useEffect(() => {
    if (!labels?.length) return;
    const worn = new Map<HTMLElement, string>();
    const wear = (): void => {
      for (const { spot, text } of labels) {
        for (const el of document.querySelectorAll<HTMLElement>(`[data-tut="${spot}"]`)) {
          if (worn.has(el)) continue;
          // (a label is placed against its element: one laid out where it falls is made a place to put it against)
          const was = el.style.position;
          if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
          worn.set(el, was);
          el.dataset.tutLabel = text;
          // (one near the top of the screen wears it underneath, where there is room)
          const r = el.getBoundingClientRect();
          const top = el.closest('.rb-stage, .rb-game, body')?.getBoundingClientRect().top ?? 0;
          if (r.top - top < 34) el.dataset.tutBelow = '';
          el.classList.add('is-tut-spot', 'is-tut-label');
        }
      }
      for (const [el] of worn) if (!el.isConnected) worn.delete(el);
    };
    wear();
    const id = window.setInterval(wear, 250);
    return () => {
      window.clearInterval(id);
      for (const [el, was] of worn) {
        el.classList.remove('is-tut-spot', 'is-tut-label');
        delete el.dataset.tutLabel;
        delete el.dataset.tutBelow;
        el.style.position = was;
      }
    };
    // (the labels by what they say: a new list of the same words is the same labels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
