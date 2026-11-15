/**
 * The Ring after the owner's note of 2026-11-15: "targering enemies and friends, can you make the highlight marker a bit
 * more stylish and visible, u need to know who uve targeted super eaaily".
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATES, Match, type Fighter } from '../src/games/sigilfall/arena/sim';
import { PICK_COLOR, pickMark, picksOf } from '../src/games/sigilfall/render/ring';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CSS = read('src/games/sigilfall/Game.css');
/** The body of the first CSS rule with exactly this selector (a later one may be inside a reduced-motion block). */
const rule = (selector: string): string => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...CSS.matchAll(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]!);
  expect(all.length, selector).toBeGreaterThan(0);
  return all[0]!;
};

/** A 2v2 with its gates open: a priest (the player) and a warrior against a warrior and a mage, on open ground. */
function twos(): { m: Match; me: Fighter; pal: Fighter; near: Fighter; far: Fighter } {
  const m = new Match({
    seed: 2,
    map: 'sands',
    fighters: [
      { team: 0, cls: 'priest', name: 'me', bar: ['p-mend', 'p-smite'] },
      { team: 0, cls: 'warrior', name: 'pal', bar: ['w-hew'] },
      { team: 1, cls: 'warrior', name: 'near', bar: ['w-hew'] },
      { team: 1, cls: 'mage', name: 'far', bar: ['m-lash'] },
    ],
  });
  m.step(GATES + 0.01, {});
  const [me, pal, near, far] = m.fighters as [Fighter, Fighter, Fighter, Fighter];
  Object.assign(me, { x: 150, y: 125 });
  Object.assign(pal, { x: 160, y: 140 });
  Object.assign(near, { x: 200, y: 125 });
  Object.assign(far, { x: 260, y: 125 });
  return { m, me, pal, near, far };
}

/** A drawing surface that only keeps count of what is drawn on it, and how. */
function recorder(): { g: CanvasRenderingContext2D; calls: { name: string; args: unknown[] }[] } {
  const calls: { name: string; args: unknown[] }[] = [];
  const g = new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      return (...args: unknown[]) => void calls.push({ name: key, args });
    },
    set(target, key: string, v) {
      target[key] = v;
      return true;
    },
  });
  return { g: g as unknown as CanvasRenderingContext2D, calls };
}

describe('The Ring: whom you have chosen, plain at a glance', () => {
  it('the enemy you chose is marked red, the friend you help green; with no enemy chosen, the one your harm goes to', () => {
    const { m, me, pal, near, far } = twos();
    me.target = far.id;
    me.friend = pal.id;
    let picks = picksOf(m, me);
    expect(picks.get(far.id)).toBe('foe');
    expect(picks.get(pal.id)).toBe('friend');
    expect(picks.has(near.id)).toBe(false);
    // nobody chosen: the nearest, quietly, where the harm will go
    me.target = null;
    picks = picksOf(m, me);
    expect(picks.get(near.id)).toBe('auto');
    expect(m.aimOf(me, { aim: 'enemy' } as never)).toBe(near);
    // never yourself, never the fallen
    me.friend = me.id;
    near.dead = true;
    picks = picksOf(m, me);
    expect(picks.has(me.id)).toBe(false);
    expect(picks.has(near.id)).toBe(false);
    expect(picks.get(far.id)).toBe('auto');
  });

  it('the mark on the ground: a glow, four brackets over dark edges, and four arrowheads in at them (none on the quiet one)', () => {
    const shapes = (pick: 'foe' | 'friend' | 'auto') => {
      const { g, calls } = recorder();
      pickMark(g, 0, 0, pick, 1);
      return { arcs: calls.filter((c) => c.name === 'ellipse').length, heads: calls.filter((c) => c.name === 'closePath').length };
    };
    // (the glow, then each of four brackets drawn twice: its dark edge and its color)
    expect(shapes('foe')).toEqual({ arcs: 9, heads: 4 });
    expect(shapes('friend')).toEqual({ arcs: 9, heads: 4 });
    expect(shapes('auto')).toEqual({ arcs: 9, heads: 0 });
    expect(PICK_COLOR.foe).toBe('#ff4a5a');
    expect(PICK_COLOR.friend).toBe('#6ee07a');
  });

  it('it turns and breathes, and stands still for a player who asked for less motion', () => {
    const arcs = (time: number, still: boolean): string => {
      const { g, calls } = recorder();
      pickMark(g, 0, 0, 'foe', time, still);
      return JSON.stringify(calls.filter((c) => c.name === 'ellipse' || c.name === 'moveTo').map((c) => c.args));
    };
    expect(arcs(0.3, false)).not.toBe(arcs(1.7, false));
    expect(arcs(0.3, true)).toBe(arcs(1.7, true));
    const match = read('src/games/sigilfall/ui/RingMatch.tsx');
    expect(match).toContain("view.still = !!engine.settings.reducedMotion;");
    expect(match).toContain("${engine.settings.reducedMotion ? ' is-still' : ''}");
  });

  it('over their head an arrow, and their bar ringed in the same color', () => {
    const ring = read('src/games/sigilfall/render/ring.ts');
    expect(ring).toContain('if (pick) pickArrow(g, f.x,');
    expect(ring).toContain('g.strokeStyle = PICK_COLOR[pick];');
    expect(ring).toContain('markFighter(g, m, f, myId, time, !me || f === me || m.sees(me, f), view, raiseOf(f), picks.get(f.id) ?? null)');
  });

  it('on the nameplates the same colors, lit from the edge and breathing a glow; still for less motion', () => {
    const friend = rule('.rb-ring-frame.is-on');
    expect(friend).toMatch(/--pick:\s*#6ee07a/);
    expect(friend).toMatch(/animation:\s*rb-ring-picked/);
    expect(friend).toMatch(/linear-gradient/);
    expect(rule('.is-foes .rb-ring-frame.is-on')).toMatch(/--pick:\s*#ff4a5a/);
    expect(rule('.rb-ring.is-still .rb-ring-frame.is-on')).toMatch(/animation:\s*none/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.rb-ring-frame\.is-on \{\s*animation: none;/);
  });
});
