import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayoutEditor } from '../src/pages/AdminLayout';
import type { AdminCatalog } from '../src/platform/apiTypes';

const data = (settings: AdminCatalog['settings'] = {}): AdminCatalog => ({ settings, picks: {}, notice: null, layout: null, log: [] });
const strip = () => within(screen.getByRole('group', { name: 'Start here: the best games' })).getAllByRole('listitem');

describe('home page banners editor', () => {
  it('previews the Start here row: the house picks by default', () => {
    render(<LayoutEditor data={data()} send={vi.fn(async () => true)} busy={false} />);
    expect(strip().map((li) => li.textContent)).toEqual(['1Quizbeliefdefault', '2Launch Controldefault', '3Color Recalldefault', '4Letter Pinchdefault']);
  });

  it('puts the games with the Best game switch first and fills the rest with house picks', () => {
    render(<LayoutEditor data={data({ 'neon-rush': { flagship: true }, 'memory-grid': { flagship: true } })} send={vi.fn(async () => true)} busy={false} />);
    const items = strip().map((li) => li.textContent!);
    expect(items.slice(0, 2).map((x) => x.replace(/^\d/, '')).sort()).toEqual(['Memory Grid', 'Neon Rush']);
    expect(items.slice(2)).toEqual(['3Quizbeliefdefault', '4Launch Controldefault']);
  });

  it('shows hidden games dimmed, and a banner’s switches save right away', () => {
    const send = vi.fn(async () => true);
    render(<LayoutEditor data={data({ 'neon-rush': { hidden: true } })} send={send} busy={false} />);
    const grid = screen.getByRole('listbox', { name: 'Arcade banners in order' });
    const tile = within(grid).getByRole('option', { name: /Neon Rush/ });
    expect(tile.className).toContain('is-hidden');
    expect(within(tile).getByText('Hidden')).toBeTruthy();
    fireEvent.click(tile);
    expect(screen.getByRole('switch', { name: 'Visible' }).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('switch', { name: 'Best game' }));
    expect(send).toHaveBeenCalledWith({ action: 'game', slug: 'neon-rush', patch: { flagship: true } }, 'Neon Rush is a best game');
    fireEvent.click(screen.getByRole('switch', { name: 'Visible' }));
    expect(send).toHaveBeenCalledWith({ action: 'game', slug: 'neon-rush', patch: { hidden: false } }, 'Neon Rush is visible');
    fireEvent.click(screen.getByRole('switch', { name: 'Spotlight' }));
    expect(send).toHaveBeenCalledWith({ action: 'game', slug: 'neon-rush', patch: { spotlight: true } }, undefined);
  });
});
