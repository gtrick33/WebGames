/**
 * The thumb stick never sticks (the owner, on an iPhone in The Vigil: "the joystick became stucked to the right and i
 * couldnt move it at all"). A lift the page is never told of must not leave it held, and a stick that thinks it is
 * held must never turn a new thumb away.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Stick } from '../src/games/sigilfall/ui/Stick';

const SETTINGS = { joystick: 50, joyMode: 'float', deadzone: 0.1, sensitivity: 1 } as const;

function mount() {
  const onMove = vi.fn<(x: number, y: number) => void>();
  const { container } = render(<Stick settings={SETTINGS} onMove={onMove} />);
  const zone = container.querySelector('.rb-joyzone') as HTMLDivElement;
  const last = (): [number, number] => onMove.mock.calls[onMove.mock.calls.length - 1] as [number, number];
  const touch = (type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel', id: number, x: number, y: number): void => {
    fireEvent[type](zone, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y });
  };
  return { onMove, zone, last, touch };
}

describe('Sigilfall: the thumb stick', () => {
  it('moves with the thumb and lets go when it lifts', () => {
    const { last, touch } = mount();
    touch('pointerDown', 1, 100, 100);
    touch('pointerMove', 1, 160, 100);
    expect(last()[0]).toBeCloseTo(1, 5);
    expect(last()[1]).toBeCloseTo(0, 5);
    touch('pointerUp', 1, 160, 100);
    expect(last()).toEqual([0, 0]);
  });

  it('a thumb takes a stick whose old thumb is no longer on the glass, though its lift was never told', () => {
    const { last, touch, zone } = mount();
    // hard over to the right (its own landing seen among the touches), and then the phone takes the touch away
    // without a word: no pointerup, no touchend
    touch('pointerDown', 1, 100, 100);
    fireEvent.touchStart(zone, { touches: [{ identifier: 1, target: zone }], changedTouches: [{ identifier: 1, target: zone }] });
    touch('pointerMove', 1, 170, 100);
    expect(last()[0]).toBeCloseTo(1, 5);
    // the next thumb lands: the only finger on the glass is the new one, so the stick is nobody's, and now this thumb's
    touch('pointerDown', 2, 200, 200);
    fireEvent.touchStart(zone, { touches: [{ identifier: 2, target: zone }], changedTouches: [{ identifier: 2, target: zone }] });
    touch('pointerMove', 2, 150, 150);
    expect(last()[0]).toBeLessThan(-0.5);
    expect(last()[1]).toBeLessThan(-0.5);
    touch('pointerUp', 2, 150, 150);
    expect(last()).toEqual([0, 0]);
  });

  it('a second finger does not take a stick whose thumb is still on the glass', () => {
    const { last, touch, zone } = mount();
    touch('pointerDown', 1, 100, 100);
    fireEvent.touchStart(zone, { touches: [{ identifier: 1, target: zone }], changedTouches: [{ identifier: 1, target: zone }] });
    touch('pointerMove', 1, 170, 100);
    touch('pointerDown', 2, 200, 200);
    fireEvent.touchStart(zone, { touches: [{ identifier: 1, target: zone }, { identifier: 2, target: zone }], changedTouches: [{ identifier: 2, target: zone }] });
    touch('pointerMove', 2, 150, 150);
    expect(last()[0]).toBeCloseTo(1, 5);
    // (nor does that finger's lift let it go: the thumb is still there)
    touch('pointerUp', 2, 150, 150);
    fireEvent.touchEnd(zone, { touches: [{ identifier: 1, target: zone }], changedTouches: [{ identifier: 2, target: zone }] });
    expect(last()[0]).toBeCloseTo(1, 5);
  });

  it('a finger landing anywhere frees a stick that nobody holds', () => {
    const { last, touch, zone } = mount();
    touch('pointerDown', 1, 100, 100);
    fireEvent.touchStart(zone, { touches: [{ identifier: 1, target: zone }], changedTouches: [{ identifier: 1, target: zone }] });
    touch('pointerMove', 1, 170, 100);
    expect(last()[0]).toBeCloseTo(1, 5);
    // the other thumb presses a button: it is the only finger on the glass
    fireEvent.touchStart(document.body, { touches: [{ identifier: 5, target: document.body }], changedTouches: [{ identifier: 5, target: document.body }] });
    expect(last()).toEqual([0, 0]);
  });

  it('lets go when the lift reaches the window and not the zone', () => {
    const { last, touch } = mount();
    touch('pointerDown', 7, 100, 100);
    touch('pointerMove', 7, 100, 30);
    expect(last()[1]).toBeCloseTo(-1, 5);
    // (the capture was lost without a word: the lift lands on whatever is under the finger)
    fireEvent.pointerUp(document.body, { pointerId: 7, pointerType: 'touch' });
    expect(last()).toEqual([0, 0]);
  });

  it('lets go when the last finger that began on it leaves the glass, whatever the pointer events said', () => {
    const { last, touch, zone } = mount();
    touch('pointerDown', 3, 100, 100);
    touch('pointerMove', 3, 170, 100);
    expect(last()[0]).toBeCloseTo(1, 5);
    // another finger lifts elsewhere while the thumb is still on the stick: it stays held
    fireEvent.touchEnd(document.body, { touches: [{ identifier: 1, target: zone }] });
    expect(last()[0]).toBeCloseTo(1, 5);
    // the phone cancels the thumb (a gesture of its own) and no finger is left: it lets go
    fireEvent.touchCancel(document.body, { touches: [] });
    expect(last()).toEqual([0, 0]);
    // and it is free for the next thumb
    touch('pointerDown', 4, 100, 100);
    touch('pointerMove', 4, 100, 170);
    expect(last()[1]).toBeCloseTo(1, 5);
  });

  it('a mouse does not move it', () => {
    const { onMove, zone } = mount();
    onMove.mockClear();
    fireEvent.pointerDown(zone, { pointerId: 9, pointerType: 'mouse', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(zone, { pointerId: 9, pointerType: 'mouse', clientX: 170, clientY: 100 });
    expect(onMove).not.toHaveBeenCalled();
  });
});
