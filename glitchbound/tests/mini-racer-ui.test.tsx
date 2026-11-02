import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RaceAudio } from '../src/games/mini-racer/audio';
import type { Engine } from '../src/games/mini-racer/engine';
import { dailyTrack, todayKey } from '../src/games/mini-racer/daily';
import Game from '../src/games/mini-racer/Game';
import { autopilot, type RaceSim } from '../src/games/mini-racer/sim';
import type { ChallengeSpec } from '../src/platform/challenge';

const host = { report: vi.fn() };
const engine = (): Engine => (window as unknown as { __miniRacer: Engine }).__miniRacer;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  host.report.mockClear();
});

const SAVE = 'gb.mini-racer.v1';
const stored = (): Record<string, unknown> => JSON.parse(localStorage.getItem(SAVE) ?? '{}') as Record<string, unknown>;
const key = (code: string, target: Element = document.body): void => {
  act(() => {
    fireEvent.keyDown(target, { code, key: code === 'KeyR' ? 'r' : code });
  });
};
/** Drives the race in progress over the line (autopilot), through the engine's own event handling. */
const finishRace = (): void => {
  const e = engine() as unknown as { sim: RaceSim; handle(ev: unknown, sim: RaceSim): void };
  const sim = e.sim;
  act(() => {
    for (let i = 0; i < 120 * 120 && !sim.finished; i++) for (const ev of sim.step(autopilot(sim))) e.handle(ev, sim);
  });
  expect(sim.finished).toBe(true);
};
const CHALLENGE: ChallengeSpec = { id: 'abc1234', round: 1, seed: 42, mode: 'fresh', day: '2026-11-02', replays: [] };
const ends = () => host.report.mock.calls.map((c) => c[0] as { type: string; score?: number; daily?: boolean; challenge?: { id: string; round: number; replay?: string } }).filter((e) => e.type === 'end');
const starts = () => host.report.mock.calls.filter((c) => (c[0] as { type: string }).type === 'start').length;

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

describe('Mini Racer: today’s daily track is three races a day', () => {
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

    // Leaving asks first (it uses up one of the day's races), then ends the race once, unfinished.
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('heading', { name: 'Leave today’s daily?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep racing' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave the race' }));
    expect(host.report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { drift: 0, cleanLaps: 0 }, daily: true });
    expect(host.report).toHaveBeenCalledTimes(2);

    // Back on the menu one of the three races is used; another track restarts with R as before.
    expect(screen.getByRole('button', { name: 'Race! (2 left)' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Daily · 2 left/ })).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Race! (2 left)' })).toBeTruthy();
  });

  it('a daily race left by a reload (no goodbye) is settled once when the game opens again', () => {
    localStorage.setItem('gb.mini-racer.v1', JSON.stringify({ track: dailyTrack(todayKey()).id, dailyRaced: [todayKey()] }));
    const { unmount } = render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(host.report).toHaveBeenCalledWith({ type: 'end', score: 0, stats: {}, daily: true });
    unmount();
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(host.report).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', { name: /Daily · 2 left/ })).toBeTruthy();
  });

  it('after three races the daily track is done until tomorrow', () => {
    const day = todayKey();
    localStorage.setItem('gb.mini-racer.v1', JSON.stringify({ track: dailyTrack(day).id, dailyRaced: [day, day, day], dailyEnded: [day, day, day], dailyLeft: [day] }));
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(host.report).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Race!/ })).toBeNull();
    expect(screen.getByText(/Today’s three races are done/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Daily · done/ })).toBeTruthy();
  });

  it('a race started before races were counted and finished is not settled again', () => {
    const day = todayKey();
    const id = dailyTrack(day).id;
    localStorage.setItem('gb.mini-racer.v1', JSON.stringify({ track: id, dailyRaced: [day], bests: { [id]: { lap: 30, race: 95 } } }));
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(host.report).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Race! (2 left)' })).toBeTruthy();
  });
});

describe('Mini Racer: a race is recorded the moment it crosses the line (MR-02)', () => {
  it('R right after the line keeps the finished race: bests, coins and the end are in before the new start', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Race!' }));
    finishRace();
    // FINISH! is showing (no result card yet, no pause button), and everything is already recorded.
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(ends()).toHaveLength(1);
    expect(ends()[0]!.score).toBeGreaterThan(2000);
    const save = stored() as { bests: Record<string, { race?: number }>; coins: number };
    expect(save.bests['sunny-bay']?.race).toBeGreaterThan(20);
    expect(save.coins).toBeGreaterThan(0);
    key('KeyR');
    expect(starts()).toBe(2);
    expect(ends()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  }, 30_000);

  it('a pause key in that moment shows the result at once instead of a pause menu', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Race!' }));
    finishRace();
    key('Escape');
    expect(screen.queryByRole('heading', { name: 'Paused' })).toBeNull();
    expect(screen.getByText('Race time')).toBeTruthy();
    expect(ends()).toHaveLength(1);
  }, 30_000);
});

describe('Mini Racer: keys belong to the game only when meant for it (MR-03, MR-04)', () => {
  it('Enter on a button focused from the keyboard presses that button, not Race', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    const garage = screen.getByRole('button', { name: /Garage/ });
    garage.focus();
    key('Enter', garage);
    expect(starts()).toBe(0);
    garage.blur();
    key('Enter');
    expect(starts()).toBe(1);
  });

  it('with a dialog open (the arcade’s share sheet) or typing outside the game, its keys do nothing', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    const sheet = document.createElement('div');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    const close = document.createElement('button');
    sheet.append(close);
    document.body.append(sheet);
    key('Enter', close);
    key('Enter');
    expect(starts()).toBe(0);
    sheet.remove();
    const outside = document.createElement('button');
    document.body.append(outside);
    key('Enter', outside);
    expect(starts()).toBe(0);
    outside.remove();
  });
});

describe('Mini Racer: a challenge round is one attempt (MR-09, MR-14, MR-15)', () => {
  it('no R or Restart; leaving asks first and ends the round once; opening it again shows how it ended', () => {
    const { unmount } = render(<Game host={host} restartKey={0} pauseKey={0} challenge={CHALLENGE} />);
    expect(starts()).toBe(1);
    key('KeyR');
    expect(starts()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
    key('KeyR');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('heading', { name: 'Leave the challenge?' })).toBeTruthy();
    expect(ends()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Leave the race' }));
    expect(ends()).toEqual([expect.objectContaining({ score: 0, challenge: { id: 'abc1234', round: 1, replay: undefined } })]);
    unmount();
    render(<Game host={host} restartKey={0} pauseKey={0} challenge={CHALLENGE} />);
    expect(screen.getByText(/You left this round/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the scoreboard' })).toBeTruthy();
    expect(starts()).toBe(1);
    expect(ends()).toHaveLength(1);
  });

  it('a round started before a reload ends at once, once, and is never raced again', () => {
    localStorage.setItem(SAVE, JSON.stringify({ challengeRuns: [{ key: 'abc1234:1', score: 0, race: null, lap: null }] }));
    const { unmount } = render(<Game host={host} restartKey={0} pauseKey={0} challenge={CHALLENGE} />);
    expect(ends()).toEqual([expect.objectContaining({ score: 0, challenge: expect.objectContaining({ id: 'abc1234', round: 1 }) })]);
    expect(screen.getByText(/This round was already started/)).toBeTruthy();
    expect(starts()).toBe(0);
    unmount();
    render(<Game host={host} restartKey={0} pauseKey={0} challenge={CHALLENGE} />);
    expect(ends()).toHaveLength(1);
    expect(starts()).toBe(0);
  });

  it('a finished round sends its ghost; its card has the round’s best lap and no empty bests or +0 coins', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} challenge={CHALLENGE} />);
    finishRace();
    const [end] = ends();
    expect(end!.score).toBeGreaterThan(2000);
    expect(end!.challenge!.replay!.length).toBeGreaterThan(1000);
    key('Enter');
    expect(screen.getByText(/Your best lap this round/)).toBeTruthy();
    expect(screen.queryByText(/Best --:--/)).toBeNull();
    expect(screen.queryByText('+0')).toBeNull();
    key('KeyR');
    expect(starts()).toBe(1);
  }, 30_000);

  it('the visibility report that comes with going full screen does not pause the start', () => {
    let report: IntersectionObserverCallback = () => undefined;
    vi.spyOn(window, 'IntersectionObserver').mockImplementation(function (this: unknown, cb: IntersectionObserverCallback) {
      report = cb;
      return { observe() {}, unobserve() {}, disconnect() {}, takeRecords: () => [] } as unknown as IntersectionObserver;
    } as unknown as () => IntersectionObserver);
    render(<Game host={host} restartKey={0} pauseKey={0} challenge={CHALLENGE} />);
    act(() => report([{ intersectionRatio: 0.1 } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(engine().paused).toBe(false);
    act(() => report([{ intersectionRatio: 0.1 } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(engine().paused).toBe(true);
  });
});

describe('Mini Racer: "Today’s daily" challenges race the real daily (MR-07)', () => {
  it('races that day’s daily track, as one of the day’s daily races', () => {
    const day = todayKey();
    render(<Game host={host} restartKey={0} pauseKey={0} challenge={{ ...CHALLENGE, mode: 'daily', day }} />);
    const def = engine().sim!.track.def;
    expect(def.points).toEqual(dailyTrack(day).points);
    expect(def.name).toBe(dailyTrack(day).name);
    expect((stored() as { dailyRaced: string[] }).dailyRaced).toEqual([day]);
  }, 30_000);

  it('a daily already raced that day is the round’s score at once', () => {
    const day = todayKey();
    localStorage.setItem(SAVE, JSON.stringify({ dailyRaced: [day], dailyEnded: [day], dailyResults: [{ day, score: 2777, race: 40, lap: 13, finished: true }] }));
    render(<Game host={host} restartKey={0} pauseKey={0} challenge={{ ...CHALLENGE, mode: 'daily', day }} />);
    expect(ends()).toEqual([{ type: 'end', score: 2777, stats: { lapMs: 13000, raceMs: 40000 }, challenge: { id: 'abc1234', round: 1 } }]);
    expect(screen.getByText(/Your daily result counts here/)).toBeTruthy();
  }, 30_000);
});

describe('Mini Racer: two tabs and midnight (MR-11, MR-12)', () => {
  it('another tab’s coins stay: picked up from its write, and kept when this tab saves', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    localStorage.setItem(SAVE, JSON.stringify({ ...stored(), coins: 1234 }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SAVE }));
    });
    expect(screen.getByLabelText('1,234 coins')).toBeTruthy();
    // Another write without an event (a cloud sync, a slow tab): this tab's next save starts from it.
    localStorage.setItem(SAVE, JSON.stringify({ ...stored(), coins: 2000, cars: ['pip', 'brick'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Sound' }));
    expect(stored()).toMatchObject({ coins: 2000, muted: true });
  });

  it('left open past midnight, the daily card moves on to the new day', () => {
    vi.setSystemTime(new Date(2026, 10, 2, 23, 59, 50));
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(screen.getByRole('radio', { name: /Daily · 11\/02/ })).toBeTruthy();
    vi.setSystemTime(new Date(2026, 10, 3, 0, 0, 30));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByRole('radio', { name: /Daily · 11\/03/ })).toBeTruthy();
  }, 30_000);
});

describe('Mini Racer: the menu keeps Race! in reach on short screens', () => {
  it('the track’s details fold into a Track info row that opens and closes', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    const toggle = screen.getByRole('button', { name: /Track info/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('mr-info-body')?.textContent).toMatch(/Asphalt/);
  });
});
