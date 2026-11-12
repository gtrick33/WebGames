/**
 * A road's end is its whole gate (the owner: "increase the collider of where u enter the gate and go to the next
 * zone, currently u have to hit a specific point within the gate"): anywhere under the arch offers the way on, not a
 * spot twenty pixels round the middle of it. A door stays a step away, and a gate is not reached from the land beside it.
 */
import { describe, expect, it } from 'vitest';
import { TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

function offered(w: World, x: number, y: number): string | null {
  w.enemies = [];
  w.player.x = x;
  w.player.y = y;
  w.input = emptyInput();
  w.step(1 / 60);
  const it = w.interactable;
  return it && it.kind === 'exit' ? it.to : null;
}

describe('the way out of a land', () => {
  it('is taken anywhere under its gate, from one tower to the other', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 10));
    const gate = w.exits.find((x) => x.to === 'whisperwood' && !x.door)!;
    // (the north gate: the land is south of it)
    for (const side of [-2.2, -1.2, 0, 1.2, 2.2]) expect(offered(w, gate.x + side * TILE, gate.y + TILE), `side ${side}`).toBe('whisperwood');
    // not from further along the wall, nor from well inside the land
    expect(offered(w, gate.x + 4 * TILE, gate.y + TILE)).toBeNull();
    expect(offered(w, gate.x, gate.y + 3 * TILE)).toBeNull();
  });

  it('on a side of the land too (a road going east or west)', () => {
    let tried = 0;
    for (const region of ['thornvale', 'amberfield', 'brackenridge'] as const) {
      const w = newWorld(region, readyHero('warrior', 30));
      const mw = w.map.w * TILE;
      for (const gate of w.exits.filter((x) => !x.door && (x.x < 2 * TILE || x.x > mw - 2 * TILE))) {
        const into = gate.x < 2 * TILE ? 1 : -1;
        for (const side of [-2, 0, 2]) expect(offered(w, gate.x + into * TILE, gate.y + side * TILE), `${region} side ${side}`).toBe(gate.to);
        expect(offered(w, gate.x + into * 3 * TILE, gate.y)).toBeNull();
        tried++;
      }
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('a door is still a step away, no further', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 10));
    const door = w.exits.find((x) => x.door)!;
    expect(offered(w, door.x + 12, door.y)).toBe(door.to);
    expect(offered(w, door.x + 2 * TILE, door.y)).toBeNull();
  });
});
