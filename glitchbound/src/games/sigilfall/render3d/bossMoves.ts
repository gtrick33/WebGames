/**
 * The move a boss makes for an attack when nobody has chosen one for it.
 *
 * A boss that has been through the pass names its move for each pattern itself (render3d/bossKit.ts `moves`, or
 * render3d/kits.ts `moves` for one drawn with a shared creature). Every other boss used to make the one attack of its
 * kit for everything the rules had it do: a sweep, a throw, a roar and a call for help were the same swing. Here each
 * pattern is read for the kind of thing it is, and given the first clip of that kind the boss's own skeleton has, so
 * that a roar is not a sword stroke on any boss, whoever it is (the owner, 2026-11-24: "check all the act 1 bosses
 * whether theyre not just floating and have actual animations please, animate them if they lack them and keep that in
 * mind for any future boss").
 */

export interface DefaultMove {
  clip: string;
  rate?: number;
}

type Kind = 'sweep' | 'down' | 'rush' | 'throw' | 'call' | 'roar' | 'gone' | 'guard' | 'pour' | 'spell';

/**
 * What a skeleton might have for each kind of move, best first. The people's skeleton has nearly all of these; the
 * great ones' has a handful; a beast's own has what was made for it (scripts/sigilfall-3d-assets.mjs).
 */
const CLIPS: Record<Kind, readonly string[]> = {
  sweep: ['slice', 'sweep', 'spin', 'chop', 'chop2', 'smash'],
  down: ['chop2', 'slam', 'smash', 'spin', 'chop'],
  rush: ['bash', 'leap', 'stab', 'punch', 'kick', 'chop'],
  throw: ['throw', 'spit', 'punch', 'cast', 'chop'],
  call: ['summon', 'low', 'taunt', 'cheer', 'roar', 'cast', 'smash'],
  roar: ['taunt', 'roar', 'cheer', 'low', 'punch', 'smash'],
  gone: ['dodge', 'dig', 'rear', 'jump', 'spawn', 'spin'],
  guard: ['block', 'tuck', 'cheer', 'taunt', 'rear', 'cast'],
  pour: ['channel', 'breath', 'rear', 'cast', 'smash'],
  spell: ['cast', 'channel', 'summon', 'rear', 'spit', 'cheer', 'smash'],
};

/** The patterns every dungeon shares (sim/boss.ts), by name. */
const NAMED: Record<string, Kind> = {
  cleave: 'sweep',
  chop: 'down',
  slam: 'down',
  slamRings: 'down',
  stomp: 'down',
  charge: 'rush',
  tripleCharge: 'rush',
  gore: 'rush',
  volley: 'throw',
  hook: 'throw',
  barrage: 'throw',
  kegs: 'throw',
  spearFan: 'throw',
  summon: 'call',
  roar: 'roar',
  vanish: 'gone',
  teleport: 'gone',
  tide: 'pour',
  collapse: 'pour',
  soulVolley: 'throw',
  graveGrasp: 'pour',
  riftSpiral: 'pour',
  riftBeams: 'spell',
  riftNova: 'call',
};

/** A dungeon's own patterns (sim/patterns/*.ts), read by what they are called: the first that fits. */
const WORDS: readonly (readonly [RegExp, Kind])[] = [
  [/charge|ram$|scuttle|steed|drag|taut/, 'rush'],
  [/whirl|sweep|flail|harvest|pincers|pendulum|halves|blades|chains|tear$|sunder/, 'sweep'],
  [/quake|shatter|topple|crumble|slag|shed|eruption|fissure|taproot|trapdoors|sinkhole|doom|toll|pin$|cage/, 'down'],
  [/boulder|arrows|volley|quills|hurl|boomerang|scatter|pitch|torch|bile|lances|icicles|hook|spot|seekers|bouncers|meteors|rain|mines|kiss/, 'throw'],
  [/squad|fallen|ghouls|pods|scarabs|court|call|twins|hostages|orders|banner|leeches|coffins|candles|echoes|likeness|remembered|rise|garden|feast/, 'call'],
  [/warcry|dirge|bellows|roar|howl|dark$/, 'roar'],
  [/blink|dismount|burrow|flight|unmoor|molt|split|vanish/, 'gone'],
  [/shell|harden|guard|oath|bound|aura|vigil|core|crown|swell|forge$|shackles|settle|ledger/, 'guard'],
  [/breath|pour|flood|storm|miasma|drain|beam|inferno|froth|sluices|gust|frost|rime|pyre|lake|spores|wither|briar|quicksand|hourglass|gravity|prism|hollowing|summer|undertow|wall|tether|grief/, 'pour'],
];

/** The kind of move a pattern is. */
export function moveKind(pattern: string): Kind {
  const named = NAMED[pattern];
  if (named) return named;
  const word = pattern.slice(pattern.indexOf(':') + 1);
  for (const [re, kind] of WORDS) if (re.test(word)) return kind;
  return 'spell';
}

/** Clips that are standing, going and being hurt: never a move. */
const PLAIN = new Set(['idle', 'walk', 'run', 'hit', 'die', 'dead']);

/**
 * The move for a pattern on a skeleton that has `has`. `usual` is the kit's own attack (render3d/kits.ts `atk`): a
 * boss's plain blows (a sweep, a blow down) stay that, so a hammer-bearer still swings as one; everything else is the
 * first clip of its kind the skeleton has that is not that same swing, so that it reads as something else.
 */
export function defaultMove(pattern: string, has: (clip: string) => boolean, usual = 'chop'): DefaultMove | undefined {
  const kind = moveKind(pattern);
  const list = CLIPS[kind];
  // (two plain blows on one boss: the sweep keeps the usual swing, the blow down takes another if there is one)
  if (kind === 'sweep' && has(usual) && !PLAIN.has(usual) && usual !== 'cast') return { clip: usual };
  const other = list.find((c) => c !== usual && has(c));
  if (other) return { clip: other, rate: kind === 'rush' ? 1.2 : undefined };
  return has(usual) ? { clip: usual } : undefined;
}
