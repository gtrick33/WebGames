import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hudScale } from '../src/games/sigilfall/render/camera';
import { busyElsewhere, heldElsewhere, PACE_SLOW, Pacer, QUALITY_FLOOR, QUIET_MS } from '../src/games/sigilfall/render3d/pace';

describe('Sigilfall: the HUD grows with the screen', () => {
  it('is its own size up to a laptop, and bigger on a bigger monitor', () => {
    expect(hudScale(1366, 768, false)).toBe(1);
    expect(hudScale(1100, 620, false)).toBe(1);
    expect(hudScale(1920, 1080, false)).toBeCloseTo(1.4);
    expect(hudScale(2560, 1440, false)).toBeCloseTo(1.85);
    expect(hudScale(3840, 2160, false)).toBe(2.25);
    // by the side that has grown less: a very wide window is no taller
    expect(hudScale(3440, 768, false)).toBe(1);
  });

  it('a touch screen keeps its own: its HUD is sized for thumbs', () => {
    expect(hudScale(2732, 2048, true)).toBe(1);
  });

  it('the stage hands it to the HUD and to what is written over the picture', () => {
    const game = readFileSync('src/games/sigilfall/Game.tsx', 'utf8');
    expect(game).toContain("stage.style.setProperty('--hud', String(hud));");
    expect(game).toContain('e.renderer.hud = hud;');
    const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
    for (const piece of ['.rb-hud-hero', '.rb-hud-menu', '.rb-minimap-hud', '.rb-tracker', '.rb-bossbar', '.rb-deskbar']) expect(css, piece).toContain(`.rb-ui.is-mouse > ${piece},`);
    expect(css).toContain('zoom: var(--hud, 1);');
  });
});

describe('Sigilfall: the picture keeps to a smooth pace', () => {
  it('draws fewer pixels as soon as it falls under about fifty frames a second, down to under half', () => {
    expect(PACE_SLOW).toBeLessThanOrEqual(1 / 48);
    expect(PACE_SLOW).toBeGreaterThan(1 / 60);
    expect(QUALITY_FLOOR).toBeLessThanOrEqual(0.5);
    expect(QUALITY_FLOOR).toBeGreaterThanOrEqual(0.4);
  });

  const run = (p: Pacer, frames: number, dt: (q: number) => number): void => {
    for (let i = 0; i < frames; i++) p.tick(dt(p.quality));
  };

  it('a machine slowed by how much it draws steps down until it keeps up', () => {
    const p = new Pacer();
    // (a big monitor on a modest card: the frame's time goes with the pixels)
    run(p, 2000, (q) => (1 / 40) * q * q);
    expect(p.quality).toBeLessThan(1);
    expect(p.quality).toBeGreaterThanOrEqual(QUALITY_FLOOR);
    run(p, 300, (q) => (1 / 40) * q * q);
    const held = p.quality;
    run(p, 300, (q) => (1 / 40) * q * q);
    expect(p.quality).toBe(held);
  });

  it('a phone held at thirty frames a second (Low Power Mode) keeps its full picture', () => {
    const p = new Pacer();
    let lowest = 1;
    for (let i = 0; i < 3000; i++) {
      p.tick(1 / 30);
      lowest = Math.min(lowest, p.quality);
    }
    // one step is tried, seen not to help and taken back
    expect(lowest).toBeCloseTo(0.85);
    expect(p.quality).toBe(1);
  });

  it('a cap that later gets much worse is stepped down from again', () => {
    const p = new Pacer();
    run(p, 300, () => 1 / 30);
    expect(p.quality).toBe(1);
    run(p, 2000, (q) => (1 / 15) * q * q);
    expect(p.quality).toBeLessThan(1);
  });

  it('never below the floor it is given (a phone: one drawn pixel for each CSS pixel)', () => {
    const p = new Pacer();
    p.floor = 1 / 1.7;
    // (far too much to draw: every step helps, and none is enough)
    run(p, 5000, (q) => (1 / 10) * q * q);
    expect(p.quality).toBeCloseTo(1 / 1.7);
  });

  it('frames held up by a menu drawing its pictures (the mounts, a look tried on) are not counted', () => {
    busyElsewhere(1000);
    expect(heldElsewhere(1000 + QUIET_MS - 1)).toBe(true);
    expect(heldElsewhere(1000 + QUIET_MS)).toBe(false);
    // the mounts page: a picture of 80 ms every other frame for twenty seconds, on a phone that otherwise keeps up
    const p = new Pacer();
    let now = 5000;
    let last = now;
    let lowest = 1;
    for (let i = 0; i < 600; i++) {
      const photo = i % 2 === 0;
      now += 1000 / 60 + (photo ? 80 : 0);
      if (photo) busyElsewhere(now);
      const dt = (now - last) / 1000;
      last = now;
      if (!heldElsewhere(now)) p.tick(dt);
      lowest = Math.min(lowest, p.quality);
    }
    // (counted, the picture stepped down while the pictures were drawn)
    expect(lowest).toBe(1);
    const portrait = readFileSync('src/games/sigilfall/render3d/portrait.ts', 'utf8');
    expect(portrait).toContain('busyElsewhere();');
    const stage = readFileSync('src/games/sigilfall/render3d/stage.ts', 'utf8');
    expect(stage).toContain('if (heldElsewhere(now)) return;');
  });

  it('a phone never draws fewer pixels than the page has CSS pixels', () => {
    const stage = readFileSync('src/games/sigilfall/render3d/stage.ts', 'utf8');
    expect(stage).toContain('export const MIN_DPR_TOUCH = 1;');
    expect(stage).toContain('pacer.floor = touch ? Math.min(1, Math.max(QUALITY_FLOOR, MIN_DPR_TOUCH / d)) : QUALITY_FLOOR;');
  });
});

describe('Sigilfall: the camera is held inside the land', () => {
  const renderer = readFileSync('src/games/sigilfall/render/renderer.ts', 'utf8');

  it('by what the picture really shows up and down the land, not by a rectangle', () => {
    expect(renderer).toContain('this.camY = held(cy, r.far - peek.t, mapH - r.near + peek.b, mapH) - this.vh / 2;');
    expect(renderer).toContain('const far = cy - top.y;');
    expect(renderer).toContain('const near = bottom.y - cy;');
  });

  it('and may pass an edge by two tiles at most, near a way out', () => {
    expect(renderer).toContain('const most = TILE * 2;');
  });
});
