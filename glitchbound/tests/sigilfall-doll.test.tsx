/**
 * A hero's picture on its spot (ui/Doll.tsx): the Ring's and the Vigil's lobbies and the class cards. Where it stands
 * must not depend on the picture having come in, and it must not show before it has.
 */
import { fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Doll } from '../src/games/sigilfall/ui/Doll';

const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
/** The declarations of a rule, by its selector (the first such rule outside any query). */
const rule = (selector: string): string => {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf('}', at));
};

describe('Sigilfall: a hero’s picture on its spot', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is held back until the picture is in, then steps in', () => {
    const { container } = render(<Doll src="data:image/png;base64,AAAA" className="rb-vlobby-doll" alt="Warrior" />);
    const img = container.querySelector('img')!;
    expect(img.className).toBe('rb-dollpic rb-vlobby-doll');
    expect(img.getAttribute('alt')).toBe('Warrior');
    fireEvent.load(img);
    expect(img.className).toBe('rb-dollpic rb-vlobby-doll is-in');
  });

  it('a picture the browser already holds is in at once, and one that can’t be had isn’t waited for forever', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(480);
    const held = render(<Doll src="data:image/png;base64,AAAA" className="rb-vlobby-doll" />);
    expect(held.container.querySelector('img')!.className).toContain('is-in');
    vi.restoreAllMocks();
    const broken = render(<Doll src="data:image/png;base64,AAAA" className="rb-class-doll" />);
    const img = broken.container.querySelector('img')!;
    expect(img.className).not.toContain('is-in');
    fireEvent.error(img);
    expect(img.className).toContain('is-in');
  });

  it('a change of picture in the same place (another skin, another haircut) never hides it again', () => {
    const { container, rerender } = render(<Doll src="data:image/png;base64,AAAA" className="rb-class-doll" />);
    fireEvent.load(container.querySelector('img')!);
    rerender(<Doll src="data:image/png;base64,BBBB" className="rb-class-doll" />);
    expect(container.querySelector('img')!.className).toContain('is-in');
  });

  it('has its box before its picture: the picture’s own shape, and unseen until it is in', () => {
    const box = rule('.rb-dollpic');
    // (render3d/portrait.ts dollPicture: every such picture is `size` wide and 1.35 times that tall)
    expect(box).toContain('aspect-ratio: 1 / 1.35;');
    expect(readFileSync('src/games/sigilfall/render3d/portrait.ts', 'utf8')).toContain('Math.round(size * 1.35)');
    expect(box).toContain('object-fit: contain;');
    const waiting = rule('.rb-dollpic:not(.is-in)');
    expect(waiting).toContain('visibility: hidden;');
    expect(waiting).toContain('animation: none;');
  });

  it('stands over the middle of its stage by its margins, never by a share of a width it may not have yet', () => {
    for (const selector of ['.rb-vlobby-doll']) {
      const r = rule(selector);
      expect(r, selector).toContain('margin-inline: auto;');
      expect(r, selector).toMatch(/\n {2}left: 0;/);
      expect(r, selector).toMatch(/\n {2}right: 0;/);
      expect(r, selector).not.toContain('translate');
      expect(r, selector).not.toContain('left: 50%');
    }
  });

  it('every screen that stands a hero on a spot uses it', () => {
    for (const [file, cls] of [['RingScreen', 'rb-vlobby-doll'], ['VigilLobby', 'rb-vlobby-doll'], ['Title', 'rb-class-doll']] as const) {
      const text = readFileSync(`src/games/sigilfall/ui/${file}.tsx`, 'utf8');
      expect(text, file).toContain(`<Doll `);
      expect(text, file).toMatch(new RegExp(`<Doll [^>]*className="${cls}"`));
      expect(text, file).not.toMatch(new RegExp(`<img [^>]*className="${cls}"`));
    }
  });

  it('the Ring’s Play page is laid out as the Vigil’s lobby, and keeps its hero on an upright phone', () => {
    const ring = readFileSync('src/games/sigilfall/ui/RingScreen.tsx', 'utf8');
    for (const cls of ['rb-vlobby rb-ringvl', 'rb-vlobby-hero', 'rb-vlobby-classes', 'rb-vlobby-stage', 'rb-vlobby-dais', 'rb-vlobby-kit', 'rb-vlobby-lands', 'rb-vlobby-foot']) expect(ring, cls).toContain(cls);
    // (the old page hid the stand on a phone held upright: the hero was not there at all)
    expect(css).not.toMatch(/\.rb-ringvl \.rb-vlobby-stage \{[^}]*display: none/);
    expect(css).toMatch(/\.rb-ringvl \.rb-vlobby-stage \{\n {4}min-height: clamp\(/);
  });
});
