import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { SigilEngine } from '../engine';
import { useHudBox } from './hudBoxes';
import { placeLesson, usePlaced } from './layout';

/** What a lesson over a button keeps clear of: the rest of the HUD (on touch, the other buttons too). */
const AROUND = ['prompt', 'cast', 'wave', 'toasts', 'quest', 'map', 'menu', 'hero', 'boss', 'bar', 'mount', 'call'] as const;

/** The buttons a lesson on a phone must not lie across (the one it teaches too: it points at it, it doesn't cover it). */
const buttonsNear = (el: HTMLElement): HTMLElement[] => [...(el.closest('.rb-ui')?.querySelectorAll<HTMLElement>('.rb-cluster .rb-sb, .rb-potion-dock .rb-sb, .rb-interact') ?? [])];

/**
 * A control being taught (the Prologue's first fight), over the button it teaches: as wide as its words need (a lesson
 * over the dodge key at the bar's end was squeezed into a column a word wide), inside the picture, and off the other
 * buttons and the HUD (ui/layout.ts placeLesson; POLISH_PLAN.md piece 2). Its arrow stays over the button.
 */
export function Lesson({ engine, className, style, children }: { engine: SigilEngine; className: string; style?: CSSProperties; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  useHudBox(engine, 'teach', el);
  usePlaced(engine, el, (node) => placeLesson(engine, node, AROUND, engine.touchMode ? buttonsNear(node) : []), engine.ui.teach?.slot);
  return (
    <div ref={el} className={className} style={style} role="status">
      {children}
    </div>
  );
}
