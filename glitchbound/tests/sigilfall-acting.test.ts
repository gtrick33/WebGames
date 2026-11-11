/**
 * The story as it is acted and read (the owner: "is there a way to change the story displayed only in boxes ... make
 * it with similar pacing to WoW quests ... make sure from UI point of view there's no text overflowing"):
 * - a line is written out under its speaker's name and waits to be read; a tap shows it whole, the next takes the
 *   next line, and no tap ends a scene (only Skip does);
 * - whoever speaks turns to who they speak to, the hero turns to them, and nobody is turned away from the camera;
 * - a scene's gestures, turns and walks name people who are in it, and what it holds (kneeling) is let go to walk;
 * - every line of the story, on every screen from a small phone to a desk, is shown whole inside the picture: no
 *   word of it dropped, none of it under the bars or off the edge.
 */
import { describe, expect, it } from 'vitest';
import { PETS } from '../src/games/sigilfall/data/pets';
import { NPCS } from '../src/games/sigilfall/data/quests';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
import { layoutSpeech, speechSize, wrapWords } from '../src/games/sigilfall/render/speech';
import { advanceScene, endScene, GESTURES, heading, lineTime, TALK_ZOOM, TYPE_CPS, ZOOMS } from '../src/games/sigilfall/sim/scene';
import { holds } from '../src/games/sigilfall/sim/story';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const DT = 1 / 60;
const run = (w: World, s: number): void => {
  for (let t = 0; t < s; t += DT) {
    w.input = emptyInput();
    w.step(DT);
  }
};
function holdsFor(p: (typeof PRESETS)[number], id: string): boolean {
  const c = readyHero('mage', 2);
  applyPreset(c, p);
  const when = SCENES.find((s) => s.id === id)!.when;
  return !!when && holds(c, when);
}
/** A world with the hero where the scene is set, and the scene begun. */
function playing(id: string): World {
  const def = SCENES.find((s) => s.id === id)!;
  const preset = PRESETS.find((p) => p.label.includes('(scene)') && def.region === p.region && holdsFor(p, id))!;
  const c = readyHero('mage', preset.level);
  applyPreset(c, preset);
  const w = newWorld(def.region, c);
  for (const s of SCENES) if (s.id !== id && s.region === def.region && !w.hero.opened.includes(`scene:${s.id}`)) w.hero.opened.push(`scene:${s.id}`);
  w.enemies = [];
  const at = def.near ? (w.places[def.near] ?? w.spots.find((sp) => sp.id === def.near) ?? w.npcs.find((n) => n.id === def.near)) : null;
  if (at) {
    w.player.x = at.x;
    w.player.y = at.y + 20;
  }
  run(w, 0.6);
  expect(w.scene?.def.id, id).toBe(id);
  return w;
}
/** Plays on until the scene is at a step of this kind that has begun (or two minutes have gone). */
function until(w: World, kind: string): void {
  for (let t = 0; t < 120 && w.scene; t += DT) {
    const st = w.scene.def.steps[w.scene.step];
    if (st && kind in st && w.scene.begun) return;
    w.input = emptyInput();
    w.step(DT);
  }
}

const LINES = SCENES.flatMap((d) => d.steps.flatMap((s) => ('say' in s ? [{ id: d.id, who: s.say, line: s.line }] : [])));

describe('Sigilfall: a scene is read at the reader’s pace', () => {
  it('a line is written out and waits; a tap shows it whole, the next tap takes the next line', () => {
    const w = playing('ember-the-regent');
    until(w, 'say');
    const sc = w.scene!;
    const first = sc.step;
    const step = sc.def.steps[first] as { say: string; line: string };
    const said = w.story.speech.find((s) => s.who === step.say)!;
    expect(said.staged).toBe(true);
    expect(said.text).toBe(step.line);
    // a moment in, it is still being written
    run(w, 0.2);
    expect(said.t * TYPE_CPS).toBeLessThan(step.line.length);
    // a tap: all of it, and the scene still on the same line
    expect(advanceScene(w)).toBe(true);
    expect(said.t * TYPE_CPS).toBeGreaterThanOrEqual(step.line.length);
    expect(w.scene!.step).toBe(first);
    // the same touch again does nothing (a double tap doesn't throw a line away unread)
    expect(advanceScene(w)).toBe(false);
    run(w, 0.4);
    expect(w.scene!.step).toBe(first);
    // the next tap takes the next line: this one is gone at once
    expect(advanceScene(w)).toBe(true);
    run(w, 0.05);
    expect(w.scene!.step).toBeGreaterThan(first);
    expect(w.story.speech.some((s) => s.text === step.line)).toBe(false);
  });

  it('no tap ends a scene or hurries a camera: tapping all the way through still plays every line, and Skip ends it', () => {
    const w = playing('ember-the-regent');
    const said: string[] = [];
    let last = -1;
    for (let t = 0; t < 60 && w.scene; t += DT) {
      const sc = w.scene;
      const st = sc.def.steps[sc.step];
      if (st && 'say' in st && sc.begun && sc.step !== last) {
        last = sc.step;
        said.push(st.line);
      }
      // (a look is not hurried: the tap is refused)
      if (st && 'look' in st && sc.begun) expect(advanceScene(w)).toBe(false);
      else advanceScene(w);
      w.input = emptyInput();
      w.step(DT);
    }
    expect(w.scene).toBeNull();
    expect(said).toEqual(SCENES.find((d) => d.id === 'ember-the-regent')!.steps.flatMap((s) => ('say' in s ? [s.line] : [])));
    expect(w.hero.opened).toContain('scene:ember-the-regent');
    // and Skip is still the one way out of one
    const again = playing('ember-after-knives');
    endScene(again, true);
    expect(again.scene).toBeNull();
  });

  it('left alone, every line stays long enough to be read, and none for ever', () => {
    for (const l of LINES) {
      const secs = lineTime(l.line);
      // (written out, then read at no more than twenty letters a second: the old pace gave the longest lines six seconds)
      expect(secs, l.line).toBeGreaterThanOrEqual(Math.min(9.5, l.line.length / 20));
      expect(secs).toBeGreaterThanOrEqual(2.6);
      expect(secs).toBeLessThanOrEqual(9.5);
      expect(l.line.length / TYPE_CPS, l.line).toBeLessThan(secs - 1);
    }
    expect(LINES.length).toBeGreaterThan(300);
  });
});

describe('Sigilfall: the people in a scene act', () => {
  it('whoever speaks turns to who they speak to, the hero turns to them, and a gesture goes with the words', () => {
    const w = playing('ember-the-regent');
    until(w, 'say');
    const sc = w.scene!;
    const who = (sc.def.steps[sc.step] as { say: string }).say;
    const speaker = w.npcs.find((n) => n.id === who)!;
    // (the hero is at her feet: she speaks to them, and they look up at her)
    expect(sc.turns[who]).toBeCloseTo(heading(speaker, w.player), 5);
    expect(sc.turns.hero).toBeCloseTo(heading(w.player, speaker), 5);
    expect(Object.values(GESTURES)).toContain(sc.acts[who]!.clip);
    // the next speaker turns to her, and she to him
    advanceScene(w);
    run(w, 0.4);
    advanceScene(w);
    run(w, 0.1);
    until(w, 'say');
    const next = (w.scene!.def.steps[w.scene!.step] as { say: string }).say;
    expect(next).not.toBe(who);
    const other = w.npcs.find((n) => n.id === next)!;
    expect(w.scene!.turns[next]).toBeCloseTo(heading(other, speaker), 5);
    expect(w.scene!.turns[who]).toBeCloseTo(heading(speaker, other), 5);
    // nobody is turned away from the camera
    for (const t of Object.values(w.scene!.turns)) expect(Math.abs(t)).toBeLessThanOrEqual(1.75);
    // it lasts as long as the scene: afterwards nothing of it is left
    endScene(w, true);
    expect(w.scene).toBeNull();
  });

  it('a turn the scene gives is kept whoever speaks, and what is held is let go to walk', () => {
    const w = playing('ember-after-knives');
    until(w, 'say');
    const sc = w.scene!;
    // (the Regent speaks to the Chancellor's door, not to the hero at her side)
    const regent = w.npcs.find((n) => n.id === 'regent-elowen')!;
    expect(sc.posed['regent-elowen']).toBe(true);
    expect(sc.turns['regent-elowen']).not.toBeCloseTo(heading(regent, w.player), 2);
    // a gesture held, then a walk: nobody walks off kneeling
    const e = playing('gloam-elyra-free');
    until(e, 'say');
    expect(e.scene!.acts['elyra-lastlight']).toMatchObject({ clip: GESTURES.kneel, hold: true });
    e.scene!.acts.wren = { clip: GESTURES.kneel, at: e.time, hold: true };
    until(e, 'move');
    run(e, 0.1);
    expect(e.scene!.acts.wren).toBeUndefined();
    // (and she is still by the fire: speaking didn't stand her up)
    expect(e.scene!.acts['elyra-lastlight']).toMatchObject({ hold: true });
  });

  it('every gesture, turn and walk names someone the scene has, and every distance the camera is told is one it knows', () => {
    const wrong: string[] = [];
    let acted = 0;
    for (const def of SCENES) {
      const cast = new Set<string>(['hero', ...def.steps.flatMap((s) => ('say' in s ? [s.say] : 'ghost' in s ? [s.ghost] : []))]);
      for (const s of def.steps) {
        // (a memory's figure has a `face` of its own: which way it stands)
        const who = 'ghost' in s ? null : 'act' in s ? s.act : 'face' in s ? s.face : 'move' in s ? s.move : null;
        if (who === null) continue;
        acted++;
        if (!cast.has(who) && !NPCS[who] && !PETS[who]) wrong.push(`${def.id}: ${who} is nobody`);
        // (the hero is turned, not walked or made to gesture: they are the player's)
        if (who === 'hero' && !('face' in s)) wrong.push(`${def.id}: the hero is made to ${'act' in s ? s.does : 'walk'}`);
        if ('act' in s && !GESTURES[s.does]) wrong.push(`${def.id}: no gesture ${s.does}`);
      }
      for (const s of def.steps) if ('zoom' in s && s.zoom !== 'auto' && !(ZOOMS[s.zoom] > 0.5 && ZOOMS[s.zoom] < 1.4)) wrong.push(`${def.id}: zoom ${s.zoom}`);
      // a scene that sets the camera's distance gives it back before it ends (the last lines are not left far off)
      const zooms = def.steps.flatMap((s) => ('zoom' in s ? [s.zoom] : []));
      if (zooms.length && zooms[zooms.length - 1] !== 'auto') wrong.push(`${def.id}: ends at zoom ${zooms[zooms.length - 1]}`);
    }
    expect(wrong).toEqual([]);
    expect(acted).toBeGreaterThan(30);
    expect(TALK_ZOOM).toBeLessThan(1);
  });
});

describe('Sigilfall: a spoken line on the screen', () => {
  /** A measure that errs wide (0.6 of the size a letter, more for bold): what fits by it fits in any face. */
  const measure = (text: string, px: number, weight: number): number => text.length * px * (weight >= 700 ? 0.66 : 0.6);
  const VIEWS: [number, number][] = [
    [320, 568],
    [360, 640],
    [390, 844],
    [568, 320],
    [844, 390],
    [768, 1024],
    [1280, 720],
    [1920, 1080],
  ];

  it('every line of the story is shown whole and inside the picture on every screen, a phone held either way too', () => {
    let cards = 0;
    for (const [viewW, viewH] of VIEWS) {
      const bar = viewH * 0.09 + 4;
      const fs = speechSize(viewW, viewH);
      expect(fs).toBeGreaterThanOrEqual(12);
      expect(fs).toBeLessThanOrEqual(15);
      for (const l of LINES) {
        const name = NPCS[l.who]?.name ?? PETS[l.who]?.name ?? 'A Hero With A Long Name';
        // over a head anywhere: the middle, each corner, and off every edge
        for (const [hx, hy] of [[0.5, 0.5], [0.02, 0.1], [0.98, 0.95], [-0.4, 0.5], [1.4, -0.3], [0.5, 1.6]] as const) {
          const c = layoutSpeech({ text: l.line, name, headX: viewW * hx, headY: viewH * hy, viewW, viewH, top: bar, bottom: bar, measure });
          cards++;
          const where = `${l.id} (${l.who}) on ${viewW}x${viewH}`;
          // nothing dropped
          expect(c.lines.join(' '), where).toBe(l.line.split(/\s+/).join(' '));
          // inside the picture, clear of the bars
          expect(c.x, where).toBeGreaterThanOrEqual(8);
          expect(c.x + c.w, where).toBeLessThanOrEqual(viewW - 8);
          expect(c.y, where).toBeGreaterThanOrEqual(bar);
          expect(c.y + c.h, where).toBeLessThanOrEqual(viewH - bar);
          // and its words inside the card
          for (const row of c.lines) expect(measure(row, c.fs, 600), where).toBeLessThanOrEqual(c.w - c.padX * 2 + 0.5);
          expect(measure(name, c.nameFs, 800), where).toBeLessThanOrEqual(c.w - c.padX * 2 + 0.5);
          expect(c.textY + (c.lines.length - 1) * c.lineH, where).toBeLessThanOrEqual(c.y + c.h - c.padY * 0.5);
        }
      }
    }
    expect(cards).toBeGreaterThan(10_000);
  });

  it('words are broken only between words, and one too long for its line keeps a line to itself', () => {
    const wide = (s: string): number => s.length * 10;
    expect(wrapWords('one two three four', 75, wide)).toEqual(['one two', 'three', 'four']);
    expect(wrapWords('  a   b  ', 100, wide)).toEqual(['a b']);
    expect(wrapWords('a supercalifragilistic word', 80, wide)).toEqual(['a', 'supercalifragilistic', 'word']);
    expect(wrapWords('', 80, wide)).toEqual([]);
  });
});
