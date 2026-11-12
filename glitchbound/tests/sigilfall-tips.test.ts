/**
 * Sigilfall's first-timer tutorial: who gets it, what it says on each input, that it only pauses the game, and that
 * the hint's card stays on the screen.
 */
import { describe, expect, it, vi } from 'vitest';
import { SigilEngine, type UiState } from '../src/games/sigilfall/engine';
import { CLASSES } from '../src/games/sigilfall/data/classes';
import { newCharacter } from '../src/games/sigilfall/progress/character';
import { DEFAULT_SETTINGS, validateCharacter, validateSettings } from '../src/games/sigilfall/progress/save';
import { giveTips, takesTips, tipDue, tipKey, tipShown, tipSteps, TIPS_MARK, type TipContext, type TipId } from '../src/games/sigilfall/progress/tips';
import { placeTipCard } from '../src/games/sigilfall/ui/Tips';

const hero = () => newCharacter('mage', 'QAtip', 'hero0', 1_800_000_000_000);
const ctx = (over: Partial<TipContext> = {}): TipContext => ({ touch: false, bar: { s1: CLASSES.mage.skills[0], s2: null, s3: null, s4: null }, resource: { kind: 'mana', name: 'Mana' } as TipContext['resource'], specChosen: false, ...over });

describe('sigilfall hints: who gets them', () => {
  it('skips heroes from before the tutorial, and heroes with the setting off', () => {
    const old = hero();
    expect(takesTips(old)).toBe(false);
    expect(tipDue(old, true, 'combat')).toBe(false);
    const h = hero();
    giveTips(h);
    expect(tipDue(h, true, 'combat')).toBe(true);
    expect(tipDue(h, false, 'combat')).toBe(false);
  });

  it('shows each hint once', () => {
    const h = hero();
    giveTips(h);
    giveTips(h);
    expect(h.opened.filter((k) => k === TIPS_MARK)).toHaveLength(1);
    tipShown(h, 'bag');
    tipShown(h, 'bag');
    expect(h.opened.filter((k) => k === tipKey('bag'))).toHaveLength(1);
    expect(tipDue(h, true, 'bag')).toBe(false);
    expect(tipDue(h, true, 'spell')).toBe(true);
  });

  it('survives a save, and a save from before it has the hints on by default', () => {
    const h = hero();
    giveTips(h);
    tipShown(h, 'combat');
    const back = validateCharacter(JSON.parse(JSON.stringify(h)), 0);
    expect(back?.opened).toEqual(expect.arrayContaining([TIPS_MARK, tipKey('combat')]));
    expect(validateSettings({}).tutorial).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, tutorial: false }).tutorial).toBe(false);
  });
});

describe('sigilfall hints: what they say', () => {
  it('teaches attack, spell and dodge before the first fight, on the input in use', () => {
    const mouse = tipSteps('combat', ctx());
    expect(mouse.map((s) => s.target)).toEqual(['.rb-slot6.is-basic', '.rb-slot6.is-s1', '.rb-slot6.is-dodge']);
    expect(mouse[0]!.text).toMatch(/Left-click/);
    expect(mouse[1]!.title).toContain(': ');
    expect(mouse[1]!.text).toMatch(/Press Q/);
    expect(mouse[2]!.text).toMatch(/Space/);
    const touch = tipSteps('combat', ctx({ touch: true }));
    expect(touch.map((s) => s.target)).toEqual(['.rb-sb-basic', '.rb-sb-s1', '.rb-sb-dodge']);
    expect(touch.map((s) => s.text).join(' ')).not.toMatch(/Left-click|Press /);
    expect(touch.every((s) => s.panel === null)).toBe(true);
  });

  it('says how a skill is paid for, by the hero’s resource', () => {
    expect(tipSteps('combat', ctx())[1]!.text).toMatch(/mana/);
    const rage = tipSteps('combat', ctx({ resource: { kind: 'rage', name: 'Rage' } as TipContext['resource'] }));
    expect(rage[1]!.text).toMatch(/strike first/);
  });

  it('walks from the bag to the Wardrobe on the first item', () => {
    const steps = tipSteps('bag', ctx());
    expect(steps.map((s) => s.panel)).toEqual([null, 'hero', 'wardrobe']);
    expect(steps[0]!.target).toContain('Hero & bag');
    expect(steps[1]!.target).toBe('.rb-bag-grid .rb-bslot');
    expect(steps[2]!.target).toContain('wardrobe');
  });

  it('shows where a new spell is, on the bar or waiting under Skills', () => {
    const id = CLASSES.mage.skills[1]!;
    const onBar = tipSteps('spell', ctx({ spell: id, bar: { s1: CLASSES.mage.skills[0], s2: id, s3: null, s4: null } }));
    expect(onBar[0]!.target).toBe('.rb-slot6.is-s2');
    expect(onBar[0]!.text).toMatch(/on your bar/);
    const waiting = tipSteps('spell', ctx({ spell: id, bar: { s1: CLASSES.mage.skills[0], s2: null, s3: null, s4: null } }));
    expect(waiting[0]!.target).toBeNull();
    expect(waiting[0]!.text).toMatch(/waits/);
    expect(onBar.map((s) => s.panel)).toEqual([null, 'skills', 'skills']);
  });

  it('opens the talents at level 10, on the choice or on the trees', () => {
    expect(tipSteps('talents', ctx())[1]!.target).toBe('.rb-spec-cards');
    expect(tipSteps('talents', ctx({ specChosen: true }))[1]!.target).toBe('.rb-tree-tabs');
    expect(tipSteps('talents', ctx()).map((s) => s.panel)).toEqual([null, 'talents', 'talents']);
  });

  it('teaches riding after the first mount: the key or the horseshoe, the Wardrobe, one pace, on foot to fight', () => {
    const mouse = tipSteps('riding', ctx());
    expect(mouse.map((s) => s.target)).toEqual(['.rb-slot6.is-mount', '.rb-seg [data-look-tab="mounts"]', '.rb-slot6.is-basic']);
    expect(mouse.map((s) => s.panel)).toEqual([null, 'wardrobe', null]);
    expect(mouse[0]!.text).toMatch(/Press Y/);
    expect(mouse[1]!.text).toMatch(/Wardrobe › Mounts/);
    expect(mouse[1]!.text).toMatch(/same pace/);
    expect(mouse[2]!.title).toMatch(/fight/);
    const touch = tipSteps('riding', ctx({ touch: true }));
    expect(touch.map((s) => s.target)).toEqual(['.rb-sb-mount', '.rb-seg [data-look-tab="mounts"]', '.rb-sb-basic']);
    expect(touch[0]!.text).toMatch(/Tap the horseshoe/);
    expect(touch.map((s) => s.text).join(' ')).not.toMatch(/Press |click/);
  });

  it('every hint has real words, and American spelling', () => {
    for (const id of ['combat', 'bag', 'spell', 'talents', 'riding'] as TipId[]) {
      for (const s of tipSteps(id, ctx({ spell: CLASSES.mage.skills[1] }))) {
        expect(s.title.length).toBeGreaterThan(3);
        expect(s.text.length).toBeGreaterThan(20);
        expect(`${s.title} ${s.text}`).not.toMatch(/armour|colour|favourite|grey|specialis/i);
      }
    }
  });
});

describe('sigilfall hints: the card stays on the screen', () => {
  const stage = { width: 844, height: 390 };
  const card = { width: 340, height: 170 };
  const inside = (p: { left: number; top: number }, s = stage, c = card) => {
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.left + c.width).toBeLessThanOrEqual(s.width);
    expect(p.top + c.height).toBeLessThanOrEqual(s.height);
  };
  const clear = (p: { left: number; top: number }, h: { left: number; top: number; width: number; height: number }) =>
    p.left + card.width <= h.left || p.left >= h.left + h.width || p.top + card.height <= h.top || p.top >= h.top + h.height;

  it('sits beside what it points at, without covering it', () => {
    for (const hole of [
      { left: 700, top: 300, width: 60, height: 60 }, // a skill button, bottom right
      { left: 20, top: 10, width: 44, height: 44 }, // a menu button, top left
      { left: 300, top: 150, width: 100, height: 100 }, // the middle
      { left: 780, top: 10, width: 50, height: 50 }, // top right
    ]) {
      const p = placeTipCard(hole, stage, card);
      inside(p);
      expect(clear(p, hole)).toBe(true);
    }
  });

  it('stays in when what it points at fills the stage, and centers with nothing to point at', () => {
    inside(placeTipCard({ left: 0, top: 0, width: 844, height: 390 }, stage, card));
    expect(placeTipCard(null, stage, card)).toEqual({ left: (844 - 340) / 2, top: (390 - 170) / 2 });
    const phone = { width: 360, height: 640 };
    const wide = { width: 340, height: 220 };
    inside(placeTipCard({ left: 280, top: 560, width: 70, height: 70 }, phone, wide), phone, wide);
  });
});

describe('sigilfall hints: they only pause the game', () => {
  /** An engine with just what the hints touch. */
  function engine(tutorial = true) {
    const h = hero();
    giveTips(h);
    const e = Object.create(SigilEngine.prototype) as SigilEngine & Record<string, unknown>;
    const ui = {
      screen: 'game', createSlot: 0, panel: null, shop: null, pause: false, dialogue: null, travel: null, toasts: [], banner: null, death: false, reward: null, boss: null,
      levelUp: null, teach: null, tip: null, notice: '', card: null,
    } as unknown as UiState;
    Object.assign(e, {
      ui,
      hero: h,
      world: { scene: null, keyRun: null, events: [], build: { bar: { s1: CLASSES.mage.skills[0] }, resource: null } },
      save: { settings: { ...DEFAULT_SETTINGS, tutorial }, heroes: [h] },
      sound: { play: vi.fn(), setVolumes: vi.fn(), suspend: vi.fn() },
      renderer: { waiting: false, reducedMotion: false, setZoom: () => {} },
      touch: { release: vi.fn() },
      coop: null,
      hidden: false,
      tipQueue: [],
      tipOpenedAt: 0,
      saveAt: 0,
      version: 0,
      listeners: new Set(),
    });
    return e as unknown as Pick<SigilEngine, 'ui' | 'hero' | 'settings' | 'isPaused' | 'tipNext' | 'skipTips' | 'setTutorial' | 'asksForTips'> & {
      queueTip(id: TipId, s?: string): boolean;
      showTip(w: unknown): void;
      uiKey(k: string): void;
      tipQueue: unknown[];
      world: unknown;
      save: { heroes: unknown[] };
    };
  }

  it('waits for the hero to be free, pauses for the hint, and carries on afterward', () => {
    const e = engine();
    expect(e.queueTip('bag')).toBe(true);
    // not over a scene or someone talking
    (e.world as { scene: unknown }).scene = {};
    e.showTip(e.world);
    expect(e.ui.tip).toBeNull();
    (e.world as { scene: unknown }).scene = null;
    expect(e.isPaused()).toBe(false);
    e.showTip(e.world);
    expect(e.ui.tip?.id).toBe('bag');
    expect(e.isPaused()).toBe(true);
    // each step opens what it talks about
    e.tipNext();
    expect(e.ui.panel).toBe('hero');
    e.tipNext();
    expect(e.ui.panel).toBe('wardrobe');
    e.tipNext();
    expect(e.ui.tip).toBeNull();
    expect(e.ui.panel).toBeNull();
    expect(e.isPaused()).toBe(false);
    // once
    expect(e.queueTip('bag')).toBe(false);
  });

  it('teaches riding once, right after Riders for Briarhollow, and only with the hints on', () => {
    type Events = { handleEvents(w: unknown): void; hero: { quests: Record<string, unknown>; mounts: string[]; opened: string[] } };
    const done = (e: ReturnType<typeof engine>, quest: string): void => {
      const w = e.world as { events: unknown[] };
      e.hero!.quests[quest] = { state: 'done', n: 1 };
      w.events = [{ t: 'questDone', quest }];
      (e as unknown as Events).handleEvents(w);
    };
    const e = engine();
    // another quest's end teaches nothing
    done(e, 'ashby-farm');
    expect(e.tipQueue).toEqual([]);
    done(e, 'camp-riders');
    // the first mount came with it, and the hint waits for the hero to be free
    expect(e.hero!.mounts).toContain('briarhollow-chestnut');
    expect(e.tipQueue).toEqual([{ id: 'riding', spell: undefined }]);
    e.showTip(e.world);
    expect(e.ui.tip?.id).toBe('riding');
    e.tipNext();
    expect(e.ui.panel).toBe('wardrobe');
    e.tipNext();
    expect(e.ui.panel).toBeNull();
    e.tipNext();
    expect(e.ui.tip).toBeNull();
    // once
    expect(e.hero!.opened).toContain(tipKey('riding'));
    done(e, 'camp-riders');
    expect(e.tipQueue).toEqual([]);
    // with the hints off, never
    const off = engine(false);
    done(off, 'camp-riders');
    expect(off.tipQueue).toEqual([]);
    expect(off.hero!.mounts).toContain('briarhollow-chestnut');
  });

  it('never stops a party or a Riftstone run', () => {
    const e = engine();
    e.queueTip('bag');
    (e as unknown as { coop: unknown }).coop = {};
    e.showTip(e.world);
    expect(e.ui.tip).toBeNull();
    (e as unknown as { coop: unknown }).coop = null;
    (e.world as { keyRun: unknown }).keyRun = {};
    e.showTip(e.world);
    expect(e.ui.tip).toBeNull();
  });

  it('turns off for good from the hint, and asks a new hero', () => {
    const e = engine();
    e.queueTip('combat');
    e.queueTip('bag');
    e.showTip(e.world);
    e.skipTips();
    expect(e.ui.tip).toBeNull();
    expect(e.settings.tutorial).toBe(false);
    expect(e.tipQueue).toHaveLength(0);
    expect(e.queueTip('spell')).toBe(false);
    expect(e.asksForTips).toBe(true);
  });

  it('asks a new hero only after the first one or with the hints off', () => {
    const e = engine();
    e.save.heroes = [];
    expect(e.asksForTips).toBe(false);
    e.save.heroes = [hero()];
    expect(e.asksForTips).toBe(true);
    const off = engine(false);
    off.save.heroes = [];
    expect(off.asksForTips).toBe(true);
  });

  it('turning them on in Settings gives them to every hero', () => {
    const e = engine(false);
    const other = hero();
    e.hero!.opened = [];
    e.save.heroes = [e.hero, null, other];
    e.setTutorial(true);
    expect(e.settings.tutorial).toBe(true);
    expect(takesTips(e.hero!)).toBe(true);
    expect(takesTips(other)).toBe(true);
    e.setTutorial(false);
    expect(e.settings.tutorial).toBe(false);
  });

  it('Esc puts a hint away, and the menu keys wait for it', () => {
    const e = engine();
    e.queueTip('bag');
    e.showTip(e.world);
    e.uiKey('talents');
    expect(e.ui.panel).toBeNull();
    expect(e.ui.tip?.id).toBe('bag');
    e.uiKey('pause');
    expect(e.ui.tip).toBeNull();
    expect(e.ui.pause).toBe(false);
  });
});
