/**
 * What a cinematic goes out to look at is there to be seen (the owner: "it tried focusing on grimtusk but he wasnt
 * there after you've beaten the quest before that, make sure every time a cinematic focuses, it renders the
 * enemies/boss it focuses on"). A boss only comes when its ground is entered, so the shot that opens the hunt for one
 * showed an empty den. Now a figure of the boss stands there for the shot, and is gone with it.
 */
import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import { TILE } from '../src/games/sigilfall/sim/map';
import { questBeat } from '../src/games/sigilfall/sim/scene';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { emptyInput, World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const hunting = () => {
  const c = readyHero('warrior', 4);
  for (const q of QUESTS) {
    if (q.id === 'alpha') break;
    c.quests[q.id] = { state: 'done', n: 1 };
  }
  c.quests.alpha = { state: 'active', n: 0 };
  return c;
};

describe('a scene shows what it looks at', () => {
  it('the hunt for Grimtusk opens on Grimtusk in his den, though he has not come yet', () => {
    const w = newWorld('whisperwood', hunting());
    expect(w.enemies.some((e) => e.def.id === 'grimtusk')).toBe(false);
    const beat = questBeat(w)!;
    expect(beat).toBeTruthy();
    expect(beat.steps).toContainEqual({ look: 'grimtusk' });
  });

  it('a figure of the boss stands at its mark for the shot: held, no boss bar, and gone when the shot is', () => {
    const w = newWorld('whisperwood', hunting());
    const mark = w.map.markers.find((pm) => pm.marker.kind === 'boss' && pm.marker.boss === 'grimtusk')!;
    const e = w.stageBoss('grimtusk')!;
    expect(e).toBeTruthy();
    expect(Math.hypot(e.x - (mark.tx + 0.5) * TILE, e.y - (mark.ty + 0.5) * TILE)).toBeLessThan(TILE);
    expect([e.held, e.staged, e.aggro]).toEqual([true, true, false]);
    expect(w.boss()).toBeNull();
    // (asked for again, it is the same one: never two)
    expect(w.stageBoss('grimtusk')).toBe(e);
    // it does nothing while it stands
    const at = { x: e.x, y: e.y };
    for (let i = 0; i < 120; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    const still = w.enemies.find((x) => x.staged);
    if (still) expect(Math.hypot(still.x - at.x, still.y - at.y)).toBeLessThan(2);
    w.unstage();
    expect(w.enemies.some((x) => x.def.id === 'grimtusk')).toBe(false);
  });

  it('played through, the scene leaves no figure behind, and the hero’s own fight is not begun by it', () => {
    // (the game plays the story's beats; a bare world, as the other tests make one, doesn't)
    const w = new World({ region: 'whisperwood', tier: 0, mods: [], hero: hunting(), settings: { ...DEFAULT_SETTINGS }, seed: 1, handIns: false, beats: true });
    let staged = false;
    for (let i = 0; i < 60 * 40; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
      if (w.scene && w.enemies.some((e) => e.staged)) staged = true;
      if (staged && !w.scene) break;
    }
    expect(staged).toBe(true);
    expect(w.scene).toBeNull();
    expect(w.enemies.some((e) => e.staged)).toBe(false);
    expect(w.boss()).toBeNull();
    expect(w.hero.bosses.grimtusk).toBeFalsy();
  });

  it('a land with no such boss stands nothing up', () => {
    const w = newWorld('thornvale', readyHero('warrior', 10));
    expect(w.stageBoss('grimtusk')).toBeNull();
  });
});

describe('words over a boss', () => {
  it('said again while they are still up are not laid over themselves; numbers still stack', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 4));
    w.texts.length = 0;
    w.text(100, 100, 'CLANG! Get behind her!', '#fff', false);
    w.text(101, 99, 'CLANG! Get behind her!', '#fff', false);
    expect(w.texts.length).toBe(1);
    // (another thing said, or the same from across the room, is its own line)
    w.text(100, 100, 'Too slow!', '#fff', false);
    w.text(400, 100, 'CLANG! Get behind her!', '#fff', false);
    expect(w.texts.length).toBe(3);
    w.text(100, 100, '42', '#fff', false);
    w.text(100, 100, '42', '#fff', false);
    expect(w.texts.length).toBe(5);
  });
});
