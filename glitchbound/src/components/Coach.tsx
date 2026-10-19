import { useState, type CSSProperties, type ReactNode } from 'react';
import './Coach.css';

/** One step of a game's first-time walkthrough: a small picture and a line or two. */
export interface CoachStep {
  title: string;
  body: string;
  art: ReactNode;
}

const seenKey = (slug: string): string => `glitchbound.coach.${slug}`;

/**
 * Whether to show a game's walkthrough: once per device, the first time the game opens (and again
 * whenever the player asks for it).
 */
export function useCoach(slug: string): { open: boolean; show: () => void; close: () => void } {
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(seenKey(slug));
    } catch {
      return false;
    }
  });
  const close = (): void => {
    try {
      localStorage.setItem(seenKey(slug), '1');
    } catch {
      /* storage blocked */
    }
    setOpen(false);
  };
  return { open, show: () => setOpen(true), close };
}

/**
 * A game's walkthrough: a few steps with a picture each, Next / Skip, then "Let's play". Sits over
 * the game's menu inside its frame; any game can use it (it lives in the game's own chunk).
 */
export function Coach({ steps, onClose, done = 'Let’s play' }: { steps: CoachStep[]; onClose: () => void; done?: string }) {
  const [i, setI] = useState(0);
  const step = steps[i]!;
  const last = i === steps.length - 1;
  return (
    <div className="coach" role="dialog" aria-modal="true" aria-labelledby="coach-title">
      <div className="coach-card" key={i}>
        <div className="coach-art" aria-hidden="true">
          {step.art}
        </div>
        <p className="coach-count mono">
          {i + 1} / {steps.length}
        </p>
        <h2 id="coach-title">{step.title}</h2>
        <p className="coach-body">{step.body}</p>
        <div className="coach-row">
          {!last && (
            <button className="coach-btn coach-btn-quiet" onClick={onClose}>
              Skip
            </button>
          )}
          <button className="coach-btn coach-btn-go" onClick={() => (last ? onClose() : setI(i + 1))} autoFocus>
            {last ? done : 'Next'}
          </button>
        </div>
        <div className="coach-dots" aria-hidden="true">
          {steps.map((_, k) => (
            <i key={k} className={k === i ? 'is-on' : ''} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A tiny grid for walkthrough pictures: `cells` row by row, each a class name and content. */
export function CoachGrid({ size, cells, className = '' }: { size: number; cells: { cls?: string; text?: ReactNode; style?: CSSProperties }[]; className?: string }) {
  return (
    <div className={`coach-grid ${className}`} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {cells.map((c, k) => (
        <span key={k} className={c.cls ?? ''} style={c.style}>
          {c.text}
        </span>
      ))}
    </div>
  );
}
