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
import { RING_OUT, ringFit, THUMBS_LEAN, THUMBS_LEAN_MAX, THUMBS_LOWER, thumbsFrame } from '../src/games/sigilfall/render3d/ring3d';

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
  it('the hero stands a little over the middle, and the camera leans a third of the way toward whom they fight', () => {
    const { m, me, foe } = duel();
    // (behind the gates: nobody to lean toward)
    Object.assign(me, { x: 200, y: 150 });
    Object.assign(foe, { x: 290, y: 130 });
    expect(thumbsFrame(m, me)).toEqual({ x: 200, y: 150 + THUMBS_LOWER });
    m.step(GATES + 0.01, {});
    Object.assign(me, { x: 200, y: 150 });
    Object.assign(foe, { x: 290, y: 130 });
    const at = thumbsFrame(m, me);
    expect(at.x).toBeCloseTo(200 + 90 * THUMBS_LEAN, 5);
    expect(at.y).toBeCloseTo(150 + THUMBS_LOWER - 20 * THUMBS_LEAN, 5);
    // a long way off: no further than its reach, so the hero never leaves the picture
    Object.assign(foe, { x: 600, y: 400 });
    const far = thumbsFrame(m, me);
    expect(far.x).toBe(200 + THUMBS_LEAN_MAX.x);
    expect(far.y).toBe(150 + THUMBS_LOWER + THUMBS_LEAN_MAX.y);
    // (with a mouse the camera is as it was: only thumbs set it)
    expect(MATCH).toContain('view.thumbs = engine.touchMode;');
  });
});

describe('The Ring’s camera: as before, a little farther out', () => {
  // the owner, 2026-11-16: "can we move the camera the way it was before #267 PR just 5-10% zoomed out more"
  it('a readable size, 8% farther out, following the hero both ways where the ring doesn’t all fit', () => {
    expect(RING_OUT).toBeGreaterThanOrEqual(0.9);
    expect(RING_OUT).toBeLessThanOrEqual(0.95);
    // (a sideways phone and the desktop game panel: the size the camera had before, times RING_OUT)
    for (const [w, h, dpr] of [[750, 342, 3], [770, 560, 2]] as const) {
      const before = Math.min((34 / 16) * TILE * dpr, ((w * dpr) / 24 / 16) * TILE);
      const fit = ringFit(w, h, dpr);
      expect(fit.tile).toBeCloseTo(before * RING_OUT, 5);
      expect(fit.follow).toBe(true);
    }
    // (never smaller than the whole ring: a view that holds it all holds it, still)
    const whole = Math.min((3000 * 1) / (ARENA_W / TILE + 2), ((1400 * 1) / (ARENA_H / TILE + 2)) * 1.05);
    expect(ringFit(3000, 1400, 1).tile).toBeGreaterThanOrEqual(whole);
    const src = read('src/games/sigilfall/render3d/ring3d.ts');
    expect(src).toMatch(/cy = ARENA_H <= halfH \* 2/);
  });
});

describe('The Ring on a phone: every button in its place', () => {
  it('the switch-target button is over the top-right ability, out of the arc, and only a crosshair', () => {
    // (the owner, 2026-11-16: "move the target button to be right above the spells on top of the normal righterst one,
    // currently its below the nameplates")
    expect(MATCH).not.toContain('rb-sb-target');
    expect(CSS).not.toContain('rb-sb-target');
    const foes = MATCH.slice(MATCH.indexOf('<div className="rb-ring-team is-foes"'));
    expect(foes.slice(0, foes.indexOf('</div>'))).not.toContain('rb-ring-cycle');
    const cluster = MATCH.slice(MATCH.indexOf('<div className="rb-cluster" data-tut="bar">'));
    expect(cluster.slice(0, cluster.indexOf('</button>'))).toContain('className="rb-ring-cycle"');
    // (its crosshair and nothing more: the tutorial and the rules say what it does)
    const button = cluster.slice(cluster.indexOf('className="rb-ring-cycle"'), cluster.indexOf('</button>'));
    expect(button).toContain('<svg');
    expect(button).not.toMatch(/<span>|>Next</);
    expect(rule('.rb-ring-cycle')).toMatch(/border-radius:\s*50%/);
    // over s3, the arc's top-right (s4 while a bar held five): its middle over that one's, clear of it, inside the
    // screen's right edge
    const px = (r: string, k: string): number => Number(new RegExp(`(?:^|[;\\s])${k}:\\s*(-?[\\d.]+)px`).exec(r)![1]);
    const top = rule('.rb-ring-thumbs .rb-cluster .rb-sb-s3');
    const t = rule('.rb-ring-thumbs .rb-cluster .rb-ring-cycle');
    expect(px(t, 'right') + px(t, 'width') / 2).toBeCloseTo(px(top, 'right') + px(top, 'width') / 2, 0);
    expect(px(t, 'bottom')).toBeGreaterThanOrEqual(px(top, 'bottom') + px(top, 'height') + 4);
    expect(CSS).not.toContain('.rb-ring-thumbs .rb-cluster .rb-sb-s4');
  });

  it('the tutorial and the rules say what the ◎ button does, and where it is', () => {
    const tutorial = read('src/games/sigilfall/arena/tutorial.ts');
    expect(tutorial).toContain('a ◎ button comes up over your top-right ability: tap it for the next enemy, or slide from it toward the one you want.');
    expect(tutorial).toContain('the ◎ button over your top-right ability switches between them');
    expect(tutorial).not.toContain('under their nameplates');
    expect(read('src/games/sigilfall/ui/RingSetup.tsx')).toContain('the ◎ button over your top-right ability: tap for the next, or slide toward one');
  });

  it('the nameplates 5% smaller, each column from its own top corner', () => {
    expect(rule('.rb-ring-team')).toMatch(/display: grid/);
    expect(CSS).toMatch(/\.rb-ring-team \{\s*scale: 0\.95;\s*transform-origin: top left;/);
    expect(CSS).toMatch(/\.rb-ring-team\.is-foes \{\s*transform-origin: top right;/);
  });

  it('the cluster round the basic ability: the bar’s other three on one arc close in, and only the super outside it', () => {
    const at = (k: string) => {
      const r = rule(`.rb-ring-thumbs .rb-cluster .rb-sb-${k}`);
      const n = (p: string) => Number(new RegExp(`${p}:\\s*(\\d+)px`).exec(r)![1]);
      return { x: n('right') + n('width') / 2, y: n('bottom') + n('height') / 2 };
    };
    const c = at('basic');
    const from = (k: string) => Math.hypot(at(k).x - c.x, at(k).y - c.y);
    // (one arc: all three the same way from the basic one, near enough to roll a thumb from one to the next)
    const arc = ['s1', 's2', 's3'].map(from);
    for (const d of arc) expect(d).toBeLessThan(95);
    expect(Math.max(...arc) - Math.min(...arc)).toBeLessThan(2);
    expect(from('ult'), 'ult').toBeGreaterThan(130);
  });
});
