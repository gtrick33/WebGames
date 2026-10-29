import { dist, TAU } from '../core/math';
import { PETS } from '../data/pets';
import { SCENES } from '../data/scenes';
import type { RegionId, StoryCond } from '../data/types';
import { castRay } from './map';
import { placePet } from './pets';
import { holds } from './story';
import type { Enemy } from './types';
import type { World } from './world';

/**
 * In-engine scenes (blueprint Prompt 9): a few seconds of staging at a story beat, played in the world
 * itself — the camera goes to a place or a person, people walk, react and speak — instead of a wall of
 * text. A scene only stages: it changes nothing the story keeps (who stands where afterwards is the
 * region's markers' business), so it is safe to skip, to interrupt and to see again after a reload; it
 * counts as seen once it has finished or been skipped. The hero can't act while one plays.
 */

export type Emote = 'alert' | 'question' | 'dots' | 'heart' | 'note';

export type SceneStep =
  /** A line over someone's head (an NPC, a companion, 'hero'); the scene waits until it has been read. */
  | { say: string; line: string }
  /** The camera goes to a named place, a person or 'hero'. */
  | { look: string }
  /**
   * The camera keeps on someone walking (a companion, someone arriving) until they are where they were going
   * (become the place's own person there) or `secs` have passed.
   */
  | { follow: string; secs: number }
  /** Someone walks to a named place (or next to a person). */
  | { move: string; to: string }
  /** A sign over someone's head. */
  | { emote: string; icon: Emote }
  /** A sound (audio/sound.ts), played as the step begins; the scene goes straight on. */
  | { sfx: string }
  /** The screen shakes (a bell's blow, a roof falling in); the scene goes straight on. */
  | { shake: number }
  /** A title in the lower bar (a battle's, a boss's name): it stays till the scene ends; the scene goes straight on. */
  | { title: string; sub?: string }
  | { wait: number };

export interface SceneDef {
  id: string;
  region: RegionId;
  /** Plays once, the first time this holds while the hero is here (and within `r` of `near`, if given). */
  when?: StoryCond;
  /**
   * Or: a shot that opens a great moment of a story fight, as it begins (or as its wave `wave` comes): the
   * wave musters in sight and waits, and the call to arms and the wave's lines come once it is over
   * (sim/story.ts). Looks at 'foes' for the wave. Plays once, and never in a co-op party.
   */
  opens?: { event: string; wave?: number };
  near?: string;
  r?: number;
  steps: SceneStep[];
}

export interface ScenePlay {
  def: SceneDef;
  step: number;
  t: number;
  /** The current step has started (its line said, its sign shown). */
  begun: boolean;
  /** Where the camera looks (world px), or null for the hero. */
  focus: { x: number; y: number } | null;
  /** The one a `follow` step keeps on has been found (their going then ends the step). */
  seen?: boolean;
  /** The title in the lower bar, if a step has given one. */
  title?: { text: string; sub?: string };
  emotes: { who: string; icon: Emote; t: number }[];
}

const SPEAK = 2.6;
const lineTime = (line: string): number => SPEAK + line.length * 0.025;
const WALK = 42;

/**
 * A named place, a person (or a foe, by kind), or the hero, in world px (null when nothing by that name is
 * here); 'foes' is the foes a shot holds (the thickest knot of them, when they come from more than one side),
 * 'boss' the boss.
 */
function where(w: World, name: string): { x: number; y: number } | null {
  if (name === 'hero') return { x: w.player.x, y: w.player.y };
  if (name === 'foes') {
    const held = w.enemies.filter((e) => e.held && !e.dead);
    if (!held.length) return null;
    const knot = held.map((a) => held.filter((b) => dist(a.x, a.y, b.x, b.y) < 110)).reduce((a, b) => (b.length > a.length ? b : a));
    return { x: knot.reduce((a, e) => a + e.x, 0) / knot.length, y: knot.reduce((a, e) => a + e.y, 0) / knot.length };
  }
  if (name === 'boss') {
    const b = w.boss();
    return b && !b.dead ? { x: b.x, y: b.y } : null;
  }
  const place = w.places[name];
  if (place) return place;
  const n = w.npcs.find((x) => x.id === name) ?? w.pets.find((p) => !p.dead && p.def.id === name) ?? w.enemies.find((e) => !e.dead && e.def.id === name);
  return n ? { x: n.x, y: n.y } : null;
}

const seenKey = (id: string): string => `scene:${id}`;

/** Starts a scene whose moment has come here, if none is playing and nothing is fighting nearby. */
export function maybeStartScene(w: World): void {
  if (w.scene || w.player.dead || w.story.fighting) return;
  const h = w.hero;
  for (const def of SCENES) {
    if (!def.when || def.region !== w.region.id || h.opened.includes(seenKey(def.id)) || !holds(h, def.when)) continue;
    if (def.near) {
      const at = where(w, def.near);
      if (!at || dist(at.x, at.y, w.player.x, w.player.y) > (def.r ?? 90)) continue;
    }
    // never in a fight, nor with an enemy at the hero's elbow (idle packs further off may watch)
    if (w.player.calm < 3 || w.enemies.some((e) => !e.dead && !e.dummy && (e.aggro || dist(e.x, e.y, w.player.x, w.player.y) < 100))) return;
    // a companion of the story who speaks in it (Mara, after a fight) is at the hero's side, even after a reload
    for (const who of new Set(def.steps.flatMap((s) => ('say' in s ? [s.say] : [])))) {
      if (!PETS[who] || w.npcs.some((n) => n.id === who) || w.pets.some((p) => !p.dead && p.def.id === who)) continue;
      const at = castRay(w.map, w.player.x, w.player.y, 6, w.rand() * TAU, 18);
      placePet(w, who, at.x, at.y);
    }
    play(w, def);
    return;
  }
}

function play(w: World, def: SceneDef): void {
  w.scene = { def, step: 0, t: 0, begun: false, focus: null, emotes: [] };
  w.dismount();
  w.emit({ t: 'scene', id: def.id, playing: true });
}

/**
 * The shot that opens this story event (or its wave `wave`), started if it has one the hero hasn't seen (and
 * no co-op party shares the world): true when it plays.
 */
export function openShot(w: World, event: string, wave: number): boolean {
  // (not with something already at the hero: the fight is on)
  if (w.scene || w.coop || w.puppet || w.enemies.some((e) => !e.dead && !e.dummy && e.aggro)) return false;
  const def = SCENES.find((d) => d.opens?.event === event && (d.opens.wave ?? 0) === wave);
  if (!def || w.hero.opened.includes(seenKey(def.id))) return false;
  play(w, def);
  return true;
}

/**
 * The first time a hero meets a boss: a shot of it (its name in the lower bar) before it comes on. Not in a
 * Riftstone run, whose clock is running, nor in a co-op party.
 */
export function revealBoss(w: World, boss: Enemy): void {
  const b = boss.boss?.def;
  if (!b || w.scene || w.coop || w.puppet || w.keyRun || w.enemies.some((e) => e !== boss && !e.dead && !e.dummy && e.aggro)) return;
  const def: SceneDef = {
    id: `boss-${b.id}`,
    region: w.region.id,
    steps: [{ look: 'boss' }, { title: b.name, sub: b.title }, { sfx: 'roar' }, { shake: 4 }, { wait: 1.8 }, { look: 'hero' }],
  };
  if (w.hero.opened.includes(seenKey(def.id))) return;
  boss.held = true;
  boss.aggro = false;
  play(w, def);
}

/** The foes a shot held come on (it is over, or something broke it). */
function letGo(w: World): void {
  for (const e of w.enemies) {
    if (!e.held) continue;
    e.held = false;
    e.aggro = true;
  }
}

/** Plays the current step; returns when the scene ends. */
export function updateScene(w: World, dt: number): void {
  const s = w.scene;
  if (!s) return;
  // something attacks: the scene stops (it plays again another time) and the fight is the hero's
  if (w.enemies.some((e) => !e.dead && !e.dummy && e.aggro)) {
    w.story.hush(s.def.steps.flatMap((st) => ('say' in st ? [st.say] : [])));
    w.scene = null;
    letGo(w);
    w.emit({ t: 'scene', id: s.def.id, playing: false });
    return;
  }
  for (const e of s.emotes) e.t += dt;
  s.emotes = s.emotes.filter((e) => e.t < 1.4);
  const step = s.def.steps[s.step];
  if (!step) {
    endScene(w, false);
    return;
  }
  s.t += dt;
  const first = !s.begun;
  s.begun = true;
  let done: boolean;
  if ('say' in step) {
    if (first) w.story.speakNow({ who: step.say, text: step.line }, lineTime(step.line));
    done = s.t >= lineTime(step.line) + 0.15;
  } else if ('look' in step) {
    const at = where(w, step.look);
    s.focus = step.look === 'hero' ? null : at;
    done = s.t >= 0.9;
  } else if ('follow' in step) {
    const at = where(w, step.follow);
    if (at) {
      s.focus = at;
      s.seen = true;
    }
    done = (!!s.seen && !at) || s.t >= step.secs;
  } else if ('move' in step) {
    const n = w.npcs.find((x) => x.id === step.move);
    const to = where(w, step.to);
    if (!n || !to) done = true;
    else {
      // next to a person, on a place
      const tx = step.to === 'hero' || !w.places[step.to] ? to.x + (n.x < to.x ? -14 : 14) : to.x;
      const ty = to.y;
      const d = dist(n.x, n.y, tx, ty);
      const k = Math.min(1, (WALK * dt) / Math.max(1e-6, d));
      n.x += (tx - n.x) * k;
      n.y += (ty - n.y) * k;
      if (Math.abs(tx - n.x) > 0.5) n.face = tx < n.x ? 1 : 0;
      done = d < 1.5 || s.t > 6;
    }
  } else if ('emote' in step) {
    if (first) s.emotes.push({ who: step.emote, icon: step.icon, t: 0 });
    done = s.t >= 0.8;
  } else if ('sfx' in step) {
    if (first) w.sfx(step.sfx);
    done = true;
  } else if ('shake' in step) {
    if (first) w.shake(step.shake);
    done = true;
  } else if ('title' in step) {
    s.title = { text: step.title, sub: step.sub };
    done = true;
  } else done = s.t >= step.wait;
  if (done) {
    s.step += 1;
    s.t = 0;
    s.begun = false;
    s.seen = false;
  }
}

/** Ends the scene (played through, or skipped): it has been seen, and the camera goes back to the hero. */
export function endScene(w: World, skipped: boolean): void {
  const s = w.scene;
  if (!s) return;
  if (skipped) {
    // the walks it would have made end where they were going; its lines are not left hanging
    for (const step of s.def.steps.slice(s.step)) {
      if (!('move' in step)) continue;
      const n = w.npcs.find((x) => x.id === step.move);
      const to = where(w, step.to);
      if (n && to && w.places[step.to]) {
        n.x = to.x;
        n.y = to.y;
      }
    }
    w.story.hush(s.def.steps.flatMap((st) => ('say' in st ? [st.say] : [])));
  }
  if (!w.hero.opened.includes(seenKey(s.def.id))) w.hero.opened.push(seenKey(s.def.id));
  w.scene = null;
  letGo(w);
  w.emit({ t: 'scene', id: s.def.id, playing: false });
  w.emit({ t: 'save' });
}
