/**
 * The way through a land's gate (render3d/portal.ts), after the owner's notes of 2026-11-13: "the gate's glows
 * sometimes flicker as well, please do fix and make it dynamic, maybe with shaders, make it look more intense and
 * cartoony", and then, of a first try that threw banded light down the road: "i want to do something like [a] portal
 * gate, just through the whole 'hole' of our gate, without illuminating anything on the floor".
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { stoneGate, timberGate } from '../src/games/sigilfall/render3d/gateways';
import { PORTAL_FRAG, portalMesh } from '../src/games/sigilfall/render3d/portal';
import { LIGHT } from '../src/games/sigilfall/render3d/toon';

const stone = (o: Partial<Parameters<typeof stoneGate>[0]> = {}) => stoneGate({ span: 5, body: '#a69e94', trim: '#d8c8a0', light: '#7fe08a', seed: 3, ...o });
const timber = () => timberGate({ span: 5, body: '#6a4a30', trim: '#c8a878', light: '#7fe08a', seed: 3 });

describe('the way through a gate', () => {
  it('a gate says where its opening is: post to post, road to arch, in the next land’s light', () => {
    for (const g of [stone(), timber()]) {
      const p = g.portal!;
      expect(p).toBeTruthy();
      expect(p.color).toBe('#7fe08a');
      // (as wide as the way: the road and a tile each side of it, more or less)
      expect(p.half * 2).toBeGreaterThan(4);
      expect(p.half * 2).toBeLessThan(8);
      expect(p.high).toBeGreaterThan(2.5);
      // (just past the middle of the gate, so whoever goes through walks into it)
      expect(p.z).toBeLessThan(0);
      expect(p.z).toBeGreaterThan(-1);
    }
    // (a way down has dark under its arch, and no way through)
    expect(stone({ shut: true }).portal).toBeUndefined();
  });

  it('the gate builds no light of its own any more: nothing self-lit lies on the road, and nothing hangs in the air before the arch', () => {
    for (const g of [stone(), timber()]) {
      const { pos, nor } = g.b.m;
      // (self-lit parts have no normal: build.ts. None of them is a flat thing at the ground)
      let low = 0;
      for (let i = 0; i < nor.length; i += 9) {
        const lit = nor.slice(i, i + 9).every((n) => n === 0);
        if (!lit) continue;
        if (Math.max(pos[i + 1]!, pos[i + 4]!, pos[i + 7]!) < 0.2) low++;
      }
      expect(low).toBe(0);
      // (what glows on it now is its lamps, up under the beam or the arch, and no great haze before it)
      for (const o of g.glows) {
        expect(o.y).toBeGreaterThan(1.5);
        expect(o.size).toBeLessThan(30);
      }
    }
  });

  it('it is a real surface filling that opening: standing on the ground, solid to the eye, seen from both sides', () => {
    const m = portalMesh(2.6, 3.5, '#7fe08a', 0.37);
    m.geometry.computeBoundingBox();
    const box = m.geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(-2.6);
    expect(box.max.x).toBeCloseTo(2.6);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(3.5);
    const mat = m.material as THREE.ShaderMaterial;
    expect(mat.transparent).toBe(false);
    expect(mat.depthWrite).toBe(true);
    expect(mat.side).toBe(THREE.DoubleSide);
    // (the next land's color as the game writes colors, and its own size, so the edge is as thick on any gate)
    expect((mat.uniforms.uColor!.value as THREE.Vector3).toArray().map((v) => Math.round(v * 255))).toEqual([0x7f, 0xe0, 0x8a]);
    expect((mat.uniforms.uSize!.value as THREE.Vector2).toArray()).toEqual([5.2, 3.5]);
  });

  it('it moves with the game’s own clock, in flat tones, and is never see-through', () => {
    const mat = portalMesh(2, 3, '#7fe08a').material as THREE.ShaderMaterial;
    expect(mat.uniforms.uTime).toBe(LIGHT.uTime);
    expect(PORTAL_FRAG).toMatch(/uTime/);
    // (bands, not gradients: every tone is laid on with a step)
    expect((PORTAL_FRAG.match(/mix\(col, \w+(\([^)]*\))?, step\(/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(PORTAL_FRAG).toMatch(/gl_FragColor = vec4\(col, 1\.0\);/);
  });

  it('the land stands one in each of its gates, and lights nothing on the ground for them', () => {
    const land = readFileSync('src/games/sigilfall/render3d/land.ts', 'utf8');
    expect(land).toMatch(/if \(g\.portal\) \{\s+const way = portalMesh\(/);
    expect(land).toMatch(/for \(const p of this\.portals\) \{\s+p\.geometry\.dispose\(\);\s+\(p\.material as THREE\.Material\)\.dispose\(\);/);
    const fx = readFileSync('src/games/sigilfall/render/effects.ts', 'utf8');
    const at = fx.indexOf('private wayLights');
    const body = fx.slice(at, fx.indexOf('\n  }\n', at));
    const edge = body.slice(body.indexOf('if (least < TILE * 8) {'), body.indexOf('} else {', body.indexOf('if (least < TILE * 8) {')));
    expect(edge).not.toMatch(/fx\.put|spill\(/);
    expect(edge).toMatch(/continue;/);
  });
});
