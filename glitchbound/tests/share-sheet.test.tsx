import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShareSheet from '../src/components/ShareSheet';
import { shareOrCopy, shareRequests } from '../src/platform/share';

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
