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
