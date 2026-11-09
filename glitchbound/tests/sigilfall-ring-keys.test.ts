/** The Ring's keys: every action has one, and setting a key never leaves it doing two things. */
import { describe, expect, it } from 'vitest';
import { actionOf, bind, DEFAULT_KEYS, keyName, RING_ACTIONS } from '../src/games/sigilfall/ui/ringKeys';

describe('ring keys', () => {
  it('every action has its own default key', () => {
    const used = RING_ACTIONS.map((a) => DEFAULT_KEYS[a.id]);
    expect(new Set(used).size).toBe(used.length);
    expect(actionOf(DEFAULT_KEYS, 'Tab')).toBe('nextFoe');
  });

  it('a key taken from another action swaps with it', () => {
    const k = bind(DEFAULT_KEYS, 'foe1', 'Digit1');
    expect(k.foe1).toBe('Digit1');
    expect(k.ab1).toBe('KeyZ');
    expect(actionOf(k, 'Digit1')).toBe('foe1');
  });

  it('names keys as they are printed', () => {
    expect(keyName('KeyQ')).toBe('Q');
    expect(keyName('Digit4')).toBe('4');
    expect(keyName('ShiftLeft')).toBe('L Shift');
  });
});
