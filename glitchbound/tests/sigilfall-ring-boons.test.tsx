/**
 * The Ring's combos on the player's own screen (ui/RingBoons.tsx), after the owner's note of 2026-11-16: "instant procs
 * should have similar to wows fingers of frost screen visuals, make them unique for each class". Light at the edges of
 * the screen while a boon waits to be used, in its class's own manner; the boons carried as small chips; the points
 * held as pips over the bar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BOONS, type BoonLook } from '../src/games/sigilfall/arena/abilities';
import { BoonChips, BoonFlares, Pips } from '../src/games/sigilfall/ui/RingBoons';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');
const on = (id: string, n = 1, t = 5) => ({ id, n, t });

describe('The Ring: light at the edges of the screen while a boon waits', () => {
  it('nothing without one; both sides for a boon held once; the left, then the right too, for one that can be held twice', () => {
    expect(render(<BoonFlares boons={[]} />).container.querySelector('.rb-ring-flares')).toBeNull();
    // (Red Mist is held once: both sides at once)
    const mist = render(<BoonFlares boons={[on('mist')]} />).container;
    expect(mist.querySelectorAll('.rb-ring-flare')).toHaveLength(2);
    expect(mist.querySelectorAll('.rb-ring-flare.is-right')).toHaveLength(1);
    // (Hoarfrost twice: one side for the first, the other for the second, as the old arenas show a charge)
    expect(BOONS.hoar!.max).toBe(2);
    const one = render(<BoonFlares boons={[on('hoar', 1)]} />).container;
    expect(one.querySelectorAll('.rb-ring-flare')).toHaveLength(1);
    expect(one.querySelector('.rb-ring-flare.is-right')).toBeNull();
    const two = render(<BoonFlares boons={[on('hoar', 2)]} />).container;
    expect(two.querySelectorAll('.rb-ring-flare')).toHaveLength(2);
    expect(two.querySelectorAll('.rb-ring-flare.is-right')).toHaveLength(1);
    // in its own color, and seen through, never caught by a click
    const flare = one.querySelector<SVGElement>('.rb-ring-flare')!;
    expect(flare.getAttribute('class')).toContain('is-ice');
    expect(flare.style.color).toBeTruthy();
    expect(one.querySelector('.rb-ring-flares')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('a spell’s own quiet while (the Rime’s globe) lights nothing: it is a chip, and the lit button', () => {
    expect(BOONS.globe!.quiet).toBe(true);
    expect(render(<BoonFlares boons={[on('globe')]} />).container.querySelector('.rb-ring-flare')).toBeNull();
    const chips = render(<BoonChips boons={[on('globe'), on('hoar', 2)]} />).container;
    expect([...chips.querySelectorAll('.rb-ring-boon b')].map((b) => b.textContent)).toEqual(['Rimeglobe', 'Hoarfrost ×2']);
    expect(chips.querySelector('.rb-ring-boon.is-quiet b')!.textContent).toBe('Rimeglobe');
    expect(chips.querySelector('.rb-ring-boon')!.getAttribute('title')).toContain(BOONS.globe!.text);
    expect(render(<BoonChips boons={[]} />).container.firstChild).toBeNull();
  });

  it('every manner has a shape of its own, and every boon one that draws', () => {
    const shapes = new Map<BoonLook, string>();
    for (const b of Object.values(BOONS)) {
      const { container } = render(<BoonFlares boons={[on(b.id)]} />);
      if (b.quiet) continue;
      const svg = container.querySelector('.rb-ring-flare')!;
      expect(svg, b.id).not.toBeNull();
      expect(svg.querySelectorAll('path, ellipse').length, b.id).toBeGreaterThanOrEqual(2);
      const drawn = svg.innerHTML;
      // (two boons of one manner are drawn alike; two manners never are)
      if (shapes.has(b.look)) expect(shapes.get(b.look), b.id).toBe(drawn);
      else {
        for (const [look, other] of shapes) expect(other === drawn, `${b.look} and ${look}`).toBe(false);
        shapes.set(b.look, drawn);
      }
    }
    expect(shapes.size).toBeGreaterThanOrEqual(10);
  });

  it('it breathes, and stands still for whoever asked for less motion', () => {
    const css = read('src/games/sigilfall/Game.css');
    expect(css).toMatch(/\.rb-ring-flare \{[^}]*animation: rb-ring-flare-in[^}]*rb-ring-flare 1\.1s ease-in-out[^}]*infinite;/);
    expect(css).toMatch(/\.rb-ring-flare \{[^}]*pointer-events|\.rb-ring-flares \{[^}]*pointer-events: none;/);
    expect(css).toMatch(/\.rb-ring\.is-still \.rb-ring-flare \{\s*animation: none;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.rb-ring-flare,/);
    // on the fight's screen: over the ground, for the player's own fighter while they stand
    const match = read('src/games/sigilfall/ui/RingMatch.tsx');
    expect(match).toContain("{me && !me.dead && m.phase === 'fight' && <BoonFlares boons={me.boons} />}");
  });
});

describe('The Ring: points as pips over the bar', () => {
  it('one pip for each that can be held, lit for each held, all of them alight when no more can be', () => {
    const nicks = { name: 'Nicks', one: 'Nick', max: 5, color: '#d8c8ff' };
    const some = render(<Pips points={nicks} n={3} />).container;
    expect(some.querySelectorAll('.rb-ring-pips i')).toHaveLength(5);
    expect(some.querySelectorAll('.rb-ring-pips i.is-on')).toHaveLength(3);
    expect(some.querySelector('.rb-ring-pips')!.className).not.toContain('is-full');
    expect(some.querySelector('.rb-ring-pips')!.getAttribute('aria-label')).toBe('3 of 5 Nicks');
    expect(some.querySelector('.rb-ring-pips b')!.textContent).toBe('Nicks');
    const full = render(<Pips points={nicks} n={5} />).container;
    expect(full.querySelector('.rb-ring-pips')!.className).toContain('is-full');
    // over the bar on a desktop, and over the thumb cluster on a phone, clear of the switch-target button
    const match = read('src/games/sigilfall/ui/RingMatch.tsx');
    expect(match.match(/className="rb-ring-combo-strip"/g)).toHaveLength(2);
    const css = read('src/games/sigilfall/Game.css');
    expect(css).toMatch(/\.rb-ring-thumbs \.rb-cluster \.rb-ring-combo-strip \{[^}]*right: 60px;[^}]*bottom: 170px;/);
  });
});
