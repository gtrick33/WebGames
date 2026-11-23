import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { SigilEngine } from '../engine';
import { useHudBox } from './hudBoxes';
import { placeLesson, usePlaced } from './layout';

/** What a lesson over a button keeps clear of: the rest of the HUD (on touch, the other buttons too). */
const AROUND = ['prompt', 'cast', 'wave', 'toasts', 'quest', 'map', 'menu', 'hero', 'boss', 'bar', 'mount', 'call'] as const;

/** The buttons a lesson on a phone must not lie across (the one it teaches too: it points at it, it doesn't cover it). */
// (an empty ring, a skill not learned yet, is no button: the lesson may lie over it, as it must over the first skill's)
const buttonsNear = (el: HTMLElement): HTMLElement[] => [...(el.closest('.rb-ui')?.querySelectorAll<HTMLElement>('.rb-cluster .rb-sb:not(.is-empty), .rb-potion-dock .rb-sb, .rb-interact') ?? [])];

/**
 * Over the button it teaches, wherever the cluster has that button now: its arrow (36px in from its right) over the
 * button's middle, its foot just above the button. The CSS offsets it had were a layout of the buttons long gone (the
 * owner, 2026-11-22: "tutorial hints are behind the ui and point to the old ui placings"). The potion's stands apart.
 */
function anchor(el: HTMLElement, slot: string | undefined): void {
  const box = el.parentElement;
  const btn = slot && slot !== 'potion' ? box?.querySelector<HTMLElement>(`.rb-sb-${slot}`) : null;
  if (!box || !btn) return;
  el.style.left = 'auto';
  const mid = btn.offsetLeft + btn.offsetWidth / 2;
  el.style.right = `${Math.round(box.clientWidth - mid - 36)}px`;
  el.style.bottom = `${Math.round(box.clientHeight - btn.offsetTop + 10)}px`;
}

/**
 * A control being taught (the Prologue's first fight), over the button it teaches: as wide as its words need (a lesson
 * over the dodge key at the bar's end was squeezed into a column a word wide), inside the picture, and off the other
 * buttons and the HUD (ui/layout.ts placeLesson; POLISH_PLAN.md piece 2). Its arrow stays over the button.
 */
export function Lesson({ engine, className, style, children }: { engine: SigilEngine; className: string; style?: CSSProperties; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  useHudBox(engine, 'teach', el);
  usePlaced(
    engine,
    el,
    (node) => {
      if (engine.touchMode) anchor(node, engine.ui.teach?.slot);
      placeLesson(engine, node, AROUND, engine.touchMode ? buttonsNear(node) : []);
    },
    engine.ui.teach?.slot,
  );
  return (
    <div ref={el} className={className} style={style} role="status">
      {children}
    </div>
  );
}
