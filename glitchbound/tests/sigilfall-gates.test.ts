import { describe, expect, it } from 'vitest';
import { QUESTS, QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { questState, type Character } from '../src/games/sigilfall/progress/character';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Acts IV and V in the world (STORY_BIBLE.md §3, §4): Highwall's three siege states, the rest of the Three
 * Gates (Nyx's return, the cells under the Gloam Gate, the field battle before the Muster Hall), the Dead
 * Kingdom's frozen places and Queen Ysane's echoes, Orren on Mourners' Shore, Isolde's fireships, and the
 * seven sigils at the end of it. Every event is played on the simulation, and a reload mid-event or after
 * one neither repeats it nor pays it twice.
 */

/** A hero with everything before `quest` done (along its `after` chain) and `quest` itself active. */
function heroAt(quest: string, level = 50): Character {
  const c = readyHero('warrior', level);
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

const DT = 1 / 60;
function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) w.step(DT);
}
function goTo(w: World, place: string): void {
  const at = w.places[place] ?? w.spots.find((s) => s.id === place)!;
  w.player.x = at.x;
  w.player.y = at.y + 8;
}
function smite(w: World): void {
  for (const e of w.enemies) if (!e.dead && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
}
/** Plays an event's waves to the end, striking each wave down as it comes. */
function beat(w: World, quest: string, rounds = 40): void {
  for (let i = 0; i < rounds && questState(w.hero, quest) === 'active'; i++) {
    run(w, 2.5);
    w.player.hp = w.player.maxHp;
    smite(w);
  }
}
/** Walks the hero to a place with the people they lead keeping up, striking down whatever comes. */
function lead(w: World, quest: string, place: string, who: string[]): void {
  const to = w.places[place]!;
  for (let i = 0; i < 60 && questState(w.hero, quest) === 'active'; i++) {
    const dx = to.x - w.player.x;
    const dy = to.y - w.player.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, 50);
    if (d > 4) {
      w.player.x += (dx / d) * step;
      w.player.y += (dy / d) * step;
    }
    for (const f of w.pets) if (who.includes(f.def.id)) Object.assign(f, { x: w.player.x + 6, y: w.player.y + 4 });
    w.player.hp = w.player.maxHp;
    run(w, 0.5);
    smite(w);
  }
}
const npcHere = (w: World, id: string): boolean => w.npcs.some((n) => n.id === id);
const exitTo = (w: World, to: RegionId): World['exits'][number] | undefined => w.exits.find((x) => x.to === to);

/** The zones Acts IV and V added. */
const NEW_ZONES = ['gloamhollow', 'weeping-woods', 'emberdeep', 'hollowmere'];

describe('Sigilfall: the Three Gates (Act IV)', () => {
  it('every quest of the two Acts opens in turn from a new hero’s start: no loops, nothing out of reach', () => {
    const done = new Set<string>();
    for (let changed = true; changed; ) {
      changed = false;
      for (const q of QUESTS) {
        if (done.has(q.id) || !(q.after ?? []).every((a) => done.has(a))) continue;
        done.add(q.id);
        changed = true;
      }
    }
    const acts = QUESTS.filter((q) => NEW_ZONES.includes(q.zone ?? '') || ['into-vaelmoor', 'the-seventh-sigil', 'gate-nyx-returns', 'gate-the-prison-map'].includes(q.id));
    expect(acts.length).toBeGreaterThan(40);
    expect(acts.filter((q) => !done.has(q.id)).map((q) => q.id)).toEqual([]);
  });

  it('Highwall is besieged, then breached, then liberated, by quest progress alone', () => {
    const besieged = newWorld('highwall', heroAt('ashes-of-ashby', 42));
    expect(besieged.storyState?.id).toBe('besieged');
    expect(besieged.wisps.length).toBeGreaterThan(0);
    expect(besieged.props.some((p) => p.prop === 'skull-banner')).toBe(true);
    const breached = newWorld('highwall', heroAt('general-morvain', 43));
    expect(breached.storyState?.id).toBe('breached');
    expect(breached.fires.length).toBeGreaterThanOrEqual(4);
    const free = newWorld('highwall', heroAt('the-long-night-ends', 44));
    expect(free.storyState).toBeNull();
    expect(free.fires).toHaveLength(0);
    expect(free.props.some((p) => p.prop === 'skull-banner')).toBe(false);
    expect(free.props.filter((p) => p.prop === 'blue-banner').length).toBeGreaterThanOrEqual(3);
    // a reload in the middle of the siege comes back to the same state
    expect(newWorld('highwall', breached.hero).storyState?.id).toBe('breached');
  });

  it('Nyx walks back into Mara’s camp under a white rag, and stays to show the map', () => {
    const w = newWorld('highwall', heroAt('gate-nyx-returns', 44));
    expect(npcHere(w, 'nyx-returned')).toBe(false);
    goTo(w, 'relief-camp');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('nyx-returns');
    expect(w.pets.some((p) => p.def.id === 'nyx')).toBe(true);
    run(w, 70);
    expect(questState(w.hero, 'gate-nyx-returns')).toBe('done');
    expect(questState(w.hero, 'gate-the-prison-map')).toBe('active');
    run(w, 0.6);
    expect(npcHere(w, 'nyx-returned')).toBe(true);
    // the Gloam road opens from the Vale only once the map is read
    expect(exitTo(newWorld('gloamhollow', heroAt('gloam-the-lamp-road', 44)), 'shattered-vale')).toBeTruthy();
  });

  it('the Gloam Gate: the cells, the way out, the Gatewarden, and Lastlight’s fire after', () => {
    const held = newWorld('gloamhollow', heroAt('gloam-the-cells', 48));
    expect(held.storyState?.id).toBe('gate-held');
    expect(held.enemies.some((e) => e.def.id === 'the-gatewarden' && !e.dead)).toBe(true);
    const w = held;
    goTo(w, 'gate-cells');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('gloam-cells');
    expect(w.pets.some((p) => p.def.id === 'nyx-at-the-lock')).toBe(true);
    expect(w.pets.some((p) => p.def.id === 'cael')).toBe(true);
    // a reload in the middle starts the cells over from the quest's step: nothing is lost, nothing paid
    const mid = newWorld('gloamhollow', w.hero);
    expect(questState(mid.hero, 'gloam-the-cells')).toBe('active');
    beat(w, 'gloam-the-cells');
    expect(questState(w.hero, 'gloam-the-cells')).toBe('done');
    expect(questState(w.hero, 'gloam-out-of-the-cells')).toBe('active');
    run(w, 4.5);
    goTo(w, 'gate-cells');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('gloam-out');
    expect(w.pets.filter((p) => p.def.id === 'elyra-freed' || p.def.id === 'wren')).toHaveLength(2);
    lead(w, 'gloam-out-of-the-cells', 'gate-causeway', ['elyra-freed', 'wren']);
    expect(questState(w.hero, 'gloam-out-of-the-cells')).toBe('done');
    expect(questState(w.hero, 'the-gatewarden')).toBe('active');
    // coming back after the cells: the event does not play again
    const again = newWorld('gloamhollow', w.hero);
    goTo(again, 'gate-cells');
    run(again, 0.5);
    expect(again.story.run).toBeNull();
    expect(npcHere(again, 'elyra-lastlight')).toBe(true);
    expect(npcHere(again, 'wren')).toBe(true);
    // the Gate taken: lamps on its hooks, the gloom gone
    const lit = newWorld('gloamhollow', heroAt('the-gloam-gate', 48));
    expect(lit.storyState).toBeNull();
    expect(lit.props.filter((p) => p.prop === 'lantern').length).toBeGreaterThanOrEqual(2);
    expect(lit.enemies.some((e) => e.def.id === 'the-gatewarden' && !e.dead)).toBe(false);
  });
});

describe('Sigilfall: the Dead Kingdom (Act V)', () => {
  it('Lark’s Hollow: the queen calls her children in until the hero brings them home', () => {
    const w = newWorld('weeping-woods', heroAt('wood-the-children', 50));
    expect(w.storyState?.id).toBe('weeping');
    expect(npcHere(w, 'echo-of-ysane')).toBe(true);
    expect(npcHere(w, 'orren-in-vaelmoor')).toBe(true);
    goTo(w, 'hollow-wood');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('wood-the-children');
    expect(w.pets.filter((p) => p.def.id === 'echo-child')).toHaveLength(2);
    lead(w, 'wood-the-children', 'hollow-door', ['echo-child']);
    expect(questState(w.hero, 'wood-the-children')).toBe('done');
    expect(questState(w.hero, 'the-weeping-tree')).toBe('active');
    run(w, 4);
    expect(npcHere(w, 'echo-of-ysane')).toBe(false);
  });

  it('Hollowmere: the lake answers Orren and he holds; Ysane waits behind the Lich’s throne, then is let go', () => {
    const w = newWorld('hollowmere', heroAt('orren-on-the-shore', 55));
    expect(w.storyState?.id).toBe('lich-holds');
    goTo(w, 'mourners-edge');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('orren-on-the-shore');
    expect(w.pets.some((p) => p.def.id === 'orren-praying')).toBe(true);
    beat(w, 'orren-on-the-shore');
    expect(questState(w.hero, 'orren-on-the-shore')).toBe('done');
    expect(questState(w.hero, 'across-the-mere')).toBe('active');
    expect(npcHere(newWorld('hollowmere', heroAt('the-necropolis', 55)), 'echo-of-ysane-mere')).toBe(false);
    const behind = newWorld('hollowmere', heroAt('ysanes-last-echo', 56));
    expect(npcHere(behind, 'echo-of-ysane-mere')).toBe(true);
    expect(behind.storyState).toBeNull();
    const gone = heroAt('ysanes-last-echo', 56);
    gone.quests['ysanes-last-echo'] = { state: 'done', n: 1 };
    expect(npcHere(newWorld('hollowmere', gone), 'echo-of-ysane-mere')).toBe(false);
  });
});
