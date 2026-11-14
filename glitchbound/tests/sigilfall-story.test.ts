import { TILE } from '../src/games/sigilfall/sim/map';
import { describe, expect, it } from 'vitest';
import { endScene } from '../src/games/sigilfall/sim/scene';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { HOME, newCharacter, questState, startQuests, type Character } from '../src/games/sigilfall/progress/character';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { regionState } from '../src/games/sigilfall/sim/story';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The story in the world (STORY_BIBLE.md §4): Briarhollow's states, the Prologue's raid, rescue and
 * defense played on the ordinary simulation, people and roads that come with the story, and old saves
 * picking up the new opening where they were.
 */

/** A hero at a point in the Prologue: everything before `quest` done, `quest` itself active. */
function heroAt(quest: string, level = 5): Character {
  const c = readyHero('mage', level);
  const order = ['briar-dusk', 'first-steps', 'briar-nightfall', 'briar-the-rider', 'briar-the-seal', 'briar-the-inn', 'briar-hold-the-door', 'briar-below', 'the-warden', 'close-the-rift', 'the-empty-tomb', 'into-the-wood', 'alpha'];
  for (const id of order) {
    if (id === quest) {
      c.quests[id] = { state: 'active', n: 0 };
      break;
    }
    c.quests[id] = { state: 'done', n: 1 };
  }
  return c;
}

const DT = 1 / 60;

function run(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += DT) {
    each?.();
    w.step(DT);
  }
}

/** Puts the hero where an event happens. */
function goTo(w: World, place: string): void {
  const at = w.places[place]!;
  w.player.x = at.x;
  w.player.y = at.y + 8;
}

/** Strikes down every living enemy (the hero is not the point of these tests). */
function smite(w: World): void {
  for (const e of w.enemies) if (!e.dead && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
}

describe('Sigilfall: the story in the world', () => {
  it('a new hero starts at Briarhollow’s gate with the guard’s greeting', () => {
    const c = newCharacter('mage', 'Test', 't', 0);
    expect(c.unlocked).toEqual([HOME]);
    expect(questState(c, 'briar-dusk')).toBe('active');
    expect(QUEST_DEFS['first-steps']!.after).toEqual(['briar-dusk']);
  });

  it('Briarhollow burns on the night of the raid, smoulders after it, and becomes the camp at dawn', () => {
    const b = REGIONS.briarhollow;
    // the hero arrives as the lamps are lit; the fight at the gate is night with nothing burning yet; from the
    // bell on to the chapel door it is the raid's burning night
    expect(regionState(b, heroAt('briar-dusk'))?.dusk).toBe(true);
    const gate = regionState(b, heroAt('first-steps'));
    expect(gate?.id).toBe('gate');
    expect(gate?.night && !gate.burning).toBe(true);
    for (const q of ['briar-nightfall', 'briar-the-rider', 'briar-the-seal', 'briar-the-inn', 'briar-hold-the-door']) {
      const raid = regionState(b, heroAt(q));
      expect(raid?.id, q).toBe('raid');
      expect(raid?.night && raid.burning, q).toBe(true);
    }
    expect(regionState(b, heroAt('the-warden'))?.id).toBe('night');
    const dawn = heroAt('the-empty-tomb');
    dawn.quests['the-empty-tomb'] = { state: 'done', n: 1 };
    expect(regionState(b, dawn)?.id).toBe('camp');
    // the world shows it: night, fires on the roofs, no peace for the HUD
    const w = newWorld('briarhollow', heroAt('briar-nightfall'));
    expect(w.dark).toBe(true);
    expect(w.fires.length).toBeGreaterThan(3);
  });

  it('people and roads come with the story', () => {
    const early = newWorld('briarhollow', heroAt('briar-dusk'));
    expect(early.npcs.some((n) => n.id === 'oskar-fell')).toBe(false);
    expect(early.npcs.some((n) => n.id === 'mara-venn')).toBe(true);
    // the courier is on the road until he has walked in
    expect(newWorld('briarhollow', heroAt('briar-the-rider')).npcs.some((n) => n.id === 'oskar-fell')).toBe(false);
    expect(early.exits.some((x) => x.to === 'crypt')).toBe(false);
    expect(early.exits.some((x) => x.to === 'thornvale')).toBe(false);
    const courier = newWorld('briarhollow', heroAt('briar-the-seal'));
    expect(courier.npcs.some((n) => n.id === 'oskar-fell')).toBe(true);
    // during the raid the villagers are hidden away; Mara fights beside you instead of standing at the gate
    const raid = newWorld('briarhollow', heroAt('briar-nightfall'));
    expect(raid.npcs.some((n) => n.id === 'mara-venn')).toBe(false);
    const below = newWorld('briarhollow', heroAt('briar-below'));
    expect(below.exits.some((x) => x.to === 'crypt')).toBe(true);
    // the state follows the story while the hero is there
    const w = newWorld('briarhollow', heroAt('briar-the-seal'));
    w.hero.quests['briar-the-seal'] = { state: 'done', n: 1 };
    const v = w.stateVersion;
    run(w, 0.6);
    expect(w.stateVersion).toBeGreaterThan(v);
    expect(w.npcs.some((n) => n.id === 'oskar-fell')).toBe(false);
  });

  it('the story opens on the night: Mara at the gate, then the Host on the road, and the first fight teaches the controls', () => {
    const c = newCharacter('ranger', 'Gate', 'gate', 0);
    const w = newWorld('briarhollow', c);
    // the hero arrives at the gate as the lamps are lit, and Mara stops them there
    const gate = w.places['briar-gate']!;
    expect(Math.hypot(w.player.x - gate.x, w.player.y - gate.y)).toBeLessThan(4 * TILE);
    expect(w.storyState?.dusk).toBe(true);
    w.questProgress((o) => o.kind === 'talk' && o.npc === 'mara-venn');
    expect(questState(c, 'briar-dusk')).toBe('done');
    expect(questState(c, 'first-steps')).toBe('active');
    expect(QUEST_DEFS['first-steps']!.objective).toMatchObject({ kind: 'event', event: 'briar-gate' });
    // no yard and no dummies: the raiders come down the north road, and Mara stands with the hero
    run(w, 0.8);
    expect(w.storyState?.id).toBe('gate');
    expect(w.fires).toHaveLength(0);
    expect(w.story.run?.def.id).toBe('briar-gate');
    expect(w.pets.some((p) => p.def.id === 'mara' && !p.dead)).toBe(true);
    let rage = -1;
    for (let i = 0; i < 40 && questState(c, 'first-steps') === 'active'; i++) {
      run(w, 2.5);
      if (rage < 0 && w.events.some((e) => e.t === 'hint' && e.id === 'skill')) rage = w.player.mana;
      smite(w);
    }
    expect(questState(c, 'first-steps')).toBe('done');
    // each wave showed the control it asks for, in order: strike, the skill, the dodge
    const controls = new Set(['attack', 'skill', 'dodge']);
    expect(w.events.flatMap((e) => (e.t === 'hint' && controls.has(e.id) ? [e.id] : []))).toEqual(['attack', 'skill', 'dodge']);
    // and the raid in the lanes follows straight on
    expect(questState(c, 'briar-nightfall')).toBe('active');
    expect(c.unlocked).not.toContain('whisperwood');
    // (a ranger's skill costs mana, which a hero starts with; rage is the warrior's test below)
    expect(rage).toBeGreaterThan(0);
  });

  it('the night runs on: Mara steps out from where she stood and is the same companion in the lanes', () => {
    const c = newCharacter('ranger', 'Flow', 'flow', 0);
    const w = newWorld('briarhollow', c);
    const stood = w.npcs.find((n) => n.id === 'mara-venn')!;
    w.questProgress((o) => o.kind === 'talk' && o.npc === 'mara-venn');
    run(w, DT);
    // the guard at the gate becomes the companion at the gate, not a second Mara beside the hero
    const mara = w.pets.find((p) => p.def.id === 'mara' && !p.dead)!;
    expect(Math.hypot(mara.x - stood.x, mara.y - stood.y)).toBeLessThan(4);
    expect(w.npcs.some((n) => n.id === 'mara-venn')).toBe(false);
    for (let i = 0; i < 40 && questState(c, 'first-steps') === 'active'; i++) {
      run(w, 2.5);
      smite(w);
    }
    expect(questState(c, 'briar-nightfall')).toBe('active');
    // (the next fight waits until the last one's closing words are said: story.ts finish)
    run(w, 6);
    // she stays on through the bell, and goes into the lanes with the hero
    goTo(w, 'briar-square');
    run(w, 0.5);
    expect(w.story.run?.def.id).toBe('briar-raid');
    expect(w.pets.filter((p) => p.def.id === 'mara' && !p.dead)).toEqual([mara]);
    expect(mara.life).toBe(Infinity);
  });

  it('the skill lesson works for a warrior: rage enough for the skill as the wave that asks for it comes', () => {
    const c = newCharacter('warrior', 'Rage', 'rage', 0);
    const w = newWorld('briarhollow', c);
    w.questProgress((o) => o.kind === 'talk' && o.npc === 'mara-venn');
    run(w, 0.8);
    expect(w.player.mana).toBe(0);
    let rage = -1;
    for (let i = 0; i < 40 && rage < 0; i++) {
      run(w, 1);
      if (w.events.some((e) => e.t === 'hint' && e.id === 'skill')) rage = w.player.mana;
      else smite(w);
    }
    const s1 = w.build.skills[w.build.bar.s1!]!.spec;
    expect(rage).toBeGreaterThanOrEqual(s1.cost);
  });

  it('when the gate has held, the bell nobody rings tolls by itself and the roofs catch one by one', () => {
    const w = newWorld('briarhollow', heroAt('first-steps'));
    w.hero.level = 30;
    goTo(w, 'briar-gate');
    for (let i = 0; i < 40 && questState(w.hero, 'first-steps') === 'active'; i++) {
      run(w, 2.5);
      smite(w);
    }
    expect(questState(w.hero, 'briar-nightfall')).toBe('active');
    // the raid waits for the hero at the square: at the gate there is time for the bell
    run(w, 0.6);
    expect(w.storyState?.id).toBe('raid');
    expect(w.story.run).toBeNull();
    const caught = (): number => w.fires.filter((f) => w.fireLit(f) > 0).length;
    expect(caught()).toBe(0);
    let scene = false;
    for (let t = 0; t < 30 && !scene; t += 0.5) {
      run(w, 0.5);
      scene ||= w.scene?.def.id === 'briar-the-toll';
    }
    expect(scene).toBe(true);
    run(w, 2);
    expect(w.events.some((e) => e.t === 'sfx' && e.id === 'bell-toll')).toBe(true);
    run(w, 16);
    // all of the village's roofs but the inn's, which catches when its beat comes
    expect(caught()).toBe(6);
    expect(w.fires.every((f) => w.fireLit(f) === 1)).toBe(true);
  });

  it('the raid: Mara fights beside you, three waves come, and the quest moves on to the rider at the gate', () => {
    const w = newWorld('briarhollow', heroAt('briar-nightfall'));
    w.hero.level = 30; // a sturdy hero: the test is the event, not the fight
    goTo(w, 'briar-square');
    run(w, 0.2);
    expect(w.story.run?.def.id).toBe('briar-raid');
    expect(w.safe).toBe(false);
    expect(w.pets.some((p) => p.def.id === 'mara' && !p.dead)).toBe(true);
    let waves = 0;
    // each wave comes in just beyond sight (where each raider appears), not from the village's far roads
    const far = new Map<number, number>();
    const note = (): void => {
      for (const e of w.enemies) if (!e.dummy && !far.has(e.id)) far.set(e.id, Math.hypot(e.x - w.player.x, e.y - w.player.y));
    };
    for (let i = 0; i < 40 && questState(w.hero, 'briar-nightfall') === 'active'; i++) {
      run(w, 2.5, note);
      if (w.enemies.some((e) => !e.dead)) waves++;
      smite(w);
    }
    expect(far.size).toBeGreaterThanOrEqual(12);
    expect(Math.max(...far.values())).toBeLessThanOrEqual(150 + 26);
    expect(waves).toBeGreaterThanOrEqual(EVENTS['briar-raid']!.waves.length);
    expect(questState(w.hero, 'briar-nightfall')).toBe('done');
    expect(questState(w.hero, 'briar-the-rider')).toBe('active');
    // the event's companions leave with it (once they've said their piece)
    run(w, 12);
    expect(w.pets.some((p) => p.def.id === 'mara' && !p.dead)).toBe(false);
    expect(w.story.run).toBeNull();
  });

  it('the courier walks in from the north road in the middle of the raid, and dies in the gateway', () => {
    const w = newWorld('briarhollow', heroAt('briar-the-rider'));
    goTo(w, 'briar-gate');
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('briar-courier');
    const courier = w.pets.find((p) => p.def.id === 'courier')!;
    expect(courier).toBeTruthy();
    const from = courier.y;
    run(w, 1);
    // he is walking in, toward the gate
    expect(courier.y).toBeGreaterThan(from);
    let last = { x: courier.x, y: courier.y };
    for (let i = 0; i < 30 * 60 && questState(w.hero, 'briar-the-rider') === 'active'; i++) {
      // (never a jump: he walks every step of the way)
      expect(Math.hypot(courier.x - last.x, courier.y - last.y)).toBeLessThan(2);
      last = { x: courier.x, y: courier.y };
      run(w, DT);
    }
    expect(questState(w.hero, 'briar-the-rider')).toBe('done');
    expect(questState(w.hero, 'briar-the-seal')).toBe('active');
    // he falls where he stopped: the one lying there is him, there at once (no fade, no jump), falling now
    const oskar = w.npcs.find((n) => n.id === 'oskar-fell')!;
    expect(Math.hypot(oskar.x - last.x, oskar.y - last.y)).toBeLessThan(8);
    expect(oskar.since).toBeUndefined();
    expect(oskar.fell).toBeCloseTo(w.time, 1);
    expect(w.pets.some((p) => p.def.id === 'courier')).toBe(false);
    // the seal taken, he dies: he is let go slowly (a fade, render: NPC_DIES), and the inn's fight is next
    w.questProgress((o) => o.kind === 'talk' && o.npc === 'oskar-fell');
    expect(questState(w.hero, 'briar-the-seal')).toBe('done');
    expect(questState(w.hero, 'briar-the-inn')).toBe('active');
    run(w, 0.6);
    expect(w.npcs.some((n) => n.id === 'oskar-fell')).toBe(false);
    expect(w.leftNpcs.some((n) => n.id === 'oskar-fell')).toBe(true);
  });

  it('dawn opens the north road: the Whisperwood comes after the night', () => {
    const c = heroAt('the-empty-tomb');
    expect(c.unlocked).not.toContain('whisperwood');
    expect(questState(c, 'into-the-wood')).toBe('locked');
    const w = newWorld('briarhollow', c);
    w.questProgress((o) => o.kind === 'talk' && o.npc === 'maren');
    expect(questState(c, 'the-empty-tomb')).toBe('done');
    expect(c.unlocked).toContain('whisperwood');
    expect(questState(c, 'into-the-wood')).toBe('active');
  });

  it('the inn: the children follow you and the rescue is done only when all three are safe', () => {
    const w = newWorld('briarhollow', heroAt('briar-the-inn'));
    w.hero.level = 30;
    goTo(w, 'briar-inn');
    run(w, 0.3);
    const kids = w.pets.filter((p) => p.def.id === 'briar-child');
    expect(kids).toHaveLength(3);
    const elyra = w.pets.find((p) => p.def.id === 'elyra' && !p.dead)!;
    // the waves beaten, but the children still at the inn: not done
    for (let i = 0; i < 12; i++) {
      run(w, 2.5);
      smite(w);
    }
    expect(questState(w.hero, 'briar-the-inn')).toBe('active');
    // lead them to the chapel: walk there, and they follow
    const chapel = w.places['briar-chapel']!;
    for (let i = 0; i < 2400 && questState(w.hero, 'briar-the-inn') === 'active'; i++) {
      const dx = chapel.x - w.player.x;
      const dy = chapel.y + 6 - w.player.y;
      const d = Math.hypot(dx, dy);
      w.input = { ...emptyInput(), ...(d > 6 ? { mx: dx / d, my: dy / d } : {}) };
      w.step(DT);
      // the way is not straight: step past walls by putting the hero a little further each second
      if (i % 60 === 59 && d > 40) {
        w.player.x += (dx / d) * 30;
        w.player.y += (dy / d) * 30;
      }
    }
    run(w, 1);
    expect(questState(w.hero, 'briar-the-inn')).toBe('done');
    expect(questState(w.hero, 'briar-hold-the-door')).toBe('active');
    // the children go in at the chapel door; Elyra stays on from the inn to ward it
    // (the next fight waits until the last one's closing words are said: story.ts finish)
    run(w, 8);
    expect(w.pets.some((p) => p.def.id === 'briar-child' && !p.dead)).toBe(false);
    expect(w.story.run?.def.id).toBe('briar-door');
    expect(w.story.run?.pets).toContain(elyra);
    expect(w.pets.filter((p) => p.def.id === 'elyra' && !p.dead)).toHaveLength(1);
  });

  it('nobody walks in from the far side of the village: the fights at the inn and the chapel start at once', () => {
    for (const [quest, place, event] of [['briar-the-inn', 'briar-inn', 'briar-inn'], ['briar-hold-the-door', 'briar-chapel', 'briar-door']] as const) {
      const w = newWorld('briarhollow', heroAt(quest));
      w.hero.level = 30;
      goTo(w, place);
      for (let i = 0; i < 600 && !w.story.run?.ids.length; i++) w.step(DT);
      expect(w.story.run?.def.id, event).toBe(event);
      const ids = w.story.run!.ids;
      const nearest = Math.min(...w.enemies.filter((e) => ids.includes(e.id)).map((e) => Math.hypot(e.x - w.player.x, e.y - w.player.y)));
      // (the far roads these waves are named for are 400 world pixels off and more)
      expect(nearest, event).toBeLessThan(240);
    }
  });

  it('the door: if it breaks the defense starts over (and pays nothing); held, it opens the crypt stair', () => {
    const w = newWorld('briarhollow', heroAt('briar-hold-the-door'));
    w.hero.level = 30;
    goTo(w, 'briar-chapel');
    run(w, 0.3);
    // (past the shot of the door: what is tested is the holding of it)
    if (w.scene) endScene(w, true);
    const door = w.pets.find((p) => p.def.id === 'chapel-door')!;
    expect(door).toBeTruthy();
    // on the chapel's own doorstep (where the way in is), not out on the cobbles
    const into = w.map.markers.find((m) => m.marker.kind === 'exit' && m.marker.to === 'chapel-of-the-bell')!;
    expect(Math.hypot(door.x - (into.tx + 0.5) * TILE, door.y - (into.ty + 0.5) * TILE)).toBeLessThan(2);
    // Mara isn't put at the hero's elbow: she comes running in from beyond the view
    const mara = w.pets.find((p) => p.def.id === 'mara')!;
    expect(Math.hypot(mara.x - w.player.x, mara.y - w.player.y)).toBeGreaterThan(6 * 16);
    const gold = w.hero.gold;
    door.hp = 0;
    door.dead = true;
    run(w, 0.2);
    expect(w.story.run).toBeNull();
    expect(questState(w.hero, 'briar-hold-the-door')).toBe('active');
    expect(w.hero.gold).toBe(gold);
    // after a breath it begins again, with a whole door
    run(w, 4.5);
    expect(w.story.run?.def.id).toBe('briar-door');
    for (let i = 0; i < 30 && questState(w.hero, 'briar-hold-the-door') === 'active'; i++) {
      run(w, 2.5);
      smite(w);
    }
    expect(questState(w.hero, 'briar-hold-the-door')).toBe('done');
    expect(questState(w.hero, 'briar-below')).toBe('active');
    // the stair opens while the hero is still standing there
    run(w, 0.6);
    expect(w.exits.some((x) => x.to === 'crypt')).toBe(true);
    expect(w.spots.some((x) => x.id === 'briar-crypt-stair')).toBe(true);
  });

  it('an old save picks up the new opening where its hero was', () => {
    const fresh = (quests: Record<string, { state: string; n: number }>): Record<string, unknown> => ({ cls: 'mage', level: 9, quests });
    const save = migrate({
      v: 2,
      heroes: [fresh({ 'first-steps': { state: 'active', n: 0 } }), fresh({ 'first-dodge': { state: 'done', n: 1 }, alpha: { state: 'done', n: 1 } }), fresh({ 'close-the-rift': { state: 'done', n: 1 }, 'the-warden': { state: 'done', n: 1 } })],
      last: 0,
    })!;
    expect(save.v).toBe(SAVE_VERSION);
    const [a, b, c] = save.heroes as Character[];
    expect(questState(a!, 'briar-dusk')).toBe('done');
    expect(questState(a!, 'briar-the-seal')).toBe('locked');
    expect(questState(b!, 'briar-the-seal')).toBe('done');
    // past the old opening: the raid, the inn and the door count as played
    for (const id of ['briar-nightfall', 'briar-the-inn', 'briar-hold-the-door', 'briar-below']) expect(questState(c!, id)).toBe('done');
    // every hero now has Briarhollow
    for (const h of [a!, b!, c!]) expect(h.unlocked).toContain(HOME);
    // and nothing the hero already finished starts again
    startQuests(c!);
    expect(questState(c!, 'close-the-rift')).toBe('done');
  });
});
