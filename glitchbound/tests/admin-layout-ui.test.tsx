import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BestGamesEditor } from '../src/pages/AdminBest';
import { MultiplayerEditor } from '../src/pages/AdminMultiplayer';
import { LayoutEditor } from '../src/pages/AdminLayout';
import type { AdminCatalog } from '../src/platform/apiTypes';

const data = (settings: AdminCatalog['settings'] = {}, flagships?: string[]): AdminCatalog => ({ settings, picks: {}, notice: null, layout: null, log: [], ...(flagships ? { flagships } : {}) });
const cards = () => within(screen.getByRole('list', { name: 'Our best games, in order' })).getAllByRole('listitem');
const titles = () => cards().map((li) => li.querySelector('.ab-title')!.textContent);

describe('Our best games editor', () => {
  it('starts from the house picks and publishes a reordered, swapped row', () => {
    const send = vi.fn(async () => true);
    render(<BestGamesEditor data={data()} send={send} busy={false} />);
    expect(titles()).toEqual(['Quizbelief', 'Launch Control', 'Color Recall', 'Letter Pinch']);
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveProperty('disabled', true);
    // Move Color Recall to the front with the arrows.
    fireEvent.click(screen.getByRole('button', { name: 'Move Color Recall earlier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Color Recall earlier' }));
    expect(titles()).toEqual(['Color Recall', 'Quizbelief', 'Launch Control', 'Letter Pinch']);
    // Swap the last card for Neon Rush.
    fireEvent.change(within(cards()[3]!).getByRole('combobox'), { target: { value: 'neon-rush' } });
    expect(titles()).toEqual(['Color Recall', 'Quizbelief', 'Launch Control', 'Neon Rush']);
    // Picking a game already on another card swaps the two.
    fireEvent.change(within(cards()[0]!).getByRole('combobox'), { target: { value: 'neon-rush' } });
    expect(titles()).toEqual(['Neon Rush', 'Quizbelief', 'Launch Control', 'Color Recall']);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(send).toHaveBeenCalledWith({ action: 'flagships', list: ['neon-rush', 'wait-what', 'launch-control', 'color-recall'] }, 'Our best games published');
  });

  it('reorders by dragging one card onto another', () => {
    render(<BestGamesEditor data={data({}, ['gloop', 'whatsit', 'fussbox', 'neon-rush'])} send={vi.fn(async () => true)} busy={false} />);
    const [first, , , last] = cards();
    const dataTransfer = { setData: () => undefined, effectAllowed: '' };
    fireEvent.dragStart(first!, { dataTransfer });
    fireEvent.dragOver(last!, { dataTransfer });
    fireEvent.drop(last!, { dataTransfer });
    expect(titles()).toEqual(['Neon Rush', 'Whatsit', 'Fussbox', 'Gloop']);
  });

  it('offers going back to the house picks once a list is saved', () => {
    const send = vi.fn(async () => true);
    render(<BestGamesEditor data={data({}, ['gloop'])} send={send} busy={false} />);
    expect(titles()).toEqual(['Gloop', 'Quizbelief', 'Launch Control', 'Color Recall']);
    fireEvent.click(screen.getByRole('button', { name: 'Back to house picks' }));
    expect(send).toHaveBeenCalledWith({ action: 'flagships', list: null }, 'Our best games: back to the house picks');
  });
});

describe('Live multiplayer games editor', () => {
  const list = () => within(screen.getByRole('list', { name: 'Live multiplayer games, in order' }));
  const mtitles = () => [...document.querySelectorAll('.am-row .ab-title')].map((b) => b.textContent);

  it('starts from every live game; add, remove and reorder, then publish', () => {
    const send = vi.fn(async () => true);
    render(<MultiplayerEditor data={data()} send={send} busy={false} />);
    expect(mtitles()).toEqual(['Launch Control', 'Belot', 'Backgammon']);
    expect(screen.getByText('Every live game')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Belot' }));
    fireEvent.change(list().getByRole('combobox', { name: 'Add a game' }), { target: { value: 'gloop' } });
    expect(screen.getByText('not live')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move Backgammon earlier' }));
    expect(mtitles()).toEqual(['Backgammon', 'Launch Control', 'Gloop']);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(send).toHaveBeenCalledWith({ action: 'multiplayer', list: ['backgammon', 'launch-control', 'gloop'] }, 'Live multiplayer games published');
  });

  it('removing every game and publishing hides the row; a saved list can go back to every live game', () => {
    const send = vi.fn(async () => true);
    render(<MultiplayerEditor data={{ ...data(), multiplayer: ['belot'] }} send={send} busy={false} />);
    expect(mtitles()).toEqual(['Belot']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Belot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(send).toHaveBeenCalledWith({ action: 'multiplayer', list: [] }, 'Live multiplayer games hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Back to every live game' }));
    expect(send).toHaveBeenLastCalledWith({ action: 'multiplayer', list: null }, 'Live multiplayer games: back to every live game');
  });
});

describe('home page banners editor', () => {
  it('shows hidden games dimmed, and a banner’s switches save right away', () => {
    const send = vi.fn(async () => true);
    render(<LayoutEditor data={data({ 'neon-rush': { hidden: true } })} send={send} busy={false} />);
    const grid = screen.getByRole('listbox', { name: 'Arcade banners in order' });
    const tile = within(grid).getByRole('option', { name: /Neon Rush/ });
    expect(tile.className).toContain('is-hidden');
    expect(within(tile).getByText('Hidden')).toBeTruthy();
    fireEvent.click(tile);
    expect(screen.getByRole('switch', { name: 'Visible' }).getAttribute('aria-checked')).toBe('false');
    // A hidden game cannot be a best game until it is visible again.
    expect(screen.getByRole('switch', { name: 'Best game' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('switch', { name: 'Visible' }));
    expect(send).toHaveBeenCalledWith({ action: 'game', slug: 'neon-rush', patch: { hidden: false } }, 'Neon Rush is visible');
    fireEvent.click(screen.getByRole('switch', { name: 'Spotlight' }));
    expect(send).toHaveBeenCalledWith({ action: 'game', slug: 'neon-rush', patch: { spotlight: true } }, undefined);
  });

  it('the Best game switch edits the same list: on takes the last card, off lets a house pick fill in', () => {
    const send = vi.fn(async () => true);
    const { unmount } = render(<LayoutEditor data={data()} send={send} busy={false} />);
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Arcade banners in order' })).getByRole('option', { name: /Gloop/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Best game' }));
    expect(send).toHaveBeenCalledWith({ action: 'flagships', list: ['wait-what', 'launch-control', 'color-recall', 'gloop'] }, 'Gloop replaces Letter Pinch in Our best games');
    unmount();
    render(<LayoutEditor data={data({}, ['gloop', 'whatsit', 'fussbox', 'neon-rush'])} send={send} busy={false} />);
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Arcade banners in order' })).getByRole('option', { name: /Whatsit/ }));
    expect(screen.getByRole('switch', { name: 'Best game' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('switch', { name: 'Best game' }));
    expect(send).toHaveBeenLastCalledWith({ action: 'flagships', list: ['gloop', 'fussbox', 'neon-rush', 'wait-what'] }, 'Whatsit is out of Our best games, Quizbelief fills in');
  });
});
