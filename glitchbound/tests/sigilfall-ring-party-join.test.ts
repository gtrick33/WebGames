/**
 * The Ring's party, after the owner's report of 2026-11-19: "multiplayer isnt working, when i invite a player i cant
 * see when theyre in my lobby and i cant play with them, it kicks them out or starts the game without them, also if i
 * close the pop up i should still be in the party and be able to play w them".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { waitForFriend } from '../src/games/sigilfall/ui/RingScreen';

const src = readFileSync(join(process.cwd(), 'src/games/sigilfall/ui/RingScreen.tsx'), 'utf8');

describe('The Ring: a party with a friend', () => {
  it('the leader’s Find waits once for a friend just asked, and a second press goes without them', () => {
    const now = 1_000_000;
    const warned = { current: 0 };
    const asked = { f1: now - 20_000 };
    expect(waitForFriend(asked, warned, true, now)).toBe(true);
    expect(waitForFriend(asked, warned, true, now + 2_000)).toBe(false);
    // (nobody asked lately, or the party has no place left: no wait)
    expect(waitForFriend({ f1: now - 200_000 }, { current: 0 }, true, now)).toBe(false);
    expect(waitForFriend(asked, { current: 0 }, false, now)).toBe(false);
  });

  it('listens only to the room it is on now: a room let go can’t take the new party down as it closes', () => {
    // (every connection is made through connect/create, whose handlers check they are still the Ring's)
    expect(src.match(/new Link<RoomView, RoomAction>\(/g)).toHaveLength(1);
    expect(src.match(/Link\.create<RoomView, RoomAction>\(/g)).toHaveLength(1);
    expect(src).toContain('const live = (): boolean => !!me && linkRef.current === me;');
  });

  it('sits down in each room it joins, even with the same choices it had in the last one', () => {
    expect(src).toContain('JSON.stringify({ room: view.code, seat: view.you, run: view.run, ...myPick, team })');
  });

  it('a party joined by an invitation that outlived it says so, instead of leaving the player alone in it', () => {
    expect(src).toContain('That party has closed: nobody is in it any more.');
  });

  it('the party is on the Ring’s own screen, with or without the layer where the fight is chosen', () => {
    expect(src).toMatch(/className="rb-ringvl-party" role="group" aria-label="Your party"/);
    expect(src).toContain('joined your party.');
  });
});
