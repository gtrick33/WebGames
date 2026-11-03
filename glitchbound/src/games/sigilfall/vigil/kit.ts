/**
 * Sigilfall: The Vigil's own spells and strengths: none of them exist in the campaign. Hold the line against the
 * Ashen Host as long as you can. Each spell fires by itself; the player's choices are where to stand and what
 * to take when they level up. First build: the Mage. Other classes bring their own kits.
 */

export type SpellId = 'ember-bolt' | 'frost-ring' | 'chain-spark' | 'orbit-motes' | 'meteor' | 'ash-field';
export type StrengthId = 'might' | 'haste' | 'reach' | 'swift' | 'vigor' | 'mend' | 'magnet' | 'fortune';

export const MAX_SPELL = 5;
export const MAX_STRENGTH = 5;
/** How many spells and strengths one run can hold. */
export const SPELL_SLOTS = 5;
export const STRENGTH_SLOTS = 5;

export interface SpellDef {
  id: SpellId;
  name: string;
  text: string;
  /** What each level adds. */
  next: string;
  /** With this strength at level 3 and this spell at its top, the next pick evolves it. */
  evolve?: { with: StrengthId; name: string; text: string };
}

export const SPELLS: Record<SpellId, SpellDef> = {
  'ember-bolt': { id: 'ember-bolt', name: 'Ember Bolt', text: 'Flings a seeking ember at the nearest foe.', next: 'More embers, more damage', evolve: { with: 'haste', name: 'Phoenix Bolt', text: 'Embers pierce everything and burst where they land.' } },
  'frost-ring': { id: 'frost-ring', name: 'Frost Ring', text: 'A ring of cold bursts out from you and slows what it touches.', next: 'Wider, colder, more often', evolve: { with: 'reach', name: 'Absolute Zero', text: 'The ring freezes everything it touches solid.' } },
  'chain-spark': { id: 'chain-spark', name: 'Chain Spark', text: 'Lightning leaps from foe to foe.', next: 'More leaps, more damage' },
  'orbit-motes': { id: 'orbit-motes', name: 'Arcane Motes', text: 'Motes circle you and burn what they pass through.', next: 'More motes, faster' },
  meteor: { id: 'meteor', name: 'Falling Star', text: 'A star falls where the Host is thickest.', next: 'Bigger, and more often' },
  'ash-field': { id: 'ash-field', name: 'Burning Ground', text: 'Leaves a patch of burning ground where you stand.', next: 'Hotter, wider, longer' },
};

export const STRENGTHS: Record<StrengthId, { id: StrengthId; name: string; text: string }> = {
  might: { id: 'might', name: 'Might', text: '+15% damage' },
  haste: { id: 'haste', name: 'Haste', text: 'Spells come 10% faster' },
  reach: { id: 'reach', name: 'Reach', text: '+12% spell size' },
  swift: { id: 'swift', name: 'Swift Feet', text: '+8% move speed' },
  vigor: { id: 'vigor', name: 'Vigor', text: '+20% health' },
  mend: { id: 'mend', name: 'Mending', text: 'Regain 1 health a second' },
  magnet: { id: 'magnet', name: 'Lodestone', text: 'Pick up sparks from farther away' },
  fortune: { id: 'fortune', name: 'Fortune', text: '+10% experience' },
};

/**
 * The Host through the night: what comes when. Each is a sprite from the campaign with its own numbers here.
 * `from` is in seconds; the waves mix what is in season.
 */
export interface FoeDef {
  sprite: string;
  hp: number;
  dmg: number;
  speed: number;
  r: number;
  xp: number;
  from: number;
  /** After this time it stops coming. */
  to: number;
  /** How likely, among what is in season. */
  weight: number;
}

export const FOES: Record<string, FoeDef> = {
  slime: { sprite: 'slime', hp: 12, dmg: 6, speed: 46, r: 6, xp: 1, from: 0, to: 150, weight: 5 },
  beetle: { sprite: 'beetle', hp: 22, dmg: 7, speed: 40, r: 7, xp: 1, from: 30, to: 240, weight: 3 },
  hound: { sprite: 'hound', hp: 18, dmg: 8, speed: 82, r: 6, xp: 1, from: 60, to: 360, weight: 3 },
  skeleton: { sprite: 'skeleton', hp: 46, dmg: 10, speed: 50, r: 7, xp: 2, from: 110, to: 520, weight: 5 },
  boar: { sprite: 'boar', hp: 110, dmg: 14, speed: 60, r: 9, xp: 4, from: 200, to: 700, weight: 2 },
  cutthroat: { sprite: 'cutthroat', hp: 130, dmg: 16, speed: 66, r: 7, xp: 4, from: 300, to: 900, weight: 4 },
  enforcer: { sprite: 'enforcer', hp: 320, dmg: 22, speed: 52, r: 9, xp: 8, from: 460, to: 99999, weight: 3 },
  guardian: { sprite: 'guardian', hp: 620, dmg: 30, speed: 56, r: 10, xp: 14, from: 640, to: 99999, weight: 3 },
};

/** The champion at each boss time: bigger, slower, and it drops a free choice. */
export const BOSS_EVERY = 150;
export const BOSSES: { sprite: string; name: string }[] = [
  { sprite: 'guardian', name: 'The Gravewarden' },
  { sprite: 'enforcer', name: 'The Ash Captain' },
  { sprite: 'boar', name: 'The Bone Tusk' },
];
