import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { inView, keptBySpot, PITCH, shownBox, viewBox } from '../src/games/sigilfall/render3d/land';
import { FIGHT_SPEED, MOUNT_SPEED, RIDE_SPEED, WALK_SPEED } from '../src/games/sigilfall/sim/world';
import { DEFAULT_SETTINGS, validateSettings, ZOOM_MAX, ZOOM_MIN } from '../src/games/sigilfall/progress/save';
import { viewBox as box } from '../src/games/sigilfall/render3d/land';
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

describe('Sigilfall: the camera\'s distance is the player\'s to set', () => {
  it('is a setting: the game\'s own view unless changed, kept within what the land can be drawn for', () => {
    expect(DEFAULT_SETTINGS.zoom).toBe(1);
    expect(ZOOM_MIN).toBeLessThan(1);
    expect(ZOOM_MAX).toBeGreaterThan(1);
    expect(ZOOM_MAX).toBeLessThanOrEqual(1.5);
    expect(validateSettings({ zoom: 9 }).zoom).toBe(ZOOM_MAX);
    expect(validateSettings({ zoom: 0.1 }).zoom).toBe(ZOOM_MIN);
    expect(validateSettings({ zoom: 1.15 }).zoom).toBeCloseTo(1.15);
    // a save from before the setting
    expect(validateSettings({}).zoom).toBe(1);
  });

  it('what the land keeps standing grows with it: the further out, the more ground', () => {
    const near = box(0, 0, 16.7 * ZOOM_MIN, 12.2 * ZOOM_MIN);
    const own = box(0, 0, 16.7, 12.2);
    const far = box(0, 0, 16.7 * ZOOM_MAX, 12.2 * ZOOM_MAX);
    const area = (b: { x0: number; x1: number; z0: number; z1: number }): number => (b.x1 - b.x0) * (b.z1 - b.z0);
    expect(area(near)).toBeLessThan(area(own));
    expect(area(far)).toBeGreaterThan(area(own) * 1.3);
  });

  it('the camera, the settings page and the land all take it up', () => {
    const read = (f: string): string => readFileSync(`src/games/sigilfall/${f}`, 'utf8');
    expect(read('engine.ts')).toContain('this.renderer.setZoom(s.zoom)');
    expect(read('render/renderer.ts')).toContain('* this.zoom)');
    expect(read('ui/Panels.tsx')).toContain("slider('Camera distance', 'zoom', ZOOM_MIN, ZOOM_MAX");
    // (the land looks again when the picture's reach changes, not only when the hero has walked)
    expect(read('render3d/land.ts')).toContain('span === this.span');
  });

  // the Ember Keep: the castle model raised 2.1 times over its lot, its spot nine tiles behind its gate (the owner:
  // "currently in emberwick, the gate keeps disappearing and reappearing")
  const KEEP = { min: [-4, 0, -4.5] as [number, number, number], max: [4, 6, 4.5] as [number, number, number] };
  const keep = { x: 52.5, z: 8.6, y: 0, rot: 0, sx: 2.1, sy: 2.1, sz: 2.1 };

  it('a model that shows far from its own spot is kept by its whole box: the Ember Keep’s gate never blinks out', () => {
    const b = shownBox(KEEP, keep);
    expect(b.z1).toBeCloseTo(8.6 + 4.5 * 2.1);
    // (its towers' worth of height leans up the picture, past its back wall)
    expect(b.z0).toBeLessThan(8.6 - 4.5 * 2.1 - 6 * 2.1 * 0.8);
    expect(keptBySpot(b, keep.x, keep.z)).toBe(false);
    // walking the forecourt south: wherever the gate is in the picture, the keep is kept
    const { spanX, spanZ } = corners(844 / 390, 13.5);
    for (let camZ = 20; camZ < 40; camZ += 0.5) {
      const v = viewBox(keep.x, camZ, spanX, spanZ);
      const gateShows = b.z1 > v.z0;
      const keptByBox = !(b.x1 < v.x0 || b.x0 > v.x1 || b.z1 < v.z0 || b.z0 > v.z1);
      if (gateShows) expect(keptByBox, `camera at ${camZ}`).toBe(true);
    }
    // (kept by its spot, it went from the picture with its gate still in it)
    const v = viewBox(keep.x, 30, spanX, spanZ);
    expect(b.z1).toBeGreaterThan(v.z0);
    expect(keep.z).toBeLessThan(v.z0);
  });

  it('small things are still kept by their spot: a crate, a lamp post, a tree', () => {
    const crate = { min: [-0.4, 0, -0.4] as [number, number, number], max: [0.4, 0.8, 0.4] as [number, number, number] };
    expect(keptBySpot(shownBox(crate, { x: 10, z: 10, y: 0, rot: 0.3, sx: 1, sy: 1, sz: 1 }), 10, 10)).toBe(true);
    const tree = { min: [-0.5, 0, -0.5] as [number, number, number], max: [0.5, 1, 0.5] as [number, number, number] };
    expect(keptBySpot(shownBox(tree, { x: 10, z: 10, y: 0, rot: 0, sx: 2, sy: 4, sz: 2 }), 10, 10)).toBe(true);
  });

  it('every model the land places goes through that test, buildings and arches with it', () => {
    const src = readFileSync('src/games/sigilfall/render3d/land.ts', 'utf8');
    const add = src.slice(src.indexOf('  private add('), src.indexOf('  /** Sized to'));
    expect(add).toContain('keptBySpot(box, placedNow.x, placedNow.z)');
    expect(add).toContain('this.giants.push');
  });
});
