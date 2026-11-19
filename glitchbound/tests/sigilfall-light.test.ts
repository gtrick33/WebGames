/**
 * Light (POLISH_PLAN.md piece 14): fire and magic glow where the machine has room for it, warnings and what covers
 * never do, and each open land's far side stands in its own air.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLOW_QUALITY, glowWanted } from '../src/games/sigilfall/render3d/bloom';
import { FIELD, FIELD_GLOWS, FX, GLOWS } from '../src/games/sigilfall/render3d/fx3d';

describe('Sigilfall: fire and magic glow', () => {
  it('glows on Sharp anywhere, on Auto on a computer that keeps up, never on Light nor on Auto on a touch screen', () => {
    expect(glowWanted('high', true, 0.5)).toBe(true);
    expect(glowWanted('auto', false, 1)).toBe(true);
    expect(glowWanted('auto', false, GLOW_QUALITY - 0.01)).toBe(false);
    expect(glowWanted('auto', true, 1)).toBe(false);
    expect(glowWanted('low', false, 1)).toBe(false);
  });

  it('the lights glow; a warning, smoke, shadow, water and the rest never do', () => {
    for (const k of Object.keys(GLOWS)) expect(Object.keys(FX), k).toContain(k);
    for (const k of Object.keys(FIELD_GLOWS)) expect(Object.keys(FIELD), k).toContain(k);
    for (const k of ['flame', 'bolt', 'orb', 'holy', 'rift', 'blast'] as const) expect(GLOWS[k], k).toBeGreaterThan(0);
    for (const k of ['warn', 'smoke', 'shadow', 'water', 'web', 'poison', 'crack', 'mark'] as const) expect(GLOWS[k] ?? 0, k).toBe(0);
    expect(FIELD_GLOWS.fire).toBeGreaterThan(0);
    expect(FIELD_GLOWS.poison ?? 0).toBe(0);
  });

  it('the effects shader draws only its lights in the glow pass', () => {
    const src = readFileSync('src/games/sigilfall/render3d/fx3d.ts', 'utf8');
    expect(src).toContain('float lit = uGlowPass > 0.5 ? emits(kind, vP.z) : 1.0;');
    expect(src).toContain('gl_FragColor = vec4(o.rgb * vA.a * lit, 0.0);');
  });
});

describe('Sigilfall: the air of an open land', () => {
  it('lays its own light over the far side of the picture, the moon’s at night, and none in a deep place', () => {
    const src = readFileSync('src/games/sigilfall/render/renderer.ts', 'utf8');
    expect(src).toContain("if (w.region.kind === 'dungeon' || w.region.interior || w.region.dark || roomOf(w)) return;");
    expect(src).toContain('const [r, gg, b] = hexRgb(zoneLight(w.region.id));');
    expect(src).toMatch(/this\.vignette\(g, w\);\n\s+this\.haze\(g, w\);/);
  });
});
