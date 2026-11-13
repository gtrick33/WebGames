/**
 * The mark of where a placed spell will land (render/reticle.ts), after the owner's note: "make the projected
 * textures for the targeted spells with better visuals, currently it's just big white circle and i want it to be a
 * bit more noticable".
 */
import { describe, expect, it } from 'vitest';
import { drawReach, drawReticle } from '../src/games/sigilfall/render/reticle';

/** A canvas that only writes down what it is asked to draw. */
function pen() {
  const strokes: { style: string; width: number; dash: number[]; offset: number }[] = [];
  const fills: unknown[] = [];
  const stops: string[] = [];
  let dash: number[] = [];
  const g = {
    strokeStyle: '',
    fillStyle: '' as unknown,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineDashOffset: 0,
    globalAlpha: 1,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => undefined,
    ellipse: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    setLineDash: (d: number[]) => {
      dash = d;
    },
    createRadialGradient: () => ({ addColorStop: (_at: number, c: string) => stops.push(c) }),
    stroke: () => strokes.push({ style: g.strokeStyle, width: g.lineWidth, dash, offset: g.lineDashOffset }),
    fill: () => fills.push(g.fillStyle),
  };
  return { g: g as unknown as CanvasRenderingContext2D, strokes, fills, stops };
}

const PURPLE = '#a06cff';

describe('a placed spell’s landing mark', () => {
  it('is drawn in the spell’s own color, with a dark line under its rim and more to it than one circle', () => {
    const p = pen();
    drawReticle(p.g, 100, 100, 40, PURPLE, 1.2);
    expect(p.fills.length).toBeGreaterThan(0);
    // the fill is the spell's color, deepest at the rim
    expect(p.stops.every((c) => c.startsWith('rgba(160,108,255,'))).toBe(true);
    const alpha = p.stops.map((c) => Number(c.slice(c.lastIndexOf(',') + 1, -1)));
    expect(alpha.at(-1)!).toBeGreaterThan(alpha[0]!);
    // the rim, the turning ring, the teeth, the closing ring, the cross
    expect(p.strokes.length).toBeGreaterThanOrEqual(5);
    expect(p.strokes.some((s) => s.style === PURPLE)).toBe(true);
    expect(p.strokes.some((s) => /^rgba\((\d|1\d|2\d),/.test(s.style) || s.style.startsWith('#0') || s.style.startsWith('#1')), 'a dark line under the rim').toBe(true);
    expect(p.strokes.some((s) => s.dash.length > 0), 'a dashed ring').toBe(true);
  });

  it('moves with time, and stands still and grey where the spell can’t go', () => {
    const at = (time: number, dim = false) => {
      const p = pen();
      drawReticle(p.g, 100, 100, 40, PURPLE, time, dim);
      return p;
    };
    expect(JSON.stringify(at(0.2).strokes)).not.toBe(JSON.stringify(at(0.7).strokes));
    const a = at(0.2, true);
    const b = at(0.7, true);
    expect(JSON.stringify(a.strokes)).toBe(JSON.stringify(b.strokes));
    expect(a.strokes.some((s) => s.style === PURPLE)).toBe(false);
    expect(a.stops.some((c) => c.startsWith('rgba(160,108,255,'))).toBe(false);
  });

  it('the thread from the caster to it is dashes that run toward it', () => {
    const run = (time: number) => {
      const p = pen();
      drawReach(p.g, 0, 0, 120, 40, PURPLE, time, false);
      return p.strokes;
    };
    expect(run(0).some((s) => s.dash.length > 0 && s.style.startsWith('rgba(160,108,255,'))).toBe(true);
    expect(JSON.stringify(run(0))).not.toBe(JSON.stringify(run(0.3)));
  });
});
