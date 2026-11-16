import { empowerFull, empowerOf } from '../sim/combat';
import type { World } from '../sim/world';

/**
 * A skill's button while a combo waits on it (data/types.ts Empower): lit, so the next thing to press is the thing
 * that shines, on a phone as on a keyboard. A combo still building shows its count and a fainter light; a whole one
 * pulses. Called every frame from the bar's own frame hook: it only touches the element when something changed.
 */
export function markCombo(b: HTMLElement, w: World, skill: string): void {
  const e = empowerOf(w, skill);
  const state = !e ? '' : empowerFull(e) ? 'full' : 'building';
  if (b.dataset.combo !== state) {
    if (state) b.dataset.combo = state;
    else delete b.dataset.combo;
    if (e) b.style.setProperty('--combo', e.def.color);
  }
  const n = e && e.def.max ? String(e.n) : e && (e.def.empower?.casts ?? 1) > 1 ? String(e.n) : '';
  if ((b.dataset.comboN ?? '') !== n) {
    if (n) b.dataset.comboN = n;
    else delete b.dataset.comboN;
  }
}

/** A proc the hero has waiting: a specialization's combo, or any other buff that makes a coming cast more than it is. */
export interface ProcNow {
  id: string;
  name: string;
  color: string;
  /** Its stacks, or the casts it has left. */
  n: number;
  /** The stacks it needs, or the casts it gave (1 for a single empowered cast). */
  of: number;
  /** Whole: ready to spend (a stacking one at its top, any other at once). */
  full: boolean;
  /** It builds in stacks (rather than giving a number of casts). */
  stacks: boolean;
  /** How much of its time is left, 0 to 1. */
  left: number;
  /** Seconds left. */
  secs: number;
}

/**
 * What the hero has waiting, for the glow around them (ui/GameScreen.tsx ProcAura): every combo and every buff that
 * empowers a coming cast (a talent's instant Flame Pillar, a Rift piece's free Multishot), whole ones first.
 */
export function procsNow(w: World): ProcNow[] {
  const out: ProcNow[] = [];
  for (const b of w.player.buffs) {
    if (!b.def.empower && !b.def.id.startsWith('combo-')) continue;
    const of = b.def.max ?? b.def.empower?.casts ?? 1;
    const n = b.n ?? 1;
    out.push({ id: b.def.id, name: b.def.name, color: b.def.color, n, of, full: !b.def.max || n >= b.def.max, stacks: !!b.def.max, left: Math.max(0, Math.min(1, b.t / Math.max(0.01, b.def.dur))), secs: b.t });
  }
  return out.sort((a, b) => Number(b.full) - Number(a.full) || b.left - a.left);
}
