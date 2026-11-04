import { useLayoutEffect, useRef, useState } from 'react';
import type { SigilEngine } from '../engine';
import { toLocal } from './turn';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const GAP = 14;
const EDGE = 10;

/**
 * Where the hint's card goes: under or over what it points at, else beside it, and always inside the stage (a phone
 * on its side has little room). With nothing to point at, or no room around it, it takes the emptier end of the stage.
 */
export function placeTipCard(hole: Box | null, stage: { width: number; height: number }, card: { width: number; height: number }): { left: number; top: number } {
  const clampX = (x: number): number => Math.max(EDGE, Math.min(x, stage.width - card.width - EDGE));
  const clampY = (y: number): number => Math.max(EDGE, Math.min(y, stage.height - card.height - EDGE));
  if (!hole) return { left: clampX((stage.width - card.width) / 2), top: clampY((stage.height - card.height) / 2) };
  const midX = clampX(hole.left + hole.width / 2 - card.width / 2);
  const midY = clampY(hole.top + hole.height / 2 - card.height / 2);
  const below = stage.height - hole.top - hole.height;
  const above = hole.top;
  const right = stage.width - hole.left - hole.width;
  const left = hole.left;
  const fitsV = card.height + GAP + EDGE;
  const fitsH = card.width + GAP + EDGE;
  if (below >= fitsV && below >= above) return { left: midX, top: hole.top + hole.height + GAP };
  if (above >= fitsV) return { left: midX, top: hole.top - GAP - card.height };
  if (below >= fitsV) return { left: midX, top: hole.top + hole.height + GAP };
  if (right >= fitsH && right >= left) return { left: hole.left + hole.width + GAP, top: midY };
  if (left >= fitsH) return { left: hole.left - GAP - card.width, top: midY };
  if (right >= fitsH) return { left: hole.left + hole.width + GAP, top: midY };
  // what it points at fills the stage: the card sits over its emptier end
  return { left: midX, top: below >= above ? stage.height - card.height - EDGE : EDGE };
}

/** The hint on the screen: everything dimmed but the one thing it is about, and its words beside that. */
export function TipOverlay({ engine }: { engine: SigilEngine }) {
  const plan = engine.tipPlan();
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ hole: Box | null; left: number; top: number } | null>(null);
  const step = plan?.steps[plan.step];
  const key = plan ? `${plan.id}:${plan.step}` : '';
  const target = step?.target ?? null;

  useLayoutEffect(() => {
    if (!key) return;
    const measure = (): void => {
      const r = root.current;
      const c = card.current;
      if (!r || !c) return;
      // in the stage's own axes: on a phone held upright the whole game is turned a quarter (ui/turn.ts)
      const stage = { width: r.offsetWidth, height: r.offsetHeight };
      const el = target ? r.parentElement?.querySelector(target) : null;
      const b = el?.getBoundingClientRect();
      let hole: Box | null = null;
      if (b && b.width > 0 && b.height > 0) {
        const p = toLocal(r, b.left, b.top);
        const q = toLocal(r, b.right, b.bottom);
        // (only what is on the stage: a long list runs on past it)
        const left = Math.max(2, Math.min(p.x, q.x) - 5);
        const top = Math.max(2, Math.min(p.y, q.y) - 5);
        hole = { left, top, width: Math.min(stage.width - 2, Math.max(p.x, q.x) + 5) - left, height: Math.min(stage.height - 2, Math.max(p.y, q.y) + 5) - top };
      }
      setPlace({ hole, ...placeTipCard(hole, stage, { width: c.offsetWidth, height: c.offsetHeight }) });
    };
    measure();
    // (a panel that has just opened is still settling, and a phone can be turned)
    const again = window.setTimeout(measure, 240);
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (root.current) watch?.observe(root.current);
    return () => {
      window.clearTimeout(again);
      watch?.disconnect();
    };
  }, [key, target]);

  if (!plan || !step) return null;
  const last = plan.step === plan.steps.length - 1;
  const hole = place?.hole;
  return (
    <div className={`rb-tip${hole ? '' : ' is-plain'}`} ref={root} role="dialog" aria-modal="true" aria-labelledby="rb-tip-title">
      {hole && <div className="rb-tip-hole" style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} />}
      <div className="rb-tip-card" ref={card} style={place ? { left: place.left, top: place.top } : { visibility: 'hidden' }}>
        <span className="rb-tip-count">
          Hint {plan.step + 1} of {plan.steps.length}
        </span>
        <strong id="rb-tip-title">{step.title}</strong>
        <p>{step.text}</p>
        <div className="rb-tip-actions">
          <button className="rb-btn is-small is-ghost" onClick={() => engine.skipTips()}>
            Turn off hints
          </button>
          <button key={key} className="rb-btn is-small is-gold" onClick={() => engine.tipNext()} autoFocus>
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
