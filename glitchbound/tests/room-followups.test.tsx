import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inviteWords as backgammonInvite } from '../src/games/backgammon/live';
import { WORDS as BACKGAMMON } from '../src/games/backgammon/text';
import { inviteWords as belotInvite } from '../src/games/belot/live';
import { WORDS as BELOT } from '../src/games/belot/text';
import { rememberSeat } from '../src/platform/rooms';

// The live screens read the room through useRoom: each test sets what it returns.
const room = vi.hoisted(() => ({ value: {} as Record<string, unknown>, send: vi.fn() }));
vi.mock('../src/platform/rooms', async (load) => ({
  ...(await load<typeof import('../src/platform/rooms')>()),
  useRoom: () => ({ view: null, conn: 'open', error: '', clearError: () => undefined, gone: '', goneCode: '', skew: 0, send: room.send, listing: null, setListed: () => undefined, ...room.value }),
  roomInfo: async () => ({ players: 1, host: 'Ana', full: false, phase: 'lobby' }),
}));
// The battle itself (a canvas) is a stand-in that plays one turn as soon as it shows.
vi.mock('../src/games/crater-crew/Battle', () => ({
  Battle: ({ onTurn }: { onTurn: (turn: number, input: { walk: number[]; fire: null; run?: number }) => void }) => {
    useEffect(() => onTurn(4, { walk: [1, 2], fire: null }), [onTurn]);
    return null;
  },
}));

const { LiveRoom } = await import('../src/games/crater-crew/live');
const { LiveTable } = await import('../src/games/belot/live');
const { LiveBoard } = await import('../src/games/backgammon/live');
const { DeadEnd, useJoinName } = await import('../src/party/ui/room/RoomFrame');

const noop = (): void => undefined;
const sfx = () => ({}) as never;

beforeEach(() => {
  room.value = {};
  room.send.mockReset();
  localStorage.clear();
});
afterEach(cleanup);

describe('Crater Crew live turns (a)', () => {
  it('sends a turn so it is re-sent after a reconnect until the room confirms it', () => {
    const match = { seed: 1, turn: 4, crews: [{ seat: 1 }, { seat: 2 }] };
    room.value = { view: { phase: 'play', match, me: 1, host: true, players: [], picks: [], turnAt: 0 } };
    render(<LiveRoom code="ABCDE" name="Ana" sfx={sfx} muted={false} onMute={noop} onLeave={noop} onRoom={noop} tools={null} />);
    expect(room.send).toHaveBeenCalledWith({ t: 'turn', turn: 4, walk: [1, 2], fire: null, run: undefined }, { resend: true });
  });
});

describe('a next step on the closed and full screens (b)', () => {
  const quick = () => screen.queryByRole('button', { name: /Quick match/ });
  const fresh = () => screen.queryByRole('button', { name: 'Open a new room' });

  it('Crater Crew, Belot and Backgammon offer quick match and a new room', () => {
    room.value = { gone: 'This room is full.', goneCode: 'full' };
    for (const ui of [
      <LiveRoom key="cc" code="ABCDE" name="Ana" sfx={sfx} muted={false} onMute={noop} onLeave={noop} onRoom={noop} tools={null} />,
      <LiveTable key="bl" w={BELOT.en} code="ABCDE" name="Ana" sfx={sfx} tools={null} onLeave={noop} onRoom={noop} />,
      <LiveBoard key="tb" w={BACKGAMMON.en} code="ABCDE" name="Ana" sfx={sfx} tools={null} onLeave={noop} onRoom={noop} />,
    ]) {
      render(ui);
      expect(quick()).toBeTruthy();
      expect(fresh()).toBeTruthy();
      cleanup();
    }
  });

  it('a removed player is only offered a room of their own; another tab gets none', () => {
    room.value = { gone: 'You were removed from this room.', goneCode: 'kicked' };
    render(<LiveTable w={BELOT.en} code="ABCDE" name="Ana" sfx={sfx} tools={null} onLeave={noop} onRoom={noop} />);
    expect(quick()).toBeNull();
    expect(fresh()).toBeTruthy();
    cleanup();
    room.value = { gone: 'This room is open in another tab.', goneCode: 'replaced' };
    render(<LiveBoard w={BACKGAMMON.en} code="ABCDE" name="Ana" sfx={sfx} tools={null} onLeave={noop} onRoom={noop} />);
    expect(quick()).toBeNull();
    expect(fresh()).toBeNull();
  });

  it('Party Mode rooms offer it on their closed and not-found screen', () => {
    render(<DeadEnd game="dial" room="ABCDE" title="Room" heading="This room has closed" onLeave={noop} />);
    expect(quick()).toBeTruthy();
    expect(fresh()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Party Mode' })).toBeTruthy();
  });
});

describe('rejoining prefills the seated name (c)', () => {
  it('prefills the join form with the name you were seated under in that room', () => {
    rememberSeat('ABCDE', 'Maya');
    expect(renderHook(() => useJoinName('ABCDE')).result.current.prefill).toBe('Maya');
    expect(renderHook(() => useJoinName('FGHJK')).result.current.prefill).not.toBe('Maya');
  });
});

describe('invite wording for watchers (d)', () => {
  const free = { place: 0, player: null, bot: null } as never;
  const taken = { player: { n: 1, name: 'Ana', online: true, host: true }, bot: null } as never;
  const bot = { place: 0, player: null, bot: 'hard' } as never;

  it('Belot invites to play while a place is free, and to watch once all four are taken', () => {
    expect(belotInvite(BELOT.en, { places: [taken, bot, free, bot] }, 'ABCDE')).toEqual({ label: BELOT.en.invite, text: 'Come play Belot with me! Table ABCDE' });
    expect(belotInvite(BELOT.en, { places: [taken, bot, taken, bot] }, 'ABCDE')).toEqual({ label: 'Send this to friends who want to watch', text: 'Come watch our Belot game! Table ABCDE' });
    expect(belotInvite(BELOT.bg, { places: [taken, bot, taken, bot] }, 'ABCDE').text).toContain('гледаш');
  });

  it('Backgammon invites to play while a place is free, and to watch once both are taken', () => {
    expect(backgammonInvite(BACKGAMMON.en, { places: [taken, free] }, 'ABCDE').text).toBe('Up for a game of backgammon? Board ABCDE');
    expect(backgammonInvite(BACKGAMMON.en, { places: [taken, bot] }, 'ABCDE')).toEqual({ label: 'Send this to a friend who wants to watch', text: 'Come watch our backgammon match! Board ABCDE' });
    expect(backgammonInvite(BACKGAMMON.bg, { places: [taken, taken] }, 'ABCDE').text).toContain('гледаш');
  });
});
