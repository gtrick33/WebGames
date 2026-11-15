/**
 * The Ring on a phone, after the owner's note of 2026-11-15: "can we please fix the buttons please, currently theyre
 * lowkey covering the enemies and i can barely see whats happening on the right side of the screen, the target button is
 * also next to a spell, id like more organized more natural feeling to the UI".
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATES, Match, type Fighter } from '../src/games/sigilfall/arena/sim';
import { THUMBS_LEAN, THUMBS_LEAN_MAX, THUMBS_LOWER, thumbsFrame } from '../src/games/sigilfall/render3d/ring3d';

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
    const pill = rule('.rb-ring-cycle');
    expect(pill).toMatch(/justify-self:\s*end/);
    expect(pill).toMatch(/height:\s*30px/);
  });

  it('the cluster in two arcs round the attack: its next three close in, the step, the super and the fifth further out', () => {
    const at = (k: string) => {
      const r = rule(`.rb-ring-thumbs .rb-cluster .rb-sb-${k}`);
      const n = (p: string) => Number(new RegExp(`${p}:\\s*(\\d+)px`).exec(r)![1]);
      return { x: n('right') + n('width') / 2, y: n('bottom') + n('height') / 2 };
    };
    const c = at('basic');
    const from = (k: string) => Math.hypot(at(k).x - c.x, at(k).y - c.y);
    for (const k of ['s1', 's2', 's3']) expect(from(k), k).toBeLessThan(95);
    for (const k of ['dodge', 'ult', 's4']) expect(from(k), k).toBeGreaterThan(130);
  });
});
