import { afterEach, describe, expect, it } from 'vitest';
import { KeyboardMouse } from '../src/games/sigilfall/input/input';

/**
 * The keyboard on any layout (playtesters: on a Bulgarian keyboard the hero stopped walking). Movement keys
 * are known by where they sit, not what they type.
 */

let kbm: KeyboardMouse | null = null;
afterEach(() => {
  kbm?.dispose();
  kbm = null;
});

const press = (key: string, code: string, down = true): void => {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, code, bubbles: true }));
};

describe('Sigilfall: the keyboard', () => {
  it('walks with WASD on a Cyrillic layout, and stops when a key is let go after the layout changed', () => {
    kbm = new KeyboardMouse(document.body);
    // the Bulgarian phonetic layout types в, а, с, д where WASD sit
    press('в', 'KeyW');
    expect(kbm.move()).toEqual({ x: 0, y: -1 });
    press('д', 'KeyD');
    const m = kbm.move();
    expect(m.x).toBeCloseTo(Math.SQRT1_2);
    expect(m.y).toBeCloseTo(-Math.SQRT1_2);
    // switched back to English while holding: the same keys are let go
    press('w', 'KeyW', false);
    press('d', 'KeyD', false);
    expect(kbm.move()).toEqual({ x: 0, y: 0 });
  });

  it('walks with the arrows, and by letter on a keyboard that gives no key position', () => {
    kbm = new KeyboardMouse(document.body);
    press('ArrowLeft', 'ArrowLeft');
    expect(kbm.move()).toEqual({ x: -1, y: 0 });
    press('ArrowLeft', 'ArrowLeft', false);
    press('s', '');
    expect(kbm.move()).toEqual({ x: 0, y: 1 });
  });
});
