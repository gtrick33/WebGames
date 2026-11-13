import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hudScale } from '../src/games/sigilfall/render/camera';
import { PACE_SLOW, QUALITY_FLOOR } from '../src/games/sigilfall/render3d/stage';

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
