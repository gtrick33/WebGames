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

/** The combo the hero has going, for the HUD's chip: its name, its stacks or casts, and how much of its time is left. */
export function comboNow(w: World): { name: string; color: string; n: number; of: number; left: number } | null {
  for (const b of w.player.buffs) {
    if (!b.def.id.startsWith('combo-')) continue;
    const of = b.def.max ?? b.def.empower?.casts ?? 1;
    return { name: b.def.name, color: b.def.color, n: b.n ?? 1, of, left: Math.max(0, Math.min(1, b.t / Math.max(0.01, b.def.dur))) };
  }
  return null;
}
