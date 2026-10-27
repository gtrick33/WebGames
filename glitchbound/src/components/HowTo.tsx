/**
 * How to play, as a short wizard over the game (issue #27): two to four steps with a big picture each,
 * Next / Back / Skip, arrow keys and swipes. Every game gets one from its registry entry (what it is,
 * the controls for this device, what is good to know), so no game needs code for it. It never opens by
 * itself: the info button in the game's toolbar (glowing until first opened) and the game menu open it.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { t as translate, tGame, useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import './HowTo.css';

const KEY = 'glitchbound.howto';

export interface HowToStep {
  /** The step's picture. */
  emoji: string;
  title: string;
  lines: string[];
}

/** Splits a list into one or two steps' worth (three lines at most each, evenly). */
function chunks<T>(list: T[], max = 3): T[][] {
  if (list.length === 0) return [];
  const n = Math.min(2, Math.ceil(list.length / max));
  const size = Math.ceil(list.length / n);
  return Array.from({ length: n }, (_, i) => list.slice(i * size, i * size + size)).filter((c) => c.length > 0);
}

/**
 * A game's steps, from its registry entry: what it is (its tagline), its controls for this device
 * (touch on a touch screen, else the keyboard; the other set when it has only that one), then the
 * highlights. Two to four steps; texts in the site's language.
 */
export function howToSteps(game: GameEntry, touch: boolean, t: typeof translate = translate): HowToStep[] {
  const steps: HowToStep[] = [{ emoji: game.emoji ?? '🎮', title: game.title, lines: [tGame(game.tagline)] }];
  const { keyboard = [], touch: taps = [] } = game.controls;
  const useTouch = touch ? taps.length > 0 || keyboard.length === 0 : keyboard.length === 0;
  for (const part of chunks((useTouch ? taps : keyboard).map(tGame))) steps.push({ emoji: useTouch ? '👆' : '⌨️', title: t(useTouch ? 'Touch' : 'Keyboard'), lines: part });
  const extra = game.highlights?.length ? game.highlights.slice(0, 3).map(tGame) : steps.length < 2 ? [tGame(game.description).split(/(?<=[.!?])\s/)[0]!] : [];
  if (extra.length && steps.length < 4) steps.push({ emoji: '⭐', title: t('Good to know'), lines: extra });
  return steps;
}

/** Whether this device has seen a game's wizard (blocked storage counts as seen: it never nags). */
export function howToSeen(slug: string): boolean {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return true;
  }
  try {
    const list: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(list) && list.includes(slug);
  } catch {
    return false;
  }
}

export function markHowToSeen(slug: string): void {
  try {
    let list: unknown = [];
    try {
      list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
      /* damaged: start again */
    }
    const slugs = Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
    if (!slugs.includes(slug)) localStorage.setItem(KEY, JSON.stringify([...slugs, slug].slice(-200)));
  } catch {
    /* storage blocked */
  }
}

/**
 * The wizard, drawn over the game inside its stage (so it shows in full screen too). The game under it
 * hears no keys or taps meanwhile. `onPlay` starts the game when it is still on its poster.
 */
export function HowTo({ game, onClose, onPlay }: { game: GameEntry; onClose: () => void; onPlay?: () => void }) {
  const t = useT();
  const [touch] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const steps = howToSteps(game, touch, t);
  const [at, setAt] = useState(0);
  const i = Math.min(at, steps.length - 1);
  const step = steps[i]!;
  const last = i === steps.length - 1;
  const count = useRef(steps.length);
  const closeRef = useRef(onClose);
  useEffect(() => {
    count.current = steps.length;
    closeRef.current = onClose;
  });
  const go = (d: number): void => setAt((k) => Math.max(0, Math.min(count.current - 1, k + d)));
  const finish = (): void => {
    onClose();
    onPlay?.();
  };

  // Arrow keys step, Escape skips; no key reaches the game while the wizard is up (Tab and the
  // buttons' Enter/Space still work: their default actions are left alone).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      e.stopImmediatePropagation();
      if (e.type !== 'keydown' || e.repeat) return;
      if (e.key === 'Escape') closeRef.current();
      else if (e.key === 'ArrowRight') setAt((k) => Math.min(count.current - 1, k + 1));
      else if (e.key === 'ArrowLeft') setAt((k) => Math.max(0, k - 1));
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, []);

  // The main button takes the focus on every step, so Enter keeps going.
  const main = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
  }, [i]);

  // A swipe sideways steps too.
  const startX = useRef<number | null>(null);
  const onDown = (e: ReactPointerEvent): void => {
    e.stopPropagation();
    startX.current = e.clientX;
  };
  const onUp = (e: ReactPointerEvent): void => {
    e.stopPropagation();
    const dx = startX.current === null ? 0 : e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  return (
    <div className="howto" role="dialog" aria-modal="true" aria-labelledby="howto-title" data-accent={game.accent} onPointerDown={onDown} onPointerUp={onUp} onClick={(e) => e.stopPropagation()}>
      <div className="howto-card">
        <div className="howto-top">
          <span className="howto-kicker mono">{t('How to play')}</span>
          {!last && (
            <button type="button" className="howto-skip" onClick={onClose}>
              {t('Skip')}
            </button>
          )}
        </div>
        {/* Every step sits in the same cell (the others invisible), so the card is as tall as its
            longest step and Next never moves under the player's finger. */}
        <div className="howto-steps">
          {steps.map((s, k) =>
            k === i ? (
              <div key={`on-${k}`} className="howto-step" aria-live="polite">
                <StepBody step={step} heading />
              </div>
            ) : (
              <div key={k} className="howto-step is-sizer" aria-hidden="true">
                <StepBody step={s} />
              </div>
            ),
          )}
        </div>
        <div className="howto-dots" role="img" aria-label={t('Step {n} of {total}', { n: i + 1, total: steps.length })}>
          {steps.map((_, k) => (
            <i key={k} className={k === i ? 'is-on' : ''} />
          ))}
        </div>
        <div className="howto-row">
          {i > 0 && (
            <button type="button" className="btn howto-back" onClick={() => go(-1)}>
              {t('Back')}
            </button>
          )}
          <button type="button" ref={main} className="btn btn-primary howto-next" onClick={() => (last ? finish() : go(1))}>
            {last ? t('Let’s play!') : t('Next')}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepBody({ step, heading = false }: { step: HowToStep; heading?: boolean }) {
  return (
    <>
      <span className="howto-pic" aria-hidden="true">
        {step.emoji}
      </span>
      {heading ? (
        <h2 id="howto-title" className="howto-title">
          {step.title}
        </h2>
      ) : (
        <p className="howto-title">{step.title}</p>
      )}
      {step.lines.length === 1 ? (
        <p className="howto-lines">{step.lines[0]}</p>
      ) : (
        <ul className="howto-lines">
          {step.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </>
  );
}
