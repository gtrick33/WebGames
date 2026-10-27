import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeEditor } from '../src/pages/admin/HomeSection';
import type { AdminCatalog } from '../src/platform/apiTypes';

/**
 * Admin › Home page (the owner, 2026-10-28): one draft of everything the home page shows, every game's
 * settings in its banner, and nothing saved until Publish, which sends it all in one { action: 'publish' }.
 */

const data = (settings: AdminCatalog['settings'] = {}, extra: Partial<AdminCatalog> = {}): AdminCatalog => ({ settings, picks: {}, notice: null, layout: null, log: [], ...extra });
const setup = (d = data()) => {
  const send = vi.fn(async () => true);
  render(<HomeEditor data={d} send={send} busy={false} />);
  return send;
};
const publish = () => fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
const banner = (name: RegExp) => within(screen.getByRole('listbox', { name: 'Arcade banners in order' })).getByRole('option', { name });
const best = () => [...screen.getByRole('list', { name: 'Our best games, in order' }).querySelectorAll('.ab-title')].map((b) => b.textContent);
const live = () => [...document.querySelectorAll('.am-row .ab-title')].map((b) => b.textContent);

describe('Admin › Home page', () => {
  it('starts with everything published, and Publish does nothing until something changes', () => {
    const send = setup();
    expect(screen.getByText('Everything is published')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveProperty('disabled', true);
    expect(send).not.toHaveBeenCalled();
  });

  it('reorders and swaps Our best games in the draft, then publishes them with everything else', () => {
    const send = setup();
    expect(best()).toEqual(['Quizbelief', 'Launch Control', 'Color Recall', 'Letter Pinch']);
    fireEvent.click(screen.getByRole('button', { name: 'Move Color Recall earlier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Color Recall earlier' }));
    const cards = screen.getByRole('list', { name: 'Our best games, in order' }).querySelectorAll('li');
    fireEvent.change(within(cards[3] as HTMLElement).getByRole('combobox'), { target: { value: 'neon-rush' } });
    expect(best()).toEqual(['Color Recall', 'Quizbelief', 'Launch Control', 'Neon Rush']);
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText('1 unpublished change')).toBeTruthy();
    publish();
    expect(send).toHaveBeenCalledWith({ action: 'publish', games: {}, flagships: ['color-recall', 'wait-what', 'launch-control', 'neon-rush'] }, 'Home page published (1 change)');
  });

  it('edits the live games row: remove all of them to hide it', () => {
    const send = setup(data({}, { multiplayer: ['belot'] }));
    expect(live()).toEqual(['Belot']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Belot' }));
    publish();
    expect(send).toHaveBeenCalledWith({ action: 'publish', games: {}, multiplayer: [] }, 'Home page published (1 change)');
  });

  it('a banner holds all of its game’s settings, kept in the draft until Publish', () => {
    const send = setup(data({ 'neon-rush': { hidden: true } }));
    const tile = banner(/Neon Rush/);
    expect(tile.className).toContain('is-hidden');
    fireEvent.click(tile);
    expect(screen.getByRole('switch', { name: 'Visible' }).getAttribute('aria-checked')).toBe('false');
    // a hidden game can't be a best game or today's pick
    expect(screen.getByRole('switch', { name: 'Best game' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('switch', { name: 'Visible' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Pinned' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'NEW badge' }), { target: { value: 'on' } });
    fireEvent.change(screen.getByPlaceholderText('Neon Rush'), { target: { value: 'Neon Rush DX' } });
    expect(send).not.toHaveBeenCalled();
    expect(banner(/Neon Rush DX/).className).not.toContain('is-hidden');
    publish();
    expect(send).toHaveBeenCalledWith({ action: 'publish', games: { 'neon-rush': { hidden: false, pinned: true, newBadge: 'on', title: 'Neon Rush DX' } } }, 'Home page published (1 change)');
  });

  it('one today’s pick at a time: choosing another game turns the old one off in the same publish', () => {
    const send = setup(data({ gloop: { spotlight: true } }));
    fireEvent.click(banner(/Whatsit/));
    fireEvent.click(screen.getByRole('switch', { name: 'Today’s pick' }));
    publish();
    expect(send).toHaveBeenCalledWith({ action: 'publish', games: { gloop: { spotlight: false }, whatsit: { spotlight: true } } }, 'Home page published (2 changes)');
  });

  it('the Best game switch edits Our best games: on takes the last card', () => {
    const send = setup();
    fireEvent.click(banner(/Gloop/));
    fireEvent.click(screen.getByRole('switch', { name: 'Best game' }));
    expect(best()).toEqual(['Quizbelief', 'Launch Control', 'Color Recall', 'Gloop']);
    publish();
    expect(send).toHaveBeenCalledWith({ action: 'publish', games: {}, flagships: ['wait-what', 'launch-control', 'color-recall', 'gloop'] }, 'Home page published (1 change)');
  });

  it('moving a banner makes the layout part of the publish; Discard throws the draft away', () => {
    const send = setup();
    fireEvent.click(banner(/Gloop/));
    fireEvent.click(screen.getByRole('button', { name: 'Move to the front' }));
    expect(screen.getByRole('listbox', { name: 'Arcade banners in order' }).querySelector('.al-name')!.textContent).toContain('Gloop');
    fireEvent.click(screen.getByRole('button', { name: 'Show changes' }));
    expect(screen.getByRole('list', { name: 'Unpublished changes' }).textContent).toContain('Banners: order and looks');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('Everything is published')).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });
});
