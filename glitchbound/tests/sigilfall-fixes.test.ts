import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { newCharacter, type Character } from '../src/games/sigilfall/progress/character';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { npcRegion } from '../src/games/sigilfall/sim/routes';
import { TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const steps = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

/** A warrior in the Crypt Gate's boss room with Warden Ossric down to his last point of health. */
function atOssric() {
  const c = readyHero('warrior', 8, 'uncommon');
  c.unlocked.push('crypt');
  const w = newWorld('crypt', c, 3);
  const enc = w.encounters.findIndex((e) => e.def.boss === 'ossric');
  const tiles = w.map.roomTiles[enc]!.filter((i) => !w.map.solid[i]);
  const t = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((t % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(t / w.map.w) + 0.5) * TILE;
  steps(w, 30);
  const boss = w.boss()!;
  for (let i = 0; i < 200 && (boss.state === 'spawn' || boss.boss!.shift > 0); i++) steps(w, 1);
  boss.hp = 1;
  return { c, w, boss, enc };
}

/** A hero with these quests (and everything before them) done, and these in the given states. */
function storyHero(done: string[], now: Record<string, Character['quests'][string]['state']> = {}): Character {
  const c = newCharacter('warrior', 'Story', 'hero0', 0);
  const mark = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) mark(a);
  };
  done.forEach(mark);
  for (const [id, state] of Object.entries(now)) {
    for (const a of QUEST_DEFS[id]?.after ?? []) mark(a);
    c.quests[id] = { state, n: state === 'ready' ? 1e6 : 0 };
  }
  return c;
}

describe('Sigilfall systems fixes', () => {
  it('SFS-04: Mara can still be reported to after the Gloam Gate', () => {
    const h = storyHero(['the-gloam-gate'], { 'mara-commands': 'active' });
    expect(npcRegion('captain-mara', h)).toBe('highwall');
    // and once reported to, she has gone on with the story
    h.quests['mara-commands'] = { state: 'done', n: 1 };
    expect(npcRegion('captain-mara', h)).toBeUndefined();
  });

  it('SFS-05: the quest arrow follows people the story moves', () => {
    // Fernstead lost: from the Herald's ambush the villagers stand in Briarhollow, never nowhere
    const ambush = storyHero(['the-heralds-ambush'], { 'lights-on-the-ridge': 'ready' });
    expect(QUEST_DEFS['fall-of-fernstead'] && ambush.quests['fall-of-fernstead']?.state).not.toBe('done');
    for (const npc of ['warden-hollis', 'mother-alsa', 'pip-tanner']) expect(npcRegion(npc, ambush)).toBe('briarhollow');
    // before it, they are at home in Brackenridge
    expect(npcRegion('warden-hollis', storyHero([], { 'lights-on-the-ridge': 'ready' }))).toBe('brackenridge');
    // Brother Orren goes to Emberwick after Sir Corvane
    expect(npcRegion('brother-orren', storyHero(['sir-corvane'], { 'orren-the-last-chapel': 'active' }))).toBe('emberwick');
    expect(npcRegion('brother-orren', storyHero([], { 'orren-the-last-chapel': 'active' }))).toBe('ashen-barrows');
  });

  it('SFS-03: a burn does not kill the hero during a boss death throes, and the kill counts', { timeout: 30_000 }, () => {
    const { c, w, boss } = atOssric();
    w.player.hp = 30;
    w.player.iframe = 0;
    w.player.statuses.push({ id: 'burn', t: 3, power: 40, tick: 0.5 });
    hitEnemy(w, boss, 50, 'physical', { depth: 0 });
    steps(w, 240);
    expect(w.player.dead).toBe(false);
    expect(c.bosses.ossric).toBe(1);
  });

  it('SFS-03: a hero who falls during the throes still has the kill after Rise again', { timeout: 30_000 }, () => {
    const { c, w, boss, enc } = atOssric();
    hitEnemy(w, boss, 50, 'physical', { depth: 0 });
    steps(w, 10);
    expect(boss.boss!.dying).toBeGreaterThan(0);
    w.playerDies();
    w.respawn();
    expect(c.bosses.ossric).toBe(1);
    expect(w.encounters[enc]!.state).not.toBe('active');
  });
});
