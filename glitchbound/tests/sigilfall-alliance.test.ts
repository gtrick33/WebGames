import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { acceptQuests, declined, questState, startQuests, type Character } from '../src/games/sigilfall/progress/character';
import { migrate } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { holds } from '../src/games/sigilfall/sim/story';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Act III on the simulation (STORY_BIBLE.md §3, "The Broken Alliance"): choices that close the other path,
 * the night at the Tear that is not won, Fernstead lost and taken back.
 */

function heroAt(quest: string, level = 42): Character {
  const c = readyHero('mage', level);
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
/** A hero with everything before a choice done, and the choice not yet made. */
function heroBefore(quest: string): Character {
  const c = heroAt(quest);
  delete c.quests[quest];
  startQuests(c);
  return c;
}

const DT = 1 / 60;
function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) w.step(DT);
}
function goTo(w: World, place: string): void {
  const at = w.places[place] ?? w.spots.find((s) => s.id === place)!;
  w.player.x = at.x;
  w.player.y = at.y + 8;
}
function smite(w: World, keep: string[] = []): void {
  for (const e of w.enemies) if (!e.dead && e.state !== 'spawn' && !keep.includes(e.def.id)) hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
}

describe('Sigilfall: the broken alliance (Act III)', () => {
  it('Thistlemourn: both answers are offered; taking one closes the other, and the clans decide either way', () => {
    const c = heroBefore('silvaines-song');
    expect(questState(c, 'silvaines-song')).toBe('offered');
    expect(questState(c, 'the-thorn-court')).toBe('offered');
    acceptQuests(c, 'lady-silvaine');
    expect(questState(c, 'silvaines-song')).toBe('active');
    expect(declined(c, 'the-thorn-court')).toBe(true);
    // Old Root has nothing to offer now
    expect(acceptQuests(c, 'old-root').some((q) => q.id === 'the-thorn-court')).toBe(false);
    // the song: hold the knights off Silvaine
    const w = newWorld('glimmerwood', c);
    goTo(w, 'thorn-hall');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('thorn-song');
    for (let i = 0; i < 40 && questState(w.hero, 'silvaines-song') === 'active'; i++) {
      run(w, 2.5);
      smite(w);
    }
    expect(holds(w.hero, { quest: 'silvaines-song', is: 'taken' })).toBe(true);
    expect(questState(w.hero, 'the-clans-decide')).toBe('active');
    run(w, 0.6);
    expect(w.npcs.some((n) => n.id === 'thistlemourn')).toBe(true);
    // the other answer: no prince in the glade
    const k = heroBefore('the-thorn-court');
    acceptQuests(k, 'old-root');
    expect(declined(k, 'silvaines-song')).toBe(true);
    expect(newWorld('glimmerwood', k).npcs.some((n) => n.id === 'thistlemourn')).toBe(false);
  });

  it('the Tear: a fight that is not won; Nyx walks into the grey, the Herald takes Elyra, and Fernstead falls', () => {
    const w = newWorld('shattered-vale', heroAt('the-heralds-ambush'));
    goTo(w, 'tear-top');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('herald-ambush');
    expect(w.pets.some((p) => p.def.id === 'nyx' && !p.dead)).toBe(true);
    let nyxLeft = false;
    let heraldCame = false;
    // (its clock stops while the sigil is pulled and the Herald is shown stepping out of the grey)
    for (let i = 0; i < 140 && questState(w.hero, 'the-heralds-ambush') === 'active'; i++) {
      run(w, 1);
      if (!w.pets.some((p) => p.def.id === 'nyx' && !p.dead)) nyxLeft = true;
      if (w.enemies.some((e) => e.def.id === 'the-pale-herald' && !e.dead)) heraldCame = true;
      // the hero holds, but the Herald does not fall (nor what the Tear makes next: that is the next quest's to kill)
      w.player.hp = w.player.maxHp;
      smite(w, ['the-pale-herald', 'the-tearborn']);
    }
    expect(nyxLeft).toBe(true);
    expect(heraldCame).toBe(true);
    expect(questState(w.hero, 'the-heralds-ambush')).toBe('done');
    // Elyra is gone at once; the others stay to say their piece
    expect(w.pets.some((p) => p.def.id === 'elyra' && !p.dead)).toBe(false);
    // the Tear still bleeds: the hero closes its heart before the news from the hills reaches them
    expect(questState(w.hero, 'the-heart-of-the-tear')).toBe('active');
    expect(questState(w.hero, 'fall-of-fernstead')).toBe('locked');
    // Fernstead: burning, the Host in the square, its people in Briarhollow
    const after = heroAt('fall-of-fernstead');
    after.quests['the-heralds-ambush'] = { state: 'done', n: 1 };
    const fern = newWorld('brackenridge', after);
    expect(fern.storyState?.id).toBe('fernstead-fallen');
    expect(fern.npcs.some((n) => n.id === 'warden-hollis')).toBe(false);
    const square = fern.places['fern-square']!;
    expect(fern.enemies.some((e) => !e.dead && Math.hypot(e.x - square.x, e.y - square.y) < 8 * 16)).toBe(true);
    after.quests['fall-of-fernstead'] = { state: 'done', n: 1 };
    const camp = newWorld('briarhollow', after);
    expect(camp.npcs.some((n) => n.id === 'warden-hollis')).toBe(true);
    expect(camp.npcs.some((n) => n.id === 'elyra')).toBe(false);
    expect(newWorld('emberwick', after).npcs.some((n) => n.id === 'nyx')).toBe(false);
  });

  it('Fernstead taken back with Mara: the fires go out and its people go home', () => {
    const c = heroAt('fern-retaken');
    const w = newWorld('brackenridge', c);
    goTo(w, 'fern-square');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('fern-retake');
    expect(w.pets.some((p) => p.def.id === 'mara')).toBe(true);
    for (let i = 0; i < 40 && questState(w.hero, 'fern-retaken') === 'active'; i++) {
      run(w, 2.5);
      smite(w);
    }
    expect(questState(w.hero, 'fern-retaken')).toBe('done');
    run(w, 0.6);
    expect(w.storyState).toBeNull();
    expect(w.npcs.some((n) => n.id === 'warden-hollis')).toBe(true);
    expect(newWorld('briarhollow', c).npcs.some((n) => n.id === 'warden-hollis')).toBe(false);
  });

  it('Highwall: Mara commands the relief and Cael’s sortie brings the relief camp its white rag', () => {
    const w = newWorld('highwall', heroAt('cael-the-sortie', 44));
    expect(w.npcs.some((n) => n.id === 'captain-mara')).toBe(true);
    goTo(w, 'sortie-ground');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('highwall-sortie');
    expect(w.pets.some((p) => p.def.id === 'cael')).toBe(true);
    for (let i = 0; i < 40 && questState(w.hero, 'cael-the-sortie') === 'active'; i++) {
      run(w, 2.5);
      smite(w);
    }
    expect(questState(w.hero, 'cael-the-sortie')).toBe('done');
    // Nyx walks into the camp next, with the Herald's prison map; the Breach waits for her
    expect(questState(w.hero, 'gate-nyx-returns')).not.toBe('locked');
    expect(questState(w.hero, 'the-breach')).toBe('locked');
  });

  it('an old save that already ended the prince keeps that answer, and has met the Herald if past the Tear', () => {
    const save = migrate({ v: 5, heroes: [{ cls: 'mage', level: 41, quests: { 'the-thorn-court': { state: 'done', n: 1 }, 'the-heart-of-the-tear': { state: 'active', n: 0 } }, unlocked: ['glimmerwood', 'shattered-vale'] }], last: 0 })!;
    const h = save.heroes[0] as Character;
    expect(declined(h, 'silvaines-song')).toBe(true);
    expect(questState(h, 'the-heralds-ambush')).toBe('done');
  });
});
