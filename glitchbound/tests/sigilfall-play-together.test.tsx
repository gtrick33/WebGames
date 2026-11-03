import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SigilEngine } from '../src/games/sigilfall/engine';
import { KeyboardMouse, type UiKey } from '../src/games/sigilfall/input/input';
import { PartyPanel } from '../src/games/sigilfall/ui/Party';
import { readyHero } from './sigilfall-bot';

/**
 * Playing together starts from any hero (the owner, 2026-10-27: a new character had no way to invite
 * anyone, the party panel opened only from a level-60 Riftstone): O or the HUD's Play together button
 * opens it, and a hero below level 60 is offered a questing party first.
 */

vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));
afterEach(cleanup);

describe('Sigilfall: play together from any hero', () => {
  it('O opens the party panel', () => {
    const kbm = new KeyboardMouse(document.createElement('div'));
    const asked: UiKey[] = [];
    kbm.onUi = (k) => asked.push(k);
    fireEvent.keyDown(window, { key: 'o', code: 'KeyO' });
    expect(asked).toEqual(['party']);
    kbm.dispose();
  });

  it('a new hero is offered a questing party first; the Riftstone waits for level 60', () => {
    const hero = readyHero('mage', 1);
    const createParty = vi.fn(async () => undefined);
    const engine = {
      hero,
      party: null,
      partyReady: () => 'Riftstone runs with friends are for heroes at level 60.',
      createParty,
      closePanel: () => undefined,
      joinParty: () => undefined,
    } as unknown as SigilEngine;
    render(<PartyPanel engine={engine} />);
    const starts = screen.getAllByRole('button', { name: /^Start a/ });
    expect(starts.map((b) => [b.textContent, (b as HTMLButtonElement).disabled])).toEqual([
      ['Start a questing party', false],
      ['Start a Riftstone party', true],
    ]);
    fireEvent.click(starts[0]!);
    expect(createParty).toHaveBeenCalledWith('party');
  });
});

describe('Sigilfall: the party panel says what happened (SFC-07, SFC-10)', () => {
  const seat = (n: number, name: string, extra: object = {}) => ({ n, name, score: 0, online: true, waiting: false, you: false, host: false, done: false, card: { name, cls: 'mage', level: 20, para: 0, keystone: 0, story: 3, look: {}, weapon: {} }, ...extra });

  it('a friend turned away sees why, with the code kept to try again', () => {
    const joinParty = vi.fn();
    const engine = { hero: readyHero('mage', 1), party: null, partyLeft: { code: 'JXVKS', why: 'That party is full (4 of 4).' }, partyReady: () => 'x', createParty: vi.fn(), closePanel: () => undefined, joinParty } as unknown as SigilEngine;
    render(<PartyPanel engine={engine} />);
    expect(screen.getByRole('status').textContent).toBe('That party is full (4 of 4).');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(joinParty).toHaveBeenCalledWith('JXVKS');
  });

  it('questing, the host and the hero who leads are told apart, with one Leave and a warning for the leader', () => {
    const leaveParty = vi.fn();
    const view = { game: 'sigilfall', code: 'QUEST', phase: 'run', mode: 'party', you: 2, host: 1, lead: 2, plan: null, run: 1, runSeed: 1, week: 1, trip: 1, seats: [seat(1, 'Ana', { host: true }), seat(2, 'Mid', { you: true })] };
    const engine = { hero: readyHero('mage', 20), party: { view, state: 'open', error: '', note: 'Cy left the party' }, closePanel: () => undefined, leaveParty, gatherParty: vi.fn() } as unknown as SigilEngine;
    render(<PartyPanel engine={engine} />);
    expect(screen.getByRole('status').textContent).toBe('Cy left the party');
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows[0]).toContain('host');
    expect(rows[0]).not.toContain('leads');
    expect(rows[1]).toContain('leads');
    expect(screen.queryByRole('button', { name: 'Go my own way' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Gather back in town' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the party' }));
    expect(leaveParty).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Leave\? The party goes on/ }));
    expect(leaveParty).toHaveBeenCalled();
  });
});
