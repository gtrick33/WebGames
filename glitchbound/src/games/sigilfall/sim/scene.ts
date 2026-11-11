import { dist, TAU } from '../core/math';
import { picBody } from '../data/buildingArt';
import { PETS } from '../data/pets';
import { SCENES } from '../data/scenes';
import { QUESTS } from '../data/quests';
import { currentObjective } from '../progress/character';
import { isMainQuest, questSteps } from '../progress/handin';
import { questTarget, questWhere } from './objective';
import type { MusicTrack, RegionId, StoryCond } from '../data/types';
import { castRay, TILE, WORLD_K } from './map';
import { aimAlong, findRoute, type Route } from './nav';
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
 *
 * People act in it: whoever speaks turns to whoever they speak to and moves as they talk, those listening turn to
 * them, the camera draws in on a face, and a step can have someone turn, gesture, kneel or fall (`face`, `act`). A
 * line is written out and waits to be read at a reader's pace: a tap, a click or the talk key takes the next one
 * sooner (advanceScene), as a quest's words are clicked through; only Skip ends the scene.
 */

export type Emote = 'alert' | 'question' | 'dots' | 'heart' | 'note';

/** What a person in a scene can be seen to do, and the clip of the people's rig that shows it (render3d). */
export const GESTURES = {
  speak: 'interact',
  point: 'taunt',
  wave: 'wave',
  cheer: 'cheer',
  kneel: 'sitfloor',
  sit: 'sit',
  flinch: 'hit',
  take: 'pickup',
  give: 'use',
  pray: 'channel',
  guard: 'block',
  conjure: 'cast',
  work: 'work',
  fall: 'die',
  rise: 'rise',
} as const;
export type Gesture = keyof typeof GESTURES;

/**
 * Who the figures of the memories are. A figure wears the look of someone living (`as`), but it is not them: over
 * its words stands its own name (the two kings of the first vision were named for the marshal and the old man whose
 * faces they borrow). One this doesn't list is named from its id.
 */
const GHOST_NAMES: Record<string, string> = {
  'vision-king-aster': 'The King of Aster',
  'vision-king-vaelmoor': 'The King of Vaelmoor',
  'vision-smith-aster': 'A Smith of Aster',
  'vision-smith-vaelmoor': 'A Smith of Vaelmoor',
  'vision-sun-king': 'The Sun King',
  'vision-captain': 'The Captain',
  'vision-host-a': 'One of the Host',
  'vision-host-b': 'One of the Host',
  'vision-host-c': 'One of the Host',
  'vision-vaelor': 'King Vaelor',
  'vision-ysane': 'Queen Ysane',
};
export const ghostName = (id: string): string =>
  GHOST_NAMES[id] ??
  id
    .replace(/^vision-/, '')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

/** How near the camera stands, as a share of its usual distance (render: Stage.push). */
export const ZOOMS = { close: 0.7, near: 0.82, wide: 1.2 } as const;
/** How near it draws by itself while someone is speaking. */
export const TALK_ZOOM = 0.84;

export type SceneStep =
  /** A line over someone's head (an NPC, a companion, 'hero'); the scene waits until it has been read. */
  | { say: string; line: string }
  /** The camera goes to a named place, a person, a building by its name (to the middle of its picture) or 'hero'. */
  | { look: string }
  /** The camera goes to a spot (world px): where a quest leads, in a story beat. */
  | { at: { x: number; y: number } }
  /**
   * The camera keeps on someone walking (a companion, someone arriving) until they are where they were going
   * (become the place's own person there) or `secs` have passed.
   */
  | { follow: string; secs: number }
  /** Someone walks to a named place (or next to a person), or `dx`, `dy` tiles from it; at a run, if it says. */
  | { move: string; to: string; dx?: number; dy?: number; run?: boolean }
  /** Someone ('hero' too) turns to someone or somewhere, and stays so; the scene goes straight on. */
  | { face: string; to: string }
  /**
   * Someone makes a gesture (GESTURES): once, or keeping its last pose (`hold`: kneeling, sitting, fallen) until the
   * scene ends or they do something else. The scene goes straight on.
   */
  | { act: string; does: Gesture; hold?: boolean }
  /** How near the camera stands from here on: `close` on a face, `wide` over a place, `auto` as it would by itself. */
  | { zoom: 'close' | 'near' | 'wide' | 'auto' }
  /** A sign over someone's head. */
  | { emote: string; icon: Emote }
  /** A sound (audio/sound.ts), played as the step begins; the scene goes straight on. */
  | { sfx: string }
  /** The screen shakes (a bell's blow, a roof falling in); the scene goes straight on. */
  | { shake: number }
  /** A title in the lower bar (a battle's, a boss's name): it stays till the scene ends; the scene goes straight on. */
  | { title: string; sub?: string }
  | { wait: number }
  /** The picture goes to black (`out`) or comes back from it (`in`) over `secs`; the scene waits for it. */
  | { fade: 'out' | 'in'; secs?: number }
  /**
   * A memory (a sigil's vision): the picture goes pale and tinted, with a caption over it, until a `vision: ''`
   * ends it. Ghosts placed meanwhile are the people of the memory.
   */
  | { vision: string; tint?: string }
  /**
   * A figure of a memory, standing at a place (or `dx`, `dy` tiles from it), with the look of an NPC (`as`): it can
   * be spoken for and walked like a person by its `ghost` id, and it is gone when the vision ends.
   */
  | { ghost: string; as: string; at: string; dx?: number; dy?: number; face?: number }
  /** A spell's effect at a place or a person (render/effects.ts `spell` names: blast, summon, shatter, thunder…). */
  | { fx: string; at: string; color?: string; size?: number }
  /** The music for the rest of the scene. */
  | { music: MusicTrack };

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
  /** The way someone in a `move` step is walking, and how fast (world px a second). */
  route?: Route;
  pace?: number;
  emotes: { who: string; icon: Emote; t: number }[];
  /** How black the picture is (0 to 1), and where it is going. */
  dark?: { from: number; to: number; t: number; secs: number };
  /** A memory playing: its caption and tint. */
  vision?: { text: string; tint: string };
  /** The figures of the memory (NPC actors, by id). */
  ghosts?: string[];
  /** Effects playing (render/effects.ts draws them). */
  fx?: { name: string; x: number; y: number; t: number; color: string; size: number; seed: number }[];
  /** The music a step asked for. */
  music?: MusicTrack;
  /**
   * Which way the scene has turned whom, by name ('hero' too): a walker's heading in radians, 0 toward the camera.
   * It lasts as long as the scene: afterwards everyone stands as their place has them.
   */
  turns: Record<string, number>;
  /** The gestures being made, by name: the clip, when it began (World.time), whether its last pose is kept. */
  acts: Record<string, { clip: string; at: number; hold: boolean }>;
  /** Whom a `face` step has turned: they keep that way, whoever speaks, until the scene turns or walks them again. */
  posed: Record<string, true>;
  /** Who spoke last: whoever speaks next turns to them, when they are near. */
  spoke?: string;
  /** How near the camera stands, when a step has said so (else it draws in on whoever is speaking). */
  zoom?: number;
}

/** How black the scene's picture is now. */
export const sceneDark = (s: ScenePlay | null): number => {
  const d = s?.dark;
  if (!d) return 0;
  const u = d.secs > 0 ? Math.min(1, d.t / d.secs) : 1;
  return d.from + (d.to - d.from) * u;
};

/** A vision's tint by name (or a color). */
const TINTS: Record<string, string> = { memory: '#c8a8ff', ember: '#ffb070', frost: '#a8e0ff', sun: '#ffd88a', grief: '#9a8ab8', blood: '#ff8a8a' };

/** Letters a second a line is written out at. */
export const TYPE_CPS = 46;
/**
 * How long a line stays before the scene goes on by itself: time to read it at an easy pace, however long it is (the
 * old pace gave a 140-letter line six seconds). Whoever reads faster takes the next line with a tap.
 */
export const lineTime = (line: string): number => Math.min(9.5, Math.max(2.6, 1.3 + line.length * 0.055));
/** Nobody in a scene turns their back on the camera: a heading is kept within this of facing it (radians). */
const SHOWS_FACE = 1.75;
/** The way from one spot to another as a heading someone can be turned to. */
export const heading = (from: { x: number; y: number }, to: { x: number; y: number }): number => Math.max(-SHOWS_FACE, Math.min(SHOWS_FACE, Math.atan2(to.x - from.x, to.y - from.y)));
/** How far two people can stand apart and still be talking to each other (world px). */
const IN_TALK = 7 * TILE;
const WALK = 42;
/** The longest a scene waits on someone walking to their mark, in seconds, before they pick up their feet. */
const LONGEST_WALK = 4.5;
/** How far from their mark someone out of the picture starts their walk in (world px: a little past the screen's edge). */
const ENTERS_FROM = 8 * TILE;

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
  const place = w.places[name] ?? w.spots.find((sp) => sp.id === name);
  if (place) return { x: place.x, y: place.y };
  const n = w.npcs.find((x) => x.id === name) ?? w.pets.find((p) => !p.dead && p.def.id === name) ?? w.enemies.find((e) => !e.dead && e.def.id === name);
  if (n) return { x: n.x, y: n.y };
  const b = w.map.buildings.find((x) => x.name === name);
  if (!b) return null;
  // (a building's picture is measured on the art's own grid; and it stands up the screen from where its feet are, so
  // the shot is centered a little north of them)
  const bodies = b.pics.map(picBody);
  const top = Math.min(...bodies.map((r) => r[1]));
  const ground = Math.max(...bodies.map((r) => r[3]));
  // (never further in than this from its front: from the middle of a keep there's only roof to see)
  const y = Math.max(((top + ground) / 2) * WORLD_K - TILE, ground * WORLD_K - 3 * TILE);
  return { x: ((Math.min(...bodies.map((r) => r[0])) + Math.max(...bodies.map((r) => r[2]))) / 2) * WORLD_K, y };
}

const seenKey = (id: string): string => `scene:${id}`;

/** What the camera shows round where it looks, in tiles: a little less than the screen, so a speaker is never at its very edge. */
const SIGHT = { side: 6.2, up: 4, down: 3.2 };
/**
 * The middle of the picture, where a speaker is: what a phone held upright still shows with the camera drawn in (its
 * view is six tiles across, not twelve).
 */
const MIDDLE = { side: 2.3, up: 1.9, down: 1.6 };
/** Whether someone is in the picture when the camera looks at `cam`. */
export function inSight(cam: { x: number; y: number }, who: { x: number; y: number }, sight: { side: number; up: number; down: number } = SIGHT): boolean {
  const dx = (who.x - cam.x) / TILE;
  const dy = (who.y - cam.y) / TILE;
  return Math.abs(dx) <= sight.side && dy <= sight.down && dy >= -sight.up;
}

/** The middle of the nearest tile to (x, y) that can be stood on (the spot itself, when it can). */
function openGround(w: World, x: number, y: number): { x: number; y: number } {
  const m = w.map;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const open = (cx: number, cy: number): boolean => cx >= 0 && cy >= 0 && cx < m.w && cy < m.h && !m.solid[cy * m.w + cx];
  if (open(tx, ty)) return { x, y };
  for (let r = 1; r <= 4; r++) {
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (let cy = ty - r; cy <= ty + r; cy++) {
      for (let cx = tx - r; cx <= tx + r; cx++) {
        if (Math.max(Math.abs(cx - tx), Math.abs(cy - ty)) !== r || !open(cx, cy)) continue;
        const px = (cx + 0.5) * TILE;
        const py = (cy + 0.5) * TILE;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) {
          bd = d;
          best = { x: px, y: py };
        }
      }
    }
    if (best) return best;
  }
  return { x, y };
}

/**
 * Whether this world plays the story's staged scenes: playing alone, or leading a party questing together (the
 * other heroes' games skip them and play on). Not a party's Riftstone run, whose clock is running for everyone.
 */
export function scenesPlayHere(w: Pick<World, 'coop' | 'keyRun'>): boolean {
  return !w.coop || (w.coop.role === 'host' && !w.keyRun);
}

/** Starts a scene whose moment has come here, if none is playing and nothing is fighting nearby. */
export function maybeStartScene(w: World): void {
  if (w.scene || w.player.dead || w.story.fighting) return;
  const h = w.hero;
  for (const def of SCENES) {
    if (!def.when || def.region !== w.region.id || h.opened.includes(seenKey(def.id)) || !holds(h, def.when)) continue;
    if (def.near) {
      const at = where(w, def.near);
      if (!at || dist(at.x, at.y, w.player.x, w.player.y) > (def.r ?? 90) * WORLD_K) continue;
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
  // no scene of its own: the main story's next step gets a beat (where the quest leads, under its name)
  if (!w.beats || w.coop || w.keyRun) return;
  const beat = questBeat(w);
  if (!beat) return;
  if (w.player.calm < 3 || w.enemies.some((e) => !e.dead && !e.dummy && (e.aggro || dist(e.x, e.y, w.player.x, w.player.y) < 100))) return;
  play(w, beat);
}

/** The main quests the story stages by hand (a scene during them, or a shot opening one of their fights). */
let staged: Set<string> | null = null;
function stagedByHand(): Set<string> {
  if (staged) return staged;
  staged = new Set();
  const opened = new Set(SCENES.flatMap((d) => (d.opens ? [d.opens.event] : [])));
  for (const q of QUESTS) {
    // (a scene that plays while it's the quest being played; not one that only waits for it to be done)
    const named = SCENES.some((d) => d.when && JSON.stringify(d.when).includes(JSON.stringify({ quest: q.id, is: 'active' })));
    const shot = questSteps(q).some((o) => o.kind === 'event' && opened.has(o.event));
    if (named || shot) staged.add(q.id);
  }
  return staged;
}

/**
 * A step of the main story that has no scene of its own gets a beat as it begins (or as the hero comes into the
 * land it's in): its name in the lower bar, a horn, a drum or a roar for what it is, and the camera going out to
 * where it leads (the person, the place, the den, the way out toward it) and back to the hero. Seen once a step.
 * The opening night (the Briarhollow chain), staged by hand throughout, has none.
 */
export function questBeat(w: World): SceneDef | null {
  const h = w.hero;
  for (const q of QUESTS) {
    const st = h.quests[q.id];
    if (!st || st.state !== 'active' || !isMainQuest(q.id) || q.id.startsWith('briar-') || stagedByHand().has(q.id)) continue;
    const id = `beat:${q.id}:${st.step ?? 0}`;
    if (h.opened.includes(seenKey(id))) continue;
    if (questWhere(h, q) !== w.region.id) continue;
    const o = currentObjective(h, q);
    if (o.kind === 'tutorial') continue;
    const t = questTarget(w, q, true);
    const far = t && dist(t.x, t.y, w.player.x, w.player.y) > 5 * TILE;
    const sound = o.kind === 'boss' ? 'roar' : o.kind === 'kill' || o.kind === 'event' ? 'warhorn' : 'checkpoint';
    const steps: SceneStep[] = [
      { title: q.name, sub: 'label' in o ? o.label : undefined },
      { sfx: sound },
      ...(o.kind === 'boss' ? [{ shake: 3 }] : []),
      ...(far && t ? [{ at: { x: t.x, y: t.y } }, { wait: 2.2 }] : [{ wait: 1.8 }]),
      { look: 'hero' },
    ];
    return { id, region: w.region.id, steps };
  }
  return null;
}

function play(w: World, def: SceneDef): void {
  w.scene = { def, step: 0, t: 0, begun: false, focus: null, emotes: [], turns: {}, acts: {}, posed: {} };
  w.dismount();
  w.emit({ t: 'scene', id: def.id, playing: true });
}

/**
 * The shot that opens this story event (or its wave `wave`), started if it has one the hero hasn't seen (and
 * no co-op party shares the world): true when it plays.
 */
export function openShot(w: World, event: string, wave: number): boolean {
  // (not with something already at the hero: the fight is on)
  if (w.scene || !shotDue(w, event, wave) || w.enemies.some((e) => !e.dead && !e.dummy && e.aggro)) return false;
  play(w, shotOf(event, wave)!);
  return true;
}

const shotOf = (event: string, wave: number): SceneDef | undefined => SCENES.find((d) => d.opens?.event === event && (d.opens.wave ?? 0) === wave);

/** Has this moment of a story event a shot the hero hasn't seen (and is this world one that plays them)? */
export function shotDue(w: World, event: string, wave: number): boolean {
  const def = shotOf(event, wave);
  return !!def && !w.coop && !w.puppet && !w.hero.opened.includes(seenKey(def.id));
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
    clearGhosts(w, s);
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
    if (first) {
      w.story.speakNow({ who: step.say, text: step.line }, lineTime(step.line), true);
      const who = where(w, step.say);
      // whoever speaks turns to who they are speaking to: the one who spoke before them, if near, else the hero; and
      // those two turn to listen
      const before = s.spoke && s.spoke !== step.say ? where(w, s.spoke) : null;
      const partner = before && who && dist(before.x, before.y, who.x, who.y) < IN_TALK ? before : null;
      const heroNear = !!who && step.say !== 'hero' && dist(w.player.x, w.player.y, who.x, who.y) < IN_TALK;
      const to = partner ?? (heroNear ? w.player : null);
      if (who && to && !s.posed[step.say]) s.turns[step.say] = heading(who, to);
      if (who && partner && s.spoke && !s.posed[s.spoke]) s.turns[s.spoke] = heading(partner, who);
      if (who && heroNear && !s.posed.hero) s.turns.hero = heading(w.player, who);
      // ...and moves as they talk (a hand out; an arm thrown up at a shout), unless the scene has just given them
      // something of their own to do, or has them kneeling
      const doing = s.acts[step.say];
      if (step.say !== 'hero' && !doing?.hold && !(doing && w.time - doing.at < 0.25)) s.acts[step.say] = { clip: /!["’”]?$/.test(step.line) ? GESTURES.point : GESTURES.speak, at: w.time, hold: false };
      s.spoke = step.say;
      // the camera finds whoever speaks, if the scene has left them out of the middle of its picture: nobody talks
      // from off the screen, on a phone's narrow one either. Two who are talking are framed together
      const cam = s.focus ?? w.player;
      if (who && !inSight(cam, who, MIDDLE)) {
        const two = to && dist(to.x, to.y, who.x, who.y) < 4.5 * TILE ? { x: who.x + (to.x - who.x) * 0.35, y: who.y + (to.y - who.y) * 0.35 } : { x: who.x, y: who.y };
        s.focus = step.say === 'hero' ? null : two;
      }
    }
    done = s.t >= lineTime(step.line) + 0.15;
  } else if ('ghost' in step) {
    if (first) {
      const at = where(w, step.at);
      if (at) {
        // (never in a wall or a tree: the nearest open ground to where the scene put them)
        const to = openGround(w, at.x + (step.dx ?? 0) * TILE, at.y + (step.dy ?? 0) * TILE);
        w.npcs = w.npcs.filter((n) => n.id !== step.ghost);
        w.npcs.push({ id: step.ghost, x: to.x, y: to.y, face: step.face ?? 1, bob: 0, since: w.time, ghost: step.as });
        (s.ghosts ??= []).push(step.ghost);
      }
    }
    done = true;
  } else if ('fx' in step) {
    if (first) {
      const at = where(w, step.at);
      if (at) (s.fx ??= []).push({ name: step.fx, x: at.x, y: at.y, t: 0, color: step.color ?? '#c8a8ff', size: step.size ?? 30, seed: w.rand() * 10 });
      if (step.fx === 'blast' || step.fx === 'thunder' || step.fx === 'shatter') w.shake(3);
    }
    done = true;
  } else if ('look' in step) {
    const at = where(w, step.look);
    s.focus = step.look === 'hero' ? null : at;
    done = s.t >= 0.9;
  } else if ('at' in step) {
    s.focus = step.at;
    done = s.t >= 1;
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
      // next to a person, on a place (or as far from it as the step says)
      const off = step.dx !== undefined || step.dy !== undefined;
      const tx = off ? to.x + (step.dx ?? 0) * TILE : step.to === 'hero' || !w.places[step.to] ? to.x + (n.x < to.x ? -26 : 26) : to.x;
      const ty = to.y + (step.dy ?? 0) * TILE;
      const d = dist(n.x, n.y, tx, ty);
      if (first) {
        s.route = findRoute(w.map, n.x, n.y, tx, ty, { r: 7, budget: 12000, roads: true }) ?? findRoute(w.map, n.x, n.y, tx, ty, { r: 4, budget: 12000 }) ?? undefined;
        // someone a long way off and out of the picture is cut to, as a film would: they come in from just beyond its
        // edge, on the way they would have walked
        if (s.route && !inSight(s.focus ?? w.player, n)) {
          let back = 0;
          for (let i = s.route.pts.length - 1; i > 0; i--) {
            back += dist(s.route.pts[i]!.x, s.route.pts[i]!.y, s.route.pts[i - 1]!.x, s.route.pts[i - 1]!.y);
            if (back >= ENTERS_FROM) {
              n.x = s.route.pts[i - 1]!.x;
              n.y = s.route.pts[i - 1]!.y;
              s.route = { pts: s.route.pts.slice(i - 1), at: 0 };
              break;
            }
          }
        }
        // (and whoever still has a long way to come hurries: nobody watches a ten-second walk)
        s.pace = Math.min(WALK * 3, Math.max(step.run ? WALK * 2 : WALK, (dist(n.x, n.y, tx, ty) * 1.25) / LONGEST_WALK));
        // (a gesture held is let go of: nobody walks off kneeling)
        delete s.acts[step.move];
        delete s.turns[step.move];
        delete s.posed[step.move];
      }
      const aim = s.route ? aimAlong(s.route, n.x, n.y) : d > 1 ? { x: (tx - n.x) / d, y: (ty - n.y) / d } : null;
      if (aim) {
        const stride = (s.pace ?? WALK) * dt;
        n.x += aim.x * stride;
        n.y += aim.y * stride;
        if (Math.abs(aim.x) > 0.1) n.face = aim.x < 0 ? 1 : 0;
      }
      // (time enough for the way there, however it winds)
      done = !aim || d < 1.5 || s.t > 14;
    }
  } else if ('face' in step) {
    const who = where(w, step.face);
    const to = where(w, step.to);
    if (who && to && dist(who.x, who.y, to.x, to.y) > 2) {
      s.turns[step.face] = heading(who, to);
      s.posed[step.face] = true;
    }
    done = true;
  } else if ('act' in step) {
    if (first) s.acts[step.act] = { clip: GESTURES[step.does], at: w.time, hold: !!step.hold };
    done = true;
  } else if ('zoom' in step) {
    s.zoom = step.zoom === 'auto' ? undefined : ZOOMS[step.zoom];
    done = true;
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
  } else if ('fade' in step) {
    const secs = step.secs ?? 0.8;
    if (first) s.dark = { from: sceneDark(s), to: step.fade === 'out' ? 1 : 0, t: 0, secs };
    done = s.t >= secs;
  } else if ('vision' in step) {
    if (!step.vision) {
      s.vision = undefined;
      clearGhosts(w, s);
    } else s.vision = { text: step.vision, tint: TINTS[step.tint ?? 'memory'] ?? step.tint ?? TINTS.memory! };
    done = true;
  } else if ('music' in step) {
    s.music = step.music;
    done = true;
  } else done = s.t >= step.wait;
  if (s.dark) s.dark.t += dt;
  if (s.fx) {
    for (const f of s.fx) f.t += dt;
    s.fx = s.fx.filter((f) => f.t < 1.6);
  }
  if (done) {
    s.step += 1;
    s.t = 0;
    s.begun = false;
    s.seen = false;
  }
}

/**
 * The reader is ready for more (a tap, a click, the talk key): a line still being written out is shown whole; one
 * that has been is done with, and the next comes; a pause is cut short. A camera's move or someone's walk is not
 * hurried. True when it took the scene on.
 */
export function advanceScene(w: World): boolean {
  const s = w.scene;
  if (!s || !s.begun) return false;
  const step = s.def.steps[s.step];
  if (!step) return false;
  if ('say' in step) {
    // (a hair past its last letter: all of it, whatever the arithmetic makes of the division)
    const whole = (step.line.length + 0.5) / TYPE_CPS;
    if (s.t < whole) {
      s.t = whole;
      for (const sp of w.story.speech) if (sp.who === step.say) sp.t = Math.max(sp.t, whole);
      return true;
    }
    // (not on the same touch that showed it whole: a double tap doesn't throw a line away unread)
    if (s.t < whole + 0.25) return false;
    w.story.hush([step.say]);
    s.t = Infinity;
    return true;
  }
  if ('wait' in step && s.t > 0.2) {
    s.t = Infinity;
    return true;
  }
  return false;
}

/** A memory's figures go (its vision is over, or the scene). */
function clearGhosts(w: World, s: ScenePlay): void {
  if (!s.ghosts?.length) return;
  const gone = new Set(s.ghosts);
  // the figures of a memory fade out where they stood, as the people of a place do when they leave
  w.leftNpcs.push(...w.npcs.filter((n) => gone.has(n.id)).map((n) => ({ ...n, left: w.time })));
  w.npcs = w.npcs.filter((n) => !gone.has(n.id));
  s.ghosts = [];
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
        n.x = to.x + (step.dx ?? 0) * TILE;
        n.y = to.y + (step.dy ?? 0) * TILE;
      }
    }
    w.story.hush(s.def.steps.flatMap((st) => ('say' in st ? [st.say] : [])));
    // and whoever it was watching walk in is there now: the story goes straight on to its next beat
    w.story.hurry();
  }
  if (!w.hero.opened.includes(seenKey(s.def.id))) w.hero.opened.push(seenKey(s.def.id));
  clearGhosts(w, s);
  w.scene = null;
  letGo(w);
  w.emit({ t: 'scene', id: s.def.id, playing: false });
  w.emit({ t: 'save' });
}
