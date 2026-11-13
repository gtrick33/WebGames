import { Build, mul, type C } from './build';
import { hexRgb } from './kits';

/**
 * The way from one land into the next (the owner: "a huge wall, entrance, caves, doors, whatever the zone finds
 * fitting", not an arch narrower than its road with the land cut off behind it). Each is built here, far wider and
 * taller than the road it stands over, around its own middle in tiles, facing +z (into the land it stands in): the road
 * runs through it along z. A land of rock keeps its cave mouth (doorways.ts).
 */
export interface GateLook {
  /** How wide the road through it is, in tiles. */
  span: number;
  /** Its stone or its timber, and what it is capped and trimmed with. */
  body: string;
  trim: string;
  /** The color of the land beyond (its banners and its lamps). */
  light: string;
  seed: number;
  /** How far its wall runs off from each tower, in tiles (9 where it's not said). */
  wings?: number;
  /** A way down, not a way through: its arch is full of dark. */
  shut?: boolean;
  /** Its wall ends in the open (a fortress's sally port, not a gate in a land's own wall): a great tower closes each end. */
  ends?: boolean | 'east' | 'west';
}

export interface GateBuilt {
  b: Build;
  /** Fires on it (x, z from its middle; y up), for the land to light. */
  flames: { x: number; z: number; y: number; size: number }[];
  glows: { x: number; z: number; y: number; color: string; size: number }[];
  /** Its opening, for the way through that fills it (portal.ts): tiles each side of its middle, tall, how far back, and the next land's light. */
  portal?: { half: number; high: number; z: number; color: string };
}

const rgb = hexRgb;

/** A normal too short to shade: the part gives its own light (meshKit's glowing parts). */
function alight(b: Build, from: number): void {
  for (let i = from; i < b.m.nor.length; i++) b.m.nor[i] = 0;
}

/**
 * What is seen through a gate: the way to the next land, a sheet of that land's light turning in on itself, from
 * post to post and from the road to the arch (render3d/portal.ts, which the land stands in the gate). The map ends a
 * pace past the gate, and what showed through it was bare ground in full daylight (the owner, of the gate to the
 * Whisperwood: "the light green grasping through the actual gate ... feels like incomplete zone"). It stands just
 * past the middle of the gate, so whoever goes through walks into it and is gone.
 *
 * It was two boxes of plain light with a patch of it painted on the road, and glows hung in the air before it. The
 * owner: "the gate's glows sometimes flicker ... make it dynamic, maybe with shaders, make it look more intense and
 * cartoony", and then, "through the whole 'hole' of our gate, without illuminating anything on the floor". So the
 * gate itself builds none of it now: it only says where its opening is.
 */
function veil(light: string, half: number, high: number): NonNullable<GateBuilt['portal']> {
  return { half, high, z: -0.59, color: light };
}

/**
 * A gatehouse of stone across the road: two towers taller than a house, a great arch between them with a portcullis
 * drawn up into it, the next land's banners down each tower, fire baskets on their tops, and the land's wall running
 * off from each tower as far as anyone can see.
 */
export function stoneGate(look: GateLook): GateBuilt {
  const b = new Build();
  const stone = rgb(look.body);
  const dark = mul(stone, 0.6);
  const hi = mul(stone, 1.12);
  const trim = rgb(look.trim);
  const cloth = rgb(look.light);
  const half = look.span / 2 + 0.25;
  const tw = 1.7;
  const tall = 5.2;
  const flames: GateBuilt['flames'] = [];
  const glows: GateBuilt['glows'] = [];
  for (const s of [-1, 1] as const) {
    const x0 = s < 0 ? -half - tw : half;
    const x1 = x0 + tw;
    // the tower: a battered foot, the shaft, a jutting crown
    b.box(x0 - 0.12, -1.0, x1 + 0.12, 1.0, 0, 0.5, dark, mul(dark, 0.8), stone);
    // (their tops dark, as a roof's lead is: seen from above a pale top is a blank sheet)
    const roof = mul(stone, 0.5);
    b.box(x0, -0.88, x1, 0.88, 0.5, tall, stone, dark, roof);
    b.box(x0 - 0.16, -1.04, x1 + 0.16, 1.04, tall, tall + 0.34, hi, stone, roof);
    b.merlons(x0 - 0.16, 1.04, x1 + 0.16, 1.04, tall + 0.34, 0.36, 0.2, stone, dark, hi);
    b.merlons(x0 - 0.16, -1.04, x1 + 0.16, -1.04, tall + 0.34, 0.36, 0.2, stone, dark, hi);
    // courses of darker stone, and an arrow slit with a lamp behind it
    for (const y of [1.5, 2.9, 4.2]) b.faceS(x0, x1, 0.885, y, y + 0.1, dark);
    const from = b.m.nor.length;
    b.faceS((x0 + x1) / 2 - 0.09, (x0 + x1) / 2 + 0.09, 0.89, 3.2, 3.95, cloth, mul(cloth, 1.2));
    alight(b, from);
    // the next land's banner down its face
    b.banner((x0 + x1) / 2, 0.9, 2.75, 0.92, 1.9, mul(cloth, 0.62), trim, mul(cloth, 1.15));
    // a fire basket on its top
    b.brazier((x0 + x1) / 2, 0, tall + 0.34, 1.5);
    flames.push({ x: (x0 + x1) / 2, z: 0, y: tall + 0.95, size: 1.15 });
    // the wall running off from it
    const wings = look.wings ?? 9;
    const w0 = s < 0 ? x0 - wings : x1;
    const w1 = s < 0 ? x0 : x1 + wings;
    b.box(w0, -0.5, w1, 0.5, 0, 3.0, mul(stone, 0.94), dark, mul(stone, 0.58));
    b.merlons(w0, 0.5, w1, 0.5, 3.0, 0.3, 0.22, stone, dark, hi);
    for (const y of [1.0, 2.0]) b.faceS(w0, w1, 0.505, y, y + 0.08, dark);
    // (the owner: "the bottom wall on the highwall ends abruptly, you could add a big tower to it")
    if (look.ends === true || look.ends === (s < 0 ? 'west' : 'east')) {
      const wide = 2.3;
      const high = 6.1;
      const e0 = s < 0 ? w0 - wide : w1;
      const e1 = e0 + wide;
      b.box(e0 - 0.14, -1.29, e1 + 0.14, 1.29, 0, 0.6, dark, mul(dark, 0.8), stone);
      b.box(e0, -1.15, e1, 1.15, 0.6, high, stone, dark, roof);
      b.box(e0 - 0.18, -1.33, e1 + 0.18, 1.33, high, high + 0.38, hi, stone, roof);
      b.merlons(e0 - 0.18, 1.33, e1 + 0.18, 1.33, high + 0.38, 0.4, 0.22, stone, dark, hi);
      b.merlons(e0 - 0.18, -1.33, e1 + 0.18, -1.33, high + 0.38, 0.4, 0.22, stone, dark, hi);
      for (const y of [1.6, 3.1, 4.6]) b.faceS(e0, e1, 1.155, y, y + 0.1, dark);
      const lit = b.m.nor.length;
      for (const y of [2.2, 3.9]) b.faceS((e0 + e1) / 2 - 0.1, (e0 + e1) / 2 + 0.1, 1.16, y, y + 0.7, cloth, mul(cloth, 1.2));
      alight(b, lit);
    }
  }
  // the arch: the wall over the road, stepped in under itself at each side, a keystone at its crown
  b.box(-half, -0.7, half, 0.7, 3.5, 4.5, stone, dark, mul(stone, 0.55));
  b.merlons(-half, 0.7, half, 0.7, 4.5, 0.3, 0.2, stone, dark, hi);
  for (const s of [-1, 1] as const) {
    b.box(s < 0 ? -half : half - 0.5, -0.7, s < 0 ? -half + 0.5 : half, 0.7, 2.9, 3.5, stone, dark, stone);
    b.box(s < 0 ? -half : half - 0.22, -0.7, s < 0 ? -half + 0.22 : half, 0.7, 2.3, 2.9, stone, dark, stone);
  }
  // (a keystone a little proud of the arch, of its own stone: not a pale post standing up out of it)
  // (and a little higher than it: its top lay in the plane of the arch's top, a darker patch that came and went
  // over the gate as the camera moved. The owner: "some of the gates' textures, the ones top, keep jittering")
  b.box(-0.34, -0.76, 0.34, 0.76, 3.5, 4.53, mul(stone, 1.1), stone, mul(stone, 0.6));
  b.faceS(-0.34, 0.34, 0.765, 3.5, 3.58, trim);
  // (a way down: the dark behind the arch, going back into it)
  if (look.shut) {
    const black: C = [0.02, 0.016, 0.026];
    b.faceS(-half, half, -0.5, 0, 3.5, black, mul(stone, 0.16));
    b.flat(-half, -0.5, half, 0.7, 0.02, mul(stone, 0.2));
  }
  const portal = look.shut ? undefined : veil(look.light, half, 3.5);
  // the portcullis drawn up: its teeth showing under the arch
  const iron: C = [0.16, 0.15, 0.18];
  for (let x = -half + 0.7; x <= half - 0.7; x += 0.42) b.post(x, 0, 0.05, 0.0, 3.5, 3.05, 4, iron, iron);
  // a great lamp of the next land's light hung in the crown of the arch
  const from = b.m.nor.length;
  b.box(-0.16, 0.77, 0.16, 0.8, 3.78, 4.14, cloth, cloth, cloth);
  alight(b, from);
  glows.push({ x: 0, z: 0.9, y: 3.9, color: look.light, size: 26 });
  return { b, flames, glows, portal };
}

/**
 * A wood's gate: two trunks as thick as a cottage, cut and stood either side of the road, a third laid across them,
 * lanterns of the next land's light hung from it, and a palisade of pointed logs going off into the trees each way.
 */
export function timberGate(look: GateLook): GateBuilt {
  const b = new Build();
  const bark = rgb(look.body);
  const dark = mul(bark, 0.6);
  const cut = rgb(look.trim);
  const lamp = rgb(look.light);
  const half = look.span / 2 + 0.7;
  const flames: GateBuilt['flames'] = [];
  const glows: GateBuilt['glows'] = [];
  const tall = 5.0;
  for (const s of [-1, 1] as const) {
    const x = s * (half + 0.55);
    // roots spread at its foot, the trunk, its cut top
    b.post(x, 0, 1.0, 0.66, 0, 0.6, 9, mul(dark, 0.8), dark);
    b.post(x, 0, 0.66, 0.56, 0.6, tall, 9, dark, bark, s * -0.12, 0);
    b.post(x - s * 0.12, 0, 0.56, 0.5, tall, tall + 0.1, 9, mul(cut, 0.7), mul(cut, 0.62));
    // bands of rope
    for (const y of [1.6, 3.3]) b.post(x - s * 0.05, 0, 0.66, 0.64, y, y + 0.16, 9, mul(cut, 0.7), cut);
    // the palisade going off from it: pointed logs, each its own height
    for (let i = 0; i < 12; i++) {
      const px = x + s * (1.1 + i * 0.62);
      const h = 2.3 + ((i * 7 + look.seed) % 5) * 0.14;
      b.post(px, 0.05 * ((i % 3) - 1), 0.3, 0.27, 0, h, 6, dark, bark);
      b.post(px, 0.05 * ((i % 3) - 1), 0.27, 0.0, h, h + 0.5, 6, bark, cut);
    }
    b.box(s < 0 ? x - 8.4 : x + 0.6, 0.26, s < 0 ? x - 0.6 : x + 8.4, 0.36, 1.4, 1.62, dark, dark, bark);
  }
  // the beam across: a whole trunk, and a carved board hung under it
  b.box(-half - 1.5, -0.42, half + 1.5, 0.42, tall - 0.95, tall - 0.2, bark, dark, mul(bark, 1.12));
  b.box(-half - 1.3, -0.3, half + 1.3, 0.3, tall - 0.2, tall + 0.06, mul(bark, 0.9), dark, mul(bark, 0.7));
  b.box(-1.0, 0.43, 1.0, 0.5, tall - 1.5, tall - 1.0, mul(cut, 0.8), dark, cut);
  const portal = veil(look.light, half + 0.1, tall - 0.95);
  // lanterns hung along it
  const n = Math.max(2, Math.round(look.span / 1.4));
  for (let i = 0; i < n; i++) {
    const x = -half + 0.7 + (i / (n - 1)) * (half * 2 - 1.4);
    b.post(x, 0.3, 0.015, 0.015, tall - 1.55, tall - 0.95, 3, dark, dark);
    const from = b.m.nor.length;
    b.box(x - 0.14, 0.16, x + 0.14, 0.44, tall - 1.95, tall - 1.55, lamp, lamp, mul(lamp, 1.2));
    alight(b, from);
    glows.push({ x, z: 0.5, y: tall - 1.75, color: look.light, size: 13 });
  }
  return { b, flames, glows, portal };
}
