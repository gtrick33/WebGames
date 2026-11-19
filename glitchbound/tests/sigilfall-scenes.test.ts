import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
import { npcLookOf } from '../src/games/sigilfall/render/sprites';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { endScene } from '../src/games/sigilfall/sim/scene';
import { holds } from '../src/games/sigilfall/sim/story';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE, WORLD_K } from '../src/games/sigilfall/sim/map';
import { heroAtEvent, newWorld, readyHero } from './sigilfall-bot';

/**
 * Scenes and review presets (blueprint Prompt 9): every scene names people and places that are there at its
 * moment, plays through, can be skipped, never plays twice, and is safe across a reload; every preset puts a
 * hero at its beat.
 */

const DT = 1 / 60;
const run = (w: World, s: number): void => {
  for (let t = 0; t < s; t += DT) {
    w.input = emptyInput();
    w.step(DT);
  }
};
/** A hero at the preset whose beat shows this scene. */
function atScene(id: string) {
  const preset = PRESETS.find((p) => p.label.includes('(scene)') && SCENES.find((s) => s.id === id)!.region === p.region && holdsFor(p, id));
  expect(preset, `a preset for ${id}`).toBeDefined();
  const c = readyHero('mage', preset!.level);
  applyPreset(c, preset!);
  return c;
}
function holdsFor(p: (typeof PRESETS)[number], id: string): boolean {
  const c = readyHero('mage', 2);
  applyPreset(c, p);
  const when = SCENES.find((s) => s.id === id)!.when;
  return !!when && holds(c, when);
}
/**
 * Puts the hero where the scene is set and lets it begin (the land's other scenes seen: the Ember Keep's comes
 * just before the Regent's, the first time up the avenue).
 */
function startAt(w: World, id: string): void {
  const def = SCENES.find((s) => s.id === id)!;
  for (const s of SCENES) if (s.id !== id && s.region === def.region && !w.hero.opened.includes(`scene:${s.id}`)) w.hero.opened.push(`scene:${s.id}`);
  w.enemies = [];
  const at = def.near ? (w.places[def.near] ?? w.spots.find((sp) => sp.id === def.near) ?? w.npcs.find((n) => n.id === def.near)) : null;
  if (at) {
    w.player.x = at.x;
    w.player.y = at.y + 20;
  }
  run(w, 0.6);
}

describe('Sigilfall: scenes', () => {
  it('every preset puts a hero at its beat, and the beat’s quest exists', () => {
    for (const p of PRESETS) {
      if (p.active) expect(QUEST_DEFS[p.active], p.id).toBeDefined();
      for (const d of p.done ?? []) expect(QUEST_DEFS[d], p.id).toBeDefined();
      const c = readyHero('warrior', 2);
      applyPreset(c, p);
      expect(c.level).toBeGreaterThanOrEqual(p.level);
      expect(c.review).toBe(true);
      if (p.active) expect(c.quests[p.active]?.state).toBe('active');
      expect(() => newWorld(p.region, c)).not.toThrow();
    }
  });

  it('every scene plays at its moment, with everyone it names there, and ends', { timeout: 180_000 }, () => {
    for (const def of SCENES.filter((d) => d.when)) {
      const w = newWorld(def.region, atScene(def.id));
      startAt(w, def.id);
      expect(w.scene?.def.id, def.id).toBe(def.id);
      // (a vision's ghosts come with the scene: they are named by its own steps)
      const ghosts = new Set(def.steps.flatMap((s) => ('ghost' in s ? [s.ghost] : [])));
      const named = new Set(def.steps.flatMap((s) => ('say' in s ? [s.say] : 'move' in s ? [s.move] : 'emote' in s ? [s.emote] : [])).filter((who) => !ghosts.has(who)));
      // a villager of the place, the hero, or a companion of the story at their side
      for (const who of named) expect(w.npcs.some((n) => n.id === who) || w.pets.some((p) => !p.dead && p.def.id === who) || who === 'hero', `${def.id}: ${who}`).toBe(true);
      // (or a boss of the land by its name, whose den is on its map: the camera goes to a figure of it standing there,
      // sim/scene.ts where; a boss's arrival is staged so, POLISH_PLAN.md piece 12)
      const den = (id: string): boolean => !!BOSSES[id] && w.map.markers.some((pm) => pm.marker.kind === 'boss' && pm.marker.boss === id);
      for (const s of def.steps) if ('look' in s && s.look !== 'hero') expect(!!w.places[s.look] || w.spots.some((sp) => sp.id === s.look) || w.npcs.some((n) => n.id === s.look) || w.map.buildings.some((b) => b.name === s.look) || den(s.look), `${def.id}: ${s.look}`).toBe(true);
      // a ghost stands somewhere there, in the look of somebody real; an effect goes off somewhere there
      for (const s of def.steps) {
        if ('ghost' in s) {
          expect(s.at === 'hero' || !!w.places[s.at] || w.spots.some((sp) => sp.id === s.at) || w.npcs.some((n) => n.id === s.at), `${def.id}: ghost at ${s.at}`).toBe(true);
          expect(npcLookOf(s.as), `${def.id}: ghost as ${s.as}`).not.toBeNull();
        }
        // (in a dungeon, which names no places, a vision stands round the hero)
        if ('fx' in s) expect(s.at === 'hero' || !!w.places[s.at] || w.spots.some((sp) => sp.id === s.at) || w.npcs.some((n) => n.id === s.at), `${def.id}: fx at ${s.at}`).toBe(true);
      }
      // (left alone, without a tap to hurry it: lines are held long enough to be read slowly, so a long scene takes a
      // couple of minutes; none for ever)
      for (let t = 0; t < 150 && w.scene; t += 1) run(w, 1);
      expect(w.scene, def.id).toBeNull();
      expect(w.hero.opened).toContain(`scene:${def.id}`);
    }
  });

  it('a scene that opens a walk to somewhere plays well before the hero gets there (not after the walk is done)', () => {
    // a place is found (its quest step done) inside its radius; the scene must come into play some tiles further out,
    // while the hero can still be calm: otherwise a fight at a guarded place lets the step finish first and the scene
    // never plays
    let checked = 0;
    for (const def of SCENES) {
      const m = def.when && def.near ? /\{"quest":"([a-z0-9-]+)","is":"active"\}/.exec(JSON.stringify(def.when)) : null;
      const q = m ? QUEST_DEFS[m[1]!] : undefined;
      const walk = q && [q.objective, ...(q.then ?? [])].find((o) => o.kind === 'explore');
      if (!walk || walk.kind !== 'explore' || walk.spot !== def.near) continue;
      const sp = newWorld(def.region, readyHero('mage', q!.level ?? 30)).spots.find((x) => x.id === def.near);
      if (!sp) continue;
      checked++;
      expect(((def.r ?? 90) * WORLD_K - sp.r * TILE) / TILE, `${def.id}: plays only ${(((def.r ?? 90) * WORLD_K - sp.r * TILE) / TILE).toFixed(1)} tiles before ${sp.id} is found`).toBeGreaterThanOrEqual(8);
    }
    expect(checked).toBeGreaterThan(15);
  });

  it('the hero stands still while a scene plays; skipping ends it and it never plays again', () => {
    const def = SCENES[0]!;
    const c = atScene(def.id);
    const w = newWorld(def.region, c);
    startAt(w, def.id);
    expect(w.scene).not.toBeNull();
    const x0 = w.player.x;
    for (let i = 0; i < 30; i++) {
      w.input = { ...emptyInput(), mx: 1 };
      w.step(DT);
    }
    expect(w.player.x).toBe(x0);
    endScene(w, true);
    expect(w.scene).toBeNull();
    const speakers = def.steps.flatMap((s) => ('say' in s ? [s.say] : []));
    expect(w.story.speech.filter((s) => speakers.includes(s.who))).toEqual([]);
    const again = newWorld(def.region, c);
    startAt(again, def.id);
    expect(again.scene?.def.id).not.toBe(def.id);
  });

  it('skipping a scene that watches someone walk in puts them there, and the story goes straight on (the courier)', () => {
    const c = atScene('briar-the-rider-comes');
    const w = newWorld('briarhollow', c);
    startAt(w, 'briar-the-rider-comes');
    expect(w.scene?.def.id).toBe('briar-the-rider-comes');
    // a moment in: the courier is on the road, far from where he falls
    run(w, 1);
    const courier = w.pets.find((p) => p.def.id === 'courier' && !p.dead);
    expect(courier).toBeDefined();
    const falls = w.places['briar-courier-falls']!;
    expect(Math.hypot(courier!.x - falls.x, courier!.y - falls.y)).toBeGreaterThan(40);
    const quest = Object.keys(w.hero.quests).find((q) => w.hero.quests[q]!.state === 'active' && QUEST_DEFS[q]?.objective?.kind === 'event');
    endScene(w, true);
    // not his whole walk later: in a moment, his arrival is over and the quest has moved on
    run(w, 1.5);
    expect(w.story.run?.def.id ?? null).not.toBe('briar-courier');
    if (quest) expect(w.hero.quests[quest]!.state).not.toBe('active');
  });

  it('skipping any scene leaves no one still walking in: the story is never kept waiting on a skipped walk', { timeout: 60_000 }, () => {
    for (const def of SCENES.filter((d) => d.when)) {
      const w = newWorld(def.region, atScene(def.id));
      startAt(w, def.id);
      if (w.scene?.def.id !== def.id) continue;
      run(w, 0.5);
      endScene(w, true);
      run(w, 1.5);
      expect(w.story.run?.def.arrive ? w.story.run.def.id : null, def.id).toBeNull();
    }
  });

  it('a reload in the middle plays the scene again from the start (nothing was kept of it)', () => {
    const def = SCENES[0]!;
    const c = atScene(def.id);
    const w = newWorld(def.region, c);
    startAt(w, def.id);
    run(w, 4);
    expect(w.scene).not.toBeNull();
    const reached = w.scene!.step;
    const saved = migrate(JSON.parse(JSON.stringify({ v: SAVE_VERSION, heroes: [c], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;
    expect(saved.opened).not.toContain(`scene:${def.id}`);
    expect(saved.review).toBe(true);
    const back = newWorld(def.region, saved);
    startAt(back, def.id);
    // (from its first shot again: a step that takes no time, the camera's distance, may already be behind it)
    expect(back.scene?.def.id).toBe(def.id);
    expect(back.scene!.step).toBeLessThanOrEqual(1);
    expect(back.scene!.step).toBeLessThan(reached);
  });

  it('an attack stops a scene, which then plays another time', () => {
    const def = SCENES[0]!;
    const c = atScene(def.id);
    const w = newWorld(def.region, c);
    startAt(w, def.id);
    expect(w.scene).not.toBeNull();
    const foe = w.addEnemy('skeleton', w.player.x + 140, w.player.y, 5, { room: -1, pack: 0 });
    foe.aggro = true;
    run(w, 0.1);
    expect(w.scene).toBeNull();
    expect(c.opened).not.toContain(`scene:${def.id}`);
  });

  it('a sound step plays its sound as it begins and the scene goes straight on', () => {
    const def = SCENES.find((d) => d.steps.some((st) => 'sfx' in st))!;
    expect(def).toBeDefined();
    const w = newWorld(def.region, atScene(def.id));
    const heard: string[] = [];
    const sfx = w.sfx.bind(w);
    w.sfx = (id: string, vol?: number): void => {
      heard.push(id);
      sfx(id, vol);
    };
    startAt(w, def.id);
    expect(w.scene?.def.id).toBe(def.id);
    const first = def.steps.findIndex((st) => 'sfx' in st);
    for (let i = 0; i < 6000 && w.scene && w.scene.step <= first; i++) run(w, DT);
    const step = def.steps[first]!;
    expect(heard).toContain('sfx' in step ? step.sfx : '');
    // the step took no time of its own: the next one is already under way
    expect(w.scene!.step).toBe(first + 1);
  });
});

describe('Sigilfall: the shots that open the great moments', () => {
  const shots = SCENES.filter((d) => d.opens);

  it('the story’s moments open with one, each a story event of its land at a wave it has', () => {
    // (all but the Prologue's first fights, whose own staging is the opening: the gate, the bell, the courier, the inn)
    const opened = new Set(shots.map((d) => d.opens!.event));
    expect(Object.keys(EVENTS).filter((id) => !opened.has(id)).sort()).toEqual(['briar-courier', 'briar-gate', 'briar-inn', 'briar-raid']);
    for (const def of shots) {
      const ev = EVENTS[def.opens!.event];
      expect(ev, def.id).toBeDefined();
      expect(ev!.region, def.id).toBe(def.region);
      const wave = def.opens!.wave ?? 0;
      if (wave > 0 || ev!.waves.length) expect(ev!.waves[wave], `${def.id}: wave ${wave}`).toBeDefined();
      expect(shots.filter((d) => d.opens!.event === def.opens!.event && (d.opens!.wave ?? 0) === wave), def.id).toHaveLength(1);
    }
  });

  for (const def of shots) {
    it(`${def.id}: what comes waits in sight while it plays, then comes, with the call to arms; it plays once`, () => {
      const ev = EVENTS[def.opens!.event]!;
      const wave = def.opens!.wave ?? 0;
      const c = heroAtEvent(ev.id);
      const w = newWorld(ev.region, c);
      // (the land's own packs are not the point)
      w.enemies = [];
      const at = w.places[ev.at] ?? w.spots.find((sp) => sp.id === ev.at)!;
      w.player.x = at.x;
      w.player.y = at.y + 8;
      // to its moment: the event begins, and its waves before this one fall
      for (let f = 0; f < 240 / DT && w.scene?.def.id !== def.id; f++) {
        w.input = emptyInput();
        w.player.hp = w.player.maxHp;
        if (f % 60 === 30) for (const e of w.enemies) if (!e.dead && !e.held && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
        w.step(DT);
      }
      expect(w.scene?.def.id, `${def.id} plays`).toBe(def.id);
      const fight = ev.waves.length > 0;
      if (fight) expect(w.enemies.filter((e) => e.held && !e.dead).length, `${def.id}: the wave, mustered`).toBe(ev.waves[wave]!.enemies.length);
      // (the call to arms waits for the shot)
      const banner = ev.banner ?? { raid: 'Raid!', defend: 'Hold!', rescue: 'Rescue!', escort: 'Escort!', arrival: 'Arrivals' }[ev.kind];
      const called = (): boolean => w.events.some((e) => e.t === 'banner' && e.text === banner);
      if (wave === 0) expect(called(), `${def.id}: no call to arms yet`).toBe(false);
      w.events = [];
      const x0 = w.player.x;
      const y0 = w.player.y;
      let looked = 0;
      for (let f = 0; f < 40 / DT && w.scene; f++) {
        w.input = { ...emptyInput(), mx: 1 };
        w.step(DT);
        // everyone it names is there while it plays: who speaks, who it follows, where it looks
        const s = w.scene;
        const step = s?.def.steps[s.step];
        if (step && 'say' in step) expect(w.enemies.some((e) => !e.dead && e.def.id === step.say) || w.pets.some((p) => !p.dead && p.def.id === step.say) || w.npcs.some((n) => n.id === step.say), `${def.id}: ${step.say}`).toBe(true);
        if (step && 'look' in step && step.look !== 'hero') {
          expect(s!.focus, `${def.id}: ${step.look}`).not.toBeNull();
          looked++;
        }
        if (fight && w.scene) expect(w.enemies.filter((e) => !e.dead && e.aggro).map((e) => e.def.id), `${def.id}: nothing comes on while it plays`).toEqual([]);
      }
      expect(w.scene, `${def.id} ends`).toBeNull();
      if (def.steps.some((st) => 'look' in st && st.look !== 'hero')) expect(looked).toBeGreaterThan(0);
      // (the hero stands: only the people walking past may nudge them)
      expect(Math.hypot(w.player.x - x0, w.player.y - y0)).toBeLessThan(3);
      expect(c.opened).toContain(`scene:${def.id}`);
      w.step(DT);
      if (fight) {
        expect(w.enemies.filter((e) => e.held), `${def.id}: let go`).toEqual([]);
        expect(w.enemies.filter((e) => !e.dead && e.hunts).every((e) => e.aggro)).toBe(true);
      }
      if (wave === 0) expect(called(), `${def.id}: the call to arms`).toBe(true);
      // a line the shot said is not said again after it
      const lines = def.steps.flatMap((st) => ('say' in st ? [st.line] : []));
      w.step(DT);
      expect(w.story.speech.filter((sp) => lines.includes(sp.text))).toEqual([]);
      // and once seen, the fight starts straight away another time
      const again = newWorld(ev.region, c);
      again.enemies = [];
      again.player.x = at.x;
      again.player.y = at.y + 8;
      for (let f = 0; f < 240 / DT && again.story.run?.def.id !== ev.id; f++) again.step(DT);
      for (let f = 0; f < 3 / DT; f++) again.step(DT);
      expect(again.scene?.def.id ?? null).not.toBe(def.id);
    });
  }

  it('a boss met for the first time is shown before it comes on, its name in the lower bar; once', () => {
    const c = readyHero('warrior', 12);
    c.opened = c.opened.filter((k) => !k.startsWith('scene:boss-'));
    const w = newWorld('crypt', c);
    w.enemies = w.enemies.filter((e) => e.room < 0);
    const enc = w.encounters.find((e) => e.def.boss)!;
    expect(enc).toBeDefined();
    const room = w.map.roomTiles[enc.index]!;
    const i = room[Math.floor(room.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    run(w, 0.1);
    const boss = w.boss()!;
    expect(boss).toBeDefined();
    expect(w.scene?.def.id).toBe(`boss-${enc.def.boss}`);
    expect(boss.held).toBe(true);
    let titled = false;
    const hp = w.player.hp;
    for (let f = 0; f < 20 / DT && w.scene; f++) {
      run(w, DT);
      if (w.scene?.title?.text === BOSSES[enc.def.boss!]!.name) titled = true;
    }
    expect(titled).toBe(true);
    expect(w.scene).toBeNull();
    expect(w.player.hp).toBe(hp);
    expect(boss.held).toBe(false);
    expect(boss.aggro).toBe(true);
    expect(c.opened).toContain(`scene:boss-${enc.def.boss}`);
  });
});

