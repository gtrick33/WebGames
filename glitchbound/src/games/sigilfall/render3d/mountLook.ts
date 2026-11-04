import type { MountDef } from '../data/mounts';

/**
 * What each mount is made from. A mount's colors in the data say what it looks like; this says which model carries
 * them, how big it stands, where the saddle sits on it, and how fast it has to go for its feet to keep to the ground.
 */

/** What a color in a model's file becomes: one of the mount's own colors, or a color of its own (#rrggbb). */
export type Swatch = 'coat' | 'mane' | 'tack' | 'barding' | (string & {});

export interface MountShape {
  /** The model (k/<kit>.pack). */
  kit: string;
  /** World pixels to one of the model's units: every mount's size comes from here, and not from how tall it is. */
  px: number;
  /** The top of its back under the saddle, in the model's units, and the joint that carries it. */
  seatY: number;
  seatZ: number;
  joint: string;
  /** Half the width of its back there. */
  backW: number;
  /** How far down its flanks a blanket's hem comes. */
  hemY: number;
  /** Ground speed (world pixels a second) its run clip is right for. */
  gallop: number;
  /** The rider's size, to someone on foot. */
  rider: number;
  /** Colors in the file that become the mount's own. */
  paint: Record<string, Swatch>;
  /** Parts of one color in the file that become different things, by how far along the animal they are. */
  zones?: { key: string; z0: number; z1: number; to: Swatch }[];
  /** Colors in the file that are thin sheets of hair, seen from both sides. */
  hair?: string[];
  /** Colors in the file to leave out (the bull's horns, on a boar). */
  without?: string[];
  /** Comes with its own saddle and bridle. */
  saddled?: boolean;
  /** Its shadow: how wide, how long and how far its middle is ahead of the saddle (world pixels). */
  shadow: { r: number; long: number; ahead: number };
}

/** Every horse shares a skeleton: only the coat and the build differ. */
const horse = (n: string, paint: Record<string, Swatch>, extra?: Partial<MountShape>): MountShape => ({
  kit: `m_horse_${n}`,
  px: 21,
  seatY: 1.67,
  seatZ: -0.1,
  joint: 'spine.004',
  backW: 0.27,
  hemY: 1.28,
  gallop: 112,
  rider: 0.85,
  paint,
  hair: Object.entries(paint).filter(([, s]) => s === 'mane').map(([k]) => k),
  shadow: { r: 11, long: 29, ahead: 7 },
  ...extra,
});

const SHAPES: Record<string, MountShape> = {
  'briarhollow-chestnut': horse('04', { '804000': 'coat', ffcf9f: 'mane' }),
  'gullport-strider': horse('13', { '7d7d7d': 'coat', '3c3c3c': 'mane', b8b8b8: '#e8e6e0' }),
  'royal-warhorse': horse('11', { '212121': 'coat', '050505': 'mane', '888888': 'tack', '200500': '#3a2a20', '002010': '#3a2a20' }),
  'sunhouse-courser': horse('10', { '9d4403': 'coat', ff8f20: 'tack', '563515': 'mane', '00402b': 'barding', '7e3b0e': 'coat', '60483c': '#8a6a3a', '5a4020': '#6a4a22', '4c3210': '#54381a' }, { saddled: true }),
  'ashen-nightmare': horse('16', {}, { saddled: true, hair: ['400000', '200000'] }),
  'crownfall-destrier': horse('12', { '9f958b': 'coat', '9f8b78': 'mane', '605448': 'mane', '9d4403': '#3a3442', '807060': '#2a2632', '60483c': '#141018', '807870': '#0e0c14' }),
  'starlit-charger': horse('17', { '485c60': 'coat', '607a80': '#3c4e8e', '303d40': '#20294e', '323040': '#20294e', '00d4ff': 'mane', '009fbf': 'mane' }),
  'cabinet-courser': horse(
    '05',
    { e9e9e9: 'coat', '39241e': 'tack', ffd5bf: 'mane', dfa78b: 'mane', ffb520: 'mane', '806a60': '#241048', dfbaa7: '#3a1d7a', bf9f8f: '#2a1458', '9f7864': '#1c0c3c' },
    { saddled: true, hair: ['39241e'], zones: [{ key: '39241e', z0: 0.4, z1: 9, to: 'mane' }, { key: '39241e', z0: -9, z1: -0.75, to: 'mane' }] },
  ),
};

const DEER: MountShape = {
  kit: 'a_stag',
  px: 10.2,
  seatY: 3.06,
  seatZ: 0.02,
  joint: 'Torso2',
  backW: 0.52,
  hemY: 2.3,
  gallop: 124,
  rider: 0.85,
  paint: { '866844': 'coat', b8a993: 'mane', '53412a': '#2a2018' },
  shadow: { r: 11, long: 27, ahead: 6 },
};

/** A bull under it all: the shoulders and the low head are the boar's, and what it lacks is built on. */
const BOAR: MountShape = {
  kit: 'a_bull',
  px: 6.9,
  seatY: 4.46,
  seatZ: -0.15,
  joint: 'Torso2',
  backW: 0.82,
  hemY: 3.15,
  gallop: 72,
  rider: 0.85,
  paint: { '2e2e2e': 'coat', '565851': '#1e1814', '745931': '#14100c', '3b3128': '#120e0a' },
  without: ['aca175'],
  shadow: { r: 11, long: 24, ahead: 4 },
};

const DRAKE: MountShape = {
  kit: 'fbx_trex',
  px: 0.0315,
  seatY: 1262,
  seatZ: 240,
  joint: 'Torso',
  backW: 190,
  hemY: 850,
  gallop: 110,
  rider: 0.92,
  paint: {},
  shadow: { r: 17, long: 44, ahead: -7 },
};

export function shapeOf(m: MountDef): MountShape {
  if (m.body === 'drake') return DRAKE;
  if (m.body === 'deer') return DEER;
  if (m.body === 'boar') return BOAR;
  return SHAPES[m.id] ?? horse('02', { a3a3a3: 'coat', '727272': 'mane', '676767': 'mane' });
}

/** Every model a mount is made from (a test holds them to the built files). */
export const mountKits = (): string[] => [...new Set([...Object.values(SHAPES).map((s) => s.kit), DEER.kit, BOAR.kit, DRAKE.kit, 'm_horse_02'])];
