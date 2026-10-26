import { dist } from '../core/math';
import { SCENES } from '../data/scenes';
import type { RegionId, StoryCond } from '../data/types';
import { holds } from './story';
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
  /** Someone walks to a named place (or next to a person). */
  | { move: string; to: string }
  /** A sign over someone's head. */
  | { emote: string; icon: Emote }
  /** A sound (audio/sound.ts), played as the step begins; the scene goes straight on. */
  | { sfx: string }
  | { wait: number };

export interface SceneDef {
  id: string;
  region: RegionId;
  /** Plays once, the first time this holds while the hero is here (and within `r` of `near`, if given). */
  when: StoryCond;
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
  emotes: { who: string; icon: Emote; t: number }[];
}

const SPEAK = 2.6;
const lineTime = (line: string): number => SPEAK + line.length * 0.025;
const WALK = 42;

/** A named place, a person, or the hero, in world px (null when nothing by that name is here). */
function where(w: World, name: string): { x: number; y: number } | null {
  if (name === 'hero') return { x: w.player.x, y: w.player.y };
  const place = w.places[name];
  if (place) return place;
  const n = w.npcs.find((x) => x.id === name) ?? w.pets.find((p) => !p.dead && p.def.id === name);
  return n ? { x: n.x, y: n.y } : null;
}

const seenKey = (id: string): string => `scene:${id}`;

/** Starts a scene whose moment has come here, if none is playing and nothing is fighting nearby. */
export function maybeStartScene(w: World): void {
  if (w.scene || w.player.dead || w.story.fighting) return;
  const h = w.hero;
  for (const def of SCENES) {
    if (def.region !== w.region.id || h.opened.includes(seenKey(def.id)) || !holds(h, def.when)) continue;
    if (def.near) {
      const at = where(w, def.near);
      if (!at || dist(at.x, at.y, w.player.x, w.player.y) > (def.r ?? 90)) continue;
    }
    // never in a fight, nor with an enemy at the hero's elbow (idle packs further off may watch)
    if (w.player.calm < 3 || w.enemies.some((e) => !e.dead && !e.dummy && (e.aggro || dist(e.x, e.y, w.player.x, w.player.y) < 100))) return;
    w.scene = { def, step: 0, t: 0, begun: false, focus: null, emotes: [] };
    w.dismount();
    w.emit({ t: 'scene', id: def.id, playing: true });
    return;
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
  } else done = s.t >= step.wait;
  if (done) {
    s.step += 1;
    s.t = 0;
    s.begun = false;
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
  w.emit({ t: 'scene', id: s.def.id, playing: false });
  w.emit({ t: 'save' });
}
