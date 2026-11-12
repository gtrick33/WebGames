import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { inView, PITCH, viewBox } from '../src/games/sigilfall/render3d/land';
import { FIGHT_SPEED, MOUNT_SPEED, RIDE_SPEED, WALK_SPEED } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/** The camera as render3d/stage.ts sets it: a 28 degree lens looking down at 50 degrees at a spot on the ground. */
const FOV = 28;
function corners(aspect: number, tilesTall: number): { spanX: number; spanZ: number; pts: { x: number; z: number }[] } {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 1, 1000);
  // (the distance at which the picture's middle is `tilesTall` tiles from top to bottom)
  const dist = tilesTall / (2 * Math.tan((FOV * Math.PI) / 360));
  cam.position.set(0, dist * Math.sin(PITCH), dist * Math.cos(PITCH));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  const pts = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1]].map(([nx, ny]) => {
    const far = new THREE.Vector3(nx!, ny!, 0.5).unproject(cam);
    const dir = far.sub(cam.position).normalize();
    const t = -cam.position.y / dir.y;
    return { x: cam.position.x + dir.x * t, z: cam.position.z + dir.z * t };
  });
  return { spanX: (tilesTall * aspect) / 2, spanZ: tilesTall / Math.sin(PITCH) / 2, pts };
}

describe('Sigilfall: the land is standing wherever the picture can see', () => {
  // a phone on its side, a desk screen, a very wide one; near and far cameras
  for (const [aspect, tall] of [[844 / 390, 13.5], [16 / 9, 18.75], [21 / 9, 18.75], [4 / 3, 18.75]] as const) {
    it(`to every corner of the picture, with room to spare (${aspect.toFixed(2)} wide, ${tall} tiles tall)`, () => {
      const { spanX, spanZ, pts } = corners(aspect, tall);
      for (const p of pts) {
        expect(inView(0, 0, spanX, spanZ, p.x, p.z), `corner ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`).toBe(true);
        // and four tiles further out from the middle: the land is looked over only every two tiles walked, and a
        // tree's crown is wider than its trunk
        const l = Math.hypot(p.x, p.z);
        expect(inView(0, 0, spanX, spanZ, p.x + (p.x / l) * 4, p.z + (p.z / l) * 4), `past corner ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`).toBe(true);
      }
      const box = viewBox(0, 0, spanX, spanZ);
      for (const p of pts) {
        expect(p.x).toBeGreaterThan(box.x0 + 4);
        expect(p.x).toBeLessThan(box.x1 - 4);
        expect(p.z).toBeGreaterThan(box.z0 + 4);
        expect(p.z).toBeLessThan(box.z1 - 4);
      }
    });
  }

  it('the old rectangle (three tiles round the middle of the picture) fell short at the top corners of a wide screen', () => {
    const { spanX, pts } = corners(16 / 9, 18.75);
    const topCorner = pts[3]!;
    expect(Math.abs(topCorner.x)).toBeGreaterThan(spanX + 3);
  });

  it('is not the whole land: ground well outside the picture is left down', () => {
    const { spanX, spanZ } = corners(16 / 9, 18.75);
    expect(inView(0, 0, spanX, spanZ, spanX * 2, 0)).toBe(false);
    expect(inView(0, 0, spanX, spanZ, 0, -spanZ * 2.2)).toBe(false);
    expect(inView(0, 0, spanX, spanZ, 0, spanZ * 1.8)).toBe(false);
  });
});

describe('Sigilfall: on foot and mounted', () => {
  it('walking the land is a little slower than it was, riding exactly as fast', () => {
    expect(WALK_SPEED).toBeLessThan(78);
    expect(WALK_SPEED).toBeGreaterThanOrEqual(78 * 0.88);
    expect(RIDE_SPEED).toBeCloseTo(78 * 1.3);
    expect(WALK_SPEED * MOUNT_SPEED).toBeCloseTo(78 * 1.3);
  });

  it('in a fight a hero is as quick as ever (the fights were set against it), and eases down after', () => {
    expect(FIGHT_SPEED).toBe(78);
    const w = newWorld('whisperwood', readyHero('warrior', 5));
    w.player.calm = 99;
    expect(w.footPace()).toBeCloseTo(WALK_SPEED);
    // a blow given or taken
    w.player.calm = 0;
    expect(w.footPace()).toBeCloseTo(FIGHT_SPEED);
    w.player.calm = 3;
    expect(w.footPace()).toBeCloseTo(FIGHT_SPEED);
    w.player.calm = 3.75;
    expect(w.footPace()).toBeGreaterThan(WALK_SPEED);
    expect(w.footPace()).toBeLessThan(FIGHT_SPEED);
    w.player.calm = 5;
    expect(w.footPace()).toBeCloseTo(WALK_SPEED);
  });
});
