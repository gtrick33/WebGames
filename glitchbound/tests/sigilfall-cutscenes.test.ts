/**
 * Cutscenes (POLISH_PLAN.md piece 12): a scene's lines carry the speaker's face beside their words, and a scene can be
 * previewed from any of its steps (the review tools' scene previewer), the steps before it run through at once.
 */
import { describe, expect, it } from 'vitest';
import { PETS } from '../src/games/sigilfall/data/pets';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { faceSource, hasPersonLook } from '../src/games/sigilfall/render/sprites';
import { layoutSpeech, type SpeechAsk } from '../src/games/sigilfall/render/speech';
import { previewScene } from '../src/games/sigilfall/sim/scene';
import { stepLabel } from '../src/games/sigilfall/ui/ScenePreviewer';
import { newWorld, readyHero } from './sigilfall-bot';

/** A measure that gives every letter the same width, as a monospaced font would. */
const measure = (text: string, px: number): number => text.length * px * 0.55;

function ask(over: Partial<SpeechAsk> = {}): SpeechAsk {
  return { text: 'The bells rang at dusk, and the dead answered them from under the chapel.', name: 'Elder Maren', headX: 640, headY: 360, viewW: 1280, viewH: 720, top: 70, bottom: 70, measure, staged: true, ...over };
}

describe('Sigilfall: a scene’s line has its speaker’s face', () => {
  it('keeps room for the face before the name and the words, and the card is tall enough for it', () => {
    const plain = layoutSpeech(ask());
    const faced = layoutSpeech(ask({ face: 56 }));
    expect(plain.face).toBe(0);
    expect(plain.lead).toBe(0);
    expect(faced.face).toBe(56);
    expect(faced.lead).toBeGreaterThan(56);
    expect(faced.w).toBeGreaterThan(plain.w);
    expect(faced.h).toBeGreaterThanOrEqual(56 + faced.padY);
    // the words stand inside the card, after the face, the name over them
    expect(faced.textY).toBeGreaterThan(faced.nameY);
    expect(faced.nameY).toBeGreaterThan(faced.y);
    expect(faced.textY + (faced.lines.length - 1) * faced.lineH).toBeLessThan(faced.y + faced.h);
  });

  it('leaves the face out where the picture is too narrow for it beside the words', () => {
    const card = layoutSpeech(ask({ face: 56, viewW: 260, headX: 130 }));
    expect(card.face).toBe(0);
    expect(card.lead).toBe(0);
  });

  it('shows a companion who speaks in a scene as the person they are dressed as', () => {
    const companions = [...new Set(SCENES.flatMap((d) => d.steps.flatMap((st) => ('say' in st ? [st.say] : []))))].filter((id) => PETS[id]);
    expect(companions).toEqual(expect.arrayContaining(['mara', 'elyra', 'nyx']));
    for (const id of companions) {
      const def = PETS[id]!;
      const src = faceSource({ npcs: [], pets: [{ dead: false, def }], enemies: [] } as never, id);
      expect(def.look && hasPersonLook(def.look), `${id} has a look as a person`).toBe(true);
      expect(src, id).toEqual({ kind: 'npc', id: def.look });
    }
    // (Mara walks with the hero as `mara` and is dressed as `mara-venn`: her face was the old pixel figure before)
    expect(faceSource({ npcs: [], pets: [{ dead: false, def: PETS.mara! }], enemies: [] } as never, 'mara')).toEqual({ kind: 'npc', id: 'mara-venn' });
    expect(faceSource({ npcs: [], pets: [], enemies: [] } as never, 'hero')).toEqual({ kind: 'hero' });
  });
});

describe('Sigilfall: the scene previewer', () => {
  const hero = readyHero('warrior', 3);
  const longOne = SCENES.find((d) => d.region === 'briarhollow' && d.steps.length >= 6)!;

  it('plays a scene from one of its steps, the steps before it run through', () => {
    const w = newWorld('briarhollow', hero);
    expect(previewScene(w, longOne.id, 4)).toBe(true);
    expect(w.scene?.def.id).toBe(longOne.id);
    expect(w.scene!.step).toBeGreaterThanOrEqual(4);
    // (a companion who speaks in it is at the hero's side, as when it plays at its moment)
    for (const who of new Set(longOne.steps.flatMap((st) => ('say' in st ? [st.say] : [])))) expect(w.npcs.some((n) => n.id === who) || w.pets.some((p) => !p.dead && p.def.id === who), who).toBe(true);
    // and again from its start, ending the one that was playing
    expect(previewScene(w, longOne.id, 0)).toBe(true);
    expect(w.scene!.step).toBe(0);
  });

  it('plays nothing of another land, nor an unknown scene', () => {
    const w = newWorld('briarhollow', hero);
    const elsewhere = SCENES.find((d) => d.region !== 'briarhollow')!;
    expect(previewScene(w, elsewhere.id, 0)).toBe(false);
    expect(previewScene(w, 'no-such-scene', 0)).toBe(false);
    expect(w.scene).toBeNull();
  });

  it('names every step of every scene in a few words', () => {
    for (const d of SCENES) for (const [i, st] of d.steps.entries()) expect(stepLabel(st), `${d.id} step ${i}`).not.toBe('');
  });
});
