/**
 * A dungeon taken up where it was left (POLISH_PLAN.md piece 3): after a reload the rooms cleared stay clear, the
 * hero stands at the last checkpoint, and the way home stands open if the last boss is down. Before, a reload sent the
 * hero back to the dungeon's door with every room to fight again.
 */
import { describe, expect, it } from 'vitest';
import { storedHero, validateCharacter } from '../src/games/sigilfall/progress/save';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/** Stands the hero on the first open tile of a room. */
function standIn(w: World, room: number): void {
  const i = (w.map.roomTiles[room] ?? []).find((t) => !w.map.solid[t])!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
}

const roomOf = (w: World, id: string) => w.encounters.find((e) => e.def.id === id)!;

describe('Sigilfall: a dungeon taken up where it was left', () => {
  it('keeps the rooms cleared and the last checkpoint, and nobody waits in a cleared room', () => {
    const h = readyHero('warrior', 6);
    if (!h.unlocked.includes('crypt')) h.unlocked.push('crypt');
    const w = newWorld('crypt', h);
    expect(w.dungeonMark()).toEqual({ cp: [Math.round(w.checkpoint.x), Math.round(w.checkpoint.y)] });
    w.mirrorEncounter(roomOf(w, 'hall').index, 'cleared');
    standIn(w, roomOf(w, 'ossuary').index);
    w.mirrorEncounter(roomOf(w, 'ossuary').index, 'cleared');
    const mark = w.dungeonMark()!;
    expect(mark.rooms).toEqual(['hall', 'ossuary']);
    expect(mark.cp).toEqual([Math.round(w.checkpoint.x), Math.round(w.checkpoint.y)]);
    expect(mark.portal).toBeUndefined();

    // a reload: the same dungeon made again, then taken up
    const again = newWorld('crypt', h, 2);
    again.restoreMark(mark);
    expect(again.encounters.filter((e) => e.state === 'cleared').map((e) => e.def.id)).toEqual(['hall', 'ossuary']);
    expect([again.player.x, again.player.y]).toEqual(mark.cp);
    expect([again.checkpoint.x, again.checkpoint.y]).toEqual(mark.cp);
    // walking into the Bone Hall again starts no fight
    const hall = roomOf(again, 'hall');
    standIn(again, hall.index);
    for (let i = 0; i < 120; i++) again.step(1 / 60);
    expect(hall.state).toBe('cleared');
    expect(again.enemies.some((e) => e.room === hall.index && !e.dead)).toBe(false);
    // and the mark it would save is the same one
    expect(again.dungeonMark()!.rooms).toEqual(['hall', 'ossuary']);
  });

  it('opens the way home again if the last boss was down', () => {
    const h = readyHero('warrior', 6);
    if (!h.unlocked.includes('crypt')) h.unlocked.push('crypt');
    const w = newWorld('crypt', h);
    const ids = w.encounters.map((e) => e.def.id);
    standIn(w, roomOf(w, 'sanctum').index);
    const portal: [number, number] = [Math.round(w.player.x), Math.round(w.player.y)];
    w.restoreMark({ rooms: ids, cp: portal, portal });
    expect(w.cleared).toBe(true);
    expect(w.portal).toEqual({ x: portal[0], y: portal[1] });
    expect(w.encounters.every((e) => e.state === 'cleared')).toBe(true);
    expect(w.dungeonMark()!.portal).toEqual(portal);
  });

  it('passes over what the dungeon no longer has, and never stands the hero in a wall', () => {
    const h = readyHero('warrior', 6);
    if (!h.unlocked.includes('crypt')) h.unlocked.push('crypt');
    const w = newWorld('crypt', h);
    const start = { x: w.player.x, y: w.player.y };
    w.restoreMark({ rooms: ['a-room-long-gone'], cp: [1, 1], portal: [2, 2] });
    expect(w.encounters.every((e) => e.state === 'idle')).toBe(true);
    expect({ x: w.player.x, y: w.player.y }).toEqual(start);
    expect(w.portal).toBeNull();
  });

  it('is nothing outside a dungeon', () => {
    const h = readyHero('warrior', 6);
    expect(newWorld('briarhollow', h).dungeonMark()).toBeNull();
  });

  it('is kept in the save, and what isn’t a mark is dropped', () => {
    const h = readyHero('warrior', 6);
    if (!h.unlocked.includes('crypt')) h.unlocked.push('crypt');
    h.at = { region: 'crypt', tier: 1, rooms: ['hall', 'ossuary'], packs: [0, 3], cp: [312, 870], portal: [1200, 400] };
    const back = validateCharacter(JSON.parse(JSON.stringify(storedHero(h))), 0)!;
    expect(back.at).toEqual(h.at);
    const junk = { region: 'crypt', rooms: ['Bad Room!', 7, 'hall'], packs: [-1, 1.5, 4, 4], cp: [1, 2, 3], portal: 'home' };
    const raw = { ...JSON.parse(JSON.stringify(storedHero(h))), at: junk };
    expect(validateCharacter(raw, 0)!.at).toEqual({ region: 'crypt', rooms: ['hall'], packs: [4] });
  });
});
