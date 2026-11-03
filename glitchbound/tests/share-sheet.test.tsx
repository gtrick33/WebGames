import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShareSheet from '../src/components/ShareSheet';
import { shareOrCopy, shareRequests } from '../src/platform/share';

const drawn = vi.hoisted(() => [] as { cta?: string }[]);
vi.mock('../src/platform/shareCard', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/platform/shareCard')>();
  return { ...real, renderShareCard: async (opts: { cta?: string }) => (drawn.push(opts), null) };
});

describe('the share sheet sends the link alone', () => {
  let written: string[];
  let opened: string[];
  beforeEach(() => {
    written = [];
    opened = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (s: string) => void written.push(s) } });
    vi.spyOn(window, 'open').mockImplementation((url) => (opened.push(String(url)), null));
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();
  });

  it('copies and hands apps only the address: no text, no emoji', async () => {
    const detach = shareRequests.attach();
    const url = `${location.origin}/c/abc1234`;
    const done = shareOrCopy({ title: 'Wing It challenge', text: '⚔️ Ana challenges you to beat 40 in Wing It\nOne flight: most gaps wins', url });
    const data = shareRequests.get()!.data;
    render(<ShareSheet data={data} />);
    // A challenge link is short already: no short link is made for it.
    const whatsapp = (await screen.findByText('WhatsApp')).closest('button')!;
    await waitFor(() => expect(whatsapp.disabled).toBe(false));
    fireEvent.click(whatsapp);
    expect(opened).toEqual([`https://wa.me/?text=${encodeURIComponent(url)}`]);
    expect(await done).toBe('shared');
    const copy = screen.getByText('Copy').closest('button')!;
    await act(async () => {
      fireEvent.click(copy);
      await Promise.resolve();
    });
    expect(written).toEqual([url]);
    detach();
  });
});

describe('the share sheet with rooms and keys', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a room invite keeps its own link and asks friends to join (CA-26)', async () => {
    const fetched: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) => (fetched.push(String(u)), new Response('{}', { status: 400 })));
    drawn.length = 0;
    const detach = shareRequests.attach();
    for (const url of [`${location.origin}/r/ZVSDJ`, `${location.origin}/games/launch-control?room=ABCDE`]) {
      void shareOrCopy({ title: 'Crass Act', text: 'Join my Crass Act room\nRoom code: ZVSDJ', url });
      const view = render(<ShareSheet data={shareRequests.get()!.data} />);
      await waitFor(() => expect(screen.getByText(url.replace(/^https?:\/\//, ''))).toBeTruthy());
      view.unmount();
      shareRequests.finish('cancelled');
    }
    expect(fetched).toEqual([]);
    expect(drawn.map((d) => d.cta)).toEqual(['Join the room', 'Join the room']);
    detach();
  });

  it('keeps Escape and Enter from the game behind it (MR-04)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 400 }));
    const game: string[] = [];
    const onGameKey = (e: KeyboardEvent): void => void game.push(`${e.type}:${e.key}`);
    window.addEventListener('keydown', onGameKey);
    window.addEventListener('keyup', onGameKey);
    const detach = shareRequests.attach();
    const done = shareOrCopy({ title: 'Mini Racer', text: 'Mini Racer 1:02.3', url: `${location.origin}/games/mini-racer` });
    render(<ShareSheet data={shareRequests.get()!.data} />);
    const close = screen.getByLabelText('Close');
    fireEvent.keyDown(close, { key: 'Enter' });
    fireEvent.keyUp(close, { key: 'Enter' });
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(await done).toBe('cancelled');
    expect(game).toEqual([]);
    window.removeEventListener('keydown', onGameKey);
    window.removeEventListener('keyup', onGameKey);
    detach();
  });
});
