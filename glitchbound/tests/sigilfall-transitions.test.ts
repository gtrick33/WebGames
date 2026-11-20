/**
 * Between places (POLISH_PLAN.md piece 13): a way taken goes dark for a moment and the next place comes up out of the
 * dark, where it was a cut; and hero creation's Begin bar is solid, where the skills scrolling under it showed through.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// (the engine and the renderer can't be made in a test without a page: what they do is held by their text, and seen in
// the browser)
const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
const renderer = readFileSync('src/games/sigilfall/render/renderer.ts', 'utf8');
const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');

describe('Sigilfall: from one place to the next', () => {
  it('a door and a road out of a land go dark first, then the next place is made', () => {
    expect(engine).toContain('this.leave(() => this.travel(it.to as RegionId, tier, mods, from));');
    expect(engine).toContain('this.leave(() => this.travel(t.to, tier, mods, from));');
    // (made at the start of a frame, so the frame that makes it draws it: no glimpse of the old place)
    const frame = engine.slice(engine.indexOf('private frame(now: number): void {'));
    expect(frame.indexOf('if (this.leaving) {')).toBeLessThan(frame.indexOf('const w = this.world;'));
    // nothing more is taken up on the way out, and a party (one pace for all) and less motion go at once
    expect(engine).toMatch(/interact\(it: Interactable\): void \{\n\s+\/\/ \(on the way out already: nothing more is taken up\)\n\s+if \(this\.leaving\) return;/);
    expect(engine).toMatch(/if \(this\.coop \|\| this\.renderer\.reducedMotion\) \{\n\s+go\(\);/);
  });

  it('every new place comes up out of the dark, not only one whose models had to load', () => {
    expect(renderer).toMatch(/if \(fresh\) \{\n\s+\/\/ \(every new place comes up out of the dark[^\n]*\n\s+this\.heldTill = time;/);
    expect(renderer).toContain('const veil = Math.max(1 - clamp((time - this.heldTill) / ARRIVE, 0, 1), clamp(this.leaving, 0, 1));');
  });

  it('hero creation’s Begin bar is solid where its words are, at both heights', () => {
    const bars = [...css.matchAll(/\.rb-create-go \{([^}]*)\}/g)].map((m) => m[1]!).filter((b) => b.includes('position: sticky'));
    expect(bars.length).toBeGreaterThanOrEqual(1);
    for (const b of bars) {
      expect(b).toMatch(/background: rgb\(34 26 20\);/);
      expect(b).not.toMatch(/linear-gradient\((transparent|rgb\(13 8 32 \/ 0\))/);
    }
  });
});
