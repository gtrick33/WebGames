import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, validateSettings } from '../src/games/sigilfall/progress/save';

describe('Sigilfall: health plates over heads', () => {
  const renderer = readFileSync('src/games/sigilfall/render/renderer.ts', 'utf8');

  it('are on unless turned off in Settings, and a save from before them has them on', () => {
    expect(DEFAULT_SETTINGS.plates).toBe(true);
    expect(validateSettings({}).plates).toBe(true);
    expect(validateSettings({ plates: false }).plates).toBe(false);
    expect(readFileSync('src/games/sigilfall/engine.ts', 'utf8')).toContain('this.renderer.plates = s.plates;');
    expect(readFileSync('src/games/sigilfall/ui/Panels.tsx', 'utf8')).toContain('set({ plates: e.target.checked })');
  });

  it('the hero has one: health, and under it the resource they spend, in that resource\'s color', () => {
    expect(renderer).toContain('this.drawHeroPlate(w, st);');
    expect(renderer).toContain('under: { k: p.mana / p.maxMana, tone: PLATE[res.kind] }');
    for (const kind of ['mana', 'rage', 'energy', 'focus', 'holy']) expect(renderer, kind).toMatch(new RegExp(`\\n  ${kind}: \\{ top:`));
  });

  it('every foe has one, struck or not (a boss has its own bar; a dummy and a thing still rising have none)', () => {
    const at = renderer.indexOf('  private drawEnemyBar(e: Enemy, st: Stage): void {');
    const body = renderer.slice(at, renderer.indexOf('\n  }\n', at));
    expect(body).toContain("if (e.dead || e.boss || e.dummy || e.state === 'spawn') {");
    // with the plates on, nothing about being unhurt sends a foe away without one
    const plated = body.slice(body.indexOf('} else {'));
    expect(plated).toContain('this.plate(e.id,');
    // (a thing a boss fight stands up, a coffin, a candle, shows its health only once it is struck)
    expect(body).toContain('if (!this.plates || (thing && e.hp >= e.maxHp && e.shield <= 0)) {');
    expect(plated).not.toContain('return;');
    // with them off, the plain bars are as they were: only on one that is hurt, or is somebody
    expect(body).toContain('if (e.hp >= e.maxHp && !elite && !named && e.shield <= 0) return;');
  });

  it('a scene is a clean picture: no plates over it', () => {
    const at = renderer.indexOf('this.drawHeroPlate(w, st);');
    expect(renderer.lastIndexOf('if (ui && st) {', at)).toBeGreaterThan(renderer.lastIndexOf('const ui = !w.scene && !this.landOnly;', at));
  });
});
