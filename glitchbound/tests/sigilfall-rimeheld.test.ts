import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { questState, type Character } from '../src/games/sigilfall/progress/character';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Rimeheld's turn played, not told (the five-beat audit, QUEST_REWRITE_MAP.md): the sledge drivers led home
 * from the Sledge Camp through the dead northmen, and Frostgate showing it afterwards.
 */

function heroAt(quest: string, level = 36): Character {
  const c = readyHero('warrior', level);
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of QUEST_DEFS[quest]!.after ?? []) done(a);
  c.quests[quest] = { state: 'active', n: 0 };
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}
const DT = 1 / 60;
const run = (w: World, s: number): void => {
  for (let t = 0; t < s; t += DT) w.step(DT);
};

describe('Sigilfall: Rimeheld, the sledge road', () => {
  it('the drivers follow the hero home through two waves, and Frostgate keeps their sledges', () => {
    const w = newWorld('rimeheld', heroAt('the-last-sledges'));
    const fire = w.places['sledge-fire']!;
    // the camp's own packs first
    for (const e of w.enemies) if (Math.hypot(e.x - fire.x, e.y - fire.y) < 200) e.dead = true;
    w.player.x = fire.x;
    w.player.y = fire.y + 8;
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('rime-sledges');
    expect(w.pets.filter((p) => p.def.id === 'sledge-driver')).toHaveLength(3);
    const home = w.places['frostgate-square']!;
    for (let i = 0; i < 120 && questState(w.hero, 'the-last-sledges') === 'active'; i++) {
      for (const e of w.enemies) if (!e.dead && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
      const dx = home.x - w.player.x;
      const dy = home.y - w.player.y;
      const d = Math.hypot(dx, dy);
      const step = Math.min(d, 50);
      if (d > 4) {
        w.player.x += (dx / d) * step;
        w.player.y += (dy / d) * step;
      }
      for (const f of w.pets) if (f.def.id === 'sledge-driver') Object.assign(f, { x: w.player.x + 6, y: w.player.y + 4 });
      run(w, 0.5);
    }
    expect(questState(w.hero, 'the-last-sledges')).toBe('done');
    expect(questState(w.hero, 'the-giants-hearth')).not.toBe('locked');
    const after = newWorld('rimeheld', w.hero);
    const carts = after.map.markers.filter((m) => m.marker.kind === 'prop' && m.marker.prop === 'cart' && after.isShown(m));
    expect(carts.length).toBe(1);
  });
});
