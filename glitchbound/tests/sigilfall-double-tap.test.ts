/**
 * Two fast taps on the game are two taps (ui/noSelect.ts stopDoubleTap). On an iPhone a double tap on a button of the
 * HUD brought up Safari's magnifying glass (the owner, on an iPhone 17 Pro, 2026-11-26: "if i double tap fast on any
 * button of the ui, the magnefying glass pops up, block any such events please"). No style holds that back; the second
 * touch is refused to the phone, and the click the phone would have made of it is given to the button instead.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, stopDoubleTap } from '../src/games/sigilfall/ui/noSelect';

let stage: HTMLDivElement;
let stop: () => void;
let next = 1;

/** A touch event as the phone sends it (jsdom has no Touch to build one from). */
function touch(type: string, target: Element, x: number, y: number, id: number): boolean {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const t = { identifier: id, target, clientX: x, clientY: y, screenX: x, screenY: y };
  Object.defineProperty(ev, 'changedTouches', { value: [t] });
  Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : [t] });
  target.dispatchEvent(ev);
  return ev.defaultPrevented;
}

/** A tap (or, with `drag`, a press that moves off): which of its start and end the page refused. */
function tap(target: Element, drag = 0): { start: boolean; end: boolean } {
  const id = next++;
  const start = touch('touchstart', target, 10, 10, id);
  if (drag) touch('touchmove', target, 10 + drag, 10, id);
  const end = touch('touchend', target, 10 + drag, 10, id);
  return { start, end };
}

const wait = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

beforeEach(() => {
  stage = document.createElement('div');
  document.body.appendChild(stage);
  stop = stopDoubleTap(stage);
});
afterEach(() => {
  stop();
  stage.remove();
});

describe('two fast taps on the game', () => {
  it('leave a first tap to the phone, which makes its click as ever', () => {
    const b = stage.appendChild(document.createElement('button'));
    let clicks = 0;
    b.addEventListener('click', () => (clicks += 1));
    expect(tap(b)).toEqual({ start: false, end: false });
    expect(clicks).toBe(0);
  });

  it('refuse the second to the phone, and still click the button once', () => {
    const b = stage.appendChild(document.createElement('button'));
    const img = b.appendChild(document.createElement('img'));
    const clicks: boolean[] = [];
    b.addEventListener('click', (e) => clicks.push(e.isTrusted));
    tap(img);
    expect(tap(img)).toEqual({ start: true, end: true });
    expect(clicks).toEqual([false]);
    // and every fast tap after it
    expect(tap(img)).toEqual({ start: true, end: true });
    expect(clicks).toHaveLength(2);
  });

  it('a tap after a pause is a first tap again', async () => {
    const b = stage.appendChild(document.createElement('button'));
    tap(b);
    await wait(DOUBLE_TAP_MS + 100);
    expect(tap(b)).toEqual({ start: false, end: false });
  });

  it('a second touch that drags off makes no click', () => {
    const b = stage.appendChild(document.createElement('button'));
    let clicks = 0;
    b.addEventListener('click', () => (clicks += 1));
    tap(b);
    expect(tap(b, 40).start).toBe(true);
    expect(clicks).toBe(0);
  });

  it('a drag is no tap: a touch after it is not the second of two', () => {
    const b = stage.appendChild(document.createElement('button'));
    tap(b, 40);
    expect(tap(b)).toEqual({ start: false, end: false });
  });

  it('let a field be typed in', () => {
    const f = stage.appendChild(document.createElement('input'));
    tap(f);
    expect(tap(f)).toEqual({ start: false, end: false });
  });

  it('give no click to a button that is off', () => {
    const b = stage.appendChild(document.createElement('button'));
    b.disabled = true;
    let clicks = 0;
    b.addEventListener('click', () => (clicks += 1));
    tap(b);
    expect(tap(b).end).toBe(true);
    expect(clicks).toBe(0);
  });

  it('stop being looked at once the game is gone', () => {
    const b = stage.appendChild(document.createElement('button'));
    stop();
    tap(b);
    expect(tap(b)).toEqual({ start: false, end: false });
  });
});
