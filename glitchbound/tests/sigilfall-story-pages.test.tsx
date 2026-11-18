import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTS } from '../src/games/sigilfall/data/acts';
import { SIGIL_LORE, SIGIL_ORDER, TALES } from '../src/games/sigilfall/data/chronicle';
import { QUEST_DEFS, QUESTS } from '../src/games/sigilfall/data/quests';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { SigilEngine, type StoryPage, type UiState } from '../src/games/sigilfall/engine';
import { newCharacter, SIGILS, type Character } from '../src/games/sigilfall/progress/character';
import { isMainQuest, questSteps } from '../src/games/sigilfall/progress/handin';
import { maybeStartScene } from '../src/games/sigilfall/sim/scene';
import { FindView, SigilRite } from '../src/games/sigilfall/ui/StoryPages';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The story's pages (engine.ts StoryPage, ui/StoryPages.tsx). The owner, 2026-11-18: the dialogue and the quests were
 * confusing, "itd be nice if quests with exploration had a specific item that you find, that you get a pop up ... if
 * its a letter, the actual letter", and "gaining a sigil currently is unknown to me ... make it more dramatic and huge".
 * A quest's ending (its reward's words) was never shown when it paid out by itself; now it is a page. A thing found is
 * a page with its words; a sigil won is the Sigil Rite; an act begins with the narrator's telling.
 */

vi.mock('../src/games/sigilfall/render/sprites', () => ({ skillIconUrl: () => '' }));
vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));
afterEach(cleanup);

/** The engine as these tests reach into it (its page queue and its event handling are private). */
type Stub = Pick<SigilEngine, 'ui' | 'hero' | 'world' | 'isPaused' | 'closeStory'> & { pages: StoryPage[]; handleEvents(w: unknown): void; turnPage(w: unknown, dt: number): void };

/** An engine with just what the story's pages touch. */
function engine(h: Character): Stub {
  const e = Object.create(SigilEngine.prototype) as Record<string, unknown>;
  const ui = {
    screen: 'game', createSlot: 0, panel: null, shop: null, pause: false, dialogue: null, travel: null, toasts: [], banner: null, death: false, reward: null, boss: null,
    levelUp: null, teach: null, tip: null, notice: '', card: null, story: null,
  } as unknown as UiState;
  Object.assign(e, {
    ui,
    hero: h,
    world: { scene: null, keyRun: null, events: [], enemies: [], player: { x: 0, y: 0, dead: false }, story: { talking: false, fighting: false }, region: { id: 'briarhollow' } },
    save: { settings: { ...DEFAULT_SETTINGS }, heroes: [h] },
    sound: { play: vi.fn(), setVolumes: vi.fn(), suspend: vi.fn() },
    renderer: { waiting: false },
    touch: { release: vi.fn() },
    coop: null,
    hidden: false,
    tipQueue: [],
    pages: [],
    pageCalm: 0,
    pageWait: 0,
    cards: [],
    saveAt: 0,
    version: 0,
    listeners: new Set(),
  });
  return e as unknown as Stub;
}

const fire = (e: Stub, ...events: unknown[]): void => {
  const w = e.world as unknown as { events: unknown[] };
  w.events = events;
  e.handleEvents(w);
};

describe('Sigilfall: a quest’s ending is seen', () => {
  it('a quest paid out in the world tells what it came to on a page; one paid in a talk tells it there', () => {
    const q = QUESTS.find((x) => x.auto && x.reward.text && !x.quiet && !x.find)!;
    const e = engine(readyHero('mage', 30));
    e.hero!.quests[q.id] = { state: 'done', n: 1 };
    fire(e, { t: 'questDone', quest: q.id });
    expect(e.pages).toEqual([{ kind: 'deed', quest: q.id }]);
    const talk = engine(readyHero('mage', 30));
    talk.ui.dialogue = { npc: 'maren', lines: [], i: 0, pages: [] };
    fire(talk, { t: 'questDone', quest: q.id });
    expect(talk.pages).toEqual([]);
  });

  it('a page waits for the world to be calm, holds the scenes back, and the world waits while it is read', () => {
    const q = QUESTS.find((x) => x.auto && x.reward.text && !x.quiet && !x.find)!;
    const e = engine(readyHero('mage', 30));
    fire(e, { t: 'questDone', quest: q.id });
    const w = e.world as unknown as { scene: unknown; story: { talking: boolean } };
    // (not while someone is still saying their last words)
    w.story.talking = true;
    e.turnPage(w, 1);
    expect(e.ui.story).toBeNull();
    w.story.talking = false;
    e.turnPage(w, 0.2);
    expect(e.ui.story).toBeNull();
    e.turnPage(w, 1);
    expect(e.ui.story).toEqual({ kind: 'deed', quest: q.id });
    expect(e.isPaused()).toBe(true);
    e.closeStory();
    expect(e.ui.story).toBeNull();
    expect(e.isPaused()).toBe(false);
    // and a world with pages waiting starts no scene
    const real = newWorld('briarhollow', readyHero('mage', 5));
    real.holdScenes = true;
    maybeStartScene(real);
    expect(real.scene).toBeNull();
  });
});

describe('Sigilfall: a thing found is shown, and kept', () => {
  const found = QUESTS.filter((q) => q.find);

  it('it comes up when the quest’s work is done, or at the step that finds it, once', () => {
    const q = found.find((x) => x.find!.step === undefined)!;
    const e = engine(readyHero('mage', 30));
    e.hero!.quests[q.id] = { state: 'done', n: 1 };
    fire(e, { t: 'questDone', quest: q.id });
    expect(e.pages[0]).toEqual({ kind: 'find', quest: q.id });
    e.turnPage(e.world, 1);
    expect(e.ui.story).toEqual({ kind: 'find', quest: q.id });
    expect(e.hero!.opened).toContain(`kept:${q.id}`);
    e.closeStory();
    // (handed in later, it isn't found twice)
    e.pages.length = 0;
    fire(e, { t: 'questDone', quest: q.id });
    expect(e.pages.filter((p) => p.kind === 'find')).toEqual([]);
    const stepped = found.find((x) => x.find!.step !== undefined && x.find!.step < questSteps(x).length - 1);
    if (stepped) {
      const s = engine(readyHero('mage', 30));
      s.hero!.quests[stepped.id] = { state: 'active', n: 0, step: stepped.find!.step! + 1 };
      fire(s, { t: 'questStep', quest: stepped.id });
      expect(s.pages).toContainEqual({ kind: 'find', quest: stepped.id });
    }
  });

  it('every thing found says what it is, and a letter has its words', () => {
    expect(found.length).toBeGreaterThan(30);
    for (const q of found) {
      const f = q.find!;
      expect(f.name.trim().length, q.id).toBeGreaterThan(2);
      expect(f.about.trim().length, q.id).toBeGreaterThan(20);
      if (f.kind === 'letter' || f.kind === 'orders') expect(f.body?.length, `${q.id}: a ${f.kind} has its words`).toBeGreaterThan(0);
      if (f.step !== undefined) expect(f.step, q.id).toBeLessThan(questSteps(q).length);
      for (const p of f.body ?? []) expect(p.length, `${q.id}: ${p.slice(0, 40)}`).toBeLessThan(700);
    }
  });

  it('every story quest that sends the hero to look somewhere finds something there', () => {
    // (the Tear is reached as the ambush begins: what is found there, the Veil, is shown in the fight's opening shot, and
    // a page then would stop the fight as it starts)
    const shownInTheFight = new Set(['the-tear']);
    const bare = QUESTS.filter((q) => isMainQuest(q.id) && questSteps(q).some((o) => o.kind === 'explore') && !q.find && !shownInTheFight.has(q.id) && !/^(briar-|crownfall-)/.test(q.id));
    expect(bare.map((q) => q.id)).toEqual([]);
  });

  it('the page shows the letter as written, signed', () => {
    const q = found.find((x) => x.find!.kind === 'letter' && x.find!.sign)!;
    const { container } = render(<FindView find={q.find!} quest={q.name} onClose={() => {}} />);
    expect(container.textContent).toContain(q.find!.name);
    expect(container.textContent).toContain(q.find!.body![0]!);
    expect(container.textContent).toContain(q.find!.sign!);
    expect(container.textContent).toContain('Keep it');
  });
});

describe('Sigilfall: the Sigil Rite', () => {
  it('a sigil won comes up as the Rite, before the page of what the quest came to', () => {
    const q = QUESTS.find((x) => x.reward.perk === 'sigil-sun')!;
    const e = engine(readyHero('mage', 36));
    e.hero!.quests[q.id] = { state: 'done', n: 1 };
    e.hero!.perks.push('sigil-embers', 'sigil-sun');
    fire(e, { t: 'questDone', quest: q.id }, { t: 'sigil', id: 'sigil-sun' });
    const kinds = e.pages.map((p) => p.kind);
    expect(kinds).toContain('sigil');
    expect(kinds.indexOf('sigil')).toBeLessThan(kinds.indexOf('deed'));
  });

  it('the world says so when a quest’s sigil is won, once', () => {
    const w = newWorld('briarhollow', readyHero('mage', 36));
    const q = QUEST_DEFS['the-sun-king']!;
    w.events = [];
    w.completeQuests([q]);
    expect(w.events).toContainEqual({ t: 'sigil', id: 'sigil-sun' });
    // (no line of news for it: the Rite is its news)
    expect(w.events.some((ev) => ev.t === 'toast' && 'text' in ev && ev.text.includes('Sigil of the Sun'))).toBe(false);
    w.events = [];
    w.completeQuests([q]);
    expect(w.events.some((ev) => ev.t === 'sigil')).toBe(false);
  });

  it('it names the sigil, counts it of seven, lights the crown, and says what it cost Elyra', () => {
    const h = newCharacter('mage', 'Rite', 'rite', 1);
    h.perks.push('sigil-embers', 'sigil-sun', 'sigil-thorns', 'sigil-frost');
    const { container } = render(<SigilRite hero={h} sigil="sigil-frost" onClose={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).toContain('The Sigil of Frost');
    expect(text).toContain('The fourth of seven');
    expect(text).toContain(SIGIL_LORE['sigil-frost'].price!.slice(0, 20).toLowerCase());
    expect(container.querySelectorAll('.rb-rite-crown li.is-won')).toHaveLength(4);
    expect(container.querySelector('.rb-rite-crown li.is-new')).not.toBeNull();
  });

  it('every sigil has its lore, and every act that opens has its telling', () => {
    expect([...SIGIL_ORDER].sort()).toEqual([...SIGILS].sort());
    for (const id of SIGILS) expect(SIGIL_LORE[id].name).toMatch(/^The Sigil of /);
    for (const a of ACTS) expect(TALES[a.id]?.told.length, a.id).toBeGreaterThan(0);
  });
});
