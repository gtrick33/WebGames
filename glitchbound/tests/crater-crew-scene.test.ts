import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { botTurn } from '../src/games/crater-crew/ai';
import { newMatch, playTurn, type Match } from '../src/games/crater-crew/match';
import { Scene } from '../src/games/crater-crew/scene';
import type { Sfx } from '../src/games/crater-crew/sound';

// The scene paints the ground on canvases; jsdom has no 2D context, so it gets one that does nothing.
const noop = (): void => undefined;
const fakeCtx = new Proxy(
  {},
  {
    get: (_t, k) => {
      if (k === 'createImageData' || k === 'getImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'canvas') return document.createElement('canvas');
      return noop;
    },
    set: () => true,
  },
);
const realGetContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => fakeCtx) as unknown as HTMLCanvasElement['getContext'];
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext;
});

const sfx = new Proxy({}, { get: () => noop }) as unknown as Sfx;

function battle(): Match {
  return newMatch({
    seed: 77,
    terrain: 'meadow',
    crewSize: 1,
    turnSecs: 30,
    crews: [
      { name: 'Hopper (CPU)', char: 'frog', bot: 'easy', seat: null },
      { name: 'Bolt (CPU)', char: 'robot', bot: 'easy', seat: null },
    ],
  });
}

function scene(m: Match): Scene {
  return new Scene({ match: m, mine: () => false, onTurn: noop, onHud: noop, onShown: noop, sfx: () => sfx, botDelay: 0 });
}

describe('Crater Crew battle screen', () => {
  it('queues the next turns to replay them in order', () => {
    const m0 = battle();
    const m1 = playTurn(m0, botTurn(m0, 'easy', 1)).match;
    const m2 = playTurn(m1, botTurn(m1, 'easy', 2)).match;
    const s = scene(m0);
    s.push(m1);
    s.push(m2);
    expect(s.shown.turn).toBe(0);
  });

  it('jumps to the newest state when it missed a turn (a dropped connection) instead of waiting forever', () => {
    const m0 = battle();
    const m1 = playTurn(m0, botTurn(m0, 'easy', 1)).match;
    const m2 = playTurn(m1, botTurn(m1, 'easy', 2)).match;
    const s = scene(m0);
    // turn 1 never arrived: turn 2 can't be replayed from turn 0
    s.push(m2);
    expect(s.shown.turn).toBe(2);
    expect(s.stage.k === 'aim' || s.stage.k === 'over').toBe(true);
  });
});
