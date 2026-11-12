/**
 * The menus, from a round of play on a phone and a desk:
 *  - a talent opens in a card with what it does and the button that learns it (it was at the foot of the panel, a
 *    scroll away from the tree);
 *  - an item is one card with what wearing it gains and loses (the worn piece's card beside it squeezed the bag);
 *  - a panel shut leaves no button holding the keys (Space, the dodge, opened it again).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/games/sigilfall/render/sprites', async (original) => ({
  ...(await original<typeof import('../src/games/sigilfall/render/sprites')>()),
  skillIconUrl: () => '',
  talentIconUrl: () => '',
  itemIconUrl: () => '',
  heroDollUrl: () => '',
}));
vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));
import { TALENTS } from '../src/games/sigilfall/data/talents';
import type { SigilEngine } from '../src/games/sigilfall/engine';
import { cantLearn } from '../src/games/sigilfall/progress/character';
import { itemName, itemSlot } from '../src/games/sigilfall/progress/items';
import { Frame } from '../src/games/sigilfall/ui/common';
import { ItemDetail, TalentCard } from '../src/games/sigilfall/ui/Panels';
import { readyHero } from './sigilfall-bot';

afterEach(cleanup);

describe('a talent, opened', () => {
  it('says what it does and learns it from the card, which stays up for the next rank', () => {
    const hero = readyHero('mage', 20);
    hero.talents = {};
    const node = TALENTS.mage.find((n) => !cantLearn(hero, n.id))!;
    const learn = vi.fn();
    const close = vi.fn();
    render(<TalentCard engine={{ hero, learn } as unknown as SigilEngine} node={node} onClose={close} />);
    const card = screen.getByRole('dialog', { name: node.name });
    expect(card.textContent).toContain(node.text);
    expect(card.textContent).toContain(`Rank 0/${node.ranks}`);
    fireEvent.click(within(card).getByRole('button', { name: `Learn ${node.name}` }));
    expect(learn).toHaveBeenCalledWith(node.id);
    expect(close).not.toHaveBeenCalled();
    // its cross, and Escape, put it away
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('one that can’t be learned yet says why, and has no button', () => {
    const hero = readyHero('mage', 20);
    hero.talents = {};
    const node = TALENTS.mage.find((n) => cantLearn(hero, n.id))!;
    render(<TalentCard engine={{ hero, learn: vi.fn() } as unknown as SigilEngine} node={node} onClose={() => undefined} />);
    const card = screen.getByRole('dialog', { name: node.name });
    expect(card.textContent).toContain(cantLearn(hero, node.id)!);
    expect(within(card).queryByRole('button', { name: /^Learn/ })).toBeNull();
  });
});

describe('an item, looked at', () => {
  it('is one card: the worn piece is named, not shown beside it', () => {
    const hero = readyHero('warrior', 20);
    const worn = Object.values(hero.equip).find((i) => !!i)!;
    const other = { ...worn, uid: `${worn.uid}-b`, il: worn.il + 6 };
    hero.bag = [other];
    const view = render(<ItemDetail engine={{ hero } as unknown as SigilEngine} item={other} worn={false} confirm={false} onSalvage={() => undefined} onDone={() => undefined} />);
    expect(itemSlot(other)).toBe(itemSlot(worn));
    expect(view.container.querySelectorAll('.rb-icard').length).toBe(1);
    expect(view.container.querySelector('.rb-compare.is-two')).toBeNull();
    expect(view.container.textContent).toContain(`Instead of ${itemName(worn)}`);
    // (and the change is still said: a better piece of the same kind shows what it adds)
    expect(view.container.querySelector('.rb-up-t')).toBeTruthy();
  });
});

describe('a panel, shut', () => {
  it('leaves the keys with the game, not with the button that opened it', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);
    const view = render(
      <Frame title="Bag" onClose={() => undefined}>
        <button>Inside</button>
      </Frame>,
    );
    expect(document.activeElement).not.toBe(opener);
    view.unmount();
    expect(document.activeElement).toBe(document.body);
    opener.remove();
  });

  it('a panel opened from another panel gives the keys back to it', () => {
    const outer = render(
      <Frame title="Hero" onClose={() => undefined}>
        <button>Open the next</button>
      </Frame>,
    );
    const from = screen.getByRole('button', { name: 'Open the next' });
    from.focus();
    const inner = render(
      <Frame title="Details" onClose={() => undefined}>
        <button>Inside</button>
      </Frame>,
    );
    inner.unmount();
    expect(document.activeElement).toBe(from);
    outer.unmount();
  });
});
