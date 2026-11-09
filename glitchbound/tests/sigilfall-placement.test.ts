/**
 * Where people stand, in every land and at every story beat (the review presets): no one in a wall, a house or the
 * water, on a way out, or on top of someone else, and no story spot or companion inside something solid.
 */
import { describe, expect, it } from 'vitest';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { K, solidAt, TILE } from '../src/games/sigilfall/sim/map';
import { newWorld, readyHero } from './sigilfall-bot';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
describe('sigilfall: where people stand', () => {
it('no one stands where they can’t, in any land at any beat', { timeout: 300_000 }, () => {
  const out: string[] = [];
  const cases = [...Object.values(REGIONS).map((r) => ({ label: r.id, region: r.id, hero: readyHero('warrior', Math.max(2, r.level)) })), ...PRESETS.map((p) => { const c = readyHero('warrior', p.level); applyPreset(c, p); return { label: p.id, region: p.region, hero: c }; })];
  for (const cs of cases) {
    const r = { id: cs.label };
    let w;
    try {
      w = newWorld(cs.region, cs.hero);
      for (let i = 0; i < 30; i++) w.step(1 / 30);
    } catch (e) {
      out.push(`${r.id}: world failed ${(e as Error).message}`);
      continue;
    }
    const m = w.map;
    const kindAt = (x: number, y: number): number => m.kind[Math.floor(y / TILE) * m.w + Math.floor(x / TILE)]!;
    for (const p of w.pets) if (!p.dead && solidAt(m, p.x, p.y)) out.push(`${r.id}: companion ${p.def.id} in solid`);
    for (const n of w.npcs) {
      const k = kindAt(n.x, n.y);
      if (solidAt(m, n.x, n.y)) out.push(`${r.id}: npc ${n.id} in solid (kind ${k}) at ${Math.round(n.x / TILE)},${Math.round(n.y / TILE)}`);
      else if (k === K.Water) out.push(`${r.id}: npc ${n.id} in water`);
      for (const o of w.npcs) if (o !== n && o.id < n.id && Math.hypot(o.x - n.x, o.y - n.y) < 10) out.push(`${r.id}: npcs ${n.id} and ${o.id} on top of each other`);
      for (const x of w.exits) if (Math.hypot(x.x - n.x, x.y - n.y) < TILE * 1.2) out.push(`${r.id}: npc ${n.id} stands on the way out to ${x.to}`);
    }
    for (const [name, p] of Object.entries(w.places)) {
      if (solidAt(m, p.x, p.y)) out.push(`${r.id}: place ${name} in solid (kind ${kindAt(p.x, p.y)})`);
    }
    if (solidAt(m, w.player.x, w.player.y)) out.push(`${r.id}: hero starts in solid`);
  }
  expect(out).toEqual([]);
});
});
