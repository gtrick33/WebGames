/**
 * What a piece picked up says (the owner, 2026-11-24: "double item notifications on collecting items, it should only be
 * the one on top, the collapsed one, also this should only appear during leveling, if ur doing riftstones, it should not
 * be visible as its distracting ... checkpoint reached text is also redundant"): on a touch screen a piece worth wearing
 * has the strip at the top and no card as well; in a Riftstone run nothing is said; a checkpoint only chimes.
 */
import { describe, expect, it, vi } from 'vitest';
import { SigilEngine, type UiState } from '../src/games/sigilfall/engine';
import { newCharacter } from '../src/games/sigilfall/progress/character';
import { makeItem, rollGear } from '../src/games/sigilfall/progress/items';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { ITEM_DEFS } from '../src/games/sigilfall/data/items';
import type { Item } from '../src/games/sigilfall/data/types';
import { rng } from '../src/games/sigilfall/core/math';

type Probe = { ui: UiState; handleEvents(w: unknown): void; hero: ReturnType<typeof newCharacter>; touchMode: boolean };

/** An engine with just what the news of a pickup touches. */
function engine(touch: boolean): Probe {
  const h = newCharacter('mage', 'QApick', 'hero0', 1_800_000_000_000);
  h.level = 20;
  h.opened.push('hint:equip');
  const e = Object.create(SigilEngine.prototype) as SigilEngine & Record<string, unknown>;
  const ui = { screen: 'game', panel: null, pause: false, dialogue: null, travel: null, toasts: [], banner: null, death: false, reward: null, boss: null, levelUp: null, teach: null, tip: null, notice: '', card: null, equipAsk: null, questCard: null } as unknown as UiState;
  Object.assign(e, {
    ui,
    hero: h,
    touchMode: touch,
    save: { settings: { ...DEFAULT_SETTINGS, tutorial: false }, heroes: [h] },
    sound: { play: vi.fn(), setVolumes: vi.fn(), suspend: vi.fn(), setMusic: vi.fn(), setAmbience: vi.fn(), setMix: vi.fn() },
    renderer: { waiting: false, reducedMotion: false, setZoom: () => {}, setGraphics: () => {} },
    coop: null,
    hidden: false,
    tipQueue: [],
    pages: [],
    cards: [],
    tipAfter: 0,
    saveAt: 0,
    version: 0,
    listeners: new Set(),
  });
  return e as unknown as Probe;
}

/** A world for the events to come from: in the land, or in a Riftstone run. */
const world = (events: unknown[], keyRun = false) => ({ scene: null, keyRun: keyRun ? { key: 5 } : null, events, story: { talking: false, fighting: false }, region: { id: 'amberfield' } });

/** A piece in the hero's bag, far better than what they wear (nothing). */
function better(e: Probe, rarity: 'rare' | 'legendary'): Item {
  const it = rarity === 'legendary' ? makeItem(Object.values(ITEM_DEFS).find((d) => d.rarity === 'legendary' && d.cls === 'mage' && d.slot === 'weapon')!.id, 24)! : rollGear('mage', 24, 'rare', rng(7), 'chest');
  e.hero.bag.push(it);
  return it;
}

describe('Sigilfall: news of a piece picked up', () => {
  it('on a touch screen, a piece worth wearing has the strip at the top and no card besides', () => {
    for (const r of ['rare', 'legendary'] as const) {
      const e = engine(true);
      const it = better(e, r);
      e.handleEvents(world([{ t: 'loot', item: it }]));
      expect(e.ui.equipAsk?.uid, r).toBe(it.uid);
      expect(e.ui.toasts.filter((t) => t.item?.uid === it.uid), r).toEqual([]);
    }
  });

  it('with a mouse, the card says it (there is no strip there)', () => {
    const e = engine(false);
    const it = better(e, 'legendary');
    e.handleEvents(world([{ t: 'loot', item: it }]));
    expect(e.ui.equipAsk).toBeFalsy();
    expect(e.ui.toasts.map((t) => t.item?.uid)).toContain(it.uid);
  });

  it('says nothing in a Riftstone run, on a phone or a desktop', () => {
    for (const touch of [true, false]) {
      const e = engine(touch);
      const it = better(e, 'legendary');
      e.handleEvents(world([{ t: 'loot', item: it }], true));
      expect(e.ui.equipAsk).toBeFalsy();
      expect(e.ui.toasts.filter((t) => t.tone === 'loot' || t.item).map((t) => t.text)).toEqual([]);
    }
  });

  it('only chimes at a checkpoint', () => {
    const e = engine(true);
    (e as unknown as { scheduleSave: () => void }).scheduleSave = () => {};
    e.handleEvents(world([{ t: 'checkpoint' }]));
    expect(e.ui.toasts.map((t) => t.text).filter((x) => /checkpoint|potions/i.test(x))).toEqual([]);
  });
});
