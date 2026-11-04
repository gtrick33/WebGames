import { dist, TAU } from '../core/math';
import { EVENTS } from '../data/events';
import { PETS } from '../data/pets';
import { NPCS } from '../data/quests';
import { TIERS } from '../data/regions';
import type { Bark, RegionDef, RegionStateDef, StoryCond, StoryEventDef } from '../data/types';
import { activeQuests, declined, questState, type Character, currentObjective } from '../progress/character';
import { skillCost } from './cast';
import { castRay, K, TILE } from './map';
import { placePet } from './pets';
import { openShot, shotDue } from './scene';
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
  // a quest waiting to be handed in is still under way: whoever stands for it stays until it is
  if (cond.is === 'active') return s === 'active' || s === 'ready';
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
  /**
   * A shot of it is playing (data/scenes.ts `opens`): what waits for it to be over (the call to arms, the
   * wave's lines).
   */
  held: (() => void) | null;
  /** Lines its shots have said (not said again after them). */
  said: Set<string>;
  /** Its last foe has fallen (the moment was slowed). */
  won?: boolean;
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
        const lit = w.fireLit(f);
        if (!lit) continue;
        if (w.rand() < dt * (1.5 + f.size) * lit) w.addFx({ kind: 'ember', x: f.x + (w.rand() - 0.5) * 8, y: f.y - 6, vx: (w.rand() - 0.5) * 14, vy: -26 - w.rand() * 20, life: 0.9 + w.rand() * 0.6, size: 1, color: w.rand() < 0.5 ? '#ffb04d' : '#ff6a2a' });
        if (w.rand() < dt * 1.2) w.addFx({ kind: 'smoke', x: f.x + (w.rand() - 0.5) * 6, y: f.y - 12, vx: 6 + w.rand() * 6, vy: -14 - w.rand() * 8, life: 1.6, size: 5 + Math.floor(w.rand() * 4), color: '#4a4450' });
      }
    }
    // grieflight over a fouled shrine, rot over a poisoned well: a slow plume and a few motes
    for (const p of w.wisps) {
      if (w.rand() < dt * (1.4 + p.size * 0.6)) w.addFx({ kind: 'smoke', x: p.x + (w.rand() - 0.5) * 10, y: p.y - 4, vx: (w.rand() - 0.5) * 6, vy: -8 - w.rand() * 6, life: 2.4, size: 5 + p.size * 2 + Math.floor(w.rand() * 3), color: p.color });
      if (w.rand() < dt * (2 + p.size)) w.addFx({ kind: 'ember', x: p.x + (w.rand() - 0.5) * 16, y: p.y - 2, vx: (w.rand() - 0.5) * 8, vy: -12 - w.rand() * 10, life: 1.4, size: 1, color: p.color });
    }
    this.cool = Math.max(0, this.cool - dt);
    // questing together, the story's fights are the leader's (a guest sees their foes, mirrored)
    if (w.puppet) return;
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
      const o = currentObjective(w.hero, q);
      if (o.kind !== 'event') continue;
      const def = EVENTS[o.event];
      if (!def || def.region !== w.region.id) continue;
      const at = this.spot(def.at);
      if (!at || dist(w.player.x, w.player.y, at.x, at.y) > def.radius * TILE) continue;
      // (one with a shot of its own waits for a scene playing to end, and begins with it)
      if (w.scene && shotDue(w, def.id, 0)) continue;
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
    // the region turns to this event's state first: whoever it takes from where they stood steps out to fight
    w.refreshStoryState();
    const run: Running = { def, wave: 0, ids: [], pause: 1.6, pets: [], ward: null, followers: [], safe: new Set(), cool: 0, t: 0, held: null, said: new Set() };
    const allies = [...(def.allies ?? []), ...(def.alliesIf ?? []).filter((a) => holds(w.hero, a.when)).map((a) => a.pet)];
    for (const id of allies) {
      const pet = this.ally(def, id, run.pets);
      if (pet) run.pets.push(pet);
    }
    if (def.ward) {
      const spot = this.spot(def.ward.at);
      // (a boat is moored at the water's edge nearest its place, never left on dry land)
      const at = spot && PETS[def.ward.pet]?.look === 'boat' ? moor(w, spot) : spot;
      if (at) run.ward = placePet(w, def.ward.pet, at.x, at.y);
      if (run.ward) run.pets.push(run.ward);
    }
    if (def.rescue) {
      const at = this.spot(def.rescue.at);
      if (at) {
        def.rescue.pets.forEach((id, i) => {
          const n = def.rescue!.pets.length;
          const a = (TAU * i) / n;
          const round = n > 1 ? Math.max(ROOM, (n * ROOM) / 3) : 0;
          const by = beside(w, at, Math.cos(a) * round, Math.sin(a) * round * 0.8);
          const pet = placePet(w, id, by.x, by.y);
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
          // in a loose line down the road, and a loose ring where they stop, with room between them
          const by = beside(w, from, ((i % 3) - 1) * ROOM, -Math.floor(i / 3) * ROOM * 1.2);
          const pet = placePet(w, id, by.x, by.y);
          if (!pet) return;
          // (one alone goes to the spot itself: where they stop is where the place's own person stands)
          const n = def.arrive!.pets.length;
          const a = (TAU * i) / n;
          const round = n > 1 ? Math.max(ROOM * 1.5, (n * ROOM) / 2) : 0;
          pet.goal = beside(w, to, Math.cos(a) * round, Math.sin(a) * round * 0.8);
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
          const by = beside(w, from, ((i % 2) * 2 - 1) * ROOM, 14 + Math.floor(i / 2) * ROOM);
          const pet = placePet(w, id, by.x, by.y);
          if (!pet) return;
          pet.goal = beside(w, to, ((i % 2) * 2 - 1) * ROOM, 14 + Math.floor(i / 2) * ROOM);
          run.followers.push(pet);
          run.pets.push(pet);
        });
      }
    }
    this.run = run;
    // a great moment opens with a shot of it (data/scenes.ts): its first wave mustered in sight, and the call
    // to arms once the shot is over
    if (this.shot(run, 0)) {
      if (def.waves.length) {
        this.spawnWave(run, true);
        run.pause = 0;
      }
      run.held = () => {
        this.callToArms(run);
        if (def.waves.length) this.callWave(run);
      };
      return;
    }
    this.callToArms(run);
  }

  /** The event's first lines, its banner and its sound. */
  private callToArms(run: Running): void {
    const w = this.w;
    const def = run.def;
    this.say(this.unsaid(run, def.start));
    const banner = def.banner ?? (def.kind === 'raid' ? 'Raid!' : def.kind === 'defend' ? 'Hold!' : def.kind === 'rescue' ? 'Rescue!' : def.kind === 'escort' ? 'Escort!' : 'Arrivals');
    w.emit({ t: 'banner', text: banner, sub: w.questLabel(def.id) });
    if (def.kind === 'arrival') w.sfx('quest', 0.7);
    else w.sfx('roar', 0.7);
  }

  /** Plays the shot of this moment of the event (its start, or wave `wave`), if it has one not yet seen. */
  private shot(run: Running, wave: number): boolean {
    const w = this.w;
    if (!openShot(w, run.def.id, wave)) return false;
    for (const st of w.scene!.def.steps) if ('say' in st) run.said.add(st.line);
    return true;
  }

  private unsaid(run: Running, lines: Bark[] | undefined): Bark[] | undefined {
    return lines?.filter((b) => !run.said.has(b.text));
  }

  /**
   * One of an event's allies, without anyone popping up at the hero's elbow: whoever stayed on from the last
   * event is already here; whoever the story just took from where they stood (Mara at the gate) steps out
   * from there; anyone else comes running from the side they come from, from just beyond the hero's view
   * (or, if that side is in view, is found there).
   */
  private ally(def: StoryEventDef, id: string, have: Pet[]): Pet | null {
    const w = this.w;
    const p = w.player;
    const stayed = w.pets.find((q) => q.story && !q.dead && q.def.id === id && !have.includes(q));
    if (stayed) {
      stayed.life = Infinity;
      stayed.goal = undefined;
      stayed.flow = undefined;
      stayed.route = undefined;
      stayed.inside = undefined;
      if (dist(stayed.x, stayed.y, p.x, p.y) > 3 * TILE) join(stayed, p);
      return stayed;
    }
    const look = PETS[id]?.look;
    const stood = w.leftNpcs.find((n) => n.id === look && w.time - n.left < 1.5 && dist(n.x, n.y, p.x, p.y) < 10 * TILE);
    if (stood) {
      w.leftNpcs = w.leftNpcs.filter((n) => n !== stood);
      // (the same person, there all along: no fade)
      const pet = placePet(w, id, stood.x, stood.y);
      if (pet) pet.born = undefined;
      return pet;
    }
    const from = this.spot(def.enter ?? def.at);
    const seen = from && def.enter && dist(from.x, from.y, p.x, p.y) < 10 * TILE;
    const at = seen ? castRay(w.map, from.x, from.y, 6, w.rand() * TAU, ROOM + w.rand() * ROOM) : offscreen(w, from && dist(from.x, from.y, p.x, p.y) > 2 * TILE ? Math.atan2(from.y - p.y, from.x - p.x) : w.rand() * TAU);
    const pet = placePet(w, id, at.x, at.y);
    if (pet && !seen) join(pet, p);
    return pet;
  }

  /** The next wave comes: seen coming in a shot of it, if that is a great moment; else straight in. */
  private comes(run: Running): void {
    if (run.wave > 0 && this.shot(run, run.wave)) {
      this.spawnWave(run, true);
      run.held = () => this.callWave(run);
      return;
    }
    this.spawnWave(run);
    this.callWave(run);
  }

  /** The wave's foes, hunting the hero (or, `held` in a shot of them, standing where they mustered). */
  private spawnWave(run: Running, held = false): void {
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
    const turn = w.rand() * TAU;
    run.ids = wave.enemies.map((id, i) => {
      const spot = this.spot(wave.from[i % wave.from.length]!);
      // (the lands are big: a wave named for a far road comes that way from just out of sight, or nobody would be
      // fighting for the first ten seconds. Only one that's being shown mustering stays where it's shown)
      const close = !!spot && (run.def.close || (!held && Math.hypot(spot.x - w.player.x, spot.y - w.player.y) > FAR_WALK));
      const from = wagon ? castRay(w.map, wagon.x, wagon.y, 6, w.rand() * TAU, 150) : close ? offscreen(w, Math.atan2(spot.y - w.player.y, spot.x - w.player.x)) : (spot ?? { x: w.player.x, y: w.player.y - 80 });
      // (a wave that comes in just beyond the hero's view stays close to that edge: each has its own way in already)
      const fan = ROOM * (0.7 + Math.sqrt(i) * 0.8);
      const to = castRay(w.map, from.x, from.y, 6, turn + i * 2.4, close ? Math.min(fan, ROOM * 0.9) : fan);
      const e = w.addEnemy(id, to.x, to.y, level, { room: -1, pack: -1, spawn: true });
      e.aggro = !held;
      e.held = held || undefined;
      e.hunts = true;
      return e.id;
    });
  }

  /** What the wave's coming says: its lines, the control it teaches. */
  private callWave(run: Running): void {
    const w = this.w;
    const wave = run.def.waves[run.wave];
    if (!wave) return;
    this.say(this.unsaid(run, wave.barks));
    if (wave.hint) w.emit({ t: 'hint', id: wave.hint });
    // the skill's lesson works the first time: a hero whose skill costs what striking builds (rage, holy
    // power) has enough for it as the wave that asks for it comes
    const s1 = w.build.bar.s1;
    const spec = s1 ? w.build.skills[s1]?.spec : undefined;
    const kind = w.build.resource?.kind;
    if (wave.hint === 'skill' && spec && (kind === 'rage' || kind === 'holy')) w.player.mana = Math.max(w.player.mana, skillCost(w, spec, 's1'));
  }

  private step(run: Running, dt: number): void {
    const w = this.w;
    const def = run.def;
    // a shot of it playing: the fight waits for it to be over
    if (run.held) {
      if (w.scene) return;
      const go = run.held;
      run.held = null;
      go();
    }
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
      if (run.pause <= 0) this.comes(run);
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
    // the last of them falls: a moment of slow motion on it
    if (!run.won) {
      run.won = true;
      const last = w.enemies.filter((e) => e.dead && run.ids.includes(e.id)).sort((a, b) => a.deathT - b.deathT)[0];
      if (last) w.slowmo(0.9, { x: last.x, y: last.y });
    }
    if (def.rescue && run.safe.size < run.followers.length) return;
    if (!wagonIn) return;
    this.finish(run);
  }

  /** People walking in: done when everyone is where they were going (or, held up, after a while anyway). */
  private arriving(run: Running, dt: number): void {
    run.pause -= dt;
    // there: on the spot (or as near as they can get, and stopped)
    const there = run.followers.every((f) => {
      if (!f.goal) return true;
      const d = dist(f.x, f.y, f.goal.x, f.goal.y);
      return d < 6 || (d < 2 * TILE && Math.hypot(f.vx, f.vy) < 4);
    });
    if (!there && run.pause > -45) return;
    this.finish(run);
  }

  /** Ends an event: its foes go, and its people too (after `stay` seconds, to say their last lines). */
  private clear(run: Running, stay = 0): void {
    const w = this.w;
    // people who walked in stay, as the place's own people the moment the quest moves on (finish() hands each
    // to the one standing where they stopped; the rest fade); the others go
    if (run.def.kind === 'arrival') {
      for (const pet of run.pets) {
        pet.dead = true;
        pet.deathT = 0;
      }
    } else {
      const into = run.def.rescue?.into ? this.spot(run.def.rescue.into) : null;
      for (const pet of run.pets) {
        // the one carried off goes at once, in a swirl of grey
        const taken = run.def.taken?.includes(pet.def.id);
        if (taken && !pet.dead) w.addFx({ kind: 'smoke', x: pet.x, y: pet.y, life: 1, size: 12, color: '#6a5a8a' });
        if (stay > 0 && !pet.dead && !taken) {
          pet.life = Math.min(pet.life, stay);
          pet.joinT = undefined;
          // the saved go in where they are safe; the rest who aren't going on with the hero stand where they
          // are to say their last words
          if (into && run.followers.includes(pet)) {
            pet.goal = { ...into };
            pet.inside = true;
          } else if (!run.def.stay && pet.def.role !== 'ward' && !run.followers.includes(pet)) pet.goal = { x: pet.x, y: pet.y };
          else if (!run.followers.includes(pet)) pet.goal = undefined;
          pet.flow = undefined;
          pet.route = undefined;
        } else pet.dead = true;
      }
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
    const walkedIn = run.def.kind === 'arrival' ? run.followers.filter((f) => !f.dead) : [];
    // the lines still to be said, then the event's own last words, then they go
    const stay = Math.max(0, this.gap) + [...this.queue, ...(run.def.end ?? [])].reduce((t, b) => t + barkTime(b), 0) + 0.8 + (run.def.stay ?? 0);
    this.clear(run, stay);
    this.say(run.def.end);
    w.questProgress((o) => o.kind === 'event' && o.event === run.def.id);
    // questing together: the party's other heroes were there too (their quests for it count)
    if (w.coop?.role === 'host') w.coop.out.push({ t: 'event', id: run.def.id });
    w.refreshStoryState();
    // whoever walked in to where the place's own person now stands simply is that person (no fade, no jump);
    // one who lies where they fell (the courier) falls there
    for (const pet of walkedIn) {
      const n = w.npcs.find((m) => m.id === pet.def.look && m.since !== undefined && dist(m.x, m.y, pet.x, pet.y) < 1.5 * TILE);
      if (!n) continue;
      n.since = undefined;
      if (NPCS[n.id]?.down) n.fell = w.time;
      w.pets = w.pets.filter((p) => p !== pet);
    }
    w.emit({ t: 'save' });
  }
}

/** The room one person takes in a group the story places, in world pixels: their model's width and a little air. */
const ROOM = 28;

/**
 * A place a step from a spot, for someone standing in a knot or a line round it: the step as it is if the
 * ground there is open, else the same step the other way or to the other side, else as far as the ground
 * goes (nobody is put down in a wall or a house, to stand there for good: Duskfen's caravan lost its people so).
 */
function beside(w: World, at: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (!d) return { x: at.x, y: at.y };
  for (const [x, y] of [[dx, dy], [-dx, -dy], [dx, -dy], [-dx, dy]] as const) {
    const to = castRay(w.map, at.x, at.y, 5, Math.atan2(y, x), d);
    if (Math.hypot(to.x - at.x, to.y - at.y) > d - 0.25) return { x: at.x + x, y: at.y + y };
  }
  return castRay(w.map, at.x, at.y, 5, Math.atan2(dy, dx), d);
}

/**
 * Where a boat is moored near a point: a water tile with dry ground beside it, within eight tiles, best one with
 * the bank to its north or south and open water at either end, so the whole hull lies in the water along the bank
 * (a hull is three tiles long: moored on a bank running north and south, half of it lay on the sand); it rides
 * a little off the bank either way. Else the point itself.
 */
function moor(w: World, at: { x: number; y: number }): { x: number; y: number } {
  const m = w.map;
  const tx = Math.floor(at.x / TILE);
  const ty = Math.floor(at.y / TILE);
  const water = (x: number, y: number): boolean => m.kind[y * m.w + x] === K.Water;
  // (a bridge is no bank to tie up at)
  const bank = (x: number, y: number): boolean => !m.solid[y * m.w + x] && !water(x, y) && m.kind[y * m.w + x] !== K.Bridge;
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (let y = ty - 8; y <= ty + 8; y++) {
    for (let x = tx - 8; x <= tx + 8; x++) {
      if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2 || !water(x, y)) continue;
      const north = bank(x, y - 1);
      const south = bank(x, y + 1);
      if (!north && !south && !bank(x - 1, y) && !bank(x + 1, y)) continue;
      const along = (north || south) && water(x - 1, y) && water(x + 1, y);
      const room = along && water(x - 2, y) && water(x + 2, y);
      const d = (x - tx) ** 2 + (y - ty) ** 2 + (room ? 0 : along ? 12 : 40);
      if (d < bd) {
        bd = d;
        // off the bank, into the open water (within its tile: the raiders' way to it is made to its tile)
        const ox = bank(x - 1, y) || !water(x - 2, y) ? 2 : bank(x + 1, y) || !water(x + 2, y) ? -2 : 0;
        best = { x: (x + 0.5) * TILE + ox, y: (y + 0.5) * TILE + (north ? -2 : south ? 2 : 0) };
      }
    }
  }
  return best ?? at;
}

/** An ally on their way to the hero: they walk there, and follow once beside them (or after a while anyway). */
function join(pet: Pet, to: { x: number; y: number }): void {
  pet.goal = { x: to.x, y: to.y };
  pet.flow = undefined;
  pet.route = undefined;
  pet.joinT = 6;
}

/**
 * A point just beyond the hero's view in about this direction (a wave of a `close` event comes from there):
 * of a few rays round it, the one that runs furthest before a wall, so no one appears at the hero's elbow.
 */
/** How far off a wave may start and still walk in from its own spot (world pixels). */
const FAR_WALK = 240;

function offscreen(w: World, toward: number): { x: number; y: number } {
  let best = { x: w.player.x, y: w.player.y };
  let far = -1;
  for (const da of [0, 0.5, -0.5, 1, -1]) {
    const p = castRay(w.map, w.player.x, w.player.y, 6, toward + da + (w.rand() - 0.5) * 0.3, 150);
    const d = Math.hypot(p.x - w.player.x, p.y - w.player.y);
    if (d > far) {
      far = d;
      best = p;
    }
    if (d >= 140) break;
  }
  return best;
}
