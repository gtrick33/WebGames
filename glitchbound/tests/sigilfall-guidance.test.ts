import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { acceptQuest, currentObjective, handInQuest, handInsFor, newCharacter, offeredBy, questState, startQuests, trackQuest, type Character } from '../src/games/sigilfall/progress/character';
import { turnInNpc } from '../src/games/sigilfall/progress/handin';
import { FOG_CELL, fogSeen, loadFog, revealFog, SEEN_ALL, storeFog } from '../src/games/sigilfall/progress/fog';
import { migrate, SAVE_VERSION, saveText } from '../src/games/sigilfall/progress/save';
import { mergeSaveText } from '../src/platform/cloudMerge';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { parseRegion, TILE } from '../src/games/sigilfall/sim/map';
import { objectiveTarget } from '../src/games/sigilfall/sim/objective';
import { nextRegion } from '../src/games/sigilfall/sim/routes';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The way through the story, as the hardening walk-through (tests/sigilfall-campaign.test.ts) found it
 * broken: the quest arrow for story events, raiders who give up, bosses felled early, foes the story
 * sends in, roads that are shut, the fog of war on the maps.
 */

/** A hero at a quest: everything before it done, it active, every land known. */
function heroAt(quest: string, level = 30): Character {
  const c = readyHero('warrior', level);
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of QUEST_DEFS[quest]!.after ?? []) done(a);
  c.quests[quest] = { state: 'active', n: 0 };
  for (const r of REGION_IDS) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}
const DT = 1 / 60;
const run = (w: World, s: number): void => {
  for (let t = 0; t < s; t += DT) w.step(DT);
};

describe('Sigilfall: the quest arrow and the story’s fights', () => {
  it('a story event’s quest points at where it happens, and stays on the fight between its waves', () => {
    const w = newWorld('briarhollow', heroAt('briar-nightfall', 6));
    const square = w.places['briar-square']!;
    w.player.x = 5 * TILE;
    w.player.y = 26 * TILE;
    const t = objectiveTarget(w);
    expect(t?.quest).toBe('briar-nightfall');
    expect(Math.hypot(t!.x - square.x, t!.y - square.y)).toBeLessThan(TILE);
    // the raid starts at the square; between waves the arrow does not lead off to another quest
    w.player.x = square.x;
    w.player.y = square.y;
    run(w, 0.5);
    expect(w.story.run?.def.id).toBe('briar-raid');
    expect(objectiveTarget(w)?.quest).toBe('briar-nightfall');
  });

  it('a story raider hunts the hero across the land and never walks home', () => {
    const w = newWorld('briarhollow', heroAt('briar-nightfall', 6));
    const square = w.places['briar-square']!;
    w.player.x = square.x;
    w.player.y = square.y;
    run(w, 4);
    const raiders = w.enemies.filter((e) => e.hunts && !e.dead);
    expect(raiders.length).toBeGreaterThan(0);
    // the hero runs well past where a pack would give up (but not so far the raid is abandoned)
    w.player.y += 14 * TILE;
    run(w, 5);
    for (const e of raiders) if (!e.dead) expect(e.state).not.toBe('return');
  });

  it('a boss felled before its quest asked still counts once the quest begins', () => {
    const w = newWorld('whisperwood', heroAt('into-the-wood', 6));
    w.hero.bosses['grimtusk'] = 1;
    // the last of the fifteen: the Alpha opens, with Grimtusk already down
    w.hero.quests['into-the-wood']!.n = 14;
    w.questProgress((o) => o.kind === 'kill' && o.region === 'whisperwood');
    expect(questState(w.hero, 'alpha')).toBe('active');
    run(w, 1.5);
    expect(questState(w.hero, 'alpha')).toBe('done');
  });

  it('a foe the story sends into a land the hero is already in arrives, and the arrow finds it', () => {
    const w = newWorld('pale-reach', heroAt('the-pale-standard', 58));
    expect(w.enemies.some((e) => e.def.id === 'vosk-the-hollowed')).toBe(false);
    const std = w.enemies.find((e) => e.def.id === 'the-pale-standard' && !e.dead)!;
    hitEnemy(w, std, 1e9, 'physical', { depth: 0 });
    run(w, 2);
    expect(questState(w.hero, 'march-vosk')).toBe('active');
    expect(w.enemies.some((e) => e.def.id === 'vosk-the-hollowed' && !e.dead)).toBe(true);
    expect(objectiveTarget(w)?.quest).toBe('march-vosk');
  });

  it('routes walk round roads the story still keeps shut, and every road between lands goes both ways', () => {
    // the Herald's map in hand, the Gloam Gate not yet taken: Highwall's north road is shut, the Vale's causeway open
    const mapInHand = (q: string): boolean => q === 'gate-the-prison-map';
    expect(nextRegion('highwall', 'gloamhollow', mapInHand)).toBe('shattered-vale');
    expect(nextRegion('highwall', 'gloamhollow', () => false)).toBe(null);
    const ways = new Map<RegionId, Set<RegionId>>();
    for (const id of REGION_IDS) {
      const r = REGIONS[id];
      const out = r.holds ? r.holds.exits : [...Object.values(r.markers), ...(r.placed ?? []).map((p) => p.marker)].flatMap((m) => (m.kind === 'exit' ? [m.to] : []));
      ways.set(id, new Set(out));
    }
    for (const [a, outs] of ways) for (const b of outs) if (!REGIONS[b].interior) expect(ways.get(b)?.has(a), `${a} has a road to ${b} but ${b} has none back`).toBe(true);
  });
});

describe('Sigilfall: fog of war on the maps', () => {
  it('a new land is dark but round the hero, clears where they walk, and is kept on the hero', () => {
    const c = newCharacter('ranger', 'Fog', 'fog', 0);
    const w = newWorld('briarhollow', c);
    const p = w.player;
    expect(fogSeen(w.fog, p.x / TILE, p.y / TILE)).toBe(true);
    expect(fogSeen(w.fog, 1, 1)).toBe(false);
    const before = w.explored();
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(0.6);
    p.x = 4 * TILE;
    p.y = 26 * TILE;
    run(w, 0.5);
    expect(fogSeen(w.fog, 4, 26)).toBe(true);
    expect(w.explored()).toBeGreaterThan(before);
    // kept: a world made again from the hero remembers it
    const again = newWorld('briarhollow', c);
    expect(fogSeen(again.fog, 4, 26)).toBe(true);
    expect(fogSeen(again.fog, 1, 1)).toBe(false);
  });

  it('survives a save, rejects junk, and a hero from before the fog knows their lands whole', () => {
    const c = newCharacter('mage', 'Fog', 'fog', 0);
    const f = loadFog(c, 'briarhollow', 64, 54);
    revealFog(f, 10, 10);
    storeFog(c, 'briarhollow', f);
    const back = migrate(JSON.parse(JSON.stringify({ v: SAVE_VERSION, heroes: [{ ...c, seen: { ...c.seen, nowhere: 'AAAA', thornvale: '<script>' } }], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;
    expect(back.seen.briarhollow).toBe(c.seen.briarhollow);
    expect(Object.keys(back.seen)).toEqual(['briarhollow']);
    expect(fogSeen(loadFog(back, 'briarhollow', 64, 54), 10, 10)).toBe(true);
    expect(fogSeen(loadFog(back, 'briarhollow', 64, 54), 60, 50)).toBe(false);
    // a fog that doesn't fit the map (the land was redrawn) is simply dark again
    expect(loadFog(back, 'briarhollow', 64 + FOG_CELL * 3, 54).count).toBe(0);
    const old = { ...newCharacter('priest', 'Old', 'old', 0), unlocked: ['briarhollow', 'whisperwood'] } as Partial<Character>;
    delete old.seen;
    const v8 = migrate(JSON.parse(JSON.stringify({ v: 8, heroes: [old], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;
    expect(v8.seen).toEqual({ briarhollow: SEEN_ALL, whisperwood: SEEN_ALL });
    expect(newWorld('whisperwood', v8).fog.all).toBe(true);
    expect(newWorld('thornvale', v8).fog.all).toBe(false);
  });
});

describe('Sigilfall: quests taken and handed in, like WoW', () => {
  it('a quest is accepted, steps through, waits to be handed in, and pays at its giver; the arrow follows the tracked one', () => {
    const c = heroAt('into-the-wood', 6);
    c.quests['rift-shards'] = { state: 'offered', n: 0 };
    expect(offeredBy(c, 'smith-hollin').map((q) => q.id)).toContain('rift-shards');
    expect(acceptQuest(c, 'rift-shards')?.id).toBe('rift-shards');
    expect(turnInNpc(QUEST_DEFS['rift-shards']!)).toBe('smith-hollin');
    const wood = newWorld('whisperwood', c, 1, 0, undefined, true);
    wood.questProgress((o) => o.kind === 'collect', 3);
    expect(questState(c, 'rift-shards')).toBe('ready');
    // two quests under way here; the one tracked leads, and a finished one leads home to its giver
    trackQuest(c, 'rift-shards');
    const t = objectiveTarget(wood);
    expect(t?.quest).toBe('rift-shards');
    const road = wood.exits.find((x) => x.to === 'briarhollow')!;
    expect(Math.hypot(t!.x - road.x, t!.y - road.y)).toBeLessThan(TILE);
    const village = newWorld('briarhollow', c, 1, 0, undefined, true);
    const hollin = village.npcs.find((n) => n.id === 'smith-hollin')!;
    const there = objectiveTarget(village);
    expect(Math.hypot(there!.x - hollin.x, there!.y - hollin.y)).toBeLessThan(TILE);
    expect(handInsFor(c, 'smith-hollin').map((q) => q.id)).toEqual(['rift-shards']);
    const gold = c.gold;
    village.completeQuests([handInQuest(c, 'rift-shards')!]);
    expect(questState(c, 'rift-shards')).toBe('done');
    expect(c.gold).toBe(gold + QUEST_DEFS['rift-shards']!.reward.gold);
    expect(c.tracked).toBeUndefined();
  });

  it('the training is one quest of three steps, handed in to Mara', () => {
    const c = newCharacter('ranger', 'Yard', 'yard', 0);
    c.quests['briar-dusk'] = { state: 'done', n: 1 };
    startQuests(c);
    const w = newWorld('briarhollow', c, 1, 0, undefined, true);
    expect(questState(c, 'first-steps')).toBe('active');
    w.questProgress((o) => o.kind === 'tutorial' && o.step === 'attack', 5);
    expect(currentObjective(c, QUEST_DEFS['first-steps']!).kind === 'tutorial' && (currentObjective(c, QUEST_DEFS['first-steps']!) as { step: string }).step).toBe('skill');
    w.questProgress((o) => o.kind === 'tutorial' && o.step === 'skill', 2);
    w.questProgress((o) => o.kind === 'tutorial' && o.step === 'dodge', 1);
    expect(questState(c, 'first-steps')).toBe('ready');
    expect(c.unlocked).not.toContain('whisperwood');
    w.completeQuests([handInQuest(c, 'first-steps')!]);
    expect(c.unlocked).toContain('whisperwood');
  });
});

describe('Sigilfall: the save follows the hero between devices', () => {
  it('quests are stored packed and read back the same, steps and hand-ins included', () => {
    const c = newCharacter('warrior', 'Sync', 'sync', 0);
    c.quests['first-steps'] = { state: 'active', n: 3, step: 1 };
    c.quests['into-the-wood'] = { state: 'ready', n: 15 };
    c.quests['hidden-grove'] = { state: 'offered', n: 0 };
    c.quests['briar-dusk'] = { state: 'done', n: 1 };
    const text = saveText({ v: SAVE_VERSION, heroes: [c, null, null], last: 0, settings: {} as never, saved: 0 });
    expect(text).toContain('"first-steps":"a3.1"');
    const back = migrate(JSON.parse(text))!.heroes[0]!;
    expect(back.quests['first-steps']).toEqual({ state: 'active', n: 3, step: 1 });
    expect(back.quests['into-the-wood']?.state).toBe('ready');
    expect(back.quests['hidden-grove']?.state).toBe('offered');
    expect(back.quests['briar-dusk']?.state).toBe('done');
  });

  it('when two devices both played, each hero slot keeps the copy played last', () => {
    const phone = newCharacter('mage', 'Phone', 'p', 0);
    phone.level = 12;
    phone.updated = 2000;
    const desk = newCharacter('mage', 'Phone', 'p', 0);
    desk.level = 8;
    desk.updated = 1000;
    const other = newCharacter('priest', 'Desk', 'd', 0);
    other.updated = 3000;
    const local = JSON.stringify({ v: SAVE_VERSION, heroes: [desk, other, null], last: 1, settings: {}, saved: 3000 });
    const remote = JSON.stringify({ v: SAVE_VERSION, heroes: [phone, null, null], last: 0, settings: {}, saved: 2000 });
    const merged = JSON.parse(mergeSaveText('glitchbound.sigilfall', local, remote)) as { heroes: (Character | null)[] };
    expect(merged.heroes[0]!.level).toBe(12);
    expect(merged.heroes[1]!.name).toBe('Desk');
    expect(merged.heroes[2]).toBe(null);
  });
});

describe('Sigilfall: the first lands', () => {
  it('the Whisperwood keeps every marker of its drawing, once, and has more packs; Briarhollow is built close', () => {
    const wood = REGIONS.whisperwood;
    expect(wood.map[0]!.length).toBeGreaterThanOrEqual(110);
    const n: Record<string, number> = {};
    for (const l of wood.map) for (const ch of l) if (ch in wood.markers) n[ch] = (n[ch] ?? 0) + 1;
    for (const ch of ['P', 'R', 'S', 'G', 'e', '1', '2', '3', '4', '5', '6', '7', '8', '9']) expect(n[ch], ch).toBe(1);
    expect((wood.placed ?? []).filter((p) => p.marker.kind === 'pack').length).toBeGreaterThanOrEqual(8);
    // the village at its plan's own size (the owner found it "vast" laid out roomier), its houses along its roads
    const briar = parseRegion(REGIONS.briarhollow);
    expect(briar.w).toBeLessThanOrEqual(64);
    expect(briar.buildings.length).toBeGreaterThanOrEqual(20);
  });
});
