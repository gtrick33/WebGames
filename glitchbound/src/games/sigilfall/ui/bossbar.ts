import type { BossDef } from '../data/bosses';
import type { StatusId } from '../data/types';
import type { Enemy } from '../sim/types';
import type { World } from '../sim/world';

/**
 * What the boss's bar says beyond its health (ui/GameScreen.tsx BossBar): where its phases turn, what it is winding up,
 * and what state it is in, each worked out here from the world so it can be held to a test.
 */

/** Where along the health bar each later phase begins, as shares from the left (a boss turns as its health falls to them). */
export function phaseTicks(def: Pick<BossDef, 'phases'>): number[] {
  return def.phases.map((p) => p.at).filter((at) => at > 0 && at < 1);
}

/** A wind-up worth a bar of its own: this long or longer. */
export const CAST_FROM = 1;

/**
 * The blow the boss is winding up, if it takes a second or more: how far along it is (0 to 1) and how long is left.
 * Of several at once, the one that lands first. Marks that aren't attacks (a safe place, a warning) don't count.
 */
export function windingUp(w: Pick<World, 'telegraphs'>): { k: number; left: number } | null {
  let best: { k: number; left: number } | null = null;
  for (const t of w.telegraphs) {
    if (t.dead || t.tone === 'player' || (t.kind ?? 'danger') !== 'danger' || t.dur < CAST_FROM || t.t >= t.dur) continue;
    const left = t.dur - t.t;
    if (!best || left < best.left) best = { k: t.t / t.dur, left };
  }
  return best;
}

const STATUS_SAY: Record<StatusId, string> = {
  burn: 'Burning',
  poison: 'Poisoned',
  chill: 'Chilled',
  freeze: 'Frozen',
  shock: 'Shocked',
  stun: 'Stunned',
  root: 'Rooted',
  armorBreak: 'Armor broken',
  mark: 'Marked',
  weaken: 'Weakened',
  bleed: 'Bleeding',
  curse: 'Cursed',
  fear: 'Afraid',
};

export interface Pip {
  id: string;
  label: string;
  /** `good` for the hero (the boss is hindered), `bad` (it is protected), `plain`. */
  tone: 'good' | 'bad' | 'plain';
}

/** The boss's state in words: which phase of how many, a ward on it, dazed, and what afflicts it. */
export function bossPips(e: Enemy): Pip[] {
  const out: Pip[] = [];
  const b = e.boss;
  if (b && b.def.phases.length > 1) out.push({ id: 'phase', label: `Phase ${b.phase + 1} of ${b.def.phases.length}`, tone: 'plain' });
  if (e.shield > 0) out.push({ id: 'ward', label: 'Warded', tone: 'bad' });
  if (b && b.dazed > 0) out.push({ id: 'dazed', label: 'Dazed', tone: 'good' });
  const seen = new Set<string>();
  for (const s of e.statuses) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, label: STATUS_SAY[s.id], tone: 'good' });
  }
  return out;
}

/**
 * A callout cut to what its slot holds: a mechanic's name (written in capitals) to six words. What a boss says aloud is
 * a sentence, and is left whole: half a sentence reads worse than a long one.
 */
export function sixWords(text: string): string {
  const said = text.trim();
  const words = said.split(/\s+/);
  if (words.length <= 6 || said !== said.toUpperCase()) return said;
  return `${words.slice(0, 6).join(' ')}…`;
}
