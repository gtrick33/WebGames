import type { ClassId, Effect, ItemDef, ItemIcon, Material, Mod, ProcDef, SkillOp, SlotId, StatKey } from './types';

/**
 * Rift-forged gear: what the endgame is climbed for.
 *
 * Everything here comes only out of the Rift (a run's cache, the Riftbroker's wagers, and one piece for every new
 * stone a hero opens: sim/world.ts finishKeyRun), never from the campaign's drops or the quartermaster. Two kinds:
 *
 * - A set for every class: gloves, legwear and boots. Two pieces worn change the class's basic attack; all three
 *   change one of the skills every specialization has. They work for any of the three specializations.
 * - A piece for every specialization (a weapon, an off-hand, an amulet or a relic) that changes that
 *   specialization's own skill, the one its combo is built on, into something it wasn't.
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
  /** Item ids, in the order they are listed on a piece. */
  pieces: string[];
  bonuses: SetBonus[];
}

/** The stone a hero must have opened for each kind to come out of the Rift. */
export const RIFT_TIERS = { gloves: 1, boots: 1, legs: 3, unique: 5 } as const;

const K = (skill: string, op: SkillOp): Mod => ({ t: 'skill', skill, op });
const S = (stat: StatKey, v: number): Mod => ({ t: 'stat', stat, v });
const P = (id: string, on: ProcDef['on'], effect: Effect, text: string, o: Partial<Pick<ProcDef, 'chance' | 'icd' | 'skill' | 'status' | 'dmgType'>> = {}): Mod => ({
  t: 'proc',
  proc: { id: `rift-${id}`, on, chance: o.chance ?? 1, icd: o.icd ?? 0, effect, text, ...(o.skill ? { skill: o.skill } : {}), ...(o.status ? { status: o.status } : {}), ...(o.dmgType ? { dmgType: o.dmgType } : {}) },
});

const WEAR: Record<ClassId, Material> = { warrior: 'plate', paladin: 'plate', gloamknight: 'plate', ranger: 'leather', druid: 'leather', mage: 'cloth', priest: 'cloth', warlock: 'cloth' };

interface SetSpec {
  cls: ClassId;
  id: string;
  name: string;
  tint: string;
  /** The three pieces' names: gloves, legwear, boots. */
  names: [string, string, string];
  lore: [string, string, string];
  two: SetBonus;
  three: SetBonus;
}

const PIECES: { slot: SlotId; icon: ItemIcon; rift: number; stats: ItemDef['stats'] }[] = [
  { slot: 'hands', icon: 'gloves', rift: RIFT_TIERS.gloves, stats: [{ stat: 'power', base: 4, per: 1 }, { stat: 'critDmg', base: 6, per: 0.5 }] },
  { slot: 'legs', icon: 'legs', rift: RIFT_TIERS.legs, stats: [{ stat: 'hp', base: 14, per: 3.4 }, { stat: 'armor', base: 4, per: 1.1 }] },
  { slot: 'feet', icon: 'boots', rift: RIFT_TIERS.boots, stats: [{ stat: 'hp', base: 10, per: 3 }, { stat: 'power', base: 3, per: 0.7 }] },
];

const SET_SPECS: SetSpec[] = [
  {
    cls: 'warrior',
    id: 'stonehewer',
    name: 'Stonehewer’s Harness',
    tint: '#8a7a6a',
    names: ['Stonehewer’s Fists', 'Stonehewer’s Tassets', 'Stonehewer’s Tread'],
    lore: ['The knuckles are worn smooth. The stone they met is not.', 'Riveted by someone who expected to be hit a great deal.', 'Wherever they stand, the floor gives first.'],
    two: { need: 2, text: 'Cleave opens wounds: every enemy it hits Bleeds for 30% of the hit a second, for 4 s.', mods: [K('cleave', { op: 'onHit', effect: { kind: 'status', status: 'bleed', dur: 4, power: 0.3 } })] },
    three: {
      need: 3,
      text: 'Heavy Strike holds a second charge, and every one sends a shockwave rolling forward for 60% of its damage.',
      mods: [K('heavy-strike', { op: 'charges', n: 1 }), K('heavy-strike', { op: 'onCast', effect: { kind: 'shockwave', length: 120, width: 24, mul: 0.6 } })],
    },
  },
  {
    cls: 'mage',
    id: 'rimeglass',
    name: 'Rimeglass Regalia',
    tint: '#7ac8ff',
    names: ['Rimeglass Wraps', 'Rimeglass Skirts', 'Rimeglass Slippers'],
    lore: ['Spun from frost that was asked nicely not to melt.', 'They ring, very faintly, when a spell goes through them.', 'They leave no prints. The cold fills them in behind you.'],
    two: { need: 2, text: 'Arcane Bolt flies as three: two more bolts, fanned to either side.', mods: [K('arcane-bolt', { op: 'projectiles', n: 2, spread: 0.3 })] },
    three: {
      need: 3,
      text: 'Blink leaves a storm where you stood and where you land: Rime Burst is ready at once after every Blink, and costs nothing.',
      mods: [K('blink', { op: 'onCast', effect: { kind: 'buff', buff: { id: 'rift-rimeglass', name: 'Rimeglass', dur: 6, color: '#7ac8ff', empower: { skill: 'frost-nova', free: true, ready: true, pct: 40 } } } })],
    },
  },
  {
    cls: 'ranger',
    id: 'tidewatcher',
    name: 'Tidewatcher’s Leathers',
    tint: '#3a8a8a',
    names: ['Tidewatcher’s Grips', 'Tidewatcher’s Breeches', 'Tidewatcher’s Boots'],
    lore: ['The string never bites through them. It has tried for years.', 'Salt-stiff, and silent all the same.', 'They have stood in the tide and waited longer than the tide could.'],
    two: { need: 2, text: 'Arrow passes through two more enemies.', mods: [K('arrow', { op: 'pierce', n: 2 })] },
    three: {
      need: 3,
      text: 'Every Tumble nocks a volley: your next Multishot is ready at once, costs nothing and hits 60% harder.',
      mods: [P('tidewatcher', 'dodge', { kind: 'buff', buff: { id: 'rift-tidewatcher', name: 'Nocked', dur: 5, color: '#3ad0c8', empower: { skill: 'multishot', free: true, ready: true, pct: 60 } } }, 'Every Tumble nocks a volley: your next Multishot is ready at once, costs nothing and hits 60% harder.')],
    },
  },
  {
    cls: 'paladin',
    id: 'emberoath',
    name: 'Emberoath Plate',
    tint: '#e0a040',
    names: ['Emberoath Gauntlets', 'Emberoath Cuisses', 'Emberoath Sabatons'],
    lore: ['Warm to the touch, as a hand is after a promise.', 'Every plate is stamped with the same short vow.', 'They have never once stepped back.'],
    two: { need: 2, text: 'Oath Strike gives one more Zeal.', mods: [K('crusader-strike', { op: 'gen', n: 1 })] },
    three: {
      need: 3,
      text: 'Radiant Sweep reaches 40% further and mends you for 3% of your health every time it is swung.',
      mods: [K('divine-storm', { op: 'area', pct: 40 }), K('divine-storm', { op: 'onCast', effect: { kind: 'heal', pct: 3 } })],
    },
  },
  {
    cls: 'priest',
    id: 'sunchoir',
    name: 'Sunchoir Vestments',
    tint: '#ffe08a',
    names: ['Sunchoir Mitts', 'Sunchoir Cassock', 'Sunchoir Sandals'],
    lore: ['Embroidered with a hymn in thread too fine to read.', 'It was sung over for a year before anyone wore it.', 'The road is a little brighter behind them.'],
    two: { need: 2, text: 'Smite leaps on to two more enemies.', mods: [K('smite', { op: 'bounce', n: 2 })] },
    three: {
      need: 3,
      text: 'Smite hits can call the next verse (one hit in five): your next Thought Lash is ready at once, costs nothing and hits 60% harder.',
      mods: [P('sunchoir', 'hit', { kind: 'buff', buff: { id: 'rift-sunchoir', name: 'Next Verse', dur: 8, color: '#ffe08a', empower: { skill: 'mind-blast', free: true, ready: true, pct: 60 } } }, 'Smite hits can call the next verse (one hit in five): your next Thought Lash is ready at once, costs nothing and hits 60% harder.', { skill: 'smite', chance: 0.2, icd: 2 })],
    },
  },
  {
    cls: 'warlock',
    id: 'veilbound',
    name: 'Veilbound Raiment',
    tint: '#7a4ab0',
    names: ['Veilbound Wraps', 'Veilbound Robeskirt', 'Veilbound Slippers'],
    lore: ['The stitches move when nobody is looking at them.', 'Something signed the hem. It was not a tailor.', 'They make no sound on stone, and less on bone.'],
    two: { need: 2, text: 'Shadow Bolt curses what it hits: 40% of the hit a second as shadow damage, for 4 s.', mods: [K('shadow-bolt', { op: 'onHit', effect: { kind: 'status', status: 'curse', dur: 4, power: 0.4 } })] },
    three: {
      need: 3,
      text: 'A Cursed enemy that dies gets up again as an imp and fights for you for 8 s (once every 3 s).',
      mods: [P('veilbound', 'kill', { kind: 'summon', pet: 'imp', count: 1, dur: 8 }, 'A Cursed enemy that dies gets up again as an imp and fights for you for 8 s (once every 3 s).', { status: 'curse', icd: 3 })],
    },
  },
  {
    cls: 'druid',
    id: 'thornwarden',
    name: 'Thornwarden’s Hide',
    tint: '#6a9a4a',
    names: ['Thornwarden’s Grips', 'Thornwarden’s Leggings', 'Thornwarden’s Treads'],
    lore: ['The thorns grow back by morning.', 'Bark on the outside, moss on the inside, and it fits whatever shape you are.', 'Something green comes up in every print they leave.'],
    two: { need: 2, text: 'Your basic attack in any shape (Wrath, Claw, Maul) leaves thorns in the wound: Poison for 30% of the hit a second, for 4 s.', mods: [K('basic', { op: 'onHit', effect: { kind: 'status', status: 'poison', dur: 4, power: 0.3 } })] },
    three: {
      need: 3,
      text: 'Changing shape throws thorns: taking Lynx Shape or Bear Shape bursts around you for nature damage and mends 3% of your health.',
      mods: [
        K('cat-form', { op: 'onCast', effect: { kind: 'nova', radius: 56, mul: 1, dmgType: 'nature' } }),
        K('cat-form', { op: 'onCast', effect: { kind: 'heal', pct: 3 } }),
        K('bear-form', { op: 'onCast', effect: { kind: 'nova', radius: 56, mul: 1, dmgType: 'nature' } }),
        K('bear-form', { op: 'onCast', effect: { kind: 'heal', pct: 3 } }),
      ],
    },
  },
  {
    cls: 'gloamknight',
    id: 'lastwatch',
    name: 'Lastwatch Plate',
    tint: '#5a4a80',
    names: ['Lastwatch Gauntlets', 'Lastwatch Tassets', 'Lastwatch Greaves'],
    lore: ['They held a gate once. They remember how.', 'The same gray as the last light, whatever the hour.', 'Planted, they do not move. That was the whole of the oath.'],
    two: { need: 2, text: 'Gloam Cleave gathers 3 more Umbra and sweeps a third wider.', mods: [K('gloam-cleave', { op: 'gen', n: 3 }), K('gloam-cleave', { op: 'arc', pct: 33 })] },
    three: {
      need: 3,
      text: 'Umbral Rend sends a wave of dusk rolling forward for 70% of its damage, and curses what it cuts for 5 s.',
      mods: [K('umbral-rend', { op: 'onCast', effect: { kind: 'shockwave', length: 120, width: 26, mul: 0.7 } }), K('umbral-rend', { op: 'onHit', effect: { kind: 'status', status: 'curse', dur: 5, power: 0.4 } })],
    },
  },
];

const pieceId = (set: string, slot: SlotId): string => `rift-${set}-${slot}`;

export const SETS: Record<string, SetDef> = Object.fromEntries(
  SET_SPECS.map((s) => [s.id, { id: s.id, name: s.name, cls: s.cls, pieces: PIECES.map((p) => pieceId(s.id, p.slot)), bonuses: [s.two, s.three] }]),
);

const SET_ITEMS: ItemDef[] = SET_SPECS.flatMap((s) =>
  PIECES.map((p, i) => ({
    id: pieceId(s.id, p.slot),
    name: s.names[i]!,
    slot: p.slot,
    rarity: 'legendary' as const,
    cls: s.cls,
    icon: p.icon,
    tint: s.tint,
    mat: WEAR[s.cls],
    stats: p.stats,
    mods: [],
    lore: s.lore[i]!,
    minLevel: 60,
    set: s.id,
    rift: p.rift,
  })),
);

/* ------------------------------------------------------------------ one for every specialization */

interface UniqueSpec extends Pick<ItemDef, 'id' | 'name' | 'slot' | 'icon' | 'tint' | 'mods' | 'lore'> {
  cls: ClassId;
  /** Which of the class's three specializations it is made for (its skill is that one's own). */
  spec: 0 | 1 | 2;
  /** The element or kind its stats lean to. */
  stat: StatKey;
}

const UNIQUE_SPECS: UniqueSpec[] = [
  /* warrior */
  { cls: 'warrior', spec: 0, id: 'rift-red-appetite', name: 'The Red Appetite', slot: 'weapon', icon: 'axe', tint: '#c8323a', stat: 'physical', lore: 'It has never been cleaned. It has never needed to be sharpened.', mods: [K('bloodthirst', { op: 'arc', pct: 120 }), K('bloodthirst', { op: 'onHit', effect: { kind: 'heal', pct: 2 } }), K('bloodthirst', { op: 'charges', n: 1 })] },
  { cls: 'warrior', spec: 1, id: 'rift-last-gate', name: 'The Last Gate', slot: 'offhand', icon: 'shield', tint: '#8a94a8', stat: 'armor', lore: 'A door, once. It was the only thing in the keep still standing.', mods: [K('shield-wall', { op: 'onCast', effect: { kind: 'nova', radius: 70, mul: 2.2 } }), K('shield-wall', { op: 'onCast', effect: { kind: 'taunt', radius: 90, dur: 4 } }), K('shield-bash', { op: 'charges', n: 1 })] },
  { cls: 'warrior', spec: 2, id: 'rift-grievance', name: 'Grievance', slot: 'weapon', icon: 'sword', tint: '#d8d0c0', stat: 'physical', lore: 'It keeps a list. You are not on it yet.', mods: [K('mortal-strike', { op: 'onCast', effect: { kind: 'shockwave', length: 140, width: 26, mul: 0.8 } }), K('mortal-strike', { op: 'onHit', effect: { kind: 'status', status: 'bleed', dur: 6, power: 0.4 } }), K('mortal-strike', { op: 'cooldown', pct: -25 })] },
  /* mage */
  { cls: 'mage', spec: 0, id: 'rift-banked-coal', name: 'The Banked Coal', slot: 'relic', icon: 'relic', tint: '#ff6a2a', stat: 'fire', lore: 'It was a mountain once, and it is still angry about that.', mods: [K('flamestrike', { op: 'onImpact', effect: { kind: 'ground', ground: { radius: 46, dur: 5, tick: 0.5, mul: 0.14, dmgType: 'fire', look: 'fire', status: { status: 'burn', dur: 3, power: 0.2 } } } }), K('flamestrike', { op: 'cooldown', pct: -30 }), K('fireball', { op: 'charges', n: 1 })] },
  { cls: 'mage', spec: 1, id: 'rift-thunderwrit', name: 'Thunderwrit Rod', slot: 'weapon', icon: 'wand', tint: '#6ad8ff', stat: 'lightning', lore: 'Point it at nothing you would miss.', mods: [K('chain-lightning', { op: 'extra', key: 'jumps', n: 3, label: 'leaps' }), K('ball-lightning', { op: 'onImpact', effect: { kind: 'explode', radius: 52, mul: 1.2, dmgType: 'lightning' } }), K('ball-lightning', { op: 'charges', n: 1 })] },
  { cls: 'mage', spec: 2, id: 'rift-hoarfrost-heart', name: 'Hoarfrost Heart', slot: 'offhand', icon: 'orb', tint: '#b8e8ff', stat: 'frost', lore: 'It beats about once a year.', mods: [K('blizzard', { op: 'extra', key: 'pull', n: 55, label: 'pull' }), K('blizzard', { op: 'duration', pct: 50 }), K('ice-lance', { op: 'pierce', n: 3 }), K('ice-lance', { op: 'bonusVs', status: 'freeze', pct: 80 })] },
  /* ranger */
  { cls: 'ranger', spec: 0, id: 'rift-long-look', name: 'The Long Look', slot: 'weapon', icon: 'bow', tint: '#d8c080', stat: 'physical', lore: 'The arrow is already there. The bow only tells you where.', mods: [K('aimed-shot', { op: 'pierce', n: 6 }), K('aimed-shot', { op: 'onHit', effect: { kind: 'explode', radius: 34, mul: 0.5 } }), K('aimed-shot', { op: 'range', pct: 40 })] },
  { cls: 'ranger', spec: 1, id: 'rift-jawbone-charm', name: 'Jawbone Charm', slot: 'relic', icon: 'relic', tint: '#c8b89a', stat: 'poison', lore: 'Whatever it came out of had a great many teeth and no patience.', mods: [K('bear-trap', { op: 'extra', key: 'maxTraps', n: 2, label: 'traps at once' }), K('bear-trap', { op: 'onImpact', effect: { kind: 'explode', radius: 44, mul: 1.1, status: { status: 'bleed', dur: 4, power: 0.3 } } }), K('bear-trap', { op: 'cooldown', pct: -40 })] },
  { cls: 'ranger', spec: 2, id: 'rift-packmothers-fang', name: 'Packmother’s Fang', slot: 'amulet', icon: 'amulet', tint: '#e8e0d0', stat: 'pet', lore: 'She gave it up herself. Nobody could have taken it.', mods: [K('call-wolf', { op: 'onCast', effect: { kind: 'summon', pet: 'wolf', count: 2, dur: 0 } }), S('pet', 35), P('packmother', 'kill', { kind: 'buff', buff: { id: 'rift-packmother', name: 'Blooded', dur: 6, color: '#e8e0d0', stats: { pet: 30, haste: 15 } } }, 'A kill bloods the pack: your companions hit 30% harder and you are 15% quicker for 6 s (once every 4 s).', { icd: 4 })] },
  /* paladin */
  { cls: 'paladin', spec: 0, id: 'rift-morningbell', name: 'Morningbell', slot: 'weapon', icon: 'hammer', tint: '#ffe9a0', stat: 'holy', lore: 'It rings once when it strikes, and somewhere a window lights.', mods: [K('holy-shock', { op: 'bounce', n: 3 }), K('holy-shock', { op: 'onHit', effect: { kind: 'heal', pct: 2 } }), K('holy-shock', { op: 'charges', n: 1 })] },
  { cls: 'paladin', spec: 1, id: 'rift-wall-of-the-oath', name: 'Wall of the Ember Oath', slot: 'offhand', icon: 'shield', tint: '#e0b040', stat: 'armor', lore: 'It has a dent for every promise kept.', mods: [K('shield-of-the-righteous', { op: 'onCast', effect: { kind: 'nova', radius: 56, mul: 0.9, dmgType: 'holy' } }), K('avengers-shield', { op: 'bounce', n: 3 }), K('avengers-shield', { op: 'cooldown', pct: -30 })] },
  { cls: 'paladin', spec: 2, id: 'rift-final-reading', name: 'The Final Reading', slot: 'weapon', icon: 'sword', tint: '#fff2c8', stat: 'holy', lore: 'It was read out once. Nobody appealed.', mods: [K('templars-verdict', { op: 'arc', pct: 220 }), K('templars-verdict', { op: 'area', pct: 25 }), K('templars-verdict', { op: 'onKill', effect: { kind: 'resource', n: 2 } })] },
  /* priest */
  { cls: 'priest', spec: 0, id: 'rift-censer-of-mercy', name: 'Censer of Mercy', slot: 'relic', icon: 'relic', tint: '#ffe9c0', stat: 'healing', lore: 'The smoke goes where it is needed, and then a little further.', mods: [K('penance', { op: 'duration', pct: 50 }), K('penance', { op: 'onHit', effect: { kind: 'chain', jumps: 2, range: 70, mul: 0.7, dmgType: 'holy' } }), K('penance', { op: 'onCast', effect: { kind: 'shield', pct: 10, dur: 5 } })] },
  { cls: 'priest', spec: 1, id: 'rift-dawnhymn', name: 'Dawnhymn', slot: 'weapon', icon: 'staff', tint: '#ffd27a', stat: 'holy', lore: 'It hums the first line. You are expected to know the rest.', mods: [K('holy-fire', { op: 'onImpact', effect: { kind: 'explode', radius: 50, mul: 0.9, dmgType: 'holy', status: { status: 'burn', dur: 4, power: 0.25 } } }), K('holy-fire', { op: 'charges', n: 1 }), K('holy-nova', { op: 'area', pct: 30 })] },
  { cls: 'priest', spec: 2, id: 'rift-hungering-locket', name: 'The Hungering Locket', slot: 'amulet', icon: 'amulet', tint: '#8a5ac8', stat: 'shadow', lore: 'There is a portrait inside. It is never the same one twice.', mods: [K('vampiric-touch', { op: 'onHit', effect: { kind: 'chain', jumps: 3, range: 80, mul: 0.8, dmgType: 'shadow' } }), K('vampiric-touch', { op: 'onHit', effect: { kind: 'status', status: 'curse', dur: 6, power: 0.4 } }), P('hungering', 'kill', { kind: 'heal', pct: 4 }, 'A Cursed enemy that dies feeds you: 4% of your health back (once a second).', { status: 'curse', icd: 1 })] },
  /* warlock */
  { cls: 'warlock', spec: 0, id: 'rift-plaguewrit', name: 'Plaguewrit', slot: 'offhand', icon: 'tome', tint: '#7ab04a', stat: 'shadow', lore: 'Every page is a different handwriting, and all of it is a warning.', mods: [K('unstable-affliction', { op: 'onHit', effect: { kind: 'chain', jumps: 3, range: 80, mul: 1, dmgType: 'shadow' } }), K('unstable-affliction', { op: 'onHit', effect: { kind: 'explode', radius: 40, mul: 0.6, dmgType: 'shadow', status: { status: 'curse', dur: 6, power: 0.4 } } }), K('unstable-affliction', { op: 'cooldown', pct: -40 })] },
  { cls: 'warlock', spec: 1, id: 'rift-knightmakers-seal', name: 'The Knightmaker’s Seal', slot: 'relic', icon: 'relic', tint: '#c84a3a', stat: 'pet', lore: 'Press it into anything. Something will answer.', mods: [K('summon-felguard', { op: 'onCast', effect: { kind: 'summon', pet: 'felguard', count: 1, dur: 20 } }), S('pet', 35), P('knightmaker', 'ult', { kind: 'summon', pet: 'felguard', count: 2, dur: 15 }, 'Your ultimate calls two more Pit Knights to the fight for 15 s.')] },
  { cls: 'warlock', spec: 2, id: 'rift-ruinspeaker', name: 'Ruinspeaker', slot: 'weapon', icon: 'staff', tint: '#ff5a2a', stat: 'fire', lore: 'It says one word. Nobody has heard it twice.', mods: [K('chaos-bolt', { op: 'onImpact', effect: { kind: 'split', count: 4, mul: 0.4 } }), K('chaos-bolt', { op: 'onImpact', effect: { kind: 'ground', ground: { radius: 40, dur: 4, tick: 0.5, mul: 0.12, dmgType: 'fire', look: 'fire' } } }), K('chaos-bolt', { op: 'cooldown', pct: -25 })] },
  /* druid */
  { cls: 'druid', spec: 0, id: 'rift-nightpool-branch', name: 'Nightpool Branch', slot: 'weapon', icon: 'staff', tint: '#a8c8ff', stat: 'arcane', lore: 'Cut at midnight, by permission.', mods: [K('starsurge', { op: 'charges', n: 1 }), K('starsurge', { op: 'onImpact', effect: { kind: 'split', count: 3, mul: 0.4 } }), K('moonfire', { op: 'onHit', effect: { kind: 'explode', radius: 36, mul: 0.8, dmgType: 'arcane' } })] },
  { cls: 'druid', spec: 1, id: 'rift-lynxmothers-claw', name: 'Lynxmother’s Claw', slot: 'amulet', icon: 'amulet', tint: '#e0c080', stat: 'physical', lore: 'Still sharp. Still hers, really.', mods: [K('rip', { op: 'onHit', effect: { kind: 'chain', jumps: 2, range: 60, mul: 1 } }), K('rip', { op: 'cooldown', pct: -35 }), K('claw', { op: 'onHit', effect: { kind: 'heal', pct: 0.8 } })] },
  { cls: 'druid', spec: 2, id: 'rift-heartwood-totem', name: 'Heartwood Totem', slot: 'relic', icon: 'relic', tint: '#8a6a3a', stat: 'nature', lore: 'Older than the forest it came from.', mods: [K('ironfur', { op: 'onCast', effect: { kind: 'buff', buff: { id: 'rift-heartwood', name: 'Heartwood', dur: 8, color: '#8a6a3a', thorns: 0.9, dr: 10 } } }), K('thrash', { op: 'area', pct: 45 }), K('thrash', { op: 'onCast', effect: { kind: 'taunt', radius: 90, dur: 3 } })] },
  /* gloam knight */
  { cls: 'gloamknight', spec: 0, id: 'rift-creditor', name: 'The Creditor', slot: 'weapon', icon: 'sword', tint: '#a02a3a', stat: 'shadow', lore: 'It collects. With interest.', mods: [K('hollow-ward', { op: 'onCast', effect: { kind: 'nova', radius: 64, mul: 1.8, dmgType: 'shadow' } }), K('hollow-ward', { op: 'onCast', effect: { kind: 'heal', pct: 6 } }), K('hollow-ward', { op: 'cooldown', pct: -25 })] },
  { cls: 'gloamknight', spec: 1, id: 'rift-graveweight', name: 'Graveweight', slot: 'weapon', icon: 'sword', tint: '#4a3a7a', stat: 'physical', lore: 'It comes down once a day, on everything.', mods: [K('sundering-dark', { op: 'charges', n: 1 }), K('sundering-dark', { op: 'onCast', effect: { kind: 'shockwave', length: 150, width: 28, mul: 0.8 } }), K('sundering-dark', { op: 'arc', pct: 60 })] },
  { cls: 'gloamknight', spec: 2, id: 'rift-shepherds-bell', name: 'The Shepherd’s Bell', slot: 'relic', icon: 'relic', tint: '#9a8ac0', stat: 'shadow', lore: 'The flock it called is long gone. Something else comes now.', mods: [K('creeping-dread', { op: 'onHit', effect: { kind: 'chain', jumps: 3, range: 80, mul: 1, dmgType: 'shadow' } }), K('creeping-dread', { op: 'onHit', effect: { kind: 'status', status: 'curse', dur: 6, power: 0.45 } }), P('shepherd', 'kill', { kind: 'nova', radius: 60, mul: 0.9, dmgType: 'shadow', status: { status: 'curse', dur: 5, power: 0.3 } }, 'A Cursed enemy that dies tolls the bell: a burst of shadow around you that curses everything it reaches (once every 1.5 s).', { status: 'curse', icd: 1.5 })] },
];

const UNIQUE_STATS: Record<SlotId, (stat: StatKey) => ItemDef['stats']> = {
  weapon: (s) => [{ stat: 'power', base: 9, per: 1.7 }, { stat: s, base: 8, per: 1.2 }],
  offhand: (s) => [{ stat: s === 'armor' ? 'armor' : 'power', base: 6, per: 1.3 }, { stat: s === 'armor' ? 'hp' : s, base: s === 'armor' ? 14 : 6, per: s === 'armor' ? 3.2 : 1.1 }],
  amulet: (s) => [{ stat: 'power', base: 5, per: 0.9 }, { stat: s, base: 6, per: s === 'pet' ? 0.5 : 1.1 }],
  relic: (s) => [{ stat: 'power', base: 5, per: 0.9 }, { stat: s, base: 6, per: s === 'pet' || s === 'healing' ? 0.5 : 1.1 }],
  head: () => [],
  chest: () => [],
  legs: () => [],
  hands: () => [],
  feet: () => [],
  ring: () => [],
};

const UNIQUE_ITEMS: ItemDef[] = UNIQUE_SPECS.map((u) => ({
  id: u.id,
  name: u.name,
  slot: u.slot,
  rarity: 'legendary' as const,
  cls: u.cls,
  icon: u.icon,
  tint: u.tint,
  stats: UNIQUE_STATS[u.slot](u.stat),
  mods: u.mods,
  lore: u.lore,
  minLevel: 60,
  rift: RIFT_TIERS.unique,
  forSpec: u.spec,
}));

/** Every Rift-forged piece: the sets, then the pieces made for one specialization each. */
export const RIFT_ITEMS: ItemDef[] = [...SET_ITEMS, ...UNIQUE_ITEMS];

/** The set an item belongs to, if it belongs to one. */
export const setOf = (item: Pick<ItemDef, 'set'> | undefined): SetDef | undefined => (item?.set ? SETS[item.set] : undefined);

/** A class's Rift-forged pieces a hero with this stone can find, earliest first (sets before the specialization pieces). */
export function riftPool(cls: ClassId, stone: number): ItemDef[] {
  return RIFT_ITEMS.filter((d) => d.cls === cls && (d.rift ?? 0) <= stone).sort((a, b) => (a.rift ?? 0) - (b.rift ?? 0));
}
