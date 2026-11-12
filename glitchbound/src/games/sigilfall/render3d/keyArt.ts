import { PRODUCTS } from '../../../catalog/shop';
import { CLASSES } from '../data/classes';
import { MOUNT_DEFS } from '../data/mounts';
import type { ClassId } from '../data/types';
import { wardenLookId } from '../data/wardens';
import { shopLookOf } from '../progress/shopGoods';
import { lookOf } from '../progress/wardrobe';
import { heldWeapon, heroLook } from '../render/sprites';
import { TILE } from '../sim/map';
import { Motion } from './cast';
import { Hall3D } from './hall';

/**
 * Sigilfall's key art: every picture of the game the site shows (the home page's banner, the game's cards, the picture
 * a shared link carries) is one scene, rendered from the game's own hall by `scripts/sigilfall-key-art.mjs` through
 * the dev server. All eight heroes in their Warden armor before the rose window, between two drakes: the Gloamknight
 * on the dais in the middle in his Duskborn plate, the warrior at his shoulder.
 *
 * (Until 2026-11-12 the pictures were made by hand, with the seven free heroes and the Gloamknight in a medallion of
 * his own in a corner. The owner asked for him among the others, and for no separate mark on the banner.)
 *
 * Only the dev server loads this file: nothing of it ships.
 */

type V3 = readonly [number, number, number];
export interface KeyArtShot {
  w: number;
  h: number;
  at: V3;
  look: V3;
  fov: number;
}

/** The pictures: where the camera stands for each shape. */
export const KEY_ART_SHOTS: Record<string, KeyArtShot> = {
  // the home page's banner on a wide screen: the group on the right two thirds, the words on the left
  wide: { w: 2400, h: 990, at: [-2.75, 2.2, 14.2], look: [-2.75, 1.9, 0], fov: 26 },
  // the banner on a phone, and the card pictures: everyone, close
  tall: { w: 2000, h: 1600, at: [-0.5, 2.4, 17.6], look: [-0.5, 2.15, 0], fov: 26 },
};

interface Stand {
  cls: ClassId;
  x: number;
  z: number;
  turn: number;
  h: number;
  lift?: number;
  clip: string;
  t: number;
  body?: 'm' | 'f';
}

/** Left to right. The dais is at the middle; those beside it stand a step back, and the far ones a step forward again. */
const LINE: Stand[] = [
  { cls: 'ranger', x: -4.25, z: 1.8, turn: 0.4, h: 2.12, clip: 'idle2', t: 0.4 },
  { cls: 'paladin', x: -3.15, z: 1.0, turn: 0.3, h: 2.16, clip: 'idle', t: 1.1 },
  { cls: 'priest', x: -2.3, z: 0.3, turn: 0.2, h: 2.1, clip: 'idle2', t: 0.9 },
  { cls: 'warrior', x: -1.5, z: -0.25, turn: 0.12, h: 2.3, clip: 'idle', t: 0.2 },
  { cls: 'gloamknight', x: 0, z: 0.1, turn: 0, h: 2.5, lift: 0.3, clip: 'idle', t: 0.6 },
  { cls: 'druid', x: 1.4, z: -0.5, turn: -0.14, h: 2.06, clip: 'idle2', t: 1.4 },
  { cls: 'mage', x: 2.4, z: 0.3, turn: -0.24, h: 2.14, clip: 'idle', t: 0.8, body: 'f' },
  { cls: 'warlock', x: 3.5, z: 1.1, turn: -0.36, h: 2.14, clip: 'idle2', t: 0.1 },
];

/** The two drakes at the window: the Emberbound on the left, the Rimewing on the right, heads toward each other. */
const DRAKES = [
  { id: 'drake-paladin', x: -3.3, z: -3.6, turn: 1.0, scale: 2.1, t: 0.3 },
  { id: 'drake-mage', x: 3.3, z: -3.6, turn: -1.0, scale: 2.1, t: 0.9 },
];

function lookFor(cls: ClassId, body: 'm' | 'f') {
  // the Gloamknight wears what comes with him; the others what the story's end gives them
  if (cls === 'gloamknight') {
    const piece = (id: string) => {
      const p = PRODUCTS.find((x) => x.id === id);
      return p?.sigil && p.sigil.kind === 'look' ? shopLookOf(p.id, p.name, p.sigil) : undefined;
    };
    return heroLook(cls, {}, { head: piece('sigilfall-duskborn-helm'), chest: piece('sigilfall-duskborn-plate') }, body);
  }
  return heroLook(cls, {}, { head: lookOf(wardenLookId(cls, 'head')) ?? undefined, chest: lookOf(wardenLookId(cls, 'chest')) ?? undefined }, body);
}

/** Renders one shot and gives it back as a PNG. Waits for every model the scene needs. */
export async function keyArt(shot: KeyArtShot, time = 3.2): Promise<string> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${shot.w}px;height:${shot.h}px;overflow:hidden`;
  const overlay = document.createElement('canvas');
  host.appendChild(overlay);
  document.body.appendChild(host);
  const hall = new Hall3D(overlay);
  hall.fit(shot.w, shot.h, 1);
  const st = hall.stage;
  const who = LINE.map((s) => ({ s, look: lookFor(s.cls, s.body ?? 'm'), held: heldWeapon(s.cls, undefined), shield: s.cls === 'warrior' || s.cls === 'paladin', m: Object.assign(new Motion(), { clip: s.clip, t: s.t }) }));
  const drakes = DRAKES.map((d) => ({ d, def: MOUNT_DEFS[d.id]!, m: Object.assign(new Motion(), { clip: 'idle', t: d.t }) }));
  const place = (): void => {
    for (const { d, def, m } of drakes) st.cast.mount(def, d.x * TILE, d.z * TILE, d.turn, m, { scale: d.scale });
    for (const { s, look, held, shield, m } of who) {
      st.cast.shadow(s.x * TILE, s.z * TILE, s.cls === 'gloamknight' ? 11 : 9);
      st.cast.person(look, held, shield, s.x * TILE, s.z * TILE, s.turn, m, { h: s.h * TILE, lift: s.lift ?? 0 });
    }
  };
  const cam = { at: shot.at, look: shot.look, fov: shot.fov };
  const frame = (): Promise<void> => new Promise((ok) => requestAnimationFrame(() => ok()));
  // the models come in over the first frames: draw until the picture has stopped changing, and then a few more
  // (nobody is shown through a wall here: the dotted shape the game draws of someone behind a pillar has no place in a picture)
  const plain = (): void => {
    for (const scene of [st.scene, st.groundScene]) scene.traverse((o) => void ((o as { isInstancedMesh?: boolean }).isInstancedMesh && o.renderOrder === 1 && (o.visible = false)));
  };
  for (let i = 0; i < 240; i++) {
    plain();
    hall.poster(cam, CLASSES.gloamknight.colors.main, place, time);
    await frame();
    if (i > 90 && st.ready) break;
  }
  plain();
  hall.poster(cam, CLASSES.gloamknight.colors.main, place, time);
  // one flat picture of the stage's layers, in the order the page stacks them
  const out = document.createElement('canvas');
  out.width = shot.w;
  out.height = shot.h;
  const g = out.getContext('2d')!;
  for (const layer of [...host.querySelectorAll('canvas')]) g.drawImage(layer, 0, 0, shot.w, shot.h);
  const url = out.toDataURL('image/png');
  hall.dispose();
  host.remove();
  return url;
}
