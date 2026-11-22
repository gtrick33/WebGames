/**
 * A hero comes back where they were (the owner: "players always get spawned in briarhollow ... in case we disconnect or
 * quit and have to log in once again, the character should be in the respective zone"). Where they are is kept on the
 * hero each time they travel (Character.at), and the game begins there: a land, a town, a dungeon at its door.
 */
import { describe, expect, it, vi } from 'vitest';
import { SigilEngine } from '../src/games/sigilfall/engine';
import { HOME, newCharacter, type Character } from '../src/games/sigilfall/progress/character';
import { emptySave, validateCharacter } from '../src/games/sigilfall/progress/save';
import type { RegionId } from '../src/games/sigilfall/data/types';

const hero = (unlocked: RegionId[] = []): Character => {
  const c = newCharacter('warrior', 'Wanderer', 'hero0', 1_800_000_000_000);
  c.level = 12;
  for (const r of unlocked) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
};

/** An engine with a hero in it and nothing on the screen: enough to travel and to begin play. */
function engineWith(h: Character): SigilEngine & Record<string, unknown> {
  const e = Object.create(SigilEngine.prototype) as SigilEngine & Record<string, unknown>;
  const save = emptySave();
  save.heroes[0] = h;
  Object.assign(e, {
    save,
    hero: h,
    slot: 0,
    world: null,
    run: null,
    coop: null,
    party: null,
    invite: null,
    cards: [],
    pages: [],
    tipQueue: [],
    ui: {},
    renderer: { snap: () => undefined },
    sound: { unlock: () => undefined },
    askShelf: () => undefined,
    endRun: () => undefined,
    startRun: () => undefined,
    persist: () => undefined,
    bump: () => undefined,
    queueTip: () => undefined,
    toast: () => undefined,
    ringRating: () => 0,
  });
  return e;
}

describe('where a hero is, kept', () => {
  it('is written each time they travel: the land and the land they came from (no difficulty: Heroic and Mythic are gone)', () => {
    const h = hero(['whisperwood', 'crypt']);
    const e = engineWith(h);
    expect(e.travel('whisperwood', 0, [], HOME)).toBe(true);
    expect(h.at).toEqual({ region: 'whisperwood', from: HOME });
    // (a difficulty asked for is Normal: 2026-11-22)
    expect(e.travel('crypt', 1, [], HOME)).toBe(true);
    expect(h.at).toEqual({ region: 'crypt', from: HOME });
    // home again: nothing to remember (a hero begins there anyway)
    expect(e.travel(HOME, 0, [])).toBe(true);
    expect(h.at).toBeUndefined();
  });

  it('is not written by a way that can’t be taken', () => {
    const h = hero();
    const e = engineWith(h);
    expect(e.travel('whisperwood', 0, [])).toBe(false);
    expect(h.at).toBeUndefined();
  });

  it('survives a save, and anything that isn’t a land the hero knows is dropped', () => {
    const h = hero(['whisperwood']);
    h.at = { region: 'whisperwood', tier: 2, from: HOME };
    expect(validateCharacter(JSON.parse(JSON.stringify(h)), 0)?.at).toEqual({ region: 'whisperwood', tier: 2, from: HOME });
    for (const bad of [{ region: 'nowhere' }, { region: 'thornvale' }, 'whisperwood', null, { tier: 1 }]) {
      const raw = { ...JSON.parse(JSON.stringify(h)), at: bad };
      expect(validateCharacter(raw, 0)?.at, JSON.stringify(bad)).toBeUndefined();
    }
    // (a difficulty that doesn't exist is the plain one; a land that doesn't, no land)
    const odd = validateCharacter({ ...JSON.parse(JSON.stringify(h)), at: { region: 'whisperwood', tier: 99, from: 'nowhere' } }, 0);
    expect(odd?.at).toEqual({ region: 'whisperwood', tier: 2 });
  });
});

describe('beginning to play', () => {
  it('a hero is where they left off', () => {
    const h = hero(['whisperwood']);
    h.at = { region: 'whisperwood', from: HOME };
    const e = engineWith(h);
    e.play(0);
    expect(e.world?.region.id).toBe('whisperwood');
  });

  it('a hero who was in a dungeon is at its door, on Normal (an old save\'s Heroic comes back at Normal)', () => {
    const h = hero(['crypt']);
    h.at = { region: 'crypt', tier: 1 };
    const e = engineWith(h);
    e.play(0);
    expect(e.world?.region.id).toBe('crypt');
    expect(e.world?.tier).toBe(0);
    const start = e.world!.map.markers.find((m) => m.marker.kind === 'start')!;
    expect(Math.hypot(e.world!.player.x / 26 - start.tx, e.world!.player.y / 26 - start.ty)).toBeLessThan(4);
  });

  it('a new hero, and one who was at home, begin in Briarhollow', () => {
    const e = engineWith(hero());
    e.play(0);
    expect(e.world?.region.id).toBe(HOME);
  });

  it('a hero whose land can’t be gone to any more begins in Briarhollow, not nowhere', () => {
    const h = hero();
    // (as a save from before a land was closed would have it: the way there is not known now)
    h.at = { region: 'whisperwood' };
    const e = engineWith(h);
    const travel = vi.spyOn(e, 'travel');
    e.play(0);
    expect(e.world?.region.id).toBe(HOME);
    expect(travel).toHaveBeenCalledTimes(2);
  });
});
