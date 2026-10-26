import { dist, TAU } from '../core/math';
import { EVENTS } from '../data/events';
import type { Bark, RegionDef, RegionStateDef, StoryCond, StoryEventDef } from '../data/types';
import { activeQuests, questState, type Character } from '../progress/character';
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
}

const BARK_TIME = 2.8;

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

  /** Is a story fight going on (the HUD shows, the region is not safe)? */
  get fighting(): boolean {
    return !!this.run;
  }

  /** Queues lines to be said one after another. */
  say(lines: Bark[] | undefined): void {
    if (lines) this.queue.push(...lines);
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
      const dur = BARK_TIME + b.text.length * 0.02;
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
    const run: Running = { def, wave: 0, ids: [], pause: 1.6, pets: [], ward: null, followers: [], safe: new Set(), cool: 0 };
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
    this.run = run;
    this.say(def.start);
    w.emit({ t: 'banner', text: def.kind === 'raid' ? 'Raid!' : def.kind === 'defend' ? 'Hold!' : 'Rescue!', sub: w.questLabel(def.id) });
    w.sfx('roar', 0.7);
  }

  private spawnWave(run: Running): void {
    const w = this.w;
    const wave = run.def.waves[run.wave];
    if (!wave) return;
    const level = run.def.level ?? w.level;
    run.ids = wave.enemies.map((id, i) => {
      const from = this.spot(wave.from[i % wave.from.length]!) ?? { x: w.player.x, y: w.player.y - 80 };
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
    // the hero fell, or walked off: it all starts again when they come back
    // a rescue leads people somewhere else: the way there is part of it
    const places = [this.spot(def.at), def.rescue ? this.spot(def.rescue.to) : null].filter((p): p is { x: number; y: number } => !!p);
    const away = places.length > 0 && places.every((p) => dist(w.player.x, w.player.y, p.x, p.y) > (def.radius + 14) * TILE);
    if (w.player.dead || away) {
      this.abort(run, w.player.dead ? def.retry : undefined);
      return;
    }
    // the door gave way
    if (run.ward && run.ward.dead) {
      this.abort(run, def.retry);
      return;
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
    if (run.wave + 1 < def.waves.length) {
      run.wave += 1;
      run.pause = 2.2;
      return;
    }
    if (def.rescue && run.safe.size < run.followers.length) return;
    this.finish(run);
  }

  private clear(run: Running): void {
    const w = this.w;
    for (const pet of run.pets) pet.dead = true;
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
    this.clear(run);
    this.say(run.def.end);
    w.questProgress((o) => o.kind === 'event' && o.event === run.def.id);
    w.emit({ t: 'save' });
  }
}
