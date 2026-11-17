/**
 * The HUD writes to the page from the frame loop (ui/hudWrite.ts). Setting an element's words takes the old text away
 * and puts new text in even when the words are the same, and the browser lays that part of the page out and paints
 * it again: standing still, the HUD did that in seven places every frame (nine in a Rift). Held to here: the same
 * words, the same flag or a change too small to see is no change to the page at all.
 */
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hide, part, say } from '../src/games/sigilfall/ui/hudWrite';

/** How many times the page under `el` was changed while `run` ran. */
async function changes(el: Element, run: () => void): Promise<number> {
  let n = 0;
  const mo = new MutationObserver((list) => {
    n += list.length;
  });
  mo.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
  run();
  await Promise.resolve();
  n += mo.takeRecords().length;
  mo.disconnect();
  return n;
}

describe('the HUD writes only what has changed', () => {
  it('the same words written again change nothing', async () => {
    const el = document.createElement('b');
    say(el, '0:00 / 4:00');
    expect(el.textContent).toBe('0:00 / 4:00');
    expect(await changes(el, () => { for (let i = 0; i < 600; i++) say(el, '0:00 / 4:00'); })).toBe(0);
    expect(await changes(el, () => say(el, '0:01 / 4:00'))).toBeGreaterThan(0);
    expect(el.textContent).toBe('0:01 / 4:00');
  });

  it('nothing written to nothing changes nothing, and words are cleared', async () => {
    const el = document.createElement('span');
    expect(await changes(el, () => { for (let i = 0; i < 600; i++) say(el, ''); })).toBe(0);
    say(el, '3');
    say(el, '');
    expect(el.textContent).toBe('');
    expect(el.childNodes.length).toBe(0);
  });

  it('writes over whatever else was in the element', () => {
    const el = document.createElement('span');
    el.append(document.createElement('i'), 'old');
    say(el, 'new');
    expect(el.textContent).toBe('new');
    expect(el.childNodes.length).toBe(1);
    // (and a missing element is no error: a part of the HUD not on this screen)
    expect(() => say(null, 'x')).not.toThrow();
    expect(() => hide(null, true)).not.toThrow();
  });

  it('a flag set to what it is changes nothing', async () => {
    const el = document.createElement('div');
    expect(await changes(el, () => { for (let i = 0; i < 600; i++) hide(el, false); })).toBe(0);
    hide(el, true);
    expect(el.hidden).toBe(true);
    expect(await changes(el, () => { for (let i = 0; i < 600; i++) hide(el, true); })).toBe(0);
    hide(el, false);
    expect(el.hidden).toBe(false);
  });

  it('a bar that creeps is given a new size a few hundred times over its whole length', () => {
    // a Rift's four-minute clock at sixty frames a second: 14,400 frames
    const seen = new Set<string>();
    for (let f = 0; f <= 14400; f++) seen.add(part(f / 14400));
    expect(seen.size).toBe(401);
    expect(part(0)).toBe('0%');
    expect(part(1)).toBe('100%');
    expect(part(0.5)).toBe('50%');
    // (never past its ends, whatever it is handed)
    expect(part(-0.2)).toBe('0%');
    expect(part(1.7)).toBe('100%');
    expect(part(NaN)).toBe('0%');
  });

  it('the frame loops write through it', () => {
    for (const file of ['GameScreen', 'Touch', 'DesktopBar', 'VigilScreen']) {
      const src = readFileSync(`src/games/sigilfall/ui/${file}.tsx`, 'utf8');
      expect(src, file).toContain("from './hudWrite'");
      // (no words or flags set straight onto the page any more)
      expect(src, file).not.toMatch(/\.textContent = /);
      expect(src, file).not.toMatch(/\.hidden = /);
    }
  });
});
