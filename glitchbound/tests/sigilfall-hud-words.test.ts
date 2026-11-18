/**
 * Words on the HUD that a first play-through caught going wrong: a talent's bonus printed with a rounding tail
 * ("+0.6000000000000001 third-swing damage"), every skill's cost called "mana" whatever the class spends, and a
 * companion's shout written across the quest on a phone held on its side.
 */
import { describe, expect, it } from 'vitest';
import { CLASSES, CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { TALENTS } from '../src/games/sigilfall/data/talents';
import { costText, opText } from '../src/games/sigilfall/progress/describe';
import { boxesMeet, layoutSpeech, layoutSpeechClear, type ViewBox } from '../src/games/sigilfall/render/speech';

describe('Sigilfall: numbers a player reads are rounded for the eye', () => {
  it('a talent bonus that adds up over ranks never shows a rounding tail', () => {
    // Third Blood, three ranks of 0.2: 0.6000000000000001 in binary
    expect(opText('Cleave', { op: 'extra', key: 'comboMul', n: 0.2 * 3, label: 'third-swing damage' })).toBe('Cleave: +0.6 third-swing damage.');
    expect(opText('Cleave', { op: 'extra', key: 'comboMul', n: 0.1 + 0.2, label: 'third-swing damage' })).toBe('Cleave: +0.3 third-swing damage.');
    expect(opText('Arcane Bolt', { op: 'extra', key: 'lance', n: 0.25, label: 'Arcane Lance damage' })).toBe('Arcane Bolt: +0.25 Arcane Lance damage.');
    expect(opText('Trap', { op: 'extra', key: 'maxTraps', n: 2, label: 'traps at once' })).toBe('Trap: +2 traps at once.');
  });

  it('holds for every rank of every talent of every class', () => {
    let seen = 0;
    for (const cls of CLASS_IDS) {
      for (const node of TALENTS[cls]) {
        for (const mod of node.mods) {
          if (mod.t !== 'skill' || mod.op.op !== 'extra') continue;
          for (let rank = 1; rank <= node.ranks; rank++) {
            const said = opText('Skill', { ...mod.op, n: mod.op.n * rank });
            seen++;
            expect(said, `${cls} ${node.name} rank ${rank}`).not.toMatch(/\d\.\d{3,}/);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(10);
  });
});

describe('Sigilfall: a skill costs what the class spends', () => {
  it('names the class’s own resource, and counts it the way the fight does', () => {
    const res = (cls: (typeof CLASS_IDS)[number]) => CLASSES[cls].resource ?? null;
    // Rage, Focus and Umbra are points of a fixed hundred
    expect(costText(res('warrior'), 20, 100)).toBe('20 Rage');
    expect(costText(res('ranger'), 30, 100)).toBe('30 Focus');
    expect(costText(res('gloamknight'), 25, 100)).toBe('25 Umbra');
    // Zeal comes in whole points of five (it read "0 mana": three points taken as 3% of five)
    expect(costText(res('paladin'), 3, 5)).toBe('3 Zeal');
    // mana is a share of a pool that grows with the hero
    expect(costText(res('mage'), 12, 340)).toBe('41 Mana');
    // free skills say nothing
    expect(costText(res('warrior'), 0, 100)).toBeNull();
    expect(costText(null, 20, 100)).toBeNull();
  });

  it('never says "mana" for a class that has none', () => {
    for (const cls of CLASS_IDS) {
      const r = CLASSES[cls].resource;
      if (!r || r.kind === 'mana') continue;
      expect(costText(r, 10, r.base), cls).not.toMatch(/mana/i);
    }
  });
});

describe('Sigilfall: a shout on a phone is not written across the quest', () => {
  const measure = (text: string, px: number, weight: number): number => text.length * px * (weight >= 700 ? 0.66 : 0.6);
  const LINES = SCENES.flatMap((d) => d.steps.flatMap((s) => ('say' in s ? [s.line] : [])));
  // the HUD of a phone on its side as the browser lays it out (measured in the running game)
  const PHONES: { view: [number, number]; hud: Record<string, ViewBox> }[] = [
    { view: [844, 390], hud: { quest: { x: 8, y: 62, w: 280, h: 65 }, map: { x: 752, y: 32, w: 84, h: 84 }, thumbs: { x: 597, y: 186, w: 241, h: 198 }, potion: { x: 706, y: 166, w: 43, h: 43 } } },
    { view: [667, 375], hud: { quest: { x: 8, y: 62, w: 247, h: 65 }, map: { x: 575, y: 32, w: 84, h: 84 }, thumbs: { x: 420, y: 171, w: 241, h: 198 }, potion: { x: 529, y: 151, w: 43, h: 43 } } },
  ];

  it('goes beside the quest wherever it fits, with nothing dropped and nothing under the thumbs or the map', () => {
    for (const { view, hud } of PHONES) {
      const [viewW, viewH] = view;
      const boxes = new Map(Object.entries(hud));
      let across = 0;
      let moved = 0;
      let still = 0;
      for (const line of LINES) {
        // a speaker at the left of the picture, from its top to its middle: where the old card covered the quest
        for (const [hx, hy] of [[0.05, 0.3], [0.2, 0.4], [0.3, 0.45], [0.35, 0.55]] as const) {
          const ask = { text: line, name: 'Captain Mara', headX: viewW * hx, headY: viewH * hy, viewW, viewH, top: 62, bottom: 76, left: viewW * 0.26, right: viewW * 0.39, measure };
          const before = layoutSpeech(ask);
          const after = layoutSpeechClear(ask, boxes);
          const where = `"${line.slice(0, 30)}" at ${hx},${hy} on ${viewW}x${viewH}`;
          expect(after.lines.join(' '), where).toBe(line.split(/\s+/).join(' '));
          if (!boxesMeet(before, hud.quest!, 2)) {
            // nothing to get out of the way of: the card is where it always was
            expect(after, where).toEqual(before);
            continue;
          }
          across++;
          if (boxesMeet(after, hud.quest!, 2)) {
            // no room beside it: left where it was (the HUD fades the quest meanwhile)
            still++;
            expect(after, where).toEqual(before);
            continue;
          }
          moved++;
          for (const k of ['map', 'thumbs', 'potion']) expect(boxesMeet(after, hud[k]!, 2), `${where} on the ${k}`).toBe(false);
          expect(after.x + after.w, where).toBeLessThanOrEqual(viewW - 8);
          expect(after.y, where).toBeGreaterThanOrEqual(62);
          expect(after.lines.length, where).toBeLessThanOrEqual(before.lines.length + 1);
        }
      }
      // it happened often before. A wide phone has room beside the quest nearly every time; a narrow one for its
      // shorter lines (a long one there would be broken into a column, so it stays and the quest fades). (The story's
      // lines run a little longer since it was told whole, 2026-11-18: a fifth of them, near enough, on the narrowest)
      expect(across, `${viewW}x${viewH}`).toBeGreaterThan(200);
      expect(moved / across, `${viewW}x${viewH}: ${moved} moved, ${still} left`).toBeGreaterThan(viewW >= 800 ? 0.9 : 0.18);
    }
  });

  it('leaves a line alone where there is no quest on the screen (a boss fight, a scene, a desk)', () => {
    const ask = { text: 'Behind you!', name: 'Mara Venn', headX: 100, headY: 150, viewW: 844, viewH: 390, top: 62, bottom: 76, left: 219, right: 329, measure };
    expect(layoutSpeechClear(ask, null)).toEqual(layoutSpeech(ask));
    expect(layoutSpeechClear(ask, new Map())).toEqual(layoutSpeech(ask));
    // (the quest on the far side, as a left-handed player has it: nothing to move for)
    expect(layoutSpeechClear(ask, new Map([['quest', { x: 556, y: 62, w: 280, h: 65 }]]))).toEqual(layoutSpeech(ask));
  });
});
