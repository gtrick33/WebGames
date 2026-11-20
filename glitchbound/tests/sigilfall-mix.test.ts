/**
 * The mix (POLISH_PLAN.md piece 24): the music steps back for the story's words, and a fight brings it forward.
 */
import { describe, expect, it } from 'vitest';
import { DUCK_SHOUT, DUCK_STORY, mixFor } from '../src/games/sigilfall/audio/mix';
import { TILE } from '../src/games/sigilfall/sim/map';
import { newWorld, readyHero } from './sigilfall-bot';

const UI = { dialogue: null, story: null, reward: null };

describe('Sigilfall: the mix', () => {
  it('leaves the music as it is with nothing going on', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 12));
    w.enemies = [];
    w.player.calm = 99;
    expect(mixFor(w, UI)).toEqual({ duck: 1, fight: 0 });
    expect(mixFor(null, UI)).toEqual({ duck: 1, fight: 0 });
  });

  it('steps the music well back for a conversation or a page of the story, and a little for a line said in play', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 12));
    w.enemies = [];
    expect(mixFor(w, { ...UI, dialogue: { npc: 'mara-venn' } }).duck).toBe(DUCK_STORY);
    expect(mixFor(w, { ...UI, story: { kind: 'deed' } }).duck).toBe(DUCK_STORY);
    w.story.speakNow({ who: 'hero', text: 'Behind you!' }, 2);
    expect(mixFor(w, UI).duck).toBe(DUCK_SHOUT);
    expect(DUCK_STORY).toBeLessThan(DUCK_SHOUT);
  });

  it('brings the music forward as foes come at the hero, all the way with three of them or a boss', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 12));
    w.enemies = [];
    w.player.calm = 99;
    const p = w.player;
    const foes = [1, 2, 3].map((i) => w.addEnemy('skeleton', p.x + TILE * (2 + i), p.y, 12, { room: -1, pack: -1 }));
    foes[0]!.state = 'chase';
    const one = mixFor(w, UI).fight;
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(1);
    for (const f of foes) f.state = 'chase';
    expect(mixFor(w, UI).fight).toBe(1);
    // (and the hero striking or struck a moment ago counts too)
    for (const f of foes) f.state = 'idle';
    p.calm = 1;
    expect(mixFor(w, UI).fight).toBeGreaterThan(0);
  });
});
