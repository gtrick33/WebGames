import { dist, TAU } from '../core/math';
import { EVENTS } from '../data/events';
import { TIERS } from '../data/regions';
import type { Bark, RegionDef, RegionStateDef, StoryCond, StoryEventDef } from '../data/types';
import { activeQuests, declined, questState, type Character } from '../progress/character';
import { castRay, TILE } from './map';
import { placePet } from './pets';
import type { Pet } from './types';
import type { World } from './world';

/**
 * The story in the world (STORY_BIBLE.md §4, blueprint §4.2): which state a region is in, the scripted
 * events quests ask for (raids, defenses, rescues), and the lines people say while they happen. All of it
 * runs on the ordinary simulation: an event's raiders are enemies, its companions, its door and the
 * people being led out are pets, so nothing here is a cutscene. An event that is interrupted (the hero
 * falls, the door breaks, the hero leaves) starts over from its first wave; it never pays twice.
 */

/** Whether a story condition holds for a hero. */
export function holds(c: Character, cond: StoryCond): boolean {
  if ('all' in cond) return cond.all.every((x) => holds(c, x));
  if ('any' in cond) return cond.any.some((x) => holds(c, x));
  if ('not' in cond) return !holds(c, cond.not);
  const s = questState(c, cond.quest);
  if (cond.is === 'taken') return s === 'done' && !declined(c, cond.quest);
  return cond.is === 'started' ? s !== 'locked' : s === cond.is;
}

/** The state a region is in for this hero (the first whose condition holds), or null. */
export function regionState(region: RegionDef, c: Character): RegionStateDef | null {
  return region.states?.find((s) => holds(c, s.when)) ?? null;
}

/** A line over someone's head. */
export interface Speech {
  who: string;
  text: string;
  t: number;
  dur: number;
}

interface Running {
  def: StoryEventDef;
  wave: number;
  /** Enemy ids of the wave in the field. */
  ids: number[];
  /** Seconds before the next wave comes. */
  pause: number;
  pets: Pet[];
  ward: Pet | null;
  followers: Pet[];
  /** Followers that reached safety. */
  safe: Set<number>;
  /** Seconds before an interrupted event can start again. */
  cool: number;
  /** Seconds since it began. */
  t: number;
}

const BARK_TIME = 2.8;
/** How long a line stays over someone's head. */
const barkTime = (b: Bark): number => BARK_TIME + b.text.length * 0.02;

export class StoryDirector {
  private readonly w: World;
  run: Running | null = null;
  /** Lines waiting their turn (one speaker at a time). */
  private queue: Bark[] = [];
  private gap = 0;
  speech: Speech[] = [];
  private stateT = 0;
  /** Seconds before a failed event may begin again. */
  private cool = 0;

  constructor(w: World) {
    this.w = w;
  }

  /** Is a story fight going on (the HUD shows, the region is not safe)? People arriving are not one. */
  get fighting(): boolean {
    return !!this.run && this.run.def.kind !== 'arrival';
  }

  /** Queues lines to be said one after another. */
  say(lines: Bark[] | undefined): void {
    if (lines) this.queue.push(...lines);
  }

  /** A line said at once, for as long as given (a scene's: sim/scene.ts paces them itself). */
  speakNow(b: Bark, dur: number): void {
    this.speech = this.speech.filter((s) => s.who !== b.who);
    this.speech.push({ who: b.who, text: b.text, t: 0, dur });
  }

  /** These people stop talking (a skipped scene's lines are not left hanging). */
  hush(who: string[]): void {
    this.speech = this.speech.filter((s) => !who.includes(s.who));
  }

  update(dt: number): void {
    const w = this.w;
    // lines over heads
    for (const s of this.speech) s.t += dt;
    this.speech = this.speech.filter((s) => s.t < s.dur);
    this.gap -= dt;
    if (this.gap <= 0 && this.queue.length) {
      const b = this.queue.shift()!;
      this.speech = this.speech.filter((s) => s.who !== b.who);
      const dur = barkTime(b);
      this.speech.push({ who: b.who, text: b.text, t: 0, dur });
      // the next line waits until this one has been read (two bubbles never overlap)
      this.gap = dur;
    }
    // the region's state follows the story
    this.stateT -= dt;
    if (this.stateT <= 0) {
      this.stateT = 0.5;
      w.refreshStoryState();
    }
    // a burning village: sparks and smoke rising off the roofs; after the fire, only smoke
    const st = w.storyState;
    if (st?.smoke) this.smoulder(dt);
    if (st?.burning) {
      for (const f of w.fires) {
        if (w.rand() < dt * (1.5 + f.size)) w.addFx({ kind: 'ember', x: f.x + (w.rand() - 0.5) * 8, y: f.y - 6, vx: (w.rand() - 0.5) * 14, vy: -26 - w.rand() * 20, life: 0.9 + w.rand() * 0.6, size: 1, color: w.rand() < 0.5 ? '#ffb04d' : '#ff6a2a' });
        if (w.rand() < dt * 1.2) w.addFx({ kind: 'smoke', x: f.x + (w.rand() - 0.5) * 6, y: f.y - 12, vx: 6 + w.rand() * 6, vy: -14 - w.rand() * 8, life: 1.6, size: 5 + Math.floor(w.rand() * 4), color: '#4a4450' });
      }
    }
    // grieflight over a fouled shrine, rot over a poisoned well: a slow plume and a few motes
    for (const p of w.wisps) {
      if (w.rand() < dt * (1.4 + p.size * 0.6)) w.addFx({ kind: 'smoke', x: p.x + (w.rand() - 0.5) * 10, y: p.y - 4, vx: (w.rand() - 0.5) * 6, vy: -8 - w.rand() * 6, life: 2.4, size: 5 + p.size * 2 + Math.floor(w.rand() * 3), color: p.color });
      if (w.rand() < dt * (2 + p.size)) w.addFx({ kind: 'ember', x: p.x + (w.rand() - 0.5) * 16, y: p.y - 2, vx: (w.rand() - 0.5) * 8, vy: -12 - w.rand() * 10, life: 1.4, size: 1, color: p.color });
    }
    this.cool = Math.max(0, this.cool - dt);
    if (this.run) this.step(this.run, dt);
    else if (this.cool <= 0) this.maybeStart();
  }

  /** After a fire: smoke curls up from where the fires were. */
  private smoulder(dt: number): void {
    const w = this.w;
    for (const pm of w.map.markers) {
      if (pm.marker.kind !== 'fire' || w.rand() > dt * 0.5) continue;
      w.addFx({ kind: 'smoke', x: (pm.tx + 0.5) * TILE, y: (pm.ty + 0.5) * TILE - 6, vx: 4 + w.rand() * 4, vy: -10 - w.rand() * 6, life: 2, size: 4 + Math.floor(w.rand() * 3), color: '#5a5460' });
    }
  }

  /** An event a quest asks for here, once the hero comes close to where it happens. */
  private maybeStart(): void {
    const w = this.w;
    if (w.player.dead) return;
    for (const q of activeQuests(w.hero)) {
      if (q.objective.kind !== 'event') continue;
      const def = EVENTS[q.objective.event];
      if (!def || def.region !== w.region.id) continue;
      const at = this.spot(def.at);
      if (!at || dist(w.player.x, w.player.y, at.x, at.y) > def.radius * TILE) continue;
      this.start(def);
      return;
    }
  }

  private spot(id: string): { x: number; y: number } | null {
    return this.w.places[id] ?? this.w.spots.find((s) => s.id === id) ?? null;
  }

  private start(def: StoryEventDef): void {
    const w = this.w;
    // nobody rides into the story's fights
    w.dismount();
    // whoever stayed on from the last event to say goodbye makes way for this one's people
    w.pets = w.pets.filter((p) => !p.story || p.dead);
    const run: Running = { def, wave: 0, ids: [], pause: 1.6, pets: [], ward: null, followers: [], safe: new Set(), cool: 0, t: 0 };
    for (const id of def.allies ?? []) {
      const to = castRay(w.map, w.player.x, w.player.y, 6, w.rand() * TAU, 18);
      const pet = placePet(w, id, to.x, to.y);
      if (pet) run.pets.push(pet);
    }
    if (def.ward) {
      const at = this.spot(def.ward.at);
      if (at) run.ward = placePet(w, def.ward.pet, at.x, at.y);
      if (run.ward) run.pets.push(run.ward);
    }
    if (def.rescue) {
      const at = this.spot(def.rescue.at);
      if (at) {
        def.rescue.pets.forEach((id, i) => {
          const a = (TAU * i) / def.rescue!.pets.length;
          const pet = placePet(w, id, at.x + Math.cos(a) * 10, at.y + Math.sin(a) * 8);
          if (pet) {
            run.followers.push(pet);
            run.pets.push(pet);
          }
        });
      }
    }
    if (def.arrive) {
      const from = this.spot(def.arrive.from);
      const to = this.spot(def.arrive.to);
      if (from && to) {
        def.arrive.pets.forEach((id, i) => {
          // in a loose line down the road, and a loose knot where they stop
          const pet = placePet(w, id, from.x + ((i % 3) - 1) * 10, from.y - Math.floor(i / 3) * 14);
          if (!pet) return;
          const a = (TAU * i) / def.arrive!.pets.length;
          pet.goal = { x: to.x + Math.cos(a) * 14, y: to.y + Math.sin(a) * 10 };
          run.followers.push(pet);
          run.pets.push(pet);
        });
      }
    }
    if (def.escort) {
      const from = this.spot(def.escort.from);
      const to = this.spot(def.escort.to);
      if (from && to) {
        run.ward = placePet(w, def.escort.wagon, from.x, from.y);
        if (run.ward) {
          run.ward.goal = { ...to };
          run.pets.push(run.ward);
        }
        (def.escort.walkers ?? []).forEach((id, i) => {
          // the people walk alongside and behind the wagon
          const pet = placePet(w, id, from.x + ((i % 2) * 2 - 1) * 14, from.y + 10 + Math.floor(i / 2) * 12);
          if (!pet) return;
          pet.goal = { x: to.x + ((i % 2) * 2 - 1) * 14, y: to.y + 10 + Math.floor(i / 2) * 10 };
          run.followers.push(pet);
          run.pets.push(pet);
        });
      }
    }
    this.run = run;
    this.say(def.start);
    const banner = def.banner ?? (def.kind === 'raid' ? 'Raid!' : def.kind === 'defend' ? 'Hold!' : def.kind === 'rescue' ? 'Rescue!' : def.kind === 'escort' ? 'Escort!' : 'Arrivals');
    w.emit({ t: 'banner', text: banner, sub: w.questLabel(def.id) });
    if (def.kind === 'arrival') w.sfx('quest', 0.7);
    else w.sfx('roar', 0.7);
  }

  private spawnWave(run: Running): void {
    const w = this.w;
    const wave = run.def.waves[run.wave];
    if (!wave) return;
    // someone leaves the fight as the wave comes (a betrayal, a flight)
    for (const id of wave.leave ?? []) {
      for (const p of run.pets) if (p.def.id === id && !p.dead) {
        w.addFx({ kind: 'smoke', x: p.x, y: p.y, life: 0.6, size: 7, color: '#8a8494' });
        p.dead = true;
      }
    }
    // an event's own level climbs with the difficulty like any pack's
    const level = run.def.level !== undefined ? run.def.level + TIERS[w.tier]!.levels : w.level;
    // on the road, they come at the wagon from wherever it has got to
    const wagon = run.def.escort ? run.ward : null;
    run.ids = wave.enemies.map((id, i) => {
      const from = wagon ? castRay(w.map, wagon.x, wagon.y, 6, w.rand() * TAU, 150) : (this.spot(wave.from[i % wave.from.length]!) ?? { x: w.player.x, y: w.player.y - 80 });
      const a = w.rand() * TAU;
      const to = castRay(w.map, from.x, from.y, 6, a, 8 + w.rand() * 18);
      const e = w.addEnemy(id, to.x, to.y, level, { room: -1, pack: -1, spawn: true });
      e.aggro = true;
      return e.id;
    });
    this.say(wave.barks);
  }

  private step(run: Running, dt: number): void {
    const w = this.w;
    const def = run.def;
    run.t += dt;
    // a fight that is not won ends when the story says, with the hero still standing
    if (def.ends && run.t >= def.ends) {
      this.finish(run);
      return;
    }
    // the hero fell, or walked off: it all starts again when they come back
    // a rescue leads people somewhere else: the way there is part of it
    const places = [this.spot(def.at), def.rescue ? this.spot(def.rescue.to) : null].filter((p): p is { x: number; y: number } => !!p);
    // (people being led home keep up with the hero, however far home is; a wagon is wherever it has got to)
    if (run.ward && def.escort) places.splice(0, places.length, run.ward);
    const away = !def.rescue && places.length > 0 && places.every((p) => dist(w.player.x, w.player.y, p.x, p.y) > (def.radius + 14) * TILE);
    if (def.kind === 'arrival') {
      this.arriving(run, dt);
      return;
    }
    if (w.player.dead || away) {
      this.abort(run, w.player.dead ? def.retry : undefined);
      return;
    }
    // the door gave way
    if (run.ward && run.ward.dead) {
      this.abort(run, def.retry);
      return;
    }
    // the wagon stops while foes are close to it, and the people with it
    if (def.escort && run.ward) {
      const threat = w.enemies.some((e) => !e.dead && e.state !== 'spawn' && dist(e.x, e.y, run.ward!.x, run.ward!.y) < 100);
      for (const p of [run.ward, ...run.followers]) p.paused = threat;
    }
    // the people being led out: found when the hero reaches them, safe at the far spot
    if (def.rescue) {
      const to = this.spot(def.rescue.to);
      for (const f of run.followers) {
        if (to && dist(f.x, f.y, to.x, to.y) < 3 * TILE && !run.safe.has(f.id)) {
          run.safe.add(f.id);
          w.text(f.x, f.y - 18, 'Safe!', '#9cff9c', false);
        }
      }
    }
    if (run.pause > 0) {
      run.pause -= dt;
      if (run.pause <= 0) this.spawnWave(run);
      return;
    }
    const alive = run.ids.some((id) => w.enemies.some((e) => e.id === id && !e.dead));
    if (alive) return;
    // a wagon on the road: done once it is in and nothing is on it, whatever waves were still to come
    const wagonIn = !def.escort || (!!run.ward?.goal && dist(run.ward.x, run.ward.y, run.ward.goal.x, run.ward.goal.y) <= 2 * TILE);
    if (def.escort && wagonIn) {
      this.finish(run);
      return;
    }
    // a lost fight keeps coming until it ends
    if (def.ends && run.wave + 1 >= def.waves.length) {
      run.pause = 1.5;
      return;
    }
    if (run.wave + 1 < def.waves.length) {
      run.wave += 1;
      // on the road the next ambush waits further along
      run.pause = def.escort ? 7 : 2.2;
      return;
    }
    if (def.rescue && run.safe.size < run.followers.length) return;
    if (!wagonIn) return;
    this.finish(run);
  }

  /** People walking in: done when everyone is where they were going (or, held up, after a while anyway). */
  private arriving(run: Running, dt: number): void {
    run.pause -= dt;
    const there = run.followers.every((f) => !f.goal || dist(f.x, f.y, f.goal.x, f.goal.y) < 2 * TILE);
    if (!there && run.pause > -45) return;
    this.finish(run);
  }

  /** Ends an event: its foes go, and its people too (after `stay` seconds, to say their last lines). */
  private clear(run: Running, stay = 0): void {
    const w = this.w;
    // people who walked in stay (as the camp's own people, the moment the quest moves on); the rest go
    if (run.def.kind === 'arrival') w.pets = w.pets.filter((p) => !run.pets.includes(p));
    else for (const pet of run.pets) {
      // the one carried off goes at once, in a swirl of grey
      const taken = run.def.taken?.includes(pet.def.id);
      if (taken && !pet.dead) w.addFx({ kind: 'smoke', x: pet.x, y: pet.y, life: 1, size: 12, color: '#6a5a8a' });
      if (stay > 0 && !pet.dead && !taken) pet.life = Math.min(pet.life, stay);
      else pet.dead = true;
    }
    for (const e of w.enemies) if (run.ids.includes(e.id) && !e.dead) {
      e.dead = true;
      e.deathT = 0;
      w.addFx({ kind: 'smoke', x: e.x, y: e.y, life: 0.6, size: 8, color: '#8a8494' });
    }
    this.run = null;
  }

  private abort(run: Running, lines?: Bark[]): void {
    this.clear(run);
    this.queue = [];
    this.say(lines);
    this.cool = 4;
  }

  private finish(run: Running): void {
    const w = this.w;
    // the lines still to be said, then the event's own last words, then they go
    const stay = Math.max(0, this.gap) + [...this.queue, ...(run.def.end ?? [])].reduce((t, b) => t + barkTime(b), 0) + 0.8;
    this.clear(run, stay);
    this.say(run.def.end);
    w.questProgress((o) => o.kind === 'event' && o.event === run.def.id);
    w.refreshStoryState();
    w.emit({ t: 'save' });
  }
}
