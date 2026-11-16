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

/** What a person can press, tab to or type in. */
const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="radio"], [role="tab"], [role="button"], [tabindex]';

/**
 * While a tutorial step is read, only what it is about works (the owner: "block the buttons unless what the tutorial
 * points you to press, i could open different tabs and the tutorial keeps the text and theres bugs"): every control of
 * the game that is neither in the tutorial's own card nor inside one of the parts the step allows (`data-tut` marks)
 * is made inert (it can't be clicked, tapped, tabbed to or typed in) and dimmed. Looked over again now and then, as
 * the labels are, since a page may only just have been drawn. Undone when the step ends.
 */
export function useTutLock(on: boolean, allow: readonly string[] | null | undefined): void {
  const key = on ? `on:${(allow ?? []).join(',')}` : '';
  useEffect(() => {
    if (!key) return;
    const shut = new Set<HTMLElement>();
    const open = (el: HTMLElement): boolean => !!el.closest('.rb-coach') || (allow ?? []).some((spot) => !!el.closest(`[data-tut="${spot}"]`));
    const lock = (): void => {
      const root = document.querySelector<HTMLElement>('.rb-coach')?.closest<HTMLElement>('.rb');
      if (!root) return;
      for (const el of root.querySelectorAll<HTMLElement>(CONTROLS)) {
        if (open(el)) {
          if (shut.delete(el)) {
            el.inert = false;
            el.classList.remove('is-tut-off');
          }
        } else if (!shut.has(el)) {
          shut.add(el);
          el.inert = true;
          el.classList.add('is-tut-off');
        }
      }
      for (const el of shut) if (!el.isConnected) shut.delete(el);
    };
    lock();
    const id = window.setInterval(lock, 200);
    return () => {
      window.clearInterval(id);
      for (const el of shut) {
        el.inert = false;
        el.classList.remove('is-tut-off');
      }
    };
    // (the parts allowed, by name: a new list of the same names is the same lock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Where an element sits inside `root`, in the page's own layout (unmoved by how the game's picture is scaled or turned). */
function placeIn(el: HTMLElement, root: HTMLElement): { x: number; y: number; w: number; h: number } | null {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    x += n.offsetLeft;
    y += n.offsetTop;
    const p = n.offsetParent as HTMLElement | null;
    // (what scrolls between it and the box it is placed in has carried it along)
    for (let a: HTMLElement | null = n.parentElement; a && a !== p; a = a.parentElement) {
      x -= a.scrollLeft;
      y -= a.scrollTop;
    }
    if (!p) return null;
    x -= p.scrollLeft;
    y -= p.scrollTop;
    if (p !== root) {
      x += p.clientLeft;
      y += p.clientTop;
    }
    n = p;
  }
  if (n !== root || !el.offsetWidth) return null;
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/**
 * Every part of a screen named at once (the owner: "show everything initially"): each element marked
 * `data-tut="<spot>"` is lit, and a word for it is pinned on its top edge, all of them together. The words are laid
 * on one layer over the whole game (so no box that scrolls or clips can cut one off), placed by the page's own layout,
 * so they stay put however the game's picture is scaled or turned on a phone. Placed again now and then, as useSpot,
 * since a page or tab may only just have been drawn, and things move.
 */
export function useLabels(labels: readonly { spot: string; text: string; right?: boolean }[] | null | undefined): void {
  const key = labels ? labels.map((l) => `${l.spot}:${l.text}:${l.right ? 1 : 0}`).join('|') : '';
  useEffect(() => {
    if (!labels?.length) return;
    let layer: HTMLDivElement | null = null;
    const lit = new Set<HTMLElement>();
    const tags = new Map<string, HTMLSpanElement>();
    const place = (): void => {
      const first = labels.map((l) => document.querySelector<HTMLElement>(`[data-tut="${l.spot}"]`)).find((el) => !!el);
      const root = first?.closest<HTMLElement>('.rb') ?? null;
      if (!root) return;
      if (!layer || layer.parentElement !== root) {
        layer?.remove();
        layer = document.createElement('div');
        layer.className = 'rb-tut-labels';
        layer.setAttribute('aria-hidden', 'true');
        root.appendChild(layer);
        tags.clear();
      }
      // (the words already placed this time round: no two lie on each other)
      const placed: DOMRect[] = [];
      const card = document.querySelector('.rb-coach')?.getBoundingClientRect();
      const clear = (r: DOMRect): boolean => [...(card ? [card] : []), ...placed].every((o) => !(r.right > o.left && r.left < o.right && r.bottom > o.top && r.top < o.bottom));
      for (const { spot, text, right } of labels) {
        // (the one of its kind that is drawn: a bar at the desk and a phone's buttons are both marked)
        const el = [...document.querySelectorAll<HTMLElement>(`[data-tut="${spot}"]`)].find((e) => e.offsetWidth > 0 && root.contains(e));
        let tag = tags.get(spot);
        const at = el ? placeIn(el, root) : null;
        if (!el || !at) {
          if (tag) tag.style.display = 'none';
          continue;
        }
        if (!lit.has(el)) {
          lit.add(el);
          el.classList.add('is-tut-spot');
        }
        if (!tag) {
          tag = document.createElement('span');
          tag.className = 'rb-tut-label';
          tag.textContent = text;
          layer.appendChild(tag);
          tags.set(spot, tag);
        }
        tag.style.display = '';
        // on its top edge at the left (or the right), or just inside it where the top of the game leaves no room above;
        // never past the game's right edge, and never across the tutorial's own card or another label: the other end
        // then, or along its bottom edge, or off
        const w = tag.offsetWidth;
        const h = tag.offsetHeight;
        const top = at.y - h * 0.6 < 2 ? at.y + 4 : at.y - h * 0.6;
        const it = tag;
        const fits = (left: number, y: number): boolean => {
          it.style.left = `${Math.round(left)}px`;
          it.style.top = `${Math.round(y)}px`;
          const r = it.getBoundingClientRect();
          if (!clear(r)) return false;
          placed.push(r);
          return true;
        };
        const clamp = (x: number): number => Math.max(4, Math.min(x, root.clientWidth - w - 4));
        const ends = right ? [at.x + at.w - w - 10, at.x + 10] : [at.x + 10, at.x + at.w - w - 10];
        const low = at.y + at.h - h * 0.4;
        if (!ends.some((x) => fits(clamp(x), top)) && !ends.some((x) => fits(clamp(x), low))) tag.style.display = 'none';
      }
      for (const el of lit) {
        if (el.isConnected) continue;
        lit.delete(el);
      }
    };
    place();
    const id = window.setInterval(place, 250);
    return () => {
      window.clearInterval(id);
      layer?.remove();
      for (const el of lit) el.classList.remove('is-tut-spot');
    };
    // (the labels by what they say: a new list of the same words is the same labels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
