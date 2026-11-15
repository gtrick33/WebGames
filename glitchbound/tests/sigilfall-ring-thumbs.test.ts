/**
 * The Ring on a phone, after the owner's note of 2026-11-15: "can we please fix the buttons please, currently theyre
 * lowkey covering the enemies and i can barely see whats happening on the right side of the screen, the target button is
 * also next to a spell, id like more organized more natural feeling to the UI", and then "can we make all 4 spells on
 * the same row around the main spell and the only outer ones to be the ult and the step, also for the target, it could
 * only be the icon, no need for the next text, just add it in the tutorial".
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATES, Match, type Fighter } from '../src/games/sigilfall/arena/sim';
import { ARENA_H, ARENA_W } from '../src/games/sigilfall/arena/maps';
import { TILE } from '../src/games/sigilfall/sim/map';
import { RING_EDGE, RING_LOOK_Y, RING_TILT, ringFit, THUMBS_LEAN, THUMBS_LEAN_MAX, thumbsX } from '../src/games/sigilfall/render3d/ring3d';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CSS = read('src/games/sigilfall/Game.css');
const MATCH = read('src/games/sigilfall/ui/RingMatch.tsx');
/** The body of the first CSS rule with exactly this selector. */
const rule = (selector: string): string => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`).exec(CSS);
  expect(m, selector).not.toBeNull();
  return m![1]!;
};

function duel(): { m: Match; me: Fighter; foe: Fighter } {
  const m = new Match({ seed: 3, map: 'sands', fighters: [{ team: 0, cls: 'priest', name: 'me', bar: ['p-smite'] }, { team: 1, cls: 'warrior', name: 'foe', bar: ['w-hew'] }] });
  const [me, foe] = m.fighters as [Fighter, Fighter];
  return { m, me, foe };
}

describe('The Ring on a phone: the fight in the open middle', () => {
  it('the camera leans a third of the way across toward whom they fight', () => {
    const { m, me, foe } = duel();
    // (behind the gates: nobody to lean toward)
    Object.assign(me, { x: 200, y: 150 });
    Object.assign(foe, { x: 290, y: 130 });
    expect(thumbsX(m, me)).toBe(200);
    m.step(GATES + 0.01, {});
    Object.assign(me, { x: 200, y: 150 });
    Object.assign(foe, { x: 290, y: 130 });
    expect(thumbsX(m, me)).toBeCloseTo(200 + 90 * THUMBS_LEAN, 5);
    // a long way off: no further than its reach, so the hero never leaves the picture
    Object.assign(foe, { x: 600, y: 400 });
    expect(thumbsX(m, me)).toBe(200 + THUMBS_LEAN_MAX);
    // (with a mouse the camera is as it was: only thumbs set it)
    expect(MATCH).toContain('view.thumbs = engine.touchMode;');
  });
});

describe('The Ring’s camera: the whole height, panning only sideways', () => {
  // the owner, 2026-11-15: "zoom out the camera a bit so that the top edge and the bottom edge fit perfectly and canera
  // pans only sideways"
  it('the ring’s height, edge to edge, fills the view’s height, on a phone and with a mouse', () => {
    for (const [w, h, dpr] of [[750, 342, 3], [844, 390, 3], [770, 560, 2], [1280, 720, 1]] as const) {
      const fit = ringFit(w, h, dpr);
      expect(fit.tile * (ARENA_H / TILE + RING_EDGE)).toBeCloseTo(h * dpr * RING_TILT, 5);
      // (wider than the view: it follows, across)
      expect(fit.follow).toBe(fit.tile * (ARENA_W / TILE + 2) > w * dpr * 1.02);
    }
    // (a view squarer than the ring pans; a sideways phone takes in nearly all of it)
    expect(ringFit(770, 560, 2).follow).toBe(true);
  });

  it('up and down the camera never moves: only across', () => {
    const src = read('src/games/sigilfall/render3d/ring3d.ts');
    expect(src).toContain('const cy = RING_LOOK_Y;');
    expect(src).not.toMatch(/cy = .*me\.y/);
    expect(RING_LOOK_Y).toBe(ARENA_H / 2 - 14);
  });
});

describe('The Ring on a phone: every button in its place', () => {
  it('the switch-target button is under the enemies’ nameplates, and nothing in the thumb cluster is anything but a fighting one', () => {
    expect(MATCH).not.toContain('rb-sb-target');
    expect(CSS).not.toContain('rb-sb-target');
    const foes = MATCH.slice(MATCH.indexOf('<div className="rb-ring-team is-foes"'));
    const column = foes.slice(0, foes.indexOf('{/* (a fallen fighter has nothing to press'));
    expect(column).toContain('className="rb-ring-cycle"');
    // (a press on it isn't taken for a press on the nearest nameplate, which the column does with its own)
    expect(column).toContain('e.stopPropagation();');
    const cluster = MATCH.slice(MATCH.indexOf('<div className="rb-cluster" data-tut="bar">'));
    expect(cluster.slice(0, cluster.indexOf('</div>'))).not.toContain('rb-ring-cycle');
    // (its crosshair and nothing more: the tutorial and the rules say what it does)
    const button = column.slice(column.indexOf('className="rb-ring-cycle"'), column.indexOf('</button>'));
    expect(button).toContain('<svg');
    expect(button).not.toMatch(/<span>|>Next</);
    const round = rule('.rb-ring-cycle');
    expect(round).toMatch(/justify-self:\s*end/);
    expect(round).toMatch(/border-radius:\s*50%/);
    expect(round).toMatch(/width:\s*36px/);
    expect(round).toMatch(/height:\s*36px/);
  });

  it('the tutorial and the rules say what the ◎ button does, and where it is', () => {
    const tutorial = read('src/games/sigilfall/arena/tutorial.ts');
    expect(tutorial).toContain('a ◎ button comes up under their nameplates: tap it for the next enemy, or slide from it toward the one you want.');
    expect(tutorial).toContain('the ◎ button under the enemies’ nameplates switches between them');
    expect(tutorial).not.toContain('above your abilities');
    expect(read('src/games/sigilfall/ui/RingSetup.tsx')).toContain('the ◎ button under their nameplates: tap for the next, or slide toward one');
  });

  it('the cluster round the attack: the bar’s other four on one arc close in, and only the step and the super outside it', () => {
    const at = (k: string) => {
      const r = rule(`.rb-ring-thumbs .rb-cluster .rb-sb-${k}`);
      const n = (p: string) => Number(new RegExp(`${p}:\\s*(\\d+)px`).exec(r)![1]);
      return { x: n('right') + n('width') / 2, y: n('bottom') + n('height') / 2 };
    };
    const c = at('basic');
    const from = (k: string) => Math.hypot(at(k).x - c.x, at(k).y - c.y);
    // (one arc: all four the same way from the attack, near enough to roll a thumb from one to the next)
    const arc = ['s1', 's2', 's3', 's4'].map(from);
    for (const d of arc) expect(d).toBeLessThan(95);
    expect(Math.max(...arc) - Math.min(...arc)).toBeLessThan(2);
    for (const k of ['dodge', 'ult']) expect(from(k), k).toBeGreaterThan(130);
  });
});
