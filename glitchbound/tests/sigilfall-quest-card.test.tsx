/**
 * A quest finished, on one card (POLISH_PLAN.md piece 10): the engine gathers the quest's pay, the items it gave and the
 * quest it opened from the same moment, instead of three pieces of news one over another.
 */
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/games/sigilfall/render/sprites', async (original) => ({
  ...(await original<typeof import('../src/games/sigilfall/render/sprites')>()),
  skillIconUrl: () => '',
  talentIconUrl: () => '',
  itemIconUrl: () => '',
  // (an item's picture is its model's, or its painted icon, once items are pictured from their models: neither can
  // be made without a page)
  itemPicture: () => ({ url: '', smooth: false }),
  heroDollUrl: () => '',
}));
vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));
import { rng } from '../src/games/sigilfall/core/math';
import type { SigilEngine, UiState } from '../src/games/sigilfall/engine';
import { itemName, rollGear } from '../src/games/sigilfall/progress/items';
import { QuestCard } from '../src/games/sigilfall/ui/GameScreen';

afterEach(cleanup);

function card(over: Partial<NonNullable<UiState['questCard']>> = {}): NonNullable<UiState['questCard']> {
  return {
    quest: 'q',
    name: 'The Bells of Briarhollow',
    lines: [
      { kind: 'xp', text: '120 XP' },
      { kind: 'gold', text: '35 gold' },
    ],
    items: [],
    next: null,
    id: 1,
    ...over,
  };
}

describe('Sigilfall: a finished quest is one card', () => {
  it('says the quest, what it paid, the items it gave and the quest it opened', () => {
    const sword = rollGear('warrior', 6, 'rare', rng(3), 'weapon');
    const openPanel = vi.fn();
    const engine = { ui: { questCard: card({ items: [sword], next: 'Into the Crypt' }) }, openPanel } as unknown as SigilEngine;
    render(<QuestCard engine={engine} />);
    const el = screen.getByRole('button');
    expect(el.textContent).toContain('Quest complete');
    expect(el.textContent).toContain('The Bells of Briarhollow');
    expect(el.textContent).toContain('120 XP');
    expect(el.textContent).toContain('35 gold');
    expect(el.textContent).toContain(itemName(sword));
    expect(el.textContent).toContain('Next: Into the Crypt');
    // a tap on a card with items opens the hero's bag, where they are
    fireEvent.click(el);
    expect(openPanel).toHaveBeenCalledWith('hero');
  });

  it('a card with nothing to open is no button, and leaves out what it has not got', () => {
    const openPanel = vi.fn();
    const engine = { ui: { questCard: card({ lines: [] }) }, openPanel } as unknown as SigilEngine;
    const { container } = render(<QuestCard engine={engine} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toBe('Quest completeThe Bells of Briarhollow');
    fireEvent.click(container.firstElementChild!);
    expect(openPanel).not.toHaveBeenCalled();
  });

  // (the engine can't be made in a test without a page: what it does at that moment is held by its text)
  const engineSrc = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
  const screenSrc = readFileSync('src/games/sigilfall/ui/GameScreen.tsx', 'utf8');
  it('the engine takes the reward items and the next quest into the card, not into news', () => {
    expect(engineSrc).toContain('if (card) card.items.push(ev.item);');
    expect(engineSrc).toContain("card = { quest: q.id, name: q.name, lines: questRewards(this.hero, q).filter((l) => l.kind !== 'item'), items: [], next: null, id: performance.now() };");
    expect(engineSrc).toContain('if (newQuests.length) card.next =');
    // (and a second quest finishing in the same moment is still told)
    expect(engineSrc).toContain('if (card) this.toast(`Quest complete: ${q.name}`');
  });

  it('the card stands with the announcements, placed clear of the HUD, and goes after a few seconds', () => {
    expect(screenSrc).toContain('{ui.questCard && <QuestCard engine={engine} />}');
    expect(engineSrc).toMatch(/questCard && t - this\.ui\.questCard\.id > QUEST_CARD_MS/);
  });

  it('stays at the top, the quest stepping aside under it, rather than sliding down off the quest toward the hero', () => {
    // (it slid down off the quest and came over the hero for five seconds: the card says the quest done and the next,
    // and the quest steps aside under any announcement, ui/GameScreen.tsx Tracker)
    expect(screenSrc).toContain("child.classList.contains('rb-qcard') ? CARD_KEEPS_CLEAR : TOP_PIECES");
    expect(screenSrc).toContain("const CARD_KEEPS_CLEAR = TOP_PIECES.filter((p) => p !== 'quest');");
    expect(screenSrc).toContain("el.classList.toggle('is-under-announce', !!r && !!at && r.floatBoxes.some((b) => boxesMeet(b, at, 2)));");
  });
});
