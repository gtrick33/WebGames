import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import { activeQuests, HOME, newCharacter, questState } from '../src/games/sigilfall/progress/character';
import { TILE } from '../src/games/sigilfall/sim/map';
import { objectiveTarget } from '../src/games/sigilfall/sim/objective';
import type { World } from '../src/games/sigilfall/sim/world';
import { beat, enter, type Walk } from './sigilfall-walk';

/** The walk itself (the hero going where the quest arrow points) is in tests/sigilfall-walk.ts. */

describe('Sigilfall: the whole campaign, by the quest arrow', () => {
  it('a new hero plays from the first night to the bell and every side road, never left without a way on', () => {
    const hero = newCharacter('warrior', 'Walker', 'walker', 0);
    const walk: Walk = { hero, w: null as unknown as World, lost: [], barred: [], travels: 0, trail: [], blank: 0, deadEnds: [] };
    enter(walk, HOME);
    let beats = 0;
    while (beat(walk) && beats < 400000 && walk.travels < 3000) beats++;
    const open = QUESTS.filter((q) => questState(hero, q.id) !== 'done').map((q) => `${q.id}:${questState(hero, q.id)}`);
    // where it stopped, for the report: the land, what the arrow says, the fight under way
    const fw = walk.w;
    const at = (x: number, y: number): string => `${Math.round(x / TILE)},${Math.round(y / TILE)}`;
    const state = {
      region: fw.region.id,
      at: at(fw.player.x, fw.player.y),
      target: objectiveTarget(fw),
      active: activeQuests(hero).map((q) => q.id),
      event: fw.story.run && { id: fw.story.run.def.id, wave: fw.story.run.wave, foes: fw.story.run.ids.map((id) => fw.enemies.find((x) => x.id === id && !x.dead)).filter((e) => !!e).map((e) => `${e.def.id}@${at(e.x, e.y)}`) },
      rooms: fw.encounters.filter((e) => e.state === 'active').map((e) => `${e.index}: wave ${e.wave}, ${fw.enemies.filter((x) => !x.dead && x.room === e.index).map((x) => `${x.def.id}@${at(x.x, x.y)}`).join(' ')}`),
    };
    const ready = QUESTS.filter((q) => questState(hero, q.id) === 'locked' && (q.after ?? []).every((a) => questState(hero, a) === 'done')).map((q) => `${q.id}: ${q.zone && !hero.unlocked.includes(q.zone) ? `zone ${q.zone} unvisited` : ''}${q.level && hero.level < q.level ? ` level ${q.level}` : ''}`);
    const msg = JSON.stringify({ lost: walk.lost, deadEnds: walk.deadEnds, state, trail: walk.trail, beats, travels: walk.travels, level: hero.level, ready: ready.slice(0, 20), open: open.slice(0, 40), openCount: open.length }, null, 1);
    expect(walk.lost, msg).toEqual([]);
    expect(walk.deadEnds, msg).toEqual([]);
    expect(open, msg).toEqual([]);
  }, 300_000);
});
