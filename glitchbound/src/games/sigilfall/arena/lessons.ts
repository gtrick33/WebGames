import { ABILITIES, barCombos } from './abilities';
import { DAMP_FROM, RANGED, type Fighter, type Match, type MatchEvent } from './sim';

/**
 * What a newcomer is taught by the Ring itself, outside the tutorial (arena/tutorial.ts): a hint the first time
 * something happens in a match (a red circle under them, a lit ability, a full super, the sigil,
 * healing beginning to fade), and
 * after a lost match one thing to try next time, worked out from how the match went. The owner, 2026-11-14: "i wanna
 * make this game mode accessible for every type of player".
 */

/** The keys (or buttons) a hint names: a keyboard's, or a phone's buttons. */
export interface HintKeys {
  touch: boolean;
  /** The ready key (its action is still called `dash`, so saved keys keep working), and the super's (as they read: "Space", "Q"). */
  dash: string;
  super: string;
}

const superWord = (k: HintKeys): string => (k.touch ? 'tap the gold button' : `press ${k.super}`);

export type HintId = 'circle' | 'combo' | 'super' | 'sigil' | 'damp';

export const HINT_IDS: readonly HintId[] = ['circle', 'combo', 'super', 'sigil', 'damp'];

/** Is `f` standing under one of the other side's circles? */
export const underCircle = (m: Match, f: Fighter): boolean => m.zones.some((z) => z.team !== f.team && Math.hypot(f.x - z.x, f.y - z.y) <= z.r);

/**
 * The first thing in this match a player hasn't been told about yet, in the order it matters most, or null. Only in
 * the fight, and only while they stand.
 */
export function hintNow(m: Match, me: Fighter | null, seen: readonly string[], keys: HintKeys): { id: HintId; text: string } | null {
  if (!me || me.dead || m.phase !== 'fight') return null;
  const fresh = (id: HintId): boolean => !seen.includes(id);
  if (fresh('circle') && underCircle(m, me)) return { id: 'circle', text: 'A red circle is under you: an attack is about to land there. Walk out of it before it lands.' };
  if (fresh('combo')) {
    const ready = [...me.bar.map((id) => ABILITIES[id]), ...m.extras(me)].find((ab) => ab && ab.aim !== 'near' && (!ab.super || me.charge >= 1) && m.lit(me, ab, m.aimOf(me, ab)));
    if (ready) return { id: 'combo', text: `${ready.name} is glowing: it lands its combo right now and does much more. Use it!` };
  }
  if (fresh('super') && me.charge >= 1) return { id: 'super', text: `Your super is full. ${superWord(keys)[0]!.toUpperCase()}${superWord(keys).slice(1)} to unleash it.` };
  if (fresh('sigil') && m.sigil) return { id: 'sigil', text: 'A sigil rose in the middle. Grab it: it heals you, fills your super and speeds you up.' };
  if (fresh('damp') && m.clock >= DAMP_FROM + 1) return { id: 'damp', text: 'From here on, healing gets weaker every second until none is left. Finish the fight.' };
  return null;
}

/** How a match went for one player, kept by the match screen as it goes (RingMatch). */
export interface MatchLog {
  /** Seconds of the fight they stood. */
  fought: number;
  /** Seconds they could have acted but stood too far from every enemy to reach them. */
  outOfReach: number;
  /** The other side's circles that landed on them while they were free to walk out. */
  circlesTaken: number;
  /** Seconds their super sat full. */
  superIdle: number;
  /** Abilities refused because a pillar stood in the way. */
  outOfSight: number;
}

export const newLog = (): MatchLog => ({ fought: 0, outOfReach: 0, circlesTaken: 0, superIdle: 0, outOfSight: 0 });

/** How near a fighter has to be to an enemy to fight them: arm's length for a class that closes in, a long shot for the rest. */
export const reachOf = (f: Fighter): number => (RANGED.has(f.cls) ? 195 : 70);

/** A circle's name, as the log keeps them while they fall (the event of its landing carries no side). */
const circleKey = (ab: string, x: number, y: number): string => `${ab}@${Math.round(x)},${Math.round(y)}`;

/**
 * Keeps a match's log: called each frame with the time that passed (in the match's own seconds) and the events not yet
 * read, before they are taken away. `enemyCircles` is the log's own memory of the other side's circles while they fall:
 * whether, the last frame before each lands, its target stood in it free to move (what it does as it lands, a stun,
 * is no excuse).
 */
export function keepLog(log: MatchLog, m: Match, me: Fighter | null, h: number, enemyCircles: Map<string, boolean>, events: readonly MatchEvent[] = m.events): void {
  if (!me || m.phase !== 'fight') return;
  for (const e of events) {
    if (e.k !== 'zone') continue;
    const key = circleKey(e.ab, e.x, e.y);
    const could = enemyCircles.get(key);
    if (could === undefined) continue;
    enemyCircles.delete(key);
    if (could && !me.dead && Math.hypot(me.x - e.x, me.y - e.y) <= e.r) log.circlesTaken++;
  }
  const ready = !me.dead && !m.held(me) && !m.rooted(me);
  for (const z of m.zones) if (z.team !== me.team) enemyCircles.set(circleKey(z.ab, z.x, z.y), ready && Math.hypot(me.x - z.x, me.y - z.y) <= z.r);
  if (me.dead || !(h > 0)) return;
  log.fought += h;
  const near = Math.min(Infinity, ...m.enemiesOf(me).filter((o) => !o.pet && !m.unseen(o, me)).map((o) => Math.hypot(o.x - me.x, o.y - me.y)));
  if (Number.isFinite(near) && near > reachOf(me) && !m.held(me)) log.outOfReach += h;
  if (me.charge >= 1) log.superIdle += h;
}

/**
 * The one thing to try next time, after a match that wasn't won: the biggest slip the log shows, in plain words. Null
 * when nothing stands out.
 */
export function lessonOf(log: MatchLog, me: Fighter, keys: HintKeys): string | null {
  const secs = (n: number): string => `${Math.round(n)} seconds`;
  if (log.circlesTaken >= 3) return `${log.circlesTaken} red circles landed on you. When a red circle appears under you, start walking out of it at once: the nearest edge is the quickest way out.`;
  if (log.outOfReach >= 10 && log.outOfReach >= log.fought * 0.3) {
    if (RANGED.has(me.cls)) return `You spent ${secs(log.outOfReach)} too far away for your spells. Stay within reach of your target.`;
    const rush = me.bar.map((id) => ABILITIES[id]).find((ab) => ab?.effects.some((e) => e.k === 'charge' || e.k === 'behind' || e.k === 'pull'));
    return `You spent ${secs(log.outOfReach)} too far away to hit. Your class fights up close: walk right up to your target${rush ? `, or use ${rush.name} to close the gap` : ''}.`;
  }
  if (log.superIdle >= 8) return `Your super sat full for ${secs(log.superIdle)}. ${superWord(keys)[0]!.toUpperCase()}${superWord(keys).slice(1)} as soon as it’s ready: it fills again as you fight.`;
  if ((me.score.combos ?? 0) === 0) {
    const c = barCombos(me.cls, me.bar, me.ult)[0];
    if (c) return `You didn’t land a combo. Use ${c.from.name}, then ${c.to.name}, for ${c.name}: it does much more.`;
  }
  if (log.outOfSight >= 3) return `${log.outOfSight} of your abilities were stopped by a pillar in the way. Step out where you can see your target.`;
  if ((me.score.supers ?? 0) === 0 && log.fought >= 30) return `You didn’t use your super. It fills as you fight: ${superWord(keys)} when it’s full.`;
  return null;
}
