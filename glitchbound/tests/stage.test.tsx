import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameModuleProps } from '../src/platform/contract';
import { fakeGame } from './fixtures';

// Module games: one that loads and reports a score, one whose chunk fails to load, one that crashes.
vi.mock('../src/catalog/modules', () => ({
  GAME_MODULES: {
    works: () =>
      Promise.resolve({
        default: ({ host }: GameModuleProps) => (
          <button onClick={() => host.report({ type: 'end', score: 7 })}>finish round</button>
        ),
      }),
    'broken-chunk': () => Promise.reject(new Error('chunk failed')),
    crashes: () =>
      Promise.resolve({
        default: () => {
          throw new Error('game bug');
        },
      }),
  },
}));

const { GameStage } = await import('../src/components/GameStage');

function stage(slug: string, onEvent = vi.fn()) {
  render(<GameStage game={fakeGame({ slug, title: slug })} onEvent={onEvent} stageRef={createRef()} />);
  fireEvent.click(screen.getByRole('button', { name: `Play ${slug}` }));
  return onEvent;
}

describe('module games', () => {
  it('lazy-loads the module and passes its events to the host', async () => {
    const onEvent = stage('works');
    fireEvent.click(await screen.findByRole('button', { name: 'finish round' }));
    expect(onEvent).toHaveBeenCalledWith({ type: 'end', score: 7 });
  });

  it('shows a contained error when the module chunk fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stage('broken-chunk');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/didn.t load/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
  });

  it('contains a game that throws while rendering', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stage('crashes');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('shows an error when a module game is registered without a loader', () => {
    stage('missing-module');
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('embedded games', () => {
  const embed = (url: string) => {
    render(<GameStage game={fakeGame({ slug: 'emb', title: 'Emb', runtime: { kind: 'embed', url, origins: ['self'] } })} onEvent={vi.fn()} stageRef={createRef()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Emb' }));
  };

  it('shows the stage loader while another site loads', () => {
    embed('https://games.example/emb/');
    expect(screen.getByRole('status').textContent).toContain('Loading Emb');
  });

  it('leaves the loading screen to a game served from this site (it paints its own at once)', () => {
    embed('/play/emb/');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByTitle('Emb game')).toBeTruthy();
  });
});
