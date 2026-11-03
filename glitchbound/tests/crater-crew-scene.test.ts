import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { botTurn } from '../src/games/crater-crew/ai';
import { cleanInput, newMatch, playTurn, runInputs, type Match, type TurnInput } from '../src/games/crater-crew/match';
import { Scene } from '../src/games/crater-crew/scene';
import { STEP } from '../src/games/crater-crew/sim';
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

  it('a paused single-player battle stops the turn clock; a live room keeps the room’s clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const m0 = battle();
      const m1 = playTurn(m0, botTurn(m0, 'easy', 1)).match;
      const sent: TurnInput[] = [];
      const hud: number[] = [];
      const solo = new Scene({ match: m1, mine: (c) => c === m1.crewTurn, onTurn: (_t, i) => sent.push(i), onHud: (h) => hud.push(h.secs), onShown: noop, sfx: () => sfx, botDelay: 0 });
      for (let i = 0; i < 60 * 5; i++) solo.step(STEP);
      expect(hud[hud.length - 1]).toBe(25);
      // paused: the battle doesn't step while 35 s go by
      vi.setSystemTime(Date.now() + 35_000);
      solo.step(STEP);
      expect(solo.myTurn).toBe(true);
      expect(sent).toHaveLength(0);
      expect(hud[hud.length - 1]).toBe(25);
      // and the rest of the turn still runs out on time
      for (let i = 0; i < 60 * 25 && solo.myTurn; i++) solo.step(STEP);
      expect(sent).toHaveLength(1);

      const live = new Scene({ match: m1, mine: (c) => c === m1.crewTurn, onTurn: (_t, i) => sent.push(i), onHud: noop, onShown: noop, sfx: () => sfx, botDelay: 0, wallClock: true });
      live.setClock(m1.turn, Date.now());
      live.step(STEP);
      vi.setSystemTime(Date.now() + 31_000);
      live.step(STEP);
      expect(live.myTurn).toBe(false);
      expect(sent).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('after dropping dynamite you still run (walk and jump) while it burns, and the room replays the same run', () => {
    const m0 = battle();
    const m1 = playTurn(m0, botTurn(m0, 'easy', 1)).match;
    const sent: TurnInput[] = [];
    const s = new Scene({ match: m1, mine: (c) => c === m1.crewTurn, onTurn: (_t, i) => sent.push(i), onHud: noop, onShown: noop, sfx: () => sfx, botDelay: 0 });
    expect(s.stage.k).toBe('aim');
    s.pickWeapon('dynamite');
    expect(s.weapon).toBe('dynamite');
    s.pressFire();
    for (let i = 0; i < 300 && s.stage.k === 'aim'; i++) s.step(STEP);
    // dropped: the turn isn't sent yet, the critter can still move
    expect(s.stage.k).toBe('run');
    expect(sent).toHaveLength(0);
    const me = () => s.world.units.find((u) => u.id === m1.active)!;
    const x0 = me().x;
    const away = x0 < 900 ? 'left' : 'right';
    s.keys[away] = true;
    for (let i = 0; i < 90; i++) s.step(STEP);
    s.jump();
    for (let i = 0; i < 200 && s.stage.k === 'run'; i++) s.step(STEP);
    s.keys[away] = false;
    expect(s.stage.k).toBe('shot');
    expect(sent).toHaveLength(1);
    const input = sent[0]!;
    expect(runInputs(input)).toHaveLength(180);
    expect(Math.abs(me().x - x0)).toBeGreaterThan(20);
    // the dynamite goes off; the room's replay of the sent turn ends in exactly the same world
    for (let i = 0; i < 2000 && s.stage.k === 'shot'; i++) s.step(STEP);
    expect(s.stage.k).toBe('settle');
    const room = playTurn(m1, cleanInput(JSON.parse(JSON.stringify(input)))!).world;
    expect(JSON.stringify(s.world.units)).toBe(JSON.stringify(room.units));
    expect(Buffer.compare(s.world.mask, room.mask)).toBe(0);

    // someone watching gets the turn from the room and replays the drop and the run the same way
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const watcher = scene(m1);
      watcher.push(playTurn(m1, cleanInput(JSON.parse(JSON.stringify(input)))!).match);
      for (let i = 0; i < 3000 && watcher.stage.k !== 'settle'; i++) {
        vi.setSystemTime(Date.now() + 1000 / 60);
        watcher.step(STEP);
      }
      expect(watcher.stage.k).toBe('settle');
      expect(JSON.stringify(watcher.world.units)).toBe(JSON.stringify(room.units));
    } finally {
      vi.useRealTimers();
    }
  });
});
