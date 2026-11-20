/**
 * The screen's one owner (POLISH_PLAN.md piece 2): words said on the picture never under the HUD or over each other,
 * shouts in a fight off the fight, and what comes and goes slid clear of what stays. The live game is checked at four
 * sizes by scripts/sigilfall-overlap-check.mjs; this holds the rules it rests on.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { boxesMeet, placeSpeech, type SpeechAsk, type SpeechRoom, type ViewBox } from '../src/games/sigilfall/render/speech';
import { keepInside, slideClear, slideLimit } from '../src/games/sigilfall/ui/layout';

// (about what the game's font measures: half an em a letter, a little more in bold)
const measure = (text: string, px: number, weight: number): number => text.length * px * (weight >= 700 ? 0.56 : 0.5);
const LINES = SCENES.flatMap((d) => d.steps.flatMap((s) => ('say' in s ? [s.line] : [])));

/** The HUD as the browser lays it out (measured in the running game). */
const SCREENS: { id: string; view: [number, number]; touch: boolean; hud: Record<string, ViewBox> }[] = [
  {
    id: 'laptop',
    view: [770, 516],
    touch: false,
    hud: {
      hero: { x: 8, y: 6, w: 336, h: 58 },
      menu: { x: 438, y: 6, w: 324, h: 42 },
      map: { x: 674, y: 56, w: 88, h: 88 },
      quest: { x: 430, y: 62, w: 236, h: 72 },
      toasts: { x: 8, y: 66, w: 290, h: 150 },
      bar: { x: 170, y: 432, w: 430, h: 74 },
    },
  },
  {
    id: 'phone',
    view: [844, 390],
    touch: true,
    hud: {
      hero: { x: 6, y: 4, w: 262, h: 54 },
      menu: { x: 502, y: 4, w: 238, h: 44 },
      map: { x: 752, y: 32, w: 84, h: 84 },
      quest: { x: 8, y: 62, w: 280, h: 65 },
      thumbs: { x: 597, y: 186, w: 241, h: 198 },
      potion: { x: 706, y: 166, w: 43, h: 43 },
    },
  },
];

function room(s: (typeof SCREENS)[number], fight: boolean, action: ViewBox | null): SpeechRoom {
  const [W, H] = s.view;
  const wide = Math.min(W - 32, 600);
  const lane = s.touch ? { left: W * 0.26, right: Math.min(W * 0.66, s.hud.thumbs!.x - 10), bottom: H - 10 } : { left: (W - wide) / 2, right: (W + wide) / 2, bottom: s.hud.bar!.y - 8 };
  return { hud: Object.values(s.hud), action, lane, fight };
}

function ask(s: (typeof SCREENS)[number], text: string, hx: number, hy: number, extra: Partial<SpeechAsk> = {}): SpeechAsk {
  const [viewW, viewH] = s.view;
  return { text, name: 'Mara Venn', headX: viewW * hx, headY: viewH * hy, footY: viewH * hy + 40, viewW, viewH, top: s.touch ? 62 : 44, bottom: 76, left: s.touch ? viewW * 0.26 : 8, right: s.touch ? viewW * 0.39 : 8, measure, ...extra };
}

describe('Sigilfall: words said on the picture', () => {
  /** People speaking at once, from many places on the screen, with the story's own lines: the cards and how many are clear. */
  function crowd(s: (typeof SCREENS)[number], n: number): { clear: number; all: number } {
    let clear = 0;
    let all = 0;
    for (let i = 0; i + n - 1 < LINES.length; i += 3) {
      const spots: [number, number][] = [
        [0.12 + (i % 5) * 0.17, 0.22 + (i % 3) * 0.1],
        [0.5, 0.5],
        [0.3 + (i % 4) * 0.1, 0.62],
      ];
      const asks = spots.slice(0, n).map(([hx, hy], k) => ask(s, LINES[i + k]!, hx, hy));
      const cards = placeSpeech(asks, room(s, false, null), new Map(Object.entries(s.hud)));
      cards.forEach((c, k) => {
        const where = `${s.id}: "${asks[k]!.text.slice(0, 30)}"`;
        // (only a foe's bark ever gives way: these are the story's own lines)
        if (!c) throw new Error(`${where} was left out`);
        // every word kept, and all of it on the screen, whatever else
        expect(c.lines.join(' '), where).toBe(asks[k]!.text.split(/\s+/).join(' '));
        expect(c.x, where).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w, where).toBeLessThanOrEqual(s.view[0]);
        expect(c.y, where).toBeGreaterThanOrEqual(0);
        expect(c.y + c.h, where).toBeLessThanOrEqual(s.view[1]);
        const covered = Object.values(s.hud).some((b) => boxesMeet(c, b, 2)) || cards.some((d, j) => j < k && !!d && boxesMeet(c, d, 2));
        if (!covered) clear++;
        all++;
      });
    }
    return { clear, all };
  }

  it('one or two people speaking at once: never under the HUD, never over each other', () => {
    for (const s of SCREENS) {
      for (const n of [1, 2]) {
        const { clear, all } = crowd(s, n);
        expect(all, `${s.id} ${n}`).toBeGreaterThan(100);
        expect(clear, `${s.id}, ${n} at once`).toBe(all);
      }
    }
  });

  it('three at once, long lines on a small screen: most find room, and the rest keep every word on the screen', () => {
    // (three of the story's longest lines at once can fill a laptop's picture; one with nowhere to go stays over its
    // speaker's head and the HUD piece under it fades until it is said, as every line did before)
    for (const s of SCREENS) {
      const { clear, all } = crowd(s, 3);
      expect(clear / all, `${s.id}: ${clear} of ${all} clear`).toBeGreaterThan(0.65);
    }
  });

  it('a crowd of foes’ barks gives way where there is no room, never over a line that matters', () => {
    for (const s of SCREENS) {
      const [W, H] = s.view;
      const action = { x: W * 0.38, y: H * 0.36, w: W * 0.24, h: H * 0.24 };
      const story = ask(s, 'Rangers on the left, riders on the right! Take back the square!', 0.5, 0.5);
      const barks = [0.2, 0.35, 0.5, 0.65, 0.8, 0.3, 0.7].map((hx, k) => ask(s, LINES[k * 7]!, hx, 0.3 + (k % 3) * 0.1, { minor: true }));
      const cards = placeSpeech([...barks, story], room(s, true, action), new Map(Object.entries(s.hud)));
      const drawn = cards.filter((c): c is NonNullable<typeof c> => !!c);
      // the line that matters is always drawn, and placed before the barks: nothing lies over it
      expect(cards[cards.length - 1], s.id).not.toBeNull();
      for (let a = 0; a < drawn.length; a++) for (let b = a + 1; b < drawn.length; b++) expect(boxesMeet(drawn[a]!, drawn[b]!, 2), `${s.id}: ${a} over ${b}`).toBe(false);
    }
  });

  it('in a fight, goes to the lane along the bottom, off the fight', () => {
    for (const s of SCREENS) {
      const [W, H] = s.view;
      // (the hero in the middle of the picture with a foe on each side, as the renderer measures a fight)
      const action = { x: W * 0.38, y: H * 0.36, w: W * 0.24, h: H * 0.24 };
      const cards = placeSpeech([ask(s, 'Archer! Dodge when it draws!', 0.5, 0.35), ask(s, 'Hold the line, all of you!', 0.45, 0.4)], room(s, true, action), new Map(Object.entries(s.hud)));
      for (const c of cards) {
        if (!c) throw new Error('left out');
        expect(c.lane, s.id).toBe(true);
        expect(boxesMeet(c, action, 0), s.id).toBe(false);
        expect(c.tailX, s.id).toBeNull();
      }
      expect(boxesMeet(cards[0]!, cards[1]!, 2), s.id).toBe(false);
    }
  });

  // the owner: "when i walk alongside npcs, their bubbles keep switching from top to bottom screen with their movement
  // and i cant read them". Each frame took the best place afresh, so a card went over a walking speaker's head, off it
  // as they came by the hero, back over it, and so on
  it('stays where it was put while that place is free, rather than jumping back and forth as people walk', () => {
    for (const s of SCREENS) {
      const [W, H] = s.view;
      const hudMap = new Map(Object.entries(s.hud));
      const line = 'Stay close to me, the road bends down to the river here and the bridge is out.';
      const over = placeSpeech([ask(s, line, 0.5, 0.5)], room(s, false, null), hudMap)[0]!;
      // the hero beside the speaker, now across the card over their head, now not, frame after frame as they walk
      const across = { x: over.x, y: over.y, w: over.w, h: over.h };
      let keep = over.keep;
      let was: ViewBox | null = null;
      let moves = 0;
      for (let f = 0; f < 24; f++) {
        const card = placeSpeech([ask(s, line, 0.5, 0.5, keep ? { keep } : {})], room(s, false, f % 2 ? null : across), hudMap)[0]!;
        if (was && (Math.abs(card.x - was.x) > 2 || Math.abs(card.y - was.y) > 2)) moves++;
        was = card;
        keep = card.keep;
      }
      // (it moves off the hero once, and stays)
      expect(moves, s.id).toBeLessThanOrEqual(1);
      expect(W > 0 && H > 0).toBe(true);
    }
  });

  it('a subtitle in the lane stays in the lane while the fight comes and goes', () => {
    for (const s of SCREENS) {
      const hudMap = new Map(Object.entries(s.hud));
      let keep = placeSpeech([ask(s, 'Hold the line, all of you!', 0.5, 0.4)], room(s, true, null), hudMap)[0]!.keep;
      expect(keep && 'lane' in keep && keep.lane, s.id).toBe(true);
      for (let f = 0; f < 10; f++) {
        const card = placeSpeech([ask(s, 'Hold the line, all of you!', 0.5, 0.4, { keep })], room(s, f % 2 === 0, null), hudMap)[0]!;
        expect(card.lane, `${s.id} frame ${f}`).toBe(true);
        keep = card.keep;
      }
    }
  });

  it('keeps a scene’s line over its speaker: a scene’s words never go to the lane', () => {
    for (const s of SCREENS) {
      const cards = placeSpeech([ask(s, 'Three of ours died last night, and the courier.', 0.5, 0.45, { staged: true })], room(s, true, null), null);
      expect(cards[0]!.lane, s.id).toBeFalsy();
      expect(cards[0]!.tailX, s.id).not.toBeNull();
    }
  });

  it('two people side by side in a scene get a card each, not one over the other', () => {
    const view: [number, number] = [844, 390];
    const scene: SpeechRoom = { hud: [], action: null, lane: null, fight: false };
    for (let i = 0; i + 1 < LINES.length; i += 11) {
      const a = { text: LINES[i]!, name: 'Elder Maren', headX: 400, headY: 170, footY: 210, viewW: view[0], viewH: view[1], top: 39, bottom: 39, measure, staged: true };
      const b = { ...a, text: LINES[i + 1]!, name: 'Elyra', headX: 440, staged: false };
      const [ca, cb] = placeSpeech([a, b], scene);
      expect(boxesMeet(ca!, cb!, 2), `"${a.text.slice(0, 24)}" / "${b.text.slice(0, 24)}"`).toBe(false);
    }
  });
});

describe('Sigilfall: what comes and goes slides clear of what stays', () => {
  const quest = { x: 430, y: 62, w: 236, h: 72 };
  it('stays where it stands when nothing is under it', () => {
    expect(slideClear({ x: 100, y: 200, w: 200, h: 40 }, [quest], 400)).toBe(0);
  });
  it('slides down past what it would cover', () => {
    const dy = slideClear({ x: 300, y: 80, w: 300, h: 40 }, [quest], 400);
    expect(dy).toBeGreaterThan(0);
    expect(boxesMeet({ x: 300, y: 80 + dy, w: 300, h: 40 }, quest, 6)).toBe(false);
  });
  it('slides up off a button when asked to', () => {
    const button = { x: 700, y: 300, w: 60, h: 60 };
    const dy = slideClear({ x: 650, y: 280, w: 150, h: 40 }, [button], 40, -1);
    expect(dy).toBeLessThan(0);
    expect(boxesMeet({ x: 650, y: 280 + dy, w: 150, h: 40 }, button, 6)).toBe(false);
  });
  it('gives up, and stays where it was meant to be, when nothing within reach is clear', () => {
    expect(slideClear({ x: 0, y: 0, w: 800, h: 40 }, [{ x: 0, y: 0, w: 800, h: 500 }], 300)).toBe(0);
  });
  it('never slides down onto the hero: where the hero stands under it, it stops above their head', () => {
    // (the quest's card on a laptop: the quest is under where it would stand, and the hero below that)
    const card = { x: 261, y: 62, w: 253, h: 150 };
    const hero = { x: 315, y: 225, w: 40, h: 45 };
    const limit = slideLimit(card, 520, hero);
    expect(limit).toBe(hero.y - card.h - 6);
    // nothing clear above the hero: it stays where it was meant to be, and the hero stays in sight
    const dy = slideClear(card, [{ x: 435, y: 70, w: 200, h: 55 }], limit);
    expect(dy).toBe(0);
    // (with the hero to one side, the slide goes as far as it always did)
    expect(slideLimit(card, 520, { ...hero, x: 600 })).toBe(520 * 0.55);
    expect(slideLimit(card, 520, null)).toBe(520 * 0.55);
  });
  it('what an announcement can’t slide clear of without coming over the hero steps aside while it is up', () => {
    // (the quest and the news: on a laptop a land's name stood over the quest, the hero being under where it would go)
    const screen = readFileSync('src/games/sigilfall/ui/GameScreen.tsx', 'utf8');
    expect(screen.match(/el\.classList\.toggle\('is-under-announce', !!r && !!at && r\.floatBoxes\.some\(\(b\) => boxesMeet\(b, at, 2\)\)\);/g)?.length).toBe(2);
    const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
    expect(css).toMatch(/\.rb-tracker\.is-under-speech,\n\.rb-tracker\.is-under-announce \{\n {2}opacity: 0;/);
    expect(css).toMatch(/\.rb-toasts\.is-under-speech,\n\.rb-toasts\.is-under-announce \{\n {2}opacity: 0\.18;/);
  });
  it('keeps inside the picture side to side', () => {
    expect(keepInside({ x: -20, y: 0, w: 100, h: 10 }, 8, 760)).toBe(28);
    expect(keepInside({ x: 700, y: 0, w: 100, h: 10 }, 8, 760)).toBe(-40);
    expect(keepInside({ x: 100, y: 0, w: 100, h: 10 }, 8, 760)).toBe(0);
  });
});

describe('Sigilfall: every animation is the one it was written for', () => {
  it('no two keyframes share a name (the later one silently takes the earlier one\'s place)', () => {
    const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
    const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]!);
    const twice = names.filter((n, i) => names.indexOf(n) !== i);
    expect(twice).toEqual([]);
  });
});
