/**
 * The Ring: when an ability's button is greyed, and where a placed one goes when it is sent without being placed by
 * hand. Kept apart from the screen (RingMatch.tsx) so both can be tried on a bare match.
 */
import type { Ability } from '../arena/abilities';
import type { Fighter, Match } from '../arena/sim';

/** Why an ability can't go right now, if that's something to show on its button. */
export function isOut(m: Match, me: Fighter | null, ab: Ability): boolean {
  if (!me || m.phase !== 'fight') return false;
  // (a placed ability is put down by hand, wherever its user can see: where the enemy it would otherwise go on is
  // standing has nothing to do with whether it can be used. Its button went grey whenever the target stepped out of
  // sight, which the owner called out: "targeted spells ... should be available to cast regardless of where the
  // targeted enemy is". So it is asked as a placing, at the user's own feet, which only its readiness can refuse.)
  const why = m.blocked(me, ab, undefined, ab.aim === 'ground' ? { x: me.x, y: me.y } : undefined);
  return why === 'Out of sight' || why === 'Too far away' || why === 'Silenced' || (why?.endsWith('is locked') ?? false) || why === 'You can’t do that now' || why === 'Nobody to aim at';
}

/**
 * Where a placed ability goes when it is simply sent (a tap, its key with no pointer on the ground): `undefined`
 * for on the target, when it can go there; with the target out of sight or out of reach, as far toward them as it
 * reaches and can be seen; with nobody to aim at, at its user's feet. It is never refused for want of a target.
 */
export function autoPoint(m: Match, me: Fighter | null, ab: Ability | undefined): { x: number; y: number } | undefined {
  if (!me || !ab || ab.aim !== 'ground') return undefined;
  const t = m.aimOf(me, ab);
  if (t && !t.dead && !m.blocked(me, ab, t)) return undefined;
  if (!t || t.dead) return { x: me.x, y: me.y };
  const to = m.reach(me, ab, t);
  for (let k = 1; k > 0.05; k -= 0.1) {
    const p = { x: me.x + (to.x - me.x) * k, y: me.y + (to.y - me.y) * k };
    if (m.sees(me, { x: p.x, y: p.y + 4 })) return p;
  }
  return { x: me.x, y: me.y };
}

const HELD_WORD: Record<string, string> = { stun: 'stunned', fear: 'feared', incap: 'dazed' };

/**
 * A refusal in plain words, for a newcomer (the rules say it shortly: arena/sim.ts blocked): what holds them and how
 * to get free, how near to go, what is in the way.
 */
export function plainWhy(m: Match, me: Fighter | null, why: string, ab: Ability | undefined): string {
  if (why === 'You can’t do that now' && me) {
    const hold = m.held(me);
    const word = hold?.cc ? HELD_WORD[hold.cc] : undefined;
    return `${word ? `You’re ${word}` : 'You’re held'} and can’t act yet`;
  }
  if (why === 'Too far away') return ab && ab.range > 0 && ab.range <= 40 ? 'Too far: walk up to them' : 'Too far: get closer';
  if (why === 'Out of sight') return 'Out of sight: a pillar is in the way';
  return why;
}
