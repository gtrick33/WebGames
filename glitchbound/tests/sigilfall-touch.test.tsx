import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SigilEngine } from '../src/games/sigilfall/engine';
import { TouchState } from '../src/games/sigilfall/input/input';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { TouchControls } from '../src/games/sigilfall/ui/Touch';
import { MOUNT_DEFS } from '../src/games/sigilfall/data/mounts';
import { FIRST_RIDE } from '../src/games/sigilfall/progress/wardrobe';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The touch controls with more than one finger (blueprint Prompt 1: "touch joystick/pointer cleanup and
 * multitouch ownership"): each control owns the finger that pressed it, a second finger can't take over
 * the stick, and every way a finger can go away lets go of what it held.
 */

// the buttons' pictures need a canvas, which jsdom has not got
vi.mock('../src/games/sigilfall/render/sprites', () => ({ skillIconUrl: () => '', skillHasPicture: () => false }));
vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));

beforeAll(() => {
  // jsdom has no pointer events: a MouseEvent that carries a pointer id and type, and capture that does nothing
  class FakePointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'touch';
    }
  }
  (globalThis as unknown as { PointerEvent: typeof FakePointerEvent }).PointerEvent = FakePointerEvent;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
});
afterEach(cleanup);

function setup() {
  const world = newWorld('whisperwood', readyHero('ranger', 12));
  const touch = new TouchState();
  const engine = { settings: { ...DEFAULT_SETTINGS }, touch, hero: world.hero, world, frameHooks: new Set(), ui: { teach: null }, touchMode: true, drinkPotion: () => undefined, toggleMount: () => undefined, interact: () => undefined } as unknown as SigilEngine;
  const view = render(<TouchControls engine={engine} />);
  const zone = view.container.querySelector('.rb-joyzone')! as HTMLElement;
  const attack = view.container.querySelector('.rb-sb-basic')! as HTMLElement;
  return { touch, view, zone, attack, engine };
}

const finger = (el: HTMLElement, type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel' | 'lostPointerCapture', id: number, x: number, y: number) =>
  act(() => {
    fireEvent[type](el, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true });
  });

describe('Sigilfall: touch controls with two thumbs', () => {
  it('moving and attacking at once, each thumb letting go of its own control', () => {
    const { touch, zone, attack } = setup();
    finger(zone, 'pointerDown', 1, 100, 200);
    finger(zone, 'pointerMove', 1, 160, 200);
    expect(touch.mx).toBeGreaterThan(0.5);
    finger(attack, 'pointerDown', 2, 600, 300);
    expect(touch.holdBasic?.slot).toBe('basic');
    // the moving thumb keeps moving while the other holds attack
    finger(zone, 'pointerMove', 1, 100, 140);
    expect(touch.my).toBeLessThan(-0.5);
    // the attack thumb lifts: the stick is not let go
    finger(attack, 'pointerUp', 2, 600, 300);
    expect(touch.holdBasic).toBeNull();
    expect(touch.my).toBeLessThan(-0.5);
    finger(zone, 'pointerUp', 1, 100, 140);
    expect(touch.mx).toBe(0);
    expect(touch.my).toBe(0);
  });

  it('a held stick stays under the thumb when the controls redraw (it used to jump back to rest and jitter)', () => {
    const { zone, view, engine } = setup();
    const joy = view.container.querySelector('.rb-joy') as HTMLElement;
    const knob = view.container.querySelector('.rb-knob') as HTMLElement;
    const rest = joy.style.transform;
    finger(zone, 'pointerDown', 1, 100, 200);
    finger(zone, 'pointerMove', 1, 130, 200);
    const held = [joy.style.transform, knob.style.transform];
    expect(held[0]).not.toBe(rest);
    // a toast, a cooldown: the game redraws its controls while the thumb is down
    view.rerender(<TouchControls engine={engine} />);
    expect([joy.style.transform, knob.style.transform]).toEqual(held);
    finger(zone, 'pointerUp', 1, 130, 200);
    expect(joy.style.transform).toBe(rest);
  });

  it('a second finger on the stick does not take it over, and lifting it changes nothing', () => {
    const { touch, zone } = setup();
    finger(zone, 'pointerDown', 1, 100, 200);
    finger(zone, 'pointerMove', 1, 160, 200);
    finger(zone, 'pointerDown', 3, 40, 260);
    finger(zone, 'pointerMove', 3, 40, 320);
    expect(touch.mx).toBeGreaterThan(0.5);
    finger(zone, 'pointerUp', 3, 40, 320);
    expect(touch.mx).toBeGreaterThan(0.5);
  });

  it('a cancelled touch, lost capture, the window losing focus and the controls closing all let go', () => {
    const { touch, zone, view } = setup();
    for (const how of ['pointerCancel', 'lostPointerCapture'] as const) {
      finger(zone, 'pointerDown', 1, 100, 200);
      finger(zone, 'pointerMove', 1, 160, 200);
      expect(touch.mx).toBeGreaterThan(0.5);
      finger(zone, how, 1, 160, 200);
      expect(touch.mx, how).toBe(0);
    }
    finger(zone, 'pointerDown', 1, 100, 200);
    finger(zone, 'pointerMove', 1, 160, 200);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(touch.mx).toBe(0);
    finger(zone, 'pointerDown', 1, 100, 200);
    finger(zone, 'pointerMove', 1, 160, 200);
    view.unmount();
    expect(touch.mx).toBe(0);
  });

  it('the potion and the mount stand apart from the skills, and low on health a pointer stands over the potion', () => {
    const world = newWorld('whisperwood', readyHero('ranger', 24));
    // (riding open, a mount owned)
    world.hero.quests[FIRST_RIDE] = { state: 'done', n: 0 };
    world.hero.mounts = [Object.keys(MOUNT_DEFS)[0]!];
    const touch = new TouchState();
    const engine = { settings: { ...DEFAULT_SETTINGS }, touch, hero: world.hero, world, frameHooks: new Set(), ui: { teach: { slot: 'potion', text: 'Low health! Tap the potion to drink', shown: 0, until: 1e12 }, tip: null }, touchMode: true, drinkPotion: () => undefined, toggleMount: () => undefined, interact: () => undefined } as unknown as SigilEngine;
    const view = render(<TouchControls engine={engine} />);
    const cluster = view.container.querySelector('.rb-cluster')!;
    expect(cluster.querySelector('.rb-sb-basic')).toBeTruthy();
    expect(cluster.querySelector('.rb-sb-potion')).toBeNull();
    expect(cluster.querySelector('.rb-sb-mount')).toBeNull();
    const potion = view.container.querySelector('.rb-potion-dock > .rb-sb-potion');
    expect(potion?.classList.contains('is-teach')).toBe(true);
    expect(view.container.querySelector('.rb-potion-dock > .rb-teach.is-at-potion')?.textContent).toBe('Low health! Tap the potion to drink');
    // (the cluster's own lesson bubble is not drawn for it)
    expect(cluster.querySelector('.rb-teach')).toBeNull();
    const mount = view.container.querySelector('.rb-sb-mount');
    expect(mount?.parentElement).toBe(cluster.parentElement);
  });
});
