import type { ClassDef, ClassId, Stats } from './types';

const stats = (p: Partial<Stats>): Stats => ({
  hp: 0,
  hpPct: 0,
  power: 0,
  crit: 5,
  critDmg: 50,
  haste: 0,
  armor: 0,
  speed: 0,
  regen: 0,
  ultCharge: 0,
  potion: 0,
  physical: 0,
  fire: 0,
  frost: 0,
  lightning: 0,
  poison: 0,
  arcane: 0,
  ...p,
});

export const CLASSES: Record<ClassId, ClassDef> = {
  mage: {
    id: 'mage',
    name: 'Mage',
    role: 'Ranged magic · area damage · control',
    blurb: 'Fragile, far-reaching and explosive. Freeze a crowd, then burn it down, and never stand still for long.',
    difficulty: 2,
    base: stats({ hp: 90, armor: 0 }),
    hpPer: 9,
    basic: 'arcane-bolt',
    skills: ['fireball', 'frost-nova', 'chain-lightning', 'blink'],
    ult: 'meteor',
    dodge: 'phase-step',
    start: ['fireball', null, null],
    trees: [
      { name: 'Pyromancer', blurb: 'Burning, explosions and fire that spreads.', color: '#ff7a3d' },
      { name: 'Stormcaller', blurb: 'Lightning that chains, shocks and strikes.', color: '#5ad1ff' },
    ],
    refDamage: 20,
    colors: { main: '#6b4bd6', dark: '#3b2a8a', accent: '#ffcf5a' },
  },
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    role: 'Melee · tough · crowd crusher',
    blurb: 'Sword and shield in the thick of it. Hits hard, takes hits, and rewards every well-timed swing.',
    difficulty: 1,
    base: stats({ hp: 150, armor: 12 }),
    hpPer: 15,
    basic: 'cleave',
    skills: ['heavy-strike', 'whirlwind', 'shield-bash', 'charge'],
    ult: 'earthsplitter',
    dodge: 'sidestep',
    start: ['heavy-strike', null, null],
    trees: [
      { name: 'Berserker', blurb: 'Critical hits, risk and reward, blood for blood.', color: '#ff4f4f' },
      { name: 'Guardian', blurb: 'Shields, armor, counters and stuns.', color: '#ffd34d' },
    ],
    refDamage: 22,
    colors: { main: '#c9473b', dark: '#6e2420', accent: '#d8dce6' },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    role: 'Ranged precision · mobility · traps',
    blurb: 'Light on the feet and deadly at range. Mark the big ones, trap the rest, and keep moving.',
    difficulty: 3,
    base: stats({ hp: 110, armor: 4, speed: 4 }),
    hpPer: 11,
    basic: 'arrow',
    skills: ['piercing-arrow', 'multishot', 'poison-trap', 'hunters-mark'],
    ult: 'arrow-rain',
    dodge: 'tumble',
    start: ['piercing-arrow', null, null],
    trees: [
      { name: 'Deadeye', blurb: 'Critical hits, marks and single-target power.', color: '#ffe066' },
      { name: 'Trapper', blurb: 'Traps, poison and enemies that cannot move.', color: '#7be37b' },
    ],
    refDamage: 20,
    colors: { main: '#3f8f5a', dark: '#22553a', accent: '#c9a35a' },
  },
};

export const CLASS_IDS: ClassId[] = ['mage', 'warrior', 'ranger'];
export const emptyStats = (): Stats => stats({ crit: 0, critDmg: 0 });
export { stats as baseStats };

/** Experience to go from `level` to the next one. */
export const xpToNext = (level: number): number => Math.floor(40 * level ** 1.55 + 20);
export const MAX_LEVEL = 20;

/** Damage multiplier from character level alone. */
export const levelPower = (level: number): number => 1 + 0.12 * (level - 1);
