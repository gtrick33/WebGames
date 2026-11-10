import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dial from '../src/party/rooms/dialRoom';
import * as hues from '../src/party/rooms/huesRoom';
import * as unique from '../src/party/rooms/uniqueRoom';
import { rememberRoomName } from '../src/party/ui/room/roomName';

// The live screens read the room through useRoom: each test sets the view it returns.
const room = vi.hoisted(() => ({ value: {} as Record<string, unknown>, send: vi.fn() }));
vi.mock('../src/platform/rooms', async (load) => ({
  ...(await load<typeof import('../src/platform/rooms')>()),
  useRoom: () => ({ view: null, conn: 'open', error: '', clearError: () => undefined, gone: '', goneCode: '', skew: 0, send: room.send, listing: null, setListed: () => undefined, ...room.value }),
  roomInfo: async () => ({ players: 3, host: 'P1', full: false, phase: 'lobby' }),
}));

const { DialRoomPage } = await import('../src/party/ui/room/DialRoom');
const { HuesRoomPage } = await import('../src/party/ui/room/HuesRoom');
const { UniqueRoomPage } = await import('../src/party/ui/room/UniqueRoom');

const KEYS = ['aaaaaaaaaaaaaaaa1', 'bbbbbbbbbbbbbbbb2', 'cccccccccccccccc3', 'dddddddddddddddd4'];
const T0 = 1_800_000_000_000;
const noop = (): void => undefined;
const said = () => screen.getByRole('button', { name: 'I’ve said my clue' });

beforeEach(() => {
  room.value = {};
  room.send.mockReset();
  localStorage.clear();
  rememberRoomName('ABCDE', 'P1');
});
afterEach(cleanup);

describe('the Real life switch on the live party rooms', () => {
  it('shows the switch with its description in every room that types clues, and sends the setting', () => {
    const rooms = [
      { s: dial.newRoom('ABCDE', T0, 1), join: dial.join, view: dial.viewFor, Page: DialRoomPage },
      { s: hues.newRoom('ABCDE', T0, 1), join: hues.join, view: hues.viewFor, Page: HuesRoomPage },
      { s: unique.newRoom('ABCDE', T0, 1), join: unique.join, view: unique.viewFor, Page: UniqueRoomPage },
    ] as const;
    for (const { s, join, view, Page } of rooms) {
      KEYS.slice(0, 3).forEach((k, i) => (join as (s: unknown, k: string, n: string, t: number) => void)(s, k, `P${i + 1}`, T0));
      room.value = { view: (view as (s: unknown, k: string) => unknown)(s, KEYS[0]!) };
      render(<Page code="ABCDE" onLeave={noop} />);
      const box = screen.getByRole('checkbox', { name: /Real life/ });
      expect(box.closest('label')!.textContent).toMatch(/say them out loud instead/);
      fireEvent.click(box);
      expect(room.send).toHaveBeenCalledWith({ t: 'settings', settings: { real: true } });
      room.send.mockReset();
      cleanup();
    }
  });

  it('Dial It In: the reader gets a “said” button instead of the clue box', () => {
    const s = dial.newRoom('ABCDE', T0, 1);
    KEYS.slice(0, 3).forEach((k, i) => dial.join(s, k, `P${i + 1}`, T0));
    dial.act(s, KEYS[0]!, { t: 'settings', settings: { real: true } }, T0);
    dial.act(s, KEYS[0]!, { t: 'start' }, T0);
    room.value = { view: dial.viewFor(s, KEYS[0]!) };
    render(<DialRoomPage code="ABCDE" onLeave={noop} />);
    expect(screen.queryByRole('textbox', { name: 'Your clue' })).toBeNull();
    fireEvent.click(said());
    expect(room.send).toHaveBeenCalledWith({ t: 'clue', text: '' });
    cleanup();
    dial.act(s, KEYS[0]!, { t: 'clue', text: '' }, T0);
    room.value = { view: dial.viewFor(s, KEYS[1]!) };
    render(<DialRoomPage code="ABCDE" onLeave={noop} />);
    expect(screen.getByText('🗣️ Clue said out loud')).toBeTruthy();
  });

  it('Hue Knew?: the cue giver picks a color, then taps “said” with no typing', () => {
    const s = hues.newRoom('ABCDE', T0, 1);
    KEYS.slice(0, 3).forEach((k, i) => hues.join(s, k, `P${i + 1}`, T0));
    hues.act(s, KEYS[0]!, { t: 'settings', settings: { real: true } }, T0);
    hues.act(s, KEYS[0]!, { t: 'start' }, T0);
    hues.act(s, KEYS[0]!, { t: 'pick', cell: s.round!.offer[0]! }, T0);
    room.value = { view: hues.viewFor(s, KEYS[0]!) };
    render(<HuesRoomPage code="ABCDE" onLeave={noop} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(said());
    expect(room.send).toHaveBeenCalledWith({ t: 'clue', text: '' });
  });

  it('One of a Kind: a clue giver taps “said”, and the guesser is told to listen', () => {
    const s = unique.newRoom('ABCDE', T0, 1);
    KEYS.slice(0, 3).forEach((k, i) => unique.join(s, k, `P${i + 1}`, T0));
    unique.act(s, KEYS[0]!, { t: 'settings', settings: { real: true } }, T0);
    unique.act(s, KEYS[0]!, { t: 'start' }, T0);
    room.value = { view: unique.viewFor(s, KEYS[1]!) };
    render(<UniqueRoomPage code="ABCDE" onLeave={noop} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(said());
    expect(room.send).toHaveBeenCalledWith({ t: 'clue', text: '' });
    cleanup();
    room.value = { view: unique.viewFor(s, KEYS[0]!) };
    render(<UniqueRoomPage code="ABCDE" onLeave={noop} />);
    expect(screen.getByText('Listen: your friends will say their clues out loud.')).toBeTruthy();
  });
});
