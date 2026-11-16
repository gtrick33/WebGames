import { describe, expect, it } from 'vitest';
import { actionLabel, codeMap, defaultBinds, resolveBinds } from '../src/games/sigilfall/input/binds';
import { KeyboardMouse } from '../src/games/sigilfall/input/input';
import { DEFAULT_SETTINGS, validateSettings } from '../src/games/sigilfall/progress/save';
import { emptyInput } from '../src/games/sigilfall/sim/world';

/** Settings › Keys (input/binds.ts): the campaign's actions on keys a player can choose. */
describe('Sigilfall: the campaign’s keys', () => {
  it('starts on the game’s own keys, with the ultimate and the fourth skill where they were chosen', () => {
    const b = defaultBinds('f', 'c');
    expect(actionLabel(b, 's1')).toBe('Q');
    expect(actionLabel(b, 'ult')).toBe('F');
    expect(actionLabel(b, 'interact')).toBe('G');
    // (C was both the fourth skill and the bag: the skill keeps it, as it always did)
    expect(codeMap(b).get('KeyC')).toBe('s4');
    expect(actionLabel(defaultBinds('shift', 'x'), 'ult')).toBe('Shift');
    expect(codeMap(defaultBinds('t', 'c')).get('KeyF')).toBe('interact');
  });

  it('a key a player gives an action is that action’s alone; walking and Escape can’t be taken', () => {
    const b = resolveBinds('f', 'c', { s1: 'Digit2', dodge: 'KeyQ', potion: 'KeyW' });
    const m = codeMap(b);
    expect(m.get('Digit2')).toBe('s1');
    expect(m.get('KeyQ')).toBe('dodge');
    expect(actionLabel(b, 's1')).toBe('2');
    expect(actionLabel(b, 'dodge')).toBe('Q');
    // (W stays for walking)
    expect(m.get('KeyW')).toBeUndefined();
    expect(actionLabel(b, 'potion')).toBe('1');
  });

  it('the keyboard plays by them', () => {
    const el = document.createElement('div');
    const kbm = new KeyboardMouse(el);
    kbm.byCode = codeMap(resolveBinds('f', 'c', { s1: 'Digit2' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q' }));
    const f = emptyInput();
    kbm.fill(f, (x, y) => ({ x, y }), 0, 0);
    expect(f.casts.map((c) => c.slot)).toEqual(['s1']);
    kbm.dispose();
  });

  it('a save keeps only keys it can trust', () => {
    const s = validateSettings({ ...DEFAULT_SETTINGS, keys: { s1: 'Digit2', s2: 'KeyW', nope: 'KeyZ', s3: '<script>' } });
    expect(s.keys).toEqual({ s1: 'Digit2' });
  });
});
