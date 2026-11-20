/**
 * The quest under the hero's bars on a phone (the owner, on an iPhone 17 Pro: "the quest keeps overlapping the sigils
 * count, moreover, if i close it i cant really reopen it again as the joystick turns on").
 *
 * - On a phone held upright the game is laid out on its side and turned a quarter (Game.css `.is-turned`): the
 *   canvas's width on the screen is the game's height. The screen's owner (ui/layout.ts) took it as the width, so
 *   every piece it placed measured 1.8 times its size and moved half as far as it was told.
 * - The quest is a piece that stays: it slides clear of the hero's frame (where the sigils are) wherever the hero
 *   stands, instead of giving up above the hero's head as an announcement does.
 * - It, and the hero's frame, stand over the joystick's zone, so a tap on them is theirs.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SigilEngine } from '../src/games/sigilfall/engine';
import type { ViewBox } from '../src/games/sigilfall/render/speech';
import { placeDown } from '../src/games/sigilfall/ui/layout';

/** A rectangle as the browser says it, from its left, top and size. */
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

/**
 * A phone held upright, 402 by 740, with the game turned onto its side in it (740 wide, 402 tall), and the quest
 * where its CSS stands it: 70 in from the game's left (the island's inset), 62 down, 280 by 72.
 */
function upright(opts: { figure?: ViewBox } = {}) {
  const stage = document.createElement('div');
  stage.className = 'rb is-turned';
  const canvas = document.createElement('canvas');
  const ui = document.createElement('div');
  ui.className = 'rb-ui';
  const quest = document.createElement('button');
  ui.append(quest);
  stage.append(canvas, ui);
  document.body.append(stage);
  canvas.getBoundingClientRect = () => rect(0, 0, 402, 740);
  // (turned a quarter clockwise: the game's x runs down the screen, its y in from the screen's right)
  quest.getBoundingClientRect = () => rect(402 - 62 - 72, 70, 72, 280);
  Object.defineProperty(quest, 'offsetWidth', { value: 280 });
  Object.defineProperty(quest, 'offsetHeight', { value: 72 });
  const boxes = new Map<string, ViewBox>([['hero', { x: 70, y: 6, w: 262, h: 90 }]]);
  const fig = opts.figure;
  const renderer = {
    canvas,
    viewW: 740,
    viewH: 402,
    hudBoxes: boxes,
    landReady: !!fig,
    setHudBox: (id: string, b: ViewBox | null) => (b ? boxes.set(id, b) : boxes.delete(id)),
    // the hero's head and feet where `figure` says (ui/layout.ts figureOf)
    toScreenAt: (_x: number, _y: number, z: number) => ({ x: fig ? fig.x + fig.w / 2 : 0, y: fig ? (z > 0 ? fig.y : fig.y + fig.h) : 0 }),
  };
  const engine = { renderer, world: { player: { x: 0, y: 0 } } } as unknown as SigilEngine;
  return { engine, quest, done: () => stage.remove() };
}

describe('Sigilfall: the quest under the hero’s bars on an upright phone', () => {
  it('slides down clear of the hero’s frame (the sigils under the bars) by as much as it has to, in the game’s own pixels', () => {
    const { engine, quest, done } = upright();
    placeDown(engine, quest, ['hero'], 'quest', true);
    // the frame ends at 96 and a gap of 6 is kept: 62 slides to 104, in steps of 6
    expect(quest.style.translate).toBe('0px 42px');
    done();
  });

  it('gets clear even when the hero stands under it, where an announcement would stay put', () => {
    // the hero at the middle of the picture, its edge under the quest's right end
    const figure = { x: 340, y: 150, w: 40, h: 60 };
    const held = upright({ figure });
    placeDown(held.engine, held.quest, ['hero'], 'quest');
    expect(held.quest.style.translate).toBe('');
    held.done();
    const quest = upright({ figure });
    placeDown(quest.engine, quest.quest, ['hero'], 'quest', true);
    expect(quest.quest.style.translate).toBe('0px 42px');
    quest.done();
  });
});

describe('Sigilfall: a tap on the quest is the quest’s', () => {
  it('the quest and the hero’s frame stand over the joystick’s zone on touch', () => {
    const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
    const rule = /\.rb-ui\.is-touch > \.rb-tracker,\s*\.rb-ui\.is-touch > \.rb-hud-hero \{\s*z-index: (\d+);/.exec(css);
    expect(rule).not.toBeNull();
    expect(Number(rule![1])).toBeGreaterThan(0);
    // (and the joystick's zone has no stacking of its own to climb over them)
    const zone = /\n\.rb-joyzone \{([^}]*)\}/.exec(css);
    expect(zone?.[1]).not.toMatch(/z-index/);
  });
});
