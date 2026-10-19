import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RaceAudio } from '../src/games/mini-racer/audio';
import type { Engine } from '../src/games/mini-racer/engine';
import { dailyTrack, todayKey } from '../src/games/mini-racer/daily';
import Game from '../src/games/mini-racer/Game';

const host = { report: vi.fn() };
const engine = (): Engine => (window as unknown as { __miniRacer: Engine }).__miniRacer;

afterEach(() => {
  vi.restoreAllMocks();
  host.report.mockClear();
});

describe('Mini Racer: the arcade pause signal (pauseKey)', () => {
  it('pauses a running race the same way as P/Esc: race frozen, engine and music silenced', async () => {
    const pause = vi.spyOn(RaceAudio.prototype, 'pause');
    const update = vi.spyOn(RaceAudio.prototype, 'update');
    const { rerender } = render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Race!' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(engine().paused).toBe(false);
    expect(host.report).toHaveBeenCalledWith({ type: 'start' });

    // The first render must not pause; a changed key does.
    rerender(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(engine().paused).toBe(false);
    act(() => rerender(<Game host={host} restartKey={0} pauseKey={1} />));

    expect(screen.getByRole('heading', { name: 'Paused' })).toBeTruthy();
    expect(engine().paused).toBe(true);
    // Audio: the engine hum and squeal go to zero and the AudioContext (with the music) is suspended.
    expect(update).toHaveBeenLastCalledWith(0, 0, false);
    expect(pause).toHaveBeenCalled();

    // The race clock doesn't move while paused.
    const t = engine().sim!.time;
    await act(() => new Promise((r) => setTimeout(r, 120)));
    expect(engine().sim!.time).toBe(t);
  });

  it('on the menu it fades the race music out instead', () => {
    const music = vi.spyOn(RaceAudio.prototype, 'music');
    const { rerender } = render(<Game host={host} restartKey={0} pauseKey={3} />);
    expect(screen.getByRole('button', { name: 'Race!' })).toBeTruthy();
    music.mockClear();
    act(() => rerender(<Game host={host} restartKey={0} pauseKey={4} />));
    expect(music).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('heading', { name: 'Paused' })).toBeNull();
  });
});

describe('Mini Racer: today’s daily track is one race a day', () => {
  it('R does not throw the daily race away, but restarts any other race', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('radio', { name: /Daily/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Race!' }));
    expect(host.report).toHaveBeenCalledTimes(1);
    act(() => {
      fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });
    });
    // Still racing: no menu, no second start.
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(host.report).toHaveBeenCalledTimes(1);

    // The paused screen offers no Restart for it either, and R is ignored there too.
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });
    });
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeTruthy();

    // Leaving asks first (it is the day's one race), then ends the race once, unfinished.
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('heading', { name: 'Leave today’s daily?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep racing' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave the race' }));
    expect(host.report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { drift: 0, cleanLaps: 0 }, daily: true });
    expect(host.report).toHaveBeenCalledTimes(2);

    // Back on the menu the daily is used up and says so; another track restarts with R as before.
    expect(screen.queryByRole('button', { name: 'Race!' })).toBeNull();
    expect(screen.getByText(/Today’s daily was left unfinished/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Daily · unfinished/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Sunny Bay/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Race!' }));
    act(() => {
      fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });
    });
    expect(host.report).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('a daily race cut short by the arcade (Restart, Exit) ends once, with what was driven', () => {
    const { unmount } = render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('radio', { name: /Daily/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Race!' }));
    unmount();
    expect(host.report).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'end', daily: true }));
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(host.report).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Today’s daily was left unfinished/)).toBeTruthy();
  });

  it('a daily race left by a reload (no goodbye) is settled once when the game opens again', () => {
    localStorage.setItem('gb.mini-racer.v1', JSON.stringify({ track: dailyTrack(todayKey()).id, dailyRaced: [todayKey()] }));
    const { unmount } = render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(host.report).toHaveBeenCalledWith({ type: 'end', score: 0, stats: {}, daily: true });
    unmount();
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(host.report).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Today’s daily was left unfinished/)).toBeTruthy();
  });
});
