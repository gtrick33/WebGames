/**
 * The last things before 1.0.0: Settings says which version this is, and on a phone it leaves out the keyboard's
 * keys (there is no keyboard to press them on); the shop inside the game shows every piece of the Gloamknight Pack
 * and opens an item on a stand to be looked over, as the site's shop does.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/games/sigilfall/render/sprites', async (original) => ({ ...(await original<typeof import('../src/games/sigilfall/render/sprites')>()), heroDollUrl: () => '' }));
vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));
import { NO_MONEY } from '../src/catalog/settings';
import { GLOAMKNIGHT_ITEM, PRODUCTS } from '../src/catalog/shop';
import { GAME_VERSION } from '../src/games/sigilfall/data/version';
import type { SigilEngine } from '../src/games/sigilfall/engine';
import { defaultBinds } from '../src/games/sigilfall/input/binds';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { playerDetail, SAVE_KEY } from '../server/sigilfallGm';
import type { Env } from '../server/http';
import { memoryD1 } from './d1';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const engineOn = (touchMode: boolean): SigilEngine =>
  ({ settings: { ...DEFAULT_SETTINGS }, setSettings: () => undefined, resetSettings: () => undefined, setTutorial: () => undefined, usePreset: () => undefined, binds: () => defaultBinds('f', 'c'), canSave: true, hero: null, reviewTools: false, touchMode }) as unknown as SigilEngine;

describe('Settings', () => {
  it('names the version, and it is 1.0.0', async () => {
    expect(GAME_VERSION).toBe('1.0.0');
    const { SettingsPanel } = await import('../src/games/sigilfall/ui/Panels');
    render(<SettingsPanel engine={engineOn(false)} onClose={() => undefined} />);
    expect(screen.getByText(`Sigilfall ${GAME_VERSION}`)).toBeTruthy();
  });

  it('shows the keyboard’s keys with a keyboard and leaves them out on a touch screen', async () => {
    const { SettingsPanel } = await import('../src/games/sigilfall/ui/Panels');
    const desk = render(<SettingsPanel engine={engineOn(false)} onClose={() => undefined} />);
    expect(desk.container.textContent).toContain('Keyboard');
    desk.unmount();
    const phone = render(<SettingsPanel engine={engineOn(true)} onClose={() => undefined} />);
    expect(phone.container.textContent).not.toContain('Keyboard');
    expect(phone.container.textContent).toContain(`Sigilfall ${GAME_VERSION}`);
  });
});

describe('the shop inside the game', () => {
  it('shows each piece of the pack as it looks, and opens an item to be turned round', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null }))));
    const { setCatalog } = await import('../src/platform/liveCatalog');
    setCatalog({ settings: {}, picks: {}, notice: null, money: { ...NO_MONEY, shop: true } });
    const { StorePanel } = await import('../src/games/sigilfall/ui/Store');
    render(<StorePanel onClose={() => undefined} />);
    const pack = PRODUCTS.find((p) => p.id === GLOAMKNIGHT_ITEM)!;
    const parts = screen.getByRole('list', { name: /pack/i });
    // the class itself, then every item the pack gives: a picture each, not a word alone
    expect(within(parts).getAllByRole('listitem').length).toBe(pack.includes!.length + 1);
    for (const id of pack.includes!) {
      const p = PRODUCTS.find((x) => x.id === id)!;
      const li = within(parts).getByText(p.name).closest('li')!;
      expect(li.querySelector(p.sigil ? '.sigil-pic img' : p.look?.kind === 'banner' ? '.look-banner' : '.avatar-frame'), id).toBeTruthy();
    }
    // the helm, the armor and the drake can be opened; so can every mount and look on sale
    const sigil = PRODUCTS.filter((p) => p.sigil && !p.hidden && !p.later);
    for (const p of sigil) expect(screen.getByRole('button', { name: `Look closer: ${p.name}` }), p.id).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Look closer: Gloamwing Drake' }));
    });
    const stand = screen.getByRole('dialog', { name: 'Gloamwing Drake' });
    expect(within(stand).getByText('Drag to turn it')).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(stand).getByRole('button', { name: 'Close' }));
    });
    expect(screen.queryByRole('dialog', { name: 'Gloamwing Drake' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Sigilfall shop' })).toBeTruthy();
  });
});

describe('the game masters’ page', () => {
  it('says what a player has from the shop for the game, and not what was refunded or is the site’s', async () => {
    const db = memoryD1();
    const env = { DB: db } as unknown as Env;
    const now = 1_800_000_000_000;
    db.sqlite.prepare('INSERT INTO users (id, google_sub, email, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)').run('u1', 'u1', 'u1@example.test', 'Grom', now, now);
    db.sqlite.prepare('INSERT INTO game_saves (user_id, key, data, updated_at) VALUES (?, ?, ?, ?)').run('u1', SAVE_KEY, JSON.stringify({ heroes: [] }), now);
    const buy = (id: string, product: string, status: string): void => {
      db.sqlite.prepare('INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, 'u1', product, status, now, 't', now);
    };
    buy('p1', GLOAMKNIGHT_ITEM, 'paid');
    buy('p2', 'sigilfall-cinderhorn-hart', 'paid');
    buy('p3', 'sigilfall-galecrest-drake', 'refunded');
    buy('p4', 'ad-free', 'paid');
    const seen = await playerDetail(env, 'u1', now);
    expect([...seen!.bought].sort()).toEqual([GLOAMKNIGHT_ITEM, 'sigilfall-cinderhorn-hart'].sort());
  });
});
