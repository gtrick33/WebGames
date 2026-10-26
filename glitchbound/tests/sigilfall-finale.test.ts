import { describe, expect, it } from 'vitest';
import { MOUNT_DEFS } from '../src/games/sigilfall/data/mounts';
import { QUESTS, QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { acceptQuests, declined, questState, startQuests, type Character } from '../src/games/sigilfall/progress/character';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { holds } from '../src/games/sigilfall/sim/story';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Act VI, Crownfall, the Epilogue and the postgame in the world (STORY_BIBLE.md §3): the factions the hero
 * helped come to the Last March and the others don't, the siege mages and the breach, the champions the Crown
 * kept, the seven locks, the tear into the Crown's memory, Elyra's choice and what it changes, the camp going
 * home, Haldor's bell, and the postgame's criteria and threads.
 */

function heroAt(quest: string, level = 58, extra: string[] = []): Character {
  const c = readyHero('warrior', level);
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of QUEST_DEFS[quest]!.after ?? []) done(a);
  for (const e of extra) done(e);
  c.quests[quest] = { state: 'active', n: 0 };
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}

const DT = 1 / 60;
function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    w.input = emptyInput();
    w.step(DT);
  }
}
function goTo(w: World, place: string): void {
  const at = w.places[place] ?? w.spots.find((s) => s.id === place) ?? w.npcs.find((n) => n.id === place)!;
  w.player.x = at.x;
  w.player.y = at.y + 8;
}
function smite(w: World): void {
  for (const e of w.enemies) if (!e.dead && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
}
function beat(w: World, quest: string, rounds = 40): void {
  for (let i = 0; i < rounds && questState(w.hero, quest) === 'active'; i++) {
    run(w, 2.5);
    w.player.hp = w.player.maxHp;
    smite(w);
  }
}
const npcHere = (w: World, id: string): boolean => w.npcs.some((n) => n.id === id);
const FACTION_PETS = ['fern-ranger', 'hearth-rider', 'kragholt-axe', 'clan-archer', 'thorn-knight', 'jarl-huscarl', 'sun-lancer', 'marsh-skirmisher'];

describe('Sigilfall: the Last March (Act VI)', () => {
  it('only the factions the hero helped come to the field, the forest’s knights only if the prince was sung back', () => {
    const alone = heroAt('march-the-siege-mages');
    for (const id of ['fern-retaken', 'camp-riders', 'camp-dwarves', 'the-clans-decide', 'the-vault-of-rime', 'the-sun-king', 'kesh-the-secret', 'kesh-the-truth', 'silvaines-song', 'the-thorn-court']) delete alone.quests[id];
    const w = newWorld('pale-reach', alone);
    goTo(w, 'wall-field');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('reach-the-mages');
    expect(w.pets.filter((p) => FACTION_PETS.includes(p.def.id))).toHaveLength(0);
    expect(w.pets.some((p) => p.def.id === 'siege-mages')).toBe(true);

    const all = heroAt('march-the-siege-mages', 58, ['fern-retaken', 'camp-riders', 'camp-dwarves', 'the-clans-decide', 'the-vault-of-rime', 'the-sun-king']);
    all.quests['silvaines-song'] = { state: 'done', n: 1 };
    all.quests['the-thorn-court'] = { state: 'done', n: -1 };
    all.quests['kesh-the-secret'] = { state: 'done', n: 1 };
    all.quests['kesh-the-truth'] = { state: 'done', n: -1 };
    const full = newWorld('pale-reach', all);
    goTo(full, 'wall-field');
    run(full, 0.3);
    const came = full.pets.filter((p) => FACTION_PETS.includes(p.def.id)).map((p) => p.def.id);
    expect(came.sort()).toEqual([...FACTION_PETS].sort());
    // bounded: Mara, Cael and one of each faction, never a crowd
    expect(full.pets.filter((p) => !p.def.role || p.def.role === 'fighter').length).toBeLessThanOrEqual(10);
    // the other answer to the prince: no thorn knights
    const other = heroAt('march-the-siege-mages', 58, ['the-clans-decide']);
    other.quests['the-thorn-court'] = { state: 'done', n: 1 };
    other.quests['silvaines-song'] = { state: 'done', n: -1 };
    const ow = newWorld('pale-reach', other);
    goTo(ow, 'wall-field');
    run(ow, 0.3);
    expect(ow.pets.some((p) => p.def.id === 'thorn-knight')).toBe(false);
    expect(ow.pets.some((p) => p.def.id === 'clan-archer')).toBe(true);
  });

  it('the mages bring the wall down, the breach is taken, and the champions the Crown kept wait where they should', () => {
    expect(newWorld('pale-reach', heroAt('march-vosk')).enemies.some((e) => e.def.id === 'vosk-the-hollowed' && !e.dead)).toBe(true);
    const w = newWorld('pale-reach', heroAt('march-the-siege-mages'));
    expect(w.storyState?.id).toBe('host-waits');
    goTo(w, 'wall-field');
    run(w, 0.3);
    beat(w, 'march-the-siege-mages');
    expect(questState(w.hero, 'march-the-siege-mages')).toBe('done');
    expect(questState(w.hero, 'march-the-breach')).toBe('active');
    run(w, 4.5);
    goTo(w, 'wall-breach');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('reach-the-breach');
    beat(w, 'march-the-breach');
    expect(questState(w.hero, 'march-the-voice')).toBe('active');
    const after = newWorld('pale-reach', w.hero);
    expect(after.storyState?.id).toBe('storming');
    expect(after.fires.length).toBeGreaterThanOrEqual(4);
    expect(after.enemies.some((e) => e.def.id === 'the-heralds-voice' && !e.dead)).toBe(true);
  });
});

describe('Sigilfall: Crownfall', () => {
  it('Duskspire’s gate wants all seven sigils, and Vaelor’s fall opens a tear into the Crown’s memory', () => {
    const c = heroAt('the-duskspire-gate', 59);
    const gate = newWorld('pale-reach', c);
    const exit = gate.exits.find((x) => x.to === 'duskspire')!;
    expect(exit).toBeTruthy();
    const lock = (w: World, x: World['exits'][number]): string | null => (w as unknown as { exitLock(e: World['exits'][number]): string | null }).exitLock(x);
    c.perks = c.perks.filter((p) => !p.startsWith('sigil-'));
    expect(lock(gate, exit)).toMatch(/Seven locks/);
    c.perks.push('sigil-embers', 'sigil-tides', 'sigil-stone', 'sigil-sun', 'sigil-frost', 'sigil-thorns', 'sigil-veil');
    expect(lock(gate, exit)).toBeNull();
    expect(gate.exits.some((x) => x.to === 'vaelmoor-remembered')).toBe(false);
    const fallen = newWorld('pale-reach', heroAt('crownfall-vaelmoor', 60));
    expect(fallen.exits.some((x) => x.to === 'vaelmoor-remembered')).toBe(true);
  });

  it('Elyra’s choice: both answers offered, by whom the hero goes to; one closes the other; the Crown comes either way', () => {
    for (const answer of ['crownfall-one-hour', 'crownfall-break-it'] as const) {
      const c = heroAt('crownfall-vaelmoor', 60);
      c.quests['crownfall-vaelmoor'] = { state: 'done', n: 1 };
      startQuests(c);
      expect(questState(c, 'crownfall-one-hour')).toBe('offered');
      expect(questState(c, 'crownfall-break-it')).toBe('offered');
      acceptQuests(c, answer === 'crownfall-one-hour' ? 'vaelor-remembered' : 'elyra-in-the-memory');
      const other = answer === 'crownfall-one-hour' ? 'crownfall-break-it' : 'crownfall-one-hour';
      expect(questState(c, answer)).toBe('active');
      expect(declined(c, other)).toBe(true);
      c.quests[answer] = { state: 'done', n: 1 };
      startQuests(c);
      expect(questState(c, 'crownfall-the-ash-crown')).not.toBe('locked');
      const memory = newWorld('vaelmoor-remembered', c);
      // the King stays for his hour, and is gone if the Crown was broken at once
      expect(npcHere(memory, 'vaelor-remembered')).toBe(answer === 'crownfall-one-hour');
      // and the Epilogue shows it: four names on a stone by the chapel, for the hour
      c.quests['crownfall-the-ash-crown'] = { state: 'done', n: 1 };
      c.quests['epilogue-the-camp-goes-home'] = { state: 'done', n: 1 };
      const home = newWorld('briarhollow', c);
      expect(home.props.some((p) => p.prop === 'standing-stone')).toBe(answer === 'crownfall-one-hour');
      expect(holds(c, { quest: answer, is: 'taken' })).toBe(true);
    }
  });
});

describe('Sigilfall: the Epilogue and the postgame', () => {
  it('the camp goes home down the south road, and Briarhollow is a village again', () => {
    const w = newWorld('briarhollow', heroAt('epilogue-the-camp-goes-home', 60, ['camp-scouts', 'camp-grain', 'camp-healers', 'camp-smiths', 'camp-riders', 'camp-dwarves']));
    expect(npcHere(w, 'ranger-cole')).toBe(true);
    expect(w.props.filter((p) => p.prop === 'tent').length).toBeGreaterThan(0);
    goTo(w, 'briar-square');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('epilogue-the-camp');
    run(w, 80);
    expect(questState(w.hero, 'epilogue-the-camp-goes-home')).toBe('done');
    const home = newWorld('briarhollow', w.hero);
    expect(home.storyState?.id).toBe('rebuilt');
    for (const id of ['ranger-cole', 'carter-wenna', 'healer-brisa', 'forgewife-runa', 'rider-alder', 'dwarf-tova']) expect(npcHere(home, id), id).toBe(false);
    expect(home.props.filter((p) => p.prop === 'tent')).toHaveLength(0);
    expect(home.props.filter((p) => p.prop === 'market-cart').length).toBeGreaterThanOrEqual(2);
    expect(npcHere(home, 'elyra')).toBe(true);
  });

  it('Haldor rings the bell: the scene plays it', () => {
    const def = SCENES.find((s) => s.id === 'briar-the-bell')!;
    expect(def.steps.filter((s) => 'sfx' in s && s.sfx === 'bell').length).toBeGreaterThanOrEqual(1);
    const w = newWorld('briarhollow', heroAt('epilogue-the-bell', 60));
    w.enemies = [];
    goTo(w, 'old-haldor');
    w.player.y += 12;
    const heard: string[] = [];
    const sfx = w.sfx.bind(w);
    w.sfx = (id: string, vol?: number): void => {
      heard.push(id);
      sfx(id, vol);
    };
    run(w, 4);
    expect(w.scene?.def.id).toBe('briar-the-bell');
    run(w, 40);
    expect(heard.filter((id) => id === 'bell').length).toBeGreaterThanOrEqual(3);
  });

  it('after the bell: Heroic and Mythic open, the threads are offered, the stair and the Tear give up their secrets', () => {
    const c = heroAt('epilogue-the-bell', 60);
    c.quests['epilogue-the-bell'] = { state: 'done', n: 1 };
    c.tier = Math.max(c.tier, QUEST_DEFS['epilogue-the-bell']!.reward.tier ?? 0);
    startQuests(c);
    expect(c.tier).toBe(2);
    for (const id of ['postgame-crownfall-heroic', 'thread-wren', 'thread-the-chancellor', 'thread-under-the-tear']) expect(questState(c, id), id).not.toBe('locked');
    expect(newWorld('emberwick', c).exits.some((x) => x.to === 'crown-catacombs')).toBe(true);
    expect(newWorld('shattered-vale', c).enemies.some((e) => e.def.id === 'the-heralds-first-face' && !e.dead)).toBe(true);
    // the prestige mount has explicit, deterministic criteria
    expect(MOUNT_DEFS['crownfall-destrier']!.source).toEqual({ kind: 'clears', regions: ['duskspire', 'vaelmoor-remembered'], tier: 1 });
    expect(MOUNT_DEFS['crownfall-destrier']!.tier).toBe('prestige');
  });

  it('every quest from the Last March to the threads opens in turn: no loops, nothing out of reach', () => {
    const done = new Set<string>();
    for (let changed = true; changed; ) {
      changed = false;
      for (const q of QUESTS) {
        if (done.has(q.id) || !(q.after ?? []).every((a) => done.has(a))) continue;
        done.add(q.id);
        changed = true;
      }
    }
    const late = QUESTS.filter((q) => ['pale-reach', 'vaelmoor-remembered'].includes(q.zone ?? '') || q.id.startsWith('epilogue-') || q.id.startsWith('postgame-') || q.id.startsWith('thread-'));
    expect(late.length).toBeGreaterThan(25);
    expect(late.filter((q) => !done.has(q.id)).map((q) => q.id)).toEqual([]);
  });
});
