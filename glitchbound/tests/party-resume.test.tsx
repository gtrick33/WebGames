import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { makePlayer } from '../src/party/engine';
import { emptySession, loadSession, PARTY_KEY, saveSession, type PartySession } from '../src/party/session';
import { DialMode } from '../src/party/ui/Dial';
import { UniqueMode } from '../src/party/ui/Unique';

/** A pass-the-phone mode wired to the saved session, like the party page does it. */
function Host({ Mode }: { Mode: typeof UniqueMode }) {
  const [s, setS] = useState<PartySession>(loadSession);
  const update = (fn: (s: PartySession) => PartySession): void =>
    setS((cur) => {
      const next = fn(cur);
      saveSession(next);
      return next;
    });
  return <Mode session={s} update={update} onExit={() => update((cur) => ({ ...cur, active: null }))} />;
}

const click = (name: RegExp): void => {
  fireEvent.click(screen.getByRole('button', { name }));
};

describe('pass-the-phone games survive a refresh', () => {
  it('One of a Kind comes back on the same word, score and cards left', () => {
    localStorage.removeItem(PARTY_KEY);
    saveSession({ ...emptySession(), players: ['Ana', 'Bo', 'Cy'].map((n, i) => makePlayer(n, i, `p${i}`)) });
    const first = render(<Host Mode={UniqueMode} />);
    click(/^Start$/);
    click(/Show the word/);
    click(/Hide it/);
    click(/Got it/);
    click(/Next card/);
    click(/Show the word/);
    const word = document.querySelector('.pt-ok-word')!.textContent;
    first.unmount();

    render(<Host Mode={UniqueMode} />);
    expect(document.querySelector('.pt-ok-word')!.textContent).toBe(word);
    expect(screen.getByText(/12 left · ✅ 1/)).toBeTruthy();
    expect(screen.getByText(/The word for/).textContent).toContain('Bo');
  });

  it('Dial It In comes back on the same round and reader', () => {
    localStorage.removeItem(PARTY_KEY);
    saveSession({ ...emptySession(), players: ['Ana', 'Bo', 'Cy'].map((n, i) => makePlayer(n, i, `p${i}`)) });
    const first = render(<Host Mode={DialMode} />);
    click(/^Start$/);
    click(/show me/);
    const scale = screen.getByRole('img', { name: /Scale from/ }).getAttribute('aria-label');
    first.unmount();

    render(<Host Mode={DialMode} />);
    expect(screen.getByRole('img', { name: /Scale from/ }).getAttribute('aria-label')).toBe(scale);
    expect(screen.getByText(/is the reader/)).toBeTruthy();
    expect(screen.getByText('1/9')).toBeTruthy();
  });
});
