import type { ClassId } from '../data/types';

/**
 * The Ring's talents: three rows, one choice from each, on top of the bar and the oath. Most sharpen one ability, so a
 * set of talents only pays if the bar holds what it sharpens: that is what makes one set up different from another.
 * Plain data with no imports but types: the icon build reads it.
 */

/** How a talent changes one ability: multiplies its strength, cooldown, cast time, or how long what it does lasts. */
export interface Tune {
  power?: number;
  cd?: number;
  cast?: number;
  dur?: number;
}

export interface Talent {
  id: string;
  cls: ClassId;
  row: 0 | 1 | 2;
  name: string;
  text: string;
  /** Its own icon; without one it wears the ability it sharpens. */
  icon?: string;
  tune?: Record<string, Tune>;
  hp?: number;
  dmg?: number;
  heal?: number;
  speed?: number;
  tenacity?: number;
  /** More mana back each second. */
  regen?: number;
}

export const ROW_NAMES = ['Power', 'Control', 'Staying alive'] as const;

const HP = 'toughness_heart_mastery_on_red';
const WILL = 'broken_chain_on_black';
const MIND = 'magic_up_status_star_arrow_up_on_violet';

const rowOf = (cls: ClassId, row: 0 | 1 | 2, list: Omit<Talent, 'cls' | 'row' | 'id'>[], prefix: string): Talent[] => list.map((x, i) => ({ ...x, cls, row, id: `${prefix}-${row + 1}${'abc'[i]}` }));

export const TALENTS: Record<ClassId, Talent[]> = {
  warrior: [
    ...rowOf('warrior', 0, [
      { name: 'Butcher’s Edge', text: 'Hew hits 25% harder.', tune: { 'w-hew': { power: 1.25 } } },
      { name: 'Open Veins', text: 'Rending Cut bleeds 40% more and comes back 2 seconds sooner.', tune: { 'w-bleed': { power: 1.4, cd: 0.8 } } },
      { name: 'Headsman’s Patience', text: 'Festering Gash hits 35% harder.', tune: { 'w-gash': { power: 1.35 } } },
    ], 'w'),
    ...rowOf('warrior', 1, [
      { name: 'Long Arm', text: 'Hurled Maul comes back in 20 seconds.', tune: { 'w-hurl': { cd: 2 / 3 } } },
      { name: 'Great Lungs', text: 'War Bellow’s fear lasts 40% longer.', tune: { 'w-shout': { dur: 1.4 } } },
      { name: 'Relentless', text: 'Bull Rush comes back in 10 seconds.', tune: { 'w-rush': { cd: 0.625 } } },
    ], 'w'),
    ...rowOf('warrior', 2, [
      { name: 'Thick Hide', text: '+10% health.', icon: HP, hp: 0.1 },
      { name: 'Stubborn', text: 'Held 20% shorter.', icon: WILL, tenacity: 0.2 },
      { name: 'Second Wind', text: 'Iron Stance comes back in 50 seconds.', tune: { 'w-stand': { cd: 0.625 } } },
    ], 'w'),
  ],
  mage: [
    ...rowOf('mage', 0, [
      { name: 'Kindled', text: 'Ember Lash casts in 1.5 seconds.', tune: { 'm-lash': { cast: 1.5 / 1.8 } } },
      { name: 'Winter’s Bite', text: 'Rime Spear hits 20% harder.', tune: { 'm-spear': { power: 1.2 } } },
      { name: 'Searing Mind', text: 'Great Pyre comes back in 10 seconds.', tune: { 'm-pyre': { cd: 0.625 } } },
    ], 'm'),
    ...rowOf('mage', 1, [
      { name: 'Long Hex', text: 'Toad Hex lasts 30% longer.', tune: { 'm-toad': { dur: 1.3 } } },
      { name: 'Hard Frost', text: 'Frost Snare comes back in 16 seconds.', tune: { 'm-ring': { cd: 2 / 3 } } },
      { name: 'Quick Snap', text: 'Spell Snap comes back in 14 seconds.', tune: { 'm-snap': { cd: 0.7 } } },
    ], 'm'),
    ...rowOf('mage', 2, [
      { name: 'Deep Veil', text: 'Mana Veil soaks up 40% more.', tune: { 'm-shield': { power: 1.4 } } },
      { name: 'Restless', text: 'Flicker comes back in 10 seconds.', tune: { 'm-blink': { cd: 0.625 } } },
      { name: 'Winter’s Keep', text: 'Ice Prison comes back in 70 seconds.', tune: { 'm-prison': { cd: 7 / 11 } } },
    ], 'm'),
  ],
  ranger: [
    ...rowOf('ranger', 0, [
      { name: 'Fletcher’s Eye', text: 'Swift Shot hits 20% harder.', tune: { 'r-swift': { power: 1.2 } } },
      { name: 'Steady Hand', text: 'Long Draw casts in 1.5 seconds.', tune: { 'r-aimed': { cast: 1.5 / 1.9 } } },
      { name: 'Black Venom', text: 'Adder’s Kiss poisons 40% more.', tune: { 'r-venom': { power: 1.4 } } },
    ], 'r'),
    ...rowOf('ranger', 1, [
      { name: 'Trapper’s Hands', text: 'Snapjaw Trap comes back in 16 seconds.', tune: { 'r-trap': { cd: 8 / 13 } } },
      { name: 'Bold Hawk', text: 'Hawk’s Dive stuns a second longer.', tune: { 'r-hawk': { dur: 4 / 3 } } },
      { name: 'Hunter’s Hush', text: 'Hushing Arrow comes back in 15 seconds.', tune: { 'r-hush': { cd: 15 / 22 } } },
    ], 'r'),
    ...rowOf('ranger', 2, [
      { name: 'Light Feet', text: 'Spring Away comes back in 9 seconds.', tune: { 'r-leap': { cd: 9 / 14 } } },
      { name: 'Old Instinct', text: 'Turn Aside comes back in 50 seconds.', tune: { 'r-deter': { cd: 0.625 } } },
      { name: 'Trail Hardened', text: '+10% health.', icon: HP, hp: 0.1 },
    ], 'r'),
  ],
  priest: [
    ...rowOf('priest', 0, [
      { name: 'Gentle Hands', text: 'Knit Wounds heals 18% more.', tune: { 'p-mend': { power: 1.18 } } },
      { name: 'Long Morning', text: 'Dawnlight heals 30% more.', tune: { 'p-renew': { power: 1.3 } } },
      { name: 'Bitter Word', text: 'Word of Decay burns 30% more.', tune: { 'p-curse': { power: 1.3 } } },
    ], 'p'),
    ...rowOf('priest', 1, [
      { name: 'Terrible Voice', text: 'Wail of Dread comes back in 22 seconds.', tune: { 'p-wail': { cd: 22 / 32 } } },
      { name: 'Vow of Quiet', text: 'Word of Silence comes back in 24 seconds.', tune: { 'p-hush': { cd: 2 / 3 } } },
      { name: 'Clear Sight', text: 'Clearing Word comes back in 3 seconds.', tune: { 'p-cleanse': { cd: 0.5 } } },
    ], 'p'),
    ...rowOf('priest', 2, [
      { name: 'Unshaken Faith', text: 'Ward of Faith soaks up 35% more.', tune: { 'p-ward': { power: 1.35 } } },
      { name: 'Ready Grace', text: 'Last Grace comes back in 60 seconds.', tune: { 'p-grace': { cd: 0.6 } } },
      { name: 'Quiet Mind', text: 'Mana comes back 50% faster.', icon: MIND, regen: 0.5 },
    ], 'p'),
  ],
  paladin: [
    ...rowOf('paladin', 0, [
      { name: 'Heavy Oath', text: 'Oath Blow hits 20% harder.', tune: { 'd-blow': { power: 1.2 } } },
      { name: 'Swift Verdict', text: 'Verdict comes back in 4 seconds.', tune: { 'd-judge': { cd: 2 / 3 } } },
      { name: 'Warm Hands', text: 'Dawn’s Touch heals 18% more.', tune: { 'd-flash': { power: 1.18 } } },
    ], 'd'),
    ...rowOf('paladin', 1, [
      { name: 'Strong Arm', text: 'Hammer of Oaths comes back in 24 seconds.', tune: { 'd-hammer': { cd: 2 / 3 } } },
      { name: 'Sudden Shame', text: 'Moment of Shame casts in half the time.', tune: { 'd-repent': { cast: 0.5 } } },
      { name: 'Short Temper', text: 'Stern Word comes back in 9 seconds.', tune: { 'd-rebuke': { cd: 9 / 14 } } },
    ], 'd'),
    ...rowOf('paladin', 2, [
      { name: 'Unbroken Vow', text: 'Dawn Shell comes back in 100 seconds.', tune: { 'd-shell': { cd: 2 / 3 } } },
      { name: 'Open Hands', text: 'Laying On comes back in 80 seconds.', tune: { 'd-hands': { cd: 2 / 3 } } },
      { name: 'Plate and Prayer', text: '+10% health.', icon: HP, hp: 0.1 },
    ], 'd'),
  ],
  warlock: [
    ...rowOf('warlock', 0, [
      { name: 'Slow Rot', text: 'Creeping Agony burns 25% more.', tune: { 'k-agony': { power: 1.25 } } },
      { name: 'Practiced Gloom', text: 'Gloom Bolt casts in 1.6 seconds.', tune: { 'k-bolt': { cast: 1.6 / 1.9 } } },
      { name: 'Utter Ruin', text: 'Ruin hits 25% harder.', tune: { 'k-chaos': { power: 1.25 } } },
    ], 'k'),
    ...rowOf('warlock', 1, [
      { name: 'Long Stare', text: 'Dread Gaze lasts 30% longer.', tune: { 'k-dread': { dur: 1.3 } } },
      { name: 'Pit’s Voice', text: 'Howl of the Pit comes back in 24 seconds.', tune: { 'k-howl': { cd: 2 / 3 } } },
      { name: 'Hard Seal', text: 'Spell Seal comes back in 15 seconds.', tune: { 'k-lock': { cd: 15 / 22 } } },
    ], 'k'),
    ...rowOf('warlock', 2, [
      { name: 'Better Bargain', text: 'Black Bargain soaks up 40% more.', tune: { 'k-pact': { power: 1.4 } } },
      { name: 'Deep Thirst', text: 'Soul Drink drains 40% more.', tune: { 'k-drain': { power: 1.4 } } },
      { name: 'Old Resolve', text: 'Dread Resolve comes back in 50 seconds.', tune: { 'k-resolve': { cd: 0.625 } } },
    ], 'k'),
  ],
  druid: [
    ...rowOf('druid', 0, [
      { name: 'Bright Stars', text: 'Starlash hits 20% harder.', tune: { 'l-lash': { power: 1.2 } } },
      { name: 'Red Moon', text: 'Moonburn burns 30% more.', tune: { 'l-moon': { power: 1.3 } } },
      { name: 'Green Thumb', text: 'Green Mending heals 18% more.', tune: { 'l-regrow': { power: 1.18 } } },
    ], 'l'),
    ...rowOf('druid', 1, [
      { name: 'Restless Wind', text: 'Whirling Gale comes back in 7 seconds.', tune: { 'l-gale': { cd: 7 / 12 } } },
      { name: 'Old Roots', text: 'Grasping Roots hold 30% longer.', tune: { 'l-roots': { dur: 1.3 } } },
      { name: 'Quick Thorn', text: 'Thornsnap comes back in 12 seconds.', tune: { 'l-snap': { cd: 2 / 3 } } },
    ], 'l'),
    ...rowOf('druid', 2, [
      { name: 'Ironbark', text: 'Oakhide comes back in 30 seconds.', tune: { 'l-bark': { cd: 0.6 } } },
      { name: 'Young Stag', text: 'Stag’s Bound comes back in 15 seconds.', tune: { 'l-bound': { cd: 0.625 } } },
      { name: 'Deep Roots', text: '+10% health.', icon: HP, hp: 0.1 },
    ], 'l'),
  ],
};

export const TALENT_BY_ID: Record<string, Talent> = Object.fromEntries(Object.values(TALENTS).flat().map((x) => [x.id, x]));

/** One from each row at most: anything else in a list of choices is dropped. */
export function cleanTalents(cls: ClassId, ids: readonly string[] | undefined): Talent[] {
  const out: Talent[] = [];
  for (const id of ids ?? []) {
    const x = TALENT_BY_ID[id];
    if (x && x.cls === cls && !out.some((o) => o.row === x.row)) out.push(x);
  }
  return out;
}

/** The icons that aren't an ability's (and the new-rank banner's), for the icon build. */
export const talentIcons = (): string[] => [HP, WILL, MIND, 'crit_up_status_star_burst_on_gold'];
