/** Admin › Ads & shop › Shop items: making a new look with the item builder, with a live preview, and saving it. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS, type Product } from '../src/catalog/shop';
import type { AdminCatalog } from '../src/platform/apiTypes';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [], recent: [] }))));
  const { MoneySection } = await import('../src/pages/admin/MoneySection');
  const send = vi.fn(async () => true);
  render(<MoneySection data={{ shopItems: PRODUCTS } as unknown as AdminCatalog} send={send} busy={false} />);
  return { send, list: screen.getByRole('region', { name: 'Shop items' }) };
}

describe('the item builder', () => {
  it('makes a recolored border, with a live preview, that saves as a working look', async () => {
    const { send, list } = await open();
    fireEvent.click(within(list).getByRole('button', { name: 'Add an item' }));
    const form = within(list).getByRole('group', { name: 'New item' });
    // a border by default, in the first style, previewed as players will see it
    expect(form.querySelector('.money-new-preview .avatar-frame.look-border-neon-halo')).toBeTruthy();
    fireEvent.change(within(form).getByRole('combobox', { name: 'Style of the new item' }), { target: { value: 'frost' } });
    fireEvent.change(within(form).getByLabelText('Color 2 of the new item'), { target: { value: '#ff8800' } });
    const frame = form.querySelector<HTMLElement>('.money-new-preview .avatar-frame.look-border-frost')!;
    expect(frame.style.getPropertyValue('--c2')).toBe('#ff8800');
    fireEvent.change(within(form).getByRole('textbox', { name: 'Name' }), { target: { value: 'Ember Frost border' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add to the list' }));
    fireEvent.click(within(list).getByRole('button', { name: 'Save the items' }));
    const items = (send.mock.calls[0] as unknown as [{ items: Product[] }])[0].items;
    const made = items.find((p) => p.name === 'Ember Frost border')!;
    expect(made).toMatchObject({ id: 'border-ember-frost-border', cents: 50, look: { kind: 'border', style: 'frost' } });
    expect(made.look!.colors![1]).toBe('#ff8800');
    expect(made.later).toBeUndefined();
  });

  it('makes icons and banners too, and something else only as planned', async () => {
    const { list } = await open();
    fireEvent.click(within(list).getByRole('button', { name: 'Add an item' }));
    const form = within(list).getByRole('group', { name: 'New item' });
    const kind = within(form).getByRole('combobox', { name: 'What it is' });
    fireEvent.change(kind, { target: { value: 'icon' } });
    expect(form.querySelector('.money-new-preview .avatar-icon.look-icon-fox svg')).toBeTruthy();
    fireEvent.change(kind, { target: { value: 'banner' } });
    expect(form.querySelector('.money-new-preview .look-banner.look-banner-sunset-grid')).toBeTruthy();
    fireEvent.change(kind, { target: { value: 'plain' } });
    expect(within(form).getByText(/added as planned/)).toBeTruthy();
    // the shop's rules still apply to its words
    fireEvent.change(within(form).getByRole('textbox', { name: 'Name' }), { target: { value: 'Mystery box' } });
    expect(within(form).getByRole('alert').textContent).toMatch(/rules/);
    expect(within(form).getByRole('button', { name: 'Add to the list' })).toHaveProperty('disabled', true);
  });

  it('shows each look in the list, and the built-in ones can be hidden but not removed', async () => {
    const { list } = await open();
    const looks = PRODUCTS.filter((p) => p.look || p.sigil);
    expect(list.querySelectorAll('.money-item.has-look .money-thumb')).toHaveLength(looks.length);
    expect(within(list).queryAllByRole('button', { name: 'Remove' })).toHaveLength(PRODUCTS.length - 1 - looks.length);
  });
});
