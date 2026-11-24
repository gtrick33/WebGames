import type { BuffDef, ClassId, DmgType, Effect, Empower, GroundSpec, ItemIcon, Mod, ProcDef, SkillOp, SlotId, StatKey, StatusId } from './types';

/**
 * A legendary for every place a hero wears (the owner, 2026-11-24: "every item slot should have a legendary for each
 * spec and 3 legendaries common for the class apart from the set items which look good right now. check every class
 * and fix it"). For every class, on every place but the weapon (the weapons are data/riftgear.ts WEAPON_SPECS), three
 * of the class's own, good for all three specializations, and one for each specialization.
 *
 * - A class's own change what all three specializations use: the basic attack, the dodge, the ultimate whichever it
 *   is, the skills every one of them can put on the bar, and triggers on a hit, a kill, a blow taken or the passing of
 *   a fight. Only where the class's Rift legendaries of before (riftgear.ts LEGENDARY_SPECS) already stand on a place
 *   are there fewer here, so that every place has its three.
 * - A specialization's are built on what that specialization's talents and combo build on: its ability, its
 *   ultimate, the skills of its bar and of its tree, and its points (Fury, Sparks, Fangs...), which its talents spend.
 *
 * Every one does something a stat alone doesn't: an echo, a skill made ready, a charge, a shield, a status laid, a
 * point or a resource given, a trigger. Every name and line is Sigilfall's own (LEGAL_REVIEW.md).
 */

/** A place other than the weapon. */
export type LegendSlot = Exclude<SlotId, 'weapon'>;

export interface SlotLegend {
  cls: ClassId;
  /** The specialization it is made for (its index); none: the class's own, good for all three. */
  spec?: 0 | 1 | 2;
  slot: LegendSlot;
  id: string;
  name: string;
  tint: string;
  /** The stat its numbers lean to. */
  stat: StatKey;
  lore: string;
  mods: Mod[];
  /** Its look, where it isn't the place's own for the class (riftgear.ts legendIcon). */
  icon?: ItemIcon;
}

/* ------------------------------------------------------------------ writing them down (as riftgear.ts writes its own) */

const K = (skill: string, op: SkillOp): Mod => ({ t: 'skill', skill, op });
const S = (stat: StatKey, v: number, when?: 'lowHp' | 'afterDodge'): Mod => (when ? { t: 'stat', stat, v, when } : { t: 'stat', stat, v });
type ProcOpts = Partial<Pick<ProcDef, 'chance' | 'icd' | 'skill' | 'status' | 'dmgType'>>;
const P = (id: string, on: ProcDef['on'], effect: Effect, text: string, o: ProcOpts = {}): Mod => ({
  t: 'proc',
  proc: { id: `rift-${id}`, on, chance: o.chance ?? 1, icd: o.icd ?? 0, effect, text, ...(o.skill ? { skill: o.skill } : {}), ...(o.status ? { status: o.status } : {}), ...(o.dmgType ? { dmgType: o.dmgType } : {}) },
});

// what a skill does more of
const D = (skill: string, pct: number): Mod => K(skill, { op: 'damage', pct });
/** Comes back `pct`% sooner. */
const CD = (skill: string, pct: number): Mod => K(skill, { op: 'cooldown', pct });
const HIT = (skill: string, effect: Effect): Mod => K(skill, { op: 'onHit', effect });
const CAST = (skill: string, effect: Effect): Mod => K(skill, { op: 'onCast', effect });
const KILL = (skill: string, effect: Effect): Mod => K(skill, { op: 'onKill', effect });
const LAND = (skill: string, effect: Effect): Mod => K(skill, { op: 'onImpact', effect });
/** A field left along a dash's path. */
const TRAIL = (skill: string, mul: number, dmgType: DmgType, look: GroundSpec['look'], status?: GroundSpec['status']): Mod => K(skill, { op: 'trail', ground: { radius: 22, dur: 3, tick: 0.5, mul, dmgType, look, ...(status ? { status } : {}) } });

// what happens
type Laid = { status: StatusId; dur: number; power: number };
const AS = (status: StatusId, dur: number, power: number): Laid => ({ status, dur, power });
const ST = (status: StatusId, dur: number, power: number, chance?: number): Effect => ({ kind: 'status', status, dur, power, ...(chance ? { chance } : {}) });
const BOOM = (radius: number, mul: number, dmgType?: DmgType, status?: Laid): Effect => ({ kind: 'explode', radius, mul, ...(dmgType ? { dmgType } : {}), ...(status ? { status } : {}) });
const NOVA = (radius: number, mul: number, dmgType?: DmgType, status?: Laid): Effect => ({ kind: 'nova', radius, mul, ...(dmgType ? { dmgType } : {}), ...(status ? { status } : {}) });
const WAVE = (mul: number, length = 130, width = 24): Effect => ({ kind: 'shockwave', length, width, mul });
const ARC = (jumps: number, mul: number, dmgType?: DmgType, range = 80): Effect => ({ kind: 'chain', jumps, range, mul, ...(dmgType ? { dmgType } : {}) });
const HEAL = (pct: number): Effect => ({ kind: 'heal', pct });
const WARD = (pct: number, dur: number): Effect => ({ kind: 'shield', pct, dur });
/** The class's resource: Rage, Focus, Zeal or Umbra as points, mana as a share of the pool. */
const RES = (n: number): Effect => ({ kind: 'resource', n });
/** The specialization's points (data/types.ts PointsDef). */
const PTS = (n: number): Effect => ({ kind: 'points', n });
const READY = (skill: string): Effect => ({ kind: 'resetCd', skill });
const CDR = (s: number): Effect => ({ kind: 'cdr', s });
const CHARGE = (pct: number): Effect => ({ kind: 'charge', pct });
const TEAR = (mul: number, radius = 52, delay = 0.5): Effect => ({ kind: 'riftBurst', radius, mul, delay });
const TAUNT = (radius: number, dur: number): Effect => ({ kind: 'taunt', radius, dur });
const FEAR = (radius: number, dur: number): Effect => ({ kind: 'fear', radius, dur });
const PULL = (radius: number, force: number): Effect => ({ kind: 'pull', radius, force });
const SUMMON = (pet: string, count: number, dur: number): Effect => ({ kind: 'summon', pet, count, dur });
const CLEANSE: Effect = { kind: 'cleanse' };
const GROUND = (radius: number, dur: number, mul: number, dmgType: DmgType, look: GroundSpec['look'], more: Partial<GroundSpec> = {}): Effect => ({ kind: 'ground', ground: { radius, dur, tick: 0.5, mul, dmgType, look, ...more } });
/** An echo of one of the hero's skills (data/types.ts Effect 'cast'). */
const ECHO = (skill: string, mul: number, times = 1): Effect => ({ kind: 'cast', skill, mul, ...(times > 1 ? { times, gap: 0.3 } : {}) });
/** By itself, every `every` seconds in a fight: an echo of a skill. */
const EVERY = (id: string, every: number, skill: string, mul: number, text: string): Mod => P(id, 'tick', ECHO(skill, mul), text, { icd: every });
const BUFF = (id: string, name: string, dur: number, color: string, b: Omit<BuffDef, 'id' | 'name' | 'dur' | 'color'>): Effect => ({ kind: 'buff', buff: { id: `rift-${id}`, name, dur, color, ...b } });
/** A buff that makes the hero's next cast of a skill more than it is. */
const NEXT = (skill: string, how: Omit<Empower, 'skill'>): Pick<BuffDef, 'empower'> => ({ empower: { skill, ...how } });

/** Place, specialization (null: the class's own), id, name, tint, the stat it leans to, its line, what it does. */
type Row = [LegendSlot, 0 | 1 | 2 | null, string, string, string, StatKey, string, Mod[], ItemIcon?];
const of = (cls: ClassId, rows: Row[]): SlotLegend[] =>
  rows.map(([slot, spec, id, name, tint, stat, lore, mods, icon]) => ({ cls, slot, ...(spec === null ? {} : { spec }), id, name, tint, stat, lore, mods, ...(icon ? { icon } : {}) }));

/* ------------------------------------------------------------------ the Warrior: Berserker, Guardian, Weaponmaster */

const WARRIOR: Row[] = [
  // off-hand (the class's third is The Last Gate)
  ['offhand', null, 'rift-bellwether', 'The Bellwether', '#b8a070', 'armor', 'Where it goes up, the line follows.', [CD('battle-shout', 30), CAST('battle-shout', RES(20)), CAST('battle-shout', WARD(12, 6))]],
  ['offhand', null, 'rift-millstone-aegis', 'Millstone Aegis', '#9a9488', 'armor', 'It was turning grain when the war came. It turns other things now.', [K('shield-bash', { op: 'charges', n: 1 }), LAND('shield-bash', BOOM(44, 0.7))]],
  ['offhand', 0, 'rift-bloodied-buckler', 'The Bloodied Buckler', '#a8282a', 'physical', 'Nobody carries it for the defense.', [P('bloodied-buckler', 'hurt', BUFF('bloodied-buckler', 'Bloodied', 6, '#a8282a', { stats: { power: 8, haste: 8 }, max: 3 }), 'A blow taken stokes your blood: +8% damage and +8% haste for 6 s, stacking three times (once a second).', { icd: 1 }), D('bloodthirst', 30)]],
  ['offhand', 1, 'rift-anvil-of-the-pass', 'Anvil of the Pass', '#8a94a8', 'armor', 'Armies broke on it. It kept the dents as a ledger.', [CD('shield-wall', 30), CAST('shield-wall', TAUNT(90, 4)), S('armor', 15)]],
  ['offhand', 2, 'rift-parrying-hook', 'The Parrying Hook', '#c0b8a8', 'physical', 'Half shield, half hook, entirely unfair.', [P('parrying-hook', 'hurt', READY('mortal-strike'), 'A blow taken may be turned: one in four makes Grievous Strike ready at once (once every 5 s).', { chance: 0.25, icd: 5 }), HIT('mortal-strike', ST('armorBreak', 5, 15))]],
  // head
  ['head', null, 'rift-grudgehelm', 'Grudgehelm', '#7a7e8a', 'physical', 'It remembers every face that struck it.', [S('power', 20, 'lowHp'), P('grudgehelm', 'hurt', RES(8), 'A blow taken gives 8 Rage (once every 0.5 s).', { icd: 0.5 })]],
  ['head', null, 'rift-visor-of-the-long-watch', 'Visor of the Long Watch', '#a8aec0', 'crit', 'Nothing came over the hill that it did not see first.', [S('crit', 5), P('long-watch', 'crit', RES(5), 'A critical hit gives 5 Rage (once every 0.4 s).', { icd: 0.4 })]],
  ['head', null, 'rift-stormbrow', 'Stormbrow', '#8a9ab8', 'physical', 'When it frowns, the ground does too.', [D('thunder-clap', 40), HIT('thunder-clap', ST('stun', 0.6, 1)), CD('thunder-clap', 20)]],
  ['head', 0, 'rift-red-crest', 'The Red Crest', '#d03030', 'physical', 'Easy to follow into a fight. Hard to keep up with.', [K('red-tempest', { op: 'duration', pct: 30 }), P('red-crest', 'kill', PTS(1), 'A kill gives a point of Fury (once every 0.5 s).', { icd: 0.5 })]],
  ['head', 1, 'rift-gatewardens-helm', 'Gatewarden’s Helm', '#9aa0b0', 'armor', 'The gate fell. The warden did not.', [K('heavy-strike', { op: 'combo', combo: {}, add: 0.3 }), HIT('heavy-strike', HEAL(2))]],
  ['head', 2, 'rift-reckoners-visor', 'The Reckoner’s Visor', '#e0d8c8', 'physical', 'It sees exactly where it will hurt most.', [K('thousand-cuts', { op: 'range', pct: 30 }), CAST('thousand-cuts', BUFF('reckoner', 'Reckoning', 6, '#e0d8c8', { stats: { crit: 15, critDmg: 20 } }))]],
  // chest
  ['chest', null, 'rift-scarred-cuirass', 'The Scarred Cuirass', '#8a8070', 'armor', 'Every scar on it was meant for someone behind it.', [S('armor', 20), P('scarred-cuirass', 'hurt', BUFF('scarred-cuirass', 'Scar Tissue', 5, '#8a8070', { dr: 10, thorns: 0.8 }), 'A blow taken hardens you: 10% less damage taken, and you strike back at whatever hits you, for 5 s (once every 8 s).', { icd: 8 })]],
  ['chest', null, 'rift-roaring-hauberk', 'The Roaring Hauberk', '#c8a870', 'hpPct', 'Its rivets rattle a little before every fight.', [CD('rallying-roar', 30), CAST('rallying-roar', NOVA(70, 1.2)), CAST('rallying-roar', RES(25))]],
  ['chest', null, 'rift-spinward-plate', 'Spinward Plate', '#b0b4c0', 'physical', 'Built to be in motion. Standing still makes it nervous.', [K('whirlwind', { op: 'duration', pct: 30 }), HIT('whirlwind', HEAL(0.5))]],
  ['chest', 0, 'rift-gorged-hauberk', 'The Gorged Hauberk', '#9a2a30', 'physical', 'It fits better after a meal.', [HIT('bloodthirst', ST('bleed', 4, 0.3)), K('whirlwind', { op: 'build', n: 1 })]],
  ['chest', 1, 'rift-bastion-of-nine-winters', 'Bastion of Nine Winters', '#a0a8b8', 'armor', 'Nine sieges, nine winters, one breastplate.', [K('shield-wall', { op: 'duration', pct: 40 }), CAST('shield-wall', BUFF('nine-winters', 'Ninth Winter', 6, '#a0a8b8', { hot: 3 }))]],
  ['chest', 2, 'rift-hemmed-in-red', 'Hemmed in Red', '#902830', 'physical', 'The red at the hem was not dyed.', [P('hemmed-red', 'kill', RES(15), 'A Bleeding enemy that dies gives 15 Rage (once every 0.5 s).', { status: 'bleed', icd: 0.5 }), KILL('mortal-strike', HEAL(3))]],
  // legs
  ['legs', null, 'rift-marchers-greaves', 'Marcher’s Greaves', '#9a9080', 'speed', 'Four hundred miles, and not one of them was a retreat.', [S('speed', 8), CD('charge', 25), LAND('charge', WAVE(0.8))]],
  ['legs', null, 'rift-bargebreakers', 'The Bargebreakers', '#7a6a5a', 'physical', 'They have walked through doors that were not open.', [HIT('dodge', ST('stun', 0.5, 1)), P('bargebreakers', 'dodge', BUFF('bargebreakers', 'Momentum', 4, '#7a6a5a', { stats: { power: 15 } }), 'Every Shoulder Barge carries on: +15% damage for 4 s.')]],
  ['legs', null, 'rift-tassets-of-the-hold', 'Tassets of the Hold', '#a8a090', 'armor', 'They do not bend. That is rather the point.', [S('armor', 20), S('hpPct', 10, 'lowHp'), P('hold', 'hurt', CDR(0.5), 'A blow taken takes 0.5 s off your cooldowns (once a second).', { icd: 1 })]],
  ['legs', 0, 'rift-galloping-red', 'The Galloping Red', '#c03838', 'haste', 'They have never once arrived late to a fight.', [D('red-tempest', 30), P('galloping-red', 'dodge', PTS(2), 'Every Shoulder Barge gives two points of Fury.')]],
  ['legs', 1, 'rift-rampart-greaves', 'Rampart Greaves', '#8a94a8', 'armor', 'Plant them and the hill moves first.', [D('shield-bash', 40), HIT('shield-bash', TAUNT(60, 3))]],
  ['legs', 2, 'rift-lunging-greaves', 'Lunging Greaves', '#d8d0c0', 'physical', 'Every step is the first half of a cut.', [K('mortal-strike', { op: 'afterDodge', window: 2, pct: 50 }), P('lunging-greaves', 'dodge', READY('heavy-strike'), 'Every Shoulder Barge makes Heavy Strike ready at once (once every 6 s).', { icd: 6 })]],
  // hands
  ['hands', null, 'rift-knucklebreakers', 'Knucklebreakers', '#9a9ea8', 'physical', 'Named for what they did, not to whom.', [D('heavy-strike', 35), HIT('heavy-strike', ST('armorBreak', 5, 15))]],
  ['hands', null, 'rift-hewers-gauntlets', 'Hewer’s Gauntlets', '#b8b0a0', 'physical', 'Wear them long enough and every door looks like firewood.', [K('cleave', { op: 'arc', pct: 30 }), HIT('cleave', ST('bleed', 3, 0.2, 0.25))]],
  ['hands', null, 'rift-chainhand', 'Chainhand', '#7a7e8a', 'physical', 'It has never once let go of anything.', [CD('hookchain', 30), HIT('hookchain', READY('heavy-strike')), D('sundering-throw', 30)]],
  ['hands', 0, 'rift-gnawing-gauntlets', 'Gnawing Gauntlets', '#a02028', 'physical', 'They itch until they are used.', [K('bloodthirst', { op: 'charges', n: 1 }), K('bloodthirst', { op: 'spend', per: 0.05 })]],
  ['hands', 1, 'rift-sentinels-grasp', 'Sentinel’s Grasp', '#9aa0b0', 'armor', 'It holds the line by the collar.', [HIT('hookchain', ST('stun', 1, 1)), P('sentinels-grasp', 'hit', PTS(1), 'Shield Bash striking an enemy gives a point of Resolve (once a second).', { skill: 'shield-bash', icd: 1 })]],
  ['hands', 2, 'rift-woundwrights-gauntlets', 'Woundwright’s Gauntlets', '#b03040', 'physical', 'Each finger was forged to find a seam.', [CD('crippling-hew', 30), HIT('crippling-hew', READY('mortal-strike')), D('mortal-strike', 25)]],
  // feet
  ['feet', null, 'rift-quakestep-sabatons', 'Quakestep Sabatons', '#8a7a6a', 'physical', 'Every step is a small argument with the ground.', [S('speed', 6), P('quakestep', 'dodge', NOVA(56, 1.2), 'Every Shoulder Barge ends in a stamp: a quake around you (once every 2 s).', { icd: 2 })]],
  ['feet', null, 'rift-mile-eaters', 'Mile-Eaters', '#a09078', 'speed', 'The road is shorter for whoever wears them, and so is the fight.', [CD('ground-breaker', 30), LAND('ground-breaker', BOOM(60, 0.8)), S('speed', 8)]],
  ['feet', null, 'rift-sabatons-of-the-last-rank', 'Sabatons of the Last Rank', '#8a8e9a', 'armor', 'The last rank does not move. That is why it is the last.', [S('armor', 15), P('last-rank', 'hurt', BUFF('last-rank', 'Hold the Rank', 4, '#8a8e9a', { dr: 15 }), 'A blow taken digs you in: 15% less damage taken for 4 s (once every 10 s).', { icd: 10 })]],
  ['feet', 0, 'rift-the-runnels', 'The Runnels', '#b02a2a', 'haste', 'They leave a trail. Nobody follows it.', [P('runnels', 'kill', BUFF('runnels', 'Running Red', 4, '#b02a2a', { stats: { speed: 20, haste: 10 } }), 'Every kill: 20% quicker and +10% haste for 4 s.'), K('cleave', { op: 'build', n: 1 })]],
  ['feet', 1, 'rift-the-unmoved', 'The Unmoved', '#9aa0b0', 'armor', 'Shove all you like.', [P('unmoved', 'hurt', CHARGE(3), 'A blow taken charges your ultimate by 3% (once a second).', { icd: 1 }), D('earthsplitter', 30)]],
  ['feet', 2, 'rift-bladewalkers', 'Bladewalkers', '#c8c0b0', 'physical', 'They go where the blade has already been.', [P('bladewalkers', 'dodge', BUFF('bladewalkers', 'Edge Drawn', 3, '#c8c0b0', { stats: { crit: 20 } }), 'Every Shoulder Barge draws the edge: +20% critical chance for 3 s.'), K('mortal-strike', { op: 'bonusVs', status: 'bleed', pct: 20 })]],
  // amulet
  ['amulet', null, 'rift-warhorn-pendant', 'The Warhorn Pendant', '#c89a50', 'ultCharge', 'Blow it once, and every sword in the valley answers.', [S('ultCharge', 15), P('warhorn', 'ult', RES(50), 'Your ultimate gives 50 Rage.')]],
  ['amulet', null, 'rift-torc-of-the-unbowed', 'Torc of the Unbowed', '#b8a070', 'hpPct', 'Its wearers bowed to no one. Several tried to make them.', [S('hpPct', 10), P('unbowed', 'hurt', HEAL(4), 'A blow taken mends 4% of your health (once every 6 s).', { icd: 6 })]],
  ['amulet', null, 'rift-ironjaw-locket', 'The Ironjaw Locket', '#8a8e9a', 'critDmg', 'Inside is a single broken tooth, and a date.', [K('ult', { op: 'damage', pct: 30 }), P('ironjaw', 'ult', READY('heavy-strike'), 'Your ultimate makes Heavy Strike ready at once.')]],
  ['amulet', 0, 'rift-fang-of-the-fourth-day', 'Fang of the Fourth Day', '#c83030', 'physical', 'Three days without. On the fourth day, it ate.', [P('fourth-day', 'ult', PTS(5), 'Your ultimate fills your Fury to five as it begins.'), KILL('red-tempest', HEAL(3))]],
  ['amulet', 1, 'rift-keystone-of-the-wall', 'Keystone of the Wall', '#a8a8b0', 'armor', 'Pull it out and the whole wall comes down. Nobody has managed.', [HIT('earthsplitter', ST('weaken', 5, 20)), P('keystone-wall', 'ult', BUFF('keystone-wall', 'Keystone', 8, '#a8a8b0', { dr: 20 }), 'Your ultimate sets you like a keystone: 20% less damage taken for 8 s.')]],
  ['amulet', 2, 'rift-whetstone-pendant', 'The Whetstone Pendant', '#d8d0c0', 'critDmg', 'Worn smooth by a thumb that never stopped.', [D('thousand-cuts', 35), P('whetstone', 'ult', BUFF('whetstone', 'Honed', 8, '#d8d0c0', NEXT('mortal-strike', { pct: 40, casts: 2 })), 'Your ultimate hones the edge: your next two Grievous Strikes hit 40% harder (for 8 s).')]],
  // ring
  ['ring', null, 'rift-sergeants-signet', 'The Sergeant’s Signet', '#c8a860', 'power', 'It has sealed a thousand orders. Every one of them said forward.', [S('power', 6), P('sergeant', 'kill', RES(6), 'Every kill gives 6 Rage (once every 0.3 s).', { icd: 0.3 })]],
  ['ring', null, 'rift-the-iron-knot', 'The Iron Knot', '#8a8e9a', 'critDmg', 'Tied by a smith who did not believe in untying.', [S('critDmg', 25), P('iron-knot', 'crit', BUFF('iron-knot', 'Knotted', 4, '#8a8e9a', { stats: { armor: 10, power: 5 }, max: 4 }), 'Every critical hit draws the knot tighter: +10 armor and +5% damage for 4 s, stacking four times (once every 0.5 s).', { icd: 0.5 })]],
  ['ring', null, 'rift-ring-of-the-turning-blade', 'Ring of the Turning Blade', '#b8bcc8', 'physical', 'Spin it on a table and it does not stop until you ask.', [K('whirlwind', { op: 'area', pct: 25 }), HIT('whirlwind', RES(1))]],
  ['ring', 0, 'rift-band-of-red-teeth', 'Band of Red Teeth', '#b02028', 'crit', 'Something bit it once, and it bit back.', [S('crit', 4), P('red-teeth', 'crit', READY('bloodthirst'), 'A critical hit may make Blood Hunger ready at once (one in four, once every 3 s).', { chance: 0.25, icd: 3 })]],
  ['ring', 1, 'rift-ring-of-the-held-line', 'Ring of the Held Line', '#9aa0b0', 'hp', 'Every name on the inside held. There is room for one more.', [CD('shield-bash', 25), HIT('shield-bash', WARD(10, 4))]],
  ['ring', 2, 'rift-ring-of-the-open-vein', 'Ring of the Open Vein', '#a82a2a', 'physical', 'Cold metal. Warm stone. Do not ask whose.', [K('cleave', { op: 'bonusVs', status: 'bleed', pct: 30 }), P('open-vein', 'hit', PTS(1), 'Cleave striking a Bleeding enemy gives a point of Edge (once every 0.5 s).', { skill: 'cleave', status: 'bleed', icd: 0.5 })]],
  // relic
  ['relic', null, 'rift-the-drumskin', 'The Drumskin', '#a07050', 'haste', 'Beat it once and your heart keeps the time.', [S('haste', 6), P('drumskin', 'kill', CDR(0.6), 'Every kill takes 0.6 s off your cooldowns (once every 0.3 s).', { icd: 0.3 })]],
  ['relic', null, 'rift-last-banners-scrap', 'The Last Banner’s Scrap', '#c83a30', 'physical', 'All that came back from the field. It was enough.', [P('banner-scrap', 'tick', BUFF('banner-scrap', 'Rally', 3, '#c83a30', { stats: { power: 12, armor: 10 } }), 'Every 5 s in a fight the banner rallies you: +12% damage and +10 armor for 3 s.', { icd: 5 })]],
  ['relic', null, 'rift-grindstone-heart', 'Grindstone Heart', '#8a8478', 'physical', 'It turns, slowly, against everything.', [EVERY('grindstone', 5, 'heavy-strike', 0.8, 'Every 5 s in a fight: an echo of Heavy Strike at the nearest enemy, at 80%.')]],
  ['relic', 0, 'rift-idol-of-the-open-mouth', 'Idol of the Open Mouth', '#b82830', 'physical', 'Feed it, and it feeds you. Mostly.', [S('physical', 10), P('open-mouth', 'tick', PTS(1), 'Every 2 s in a fight, the idol whispers: a point of Fury.', { icd: 2 })]],
  ['relic', 1, 'rift-the-cornerstone', 'The Cornerstone', '#a0a0a8', 'armor', 'Laid first, lifted last.', [P('cornerstone', 'tick', WARD(8, 4), 'Every 6 s in a fight: a shield of 8% of your health for 4 s.', { icd: 6 }), CAST('shield-wall', READY('shield-bash'))]],
  ['relic', 2, 'rift-the-tally-stick', 'The Tally Stick', '#c8b890', 'physical', 'Notched for every one. It is running out of stick.', [P('tally', 'kill', BUFF('tally', 'Tally', 8, '#c8b890', { stats: { crit: 3, critDmg: 6 }, max: 5 }), 'Every kill notches the stick: +3% critical chance and +6% critical damage for 8 s, stacking five times.'), D('last-word', 40)]],
];

/* ------------------------------------------------------------------ the Mage: Pyromancer, Stormcaller, Cryomancer */

const MAGE: Row[] = [
  // off-hand (the class's third is Hoarfrost Heart)
  ['offhand', null, 'rift-lamplighters-folio', 'The Lamplighter’s Folio', '#c8a8ff', 'arcane', 'Every page is a lamp it has lit, and the last page is blank.', [S('arcane', 15), P('lamplighter', 'crit', RES(4), 'A critical hit gives back 4% of your mana (once every 0.5 s).', { icd: 0.5 })], 'tome'],
  ['offhand', null, 'rift-orb-of-quiet-weather', 'Orb of Quiet Weather', '#9ad0ff', 'frost', 'Inside, it is always just about to snow.', [CD('frost-nova', 25), D('frost-nova', 40), CAST('frost-nova', PULL(70, 120))]],
  ['offhand', 0, 'rift-tinderbox-codex', 'The Tinderbox Codex', '#ff8a3a', 'fire', 'Its pages are all kindling, and they know it.', [HIT('fireball', PTS(1)), CAST('flamestrike', BUFF('tinderbox', 'Kindled', 6, '#ff8a3a', NEXT('fireball', { ready: true, pct: 30 })))], 'tome'],
  ['offhand', 1, 'rift-the-tenth-bolt', 'The Tenth Bolt', '#8ad8ff', 'lightning', 'Nine fell where they were told. Keep an eye on the tenth.', [K('ball-lightning', { op: 'charges', n: 1 }), K('chain-lightning', { op: 'build', n: 1 })]],
  ['offhand', 2, 'rift-rimeward-lens', 'The Rimeward Lens', '#c0f0ff', 'frost', 'Look through it and everything is already a little frozen.', [K('ice-lance', { op: 'bonusVs', status: 'chill', pct: 30 }), P('rimeward', 'hit', ST('freeze', 1, 1), 'Ice Javelin freezes what it strikes solid for 1 s (once every 4 s).', { skill: 'ice-lance', icd: 4 })]],
  // head
  ['head', null, 'rift-hood-of-far-reading', 'Hood of Far Reading', '#7a6ad0', 'arcane', 'It reads the weave a league off, and squints.', [K('arcane-bolt', { op: 'bonusVs', status: 'far', pct: 30 }), P('far-reading', 'crit', CDR(0.25), 'A critical Arcane Bolt takes 0.25 s off your cooldowns (once every 0.5 s).', { skill: 'arcane-bolt', icd: 0.5 })]],
  ['head', null, 'rift-the-quiet-mind', 'The Quiet Mind', '#b0a0e0', 'haste', 'It hushes everything but the next spell.', [S('haste', 8), P('quiet-mind', 'dodge', CDR(1), 'Every Phase Step takes 1 s off your cooldowns.')]],
  ['head', null, 'rift-veil-of-forked-light', 'Veil of Forked Light', '#a8e8ff', 'lightning', 'Thread it the wrong way and it bites.', [D('chain-lightning', 30), HIT('chain-lightning', ST('chill', 2, 0.3))]],
  ['head', 0, 'rift-cinderhood', 'Cinderhood', '#ff5a2a', 'fire', 'The hem has been smoldering for three hundred years.', [K('flamestrike', { op: 'area', pct: 30 }), P('cinderhood', 'crit', ST('burn', 4, 0.3), 'A critical fire hit sets the enemy Burning: 30% of the hit a second for 4 s (once every 0.3 s).', { dmgType: 'fire', icd: 0.3 })]],
  ['head', 1, 'rift-anvilcloud-cowl', 'Anvilcloud Cowl', '#6ab8ff', 'lightning', 'It always looks like rain on whoever wears it.', [D('thunderhead', 40), P('anvilcloud', 'ult', READY('ball-lightning'), 'Your ultimate makes Ball Lightning ready at once.')]],
  ['head', 2, 'rift-hood-of-the-long-night', 'Hood of the Long Night', '#90b8e8', 'frost', 'It was knitted from the dark between two winters.', [D('blizzard', 35), HIT('blizzard', ST('freeze', 0.8, 1, 0.1))]],
  // chest
  ['chest', null, 'rift-mantle-of-the-unburnt', 'Mantle of the Unburnt', '#e8c8a0', 'hpPct', 'Every fire it was thrown into went out, embarrassed.', [S('hpPct', 10), P('unburnt', 'hurt', WARD(15, 5), 'A blow taken wraps you in warded cloth: a shield of 15% of your health for 5 s (once every 10 s).', { icd: 10 })]],
  ['chest', null, 'rift-robe-of-many-doors', 'Robe of Many Doors', '#6a5ac0', 'arcane', 'There are more pockets on the inside than there is inside.', [K('blink', { op: 'charges', n: 1 }), P('many-doors', 'dodge', NOVA(56, 1.4, 'arcane'), 'Every Phase Step sets off a burst of arcane light around you (once every 2 s).', { icd: 2 })]],
  ['chest', null, 'rift-wardkeepers-vestment', 'Wardkeeper’s Vestment', '#9aa8ff', 'arcane', 'It keeps its own counsel, and your skin.', [CD('arcane-barrier', 30), CAST('arcane-barrier', NOVA(70, 1.2, 'arcane'))]],
  ['chest', 0, 'rift-robes-of-the-ash-choir', 'Robes of the Ash Choir', '#ff7a4a', 'fire', 'Sung in, by people who were never cold again.', [LAND('fireball', GROUND(34, 3, 0.15, 'fire', 'fire')), S('fire', 10)]],
  ['chest', 1, 'rift-stormwoven-robe', 'Stormwoven Robe', '#7ac0ff', 'lightning', 'The thread was spun in a storm, and never quite calmed down.', [CD('ball-lightning', 15), P('stormwoven', 'hurt', ARC(3, 0.8, 'lightning', 90), 'A blow taken arcs back: lightning leaps to three enemies near you (once every 2 s).', { icd: 2 })]],
  ['chest', 2, 'rift-robe-of-the-white-silence', 'Robe of the White Silence', '#d8f0ff', 'frost', 'Snow makes no sound. Neither does it.', [K('blizzard', { op: 'duration', pct: 30 }), K('frost-nova', { op: 'build', n: 1 })]],
  // legs
  ['legs', null, 'rift-leggings-of-the-far-step', 'Leggings of the Far Step', '#8a7ad0', 'speed', 'They are always a stride ahead of where you meant to be.', [S('speed', 8), K('phase-step', { op: 'range', pct: 30 }), P('far-step', 'dodge', BUFF('far-step', 'Far Step', 3, '#8a7ad0', { stats: { haste: 15 } }), 'Every Phase Step: +15% haste for 3 s.')]],
  ['legs', null, 'rift-sinkweight-leggings', 'Sinkweight Leggings', '#4a3a8a', 'arcane', 'Heavy for silk. Heavier for anyone standing near.', [CD('gravity-well', 30), K('gravity-well', { op: 'duration', pct: 40 }), HIT('gravity-well', ST('chill', 1, 0.4))]],
  ['legs', null, 'rift-leggings-of-the-second-self', 'Leggings of the Second Self', '#c0c0e8', 'haste', 'You are wearing them. So is someone else.', [S('haste', 6), CD('mirror-self', 30), CAST('mirror-self', TEAR(2, 52, 0.6))]],
  ['legs', 0, 'rift-emberwalk-leggings', 'Emberwalk Leggings', '#ff6a2a', 'fire', 'They leave a warm spot on every stair.', [TRAIL('phase-step', 0.15, 'fire', 'fire', AS('burn', 3, 0.2)), K('flamestrike', { op: 'afterDodge', window: 2, pct: 40 })]],
  ['legs', 1, 'rift-arcwalker-leggings', 'Arcwalker Leggings', '#9ae0ff', 'lightning', 'Every step closes a circuit.', [P('arcwalker', 'dodge', ARC(4, 0.9, 'lightning', 100), 'Every Phase Step throws lightning at four enemies near you.'), K('ball-lightning', { op: 'range', pct: 30 })]],
  ['legs', 2, 'rift-glacierstep-leggings', 'Glacierstep Leggings', '#b8e0ff', 'frost', 'Slow, the way a glacier is slow: right up until it is not.', [P('glacierstep', 'dodge', NOVA(56, 0.8, 'frost', AS('chill', 3, 0.5)), 'Every Phase Step leaves a chill behind: frost bursts around you, slowing everything it touches.'), CD('frost-ring', 25)]],
  // hands
  ['hands', null, 'rift-gloves-of-the-steady-hand', 'Gloves of the Steady Hand', '#a090d0', 'crit', 'They have never once spilled ink, or anything else.', [K('arcane-bolt', { op: 'pierce', n: 1 }), HIT('arcane-bolt', ST('shock', 3, 8, 0.25))]],
  ['hands', null, 'rift-starpickers-wraps', 'Starpicker’s Wraps', '#e0e0ff', 'arcane', 'They pick the brightest and leave the rest for later.', [CD('starfall-lance', 25), KILL('starfall-lance', READY('starfall-lance')), K('arcane-rupture', { op: 'area', pct: 30 })]],
  ['hands', null, 'rift-kindling-mitts', 'Kindling Mitts', '#ff9a4a', 'fire', 'Fingertips first. Then everything else.', [K('flame-dart', { op: 'charges', n: 1 }), HIT('flame-dart', BOOM(30, 0.5, 'fire'))]],
  ['hands', 0, 'rift-hands-of-the-kiln', 'Hands of the Kiln', '#ff6020', 'fire', 'Fired twice, and the second time it was personal.', [CD('fireball', 20), K('fireball', { op: 'build', n: 1 })]],
  ['hands', 1, 'rift-sparkcatchers', 'Sparkcatchers', '#a8e8ff', 'lightning', 'Insulated, they said. Nobody believed them.', [CD('chain-lightning', 25), K('ball-lightning', { op: 'spend', per: 0.05 })]],
  ['hands', 2, 'rift-shardsmiths-wraps', 'Shardsmith’s Wraps', '#c8f0ff', 'frost', 'Each knuckle carries a splinter of the north.', [HIT('ice-lance', BOOM(34, 0.5, 'frost', AS('chill', 2, 0.4))), D('ice-lance', 25)]],
  // feet
  ['feet', null, 'rift-slippers-of-the-unseen-stair', 'Slippers of the Unseen Stair', '#7a6ac8', 'speed', 'There is always one more step than you counted.', [K('phase-step', { op: 'charges', n: 1 }), P('unseen-stair', 'dodge', BUFF('unseen-stair', 'Unseen Stair', 2, '#7a6ac8', { dr: 30 }), 'Every Phase Step: 30% less damage taken for 2 s.')]],
  ['feet', null, 'rift-shoes-of-the-cold-road', 'Shoes of the Cold Road', '#a0d0f0', 'frost', 'Every road they have walked froze behind them.', [S('frost', 8), P('cold-road', 'dodge', READY('frost-nova'), 'Every Phase Step makes Rime Burst ready at once (once every 6 s).', { icd: 6 })]],
  ['feet', null, 'rift-lightfoot-slippers', 'Lightfoot Slippers', '#f0e0a0', 'haste', 'Even the dust does not notice.', [CD('purge', 30), CAST('purge', BUFF('lightfoot', 'Light Foot', 4, '#f0e0a0', { stats: { speed: 20, haste: 15 } }))]],
  ['feet', 0, 'rift-slippers-of-the-low-flame', 'Slippers of the Low Flame', '#ff4a1a', 'fire', 'Wherever you stop, something catches.', [P('low-flame', 'tick', GROUND(40, 4, 0.12, 'fire', 'fire'), 'Every 4 s in a fight the ground under you catches fire for 4 s.', { icd: 4 }), D('meteor', 30)]],
  ['feet', 1, 'rift-grounded-slippers', 'Grounded Slippers', '#8ab8e8', 'lightning', 'The only thing in the tower the lightning never hit.', [K('thunderhead', { op: 'area', pct: 25 }), P('grounded', 'hurt', PTS(1), 'A blow taken gives a Spark (once every 1.5 s).', { icd: 1.5 })]],
  ['feet', 2, 'rift-rimetread-slippers', 'Rimetread Slippers', '#b0e0ff', 'frost', 'They squeak, faintly, on dry stone.', [K('frost-ring', { op: 'area', pct: 30 }), CAST('frost-ring', READY('ice-lance'))]],
  // amulet
  ['amulet', null, 'rift-pocket-astrolabe', 'The Pocket Astrolabe', '#d8c8ff', 'ultCharge', 'Set it to tonight’s sky. It is usually right.', [S('ultCharge', 15), P('astrolabe', 'ult', RES(25), 'Your ultimate gives back 25% of your mana.')]],
  ['amulet', null, 'rift-locket-of-the-first-spell', 'Locket of the First Spell', '#c8a8ff', 'arcane', 'It holds the first spark you ever made, still going.', [K('ult', { op: 'damage', pct: 30 }), P('first-spell', 'ult', ECHO('basic', 1.5, 3), 'Your ultimate looses three echoes of your basic attack after it, 50% harder.')]],
  ['amulet', null, 'rift-manawell-pendant', 'The Manawell Pendant', '#6ab0ff', 'haste', 'Drink from it slowly. It is deeper than it looks.', [S('haste', 6), P('manawell', 'tick', RES(3), 'Every 3 s in a fight: 3% of your mana back.', { icd: 3 })]],
  ['amulet', 0, 'rift-heart-of-the-falling-star', 'Heart of the Falling Star', '#ff7a30', 'fire', 'It fell once. It has been looking for somewhere to land again.', [K('meteor', { op: 'area', pct: 30 }), P('falling-star', 'ult', READY('flamestrike'), 'Your ultimate makes Flame Pillar ready at once.')]],
  ['amulet', 1, 'rift-the-lodestone', 'The Lodestone', '#9ad8ff', 'lightning', 'North is wherever the storm is.', [P('lodestone', 'ult', PTS(5), 'Your ultimate fills your Sparks to five before it breaks.'), D('thunderhead', 25)]],
  ['amulet', 2, 'rift-the-white-star', 'The White Star', '#e8f8ff', 'frost', 'Colder than the sky it fell from.', [D('glacierfall', 35), P('white-star', 'ult', ECHO('frost-nova', 1), 'Your ultimate calls an echo of Rime Burst around you.')]],
  // ring
  ['ring', null, 'rift-band-of-the-burning-word', 'Band of the Burning Word', '#ff9a5a', 'fire', 'Say it carefully. It only works once a breath.', [P('burning-word', 'crit', BOOM(36, 0.6, 'fire', AS('burn', 3, 0.2)), 'A critical hit bursts into flame on what it strikes (once a second).', { icd: 1 })]],
  ['ring', null, 'rift-ring-of-the-cold-hand', 'Ring of the Cold Hand', '#a8d8ff', 'frost', 'Shake hands with it once. Just once.', [P('cold-hand', 'hit', ST('chill', 3, 0.4), 'Your hits may chill (one in five): 40% slower for 3 s.', { chance: 0.2, icd: 0.3 })]],
  ['ring', null, 'rift-loop-of-living-current', 'Loop of Living Current', '#8ae0ff', 'lightning', 'It is never quite still on the finger.', [P('living-current', 'hit', ARC(2, 0.5, 'lightning', 80), 'Your hits may leap on as lightning to two more enemies (one in six, once every 0.8 s).', { chance: 0.17, icd: 0.8 })]],
  ['ring', 0, 'rift-smolderband', 'Smolderband', '#e85a20', 'fire', 'It has been about to catch for a very long time.', [CD('flamestrike', 15), P('smolderband', 'hit', PTS(1), 'Fireball hits give a Heat (once every 0.5 s).', { skill: 'fireball', icd: 0.5 })]],
  ['ring', 1, 'rift-the-closed-circuit', 'The Closed Circuit', '#7ad0ff', 'lightning', 'Put it on and you complete something.', [K('ball-lightning', { op: 'bonusVs', status: 'shock', pct: 30 }), P('closed-circuit', 'crit', READY('chain-lightning'), 'A critical lightning hit may make Chain Lightning ready at once (one in three, once every 3 s).', { dmgType: 'lightning', chance: 0.34, icd: 3 })]],
  ['ring', 2, 'rift-the-splinter-ring', 'The Splinter Ring', '#c0e8ff', 'frost', 'A shard from a glacier’s heart, still trying to get home.', [K('ice-lance', { op: 'charges', n: 1 }), P('splinter-ring', 'kill', READY('ice-lance'), 'An enemy that dies Chilled makes Ice Javelin ready at once (once every 2 s).', { status: 'chill', icd: 2 })]],
  // relic (the class's third is The Banked Coal)
  ['relic', null, 'rift-the-little-orrery', 'The Little Orrery', '#c8b0ff', 'arcane', 'The planets in it go the wrong way round. On purpose.', [EVERY('orrery', 5, 'arcane-rupture', 0.8, 'Every 5 s in a fight: an echo of Arcane Rupture at the nearest enemy, at 80%.')]],
  ['relic', null, 'rift-the-tuning-fork', 'The Tuning Fork', '#b8c8e8', 'haste', 'Strike it, and every spell in the room comes into key.', [S('haste', 5), P('tuning-fork', 'tick', CDR(0.5), 'Every 3 s in a fight: 0.5 s off your cooldowns.', { icd: 3 })]],
  ['relic', 0, 'rift-the-kiln-heart', 'The Kiln Heart', '#ff6a2a', 'fire', 'Bricked up for a century. It did not cool.', [EVERY('kiln-heart', 5, 'fireball', 0.8, 'Every 5 s in a fight: an echo of Fireball at the nearest enemy, at 80%.')]],
  ['relic', 1, 'rift-storm-in-a-thimble', 'Storm in a Thimble', '#9ad8ff', 'lightning', 'Small. Still a storm.', [EVERY('thimble', 4, 'chain-lightning', 0.7, 'Every 4 s in a fight: an echo of Chain Lightning at the nearest enemy, at 70%.')]],
  ['relic', 2, 'rift-winter-in-a-jar', 'Winter in a Jar', '#b8e8ff', 'frost', 'Keep the lid on. Mostly.', [EVERY('winter-jar', 5, 'ice-lance', 0.8, 'Every 5 s in a fight: an echo of Ice Javelin at the nearest enemy, at 80%.')]],
];

/* ------------------------------------------------------------------ the Ranger: Deadeye, Trapper, Beastmaster */

const RANGER: Row[] = [
  // off-hand
  ['offhand', null, 'rift-quiver-of-a-hundred-feathers', 'Quiver of a Hundred Feathers', '#c8b890', 'physical', 'Count them and there are ninety-nine. Draw, and there is always one more.', [K('multishot', { op: 'projectiles', n: 2 }), HIT('multishot', ST('bleed', 3, 0.15))]],
  ['offhand', null, 'rift-whisperquiver', 'Whisperquiver', '#6a5a4a', 'crit', 'Its arrows never rattle. They have been told.', [S('crit', 4), P('whisperquiver', 'crit', RES(8), 'A critical hit gives 8 Focus (once every 0.4 s).', { icd: 0.4 })]],
  ['offhand', null, 'rift-thornback-quiver', 'Thornback Quiver', '#7a8a4a', 'poison', 'Every shaft in it has a little venom on its mind.', [HIT('arrow', ST('poison', 3, 0.2, 0.25)), HIT('piercing-arrow', ST('poison', 4, 0.25))]],
  ['offhand', 0, 'rift-quiver-of-the-patient-hour', 'Quiver of the Patient Hour', '#e8d8a0', 'physical', 'Every arrow in it has waited a long time for this.', [K('aimed-shot', { op: 'charges', n: 1 }), CAST('hunters-mark', PTS(2))]],
  ['offhand', 1, 'rift-snarehold-quiver', 'Snarehold Quiver', '#7a6a3a', 'poison', 'Half arrows, half springs, and all of it waiting.', [K('poison-trap', { op: 'extra', key: 'maxTraps', n: 1, label: 'traps at once' }), CD('bear-trap', 20)]],
  ['offhand', 2, 'rift-pack-strap-quiver', 'The Pack-Strap Quiver', '#a08860', 'pet', 'It smells of wet dog, and the dogs like it.', [S('pet', 25), CAST('call-wolf', BUFF('packstrap', 'Pack Run', 6, '#a08860', { stats: { speed: 15, power: 10 } }))]],
  // head
  ['head', null, 'rift-hood-of-the-far-ridge', 'Hood of the Far Ridge', '#8a7a5a', 'physical', 'From up there, everything is in range.', [K('piercing-arrow', { op: 'range', pct: 30 }), K('piercing-arrow', { op: 'bonusVs', status: 'far', pct: 40 })]],
  ['head', null, 'rift-the-stalking-cowl', 'The Stalking Cowl', '#4a4a3a', 'crit', 'It has never once been seen first.', [S('critDmg', 25, 'afterDodge'), P('stalking-cowl', 'dodge', READY('piercing-arrow'), 'Every Tumble may make Piercing Arrow ready at once (one in three, once every 5 s).', { chance: 0.34, icd: 5 })]],
  ['head', null, 'rift-trackers-hood', 'Tracker’s Hood', '#9a8a6a', 'haste', 'It notices the broken twig before you do.', [S('haste', 6), CD('hunters-mark', 30), HIT('hunters-mark', READY('multishot'))]],
  ['head', 0, 'rift-hood-of-the-held-breath', 'Hood of the Held Breath', '#f0e0b0', 'physical', 'Breathe out. Release. Breathe in only after.', [K('aimed-shot', { op: 'bonusVs', status: 'far', pct: 30 }), P('held-breath', 'crit', BUFF('held-breath', 'Held Breath', 5, '#f0e0b0', NEXT('aimed-shot', { pct: 40 })), 'A critical hit steadies your next Long Draw: +40% damage (once every 4 s).', { icd: 4 })]],
  ['head', 1, 'rift-the-poachers-hood', 'The Poacher’s Hood', '#6a5a3a', 'poison', 'It knows every keeper’s rounds by heart.', [K('arrow-rain', { op: 'area', pct: 25 }), HIT('arrow-rain', ST('poison', 3, 0.15))]],
  ['head', 2, 'rift-wolfskin-hood', 'Wolfskin Hood', '#8a8a8a', 'pet', 'The wolf gave it freely. Ask the other wolves.', [D('horn-of-the-hunt', 30), P('wolfskin', 'ult', SUMMON('wolf', 1, 15), 'Your ultimate calls one more wolf to the hunt for 15 s.')]],
  // chest
  ['chest', null, 'rift-brushwalkers-jerkin', 'Brushwalker’s Jerkin', '#6a7a4a', 'speed', 'Thorns slide off it. So do most arguments.', [S('speed', 8), P('brushwalker', 'hurt', BUFF('brushwalker', 'Into the Brush', 3, '#6a7a4a', { stats: { speed: 25 }, dr: 20 }), 'A blow taken sends you into the brush: 25% quicker and 20% less damage taken for 3 s (once every 8 s).', { icd: 8 })]],
  ['chest', null, 'rift-the-fletchers-coat', 'The Fletcher’s Coat', '#a08050', 'physical', 'Every pocket holds a spare, and every spare is sharp.', [P('fletcher', 'kill', RES(10), 'Every kill gives 10 Focus (once every 0.3 s).', { icd: 0.3 }), K('multishot', { op: 'cost', pct: 25 })]],
  ['chest', null, 'rift-hide-of-the-gray-stag', 'Hide of the Gray Stag', '#9a9a90', 'hpPct', 'The stag was never caught. It gave this willingly, in the end.', [S('hpPct', 10), P('gray-stag', 'tick', HEAL(2), 'Every 4 s in a fight: 2% of your health back.', { icd: 4 })]],
  ['chest', 0, 'rift-ridgeline-coat', 'Ridgeline Coat', '#c8b888', 'physical', 'Cut to lie still in for a whole day.', [HIT('aimed-shot', ST('mark', 6, 15)), D('aimed-shot', 25)]],
  ['chest', 1, 'rift-jerkin-of-the-sprung-jaw', 'Jerkin of the Sprung Jaw', '#7a5a3a', 'physical', 'The buckles snap shut by themselves.', [K('bear-trap', { op: 'area', pct: 30 }), HIT('bear-trap', WARD(8, 4))]],
  ['chest', 2, 'rift-pack-leathers', 'Pack Leathers', '#8a6a4a', 'pet', 'It smells of the den. The wolves approve.', [CAST('call-wolf', WARD(10, 4)), P('pack-leathers', 'hurt', SUMMON('wolf', 1, 6), 'A blow taken calls a wolf to your side for 6 s (once every 10 s).', { icd: 10 })]],
  // legs
  ['legs', null, 'rift-tumblers-breeches', 'Tumbler’s Breeches', '#8a6a4a', 'speed', 'Knees reinforced. Pride, less so.', [K('tumble', { op: 'charges', n: 1 }), P('tumbler', 'dodge', RES(10), 'Every Tumble gives 10 Focus.')]],
  ['legs', null, 'rift-breeches-of-the-long-wait', 'Breeches of the Long Wait', '#6a5a4a', 'crit', 'Lie in the reeds long enough and they forget you are there.', [S('crit', 8, 'afterDodge'), K('arrow', { op: 'afterDodge', window: 1.5, pct: 30 })]],
  ['legs', null, 'rift-the-grapplers-breeches', 'The Grappler’s Breeches', '#7a7a6a', 'speed', 'Built for the long haul up, and the short drop down.', [CD('grapple-line', 30), LAND('grapple-line', NOVA(50, 1))]],
  ['legs', 0, 'rift-stillwater-breeches', 'Stillwater Breeches', '#c0b080', 'physical', 'Not a ripple. Not one.', [P('stillwater', 'dodge', BUFF('stillwater', 'Stillwater', 4, '#c0b080', NEXT('aimed-shot', { pct: 30, ready: true })), 'Every Tumble readies your next Long Draw: ready at once and 30% stronger (once every 8 s).', { icd: 8 })]],
  ['legs', 1, 'rift-bogwalker-breeches', 'Bogwalker Breeches', '#5a6a3a', 'poison', 'Waterproof, mostly.', [P('bogwalker', 'dodge', GROUND(44, 3, 0.1, 'poison', 'poison', { status: AS('chill', 1, 0.5) }), 'Every Tumble leaves a sucking bog where you stood for 3 s: it slows and stings whatever wades in.', { icd: 2 }), K('multishot', { op: 'bonusVs', status: 'chill', pct: 20 })]],
  ['legs', 2, 'rift-wolfrunner-breeches', 'Wolfrunner Breeches', '#9a8a6a', 'pet', 'They keep pace with the pack, and the pack keeps pace with them.', [P('wolfrunner', 'dodge', PTS(1), 'Every Tumble gives a Fang.'), K('piercing-arrow', { op: 'afterDodge', window: 1.6, pct: 25 })]],
  // hands
  ['hands', null, 'rift-the-bowyers-grips', 'The Bowyer’s Grips', '#a07a4a', 'physical', 'The bowyer made the bow, then made the hands to match.', [CD('piercing-arrow', 20), HIT('piercing-arrow', ST('bleed', 4, 0.25))]],
  ['hands', null, 'rift-quickdraw-grips', 'Quickdraw Grips', '#c8a070', 'haste', 'Faster than thinking, which is the point.', [S('haste', 8), P('quickdraw', 'crit', READY('multishot'), 'A critical hit may make Multishot ready at once (one in five, once every 3 s).', { chance: 0.2, icd: 3 })]],
  ['hands', null, 'rift-blastcap-gloves', 'Blastcap Gloves', '#e07a3a', 'fire', 'The fingers are slightly singed. That is normal.', [K('explosive-shot', { op: 'charges', n: 1 }), K('explosive-shot', { op: 'area', pct: 30 })]],
  ['hands', 0, 'rift-drawstring-grips', 'Drawstring Grips', '#e0d0a0', 'physical', 'The string has worn a groove. The groove has worn a habit.', [CD('aimed-shot', 20), K('arrow', { op: 'build', n: 1 })]],
  ['hands', 1, 'rift-jawsetters', 'Jawsetters', '#7a5a30', 'physical', 'All ten fingers still present. Remarkably.', [K('bear-trap', { op: 'charges', n: 1 }), HIT('bear-trap', READY('poison-trap'))]],
  ['hands', 2, 'rift-the-handlers-grips', 'The Handler’s Grips', '#9a7a5a', 'pet', 'One whistle, and something with teeth comes running.', [CD('call-wolf', 30), K('call-wolf', { op: 'build', n: 1 })]],
  // feet
  ['feet', null, 'rift-mossfall-boots', 'Mossfall Boots', '#6a7a4a', 'speed', 'Not a leaf turns.', [S('speed', 8), P('mossfall', 'dodge', HEAL(4), 'Every Tumble mends 4% of your health (once every 2 s).', { icd: 2 })]],
  ['feet', null, 'rift-ridgerunners', 'Ridgerunners', '#8a7050', 'speed', 'Built for the high trails, where the wind is the only company.', [K('tumble', { op: 'range', pct: 30 }), P('ridgerunner', 'dodge', ECHO('multishot', 0.6), 'Every Tumble looses an echo of Multishot at the nearest enemy, at 60% (once every 3 s).', { icd: 3 })]],
  ['feet', null, 'rift-tarwalkers', 'Tarwalkers', '#3a3a2a', 'poison', 'Sticky. Very sticky.', [CD('tar-pit', 30), HIT('tar-pit', ST('poison', 4, 0.2)), CD('snare-net', 25)]],
  ['feet', 0, 'rift-lookouts-boots', 'Lookout’s Boots', '#d8c890', 'physical', 'Laced for the climb to the top of anything.', [K('quarrys-end', { op: 'range', pct: 30 }), P('lookout', 'ult', BUFF('lookout', 'High Ground', 8, '#d8c890', { stats: { crit: 15, critDmg: 20 } }), 'Your ultimate takes the high ground: +15% critical chance and +20% critical damage for 8 s.')]],
  ['feet', 1, 'rift-springheel-boots', 'Springheel Boots', '#8a6a3a', 'physical', 'They leave something behind with every step. Mind it.', [S('poison', 10), P('springheel', 'dodge', READY('bear-trap'), 'Every Tumble makes Bear Trap ready at once (once every 8 s).', { icd: 8 })]],
  ['feet', 2, 'rift-pawprint-boots', 'Pawprint Boots', '#a08868', 'pet', 'The prints they leave are not yours.', [P('pawprint', 'kill', BUFF('pawprint', 'Run with Them', 4, '#a08868', { stats: { speed: 20, pet: 20 } }), 'Every kill: 20% quicker, and your companions hit 20% harder, for 4 s.'), CD('hawk-call', 25)]],
  // amulet (the class's third is Packmother’s Fang)
  ['amulet', null, 'rift-antler-charm', 'Antler Charm', '#c8b8a0', 'ultCharge', 'Shed in spring. Kept for the fall.', [S('ultCharge', 15), P('antler-charm', 'ult', RES(50), 'Your ultimate gives 50 Focus.')]],
  ['amulet', null, 'rift-moonhunters-pendant', 'The Moonhunter’s Pendant', '#d8d8f0', 'crit', 'Silvered by the light it hunted by.', [K('ult', { op: 'damage', pct: 30 }), P('moonhunter', 'ult', BUFF('moonhunter', 'Moonhunt', 8, '#d8d8f0', { stats: { haste: 20 } }), 'Your ultimate: +20% haste for 8 s.')]],
  ['amulet', 0, 'rift-one-arrow', 'One Arrow', '#f0e8c8', 'physical', 'There was only ever going to be the one.', [D('quarrys-end', 40), HIT('quarrys-end', ST('armorBreak', 6, 15))]],
  ['amulet', 1, 'rift-snarewrights-token', 'Snarewright’s Token', '#8a7040', 'poison', 'A tiny trap on a chain. It has caught three fingers.', [K('arrow-rain', { op: 'duration', pct: 40 }), P('snarewright', 'ult', READY('bear-trap'), 'Your ultimate makes Bear Trap ready at once.')]],
  ['amulet', 2, 'rift-the-leaders-tooth', 'The Leader’s Tooth', '#e8e0c8', 'pet', 'It came out in a fight over who led. It did.', [S('pet', 20), P('leaders-tooth', 'ult', PTS(5), 'Your ultimate fills your Fangs to five as it sounds.')]],
  // ring
  ['ring', null, 'rift-the-archers-thumb-ring', 'The Archer’s Thumb Ring', '#c8a868', 'physical', 'Horn, worn thin by ten thousand strings.', [D('arrow', 25), P('thumb-ring', 'crit', READY('piercing-arrow'), 'A critical Arrow may make Piercing Arrow ready at once (one in four, once every 4 s).', { skill: 'arrow', chance: 0.25, icd: 4 })]],
  ['ring', null, 'rift-greenwood-ring', 'Greenwood Ring', '#5a8a4a', 'poison', 'Living wood, still growing round the finger.', [P('greenwood', 'kill', BOOM(40, 0.8, 'poison', AS('poison', 4, 0.2)), 'Every kill bursts in a green cloud, poisoning whatever is near (once every 0.5 s).', { icd: 0.5 })]],
  ['ring', null, 'rift-loosestring-ring', 'Loosestring Ring', '#b8a070', 'haste', 'It hums when an arrow leaves.', [P('loosestring', 'crit', BUFF('loosestring', 'Loose', 4, '#b8a070', { stats: { haste: 4, crit: 2 }, max: 5 }), 'Every critical hit: +4% haste and +2% critical chance for 4 s, stacking five times (once every 0.3 s).', { icd: 0.3 })]],
  ['ring', 0, 'rift-ring-of-the-true-line', 'Ring of the True Line', '#f0e0b0', 'physical', 'Draw a line from here to there. That is the ring.', [K('aimed-shot', { op: 'pierce', n: 2 }), KILL('aimed-shot', RES(30))]],
  ['ring', 1, 'rift-hookthorn-ring', 'Hookthorn Ring', '#6a7a3a', 'poison', 'Barbed on the inside. It stays on.', [K('multishot', { op: 'bonusVs', status: 'root', pct: 25 }), P('hookthorn', 'hit', ST('root', 0.6, 1), 'Multishot may pin what it strikes: rooted for 0.6 s (one in four, once every 2 s).', { skill: 'multishot', chance: 0.25, icd: 2 })]],
  ['ring', 2, 'rift-the-collar-ring', 'The Collar Ring', '#9a8a70', 'pet', 'Too small for a wolf now. It was not always.', [K('piercing-arrow', { op: 'bonusVs', status: 'bleed', pct: 20 }), P('collar-ring', 'crit', SUMMON('wolf', 1, 5), 'A critical hit may call a wolf to hunt beside you for 5 s (one in two, once every 8 s).', { chance: 0.5, icd: 8 })]],
  // relic (the class's third is the Jawbone Charm)
  ['relic', null, 'rift-the-hunting-whistle', 'The Hunting Whistle', '#c8b080', 'physical', 'Blow it and something answers. You hope it is yours.', [EVERY('hunting-whistle', 6, 'serrated-arrow', 1, 'Every 6 s in a fight: an echo of Serrated Arrow at the nearest enemy.')]],
  ['relic', null, 'rift-the-crow-bundle', 'The Crow Bundle', '#3a3a4a', 'crit', 'Every feather was dropped, never plucked.', [P('crow-bundle', 'tick', BUFF('crow-bundle', 'Crow’s Eye', 3, '#3a3a4a', { stats: { crit: 15 } }), 'Every 6 s in a fight: +15% critical chance for 3 s.', { icd: 6 })]],
  ['relic', 0, 'rift-the-long-spyglass', 'The Long Spyglass', '#d8c070', 'physical', 'Brass, dented, and always pointed the right way.', [EVERY('spyglass', 8, 'hunters-mark', 1, 'Every 8 s in a fight: an echo of Quarry Mark on the nearest enemy.')]],
  ['relic', 1, 'rift-a-tangle-of-wire', 'A Tangle of Wire', '#8a8a7a', 'poison', 'It was a snare. Now it is a theory of snares.', [EVERY('tangle-wire', 6, 'poison-trap', 1, 'Every 6 s in a fight: an echo of Poison Trap, tossed at the nearest enemy.')]],
  ['relic', 2, 'rift-the-bone-whistle', 'The Bone Whistle', '#e0d8c0', 'pet', 'Pitched too high for people. Just right for everything else.', [P('bone-whistle', 'tick', SUMMON('wolf', 1, 6), 'Every 8 s in a fight, a wolf answers and hunts beside you for 6 s.', { icd: 8 }), CAST('call-wolf', READY('hawk-call'))]],
];

/* ------------------------------------------------------------------ the Paladin: Dawnkeeper, Shieldbearer, Zealot */

// (Zeal is the Paladin's points already, so nothing here gives the specializations' own: it gives Zeal)
const PALADIN: Row[] = [
  // off-hand (the class's third is the Wall of the Ember Oath)
  ['offhand', null, 'rift-the-dayspring-shield', 'The Dayspring Shield', '#ffe9a0', 'holy', 'Raise it at dawn and the dawn comes a little sooner.', [D('judgment', 30), HIT('judgment', HEAL(2))]],
  ['offhand', null, 'rift-aegis-of-the-sworn-few', 'Aegis of the Sworn Few', '#e0c060', 'armor', 'Twelve names on the rim. Eleven are crossed out.', [S('armor', 20), P('sworn-few', 'hurt', RES(1), 'A blow taken gives a Zeal (once every 2 s).', { icd: 2 })]],
  ['offhand', 0, 'rift-sunwell-buckler', 'Sunwell Buckler', '#fff2b0', 'healing', 'Light pools in the boss, like water in a cup.', [K('holy-shock', { op: 'charges', n: 1 }), HIT('holy-shock', ST('weaken', 4, 15))]],
  ['offhand', 1, 'rift-the-ricochet', 'The Ricochet', '#e0c070', 'armor', 'It has never once come back the way it left.', [HIT('avengers-shield', ST('stun', 0.5, 1)), CD('shield-of-the-righteous', 20)]],
  ['offhand', 2, 'rift-crest-of-the-final-word', 'Crest of the Final Word', '#ff9a3d', 'holy', 'It was raised once in a courtroom, and the case was over.', [K('templars-verdict', { op: 'arc', pct: 30 }), K('judgment', { op: 'charges', n: 1 })]],
  // head
  ['head', null, 'rift-helm-of-the-morning-watch', 'Helm of the Morning Watch', '#ffe090', 'holy', 'It has seen every sunrise for four hundred years, and is not tired of them.', [S('holy', 12), P('morning-watch', 'crit', RES(1), 'A critical hit gives a Zeal (once every 1.5 s).', { icd: 1.5 })]],
  ['head', null, 'rift-visor-of-clear-sight', 'Visor of Clear Sight', '#fff0c0', 'crit', 'It shows things as they are, which is not always a kindness.', [S('crit', 5), HIT('judgment', ST('mark', 5, 10))]],
  ['head', null, 'rift-greathelm-of-vows', 'Greathelm of Vows', '#d8c890', 'armor', 'Every vow taken in it echoes a little.', [CD('word-of-glory', 25), CAST('word-of-glory', WARD(15, 5))]],
  ['head', 0, 'rift-helm-of-first-light', 'Helm of First Light', '#fff4c8', 'healing', 'The light reaches it before it reaches the hills.', [D('sunrise', 30), P('first-light', 'ult', BUFF('first-light', 'First Light', 6, '#fff4c8', { hot: 2, stats: { healing: 20 } }), 'Your ultimate: +20% healing and 2% of your health back every second for 6 s.')]],
  ['head', 1, 'rift-helm-of-the-iron-dawn', 'Helm of the Iron Dawn', '#c0a060', 'armor', 'Forged at sunrise, cooled in a moat.', [D('rampart-of-light', 30), HIT('rampart-of-light', ST('weaken', 5, 15))]],
  ['head', 2, 'rift-the-burning-halo', 'The Burning Halo', '#ffb040', 'holy', 'It does not sit on the head so much as hover over it, judging.', [D('avenging-wrath', 30), P('burning-halo', 'ult', ECHO('judgment', 1, 3), 'Your ultimate calls three echoes of Sunbrand after it, branding what they strike.')]],
  // chest
  ['chest', null, 'rift-hauberk-of-the-pale-sun', 'Hauberk of the Pale Sun', '#f0e0b0', 'hpPct', 'Winter light: thin, steady, and it lasts.', [S('hpPct', 10), P('pale-sun', 'hurt', BUFF('pale-sun', 'Pale Sun', 6, '#f0e0b0', { hot: 2 }), 'A blow taken warms you: 2% of your health back every second for 6 s (once every 10 s).', { icd: 10 })]],
  ['chest', null, 'rift-cuirass-of-the-circle', 'Cuirass of the Circle', '#ffe08a', 'holy', 'Wherever it stands is hallowed. It insists.', [CD('consecration', 25), K('consecration', { op: 'area', pct: 25 }), CAST('consecration', WARD(10, 4))]],
  ['chest', null, 'rift-mercyplate', 'Mercyplate', '#e8d8b0', 'healing', 'It has turned aside more blows than it has dealt, and is proud of it.', [S('healing', 15), CD('cleansing-light', 30), CAST('cleansing-light', NOVA(60, 1, 'holy'))]],
  ['chest', 0, 'rift-sunlit-cuirass', 'Sunlit Cuirass', '#fff0b0', 'healing', 'It is warm in the shade.', [CAST('consecration', BUFF('sunlit', 'Sunlit', 6, '#fff0b0', { hot: 2 })), D('holy-shock', 30)]],
  ['chest', 1, 'rift-plate-of-the-steady-line', 'Plate of the Steady Line', '#b8a060', 'armor', 'The line was never broken. It bent, once, and regretted it.', [S('armor', 20), HIT('shield-of-the-righteous', HEAL(1.5)), CD('bulwark', 25)]],
  ['chest', 2, 'rift-the-branded-surcoat', 'The Branded Surcoat', '#ff9a40', 'holy', 'Embroidered with the sign of everyone it found guilty.', [D('crusader-strike', 25), P('branded-surcoat', 'hit', RES(1), 'Oath Strike striking a Marked enemy gives a Zeal (once a second).', { skill: 'crusader-strike', status: 'mark', icd: 1 })]],
  // legs
  ['legs', null, 'rift-greaves-of-the-sunlit-road', 'Greaves of the Sunlit Road', '#ffe8a0', 'speed', 'Every road is sunlit, if you walk it in these.', [S('speed', 8), P('sunlit-road', 'dodge', RES(1), 'Every Sunlit Charge gives a Zeal.')]],
  ['legs', null, 'rift-cuisses-of-the-long-kneel', 'Cuisses of the Long Kneel', '#d0b890', 'armor', 'Worn through a night of vigil, and every night since.', [S('armor', 15), S('healing', 25, 'lowHp'), P('long-kneel', 'hurt', HEAL(3), 'A blow taken mends 3% of your health (once every 5 s).', { icd: 5 })]],
  ['legs', null, 'rift-dawnstride-greaves', 'Dawnstride Greaves', '#fff0c0', 'holy', 'Each step lands a moment before the light does.', [CD('dawn-leap', 30), LAND('dawn-leap', BOOM(60, 0.8, 'holy', AS('weaken', 4, 15)))]],
  ['legs', 0, 'rift-greaves-of-the-last-pilgrimage', 'Greaves of the Last Pilgrimage', '#f8e8c0', 'healing', 'They walked to the edge of the world and back, and only stopped to pray.', [P('pilgrimage', 'dodge', READY('holy-shock'), 'Every Sunlit Charge makes Sun Spark ready at once (once every 6 s).', { icd: 6 }), S('holy', 8)]],
  ['legs', 1, 'rift-gatehouse-greaves', 'Gatehouse Greaves', '#c8a860', 'armor', 'They were stationed. They stayed stationed.', [LAND('divine-steed', TAUNT(70, 3)), P('gatehouse', 'dodge', WARD(12, 4), 'Every Sunlit Charge sets you down behind a ward of 12% of your health for 4 s.')]],
  ['legs', 2, 'rift-greaves-of-the-swift-verdict', 'Greaves of the Swift Verdict', '#ffb860', 'holy', 'No appeal. No delay.', [P('swift-verdict', 'dodge', BUFF('swift-verdict', 'Swift Verdict', 4, '#ffb860', NEXT('templars-verdict', { pct: 40 })), 'Every Sunlit Charge: your next Twin Edict hits 40% harder (for 4 s).'), S('crit', 4)]],
  // hands
  ['hands', null, 'rift-oathgrip-gauntlets', 'Oathgrip Gauntlets', '#e8d090', 'holy', 'They have never let go of a promise.', [D('crusader-strike', 30), P('oathgrip', 'hit', RES(1), 'Oath Strike hits may give one more Zeal (one in four, once a second).', { skill: 'crusader-strike', chance: 0.25, icd: 1 })]],
  ['hands', null, 'rift-hammerhands', 'Hammerhands', '#d8c070', 'holy', 'They were made for one hammer. They will do for any.', [CD('hammer-of-justice', 25), HIT('hammer-of-justice', BOOM(44, 0.8, 'holy', AS('stun', 1, 1)))]],
  ['hands', null, 'rift-the-binding-hands', 'The Binding Hands', '#c8b080', 'holy', 'What they take hold of stays held.', [CD('oath-chain', 30), HIT('oath-chain', ST('stun', 1, 1)), K('halting-word', { op: 'area', pct: 25 })]],
  ['hands', 0, 'rift-gauntlets-of-laying-on', 'Gauntlets of Laying On', '#fff0d0', 'healing', 'Warm, always. Even in the snow.', [HIT('holy-shock', HEAL(3)), CAST('word-of-glory', READY('holy-shock'))]],
  ['hands', 1, 'rift-shieldwrights-grip', 'Shieldwright’s Grip', '#c09040', 'armor', 'The strap has worn to the shape of one hand.', [D('shield-of-the-righteous', 30), HIT('shield-of-the-righteous', WAVE(0.6))]],
  ['hands', 2, 'rift-the-judges-gauntlets', 'The Judge’s Gauntlets', '#ffcf5a', 'holy', 'Heavy enough to bring a gavel down through the bench.', [CD('judgment', 25), HIT('judgment', READY('templars-verdict'))]],
  // feet
  ['feet', null, 'rift-dawnmarch-sabatons', 'Dawnmarch Sabatons', '#f0d890', 'speed', 'They have marched toward the sunrise since before there were roads.', [S('speed', 8), P('dawnmarch', 'dodge', NOVA(56, 1, 'holy'), 'Every Sunlit Charge sets you down in a flare of holy light (once every 2 s).', { icd: 2 })]],
  ['feet', null, 'rift-sabatons-of-the-standing-stone', 'Sabatons of the Standing Stone', '#b8a880', 'armor', 'Moving them is a two-person job, and one of them has to be you.', [S('armor', 15), P('standing-stone', 'hurt', CHARGE(2), 'A blow taken charges your ultimate by 2% (once a second).', { icd: 1 })]],
  ['feet', null, 'rift-goldspur-sabatons', 'Goldspur Sabatons', '#ffd860', 'holy', 'The spurs ring, and something in the light answers.', [P('goldspur', 'kill', NOVA(50, 0.8, 'holy'), 'Every kill rings out: holy light bursts around you (once a second).', { icd: 1 })]],
  ['feet', 0, 'rift-hallowed-way-sabatons', 'Hallowed Way Sabatons', '#fff8d0', 'healing', 'Where they have stood, the grass grows back first.', [K('consecration', { op: 'duration', pct: 40 }), P('hallowed-way', 'dodge', GROUND(44, 4, 0.1, 'holy', 'holy', { heal: 1 }), 'Every Sunlit Charge hallows the ground you leave for 4 s: it burns enemies and heals you while you stand in it.')]],
  ['feet', 1, 'rift-drawbridge-sabatons', 'Drawbridge Sabatons', '#b89850', 'armor', 'Down with a crash, up with a grudge.', [K('rampart-of-light', { op: 'area', pct: 25 }), P('drawbridge', 'hurt', READY('avengers-shield'), 'A blow taken may make Thrown Aegis ready at once (one in five, once every 4 s).', { chance: 0.2, icd: 4 })]],
  ['feet', 2, 'rift-emberstep-sabatons', 'Emberstep Sabatons', '#ff9a3d', 'holy', 'The floor of every court they have crossed is scorched.', [TRAIL('divine-steed', 0.15, 'holy', 'holy'), K('templars-verdict', { op: 'afterDodge', window: 2, pct: 30 })]],
  // amulet
  ['amulet', null, 'rift-the-sunstone', 'The Sunstone', '#ffd84d', 'ultCharge', 'It holds a day’s worth of light, and spends it all at once.', [S('ultCharge', 15), P('sunstone', 'ult', RES(5), 'Your ultimate fills your Zeal.')]],
  ['amulet', null, 'rift-reliquary-of-the-first-oath', 'Reliquary of the First Oath', '#e8d8a0', 'holy', 'There is a fingerbone inside. It points at the guilty.', [K('ult', { op: 'damage', pct: 30 }), P('first-oath', 'ult', BUFF('first-oath', 'First Oath', 10, '#e8d8a0', { stats: { holy: 20, armor: 15 } }), 'Your ultimate renews the first oath: +20% holy damage and +15 armor for 10 s.')]],
  ['amulet', null, 'rift-medallion-of-the-open-hand', 'Medallion of the Open Hand', '#f0e0c0', 'healing', 'Given freely. Kept the same way.', [S('healing', 15), P('open-hand', 'kill', HEAL(2), 'Every kill mends 2% of your health (once every 0.5 s).', { icd: 0.5 })]],
  ['amulet', 0, 'rift-the-dawnstar-locket', 'The Dawnstar Locket', '#fff2b0', 'healing', 'Open it before sunrise and you get a little more morning.', [K('holy-shock', { op: 'bonusVs', status: 'weaken', pct: 20 }), P('dawnstar', 'ult', READY('holy-shock'), 'Your ultimate makes Sun Spark ready at once.')]],
  ['amulet', 1, 'rift-the-walls-gorget', 'The Wall’s Gorget', '#c8a050', 'armor', 'It guards the throat. The throat has opinions about this.', [K('shield-of-the-righteous', { op: 'bonusVs', status: 'chill', pct: 20 }), P('walls-gorget', 'ult', BUFF('walls-gorget', 'The Wall', 8, '#c8a050', { dr: 15, thorns: 1 }), 'Your ultimate makes you the wall: 15% less damage taken, and you strike back at whatever hits you, for 8 s.')]],
  ['amulet', 2, 'rift-the-wingpin', 'The Wingpin', '#ffb050', 'holy', 'A single pinion of light, pinned at the collar.', [K('avenging-wrath', { op: 'area', pct: 30 }), P('wingpin', 'ult', READY('templars-verdict'), 'Your ultimate makes Twin Edict ready at once.')]],
  // ring
  ['ring', null, 'rift-signet-of-the-high-altar', 'Signet of the High Altar', '#ffe090', 'holy', 'It has sealed every blessing given at the high altar for a century.', [P('high-altar', 'crit', NOVA(48, 0.8, 'holy'), 'A critical hit flares into holy light around what it struck (once every 1.5 s).', { icd: 1.5 })]],
  ['ring', null, 'rift-band-of-the-sworn-word', 'Band of the Sworn Word', '#e8c870', 'power', 'It tightens a little when you lie.', [S('power', 6), P('sworn-word', 'hit', CDR(0.2), 'Oath Strike hits take 0.2 s off your cooldowns (once every 0.4 s).', { skill: 'crusader-strike', icd: 0.4 })]],
  ['ring', null, 'rift-ring-of-the-quiet-sentence', 'Ring of the Quiet Sentence', '#d8c8a0', 'holy', 'Some judgments are best delivered in a whisper.', [CD('sentence', 25), KILL('sentence', RES(2)), D('lance-of-noon', 30)]],
  ['ring', 0, 'rift-ring-of-mending-light', 'Ring of Mending Light', '#fff0c0', 'healing', 'It glows when someone near is hurt. Usually you.', [S('healing', 15), K('holy-shock', { op: 'bounce', n: 1 })]],
  ['ring', 1, 'rift-ring-of-the-iron-vow', 'Ring of the Iron Vow', '#c0a050', 'armor', 'Hammered from a broken shield, and still a shield.', [CD('avengers-shield', 20), P('iron-vow', 'hit', WARD(6, 4), 'Thrown Aegis striking an enemy shields you for 6% of your health for 4 s (once every 2 s).', { skill: 'avengers-shield', icd: 2 })]],
  ['ring', 2, 'rift-ring-of-the-scorched-palm', 'Ring of the Scorched Palm', '#ff9a3d', 'holy', 'It leaves a mark. That is the point.', [K('templars-verdict', { op: 'bonusVs', status: 'mark', pct: 20 }), P('scorched-palm', 'crit', ST('mark', 6, 10), 'A critical hit brands the enemy: it takes 10% more damage from you for 6 s (once every 0.5 s).', { icd: 0.5 })]],
  // relic
  ['relic', null, 'rift-the-pocket-sundial', 'The Pocket Sundial', '#ffe8a0', 'holy', 'It tells the time even at night. Nobody asks how.', [EVERY('sundial', 5, 'judgment', 0.8, 'Every 5 s in a fight: an echo of Sunbrand at the nearest enemy, at 80%.')]],
  ['relic', null, 'rift-the-font-flask', 'The Font Flask', '#c8e0ff', 'healing', 'Water from a font that has never once frozen.', [S('healing', 15), P('font-flask', 'tick', HEAL(2), 'Every 4 s in a fight: 2% of your health back.', { icd: 4 })]],
  ['relic', null, 'rift-the-little-hammer', 'The Little Hammer', '#d8c890', 'holy', 'A relic of the smith who made the first holy hammer. It is very small.', [EVERY('little-hammer', 8, 'hammer-of-justice', 1, 'Every 8 s in a fight: an echo of Gavel of Dawn on the nearest enemy, stunning it.')]],
  ['relic', 0, 'rift-the-everlamp', 'The Everlamp', '#fff4c0', 'healing', 'It has been lit since the first morning, and it is not tired.', [EVERY('everlamp', 5, 'holy-shock', 0.8, 'Every 5 s in a fight: an echo of Sun Spark at the nearest enemy, at 80%.')]],
  ['relic', 1, 'rift-a-shard-of-the-rampart', 'A Shard of the Rampart', '#c8a860', 'armor', 'The rest of the wall is still standing, somewhere.', [EVERY('rampart-shard', 6, 'avengers-shield', 0.8, 'Every 6 s in a fight: an echo of Thrown Aegis at the nearest enemy, at 80%.')]],
  ['relic', 2, 'rift-cinder-of-the-high-court', 'Cinder of the High Court', '#ff8a30', 'holy', 'Taken from the hearth where verdicts were burned into wood.', [P('high-court', 'tick', BUFF('high-court', 'Fervor', 3, '#ff8a30', { stats: { holy: 15, crit: 10 } }), 'Every 6 s in a fight: +15% holy damage and +10% critical chance for 3 s.', { icd: 6 }), KILL('templars-verdict', RES(1))]],
];

/* ------------------------------------------------------------------ the Priest: Aegis, Lumen, Umbral */

const PRIEST: Row[] = [
  // off-hand
  ['offhand', null, 'rift-book-of-small-mercies', 'The Book of Small Mercies', '#f2ece0', 'healing', 'No miracle in it is larger than a sparrow. They add up.', [S('healing', 15), CAST('power-word-shield', HEAL(5))]],
  ['offhand', null, 'rift-breviary-of-ash', 'Breviary of Ash', '#9a8ab0', 'shadow', 'Read it backward and the prayers still work. Differently.', [D('shadow-word-pain', 30), HIT('shadow-word-pain', ST('weaken', 4, 10))]],
  ['offhand', null, 'rift-missal-of-the-turning-year', 'Missal of the Turning Year', '#d8c8a0', 'holy', 'A prayer for every day, and one for the day after the last.', [K('holy-nova', { op: 'area', pct: 25 }), HIT('holy-nova', ST('weaken', 4, 10))]],
  ['offhand', 0, 'rift-codex-of-atonement', 'Codex of Atonement', '#ffe9c0', 'holy', 'Every wrong in it has been written down, and every one forgiven.', [CD('penance', 20), CAST('penance', WARD(10, 3))]],
  ['offhand', 1, 'rift-hymnal-of-the-rising-choir', 'Hymnal of the Rising Choir', '#ffd27a', 'holy', 'Open it anywhere and someone starts to sing.', [K('holy-fire', { op: 'charges', n: 1 }), K('holy-nova', { op: 'build', n: 1 })]],
  ['offhand', 2, 'rift-the-black-vellum', 'The Black Vellum', '#4a3a6a', 'shadow', 'Nothing written on it can be read in daylight.', [CD('mind-blast', 20), HIT('vampiric-touch', ST('weaken', 5, 15))]],
  // head
  ['head', null, 'rift-cowl-of-the-vigil', 'Cowl of the Vigil', '#e8e0d0', 'healing', 'It has kept watch over a thousand sickbeds.', [S('healing', 15), CD('renew', 25), CAST('renew', WARD(8, 4))]],
  ['head', null, 'rift-hood-of-the-inward-eye', 'Hood of the Inward Eye', '#8a7ab0', 'shadow', 'It sees what you are thinking, and agrees.', [D('mind-blast', 30), HIT('mind-blast', BOOM(40, 0.5, 'shadow'))]],
  ['head', null, 'rift-veil-of-the-quiet-choir', 'Veil of the Quiet Choir', '#f0e8c0', 'holy', 'It hums a hymn too low to hear.', [D('smite', 25), P('quiet-choir', 'crit', CDR(0.4), 'A critical Smite takes 0.4 s off your cooldowns (once every 0.5 s).', { skill: 'smite', icd: 0.5 })]],
  ['head', 0, 'rift-hood-of-the-penitent', 'Hood of the Penitent', '#fff0d8', 'holy', 'Pulled low. It hides nothing from the light.', [D('seraph-lance', 30), P('penitent', 'ult', READY('power-word-shield'), 'Your ultimate makes Ward of Grace ready at once.')]],
  ['head', 1, 'rift-the-cantors-hood', 'The Cantor’s Hood', '#ffe070', 'holy', 'It always knows the next line.', [D('halo', 30), K('smite', { op: 'build', n: 1 })]],
  ['head', 2, 'rift-hood-of-the-hollow-voice', 'Hood of the Hollow Voice', '#5a4a7a', 'shadow', 'Speak in it and the echo answers first.', [D('nights-maw', 30), P('hollow-voice', 'ult', READY('mind-blast'), 'Your ultimate makes Thought Lash ready at once.')]],
  // chest
  ['chest', null, 'rift-robe-of-the-unspoken-ward', 'Robe of the Unspoken Ward', '#f2ece0', 'hpPct', 'It answers a prayer before you finish it.', [S('hpPct', 8), P('unspoken-ward', 'hurt', READY('power-word-shield'), 'A blow taken may make Ward of Grace ready at once (one in five, once every 6 s).', { chance: 0.2, icd: 6 })]],
  ['chest', null, 'rift-vestments-of-the-two-lights', 'Vestments of the Two Lights', '#c8b8e8', 'shadow', 'Half sunrise, half dusk, sewn down the middle.', [S('holy', 10), S('shadow', 10), P('two-lights', 'kill', RES(3), 'Every kill gives back 3% of your mana (once every 0.5 s).', { icd: 0.5 })]],
  ['chest', null, 'rift-cassock-of-the-dusk-shade', 'Cassock of the Dusk Shade', '#4a3a6a', 'pet', 'It casts a shadow of its own. The shadow has errands.', [CD('shadow-fiend', 30), S('pet', 30), CAST('shadow-fiend', WARD(10, 4))]],
  ['chest', 0, 'rift-robe-of-the-gentle-wall', 'Robe of the Gentle Wall', '#fff0d0', 'healing', 'Nothing gets through. Nothing is harmed either.', [D('penance', 30), P('gentle-wall', 'hit', WARD(10, 4), 'Atoning Light striking a Weakened enemy shields you for 10% of your health for 4 s (once every 4 s).', { skill: 'penance', status: 'weaken', icd: 4 })]],
  ['chest', 1, 'rift-sunlit-surplice', 'Sunlit Surplice', '#ffe090', 'holy', 'Bleached by a sun that never set on it.', [D('holy-fire', 30), LAND('holy-fire', BOOM(36, 0.5, 'holy'))]],
  ['chest', 2, 'rift-robe-of-the-drawn-breath', 'Robe of the Drawn Breath', '#3a2a5a', 'shadow', 'Every thread in it was taken from something that did not need it.', [D('vampiric-touch', 25), P('drawn-breath', 'kill', BOOM(46, 0.8, 'shadow', AS('curse', 5, 0.3)), 'A Cursed enemy that dies bursts, cursing whatever is near (once every 0.5 s).', { status: 'curse', icd: 0.5 })]],
  // legs
  ['legs', null, 'rift-featherweight-leggings', 'Featherweight Leggings', '#f0f0ff', 'speed', 'They weigh less than the air they push aside.', [S('speed', 8), P('featherweight', 'dodge', RES(4), 'Every Swift Feather gives back 4% of your mana.')]],
  ['legs', null, 'rift-processional-leggings', 'Processional Leggings', '#e8d8b0', 'healing', 'They know every step of every rite, and keep time.', [S('healing', 10), P('procession', 'dodge', BUFF('procession', 'Procession', 6, '#e8d8b0', { hot: 1.5 }), 'Every Swift Feather: 1.5% of your health back every second for 6 s.')]],
  ['legs', null, 'rift-leggings-of-the-long-wail', 'Leggings of the Long Wail', '#7a6a9a', 'shadow', 'Sewn by someone who would not stop screaming. They did, eventually.', [CD('psychic-scream', 25), HIT('psychic-scream', ST('curse', 4, 0.3))]],
  ['legs', 0, 'rift-the-kneelers', 'The Kneelers', '#fff4e0', 'healing', 'Padded for long prayers. Armored for short ones.', [S('armor', 10), P('kneelers', 'dodge', READY('penance'), 'Every Swift Feather makes Atoning Light ready at once (once every 6 s).', { icd: 6 })]],
  ['legs', 1, 'rift-sunpath-leggings', 'Sunpath Leggings', '#ffe8a0', 'holy', 'Where they have walked, the morning comes early.', [D('holy-nova', 25), P('sunpath', 'dodge', PTS(1), 'Every Swift Feather gives a Psalm.')]],
  ['legs', 2, 'rift-leggings-of-the-long-dusk', 'Leggings of the Long Dusk', '#4a3a6a', 'shadow', 'Evening in them lasts a while.', [S('shadow', 8), P('long-dusk', 'dodge', ECHO('vampiric-touch', 1), 'Every Swift Feather lays an echo of Leeching Touch on the nearest enemy (once every 4 s).', { icd: 4 })]],
  // hands
  ['hands', null, 'rift-the-almoners-gloves', 'The Almoner’s Gloves', '#e8e0c8', 'healing', 'They have given away everything but themselves.', [CD('holy-nova', 20), CAST('holy-nova', HEAL(3))]],
  ['hands', null, 'rift-palms-of-rebuke', 'Palms of Rebuke', '#f8e8b0', 'holy', 'Raised, they stop a charging bull. Lowered, they forgive it.', [CD('chastise', 25), D('chastise', 40), HIT('grasp-of-faith', ST('stun', 1, 1))]],
  ['hands', null, 'rift-wraps-of-the-tearing-hand', 'Wraps of the Tearing Hand', '#6a4a8a', 'shadow', 'What they reach into does not close again.', [CD('harrowing', 25), HIT('harrowing', HEAL(3))]],
  ['hands', 0, 'rift-hands-of-quiet-penance', 'Hands of Quiet Penance', '#ffe0b0', 'holy', 'Folded, they are a wall. Open, they are a door.', [K('penance', { op: 'duration', pct: 30 }), HIT('hallowed-brand', WARD(8, 4))]],
  ['hands', 1, 'rift-candlewax-gloves', 'Candlewax Gloves', '#fff0c0', 'holy', 'Drip, drip, drip, and then a fire.', [CD('holy-fire', 20), K('holy-fire', { op: 'spend', per: 0.05 })]],
  ['hands', 2, 'rift-wraps-of-the-hungry-touch', 'Wraps of the Hungry Touch', '#5a3a7a', 'shadow', 'Cold, and they want to be warm.', [CD('vampiric-touch', 20), HIT('vampiric-touch', ARC(2, 0.6, 'shadow', 80))]],
  // feet
  ['feet', null, 'rift-lantern-road-sandals', 'Lantern Road Sandals', '#ffe8b0', 'speed', 'They light the next step and no further.', [S('speed', 8), P('lantern-road', 'dodge', NOVA(56, 1, 'holy'), 'Every Swift Feather ends in a burst of holy light around you (once every 2 s).', { icd: 2 })]],
  ['feet', null, 'rift-cloister-slippers', 'Cloister Slippers', '#d8d0c0', 'healing', 'Silent on stone, as is proper.', [S('healing', 15), CD('purify', 30), CAST('purify', WARD(12, 5))]],
  ['feet', null, 'rift-sanctuary-sandals', 'Sanctuary Sandals', '#fff0c8', 'holy', 'Wherever they stop, the ground is hallowed.', [CD('sanctuary', 30), K('sanctuary', { op: 'area', pct: 25 }), CAST('sanctuary', CLEANSE)]],
  ['feet', 0, 'rift-ward-walker-sandals', 'Ward-Walker Sandals', '#fff0d8', 'healing', 'They have never stepped outside the circle.', [CAST('power-word-shield', BUFF('ward-walker', 'Ward-Walker', 6, '#fff0d8', { stats: { speed: 20, holy: 15 } })), D('penance', 20)]],
  ['feet', 1, 'rift-psalmstep-sandals', 'Psalmstep Sandals', '#ffd890', 'holy', 'Each step is a word. A long walk is a hymn.', [S('holy', 10), P('psalmstep', 'kill', PTS(1), 'Every kill gives a Psalm (once every 0.5 s).', { icd: 0.5 })]],
  ['feet', 2, 'rift-sandals-of-the-hush', 'Sandals of the Hush', '#3a2a4a', 'shadow', 'Footsteps fall into them and do not come out.', [S('shadow', 8), P('hush', 'kill', READY('vampiric-touch'), 'A Cursed enemy that dies makes Leeching Touch ready at once (once every 2 s).', { status: 'curse', icd: 2 })]],
  // amulet (the class's third is The Hungering Locket)
  ['amulet', null, 'rift-the-little-halo', 'The Little Halo', '#fff0b0', 'ultCharge', 'Too small to wear on the head. Just right on the heart.', [S('ultCharge', 15), P('little-halo', 'ult', BUFF('little-halo', 'Haloed', 8, '#fff0b0', { hot: 3 }), 'Your ultimate: 3% of your health back every second for 8 s.')]],
  ['amulet', null, 'rift-twofold-prayer', 'Twofold Prayer', '#c8b8e8', 'shadow', 'Said once to the morning, once to the dark. Both answered.', [K('ult', { op: 'damage', pct: 30 }), P('twofold', 'ult', ECHO('holy-nova', 1), 'Your ultimate calls an echo of Radiant Burst around you.')]],
  ['amulet', 0, 'rift-amulet-of-the-weighing', 'Amulet of the Weighing', '#ffe8c0', 'holy', 'Each side of the scale holds a feather.', [S('holy', 12), CAST('seraph-lance', READY('penance'))]],
  ['amulet', 1, 'rift-sunchord-pendant', 'Sunchord Pendant', '#ffe070', 'holy', 'Strike it and the whole sky rings.', [D('holy-fire', 20), P('sunchord', 'ult', PTS(5), 'Your ultimate fills your Psalms to five before it rings out.')]],
  ['amulet', 2, 'rift-the-night-jewel', 'The Night Jewel', '#3a2a5a', 'shadow', 'It is black, until you look away.', [CAST('nights-maw', WARD(15, 6)), P('night-jewel', 'ult', ECHO('shadow-word-pain', 1, 3), 'Your ultimate lays three echoes of Creeping Pain after it.')]],
  // ring
  ['ring', null, 'rift-the-novices-band', 'The Novice’s Band', '#d8d0b0', 'healing', 'Plain tin. Every saint wore one like it once.', [S('healing', 10), P('novice', 'hit', HEAL(0.5), 'Your hits mend 0.5% of your health (once every 0.5 s).', { icd: 0.5 })]],
  ['ring', null, 'rift-dusk-bell-ring', 'Dusk Bell Ring', '#7a6a9a', 'shadow', 'It rings for the end of the day, and for other ends.', [P('dusk-bell', 'kill', ECHO('mind-blast', 0.8), 'Every kill: an echo of Thought Lash at the nearest enemy, at 80% (once every 2 s).', { icd: 2 })]],
  ['ring', null, 'rift-saints-knuckle', 'Saint’s Knuckle', '#f0e0b0', 'holy', 'It belonged to a saint who settled arguments the old way.', [S('crit', 4), P('saints-knuckle', 'crit', ST('weaken', 5, 15), 'A critical hit Weakens the enemy: 15% less damage dealt for 5 s (once every 0.5 s).', { icd: 0.5 })]],
  ['ring', 0, 'rift-ring-of-the-held-ward', 'Ring of the Held Ward', '#fff0d0', 'healing', 'It never lets a ward drop. Not once.', [CD('power-word-shield', 20), P('held-ward', 'hit', CHARGE(5), 'Hallowed Brand striking an enemy charges your ultimate by 5% (once every 2 s).', { skill: 'hallowed-brand', icd: 2 })]],
  ['ring', 1, 'rift-band-of-seven-psalms', 'Band of Seven Psalms', '#ffe08a', 'holy', 'Seven verses engraved inside. The eighth is up to you.', [D('smite', 20), P('seven-psalms', 'crit', READY('holy-fire'), 'A critical holy hit may make Searing Hymn ready at once (one in two, once every 4 s).', { dmgType: 'holy', chance: 0.5, icd: 4 })]],
  ['ring', 2, 'rift-ring-of-the-thin-veil', 'Ring of the Thin Veil', '#5a4a8a', 'shadow', 'Through it, the other side is very close.', [K('mind-blast', { op: 'bonusVs', status: 'curse', pct: 20 }), HIT('mind-blast', ST('curse', 5, 0.3))]],
  // relic (the class's third is the Censer of Mercy)
  ['relic', null, 'rift-beads-of-the-long-prayer', 'Beads of the Long Prayer', '#c8b090', 'haste', 'Count them all and you have prayed for a day.', [P('long-prayer', 'tick', BUFF('long-prayer', 'Long Prayer', 3, '#c8b090', { stats: { haste: 15, healing: 15 } }), 'Every 6 s in a fight: +15% haste and +15% healing for 3 s.', { icd: 6 })]],
  ['relic', null, 'rift-a-shadow-in-a-bottle', 'A Shadow in a Bottle', '#3a2a4a', 'shadow', 'Uncork it in the dark and nothing happens. Uncork it in the light, and stand back.', [EVERY('bottled-shadow', 5, 'shadow-word-pain', 1, 'Every 5 s in a fight: an echo of Creeping Pain on the nearest enemy.')]],
  ['relic', 0, 'rift-lantern-of-the-atoned', 'Lantern of the Atoned', '#ffe8c0', 'holy', 'Its light falls kindly on everyone, eventually.', [EVERY('atoned', 6, 'hallowed-brand', 1, 'Every 6 s in a fight: an echo of Hallowed Brand on the nearest enemy.')]],
  ['relic', 1, 'rift-the-caged-sun', 'The Caged Sun', '#ffd860', 'holy', 'It is smaller than it should be, and very angry about it.', [EVERY('caged-sun', 5, 'holy-nova', 0.8, 'Every 5 s in a fight: an echo of Radiant Burst around you, at 80%.')]],
  ['relic', 2, 'rift-the-gnawed-idol', 'The Gnawed Idol', '#4a2a5a', 'shadow', 'Something has been eating it. From the inside.', [EVERY('gnawed-idol', 6, 'mind-blast', 0.8, 'Every 6 s in a fight: an echo of Thought Lash at the nearest enemy, at 80%.')]],
];

/* ------------------------------------------------------------------ the Warlock: Hexer, Binder, Doomcaller */

const WARLOCK: Row[] = [
  // off-hand (the class's third is Plaguewrit)
  ['offhand', null, 'rift-grimoire-of-small-debts', 'Grimoire of Small Debts', '#6a3a8a', 'shadow', 'Every page is a promise to pay. Some are signed in ink.', [K('drain-life', { op: 'duration', pct: 30 }), HIT('drain-life', CHARGE(1))]],
  ['offhand', null, 'rift-ledger-of-the-pit', 'Ledger of the Pit', '#8a2a2a', 'shadow', 'Accounts are settled in full. Interest is taken in kind.', [CD('life-tap', 30), CAST('life-tap', WARD(12, 5))]],
  ['offhand', 0, 'rift-the-book-of-slow-rot', 'The Book of Slow Rot', '#6a8a3a', 'shadow', 'Its pages yellow as you read them.', [CAST('corruption', PTS(1)), HIT('unstable-affliction', HEAL(2))]],
  ['offhand', 1, 'rift-the-binding-codex', 'The Binding Codex', '#c84a3a', 'pet', 'Every demon in it signed. Some of them twice.', [S('pet', 25), CAST('summon-felguard', BUFF('binding-codex', 'Bound', 8, '#c84a3a', { stats: { pet: 30 } }))]],
  ['offhand', 2, 'rift-the-tome-of-endings', 'The Tome of Endings', '#ff5a2a', 'fire', 'Every story in it ends the same way. Loudly.', [K('chaos-bolt', { op: 'charges', n: 1 }), LAND('chaos-bolt', BOOM(44, 0.5, 'fire', AS('burn', 3, 0.25)))]],
  // head
  ['head', null, 'rift-cowl-of-the-unsaid', 'Cowl of the Unsaid', '#4a3a6a', 'shadow', 'It hears the curses you do not speak.', [D('corruption', 30), K('corruption', { op: 'range', pct: 30 }), CAST('corruption', HEAL(2))]],
  ['head', null, 'rift-gatewatchers-hood', 'Gatewatcher’s Hood', '#6a3a9a', 'shadow', 'Something on the other side is always looking back.', [CD('gate-step', 30), CAST('gate-step', TEAR(2.2))]],
  ['head', null, 'rift-the-horned-cowl', 'The Horned Cowl', '#8a2a3a', 'fire', 'The horns are not decoration. They grew.', [S('fire', 10), S('shadow', 10), P('horned-cowl', 'hurt', FEAR(60, 2), 'A blow taken may terrify everything near you for 2 s (one in four, once every 8 s).', { chance: 0.25, icd: 8 })]],
  ['head', 0, 'rift-veil-of-the-witchmother', 'Veil of the Witchmother', '#5a8a3a', 'shadow', 'She wore it to every funeral. She caused most of them.', [D('withering-dark', 30), P('witchmother', 'ult', ECHO('unstable-affliction', 1, 2), 'Your ultimate lays two echoes of Wild Hex after it.')]],
  ['head', 1, 'rift-the-pitcallers-hood', 'The Pitcaller’s Hood', '#a83a2a', 'pet', 'Speak into it, and something down below listens.', [D('summon-infernal', 30), P('pitcaller', 'ult', BUFF('pitcaller', 'Pit Called', 10, '#a83a2a', { stats: { pet: 40 } }), 'Your ultimate rouses the pit: your demons hit 40% harder for 10 s.')]],
  ['head', 2, 'rift-doomsayers-hood', 'Doomsayer’s Hood', '#ff6a2a', 'fire', 'Everything it foretold came true. It foretold fire.', [D('ruin-unbound', 30), P('doomsayer', 'ult', READY('chaos-bolt'), 'Your ultimate makes Ruin Bolt ready at once.')]],
  // chest
  ['chest', null, 'rift-robe-of-the-red-bargain', 'Robe of the Red Bargain', '#902a3a', 'shadow', 'The terms are stitched into the lining.', [CD('blood-pact', 30), CAST('blood-pact', NOVA(60, 1, 'shadow'))]],
  ['chest', null, 'rift-shroud-of-the-lantern-eater', 'Shroud of the Lantern-Eater', '#3a2a4a', 'hpPct', 'Lamps go out when it passes. Then they go missing.', [S('hpPct', 10), P('lantern-eater', 'hurt', HEAL(3), 'A blow taken feeds the shroud: 3% of your health back (once every 3 s).', { icd: 3 })]],
  ['chest', null, 'rift-tetherweave-robe', 'Tetherweave Robe', '#6a4a8a', 'shadow', 'Every thread is tied to something. Pull one.', [CD('soul-tether', 30), HIT('soul-tether', ST('curse', 5, 0.3)), D('soul-spike', 25)]],
  ['chest', 0, 'rift-robe-of-the-plague-saint', 'Robe of the Plague Saint', '#6a8a3a', 'shadow', 'Worshipped in one village. Feared in all the others.', [HIT('corruption', ST('weaken', 5, 15)), D('unstable-affliction', 30)]],
  ['chest', 1, 'rift-robe-of-the-chained-host', 'Robe of the Chained Host', '#b04030', 'pet', 'The demons wear chains. So, in a way, do you.', [P('chained-host', 'hurt', SUMMON('imp', 1, 8), 'A blow taken calls an imp out of the pit to fight for 8 s (once every 8 s).', { icd: 8 }), CAST('summon-felguard', HEAL(5))]],
  ['chest', 2, 'rift-robe-of-the-burning-hour', 'Robe of the Burning Hour', '#ff6a20', 'fire', 'It is always the burning hour somewhere.', [S('fire', 12), K('chaos-bolt', { op: 'bonusVs', status: 'curse', pct: 25 }), KILL('chaos-bolt', PTS(1))]],
  // legs
  ['legs', null, 'rift-shadewalker-leggings', 'Shadewalker Leggings', '#4a3a5a', 'shadow', 'Half of each step happens somewhere else.', [CD('demonic-step', 20), P('shadewalker', 'dodge', BUFF('shadewalker', 'Unseen', 3, '#4a3a5a', { stats: { power: 15 } }), 'Every Demonic Step: +15% damage for 3 s.')]],
  ['legs', null, 'rift-snarecloth-leggings', 'Snarecloth Leggings', '#3a2a5a', 'shadow', 'Step where they step and you will not step again.', [CD('shadow-snare', 30), K('shadow-snare', { op: 'area', pct: 30 }), HIT('shadow-snare', ST('curse', 5, 0.3))]],
  ['legs', null, 'rift-tithebound-leggings', 'Tithebound Leggings', '#8a2a3a', 'hpPct', 'They take their share of every step.', [S('hpPct', 8), CAST('life-tap', BUFF('tithebound', 'Tithed', 6, '#8a2a3a', { stats: { power: 15 } }))]],
  ['legs', 0, 'rift-crawling-rot-leggings', 'Crawling Rot Leggings', '#5a7a2a', 'shadow', 'They spread, a little, if left alone.', [TRAIL('demonic-step', 0.12, 'shadow', 'shadow', AS('curse', 4, 0.2)), K('unstable-affliction', { op: 'afterDodge', window: 2, pct: 30 })]],
  ['legs', 1, 'rift-leggings-of-the-leashed', 'Leggings of the Leashed', '#a04030', 'pet', 'There is a leash sewn into the hem. It goes somewhere hot.', [P('leashed', 'dodge', SUMMON('imp', 1, 6), 'Every Demonic Step leaves an imp behind to fight for 6 s (once every 6 s).', { icd: 6 }), K('soul-spike', { op: 'afterDodge', window: 2, pct: 30 })]],
  ['legs', 2, 'rift-pyrewalk-leggings', 'Pyrewalk Leggings', '#ff7a2a', 'fire', 'Every step a spark. Every spark an opinion.', [S('fire', 10), P('pyrewalk', 'dodge', READY('chaos-bolt'), 'Every Demonic Step may make Ruin Bolt ready at once (one in two, once every 6 s).', { chance: 0.5, icd: 6 })]],
  // hands
  ['hands', null, 'rift-the-siphoning-hands', 'The Siphoning Hands', '#6a2a4a', 'shadow', 'Cold at the fingertips. Warm at the wrist.', [CD('drain-life', 20), HIT('drain-life', ST('weaken', 3, 10))]],
  ['hands', null, 'rift-impkeepers-gloves', 'Impkeeper’s Gloves', '#d05a2a', 'pet', 'Fireproof, nearly. Biteproof, nearly.', [S('pet', 20), CAST('summon-imp', SUMMON('imp', 1, 10))]],
  ['hands', null, 'rift-wraps-of-the-reaping', 'Wraps of the Reaping', '#5a3a5a', 'shadow', 'They close on the last of a thing.', [CD('harvest', 25), KILL('harvest', READY('harvest'))]],
  ['hands', 0, 'rift-the-wild-hand', 'The Wild Hand', '#6a9a3a', 'shadow', 'It casts what it likes. Luckily, it likes curses.', [K('unstable-affliction', { op: 'charges', n: 1 }), CD('unstable-affliction', 15)]],
  ['hands', 1, 'rift-soulpiercer-wraps', 'Soulpiercer Wraps', '#9a3a5a', 'shadow', 'Fingers like needles, and a thread to follow.', [CD('soul-spike', 20), HIT('soul-spike', SUMMON('imp', 1, 6))]],
  ['hands', 2, 'rift-ashen-hands', 'Ashen Hands', '#c84a2a', 'fire', 'Whatever they hold is already half ash.', [CD('chaos-bolt', 15), CAST('hellbrand', READY('chaos-bolt'))]],
  // feet
  ['feet', null, 'rift-ash-road-slippers', 'Ash Road Slippers', '#6a5a5a', 'speed', 'The road they walk is always freshly burned.', [S('speed', 8), P('ash-road', 'dodge', FEAR(60, 2), 'Every Demonic Step terrifies whatever was close behind you for 2 s (once every 5 s).', { icd: 5 })]],
  ['feet', null, 'rift-brimstone-slippers', 'Brimstone Slippers', '#d04a20', 'fire', 'They smell of sulfur and bad decisions.', [CD('rain-of-fire', 25), HIT('rain-of-fire', ST('burn', 3, 0.2))]],
  ['feet', null, 'rift-slippers-of-the-last-step', 'Slippers of the Last Step', '#4a2a3a', 'armor', 'Nobody who wore them ever ran. They did not need to.', [S('armor', 15), P('last-step', 'hurt', WARD(10, 4), 'A blow taken pulls a veil of shadow over you: a shield of 10% of your health for 4 s (once every 8 s).', { icd: 8 })]],
  ['feet', 0, 'rift-rotwalkers', 'Rotwalkers', '#6a7a3a', 'shadow', 'Nothing grows where they have walked. Something else does.', [S('shadow', 8), P('rotwalkers', 'kill', ECHO('corruption', 1), 'Every kill passes the rot on: an echo of Rotting Curse on the nearest enemy (once a second).', { icd: 1 })]],
  ['feet', 1, 'rift-cloven-slippers', 'Cloven Slippers', '#902a20', 'pet', 'Made for feet that were never meant to wear shoes.', [CD('summon-felguard', 25), P('cloven', 'kill', BUFF('cloven', 'Fed', 5, '#902a20', { stats: { pet: 25 }, max: 3 }), 'Every kill feeds the pit: your demons hit 25% harder for 5 s, stacking three times.')]],
  ['feet', 2, 'rift-doomstriders', 'Doomstriders', '#ff4a2a', 'fire', 'The end of the world goes at a walking pace in these.', [K('ruin-unbound', { op: 'range', pct: 30 }), P('doomstriders', 'kill', PTS(1), 'A Cursed enemy that dies gives a Doom (once every 0.5 s).', { status: 'curse', icd: 0.5 })]],
  // amulet
  ['amulet', null, 'rift-the-pact-amulet', 'The Pact Amulet', '#8a2a4a', 'ultCharge', 'Signed in the only ink that never fades.', [S('ultCharge', 15), P('pact-amulet', 'ult', BUFF('pact-amulet', 'Pact Kept', 10, '#8a2a4a', { stats: { shadow: 20, fire: 20 } }), 'Your ultimate keeps the pact: +20% shadow and fire damage for 10 s.')]],
  ['amulet', null, 'rift-the-imps-heart', 'The Imp’s Heart', '#e05a2a', 'pet', 'Still beating. Still sulking.', [S('pet', 20), P('imps-heart', 'ult', SUMMON('imp', 1, 20), 'Your ultimate calls an imp to fight for you for 20 s.')]],
  ['amulet', null, 'rift-locket-of-the-last-breath', 'Locket of the Last Breath', '#5a3a6a', 'shadow', 'Open it and you hear one long sigh.', [K('ult', { op: 'damage', pct: 30 }), P('last-breath', 'ult', HEAL(15), 'Your ultimate mends 15% of your health.')]],
  ['amulet', 0, 'rift-the-covens-locket', 'The Coven’s Locket', '#5a8a3a', 'shadow', 'Thirteen locks of hair. One of them moves.', [K('withering-dark', { op: 'area', pct: 25 }), HIT('withering-dark', ST('weaken', 6, 15))]],
  ['amulet', 1, 'rift-heart-of-brimstone', 'Heart of Brimstone', '#c84a20', 'pet', 'It burns hottest when it is obeyed.', [K('summon-infernal', { op: 'area', pct: 25 }), P('brimstone-heart', 'ult', WARD(20, 8), 'Your ultimate wraps you in brimstone: a shield of 20% of your health for 8 s.')]],
  ['amulet', 2, 'rift-the-last-ember', 'The Last Ember', '#ff5020', 'fire', 'When everything else has burned, this will still be warm.', [P('last-ember', 'ult', PTS(5), 'Your ultimate fills your Doom to five.'), HIT('ruin-unbound', ST('curse', 5, 0.3))]],
  // ring
  ['ring', null, 'rift-ring-of-the-black-tithe', 'Ring of the Black Tithe', '#4a2a4a', 'critDmg', 'It takes a little from every blow, and keeps it somewhere.', [S('critDmg', 20), P('black-tithe', 'crit', BUFF('black-tithe', 'Tithe', 4, '#4a2a4a', { stats: { shadow: 5 }, max: 5 }), 'Every critical hit: +5% shadow damage for 4 s, stacking five times (once every 0.3 s).', { icd: 0.3 })]],
  ['ring', null, 'rift-signet-of-the-seventh-gate', 'Signet of the Seventh Gate', '#6a3a9a', 'shadow', 'Seven gates, seven keys, and this is the one that opens outward.', [P('seventh-gate', 'kill', TEAR(1.8), 'Every kill tears a rift where the enemy fell that bursts after a moment (once a second).', { icd: 1 })]],
  ['ring', null, 'rift-band-of-the-burning-name', 'Band of the Burning Name', '#e05a20', 'fire', 'Engraved with a name. It is on fire. It always was.', [CD('hellbrand', 25), HIT('hellbrand', BOOM(40, 0.6, 'fire'))]],
  ['ring', 0, 'rift-the-blight-ring', 'The Blight Ring', '#6a8a2a', 'shadow', 'Wear it and your plants die. Your enemies follow.', [K('unstable-affliction', { op: 'bonusVs', status: 'curse', pct: 20 }), P('blightring', 'hit', CDR(0.3), 'Shadow Bolt striking a Cursed enemy takes 0.3 s off your cooldowns (once every 0.5 s).', { skill: 'shadow-bolt', status: 'curse', icd: 0.5 })]],
  ['ring', 1, 'rift-the-bargain-ring', 'The Bargain Ring', '#b04a30', 'pet', 'Half for you, half for them, and nobody counts.', [K('soul-spike', { op: 'bonusVs', status: 'mark', pct: 20 }), P('bargain', 'hit', BUFF('bargain', 'Bargain', 5, '#b04a30', { stats: { pet: 10 }, max: 4 }), 'Soul Spike hits strike a bargain: your demons hit 10% harder for 5 s, stacking four times.', { skill: 'soul-spike' })]],
  ['ring', 2, 'rift-pyreband', 'Pyreband', '#ff6a30', 'fire', 'Light it, and it lights everything else.', [K('chaos-bolt', { op: 'bonusVs', status: 'burn', pct: 20 }), P('pyreband', 'crit', READY('chaos-bolt'), 'A critical hit may make Ruin Bolt ready at once (one in four, once every 4 s).', { chance: 0.25, icd: 4 })]],
  // relic (the class's third is The Knightmaker’s Seal)
  ['relic', null, 'rift-the-speaking-skull', 'The Speaking Skull', '#d8d0b0', 'shadow', 'It gives very good advice. All of it is terrible.', [EVERY('speaking-skull', 5, 'corruption', 1, 'Every 5 s in a fight: an echo of Rotting Curse on the nearest enemy.')]],
  ['relic', null, 'rift-a-coal-from-the-pit', 'A Coal from the Pit', '#e04a1a', 'fire', 'It does not burn your hand. It is waiting for a better reason.', [EVERY('pit-coal', 6, 'rain-of-fire', 0.8, 'Every 6 s in a fight: an echo of Rain of Fire on the nearest enemy, at 80%.')]],
  ['relic', 0, 'rift-the-poppet', 'The Poppet', '#7a9a4a', 'shadow', 'Stuck full of pins. It is not you. Probably.', [EVERY('poppet', 7, 'unstable-affliction', 0.8, 'Every 7 s in a fight: an echo of Wild Hex on the nearest enemy, at 80%.')]],
  ['relic', 1, 'rift-the-pit-cage', 'The Pit Cage', '#c04030', 'pet', 'Rattle it, and something inside rattles back.', [P('pit-cage', 'tick', SUMMON('imp', 1, 8), 'Every 8 s in a fight, an imp climbs out of the cage to fight for 8 s.', { icd: 8 }), HIT('hellbrand', ST('fear', 1.5, 1))]],
  ['relic', 2, 'rift-a-shard-of-the-fallen-sky', 'A Shard of the Fallen Sky', '#ff4a1a', 'fire', 'It fell from very high up, and in a sense it is still falling.', [EVERY('fallen-sky', 6, 'chaos-bolt', 0.6, 'Every 6 s in a fight: an echo of Ruin Bolt at the nearest enemy, at 60%.')]],
];

/* ------------------------------------------------------------------ the Druid: Starseer, Wildclaw, Bearward */

// (a Wildclaw and a Bearward fight in a shape, so the class's own work through what every shape has: the basic
// attack and the dodge, whichever they are, the ultimate, and triggers)
const DRUID: Row[] = [
  // off-hand
  ['offhand', null, 'rift-the-acorn-idol', 'The Acorn Idol', '#8a6a3a', 'nature', 'Small now. Give it a few hundred years.', [S('nature', 10), P('acorn-idol', 'hurt', BUFF('acorn-idol', 'Oakheart', 5, '#8a6a3a', { dr: 12, hot: 1 }), 'A blow taken sets your roots: 12% less damage taken and 1% of your health back every second for 5 s (once every 10 s).', { icd: 10 })]],
  ['offhand', null, 'rift-moonstone-idol', 'Moonstone Idol', '#c8d0ff', 'arcane', 'It brightens and dims with a moon nobody else can see.', [D('basic', 20), P('moonstone', 'crit', RES(3), 'A critical hit gives back 3% of your mana (once every 0.5 s).', { icd: 0.5 })]],
  ['offhand', null, 'rift-seedheart', 'Seedheart', '#6a9a4a', 'nature', 'Plant it and something enormous will grow. Do not plant it.', [P('seedheart', 'tick', GROUND(44, 4, 0.08, 'nature', 'nature', { heal: 1 }), 'Every 8 s in a fight a bloom opens under you for 4 s: it heals you while you stand in it, and stings whatever stands in it with you.', { icd: 8 })]],
  ['offhand', 0, 'rift-the-falling-light', 'The Falling Light', '#c8d8ff', 'arcane', 'Catch it and it is just a stone. Watch it fall and it is everything.', [K('starsurge', { op: 'charges', n: 1 }), K('starsurge', { op: 'area', pct: 25 })]],
  ['offhand', 1, 'rift-skull-of-the-old-lynx', 'Skull of the Old Lynx', '#d8c8a0', 'physical', 'Small, sharp-toothed, and somehow still grinning.', [K('rake', { op: 'build', n: 1 }), D('rip', 25)]],
  ['offhand', 2, 'rift-the-den-idol', 'The Den Idol', '#8a6a4a', 'armor', 'It smells of a long winter and a full belly.', [CD('ironfur', 20), CAST('ironfur', TAUNT(80, 3))]],
  // head
  ['head', null, 'rift-the-antlered-hood', 'The Antlered Hood', '#8a7a5a', 'nature', 'The antlers grew after it was made. Nobody minds.', [S('hpPct', 6), P('antlered', 'hurt', NOVA(50, 0.6, 'nature', AS('root', 1.2, 1)), 'A blow taken bursts with thorny roots: everything near you is rooted for 1.2 s (once every 8 s).', { icd: 8 })]],
  ['head', null, 'rift-mask-of-many-shapes', 'The Mask of Many Shapes', '#a08a5a', 'haste', 'It fits whatever face you happen to have.', [S('haste', 6), CAST('cat-form', BUFF('many-shapes-lynx', 'Lynx Haste', 4, '#a08a5a', { stats: { haste: 20 } })), CAST('bear-form', WARD(12, 4))]],
  ['head', null, 'rift-wreath-of-the-first-spring', 'Wreath of the First Spring', '#8ac86a', 'healing', 'It flowers in winter, out of spite.', [S('healing', 15), CD('rejuvenation', 25), CAST('rejuvenation', CDR(1))]],
  ['head', 0, 'rift-cowl-of-the-night-sky', 'Cowl of the Night Sky', '#2a2a5a', 'arcane', 'Turn it inside out and you can see the stars at noon.', [K('starfall', { op: 'duration', pct: 30 }), HIT('starfall', PTS(1))]],
  ['head', 1, 'rift-the-nightprowl-hood', 'The Nightprowl Hood', '#5a4a3a', 'physical', 'It sees in the dark. It prefers it.', [D('bloodmoon-leap', 30), P('nightprowl', 'ult', PTS(5), 'Your ultimate fills your Ferocity to five as you leap.')]],
  ['head', 2, 'rift-the-sleepers-hood', 'The Sleeper’s Hood', '#6a5a4a', 'armor', 'Waking it is a mistake. Waking its wearer is a worse one.', [K('elder-roar', { op: 'area', pct: 25 }), P('sleeper', 'ult', BUFF('sleeper', 'Woken', 8, '#6a5a4a', { dr: 15, stats: { armor: 20 } }), 'Your ultimate wakes the sleeper: 15% less damage taken and +20 armor for 8 s.')]],
  // chest
  ['chest', null, 'rift-old-oak-jerkin', 'Old Oak Jerkin', '#7a5a3a', 'armor', 'It has rings, like the tree. Count them, if you have a week.', [S('armor', 20), P('old-oak', 'hurt', HEAL(2), 'A blow taken mends 2% of your health (once every 2 s).', { icd: 2 })]],
  ['chest', null, 'rift-mossweave-jerkin', 'Mossweave Jerkin', '#5a7a4a', 'nature', 'Green, damp, and alive in places.', [S('nature', 12), CD('thornhide', 25), CAST('thornhide', HEAL(8))]],
  ['chest', null, 'rift-hide-of-the-white-hart', 'Hide of the White Hart', '#e8e0d0', 'speed', 'Nobody has ever caught the white hart. This was a gift.', [S('speed', 8), CD('dodge', 15), P('white-hart', 'dodge', HEAL(3), 'Every dodge mends 3% of your health (once every 2 s).', { icd: 2 })]],
  ['chest', 0, 'rift-jerkin-of-the-two-moons', 'Jerkin of the Two Moons', '#b8c8ff', 'arcane', 'One moon on the front, one on the back, and both are full.', [HIT('moonfire', PTS(1)), K('starsurge', { op: 'bonusVs', status: 'curse', pct: 20 })]],
  ['chest', 1, 'rift-the-tawny-hide', 'The Tawny Hide', '#c8a060', 'physical', 'It ripples when something runs.', [D('rip', 25), P('tawny-hide', 'kill', BUFF('tawny-hide', 'Prowl', 4, '#c8a060', { stats: { crit: 10, speed: 15 } }), 'Every kill: +10% critical chance and 15% quicker for 4 s.')]],
  ['chest', 2, 'rift-cave-bear-pelt', 'Cave Bear Pelt', '#6a4a30', 'armor', 'Warm in winter, warmer in a fight.', [K('ironfur', { op: 'build', n: 1 }), P('cave-bear', 'hurt', BUFF('cave-bear', 'Thick Pelt', 5, '#6a4a30', { stats: { armor: 8 }, max: 4 }), 'A blow taken thickens your pelt: +8 armor for 5 s, stacking four times (once a second).', { icd: 1 })]],
  // legs
  ['legs', null, 'rift-wild-run-breeches', 'Wild Run Breeches', '#7a8a4a', 'speed', 'They know the way home from anywhere.', [S('speed', 8), K('dodge', { op: 'range', pct: 25 }), P('wild-run', 'dodge', CDR(0.5), 'Every dodge takes 0.5 s off your cooldowns.')]],
  ['legs', null, 'rift-rootbound-leggings', 'Rootbound Leggings', '#5a4a2a', 'nature', 'Plant your feet in them and they put down roots.', [CD('entangling-roots', 25), HIT('entangling-roots', ST('bleed', 4, 0.3))]],
  ['legs', null, 'rift-thornguard-breeches', 'Thornguard Breeches', '#6a7a3a', 'armor', 'They prick whatever touches them, which seems fair.', [S('armor', 10), P('thornguard', 'hurt', BUFF('thornguard', 'Thornguard', 4, '#6a7a3a', { thorns: 0.8 }), 'A blow taken grows thorns: you strike back at whatever hits you for 4 s (once every 6 s).', { icd: 6 })]],
  ['legs', 0, 'rift-comet-tail-leggings', 'Comet-Tail Leggings', '#a8c8ff', 'arcane', 'They leave a trail of light. People make wishes.', [TRAIL('wild-dash', 0.12, 'arcane', 'rift'), K('starsurge', { op: 'afterDodge', window: 2, pct: 30 })]],
  ['legs', 1, 'rift-springpaw-breeches', 'Springpaw Breeches', '#b89060', 'physical', 'Crouched, always. Even when sitting.', [CD('pounce', 20), LAND('pounce', BOOM(40, 0.8, 'physical', AS('bleed', 4, 0.3)))]],
  ['legs', 2, 'rift-greatpaw-breeches', 'Greatpaw Breeches', '#7a5a3a', 'armor', 'Built for standing up on two legs, and coming down hard.', [LAND('bear-charge', NOVA(56, 1)), K('bear-charge', { op: 'build', n: 1 })]],
  // hands
  ['hands', null, 'rift-thornwrapped-grips', 'Thornwrapped Grips', '#6a8a3a', 'nature', 'The thorns face outward. Mostly.', [D('basic', 15), HIT('basic', ST('bleed', 3, 0.2, 0.25))]],
  ['hands', null, 'rift-gloves-of-the-wildcrafter', 'Gloves of the Wildcrafter', '#8a7a4a', 'haste', 'They know which root heals and which one kills. Both are useful.', [S('haste', 8), CD('briar-burst', 25), HIT('briar-burst', HEAL(1))]],
  ['hands', null, 'rift-galecatcher-grips', 'Galecatcher Grips', '#a8c8c0', 'nature', 'The wind goes where they point.', [CD('gale', 30), HIT('gale', ST('chill', 2, 0.4)), K('thorn-volley', { op: 'projectiles', n: 2 })]],
  ['hands', 0, 'rift-glimmerfinger-gloves', 'Glimmerfinger Gloves', '#d8e0ff', 'arcane', 'They leave little sparks on everything they touch.', [K('wrath', { op: 'build', n: 1 }), CD('starsurge', 15)]],
  ['hands', 1, 'rift-razorguard-grips', 'Razorguard Grips', '#d8b880', 'physical', 'Every finger sheathes a second finger.', [D('claw', 25), HIT('claw', ST('bleed', 3, 0.25, 0.25))]],
  ['hands', 2, 'rift-the-heavy-paws', 'The Heavy Paws', '#6a5040', 'armor', 'Each one weighs as much as a small child, and hits harder.', [D('maul', 30), HIT('maul', HEAL(0.5))]],
  // feet
  ['feet', null, 'rift-deerpath-boots', 'Deerpath Boots', '#8a7050', 'speed', 'They find the old ways through the trees.', [S('speed', 10), P('deerpath', 'dodge', BUFF('deerpath', 'Deerpath', 3, '#8a7050', { stats: { power: 12, haste: 10 } }), 'Every dodge: +12% damage and +10% haste for 3 s.')]],
  ['feet', null, 'rift-hoofbeat-boots', 'Hoofbeat Boots', '#7a5a40', 'nature', 'You hear them before you see them, and then it is too late.', [CD('stampede', 30), LAND('stampede', NOVA(56, 1, 'nature', AS('root', 1, 1)))]],
  ['feet', null, 'rift-whirlroot-boots', 'Whirlroot Boots', '#5a6a3a', 'nature', 'They spin a little when you stand still.', [CD('vine-vortex', 25), HIT('vine-vortex', ST('bleed', 3, 0.3))]],
  ['feet', 0, 'rift-moonpath-boots', 'Moonpath Boots', '#c0c8ff', 'arcane', 'They walk only where the moonlight falls.', [S('arcane', 8), P('moonpath', 'dodge', ECHO('moonfire', 1), 'Every Wild Dash lays an echo of Moonburn on the nearest enemy (once every 3 s).', { icd: 3 })]],
  ['feet', 1, 'rift-silentpaws', 'Silentpaws', '#6a5a40', 'physical', 'Not a sound. Then, a very loud one.', [K('pounce', { op: 'charges', n: 1 }), P('silentpaws', 'dodge', PTS(1), 'Every dodge gives a point of Ferocity.')]],
  ['feet', 2, 'rift-greatbear-boots', 'Greatbear Boots', '#5a4030', 'armor', 'They leave prints the size of shields.', [K('thrash', { op: 'area', pct: 25 }), P('greatbear', 'dodge', NOVA(56, 1.2), 'Every dodge ends in a heavy landing: a burst around you (once every 2 s).', { icd: 2 })]],
  // amulet (the class's third is Lynxmother’s Claw)
  ['amulet', null, 'rift-the-ironwood-charm', 'The Ironwood Charm', '#6a5a3a', 'ultCharge', 'Carved from the one tree the axe would not bite.', [S('ultCharge', 15), P('ironwood', 'ult', BUFF('ironwood', 'Ironwood', 8, '#6a5a3a', { dr: 15 }), 'Your ultimate: 15% less damage taken for 8 s.')]],
  ['amulet', null, 'rift-moon-and-claw', 'Moon and Claw', '#d8d0b0', 'nature', 'A sliver of moon on one side, a claw on the other. Flip it.', [K('ult', { op: 'damage', pct: 30 }), P('moon-and-claw', 'ult', RES(25), 'Your ultimate gives back 25% of your mana.')]],
  ['amulet', 0, 'rift-starseed-pendant', 'Starseed Pendant', '#e0e8ff', 'arcane', 'A seed that fell from the sky. It wants to grow back up.', [K('starfall', { op: 'area', pct: 25 }), P('starseed', 'ult', READY('starsurge'), 'Your ultimate makes Starbreak ready at once.')]],
  ['amulet', 1, 'rift-tooth-of-the-red-moon', 'Tooth of the Red Moon', '#c84a3a', 'physical', 'Pulled from a jaw at moonrise. The moon was not pleased.', [K('bloodmoon-leap', { op: 'range', pct: 30 }), P('red-moon', 'ult', READY('rip'), 'Your ultimate makes Rip ready at once.')]],
  ['amulet', 2, 'rift-the-old-bears-tooth', 'The Old Bear’s Tooth', '#e0d8c0', 'armor', 'Yellow, worn, and longer than a finger.', [D('elder-roar', 30), P('old-bear', 'ult', PTS(5), 'Your ultimate fills your Scars to five.')]],
  // ring
  ['ring', null, 'rift-ring-of-the-living-vine', 'Ring of the Living Vine', '#5a8a3a', 'nature', 'It grows a little tighter every year, out of affection.', [S('nature', 8), P('living-vine', 'hit', ST('root', 0.8, 1), 'Your hits may root (one in five): held in place for 0.8 s (once every 3 s).', { chance: 0.2, icd: 3 })]],
  ['ring', null, 'rift-the-dewdrop-ring', 'The Dewdrop Ring', '#a8d8e8', 'healing', 'Every morning there is a drop of dew on it, and every morning it heals something.', [S('healing', 15), P('dewdrop', 'crit', HEAL(1.5), 'A critical hit mends 1.5% of your health (once every 0.5 s).', { icd: 0.5 })]],
  ['ring', null, 'rift-loop-of-the-wild-pack', 'Loop of the Wild Pack', '#a08060', 'crit', 'Every pack has a ring like this. Every pack is missing one.', [S('crit', 5), P('wild-pack', 'kill', BUFF('wild-pack', 'Wild Pack', 6, '#a08060', { stats: { power: 5, speed: 5 }, max: 4 }), 'Every kill: +5% damage and 5% quicker for 6 s, stacking four times.')]],
  ['ring', 0, 'rift-the-pole-star', 'The Pole Star', '#f0f0ff', 'arcane', 'Everything else turns around it.', [HIT('starsurge', ST('curse', 4, 0.3)), D('wrath', 20)]],
  ['ring', 1, 'rift-the-whisker-ring', 'The Whisker Ring', '#c8b890', 'physical', 'Thin as a whisker, and just as quick to feel trouble.', [CD('rake', 20), P('whisker', 'crit', READY('rake'), 'A critical hit may make Rake ready at once (one in four, once every 3 s).', { chance: 0.25, icd: 3 })]],
  ['ring', 2, 'rift-honeypaw-ring', 'Honeypaw Ring', '#e8b040', 'armor', 'Sticky. It does not come off. Nobody wants it to.', [HIT('thrash', HEAL(0.5)), K('thrash', { op: 'spend', per: 0.05 })]],
  // relic (the class's third is the Heartwood Totem)
  ['relic', null, 'rift-the-wind-chime', 'The Wind Chime', '#b8d8d0', 'nature', 'It rings when the wind changes, and the wind changes when it rings.', [P('wind-chime', 'tick', ARC(4, 0.9, 'nature', 100), 'Every 5 s in a fight the chime rings: a lash of thorns leaps between four enemies near you.', { icd: 5 })]],
  ['relic', null, 'rift-a-bundle-of-sage', 'A Bundle of Sage', '#9ab08a', 'healing', 'Burn a little and the air remembers how to be clean.', [P('sage', 'tick', BUFF('sage', 'Sage Smoke', 4, '#9ab08a', { hot: 1 }), 'Every 6 s in a fight: 1% of your health back every second for 4 s.', { icd: 6 }), P('sage-clean', 'tick', CLEANSE, 'Every 8 s in a fight, the smoke clears every harmful effect from you.', { icd: 8 })]],
  ['relic', 0, 'rift-the-star-chart', 'The Star Chart', '#c8d0ff', 'arcane', 'Half of these stars have not been born yet.', [EVERY('star-chart', 6, 'starsurge', 0.7, 'Every 6 s in a fight: an echo of Starbreak at the nearest enemy, at 70%.')]],
  ['relic', 1, 'rift-the-clawmarked-totem', 'The Clawmarked Totem', '#b08a50', 'physical', 'Every cat for miles has sharpened itself on it.', [S('physical', 10), P('clawmarked', 'tick', PTS(1), 'Every 3 s in a fight: a point of Ferocity.', { icd: 3 })]],
  ['relic', 2, 'rift-the-winter-den-stone', 'The Winter Den Stone', '#7a6a5a', 'armor', 'It is warm. It has always been warm. Do not ask why.', [P('winter-den', 'tick', BUFF('winter-den', 'Den Warmth', 4, '#7a6a5a', { hot: 1.5, dr: 10 }), 'Every 7 s in a fight: 10% less damage taken and 1.5% of your health back every second, for 4 s.', { icd: 7 }), K('thrash', { op: 'build', n: 1 })]],
];

/* ------------------------------------------------------------------ the Gloamknight: Bloodsworn, Ruinblade, Dreadbinder */

const GLOAMKNIGHT: Row[] = [
  // off-hand
  ['offhand', null, 'rift-the-dusk-lantern', 'The Dusk Lantern', '#6a4a9a', 'shadow', 'It gives off darkness, steadily, like a good lamp.', [S('shadow', 12), P('dusk-lantern', 'hit', RES(3), 'Gloam Cleave hits give 3 more Umbra (once every 0.3 s).', { skill: 'gloam-cleave', icd: 0.3 })]],
  ['offhand', null, 'rift-talisman-of-the-black-vow', 'Talisman of the Black Vow', '#3a2a4a', 'armor', 'Swear on it and the darkness takes notes.', [S('armor', 20), CD('black-oath', 25), CAST('black-oath', WARD(15, 5))]],
  ['offhand', null, 'rift-a-chip-of-gravestone', 'A Chip of Gravestone', '#8a8a9a', 'armor', 'The name on it was worn away by the rain. The rain was persistent.', [S('hpPct', 8), P('gravestone', 'hurt', BUFF('gravestone', 'Graven', 6, '#8a8a9a', { stats: { armor: 6 }, max: 5 }), 'A blow taken carves you harder: +6 armor for 6 s, stacking five times (once a second).', { icd: 1 })]],
  ['offhand', 0, 'rift-the-ledgerstone', 'The Ledgerstone', '#a02a3a', 'shadow', 'Every debt, carved in. Every payment, carved deeper.', [CD('hollow-ward', 20), CAST('hollow-ward', NOVA(60, 1, 'shadow', AS('weaken', 5, 15)))]],
  ['offhand', 1, 'rift-the-counterweight', 'The Counterweight', '#3a2a6a', 'physical', 'Hang it from the pommel and the blade swings itself.', [K('sundering-dark', { op: 'arc', pct: 30 }), K('gloam-cleave', { op: 'build', n: 1 })]],
  ['offhand', 2, 'rift-the-omen-glass', 'The Omen Glass', '#7a6aa0', 'shadow', 'It shows what comes next. It is never good.', [HIT('creeping-dread', ST('weaken', 4, 15)), K('dread-toll', { op: 'build', n: 1 })]],
  // head
  ['head', null, 'rift-gloamhelm', 'Gloamhelm', '#4a4a6a', 'shadow', 'Its visor is always a little darker than the room.', [D('umbral-rend', 30), HIT('umbral-rend', ST('curse', 5, 0.25))]],
  ['head', null, 'rift-the-mourners-visage', 'The Mourner’s Visage', '#5a5a7a', 'shadow', 'It weeps in the rain. Only in the rain.', [CD('mourning-arc', 25), K('mourning-arc', { op: 'arc', pct: 25 }), HIT('mourning-arc', RES(2))]],
  ['head', null, 'rift-the-tethered-helm', 'The Tethered Helm', '#3a3a5a', 'shadow', 'There is a chain on the back. It goes somewhere.', [CD('night-tether', 30), HIT('night-tether', READY('umbral-rend'))]],
  ['head', 0, 'rift-reckoning-day-helm', 'Reckoning Day Helm', '#a03040', 'shadow', 'It has come for what it is owed. It has a list.', [D('blood-reckoning', 30), P('reckoning-day', 'ult', BUFF('reckoning-day', 'Collected', 8, '#a03040', { stats: { power: 15 }, hot: 1.5 }), 'Your ultimate: +15% damage and 1.5% of your health back every second for 8 s.')]],
  ['head', 1, 'rift-helm-of-the-heavy-hour', 'Helm of the Heavy Hour', '#2a2a4a', 'physical', 'It weighs exactly as much as the moment before a blow.', [D('nightbreaker', 30), P('heavy-hour', 'ult', READY('sundering-dark'), 'Your ultimate makes Sundering Dark ready at once.')]],
  ['head', 2, 'rift-helm-of-ill-tidings', 'Helm of Ill Tidings', '#6a5a90', 'shadow', 'It has only ever brought bad news, and always in person.', [K('duskfall', { op: 'area', pct: 25 }), P('ill-tidings', 'ult', ECHO('creeping-dread', 1, 2), 'Your ultimate lays two echoes of Creeping Dread after it.')]],
  // chest
  ['chest', null, 'rift-nightplate', 'Nightplate', '#2a2a3a', 'armor', 'Forged at midnight and never once polished.', [S('armor', 20), CD('night-mantle', 25), CAST('night-mantle', HEAL(6))]],
  ['chest', null, 'rift-cuirass-of-the-price-paid', 'Cuirass of the Price Paid', '#902a3a', 'hpPct', 'It was expensive. You are still paying.', [S('hpPct', 10), CAST('blood-price', WARD(12, 6))]],
  ['chest', null, 'rift-the-shedskin-hauberk', 'The Shedskin Hauberk', '#5a5a6a', 'armor', 'It sloughs off what hurts it, like a snake, and with the same expression.', [CD('cast-off', 30), CAST('cast-off', NOVA(60, 1, 'shadow'))]],
  ['chest', 0, 'rift-carapace-of-red-debts', 'Carapace of Red Debts', '#a02030', 'armor', 'Every dent is a debt, and every debt is collected.', [S('armor', 15), CAST('hollow-ward', PTS(2))]],
  ['chest', 1, 'rift-the-bearing-plate', 'The Bearing Plate', '#3a3a5a', 'physical', 'It carries the weight, so the arms can swing it.', [S('critDmg', 20), HIT('sundering-dark', HEAL(2))]],
  ['chest', 2, 'rift-shroud-of-omens', 'Shroud of Omens', '#5a4a80', 'shadow', 'Every fold of it is a warning, and it has a great many folds.', [HIT('creeping-dread', HEAL(3)), K('dread-toll', { op: 'area', pct: 25 })]],
  // legs
  ['legs', null, 'rift-greaves-of-the-unbent-knee', 'Greaves of the Unbent Knee', '#4a4a5a', 'armor', 'They have knelt to nobody, and they are not starting now.', [CD('dodge', 15), P('unbent-knee', 'dodge', RES(10), 'Every Stand Fast gives 10 Umbra.')]],
  ['legs', null, 'rift-the-undertow-greaves', 'The Undertow Greaves', '#2a3a5a', 'shadow', 'Stand near them and you find yourself standing nearer.', [CD('dread-leap', 30), HIT('dread-leap', ST('weaken', 4, 15))]],
  ['legs', null, 'rift-lancers-greaves', 'Lancer’s Greaves', '#6a6a8a', 'shadow', 'Built for driving forward and never once looking back.', [CD('gloam-thrust', 25), LAND('gloam-thrust', NOVA(48, 0.8, 'shadow', AS('weaken', 4, 15)))]],
  ['legs', 0, 'rift-greaves-of-the-old-blood', 'Greaves of the Old Blood', '#902030', 'shadow', 'The blood in them is older than the iron.', [S('hpPct', 6), P('old-blood', 'dodge', READY('umbral-rend'), 'Every Stand Fast may make Umbral Rend ready at once (one in two, once every 4 s).', { chance: 0.5, icd: 4 })]],
  ['legs', 1, 'rift-heavystride-greaves', 'Heavystride Greaves', '#3a2a5a', 'physical', 'Each step leaves a crack. The cracks follow you.', [P('heavystride', 'dodge', WAVE(0.8, 130, 26), 'Every Stand Fast sends a wave of dusk rolling forward for 80% (once every 2 s).', { icd: 2 }), K('shadow-lunge', { op: 'build', n: 1 })]],
  ['legs', 2, 'rift-creepdark-greaves', 'Creepdark Greaves', '#4a3a6a', 'shadow', 'Wherever they walk, the shadows walk a little further.', [HIT('grasping-gloom', ST('curse', 4, 0.2)), K('creeping-dread', { op: 'bonusVs', status: 'chill', pct: 20 })]],
  // hands
  ['hands', null, 'rift-twohand-gauntlets', 'Twohand Gauntlets', '#6a6a7a', 'physical', 'One for the hilt, one for the pommel, and both for the swing.', [K('gloam-cleave', { op: 'arc', pct: 20 }), HIT('gloam-cleave', ST('armorBreak', 4, 10, 0.2))]],
  ['hands', null, 'rift-the-evenfall-grip', 'The Evenfall Grip', '#4a3a7a', 'shadow', 'It throws the dark like a stone, and the dark does not come back.', [CD('evenfall', 25), KILL('evenfall', READY('evenfall'))]],
  ['hands', null, 'rift-rendhand-gauntlets', 'Rendhand Gauntlets', '#5a3a5a', 'shadow', 'Built to grip a blade, or a throat, with no preference.', [K('umbral-rend', { op: 'charges', n: 1 }), CD('umbral-rend', 10)]],
  ['hands', 0, 'rift-the-red-hand', 'The Red Hand', '#a02030', 'shadow', 'It takes what is owed, and a little more.', [K('umbral-rend', { op: 'bonusVs', status: 'weaken', pct: 20 }), HIT('umbral-rend', PTS(1))]],
  ['hands', 1, 'rift-sunderhand-gauntlets', 'Sunderhand Gauntlets', '#2a2a4a', 'physical', 'Whatever they hold breaks first.', [CD('sundering-dark', 15), HIT('sundering-dark', WAVE(0.6, 130, 26))]],
  ['hands', 2, 'rift-pallbearers-gauntlets', 'Pallbearer’s Gauntlets', '#5a4a70', 'shadow', 'They have carried more than their share.', [KILL('creeping-dread', READY('dread-toll')), D('creeping-dread', 25)]],
  // feet
  ['feet', null, 'rift-grave-road-sabatons', 'Grave Road Sabatons', '#4a4a5a', 'armor', 'Every road ends at a grave. These are in no hurry.', [S('armor', 15), P('grave-road', 'hurt', BUFF('grave-road', 'Grave Patience', 5, '#4a4a5a', { stats: { power: 5 }, max: 4 }), 'A blow taken: +5% damage for 5 s, stacking four times (once a second).', { icd: 1 })]],
  ['feet', null, 'rift-lungestep-sabatons', 'Lungestep Sabatons', '#3a3a5a', 'speed', 'They arrive before the rest of you, and wait.', [S('speed', 8), P('lungestep', 'kill', RES(8), 'Every kill gives 8 Umbra (once every 0.3 s).', { icd: 0.3 })]],
  ['feet', null, 'rift-tollroad-sabatons', 'Tollroad Sabatons', '#5a4a7a', 'shadow', 'Pay as you pass. Everyone does.', [CD('dread-toll', 25), CAST('dread-toll', WARD(10, 4))]],
  ['feet', 0, 'rift-sabatons-of-the-last-stand', 'Sabatons of the Last Stand', '#802030', 'armor', 'They were found where the line held. Nothing else was found.', [K('blood-reckoning', { op: 'range', pct: 30 }), P('last-stand', 'hurt', CHARGE(3), 'A blow taken charges your ultimate by 3% (once a second).', { icd: 1 })]],
  ['feet', 1, 'rift-bladefall-sabatons', 'Bladefall Sabatons', '#3a2a5a', 'physical', 'Plant them, swing, and the world gets out of the way.', [K('nightbreaker', { op: 'area', pct: 25 }), P('bladefall', 'dodge', PTS(1), 'Every Stand Fast gives a point of Weight.')]],
  ['feet', 2, 'rift-dreadwalkers', 'Dreadwalkers', '#4a3a6a', 'shadow', 'Wherever they walk, something flees.', [S('shadow', 8), P('dreadwalkers', 'dodge', ECHO('creeping-dread', 1), 'Every Stand Fast lays an echo of Creeping Dread on the nearest enemy (once every 4 s).', { icd: 4 })]],
  // amulet
  ['amulet', null, 'rift-locket-of-the-last-light', 'Locket of the Last Light', '#8a7ab0', 'ultCharge', 'The last light of the last day, kept for a rainy one.', [S('ultCharge', 15), P('last-light', 'ult', RES(40), 'Your ultimate gives 40 Umbra.')]],
  ['amulet', null, 'rift-gorget-of-the-gloaming', 'Gorget of the Gloaming', '#4a4a70', 'shadow', 'It keeps the dusk close to the throat.', [K('ult', { op: 'damage', pct: 30 }), P('gloaming', 'ult', BUFF('gloaming', 'Gloaming', 8, '#4a4a70', { dr: 15, stats: { shadow: 15 } }), 'Your ultimate: 15% less damage taken and +15% shadow damage for 8 s.')]],
  ['amulet', null, 'rift-medallion-of-the-night-watch', 'Medallion of the Night Watch', '#3a3a5a', 'hpPct', 'Somebody has to stay awake. It volunteered.', [S('hpPct', 10), P('night-watch', 'kill', HEAL(2), 'Every kill mends 2% of your health (once every 0.5 s).', { icd: 0.5 })]],
  ['amulet', 0, 'rift-the-repaid-debt', 'The Repaid Debt', '#a02a3a', 'shadow', 'Paid in full. The receipt is still warm.', [HIT('blood-reckoning', HEAL(6)), P('repaid', 'ult', PTS(5), 'Your ultimate fills your Vengeance to five.')]],
  ['amulet', 1, 'rift-the-falling-anvil', 'The Falling Anvil', '#2a2a3a', 'physical', 'It only ever goes one way.', [P('falling-anvil', 'ult', PTS(5), 'Your ultimate fills your Weight to five before it swings.'), HIT('nightbreaker', ST('stun', 0.8, 1))]],
  ['amulet', 2, 'rift-the-tolling-pendant', 'The Tolling Pendant', '#7a6aa0', 'shadow', 'It rings once for each. It has been ringing all day.', [D('duskfall', 30), P('tolling', 'ult', READY('dread-toll'), 'Your ultimate makes Dread Toll ready at once.')]],
  // ring
  ['ring', null, 'rift-signet-of-the-gloam', 'Signet of the Gloam', '#5a4a7a', 'shadow', 'It stamps a little dusk on everything it seals.', [P('gloam-signet', 'hit', ST('weaken', 4, 10), 'Your hits may Weaken (one in five): 10% less damage dealt for 4 s.', { chance: 0.2, icd: 0.5 })]],
  ['ring', null, 'rift-ring-of-iron-blood', 'Ring of Iron Blood', '#702030', 'power', 'Cut yourself on it and you bleed iron.', [S('power', 6), P('iron-blood', 'kill', WARD(8, 4), 'Every kill wraps you in shadow: a shield of 8% of your health for 4 s (once every 3 s).', { icd: 3 })]],
  ['ring', null, 'rift-ring-of-the-crooked-moon', 'Ring of the Crooked Moon', '#8a8ab0', 'crit', 'The moon on it is the wrong shape. So, lately, is everyone else’s luck.', [S('crit', 5), P('crooked-moon', 'crit', CDR(0.3), 'A critical hit takes 0.3 s off your cooldowns (once every 0.5 s).', { icd: 0.5 })]],
  ['ring', 0, 'rift-pledgering', 'Pledgering', '#902a3a', 'shadow', 'Pledged in blood. Redeemed in more.', [HIT('umbral-rend', WARD(6, 4)), CD('hollow-ward', 15)]],
  ['ring', 1, 'rift-ring-of-the-whetted-dusk', 'Ring of the Whetted Dusk', '#3a3a6a', 'physical', 'The edge on it is sharper than the blade it came from.', [K('sundering-dark', { op: 'bonusVs', status: 'armorBreak', pct: 20 }), P('whetted-dusk', 'crit', PTS(1), 'A critical hit gives a point of Weight (once every 0.6 s).', { icd: 0.6 })]],
  ['ring', 2, 'rift-the-ninth-omen', 'The Ninth Omen', '#6a5aa0', 'shadow', 'The first eight came true. Everyone is waiting.', [K('creeping-dread', { op: 'bonusVs', status: 'curse', pct: 20 }), P('ninth-omen', 'kill', PTS(1), 'A Cursed enemy that dies gives an Omen (once every 0.5 s).', { status: 'curse', icd: 0.5 })]],
  // relic (the class's third is The Shepherd’s Bell)
  ['relic', null, 'rift-the-sextons-key', 'The Sexton’s Key', '#8a8a9a', 'shadow', 'It opens every gate in the graveyard. From either side.', [EVERY('sextons-key', 6, 'grasping-gloom', 0.8, 'Every 6 s in a fight: an echo of Grasping Gloom at the nearest enemy, at 80%.')]],
  ['relic', null, 'rift-a-shard-of-black-glass', 'A Shard of Black Glass', '#2a2a3a', 'shadow', 'It reflects nothing. It remembers everything.', [EVERY('black-glass', 5, 'umbral-rend', 0.7, 'Every 5 s in a fight: an echo of Umbral Rend at the nearest enemy, at 70%.')]],
  ['relic', 0, 'rift-a-vial-of-old-blood', 'A Vial of Old Blood', '#802030', 'shadow', 'Shake it and it remembers whose it was.', [EVERY('old-blood-vial', 7, 'night-tether', 1, 'Every 7 s in a fight: an echo of Night Tether on the nearest enemy, healing you as it binds.')]],
  ['relic', 1, 'rift-the-broken-hilt', 'The Broken Hilt', '#3a3a4a', 'physical', 'The blade is gone. The swing remains.', [EVERY('broken-hilt', 6, 'mourning-arc', 0.8, 'Every 6 s in a fight: an echo of Mourning Arc at the nearest enemy, at 80%.')]],
  ['relic', 2, 'rift-the-mourners-candle', 'The Mourner’s Candle', '#7a6aa0', 'shadow', 'It burns black, and it burns down very slowly.', [EVERY('mourners-candle', 6, 'dread-toll', 0.8, 'Every 6 s in a fight: an echo of Dread Toll around you, at 80%.')]],
];

/** Every class's, the Warrior first, in the order the class list shows them. */
export const SLOT_LEGENDS: SlotLegend[] = [
  ...of('warrior', WARRIOR),
  ...of('mage', MAGE),
  ...of('ranger', RANGER),
  ...of('paladin', PALADIN),
  ...of('priest', PRIEST),
  ...of('warlock', WARLOCK),
  ...of('druid', DRUID),
  ...of('gloamknight', GLOAMKNIGHT),
];
