/**
 * The arsenal. Every crew starts with the same kit; `ammo` -1 is unlimited. Pure data (the room
 * server checks a turn's weapon and ammo against it).
 */

export const WEAPON_IDS = ['rocket', 'grenade', 'splitter', 'zapper', 'mallet', 'dynamite', 'meteor'] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];
export const isWeaponId = (v: unknown): v is WeaponId => typeof v === 'string' && (WEAPON_IDS as readonly string[]).includes(v);

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** One line in the weapon tray. */
  hint: string;
  key: string;
  ammo: number;
  /** How it is aimed: an arc with power, a straight line, a swing, dropped at your feet, or a spot on the map. */
  aim: 'power' | 'line' | 'swing' | 'drop' | 'target';
  /** Blown by the wind. */
  wind: boolean;
  /** Blast radius and damage at the center. */
  radius: number;
  damage: number;
  /** Launch speed at full power (px/s). */
  speed: number;
  /** Seconds before it goes off (bouncing weapons). */
  fuse: number;
  /** Seconds you can still walk and jump after using it (dropped dynamite: run!). */
  retreat: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rocket: { id: 'rocket', name: 'Rocket', hint: 'Explodes on impact. Rides the wind.', key: '1', ammo: -1, aim: 'power', wind: true, radius: 40, damage: 45, speed: 950, fuse: 0, retreat: 0 },
  grenade: { id: 'grenade', name: 'Grenade', hint: 'Bounces, then blows after 3 seconds.', key: '2', ammo: -1, aim: 'power', wind: false, radius: 42, damage: 46, speed: 720, fuse: 3, retreat: 0 },
  splitter: { id: 'splitter', name: 'Splitter', hint: 'Bursts into five bomblets on impact.', key: '3', ammo: 2, aim: 'power', wind: true, radius: 26, damage: 22, speed: 860, fuse: 0, retreat: 0 },
  zapper: { id: 'zapper', name: 'Zapper', hint: 'A straight beam. No arc, no wind.', key: '4', ammo: -1, aim: 'line', wind: false, radius: 16, damage: 28, speed: 0, fuse: 0, retreat: 0 },
  mallet: { id: 'mallet', name: 'Bonk Mallet', hint: 'Swing at a neighbor: big knockback.', key: '5', ammo: 2, aim: 'swing', wind: false, radius: 0, damage: 22, speed: 0, fuse: 0, retreat: 0 },
  dynamite: { id: 'dynamite', name: 'Dynamite', hint: 'Drop it and run. Huge blast in 4 seconds.', key: '6', ammo: 1, aim: 'drop', wind: false, radius: 72, damage: 72, speed: 0, fuse: 4, retreat: 3 },
  meteor: { id: 'meteor', name: 'Meteor Shower', hint: 'Tap the map: five meteors fall there.', key: '7', ammo: 1, aim: 'target', wind: true, radius: 30, damage: 26, speed: 0, fuse: 0, retreat: 0 },
};

export const weaponList = (): WeaponDef[] => WEAPON_IDS.map((id) => WEAPONS[id]);

export const startAmmo = (): Record<WeaponId, number> => Object.fromEntries(WEAPON_IDS.map((id) => [id, WEAPONS[id].ammo])) as Record<WeaponId, number>;
