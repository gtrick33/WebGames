/**
 * "Into the Whisperwood" asks for enough of the wood to be worth walking (the owner: "i dont have an intentive of
 * clearing more than 2 camps"): eighteen beasts, five or six camps, in a land that has three times that standing.
 */
import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import { newWorld, readyHero } from './sigilfall-bot';

describe('the hunt in the Whisperwood', () => {
  it('asks for more than two camps, and the wood has plenty', () => {
    const q = QUESTS.find((x) => x.id === 'into-the-wood')!;
    const o = q.objective as { kind: string; count: number };
    expect(o.kind).toBe('kill');
    expect(o.count).toBe(18);
    const w = newWorld('whisperwood', readyHero('warrior', 3));
    const camps = w.packs.map((p) => p.enemies.length).sort((a, b) => b - a);
    // (the two biggest camps don't finish it; the land holds well over twice what is asked)
    expect(camps[0]! + camps[1]!).toBeLessThan(o.count);
    expect(camps.reduce((a, b) => a + b, 0)).toBeGreaterThan(o.count * 2);
  });
});
