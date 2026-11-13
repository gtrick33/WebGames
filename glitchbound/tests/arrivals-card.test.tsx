/** The site's card for something received (components/Arrivals.tsx): once, by itself, and Sigilfall's left to the game. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../src/platform/apiTypes';
import type { Arrival } from '../src/platform/arrivals';

afterEach(async () => {
  const { stopArrivals } = await import('../src/platform/arrivals');
  stopArrivals();
  document.documentElement.classList.remove('game-focus');
});

const me = { id: 'u1', nickname: 'Cal', email: 'cal@example.com', avatar: '', owned: [], favorites: [], bests: {}, quests: [], badges: [], dailyDays: [] } as unknown as Me;
const item = (id: string, patch: Partial<Arrival> = {}): Arrival => ({ key: `item:${id}`, kind: 'item', id, how: 'bought', game: null, at: 1, ...patch });

async function setUp() {
  const { account } = await import('../src/platform/account');
  account.reset({ status: 'member', me });
  const arrivals = await import('../src/platform/arrivals');
  const { Arrivals } = await import('../src/components/Arrivals');
  return { ...arrivals, Arrivals };
}

describe('the site’s card', () => {
  it('says a purchase, thanks the buyer, never takes the focus, and goes by itself', async () => {
    vi.useFakeTimers();
    const a = await setUp();
    a.addArrival(item('border-frost'));
    const before = document.activeElement;
    render(<a.Arrivals />);
    const card = screen.getByRole('status');
    expect(card.textContent).toContain('It’s yours!');
    expect(card.textContent).toContain('Frost border');
    expect(card.textContent).toContain('Thanks for supporting GlitchBound.');
    expect(screen.getByRole('link', { name: 'Wear it from your profile.' }).getAttribute('href')).toBe('/me#looks');
    expect(document.activeElement).toBe(before);
    // shown: not again, even after a reload of the memory
    expect(a.pendingArrivals()).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the next one once the first is closed, and a gift as a gift', async () => {
    const a = await setUp();
    a.addArrival(item('ad-free'));
    a.addArrival(item('icon-owl', { how: 'given' }));
    render(<a.Arrivals />);
    expect(screen.getByRole('status').textContent).toContain('Ad-free');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    const card = screen.getByRole('status');
    expect(card.textContent).toContain('A gift for you!');
    expect(card.textContent).toContain('A gift from the GlitchBound team.');
  });

  it('leaves Sigilfall’s things to the game while it is open, and waits while a game fills the screen', async () => {
    const a = await setUp();
    const release = a.claimArrivals('sigilfall');
    a.addArrival(item('sigilfall-galecrest-drake', { game: 'sigilfall' }));
    document.documentElement.classList.add('game-focus');
    render(<a.Arrivals />);
    act(() => a.addArrival(item('icon-fox')));
    expect(screen.queryByRole('status')).toBeNull();
    // the game closes, the screen is the page's again: the site says both, one after the other
    act(() => release());
    await act(async () => {
      document.documentElement.classList.remove('game-focus');
      await Promise.resolve();
    });
    expect(screen.getByRole('status').textContent).toContain('Galecrest Drake');
    expect(screen.getByRole('status').textContent).toContain('In every hero’s stable in Sigilfall.');
  });

  it('holds Sigilfall’s things on Sigilfall’s own page (the game is loading there)', async () => {
    const a = await setUp();
    window.history.replaceState(null, '', '/sigilfall?play=1');
    a.addArrival(item('sigilfall-galecrest-drake', { game: 'sigilfall' }));
    render(<a.Arrivals />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('draws a title in its light', async () => {
    const a = await setUp();
    a.addArrival({ key: 'title:t1', kind: 'title', id: 't1', how: 'given', game: 'sigilfall', name: 'the Unbroken', fx: 'ember', at: 1 });
    render(<a.Arrivals />);
    expect(screen.getByRole('status').textContent).toContain('You’ve been given a title');
    expect(screen.getByText('the Unbroken').className).toContain('tfx-ember');
  });
});

describe('Sigilfall’s card', () => {
  async function game() {
    const a = await setUp();
    const { ArrivalCard } = await import('../src/games/sigilfall/ui/Arrival');
    const engine = { sound: { play: vi.fn() }, checkGm: vi.fn(async () => undefined) };
    const view = render(
      <div className="rb">
        <ArrivalCard engine={engine as never} />
      </div>,
    );
    return { ...a, engine, view };
  }

  it('claims Sigilfall’s things while the game is open, and says them in the game’s words', async () => {
    const g = await game();
    expect(g.arrivalsClaimed('sigilfall')).toBe(true);
    act(() => g.addArrival(item('sigilfall-crownforged-plate', { game: 'sigilfall', how: 'given' })));
    const card = screen.getByRole('status');
    expect(card.textContent).toContain('Crownforged Plate');
    expect(card.textContent).toContain('A gift from the GlitchBound team.');
    expect(card.textContent).toContain('In every hero’s Wardrobe.');
    expect(g.engine.sound.play).toHaveBeenCalledWith('epic');
    // something from the account: a Game Master's orders are looked for at once
    expect(g.engine.checkGm).toHaveBeenCalled();
    g.view.unmount();
    expect(g.arrivalsClaimed('sigilfall')).toBe(false);
  });

  it('waits out a fight in the Ring, and comes when it ends', async () => {
    vi.useFakeTimers();
    const g = await game();
    const ring = document.createElement('div');
    ring.className = 'rb-ring-stage';
    g.view.container.querySelector('.rb')!.appendChild(ring);
    act(() => g.addArrival({ key: 'gm:o1', kind: 'gm', id: 'm', how: 'given', game: 'sigilfall', name: 'Old Grey', what: 'mount', hero: 'Ash', at: 1 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.queryByRole('status')).toBeNull();
    ring.remove();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole('status').textContent).toContain('In Ash’s stable.');
    // (a Game Master's own gift doesn't send the game looking for more)
    expect(g.engine.checkGm).not.toHaveBeenCalled();
  });
});
