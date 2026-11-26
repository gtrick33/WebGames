import { ALL_SPELLS, UNLOCK_HOLD, VIGIL_MAPS } from './kit';
import { EVENT_KINDS, EVENTS, type EventKind } from './night';

/**
 * The Vigil's deeds: things to have done, each paid once in motes, so there is always a next night worth keeping.
 * A deed is done or not from what the device has kept (vigil/bests.ts, vigil/returns.ts); nothing here is stored.
 */

/** The classes in the order the lobby shows them, by name (kept here so this file needs none of the game's data). */
export const DEED_CLASSES: readonly [string, string][] = [
  ['warrior', 'Warrior'],
  ['mage', 'Mage'],
  ['ranger', 'Ranger'],
  ['paladin', 'Paladin'],
  ['priest', 'Priest'],
  ['warlock', 'Warlock'],
  ['druid', 'Druid'],
  ['gloamknight', 'Gloamknight'],
];

/** Everything a deed can be judged from. */
export interface DeedState {
  /** The longest night with each class, anywhere, and in each land, in seconds. */
  classBest: Record<string, number>;
  landBest: Record<string, number>;
  /** How many times each kind of event has been won, and every champion ever felled, by name. */
  won: Partial<Record<EventKind, number>>;
  felled: readonly string[];
  /** The spells that have evolved in some night. */
  codex: ReadonlySet<string>;
}

export interface Deed {
  id: string;
  group: 'class' | 'land' | 'event' | 'record';
  name: string;
  text: string;
  motes: number;
  /** How far along, and out of how many. */
  at: (s: DeedState) => [number, number];
}

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const EVOLUTIONS = ALL_SPELLS.filter((s) => !!s.evolve).length;
/** A deed of holding a while is shown in whole minutes held. */
const held = (best: number): [number, number] => [Math.min(UNLOCK_HOLD, Math.floor(best)), UNLOCK_HOLD];

export const DEEDS: Deed[] = [
  ...DEED_CLASSES.map(([cls, name]): Deed => ({ id: `class:${cls}`, group: 'class', name: `${name}’s Watch`, text: `Hold ${clock(UNLOCK_HOLD)} as the ${name}`, motes: 10, at: (s) => held(s.classBest[cls] ?? 0) })),
  ...VIGIL_MAPS.map((m): Deed => ({ id: `land:${m.id}`, group: 'land', name: `Bane of ${m.name}`, text: `Fell ${m.champions.map((c) => c.name).join(m.champions.length > 2 ? ', ' : ' and ')}`, motes: 8, at: (s) => [m.champions.filter((c) => s.felled.includes(c.name)).length, m.champions.length] })),
  { id: 'lands:all', group: 'land', name: 'Every Line Held', text: `Hold ${clock(UNLOCK_HOLD)} in every land`, motes: 30, at: (s) => [VIGIL_MAPS.filter((m) => (s.landBest[m.id] ?? 0) >= UNLOCK_HOLD).length, VIGIL_MAPS.length] },
  ...EVENT_KINDS.map((k): Deed => ({ id: `event:${k}`, group: 'event', name: EVENTS[k].name, text: k === 'pack' ? 'Break an Ashsworn pack' : k === 'lantern' ? 'Light a Dawn Lantern' : k === 'thief' ? 'Catch a Spark Thief' : k === 'gilded' ? 'Fell a Gilded Host' : k === 'wisps' ? 'Gather the Lost Lights' : k === 'hound' ? 'Fell the Bloodhound' : `Come through ${EVENTS[k].name} on your feet`, motes: 4, at: (s) => [Math.min(1, s.won[k] ?? 0), 1] })),
  { id: 'events:all', group: 'event', name: 'Nothing New Under the Moon', text: 'Win every kind of event three times', motes: 15, at: (s) => [EVENT_KINDS.reduce((a, k) => a + Math.min(3, s.won[k] ?? 0), 0), EVENT_KINDS.length * 3] },
  ...([5, 12, EVOLUTIONS] as const).map((n, i): Deed => ({ id: `codex:${i}`, group: 'record', name: ['Apprentice of the Codex', 'Keeper of the Codex', 'The Whole Codex'][i]!, text: n === EVOLUTIONS ? 'Find every evolution there is' : `Find ${n} evolutions`, motes: [10, 20, 40][i]!, at: (s) => [Math.min(n, s.codex.size), n] })),
];

export const deedDone = (d: Deed, s: DeedState): boolean => {
  const [at, of] = d.at(s);
  return at >= of;
};

/** The deeds done that haven't been paid yet. */
export const deedsDue = (s: DeedState, paid: readonly string[]): Deed[] => DEEDS.filter((d) => !paid.includes(d.id) && deedDone(d, s));

/** What is nearest done among those still open: a reason for the next night. */
export function nextDeeds(s: DeedState, paid: readonly string[], want = 3, prefer: readonly string[] = []): Deed[] {
  const open = DEEDS.filter((d) => !paid.includes(d.id) && !deedDone(d, s));
  const far = (d: Deed): number => {
    const [at, of] = d.at(s);
    return 1 - at / of - (prefer.includes(d.id) ? 1 : 0);
  };
  return open.sort((a, b) => far(a) - far(b)).slice(0, want);
}

/** How far along a deed is, in words: a time for a deed of holding, a count for the rest. */
export function deedProgress(d: Deed, s: DeedState): string {
  const [at, of] = d.at(s);
  return of === UNLOCK_HOLD ? `${clock(at)} of ${clock(of)}` : `${at} of ${of}`;
}
