/**
 * The ground kept as a picture (render3d/groundBake.ts). Working the ground's patterns out for every point of the
 * screen in every frame was most of what warmed a phone: it is painted once now, square by square as the camera
 * comes to it. What is held to here is that it really is once: standing still paints nothing more, a step paints
 * only the squares newly in view, and the picture is begun again only when the view stops suiting it.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GroundBake } from '../src/games/sigilfall/render3d/groundBake';
import { PITCH } from '../src/games/sigilfall/render3d/land';

/** Stands in for the graphics card: counts what it is asked to draw, and draws nothing. */
function fakeGl(w = 1434, h = 663): { gl: THREE.WebGLRenderer; renders: number; lost: boolean } {
  const own = {
    renders: 0,
    lost: false,
    gl: null as unknown as THREE.WebGLRenderer,
  };
  let target: unknown = null;
  own.gl = {
    autoClear: true,
    capabilities: { maxTextureSize: 4096 },
    getContext: () => ({ isContextLost: () => own.lost }),
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(w, h),
    getRenderTarget: () => target,
    setRenderTarget: (t: unknown) => {
      target = t;
    },
    render: () => {
      own.renders++;
    },
  } as unknown as THREE.WebGLRenderer;
  return own;
}

/** The game's camera: looking down at PITCH from the south, at a spot on the ground (tiles), from `dist` away. */
function cameraAt(cx: number, cz: number, dist = 24, aspect = 1434 / 663): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(28, aspect, 1, 400);
  cam.position.set(cx, dist * Math.sin(PITCH), cz + dist * Math.cos(PITCH));
  cam.lookAt(cx, 0, cz);
  cam.updateMatrixWorld(true);
  return cam;
}

function ground(): { bake: GroundBake; mesh: THREE.Mesh; whole: THREE.ShaderMaterial; frame: THREE.ShaderMaterial } {
  const whole = new THREE.ShaderMaterial();
  const frame = new THREE.ShaderMaterial({ uniforms: { uBake: { value: null }, uBakeScale: { value: new THREE.Vector2(1, 1) } } });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), whole);
  return { bake: new GroundBake(mesh, whole, 'void main() {}', frame), mesh, whole, frame };
}

describe('the ground, kept as a picture', () => {
  it('is drawn worked out whole until it has been painted, and read from the picture after', () => {
    const { bake, mesh, whole, frame } = ground();
    expect(mesh.material).toBe(whole);
    const g = fakeGl();
    bake.update(g.gl, cameraAt(40, 40));
    expect(mesh.material).toBe(frame);
    expect(bake.kept).toBe(true);
    expect(frame.uniforms.uBake!.value).toBeTruthy();
    expect(bake.painted).toBeGreaterThan(20);
    expect(g.renders).toBe(1);
  });

  it('paints nothing more while the camera stands still', () => {
    const { bake } = ground();
    const g = fakeGl();
    const cam = cameraAt(40, 40);
    bake.update(g.gl, cam);
    const first = bake.painted;
    for (let i = 0; i < 300; i++) bake.update(g.gl, cam);
    expect(bake.painted).toBe(first);
    expect(g.renders).toBe(1);
    expect(bake.begun).toBe(1);
  });

  it('paints only what a walk brings into view: a long walk costs a few screens of ground, not one a frame', () => {
    const { bake } = ground();
    const g = fakeGl();
    bake.update(g.gl, cameraAt(40, 40));
    const screen = bake.painted;
    // a step too small to bring a new square in
    bake.update(g.gl, cameraAt(40.01, 40));
    expect(bake.painted).toBe(screen);
    // forty tiles east at a hero's pace, sixty frames a second (5 tiles a second: 480 frames)
    for (let i = 1; i <= 480; i++) bake.update(g.gl, cameraAt(40 + (i * 40) / 480, 40));
    expect(bake.begun).toBe(1);
    // (drawn whole, those frames were 480 screens of ground)
    expect(bake.painted - screen).toBeLessThan(screen * 3);
    expect(bake.painted - screen).toBeGreaterThan(0);
    // and back again over ground the picture has let go of: painted again, no more than that
    const there = bake.painted;
    for (let i = 1; i <= 480; i++) bake.update(g.gl, cameraAt(80 - (i * 40) / 480, 40));
    expect(bake.painted - there).toBeLessThan(screen * 3);
    expect(bake.begun).toBe(1);
  });

  it('keeps its picture through a scene’s close-up, and begins a finer one only for a much nearer view', () => {
    const { bake } = ground();
    const g = fakeGl();
    bake.update(g.gl, cameraAt(40, 40, 24));
    // (sim/scene.ts: a talk draws in to 0.84 of the distance, a close shot to 0.7)
    bake.update(g.gl, cameraAt(40, 40, 24 * 0.84));
    bake.update(g.gl, cameraAt(40, 40, 24 * 0.7));
    expect(bake.begun).toBe(1);
    expect(bake.kept).toBe(true);
    bake.update(g.gl, cameraAt(40, 40, 24 * 0.4));
    expect(bake.begun).toBe(2);
    expect(bake.kept).toBe(true);
  });

  it('begins a wider one when the camera steps back past what it holds', () => {
    const { bake } = ground();
    const g = fakeGl();
    bake.update(g.gl, cameraAt(40, 40, 24));
    bake.update(g.gl, cameraAt(40, 40, 24 * 1.5));
    expect(bake.begun).toBe(2);
    expect(bake.kept).toBe(true);
  });

  it('comes to suit a view it was not painted for, once that view has held', () => {
    const { bake } = ground();
    const g = fakeGl();
    bake.update(g.gl, cameraAt(40, 40, 24));
    // (a close shot: served by the picture there is, a little softer than it would paint one for it)
    for (let i = 0; i < 60; i++) bake.update(g.gl, cameraAt(40, 40, 24 * 0.7));
    expect(bake.begun).toBe(1);
    for (let i = 0; i < 120; i++) bake.update(g.gl, cameraAt(40, 40, 24 * 0.7));
    expect(bake.begun).toBe(2);
  });

  it('draws the ground whole where no picture of it can be kept', () => {
    const { bake, mesh, whole } = ground();
    const g = fakeGl();
    // a camera level with the ground: the top of the view never meets it
    const level = new THREE.PerspectiveCamera(28, 2, 1, 400);
    level.position.set(40, 2, 60);
    level.lookAt(40, 2, 0);
    level.updateMatrixWorld(true);
    bake.update(g.gl, level);
    expect(mesh.material).toBe(whole);
    expect(g.renders).toBe(0);
    // the drawing context taken back by the browser
    bake.update(g.gl, cameraAt(40, 40));
    expect(bake.kept).toBe(true);
    g.lost = true;
    bake.update(g.gl, cameraAt(40, 40));
    expect(mesh.material).toBe(whole);
  });

  it('is never larger than the graphics card takes, however large the screen', () => {
    const { bake, frame } = ground();
    const g = fakeGl(3840, 2160);
    bake.update(g.gl, cameraAt(40, 40, 24, 3840 / 2160));
    const tex = frame.uniforms.uBake!.value as THREE.Texture | null;
    if (bake.kept) {
      const img = tex!.image as { width: number; height: number };
      expect(img.width).toBeLessThanOrEqual(4096);
      expect(img.height).toBeLessThanOrEqual(4096);
    }
    // (and if a picture fine enough can't be kept in that, the ground is drawn whole: never a blurred one)
    expect(bake.kept || bake.begun === 0).toBe(true);
  });
});
