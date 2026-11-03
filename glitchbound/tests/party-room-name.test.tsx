import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const joined: string[] = [];
let live = false;
let closed = false;
const opened: string[] = [];
vi.mock('../src/platform/rooms', () => ({
  GAME_ROOM_PAGE: {},
  seatedName: () => null,
  roomInfo: () => Promise.resolve(closed ? null : { players: 2, host: 'Ana', full: false, phase: 'talk' }),
  createRoom: (game: string) => {
    opened.push(game);
    return Promise.resolve('NEWRM');
  },
  useRoom: (code: string, name: string) => {
    joined.push(name);
    const view = live ? { phase: 'lobby', code, host: false, deadline: null, players: [{ n: 1, name, score: 0, online: true, waiting: false, you: true, host: false, done: false }] } : null;
    return { view, conn: live ? 'open' : 'connecting', error: '', clearError: () => {}, gone: '', skew: 0, send: () => {}, listing: null, setListed: () => {} };
  },
}));

import { RoomFrame } from '../src/party/ui/room/RoomFrame';
import { cleanRoomName, forgetRoom, lastRoomName, rememberRoomName, roomNameFor } from '../src/party/ui/room/roomName';
import { guestName, resetGuestName } from '../src/platform/playerName';

const meta = { game: 'dial' as const, title: 'Dial It In', emoji: '📻', invite: 'Join', min: 2 };
const frame = (code: string) => (
  <RoomFrame code={code} meta={meta} onLeave={() => {}} kick={(n: number) => ({ t: 'kick', n })} settings={() => null}>
    {() => null}
  </RoomFrame>
);

describe('room names survive a reload', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGuestName();
    joined.length = 0;
    live = false;
    closed = false;
  });

  it('keeps names of up to 20 characters in any script, per room', () => {
    expect(rememberRoomName('abcde', '  Олександра   Петренко ')).toBeNull();
    expect(roomNameFor('ABCDE')).toBe('Олександра Петренко');
    expect(rememberRoomName('FGHIJ', 'PA-Cy-Twenty-Chars20-and-more')).toBeNull();
    expect(roomNameFor('FGHIJ')).toBe('PA-Cy-Twenty-Chars20');
    expect(lastRoomName()).toBe('PA-Cy-Twenty-Chars20');
    expect(cleanRoomName('😀'.repeat(25))).toBe('😀'.repeat(20));
    forgetRoom('abcde');
    expect(roomNameFor('ABCDE')).toBeNull();
  });

  it('keeps only the newest rooms, and survives a corrupted store', () => {
    for (let i = 0; i < 15; i++) rememberRoomName(`R${i}`, `P${i}`, 1000 + i);
    expect(roomNameFor('R0')).toBeNull();
    expect(roomNameFor('R14')).toBe('P14');
    localStorage.setItem('glitchbound.roomNames', '{"rooms": 5');
    expect(roomNameFor('R14')).toBeNull();
    expect(rememberRoomName('R1', 'Bo')).toBeNull();
  });

  it('says so when the name cannot be saved', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(rememberRoomName('ABCDE', 'Ana')).toMatch(/couldn’t be saved/);
    spy.mockRestore();
  });

  it('asks once, then a reload goes straight back in under the same name', () => {
    const first = render(frame('QWERT'));
    expect(screen.getByText('Join the room')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: 'Ярослава Ковальчук' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(joined.at(-1)).toBe('Ярослава Ковальчук');
    first.unmount();
    // The arcade nickname rule doesn't apply: the guest name stays what it was.
    expect(guestName()).not.toBe('Ярослава Ковальчук');

    joined.length = 0;
    live = true;
    render(frame('QWERT'));
    expect(screen.queryByText('Join the room')).toBeNull();
    expect(joined[0]).toBe('Ярослава Ковальчук');
    expect(screen.getByText('Welcome back, Ярослава Ковальчук!')).toBeTruthy();
  });

  it('prefills another room with the last room name', () => {
    rememberRoomName('AAAAA', 'Ярослава');
    render(frame('BBBBB'));
    expect((screen.getByLabelText(/Your name/) as HTMLInputElement).value).toBe('Ярослава');
  });

  it('offers a new room of the same game when the room has closed', async () => {
    closed = true;
    render(frame('ZZZZZ'));
    fireEvent.click(await screen.findByRole('button', { name: 'Open a new room' }));
    await waitFor(() => expect(opened).toEqual(['dial']));
    expect(location.search).toBe('?room=NEWRM');
  });
});
