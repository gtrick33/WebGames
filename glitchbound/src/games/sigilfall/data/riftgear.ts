import type { ClassId, Effect, ItemDef, ItemIcon, Material, Mod, ProcDef, SkillOp, SlotId, StatKey } from './types';

/**
 * Rift-forged gear: what the endgame is climbed for (the owner, 2026-11-22: "every spec should have 1 set per spec and 1
 * set thats general ... with perks for 2 set 4 and 6 set where the 6set is the strongest", "implement the sets so that
 * they have interactive combos ... auto shooting a spell ... make them super fun, insane and worth farming", "legendary
 * items should be general buffs for the class or for the playthrough at all").
 *
 * Everything here comes only out of the Rift: a run's drops and its cache, the Riftbroker's wagers, and one piece for
 * every new stone a hero opens (sim/world.ts finishKeyRun). Three kinds:
 *
 * - Sets, in their own green (rarity `set`): for every class, one for the class (any specialization) and one for each
 *   of its three specializations. Six pieces each, on the same six places (head, chest, legs, hands, feet and a ring),
 *   so a hero wears one whole set, or four of one and two of another. Two pieces worn change a skill a little; four
 *   make two of the hero's skills play off each other; six multiply the set's own skill several times over and set an
 *   echo of it loose, a copy of the hero's spell cast at the nearest foe by itself (data/types.ts Effect 'cast').
 *   The rules of a set at 2, 4 and 6, and of an echo, are the genre's (as in Diablo III); every name and word is ours.
 * - Legendaries, in orange: a power for the whole of a class's play, whatever the specialization, on the places a set
 *   leaves free (weapon, off-hand, amulet, relic); and a few for any class at all.
 *
 * Which stone opens what is `RIFT_TIERS`, and the Rift guide in the game reads it from here.
 */

export interface SetBonus {
  /** Pieces worn for it to count. */
  need: number;
  /** The whole of it in plain words (the mods below are what it does). */
  text: string;
  mods: Mod[];
}

export interface SetDef {
  id: string;
  name: string;
  cls: ClassId;
  /** A specialization's set (its index), or the class's own (none). */
  spec?: 0 | 1 | 2;
  /** Item ids, in the order they are listed on a piece. */
  pieces: string[];
  bonuses: SetBonus[];
}

/** The stone a hero must have opened for each kind to come out of the Rift. */
export const RIFT_TIERS = { classSet: 1, legendary: 1, specSet: 3, classLegendary: 2 } as const;

const K = (skill: string, op: SkillOp): Mod => ({ t: 'skill', skill, op });
const S = (stat: StatKey, v: number): Mod => ({ t: 'stat', stat, v });
const P = (id: string, on: ProcDef['on'], effect: Effect, text: string, o: Partial<Pick<ProcDef, 'chance' | 'icd' | 'skill' | 'status' | 'dmgType'>> = {}): Mod => ({
  t: 'proc',
  proc: { id: `rift-${id}`, on, chance: o.chance ?? 1, icd: o.icd ?? 0, effect, text, ...(o.skill ? { skill: o.skill } : {}), ...(o.status ? { status: o.status } : {}), ...(o.dmgType ? { dmgType: o.dmgType } : {}) },
});
/** An echo of one of the hero's skills (data/types.ts Effect 'cast'). */
const ECHO = (skill: string, mul: number, times = 1): Effect => ({ kind: 'cast', skill, mul, ...(times > 1 ? { times, gap: 0.3 } : {}) });
/** By itself, every `every` seconds in a fight: an echo of a skill. */
const EVERY = (id: string, every: number, skill: string, mul: number, text: string): Mod => P(id, 'tick', ECHO(skill, mul), text, { icd: every });

const WEAR: Record<ClassId, Material> = { warrior: 'plate', paladin: 'plate', gloamknight: 'plate', ranger: 'leather', druid: 'leather', mage: 'cloth', priest: 'cloth', warlock: 'cloth' };

/** The six places a set is worn, in the order its pieces are listed. */
const SET_SLOTS = ['head', 'chest', 'legs', 'hands', 'feet', 'ring'] as const;
type SetSlot = (typeof SET_SLOTS)[number];

/** What each piece of a set is called and looks like, by what it is made of. */
const NOUN: Record<Material, Record<SetSlot, string>> = {
  plate: { head: 'Helm', chest: 'Breastplate', legs: 'Greaves', hands: 'Gauntlets', feet: 'Sabatons', ring: 'Signet' },
  mail: { head: 'Coif', chest: 'Hauberk', legs: 'Chausses', hands: 'Gauntlets', feet: 'Boots', ring: 'Signet' },
  leather: { head: 'Hood', chest: 'Jerkin', legs: 'Breeches', hands: 'Grips', feet: 'Boots', ring: 'Loop' },
  cloth: { head: 'Cowl', chest: 'Robes', legs: 'Leggings', hands: 'Wraps', feet: 'Slippers', ring: 'Band' },
  gold: { head: 'Circlet', chest: 'Vestment', legs: 'Leggings', hands: 'Gloves', feet: 'Shoes', ring: 'Band' },
};
const ICON: Record<Material, Record<SetSlot, ItemIcon>> = {
  plate: { head: 'helm', chest: 'plate', legs: 'legs', hands: 'gloves', feet: 'boots', ring: 'ring' },
  mail: { head: 'helm', chest: 'plate', legs: 'legs', hands: 'gloves', feet: 'boots', ring: 'ring' },
  leather: { head: 'hood', chest: 'jerkin', legs: 'legs', hands: 'gloves', feet: 'boots', ring: 'ring' },
  cloth: { head: 'hood', chest: 'robe', legs: 'legs', hands: 'gloves', feet: 'boots', ring: 'ring' },
  gold: { head: 'crown', chest: 'robe', legs: 'legs', hands: 'gloves', feet: 'boots', ring: 'ring' },
};
/** A set piece's stats, by its place (on top of what the set does). */
const SET_STATS: Record<SetSlot, ItemDef['stats']> = {
  head: [{ stat: 'hp', base: 12, per: 3.2 }, { stat: 'crit', base: 1, per: 0.12 }],
  chest: [{ stat: 'hp', base: 16, per: 3.8 }, { stat: 'armor', base: 4, per: 1.1 }],
  legs: [{ stat: 'hp', base: 14, per: 3.4 }, { stat: 'armor', base: 4, per: 1.1 }],
  hands: [{ stat: 'power', base: 4, per: 1 }, { stat: 'critDmg', base: 6, per: 0.5 }],
  feet: [{ stat: 'hp', base: 10, per: 3 }, { stat: 'power', base: 3, per: 0.7 }],
  ring: [{ stat: 'power', base: 4, per: 0.9 }, { stat: 'crit', base: 1, per: 0.12 }],
};

interface SetSpec {
  cls: ClassId;
  /** The specialization it is for; none: the class's own set, good for all three. */
  spec?: 0 | 1 | 2;
  id: string;
  name: string;
  tint: string;
  /** What its pieces are called: in full by place, or a word put before each place's own noun. */
  names: Partial<Record<SetSlot, string>> | string;
  /** A line for its pieces: by place, or one for all. */
  lore: Partial<Record<SetSlot, string>> | string;
  two: SetBonus;
  four: SetBonus;
  six: SetBonus;
}

/* ------------------------------------------------------------------ the class sets (any specialization) */

// (each class's three-piece set of before, grown to six: its pieces keep their names and what two and three worn gave
// is now two and four; six is new)
const CLASS_SETS: SetSpec[] = [
  {
    cls: 'warrior',
    id: 'stonehewer',
    name: 'Stonehewer’s Harness',
    tint: '#8a7a6a',
    names: { head: 'Stonehewer’s Visor', chest: 'Stonehewer’s Hauberk', legs: 'Stonehewer’s Tassets', hands: 'Stonehewer’s Fists', feet: 'Stonehewer’s Tread', ring: 'Stonehewer’s Knuckle' },
    lore: { head: 'There is a dent in it the shape of a mountain.', chest: 'It was quarried, not forged.', legs: 'Riveted by someone who expected to be hit a great deal.', hands: 'The knuckles are worn smooth. The stone they met is not.', feet: 'Wherever they stand, the floor gives first.', ring: 'A pebble, set in iron. It has never once been dropped.' },
    two: { need: 2, text: 'Cleave opens wounds: every enemy it hits Bleeds for 30% of the hit a second, for 4 s.', mods: [K('cleave', { op: 'onHit', effect: { kind: 'status', status: 'bleed', dur: 4, power: 0.3 } })] },
    four: {
      need: 4,
      text: 'Heavy Strike holds a second charge, and every one sends a shockwave rolling forward for 60% of its damage.',
      mods: [K('heavy-strike', { op: 'charges', n: 1 }), K('heavy-strike', { op: 'onCast', effect: { kind: 'shockwave', length: 120, width: 24, mul: 0.6 } })],
    },
    six: {
      need: 6,
      text: 'Heavy Strike deals 250% more damage, and one Cleave hit in three brings it down again by itself: an echo of Heavy Strike at the nearest enemy.',
      mods: [K('heavy-strike', { op: 'damage', pct: 250 }), P('stonehewer-six', 'hit', ECHO('heavy-strike', 1), 'One Cleave hit in three: an echo of Heavy Strike at the nearest enemy (once a second).', { skill: 'cleave', chance: 0.34, icd: 1 })],
    },
  },
  {
    cls: 'mage',
    id: 'rimeglass',
    name: 'Rimeglass Regalia',
    tint: '#7ac8ff',
    names: { head: 'Rimeglass Circlet', chest: 'Rimeglass Mantle', legs: 'Rimeglass Skirts', hands: 'Rimeglass Wraps', feet: 'Rimeglass Slippers', ring: 'Rimeglass Band' },
    lore: { head: 'It frosts over when you think too hard.', chest: 'The hem is a little colder than the rest of the world.', legs: 'They ring, very faintly, when a spell goes through them.', hands: 'Spun from frost that was asked nicely not to melt.', feet: 'They leave no prints. The cold fills them in behind you.', ring: 'A drop of winter, kept on a finger.' },
    two: { need: 2, text: 'Arcane Bolt flies as three: two more bolts, fanned to either side.', mods: [K('arcane-bolt', { op: 'projectiles', n: 2, spread: 0.3 })] },
    four: {
      need: 4,
      text: 'Blink leaves a storm where you stood and where you land: Rime Burst is ready at once after every Blink, and costs nothing.',
      mods: [K('blink', { op: 'onCast', effect: { kind: 'buff', buff: { id: 'rift-rimeglass', name: 'Rimeglass', dur: 6, color: '#7ac8ff', empower: { skill: 'frost-nova', free: true, ready: true, pct: 40 } } } })],
    },
    six: {
      need: 6,
      text: 'Arcane Bolt deals 250% more damage, and a rime echo at your shoulder looses one by itself every 1.5 s in a fight.',
      mods: [K('arcane-bolt', { op: 'damage', pct: 250 }), EVERY('rimeglass-six', 1.5, 'arcane-bolt', 1, 'Every 1.5 s in a fight: an echo of Arcane Bolt at the nearest enemy.')],
    },
  },
  {
    cls: 'ranger',
    id: 'tidewatcher',
    name: 'Tidewatcher’s Leathers',
    tint: '#3a8a8a',
    names: { head: 'Tidewatcher’s Cowl', chest: 'Tidewatcher’s Coat', legs: 'Tidewatcher’s Breeches', hands: 'Tidewatcher’s Grips', feet: 'Tidewatcher’s Boots', ring: 'Tidewatcher’s Loop' },
    lore: { head: 'It smells of salt, years after the sea.', chest: 'Every pocket holds one more arrow than it should.', legs: 'Salt-stiff, and silent all the same.', hands: 'The string never bites through them. It has tried for years.', feet: 'They have stood in the tide and waited longer than the tide could.', ring: 'A whorl of shell. Hold it close and something is always coming in.' },
    two: { need: 2, text: 'Arrow passes through two more enemies.', mods: [K('arrow', { op: 'pierce', n: 2 })] },
    four: {
      need: 4,
      text: 'Every Tumble nocks a volley: your next Multishot is ready at once, costs nothing and hits 60% harder.',
      mods: [P('tidewatcher', 'dodge', { kind: 'buff', buff: { id: 'rift-tidewatcher', name: 'Nocked', dur: 5, color: '#3ad0c8', empower: { skill: 'multishot', free: true, ready: true, pct: 60 } } }, 'Every Tumble nocks a volley: your next Multishot is ready at once, costs nothing and hits 60% harder.')],
    },
    six: {
      need: 6,
      text: 'Multishot deals 250% more damage, and the tide looses one of its own every 3 s in a fight.',
      mods: [K('multishot', { op: 'damage', pct: 250 }), EVERY('tidewatcher-six', 3, 'multishot', 1, 'Every 3 s in a fight: an echo of Multishot at the nearest enemy.')],
    },
  },
  {
    cls: 'paladin',
    id: 'emberoath',
    name: 'Emberoath Plate',
    tint: '#e0a040',
    names: { head: 'Emberoath Helm', chest: 'Emberoath Breastplate', legs: 'Emberoath Cuisses', hands: 'Emberoath Gauntlets', feet: 'Emberoath Sabatons', ring: 'Emberoath Signet' },
    lore: { head: 'A coal glows behind the visor. Nobody put it there.', chest: 'Every plate is stamped with the same short vow.', legs: 'Hot where they bend, as if still at the forge.', hands: 'Warm to the touch, as a hand is after a promise.', feet: 'They have never once stepped back.', ring: 'Pressed into wax, it leaves a flame.' },
    two: { need: 2, text: 'Oath Strike gives one more Zeal.', mods: [K('crusader-strike', { op: 'gen', n: 1 })] },
    four: {
      need: 4,
      text: 'Radiant Sweep reaches 40% further and mends you for 3% of your health every time it is swung.',
      mods: [K('divine-storm', { op: 'area', pct: 40 }), K('divine-storm', { op: 'onCast', effect: { kind: 'heal', pct: 3 } })],
    },
    six: {
      need: 6,
      text: 'Radiant Sweep deals 250% more damage, and one Oath Strike hit in four swings it again by itself: an echo of Radiant Sweep.',
      mods: [K('divine-storm', { op: 'damage', pct: 250 }), P('emberoath-six', 'hit', ECHO('divine-storm', 1), 'One Oath Strike hit in four: an echo of Radiant Sweep (once a second).', { skill: 'crusader-strike', chance: 0.25, icd: 1 })],
    },
  },
  {
    cls: 'priest',
    id: 'sunchoir',
    name: 'Sunchoir Vestments',
    tint: '#ffe08a',
    names: { head: 'Sunchoir Diadem', chest: 'Sunchoir Stole', legs: 'Sunchoir Cassock', hands: 'Sunchoir Mitts', feet: 'Sunchoir Sandals', ring: 'Sunchoir Band' },
    lore: { head: 'It catches the morning first, wherever it is.', chest: 'Embroidered with a hymn in thread too fine to read.', legs: 'It was sung over for a year before anyone wore it.', hands: 'They have never been cold.', feet: 'The road is a little brighter behind them.', ring: 'It hums, a note below hearing.' },
    two: { need: 2, text: 'Smite leaps on to two more enemies.', mods: [K('smite', { op: 'bounce', n: 2 })] },
    four: {
      need: 4,
      text: 'Smite hits can call the next verse (one hit in five): your next Thought Lash is ready at once, costs nothing and hits 60% harder.',
      mods: [P('sunchoir', 'hit', { kind: 'buff', buff: { id: 'rift-sunchoir', name: 'Next Verse', dur: 8, color: '#ffe08a', empower: { skill: 'mind-blast', free: true, ready: true, pct: 60 } } }, 'Smite hits can call the next verse (one hit in five): your next Thought Lash is ready at once, costs nothing and hits 60% harder.', { skill: 'smite', chance: 0.2, icd: 2 })],
    },
    six: {
      need: 6,
      text: 'Thought Lash deals 250% more damage, and the choir sings it for you every 2.5 s in a fight.',
      mods: [K('mind-blast', { op: 'damage', pct: 250 }), EVERY('sunchoir-six', 2.5, 'mind-blast', 1, 'Every 2.5 s in a fight: an echo of Thought Lash at the nearest enemy.')],
    },
  },
  {
    cls: 'warlock',
    id: 'veilbound',
    name: 'Veilbound Raiment',
    tint: '#7a4ab0',
    names: { head: 'Veilbound Hood', chest: 'Veilbound Robes', legs: 'Veilbound Robeskirt', hands: 'Veilbound Wraps', feet: 'Veilbound Slippers', ring: 'Veilbound Band' },
    lore: { head: 'Something else looks out of it, now and then.', chest: 'Something signed the hem. It was not a tailor.', legs: 'The stitches move when nobody is looking at them.', hands: 'Cold, and they stay cold.', feet: 'They make no sound on stone, and less on bone.', ring: 'A promise, made small enough to wear.' },
    two: { need: 2, text: 'Shadow Bolt curses what it hits: 40% of the hit a second as shadow damage, for 4 s.', mods: [K('shadow-bolt', { op: 'onHit', effect: { kind: 'status', status: 'curse', dur: 4, power: 0.4 } })] },
    four: {
      need: 4,
      text: 'A Cursed enemy that dies gets up again as an imp and fights for you for 8 s (once every 3 s).',
      mods: [P('veilbound', 'kill', { kind: 'summon', pet: 'imp', count: 1, dur: 8 }, 'A Cursed enemy that dies gets up again as an imp and fights for you for 8 s (once every 3 s).', { status: 'curse', icd: 3 })],
    },
    six: {
      need: 6,
      text: 'Shadow Bolt deals 250% more damage, and every Cursed enemy that dies looses a volley of two Shadow Bolts at the next.',
      mods: [K('shadow-bolt', { op: 'damage', pct: 250 }), P('veilbound-six', 'kill', ECHO('shadow-bolt', 1, 2), 'A Cursed enemy that dies: two echoes of Shadow Bolt at the next (once every 0.5 s).', { status: 'curse', icd: 0.5 })],
    },
  },
  {
    cls: 'druid',
    id: 'thornwarden',
    name: 'Thornwarden’s Hide',
    tint: '#6a9a4a',
    names: { head: 'Thornwarden’s Antlers', chest: 'Thornwarden’s Barkhide', legs: 'Thornwarden’s Leggings', hands: 'Thornwarden’s Grips', feet: 'Thornwarden’s Treads', ring: 'Thornwarden’s Ring' },
    lore: { head: 'They grow a tine every spring.', chest: 'Bark on the outside, moss on the inside, and it fits whatever shape you are.', legs: 'The thorns grow back by morning.', hands: 'Something green comes up wherever they grip.', feet: 'Something green comes up in every print they leave.', ring: 'A ring of wood. The tree it came from is still growing.' },
    two: { need: 2, text: 'Your basic attack in any shape (Wrath, Claw, Maul) leaves thorns in the wound: Poison for 30% of the hit a second, for 4 s.', mods: [K('basic', { op: 'onHit', effect: { kind: 'status', status: 'poison', dur: 4, power: 0.3 } })] },
    four: {
      need: 4,
      text: 'Changing shape throws thorns: taking Lynx Shape or Bear Shape bursts around you for nature damage and mends 3% of your health.',
      mods: [
        K('cat-form', { op: 'onCast', effect: { kind: 'nova', radius: 56, mul: 1, dmgType: 'nature' } }),
        K('cat-form', { op: 'onCast', effect: { kind: 'heal', pct: 3 } }),
        K('bear-form', { op: 'onCast', effect: { kind: 'nova', radius: 56, mul: 1, dmgType: 'nature' } }),
        K('bear-form', { op: 'onCast', effect: { kind: 'heal', pct: 3 } }),
      ],
    },
    six: {
      need: 6,
      text: 'Your basic attack deals 200% more damage in every shape, and every 2 s in a fight the briars strike with it again by themselves.',
      mods: [K('basic', { op: 'damage', pct: 200 }), EVERY('thornwarden-six', 2, 'basic', 1, 'Every 2 s in a fight: an echo of your basic attack at the nearest enemy.')],
    },
  },
  {
    cls: 'gloamknight',
    id: 'lastwatch',
    name: 'Lastwatch Plate',
    tint: '#5a4a80',
    names: { head: 'Lastwatch Helm', chest: 'Lastwatch Cuirass', legs: 'Lastwatch Tassets', hands: 'Lastwatch Gauntlets', feet: 'Lastwatch Greaves', ring: 'Lastwatch Signet' },
    lore: { head: 'They held a gate once. They remember how.', chest: 'The same gray as the last light, whatever the hour.', legs: 'They held a gate once. They remember how.', hands: 'They never let go of anything they meant to keep.', feet: 'Planted, they do not move. That was the whole of the oath.', ring: 'The last watch, kept on a finger.' },
    two: { need: 2, text: 'Gloam Cleave gathers 3 more Umbra and sweeps a third wider.', mods: [K('gloam-cleave', { op: 'gen', n: 3 }), K('gloam-cleave', { op: 'arc', pct: 33 })] },
    four: {
      need: 4,
      text: 'Umbral Rend sends a wave of dusk rolling forward for 70% of its damage, and curses what it cuts for 5 s.',
      mods: [K('umbral-rend', { op: 'onCast', effect: { kind: 'shockwave', length: 120, width: 26, mul: 0.7 } }), K('umbral-rend', { op: 'onHit', effect: { kind: 'status', status: 'curse', dur: 5, power: 0.4 } })],
    },
    six: {
      need: 6,
      text: 'Umbral Rend deals 250% more damage, and one Gloam Cleave hit in four tears it open again by itself: an echo of Umbral Rend.',
      mods: [K('umbral-rend', { op: 'damage', pct: 250 }), P('lastwatch-six', 'hit', ECHO('umbral-rend', 1), 'One Gloam Cleave hit in four: an echo of Umbral Rend (once a second).', { skill: 'gloam-cleave', chance: 0.25, icd: 1 })],
    },
  },
];

/* ------------------------------------------------------------------ a set for every specialization */

const SPEC_SETS: SetSpec[] = [
  /* warrior */
  {
    cls: 'warrior',
    spec: 0,
    id: 'redmaw',
    name: 'The Redmaw',
    tint: '#c8323a',
    names: 'Redmaw',
    lore: 'Every plate of it has been red at one time or another.',
    two: { need: 2, text: 'Bloodthirst mends you for 2% of your health on every hit.', mods: [K('bloodthirst', { op: 'onHit', effect: { kind: 'heal', pct: 2 } })] },
    four: { need: 4, text: 'Bloodthirst sweeps a wide arc and holds a second charge.', mods: [K('bloodthirst', { op: 'arc', pct: 120 }), K('bloodthirst', { op: 'charges', n: 1 })] },
    six: {
      need: 6,
      text: 'Bloodthirst deals 300% more damage, and every kill bites again: an echo of Bloodthirst at the next enemy.',
      mods: [K('bloodthirst', { op: 'damage', pct: 300 }), P('redmaw-six', 'kill', ECHO('bloodthirst', 1), 'Every kill: an echo of Bloodthirst at the next enemy (once every 0.4 s).', { icd: 0.4 })],
    },
  },
  {
    cls: 'warrior',
    spec: 1,
    id: 'unbroken-line',
    name: 'The Unbroken Line',
    tint: '#8a94a8',
    names: 'Linewarden’s',
    lore: 'A whole company stood in it, one after another. None of them fell back.',
    two: { need: 2, text: 'Shield Bash holds a second charge.', mods: [K('shield-bash', { op: 'charges', n: 1 })] },
    four: {
      need: 4,
      text: 'Shield Wall bursts outward for 220% of its damage and draws every enemy near you onto you for 4 s.',
      mods: [K('shield-wall', { op: 'onCast', effect: { kind: 'nova', radius: 70, mul: 2.2 } }), K('shield-wall', { op: 'onCast', effect: { kind: 'taunt', radius: 90, dur: 4 } })],
    },
    six: {
      need: 6,
      text: 'Shield Bash deals 300% more damage, and every blow you take may bash back (one in three, once a second): an echo of Shield Bash at the nearest enemy.',
      mods: [K('shield-bash', { op: 'damage', pct: 300 }), P('unbroken-six', 'hurt', ECHO('shield-bash', 1), 'A blow taken, one in three: an echo of Shield Bash (once a second).', { chance: 0.34, icd: 1 })],
    },
  },
  {
    cls: 'warrior',
    spec: 2,
    id: 'last-duelist',
    name: 'The Last Duelist',
    tint: '#d8d0c0',
    names: 'Duelist’s',
    lore: 'Worn by the last one standing at every duel it was ever in.',
    two: { need: 2, text: 'Mortal Strike comes back a quarter sooner.', mods: [K('mortal-strike', { op: 'cooldown', pct: -25 })] },
    four: {
      need: 4,
      text: 'Mortal Strike sends a shockwave rolling forward for 80% of its damage and opens a wound that Bleeds for 40% of the hit a second.',
      mods: [K('mortal-strike', { op: 'onCast', effect: { kind: 'shockwave', length: 140, width: 26, mul: 0.8 } }), K('mortal-strike', { op: 'onHit', effect: { kind: 'status', status: 'bleed', dur: 6, power: 0.4 } })],
    },
    six: {
      need: 6,
      text: 'Mortal Strike deals 300% more damage, and a phantom blade strikes with it by itself every 3 s in a fight.',
      mods: [K('mortal-strike', { op: 'damage', pct: 300 }), EVERY('duelist-six', 3, 'mortal-strike', 1, 'Every 3 s in a fight: an echo of Mortal Strike at the nearest enemy.')],
    },
  },
  /* mage */
  {
    cls: 'mage',
    spec: 0,
    id: 'ninefold-pyre',
    name: 'The Ninefold Pyre',
    tint: '#ff6a2a',
    names: 'Pyrebinder’s',
    lore: 'It was nine fires once. They agreed to be one.',
    two: { need: 2, text: 'Fireball holds a second charge.', mods: [K('fireball', { op: 'charges', n: 1 })] },
    four: {
      need: 4,
      text: 'Flamestrike leaves the ground burning for 5 s and comes back 30% sooner.',
      mods: [K('flamestrike', { op: 'onImpact', effect: { kind: 'ground', ground: { radius: 46, dur: 5, tick: 0.5, mul: 0.14, dmgType: 'fire', look: 'fire', status: { status: 'burn', dur: 3, power: 0.2 } } } }), K('flamestrike', { op: 'cooldown', pct: -30 })],
    },
    six: {
      need: 6,
      text: 'Flamestrike deals 300% more damage, and one Fireball hit in three calls it down by itself: an echo of Flamestrike at the nearest enemy.',
      mods: [K('flamestrike', { op: 'damage', pct: 300 }), P('pyre-six', 'hit', ECHO('flamestrike', 1), 'One Fireball hit in three: an echo of Flamestrike (once every 1.5 s).', { skill: 'fireball', chance: 0.34, icd: 1.5 })],
    },
  },
  {
    cls: 'mage',
    spec: 1,
    id: 'thunderwake',
    name: 'Thunderwake',
    tint: '#6ad8ff',
    names: 'Thunderwake',
    lore: 'The air smells of rain around it, indoors, in a drought.',
    two: { need: 2, text: 'Chain Lightning leaps to three more enemies.', mods: [K('chain-lightning', { op: 'extra', key: 'jumps', n: 3, label: 'leaps' })] },
    four: {
      need: 4,
      text: 'Ball Lightning bursts where it ends for 120% of its damage, and holds a second charge.',
      mods: [K('ball-lightning', { op: 'onImpact', effect: { kind: 'explode', radius: 52, mul: 1.2, dmgType: 'lightning' } }), K('ball-lightning', { op: 'charges', n: 1 })],
    },
    six: {
      need: 6,
      text: 'Ball Lightning deals 300% more damage, and a storm overhead throws Chain Lightning by itself every 2 s in a fight.',
      mods: [K('ball-lightning', { op: 'damage', pct: 300 }), K('chain-lightning', { op: 'damage', pct: 100 }), EVERY('thunderwake-six', 2, 'chain-lightning', 1, 'Every 2 s in a fight: an echo of Chain Lightning at the nearest enemy.')],
    },
  },
  {
    cls: 'mage',
    spec: 2,
    id: 'long-winter',
    name: 'The Long Winter',
    tint: '#b8e8ff',
    names: 'Longwinter',
    lore: 'It has not been warm since the year it was made.',
    two: { need: 2, text: 'Ice Lance passes through three more enemies.', mods: [K('ice-lance', { op: 'pierce', n: 3 })] },
    four: {
      need: 4,
      text: 'Blizzard drags enemies to its middle and lasts half again as long; Ice Lance hits the Frozen 80% harder.',
      mods: [K('blizzard', { op: 'extra', key: 'pull', n: 55, label: 'pull' }), K('blizzard', { op: 'duration', pct: 50 }), K('ice-lance', { op: 'bonusVs', status: 'freeze', pct: 80 })],
    },
    six: {
      need: 6,
      text: 'Ice Lance deals 300% more damage, and every Blizzard you call sends three Ice Lances after it by themselves.',
      mods: [K('ice-lance', { op: 'damage', pct: 300 }), K('blizzard', { op: 'onCast', effect: ECHO('ice-lance', 1, 3) })],
    },
  },
  /* ranger */
  {
    cls: 'ranger',
    spec: 0,
    id: 'far-sight',
    name: 'The Far Sight',
    tint: '#d8c080',
    names: 'Farsight',
    lore: 'The arrow is already there. The leather only tells you where.',
    two: { need: 2, text: 'Aimed Shot reaches 40% further.', mods: [K('aimed-shot', { op: 'range', pct: 40 })] },
    four: {
      need: 4,
      text: 'Aimed Shot passes through six more enemies, bursting on each for 50% of its damage.',
      mods: [K('aimed-shot', { op: 'pierce', n: 6 }), K('aimed-shot', { op: 'onHit', effect: { kind: 'explode', radius: 34, mul: 0.5 } })],
    },
    six: {
      need: 6,
      text: 'Aimed Shot deals 300% more damage, and every critical hit may loose another (one in four, once every 1.5 s): an echo of Aimed Shot.',
      mods: [K('aimed-shot', { op: 'damage', pct: 300 }), P('farsight-six', 'crit', ECHO('aimed-shot', 1), 'A critical hit, one in four: an echo of Aimed Shot (once every 1.5 s).', { chance: 0.25, icd: 1.5 })],
    },
  },
  {
    cls: 'ranger',
    spec: 1,
    id: 'snareweave',
    name: 'Snareweave',
    tint: '#c8b89a',
    names: 'Snareweave',
    lore: 'Every seam is a knot that tightens when pulled.',
    two: { need: 2, text: 'Snapjaw Trap comes back 40% sooner.', mods: [K('bear-trap', { op: 'cooldown', pct: -40 })] },
    four: {
      need: 4,
      text: 'Two more traps can lie at once, and each bursts as it snaps for 110% of its damage, leaving a Bleed.',
      mods: [K('bear-trap', { op: 'extra', key: 'maxTraps', n: 2, label: 'traps at once' }), K('bear-trap', { op: 'onImpact', effect: { kind: 'explode', radius: 44, mul: 1.1, status: { status: 'bleed', dur: 4, power: 0.3 } } })],
    },
    six: {
      need: 6,
      text: 'Snapjaw Trap deals 300% more damage, and a hidden snare is thrown under the nearest enemy by itself every 2.5 s in a fight.',
      mods: [K('bear-trap', { op: 'damage', pct: 300 }), EVERY('snareweave-six', 2.5, 'bear-trap', 1, 'Every 2.5 s in a fight: an echo of Snapjaw Trap under the nearest enemy.')],
    },
  },
  {
    cls: 'ranger',
    spec: 2,
    id: 'pack-law',
    name: 'Pack Law',
    tint: '#e8e0d0',
    names: 'Packleader’s',
    lore: 'The pack does not follow it. The pack follows the one wearing it.',
    two: { need: 2, text: 'Your companions hit 25% harder.', mods: [S('pet', 25)] },
    four: {
      need: 4,
      text: 'Calling a wolf calls two more with it.',
      mods: [K('call-wolf', { op: 'onCast', effect: { kind: 'summon', pet: 'wolf', count: 2, dur: 0 } })],
    },
    six: {
      need: 6,
      text: 'Your companions hit 100% harder, and every kill calls another wolf to the hunt for 10 s (once every 2 s).',
      mods: [S('pet', 100), P('packlaw-six', 'kill', { kind: 'summon', pet: 'wolf', count: 1, dur: 10 }, 'Every kill: another wolf joins the hunt for 10 s (once every 2 s).', { icd: 2 })],
    },
  },
  /* paladin */
  {
    cls: 'paladin',
    spec: 0,
    id: 'morning-choir',
    name: 'The Morning Choir',
    tint: '#ffe9a0',
    names: 'Morningsong',
    lore: 'It rings once when it strikes, and somewhere a window lights.',
    two: { need: 2, text: 'Holy Shock holds a second charge.', mods: [K('holy-shock', { op: 'charges', n: 1 })] },
    four: {
      need: 4,
      text: 'Holy Shock leaps to three more enemies and mends you for 2% of your health each hit.',
      mods: [K('holy-shock', { op: 'bounce', n: 3 }), K('holy-shock', { op: 'onHit', effect: { kind: 'heal', pct: 2 } })],
    },
    six: {
      need: 6,
      text: 'Holy Shock deals 300% more damage, and the choir sings it for you every 2 s in a fight.',
      mods: [K('holy-shock', { op: 'damage', pct: 300 }), EVERY('choir-six', 2, 'holy-shock', 1, 'Every 2 s in a fight: an echo of Holy Shock at the nearest enemy.')],
    },
  },
  {
    cls: 'paladin',
    spec: 1,
    id: 'oathwall',
    name: 'The Oathwall',
    tint: '#e0b040',
    names: 'Oathwall',
    lore: 'It has a dent for every promise kept.',
    two: { need: 2, text: 'Avenger’s Shield comes back 30% sooner.', mods: [K('avengers-shield', { op: 'cooldown', pct: -30 })] },
    four: {
      need: 4,
      text: 'Shield of the Righteous bursts around you for 90% of its damage, and Avenger’s Shield leaps to three more enemies.',
      mods: [K('shield-of-the-righteous', { op: 'onCast', effect: { kind: 'nova', radius: 56, mul: 0.9, dmgType: 'holy' } }), K('avengers-shield', { op: 'bounce', n: 3 })],
    },
    six: {
      need: 6,
      text: 'Avenger’s Shield deals 300% more damage, and a blow taken may throw it back (one in three, once every 1.5 s): an echo of Avenger’s Shield.',
      mods: [K('avengers-shield', { op: 'damage', pct: 300 }), P('oathwall-six', 'hurt', ECHO('avengers-shield', 1), 'A blow taken, one in three: an echo of Avenger’s Shield (once every 1.5 s).', { chance: 0.34, icd: 1.5 })],
    },
  },
  {
    cls: 'paladin',
    spec: 2,
    id: 'last-sentence',
    name: 'The Last Sentence',
    tint: '#fff2c8',
    names: 'Sentencer’s',
    lore: 'It was read out once. Nobody appealed.',
    two: { need: 2, text: 'Templar’s Verdict sweeps a far wider arc.', mods: [K('templars-verdict', { op: 'arc', pct: 150 })] },
    four: {
      need: 4,
      text: 'Templar’s Verdict reaches 25% further, and every kill with it gives 2 Zeal.',
      mods: [K('templars-verdict', { op: 'area', pct: 25 }), K('templars-verdict', { op: 'onKill', effect: { kind: 'resource', n: 2 } })],
    },
    six: {
      need: 6,
      text: 'Templar’s Verdict deals 300% more damage, and every kill it makes passes sentence again: an echo of Templar’s Verdict at the next enemy.',
      mods: [K('templars-verdict', { op: 'damage', pct: 300 }), P('sentence-six', 'kill', ECHO('templars-verdict', 1), 'A kill with Templar’s Verdict: an echo of it at the next enemy (once every 0.4 s).', { skill: 'templars-verdict', icd: 0.4 })],
    },
  },
  /* priest */
  {
    cls: 'priest',
    spec: 0,
    id: 'unbroken-vigil',
    name: 'The Unbroken Vigil',
    tint: '#ffe9c0',
    names: 'Vigilant',
    lore: 'The smoke goes where it is needed, and then a little further.',
    two: { need: 2, text: 'Penance lasts half again as long.', mods: [K('penance', { op: 'duration', pct: 50 })] },
    four: {
      need: 4,
      text: 'Penance leaps on to two more enemies and shields you for 10% of your health as you begin it.',
      mods: [K('penance', { op: 'onHit', effect: { kind: 'chain', jumps: 2, range: 70, mul: 0.7, dmgType: 'holy' } }), K('penance', { op: 'onCast', effect: { kind: 'shield', pct: 10, dur: 5 } })],
    },
    six: {
      need: 6,
      text: 'Penance deals 300% more damage, and a blow taken may answer with it (one in four, once every 2 s): an echo of Penance at your attacker.',
      mods: [K('penance', { op: 'damage', pct: 300 }), P('vigil-six', 'hurt', ECHO('penance', 1), 'A blow taken, one in four: an echo of Penance (once every 2 s).', { chance: 0.25, icd: 2 })],
    },
  },
  {
    cls: 'priest',
    spec: 1,
    id: 'noonfire',
    name: 'Noonfire',
    tint: '#ffd27a',
    names: 'Noonfire',
    lore: 'It hums the first line. You are expected to know the rest.',
    two: { need: 2, text: 'Holy Fire holds a second charge.', mods: [K('holy-fire', { op: 'charges', n: 1 })] },
    four: {
      need: 4,
      text: 'Holy Fire bursts where it lands for 90% of its damage and burns all it reaches; Holy Nova reaches 30% further.',
      mods: [K('holy-fire', { op: 'onImpact', effect: { kind: 'explode', radius: 50, mul: 0.9, dmgType: 'holy', status: { status: 'burn', dur: 4, power: 0.25 } } }), K('holy-nova', { op: 'area', pct: 30 })],
    },
    six: {
      need: 6,
      text: 'Holy Fire deals 300% more damage, and noon burns down on its own: an echo of Holy Fire every 2.5 s in a fight.',
      mods: [K('holy-fire', { op: 'damage', pct: 300 }), EVERY('noonfire-six', 2.5, 'holy-fire', 1, 'Every 2.5 s in a fight: an echo of Holy Fire at the nearest enemy.')],
    },
  },
  {
    cls: 'priest',
    spec: 2,
    id: 'hollow-saint',
    name: 'The Hollow Saint',
    tint: '#8a5ac8',
    names: 'Hollowsaint',
    lore: 'There is a portrait inside it. It is never the same one twice.',
    two: { need: 2, text: 'Vampiric Touch curses what it touches for 6 s.', mods: [K('vampiric-touch', { op: 'onHit', effect: { kind: 'status', status: 'curse', dur: 6, power: 0.4 } })] },
    four: {
      need: 4,
      text: 'Vampiric Touch leaps on to three more enemies.',
      mods: [K('vampiric-touch', { op: 'onHit', effect: { kind: 'chain', jumps: 3, range: 80, mul: 0.8, dmgType: 'shadow' } })],
    },
    six: {
      need: 6,
      text: 'Vampiric Touch deals 300% more damage, and every Cursed enemy that dies passes it on: an echo of Vampiric Touch at the next, and 3% of your health back.',
      mods: [K('vampiric-touch', { op: 'damage', pct: 300 }), P('saint-six', 'kill', ECHO('vampiric-touch', 1), 'A Cursed enemy that dies: an echo of Vampiric Touch at the next (once every 0.5 s).', { status: 'curse', icd: 0.5 }), P('saint-six-heal', 'kill', { kind: 'heal', pct: 3 }, 'A Cursed enemy that dies feeds you: 3% of your health back (once a second).', { status: 'curse', icd: 1 })],
    },
  },
  /* warlock */
  {
    cls: 'warlock',
    spec: 0,
    id: 'blightscript',
    name: 'Blightscript',
    tint: '#7ab04a',
    names: 'Blightscribe’s',
    lore: 'Every page is a different handwriting, and all of it is a warning.',
    two: { need: 2, text: 'Unstable Affliction comes back 40% sooner.', mods: [K('unstable-affliction', { op: 'cooldown', pct: -40 })] },
    four: {
      need: 4,
      text: 'Unstable Affliction leaps to three more enemies and bursts on each, cursing all it reaches.',
      mods: [K('unstable-affliction', { op: 'onHit', effect: { kind: 'chain', jumps: 3, range: 80, mul: 1, dmgType: 'shadow' } }), K('unstable-affliction', { op: 'onHit', effect: { kind: 'explode', radius: 40, mul: 0.6, dmgType: 'shadow', status: { status: 'curse', dur: 6, power: 0.4 } } })],
    },
    six: {
      need: 6,
      text: 'Unstable Affliction deals 300% more damage, and every Cursed enemy that dies spreads it: an echo of Unstable Affliction at the next.',
      mods: [K('unstable-affliction', { op: 'damage', pct: 300 }), P('blight-six', 'kill', ECHO('unstable-affliction', 1), 'A Cursed enemy that dies: an echo of Unstable Affliction at the next (once every 0.4 s).', { status: 'curse', icd: 0.4 })],
    },
  },
  {
    cls: 'warlock',
    spec: 1,
    id: 'pit-covenant',
    name: 'The Pit Covenant',
    tint: '#c84a3a',
    names: 'Covenant',
    lore: 'Press it into anything. Something will answer.',
    two: { need: 2, text: 'Your companions hit 25% harder.', mods: [S('pet', 25)] },
    four: {
      need: 4,
      text: 'Summoning the Pit Knight brings a second with it for 20 s, and your ultimate calls two more for 15 s.',
      mods: [K('summon-felguard', { op: 'onCast', effect: { kind: 'summon', pet: 'felguard', count: 1, dur: 20 } }), P('covenant-four', 'ult', { kind: 'summon', pet: 'felguard', count: 2, dur: 15 }, 'Your ultimate calls two more Pit Knights to the fight for 15 s.')],
    },
    six: {
      need: 6,
      text: 'Your companions hit 100% harder, and an imp climbs out of the pit to fight for you every 4 s in a fight, for 10 s each.',
      mods: [S('pet', 100), P('covenant-six', 'tick', { kind: 'summon', pet: 'imp', count: 1, dur: 10 }, 'Every 4 s in a fight: an imp joins you for 10 s.', { icd: 4 })],
    },
  },
  {
    cls: 'warlock',
    spec: 2,
    id: 'ruinous-choir',
    name: 'The Ruinous Choir',
    tint: '#ff5a2a',
    names: 'Ruinsinger’s',
    lore: 'It says one word. Nobody has heard it twice.',
    two: { need: 2, text: 'Chaos Bolt comes back a quarter sooner.', mods: [K('chaos-bolt', { op: 'cooldown', pct: -25 })] },
    four: {
      need: 4,
      text: 'Chaos Bolt bursts into four lesser bolts where it lands and leaves the ground burning.',
      mods: [K('chaos-bolt', { op: 'onImpact', effect: { kind: 'split', count: 4, mul: 0.4 } }), K('chaos-bolt', { op: 'onImpact', effect: { kind: 'ground', ground: { radius: 40, dur: 4, tick: 0.5, mul: 0.12, dmgType: 'fire', look: 'fire' } } })],
    },
    six: {
      need: 6,
      text: 'Chaos Bolt deals 300% more damage, and every critical hit may loose another (one in four, once every 1.5 s): an echo of Chaos Bolt.',
      mods: [K('chaos-bolt', { op: 'damage', pct: 300 }), P('ruinous-six', 'crit', ECHO('chaos-bolt', 1), 'A critical hit, one in four: an echo of Chaos Bolt (once every 1.5 s).', { chance: 0.25, icd: 1.5 })],
    },
  },
  /* druid */
  {
    cls: 'druid',
    spec: 0,
    id: 'nightpool',
    name: 'Nightpool',
    tint: '#a8c8ff',
    names: 'Nightpool',
    lore: 'Cut at midnight, by permission.',
    two: { need: 2, text: 'Starsurge holds a second charge.', mods: [K('starsurge', { op: 'charges', n: 1 })] },
    four: {
      need: 4,
      text: 'Starsurge breaks into three lesser stars where it lands; Moonfire bursts on what it hits.',
      mods: [K('starsurge', { op: 'onImpact', effect: { kind: 'split', count: 3, mul: 0.4 } }), K('moonfire', { op: 'onHit', effect: { kind: 'explode', radius: 36, mul: 0.8, dmgType: 'arcane' } })],
    },
    six: {
      need: 6,
      text: 'Starsurge deals 300% more damage, and the night sky throws one of its own every 2.5 s in a fight.',
      mods: [K('starsurge', { op: 'damage', pct: 300 }), EVERY('nightpool-six', 2.5, 'starsurge', 1, 'Every 2.5 s in a fight: an echo of Starsurge at the nearest enemy.')],
    },
  },
  {
    cls: 'druid',
    spec: 1,
    id: 'lynxmother',
    name: 'The Lynxmother’s Due',
    tint: '#e0c080',
    names: 'Lynxmother’s',
    lore: 'Still sharp. Still hers, really.',
    two: { need: 2, text: 'Rip comes back 35% sooner.', mods: [K('rip', { op: 'cooldown', pct: -35 })] },
    four: {
      need: 4,
      text: 'Rip leaps on to two more enemies, and every Claw mends you a little.',
      mods: [K('rip', { op: 'onHit', effect: { kind: 'chain', jumps: 2, range: 60, mul: 1 } }), K('claw', { op: 'onHit', effect: { kind: 'heal', pct: 0.8 } })],
    },
    six: {
      need: 6,
      text: 'Rip deals 300% more damage, and every critical hit may tear another (one in three, once a second): an echo of Rip.',
      mods: [K('rip', { op: 'damage', pct: 300 }), P('lynx-six', 'crit', ECHO('rip', 1), 'A critical hit, one in three: an echo of Rip (once a second).', { chance: 0.34, icd: 1 })],
    },
  },
  {
    cls: 'druid',
    spec: 2,
    id: 'heartwood',
    name: 'Heartwood',
    tint: '#8a6a3a',
    names: 'Heartwood',
    lore: 'Older than the forest it came from.',
    two: { need: 2, text: 'Thrash reaches 45% further.', mods: [K('thrash', { op: 'area', pct: 45 })] },
    four: {
      need: 4,
      text: 'Ironfur makes your hide bite back and cuts the damage you take by a tenth for 8 s; Thrash draws enemies onto you.',
      mods: [K('ironfur', { op: 'onCast', effect: { kind: 'buff', buff: { id: 'rift-heartwood', name: 'Heartwood', dur: 8, color: '#8a6a3a', thorns: 0.9, dr: 10 } } }), K('thrash', { op: 'onCast', effect: { kind: 'taunt', radius: 90, dur: 3 } })],
    },
    six: {
      need: 6,
      text: 'Thrash deals 300% more damage, and every blow you take may thrash back (one in three, once a second): an echo of Thrash.',
      mods: [K('thrash', { op: 'damage', pct: 300 }), P('heartwood-six', 'hurt', ECHO('thrash', 1), 'A blow taken, one in three: an echo of Thrash (once a second).', { chance: 0.34, icd: 1 })],
    },
  },
  /* gloam knight */
  {
    cls: 'gloamknight',
    spec: 0,
    id: 'creditors-due',
    name: 'The Creditor’s Due',
    tint: '#a02a3a',
    names: 'Creditor’s',
    lore: 'It collects. With interest.',
    two: { need: 2, text: 'Hollow Ward comes back a quarter sooner.', mods: [K('hollow-ward', { op: 'cooldown', pct: -25 })] },
    four: {
      need: 4,
      text: 'Hollow Ward bursts around you for 180% of its damage and mends 6% of your health.',
      mods: [K('hollow-ward', { op: 'onCast', effect: { kind: 'nova', radius: 64, mul: 1.8, dmgType: 'shadow' } }), K('hollow-ward', { op: 'onCast', effect: { kind: 'heal', pct: 6 } })],
    },
    six: {
      need: 6,
      text: 'Hollow Ward deals 300% more damage, and a blow taken may call it up (one in four, once every 2 s): an echo of Hollow Ward.',
      mods: [K('hollow-ward', { op: 'damage', pct: 300 }), P('creditor-six', 'hurt', ECHO('hollow-ward', 1), 'A blow taken, one in four: an echo of Hollow Ward (once every 2 s).', { chance: 0.25, icd: 2 })],
    },
  },
  {
    cls: 'gloamknight',
    spec: 1,
    id: 'graveweight',
    name: 'Graveweight',
    tint: '#4a3a7a',
    names: 'Graveweight',
    lore: 'It comes down once a day, on everything.',
    two: { need: 2, text: 'Sundering Dark holds a second charge.', mods: [K('sundering-dark', { op: 'charges', n: 1 })] },
    four: {
      need: 4,
      text: 'Sundering Dark sweeps 60% wider and sends a shockwave rolling forward for 80% of its damage.',
      mods: [K('sundering-dark', { op: 'arc', pct: 60 }), K('sundering-dark', { op: 'onCast', effect: { kind: 'shockwave', length: 150, width: 28, mul: 0.8 } })],
    },
    six: {
      need: 6,
      text: 'Sundering Dark deals 300% more damage, and every kill brings it down again: an echo of Sundering Dark at the next enemy.',
      mods: [K('sundering-dark', { op: 'damage', pct: 300 }), P('graveweight-six', 'kill', ECHO('sundering-dark', 1), 'Every kill: an echo of Sundering Dark at the next enemy (once every 0.6 s).', { icd: 0.6 })],
    },
  },
  {
    cls: 'gloamknight',
    spec: 2,
    id: 'shepherds-toll',
    name: 'The Shepherd’s Toll',
    tint: '#9a8ac0',
    names: 'Shepherd’s',
    lore: 'The flock it called is long gone. Something else comes now.',
    two: { need: 2, text: 'Creeping Dread curses what it touches for 6 s.', mods: [K('creeping-dread', { op: 'onHit', effect: { kind: 'status', status: 'curse', dur: 6, power: 0.45 } })] },
    four: {
      need: 4,
      text: 'Creeping Dread leaps on to three more enemies.',
      mods: [K('creeping-dread', { op: 'onHit', effect: { kind: 'chain', jumps: 3, range: 80, mul: 1, dmgType: 'shadow' } })],
    },
    six: {
      need: 6,
      text: 'Creeping Dread deals 300% more damage, and the bell tolls it by itself every 2.5 s in a fight.',
      mods: [K('creeping-dread', { op: 'damage', pct: 300 }), EVERY('shepherd-six', 2.5, 'creeping-dread', 1, 'Every 2.5 s in a fight: an echo of Creeping Dread at the nearest enemy.')],
    },
  },
];

const ALL_SETS = [...CLASS_SETS, ...SPEC_SETS];

const pieceId = (set: string, slot: SetSlot): string => `rift-${set}-${slot}`;
const pieceName = (s: SetSpec, slot: SetSlot): string => (typeof s.names === 'string' ? `${s.names} ${NOUN[WEAR[s.cls]][slot]}` : (s.names[slot] ?? `${s.name} ${NOUN[WEAR[s.cls]][slot]}`));
const pieceLore = (s: SetSpec, slot: SetSlot): string => (typeof s.lore === 'string' ? s.lore : (s.lore[slot] ?? ''));

export const SETS: Record<string, SetDef> = Object.fromEntries(
  ALL_SETS.map((s) => [s.id, { id: s.id, name: s.name, cls: s.cls, ...(s.spec !== undefined ? { spec: s.spec } : {}), pieces: SET_SLOTS.map((slot) => pieceId(s.id, slot)), bonuses: [s.two, s.four, s.six] }]),
);

const SET_ITEMS: ItemDef[] = ALL_SETS.flatMap((s) =>
  SET_SLOTS.map((slot) => ({
    id: pieceId(s.id, slot),
    name: pieceName(s, slot),
    slot,
    rarity: 'set' as const,
    cls: s.cls,
    icon: ICON[WEAR[s.cls]][slot],
    tint: s.tint,
    mat: WEAR[s.cls],
    stats: SET_STATS[slot],
    mods: [],
    lore: pieceLore(s, slot),
    minLevel: 60,
    set: s.id,
    rift: s.spec === undefined ? RIFT_TIERS.classSet : RIFT_TIERS.specSet,
    ...(s.spec !== undefined ? { forSpec: s.spec } : {}),
  })),
);

/* ------------------------------------------------------------------ legendaries: a power for the whole of the play */

interface LegendarySpec extends Pick<ItemDef, 'id' | 'name' | 'slot' | 'icon' | 'tint' | 'mods' | 'lore'> {
  /** The class it is made for; none: anyone's. */
  cls?: ClassId;
  /** The stat its numbers lean to. */
  stat: StatKey;
}

// (the class's three are the pieces that were each a specialization's once, under the same names: what they do now is
// for the class whatever its specialization, the owner's "general buffs for the class". What each did for its own
// specialization's skill went to that specialization's set, above)
const LEGENDARY_SPECS: LegendarySpec[] = [
  /* warrior */
  { cls: 'warrior', id: 'rift-red-appetite', name: 'The Red Appetite', slot: 'weapon', icon: 'axe', tint: '#c8323a', stat: 'physical', lore: 'It has never been cleaned. It has never needed to be sharpened.', mods: [P('appetite', 'kill', { kind: 'buff', buff: { id: 'rift-appetite', name: 'Red Appetite', dur: 5, color: '#c8323a', max: 3, stats: { haste: 8, power: 6 } } }, 'Every kill whets it: +8% haste and +6% damage for 5 s, stacking three times.'), P('appetite-heal', 'kill', { kind: 'heal', pct: 2 }, 'Every kill mends 2% of your health.')] },
  { cls: 'warrior', id: 'rift-last-gate', name: 'The Last Gate', slot: 'offhand', icon: 'shield', tint: '#8a94a8', stat: 'armor', lore: 'A door, once. It was the only thing in the keep still standing.', mods: [S('hpPct', 10), P('lastgate', 'hurt', { kind: 'shield', pct: 15, dur: 6 }, 'A heavy blow raises the gate: a shield of 15% of your health for 6 s (once every 10 s).', { icd: 10 })] },
  { cls: 'warrior', id: 'rift-grievance', name: 'Grievance', slot: 'weapon', icon: 'sword', tint: '#d8d0c0', stat: 'physical', lore: 'It keeps a list. You are not on it yet.', mods: [S('critDmg', 30), P('grievance', 'crit', { kind: 'shockwave', length: 130, width: 24, mul: 0.7 }, 'A critical hit sends a shockwave rolling on for 70% of it (once every 1.5 s).', { icd: 1.5 })] },
  /* mage */
  { cls: 'mage', id: 'rift-banked-coal', name: 'The Banked Coal', slot: 'relic', icon: 'relic', tint: '#ff6a2a', stat: 'fire', lore: 'It was a mountain once, and it is still angry about that.', mods: [P('coal', 'tick', { kind: 'riftBurst', radius: 52, mul: 2.5, delay: 0.6 }, 'Every 5 s in a fight, a coal falls where you stand and bursts after a moment.', { icd: 5 })] },
  { cls: 'mage', id: 'rift-thunderwrit', name: 'Thunderwrit Rod', slot: 'weapon', icon: 'wand', tint: '#6ad8ff', stat: 'lightning', lore: 'Point it at nothing you would miss.', mods: [P('thunderwrit', 'crit', { kind: 'chain', jumps: 3, range: 90, mul: 0.6, dmgType: 'lightning' }, 'A critical hit leaps on to three more enemies as lightning (once a second).', { icd: 1 })] },
  { cls: 'mage', id: 'rift-hoarfrost-heart', name: 'Hoarfrost Heart', slot: 'offhand', icon: 'orb', tint: '#b8e8ff', stat: 'frost', lore: 'It beats about once a year.', mods: [S('armor', 20), P('hoarfrost', 'hurt', { kind: 'nova', radius: 60, mul: 0.8, dmgType: 'frost', status: { status: 'freeze', dur: 1.5, power: 1 } }, 'A blow taken freezes everything around you for 1.5 s (once every 6 s).', { icd: 6 })] },
  /* ranger */
  { cls: 'ranger', id: 'rift-long-look', name: 'The Long Look', slot: 'weapon', icon: 'bow', tint: '#d8c080', stat: 'physical', lore: 'The arrow is already there. The bow only tells you where.', mods: [S('crit', 6), P('longlook', 'crit', { kind: 'explode', radius: 36, mul: 0.6 }, 'A critical hit bursts on what it strikes for 60% of it (once every 0.5 s).', { icd: 0.5 })] },
  { cls: 'ranger', id: 'rift-jawbone-charm', name: 'Jawbone Charm', slot: 'relic', icon: 'relic', tint: '#c8b89a', stat: 'poison', lore: 'Whatever it came out of had a great many teeth and no patience.', mods: [P('jawbone', 'kill', { kind: 'explode', radius: 44, mul: 1, status: { status: 'bleed', dur: 4, power: 0.3 } }, 'A kill snaps shut around it: a burst that Bleeds whatever is near (once every 0.5 s).', { icd: 0.5 })] },
  { cls: 'ranger', id: 'rift-packmothers-fang', name: 'Packmother’s Fang', slot: 'amulet', icon: 'amulet', tint: '#e8e0d0', stat: 'pet', lore: 'She gave it up herself. Nobody could have taken it.', mods: [S('pet', 35), P('packmother', 'kill', { kind: 'buff', buff: { id: 'rift-packmother', name: 'Blooded', dur: 6, color: '#e8e0d0', stats: { pet: 30, haste: 15 } } }, 'A kill bloods the pack: your companions hit 30% harder and you are 15% quicker for 6 s (once every 4 s).', { icd: 4 })] },
  /* paladin */
  { cls: 'paladin', id: 'rift-morningbell', name: 'Morningbell', slot: 'weapon', icon: 'hammer', tint: '#ffe9a0', stat: 'holy', lore: 'It rings once when it strikes, and somewhere a window lights.', mods: [S('healing', 20), P('morningbell', 'hit', { kind: 'heal', pct: 1 }, 'Your hits mend 1% of your health (once every 0.5 s).', { icd: 0.5 })] },
  { cls: 'paladin', id: 'rift-wall-of-the-oath', name: 'Wall of the Ember Oath', slot: 'offhand', icon: 'shield', tint: '#e0b040', stat: 'armor', lore: 'It has a dent for every promise kept.', mods: [S('armor', 25), P('emberwall', 'hurt', { kind: 'nova', radius: 56, mul: 1, dmgType: 'holy' }, 'A blow taken flares back: holy light around you (once every 3 s).', { icd: 3 })] },
  { cls: 'paladin', id: 'rift-final-reading', name: 'The Final Reading', slot: 'weapon', icon: 'sword', tint: '#fff2c8', stat: 'holy', lore: 'It was read out once. Nobody appealed.', mods: [P('reading', 'kill', { kind: 'resource', n: 1 }, 'Every kill gives a Zeal (once every 0.5 s).', { icd: 0.5 }), P('reading-power', 'kill', { kind: 'buff', buff: { id: 'rift-reading', name: 'Read Out', dur: 6, color: '#fff2c8', stats: { power: 12 } } }, 'Every kill: +12% damage for 6 s.')] },
  /* priest */
  { cls: 'priest', id: 'rift-censer-of-mercy', name: 'Censer of Mercy', slot: 'relic', icon: 'relic', tint: '#ffe9c0', stat: 'healing', lore: 'The smoke goes where it is needed, and then a little further.', mods: [S('healing', 25), P('censer', 'tick', { kind: 'heal', pct: 4 }, 'Every 5 s in a fight: 4% of your health back.', { icd: 5 })] },
  { cls: 'priest', id: 'rift-dawnhymn', name: 'Dawnhymn', slot: 'weapon', icon: 'staff', tint: '#ffd27a', stat: 'holy', lore: 'It hums the first line. You are expected to know the rest.', mods: [P('dawnhymn', 'crit', { kind: 'nova', radius: 56, mul: 0.9, dmgType: 'holy' }, 'A critical hit rings out: holy light around you (once every 1.5 s).', { icd: 1.5 })] },
  { cls: 'priest', id: 'rift-hungering-locket', name: 'The Hungering Locket', slot: 'amulet', icon: 'amulet', tint: '#8a5ac8', stat: 'shadow', lore: 'There is a portrait inside. It is never the same one twice.', mods: [P('hungering', 'kill', { kind: 'heal', pct: 3 }, 'Every kill feeds you: 3% of your health back (once a second).', { icd: 1 }), P('hungering-curse', 'hit', { kind: 'status', status: 'curse', dur: 5, power: 0.3 }, 'Your hits may curse (one in five): 30% of the hit a second as shadow, for 5 s.', { chance: 0.2, icd: 0.5 })] },
  /* warlock */
  { cls: 'warlock', id: 'rift-plaguewrit', name: 'Plaguewrit', slot: 'offhand', icon: 'tome', tint: '#7ab04a', stat: 'shadow', lore: 'Every page is a different handwriting, and all of it is a warning.', mods: [P('plaguewrit', 'kill', { kind: 'explode', radius: 46, mul: 0.8, dmgType: 'shadow', status: { status: 'curse', dur: 5, power: 0.35 } }, 'A Cursed enemy that dies bursts, cursing whatever is near (once every 0.5 s).', { status: 'curse', icd: 0.5 })] },
  { cls: 'warlock', id: 'rift-knightmakers-seal', name: 'The Knightmaker’s Seal', slot: 'relic', icon: 'relic', tint: '#c84a3a', stat: 'pet', lore: 'Press it into anything. Something will answer.', mods: [S('pet', 35), P('knightmaker', 'ult', { kind: 'summon', pet: 'felguard', count: 2, dur: 15 }, 'Your ultimate calls two Pit Knights to the fight for 15 s.')] },
  { cls: 'warlock', id: 'rift-ruinspeaker', name: 'Ruinspeaker', slot: 'weapon', icon: 'staff', tint: '#ff5a2a', stat: 'fire', lore: 'It says one word. Nobody has heard it twice.', mods: [S('critDmg', 30), P('ruinspeaker', 'crit', { kind: 'ground', ground: { radius: 40, dur: 4, tick: 0.5, mul: 0.12, dmgType: 'fire', look: 'fire' } }, 'A critical hit sets the ground burning for 4 s (once every 1.5 s).', { icd: 1.5 })] },
  /* druid */
  { cls: 'druid', id: 'rift-nightpool-branch', name: 'Nightpool Branch', slot: 'weapon', icon: 'staff', tint: '#a8c8ff', stat: 'arcane', lore: 'Cut at midnight, by permission.', mods: [P('nightpool', 'tick', { kind: 'nova', radius: 70, mul: 1.6, dmgType: 'arcane' }, 'Every 4 s in a fight, moonlight bursts around you.', { icd: 4 })] },
  { cls: 'druid', id: 'rift-lynxmothers-claw', name: 'Lynxmother’s Claw', slot: 'amulet', icon: 'amulet', tint: '#e0c080', stat: 'physical', lore: 'Still sharp. Still hers, really.', mods: [S('crit', 8), P('lynxclaw', 'kill', { kind: 'resetCd' }, 'A kill makes a random skill ready again (once every 3 s).', { icd: 3 })] },
  { cls: 'druid', id: 'rift-heartwood-totem', name: 'Heartwood Totem', slot: 'relic', icon: 'relic', tint: '#8a6a3a', stat: 'nature', lore: 'Older than the forest it came from.', mods: [S('hpPct', 10), P('heartwood-totem', 'hurt', { kind: 'buff', buff: { id: 'rift-heartwood-totem', name: 'Barkskin', dur: 6, color: '#8a6a3a', thorns: 0.6, dr: 12 } }, 'A blow taken hardens your hide: 12% less damage taken, and it bites back, for 6 s (once every 10 s).', { icd: 10 })] },
  /* gloam knight */
  { cls: 'gloamknight', id: 'rift-creditor', name: 'The Creditor', slot: 'weapon', icon: 'sword', tint: '#a02a3a', stat: 'shadow', lore: 'It collects. With interest.', mods: [P('creditor', 'hit', { kind: 'heal', pct: 0.8 }, 'Your hits mend 0.8% of your health (once every 0.3 s).', { icd: 0.3 })] },
  { cls: 'gloamknight', id: 'rift-graveweight', name: 'Graveweight', slot: 'weapon', icon: 'sword', tint: '#4a3a7a', stat: 'physical', lore: 'It comes down once a day, on everything.', mods: [P('graveweight-blade', 'kill', { kind: 'shockwave', length: 140, width: 26, mul: 0.9 }, 'A kill sends a wave of dusk rolling on for 90% damage (once every 0.6 s).', { icd: 0.6 })] },
  { cls: 'gloamknight', id: 'rift-shepherds-bell', name: 'The Shepherd’s Bell', slot: 'relic', icon: 'relic', tint: '#9a8ac0', stat: 'shadow', lore: 'The flock it called is long gone. Something else comes now.', mods: [P('shepherd', 'kill', { kind: 'nova', radius: 60, mul: 0.9, dmgType: 'shadow', status: { status: 'curse', dur: 5, power: 0.3 } }, 'A Cursed enemy that dies tolls the bell: a burst of shadow around you that curses everything it reaches (once every 1.5 s).', { status: 'curse', icd: 1.5 })] },
  /* anyone's */
  { id: 'rift-echoing-band', name: 'The Echoing Band', slot: 'ring', icon: 'ring', tint: '#c8b8ff', stat: 'power', lore: 'Whatever you do, it does too, a breath later.', mods: [EVERY('echoing-band', 4, 'basic', 1.5, 'Every 4 s in a fight: an echo of your basic attack at the nearest enemy, 50% harder.')] },
  { id: 'rift-wayfarers-compass', name: 'Wayfarer’s Compass', slot: 'amulet', icon: 'amulet', tint: '#d8c890', stat: 'speed', lore: 'It points to wherever you meant to go.', mods: [S('speed', 15), S('potion', 30), P('wayfarer', 'dodge', { kind: 'buff', buff: { id: 'rift-wayfarer', name: 'Second Wind', dur: 3, color: '#d8c890', stats: { speed: 25 } } }, 'Every dodge: 25% quicker for 3 s.')] },
  { id: 'rift-stormglass', name: 'Stormglass', slot: 'relic', icon: 'relic', tint: '#9ad8ff', stat: 'lightning', lore: 'A storm in a bottle. The bottle is losing.', mods: [P('stormglass', 'tick', { kind: 'nova', radius: 80, mul: 1.8, dmgType: 'lightning', ref: true }, 'Every 3 s in a fight, lightning breaks out around you.', { icd: 3 })] },
  { id: 'rift-ember-heart', name: 'The Ember Heart', slot: 'amulet', icon: 'amulet', tint: '#ff8a3a', stat: 'fire', lore: 'Still warm. It has not been warm for a hundred years.', mods: [P('emberheart', 'kill', { kind: 'explode', radius: 46, mul: 0.9, dmgType: 'fire', status: { status: 'burn', dur: 3, power: 0.25 } }, 'Every kill bursts into flame, burning whatever is near (once every 0.4 s).', { icd: 0.4 })] },
  { id: 'rift-hourglass-of-ash', name: 'Hourglass of Ash', slot: 'relic', icon: 'relic', tint: '#c8b8a0', stat: 'haste', lore: 'The sand runs up as often as down.', mods: [S('haste', 10), P('hourglass', 'crit', { kind: 'cdr', s: 0.4 }, 'A critical hit takes 0.4 s off every cooldown (once every 0.3 s).', { icd: 0.3 })] },
  { id: 'rift-gamblers-knuckle', name: 'The Gambler’s Knuckle', slot: 'ring', icon: 'ring', tint: '#ffd24a', stat: 'crit', lore: 'Lucky, mostly. Mostly for whoever wears it.', mods: [S('crit', 10), S('critDmg', 40)] },
  { id: 'rift-oathkeepers-ward', name: 'Oathkeeper’s Ward', slot: 'amulet', icon: 'amulet', tint: '#e8e0c0', stat: 'armor', lore: 'It has kept every promise made over it, and some that were only meant.', mods: [S('hpPct', 12), P('oathward', 'hurt', { kind: 'shield', pct: 20, dur: 6 }, 'A blow taken raises a ward of 20% of your health for 6 s (once every 12 s).', { icd: 12 })] },
  { id: 'rift-heartsong', name: 'Heartsong', slot: 'relic', icon: 'relic', tint: '#ff8ab8', stat: 'ultCharge', lore: 'It keeps time with whoever is bravest in the room.', mods: [S('ultCharge', 20), P('heartsong', 'ult', { kind: 'heal', pct: 25 }, 'Your ultimate mends 25% of your health.'), P('heartsong-cd', 'ult', { kind: 'cdr', s: 3 }, 'Your ultimate takes 3 s off every cooldown.')] },
];

const LEGENDARY_STATS: Record<SlotId, (stat: StatKey) => ItemDef['stats']> = {
  weapon: (s) => [{ stat: 'power', base: 9, per: 1.7 }, { stat: s, base: 8, per: 1.2 }],
  offhand: (s) => [{ stat: s === 'armor' ? 'armor' : 'power', base: 6, per: 1.3 }, { stat: s === 'armor' ? 'hp' : s, base: s === 'armor' ? 14 : 6, per: s === 'armor' ? 3.2 : 1.1 }],
  amulet: (s) => [{ stat: 'power', base: 5, per: 0.9 }, { stat: s, base: 6, per: s === 'pet' || s === 'speed' || s === 'armor' ? 0.5 : 1.1 }],
  relic: (s) => [{ stat: 'power', base: 5, per: 0.9 }, { stat: s, base: 6, per: s === 'pet' || s === 'healing' || s === 'haste' || s === 'ultCharge' ? 0.4 : 1.1 }],
  ring: (s) => [{ stat: 'power', base: 4, per: 0.9 }, { stat: s === 'crit' ? 'critDmg' : 'hp', base: 6, per: s === 'crit' ? 0.6 : 2 }],
  head: () => [],
  chest: () => [],
  legs: () => [],
  hands: () => [],
  feet: () => [],
};

const LEGENDARY_ITEMS: ItemDef[] = LEGENDARY_SPECS.map((u) => ({
  id: u.id,
  name: u.name,
  slot: u.slot,
  rarity: 'legendary' as const,
  ...(u.cls ? { cls: u.cls } : {}),
  icon: u.icon,
  tint: u.tint,
  stats: LEGENDARY_STATS[u.slot](u.stat),
  mods: u.mods,
  lore: u.lore,
  minLevel: 60,
  rift: u.cls ? RIFT_TIERS.classLegendary : RIFT_TIERS.legendary,
}));

/** Every Rift-forged piece: the sets (the class's, then the specializations'), then the legendaries. */
export const RIFT_ITEMS: ItemDef[] = [...SET_ITEMS, ...LEGENDARY_ITEMS];

/** The set an item belongs to, if it belongs to one. */
export const setOf = (item: Pick<ItemDef, 'set'> | undefined): SetDef | undefined => (item?.set ? SETS[item.set] : undefined);

/** A class's sets: its own first, then its specializations' in order. */
export const setsOf = (cls: ClassId): SetDef[] => Object.values(SETS).filter((s) => s.cls === cls).sort((a, b) => (a.spec ?? -1) - (b.spec ?? -1));

/** The Rift-forged pieces a hero of a class with this stone can find (anyone's legendaries too), earliest first. */
export function riftPool(cls: ClassId, stone: number): ItemDef[] {
  return RIFT_ITEMS.filter((d) => (!d.cls || d.cls === cls) && (d.rift ?? 0) <= stone).sort((a, b) => (a.rift ?? 0) - (b.rift ?? 0));
}
