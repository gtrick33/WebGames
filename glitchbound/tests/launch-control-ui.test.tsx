import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/launch-control/Game';
import { emptySave, KEY } from '../src/games/launch-control/storage';

/**
 * The whole game in jsdom (no WebGL: the 3D stage is skipped, everything else runs): menus, a real
 * head-to-head race driven frame by frame with a fake clock, launching at green and shifting whenever
 * the needle is in the green zone,
 * and the result, money and save that follow.
 */
const host = { report: vi.fn() };
let frames: FrameRequestCallback[] = [];
let now = 0;

beforeEach(() => {
  frames = [];
  now = 1000;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  host.report.mockClear();
});

/** Runs one animation frame 1/60 s later. */
function tick(): void {
  now += 1000 / 60;
  const run = frames;
  frames = [];
  for (const cb of run) cb(now);
}

/** Pop-up texts seen during the last race. */
let pops = new Set<string>();

/** Races until the result screen, tapping Space at green and whenever the needle is in the green; returns the taps made. */
function driveRace(opts: { tapWhenHot: boolean; maxFrames?: number } = { tapWhenHot: true }): number {
  let taps = 0;
  let lastTap = -999;
  pops = new Set();
  for (let f = 0; f < (opts.maxFrames ?? 4000); f++) {
    act(() => tick());
    if (!document.querySelector('.lc-race')) break;
    const pop = document.querySelector('.lc-pop')?.textContent;
    if (pop) pops.add(pop);
    if (opts.tapWhenHot && document.querySelector('.lc-race[data-hot="1"], .lc-race[data-state="go"]') && f - lastTap > 6) {
      act(() => {
        fireEvent.keyDown(window, { code: 'Space', key: ' ' });
      });
      taps++;
      lastTap = f;
    }
  }
  return taps;
}

function startLadderRace(): void {
  fireEvent.click(screen.getByRole('button', { name: /^Race\s*Next/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Race Dizzy Dee/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm race' }));
}

describe('Launch Control: a full ladder race', () => {
  it('goes hub → rival → setup → race → result, pays out and saves', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect(screen.getByText('Next: Dizzy Dee · Street')).toBeTruthy();
    startLadderRace();
    expect(host.report).toHaveBeenCalledWith({ type: 'start' });
    expect(document.querySelector('.lc-race')).toBeTruthy();
    const taps = driveRace();
    expect(taps).toBeGreaterThanOrEqual(4);
    expect(pops.has('PERFECT!')).toBe(true);
    expect(pops.has('PERFECT LAUNCH!')).toBe(true);
    // the result: five cars in order, our times, a purse
    const rows = document.querySelectorAll('.lc-order li');
    expect(rows).toHaveLength(2);
    expect(document.querySelector('.lc-times')?.textContent).toMatch(/3\/3 perfect/);
    expect(document.querySelector('.lc-ledger')?.textContent).toMatch(/Purse/);
    const end = host.report.mock.calls.map((c) => c[0]).find((e) => e.type === 'end');
    expect(end.stats.perfect).toBe(3);
    expect(end.score).toBeGreaterThan(5000);
    // a clean run in the starter car wins the first rung: rank 1, cash up, parts worn
    expect(screen.getByRole('heading', { name: 'You won!' })).toBeTruthy();
    const save = JSON.parse(localStorage.getItem(KEY)!);
    expect(save.rank).toBe(1);
    expect(save.cash).toBeGreaterThan(800);
    expect(save.cars.bumble.cond.tyres).toBeLessThan(100);
    // next rival is offered
    expect(screen.getByRole('button', { name: 'Next rival' })).toBeTruthy();
  });

  it('a driver who never shifts sits on the limiter and loses', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    startLadderRace();
    driveRace({ tapWhenHot: false });
    expect(screen.queryByRole('heading', { name: 'You won!' })).toBeNull();
    const end = host.report.mock.calls.map((c) => c[0]).find((e) => e.type === 'end');
    expect(end.stats.perfect).toBe(0);
    expect(JSON.parse(localStorage.getItem(KEY)!).rank).toBe(0);
  });

  it('a stray tap right after the start is ignored, not an early shift', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    startLadderRace();
    // run until the car has launched, then tap at once
    for (let f = 0; f < 1500 && document.querySelector('.lc-clock span')?.textContent === '0.000'; f++) act(() => tick());
    act(() => {
      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    });
    act(() => tick());
    expect(document.querySelector('.lc-gear')?.textContent).toBe('1');
    expect(document.querySelector('.lc-pop')?.textContent).toBe('TOO EARLY');
  });

  it('a tap while the red lights are on is a jump start', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    startLadderRace();
    // the HUD shows the lights coming on, as on the gantry
    for (let f = 0; f < 2000 && Number(document.querySelector('.lc-f1')?.getAttribute('data-on') ?? 0) < 3; f++) act(() => tick());
    expect(document.querySelector('.lc-f1')?.getAttribute('data-show')).toBe('1');
    act(() => {
      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    });
    act(() => tick());
    expect(document.querySelector('.lc-banner')?.textContent).toMatch(/JUMP START/);
    expect(document.querySelector('.lc-race')?.getAttribute('data-state')).toBe('launch');
  });

  it('pause stops the clock; Escape resumes', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    startLadderRace();
    for (let f = 0; f < 300; f++) act(() => tick());
    act(() => {
      fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
    });
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeTruthy();
    const t = document.querySelector('.lc-clock span')?.textContent;
    for (let f = 0; f < 60; f++) act(() => tick());
    expect(document.querySelector('.lc-clock span')?.textContent).toBe(t);
    act(() => {
      fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
    });
    expect(screen.queryByRole('heading', { name: 'Paused' })).toBeNull();
  });
});

describe('Launch Control: daily, garage and wager', () => {
  it('a daily run left mid-race asks first, then counts as a run scored 0', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Daily\s*Showdown/ }));
    fireEvent.click(screen.getByRole('button', { name: /Run \(3 left\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /Run \(3 left\)/ }));
    for (let f = 0; f < 120; f++) act(() => tick());
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave the race' }));
    expect(screen.getByText(/Leaving counts as one of today’s 3 runs/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
    expect(host.report).toHaveBeenCalledWith({ type: 'end', score: 0, stats: {}, daily: true });
    const day = Object.values(JSON.parse(localStorage.getItem(KEY)!).daily)[0] as { tries: number; left: boolean };
    expect(day.tries).toBe(1);
    expect(day.left).toBe(true);
  });

  it('the parts shop sells a level of a part for cash and materials, one tab per part', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Parts shop/ }));
    expect(document.querySelectorAll('.lc-ptab')).toHaveLength(6);
    const panel = (): Element => document.querySelector('.lc-part-panel')!;
    expect(panel().textContent).toMatch(/Engine/);
    expect(panel().textContent).toMatch(/\+9% torque/);
    expect(panel().textContent).toMatch(/Nothing you can see: it all happens under the hood/);
    // preview the next level on the car, then buy it
    fireEvent.click(screen.getByRole('radio', { name: /Preview Lv 1/ }));
    expect(screen.getByRole('radio', { name: /Preview Lv 1/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(panel().querySelector('.lc-upgrade')!);
    expect(panel().textContent).toMatch(/Lv 1\/8/);
    const save = JSON.parse(localStorage.getItem(KEY)!);
    expect(save.cars.bumble.levels.engine).toBe(1);
    expect(save.cash).toBeLessThan(800);
    expect(save.mats.parts).toBeLessThan(6);
    // every part has its own tab and its own visuals
    fireEvent.click(screen.getByRole('tab', { name: /Aero/ }));
    expect(panel().textContent).toMatch(/Pedestal wing/);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /^Parts shop/ })).toBeTruthy();
  });

  it('a part can be inspected on the car: the 3D view takes the pop-up, and it upgrades from there', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Parts shop/ }));
    // the 3D view has its own controls
    expect(screen.getByRole('button', { name: 'Reset the view' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Inspect the engine/ }));
    expect(document.querySelector('.lc-modal')?.classList.contains('is-inspect')).toBe(true);
    const card = screen.getByRole('region', { name: 'Inspecting the engine' });
    expect(card.textContent).toMatch(/Under the hood/);
    // another part's tab inspects that one
    fireEvent.click(screen.getByRole('tab', { name: /Aero/ }));
    const aero = screen.getByRole('region', { name: 'Inspecting the aerodynamics' });
    fireEvent.click(within(aero).getByRole('button', { name: /^Upgrade to Lv 1/ }));
    expect(JSON.parse(localStorage.getItem(KEY)!).cars.bumble.levels.aero).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(document.querySelector('.lc-modal')?.classList.contains('is-inspect')).toBe(false);
    // the garage inspects a part for its repair
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'My garage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect the tyres' }));
    expect(screen.getByRole('region', { name: 'Inspecting the tyres' }).textContent).toMatch(/condition/);
  });

  it('the rival picker shows big cards with one selected, and races the pick', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Race\s*Next/ }));
    const cards = screen.getAllByRole('option');
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(cards.filter((c) => c.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(document.querySelector('.lc-rcard.is-on')?.textContent).toMatch(/Selected/);
    expect(document.querySelector('.lc-rcard.is-on')?.textContent).toMatch(/Dizzy Dee/);
    // locked rivals can't be picked
    const locked = document.querySelector('.lc-rcard.is-locked') as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Race Dizzy Dee/ }));
    expect(screen.getByRole('button', { name: 'Confirm race' })).toBeTruthy();
  });

  it('a lost wager takes the stake; the ledger says so', () => {
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Race\s*Next/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Race Dizzy Dee/ }));
    fireEvent.click(screen.getByRole('radio', { name: /25%/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm race' }));
    expect(JSON.parse(localStorage.getItem(KEY)!).cash).toBe(600);
    driveRace({ tapWhenHot: false });
    expect(document.querySelector('.lc-ledger')?.textContent).toMatch(/Wager/);
    expect(JSON.parse(localStorage.getItem(KEY)!).cash).toBeLessThan(800);
  });
});

describe('Launch Control: the King’s Gauntlet', () => {
  it('is locked until the Street final, then runs round after round and reports the streak as one run', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...emptySave(), rank: 2 }));
    const { unmount } = render(<Game host={host} restartKey={0} pauseKey={0} />);
    expect((screen.getByRole('button', { name: /^King’s Gauntlet/ }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    localStorage.setItem(KEY, JSON.stringify({ ...emptySave(), rank: 8 }));
    render(<Game host={host} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^King’s Gauntlet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Race round 1' }));
    expect(host.report).toHaveBeenCalledWith({ type: 'start' });
    driveRace();
    expect(screen.getByRole('heading', { name: 'Round 1 won!' })).toBeTruthy();
    expect(document.querySelector('.lc-streak')?.textContent).toMatch(/1/);
    // no end yet: the run goes on
    expect(host.report.mock.calls.map((c) => c[0]).some((e) => e.type === 'end')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Next round (2)' }));
    expect(screen.getByRole('button', { name: 'Race round 2' })).toBeTruthy();
    // leaving ends the run: the streak so far is the run on the leaderboard
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    const end = host.report.mock.calls.map((c) => c[0]).find((e) => e.type === 'end');
    expect(end.stats.streak).toBe(1);
    expect(end.score).toBeGreaterThan(5000);
    expect(JSON.parse(localStorage.getItem(KEY)!).gauntletBest).toBe(1);
  });
});

