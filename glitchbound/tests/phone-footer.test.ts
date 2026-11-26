/**
 * Phones: the room kept below the page for the floating tabs showed the light page color under the dark footer, a pale
 * band at the bottom of every page (the owner, 2026-11-26: "some white line on portrait on my iphone at the bottom when
 * i scroll"). The footer now runs down under the tabs, over that same room.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');

describe('the footer on a phone', () => {
  it('runs to the bottom of the page, over the room kept for the floating tabs', () => {
    const header = read('src/components/Header.css');
    // every body padding kept for the tabs is the one room the footer covers
    const pads = [...header.matchAll(/body(?::has\([^)]*\))? \{\s*([^}]*)\}/g)].map((m) => m[1]!).filter((b) => b.includes('padding-bottom'));
    expect(pads.length).toBe(3);
    for (const b of pads) {
      expect(b).toMatch(/--tabs-room: [^;]+;/);
      expect(b).toContain('padding-bottom: var(--tabs-room);');
    }
    const footer = read('src/components/Footer.css');
    const rule = footer.slice(footer.indexOf('.site-footer {'), footer.indexOf('}', footer.indexOf('.site-footer {')));
    expect(rule).toContain('margin-bottom: calc(-1 * var(--tabs-room, 0px));');
    expect(rule).toContain('padding-bottom: var(--tabs-room, 0px);');
  });
});
