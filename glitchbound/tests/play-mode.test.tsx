import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FULLSCREEN_WATCHDOG_MS, usePlayMode } from '../src/pages/GamePage';

// The Fullscreen API as jsdom lacks it: requestFullscreen enters (or not, per test) and fires fullscreenchange.
let fsEl: Element | null = null;
let honors = true;
const fire = (): void => void document.dispatchEvent(new Event('fullscreenchange'));
const browserLeaves = (): void =>
  act(() => {
    fsEl = null;
    fire();
  });

function setup(touch: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: touch && q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} }));
  const el = document.createElement('div');
  document.body.appendChild(el);
  const request = vi.fn(() => {
    if (honors) {
      fsEl = el;
      fire();
    }
    return Promise.resolve();
  });
  el.requestFullscreen = request as unknown as Element['requestFullscreen'];
  const onLeave = vi.fn();
  const onPause = vi.fn();
  // one ref for the whole test, like the page's stageRef
  const ref = { current: el };
  const hook = renderHook(() => usePlayMode(ref, onLeave, false, onPause));
  return { el, request, onLeave, onPause, hook, play: () => hook.result.current };
}

beforeEach(() => {
  vi.useFakeTimers();
  fsEl = null;
  honors = true;
  sessionStorage.clear();
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => true });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fsEl });
  document.exitFullscreen = vi.fn(() => {
    fsEl = null;
    fire();
    return Promise.resolve();
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

describe('play mode on a touch screen', () => {
  it('stays pinned and pauses when the browser leaves full screen by itself', () => {
    const { play, onLeave, onPause, el } = setup(true);
    act(() => play().enter());
    expect(play().active && !play().immersive).toBe(true);
    act(() => void vi.advanceTimersByTime(5000));
    browserLeaves();
    expect(play().active).toBe(true);
    expect(play().immersive).toBe(true);
    expect(el.classList.contains('stage-immersive')).toBe(true);
    expect(document.documentElement.classList.contains('game-focus')).toBe(true);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('asks for full screen again on the next tap, and the game stays paused when it lands (PU-05)', () => {
    const { play, request, onPause } = setup(true);
    act(() => play().enter());
    act(() => void vi.advanceTimersByTime(5000));
    browserLeaves();
    act(() => play().retryFullscreen());
    expect(request).toHaveBeenCalledTimes(2);
    expect(play().immersive).toBe(false);
    expect(play().active).toBe(true);
    expect(onPause).toHaveBeenCalledTimes(2);
  });

  it('leaves play mode only by the player’s own exit', () => {
    const { play, onLeave } = setup(true);
    act(() => play().enter());
    act(() => play().exit());
    expect(play().active).toBe(false);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('game-focus')).toBe(false);
  });

  it('pins the stage at once when the request resolves without entering (Home Screen app), and never retries from a tap after a miss', () => {
    honors = false;
    const { play, request } = setup(true);
    act(() => play().enter());
    expect(play().immersive).toBe(true);
    act(() => void vi.advanceTimersByTime(FULLSCREEN_WATCHDOG_MS + 10));
    expect(play().immersive).toBe(true);
    act(() => play().retryFullscreen());
    act(() => void vi.advanceTimersByTime(FULLSCREEN_WATCHDOG_MS + 10));
    // two misses: no more asking this session
    act(() => play().retryFullscreen());
    expect(request).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('glitchbound.noFullscreen')).toBe('1');
    expect(play().immersive).toBe(true);
  });

  it('stops asking after full screen drops again right after entering twice', () => {
    const { play, request } = setup(true);
    act(() => play().enter());
    browserLeaves();
    act(() => play().retryFullscreen());
    browserLeaves();
    expect(play().immersive).toBe(true);
    act(() => play().retryFullscreen());
    expect(request).toHaveBeenCalledTimes(2);
    // a new game goes straight to the pinned stage
    act(() => play().exit());
    act(() => play().enter());
    expect(request).toHaveBeenCalledTimes(2);
    expect(play().immersive).toBe(true);
  });

  it('leaves again when a request lands after the player exited', () => {
    honors = false;
    const { play, el } = setup(true);
    act(() => play().enter());
    act(() => play().exit());
    act(() => {
      fsEl = el;
      fire();
    });
    expect(document.exitFullscreen).toHaveBeenCalled();
    expect(play().active).toBe(false);
  });
});

describe('play mode on a desktop', () => {
  it('Escape (the browser leaving full screen) leaves play mode', () => {
    const { play, onLeave } = setup(false);
    act(() => play().enter());
    expect(play().active).toBe(true);
    browserLeaves();
    expect(play().active).toBe(false);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('falls back to the pinned stage when the request never enters', () => {
    honors = false;
    const { play } = setup(false);
    act(() => play().enter());
    expect(play().active).toBe(false);
    act(() => void vi.advanceTimersByTime(FULLSCREEN_WATCHDOG_MS + 10));
    expect(play().immersive).toBe(true);
  });
});
