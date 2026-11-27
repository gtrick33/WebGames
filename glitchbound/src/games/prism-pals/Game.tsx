/**
 * Prism Pals: a co-op color platformer. Play live in a room with friends (2 to 4, live.tsx), solo by
 * switching between the pals across 24 levels (progress kept), today's daily level (the same for everyone),
 * or a friends' challenge (one level from the challenge's seed).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ResultLine } from '../../components/ResultLine';
import { openChallengeScores, type ChallengeSpec } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey } from '../../platform/dates';
import { createRoom, roomInfo, seatedName } from '../../platform/rooms';
import { parseLevel } from './level';
import { LEVELS } from './levels';
import { LiveRoom } from './live';
import { Menu, ShareButton } from './menu';
import { Coop, type Clear } from './net';
import { critters, levelScore, packLevels, resultLine, timeBonus } from './rules';
import { createSfx, type Sfx } from './sound';
import { Stage } from './Stage';
import { challengeLevel, dailyLevel, dailyNumber, emptySave, KEY, levelLabel, MAX_ROUNDS, readSave, SLUG, writeSave, type Mode, type Save } from './store';
import './Game.css';

const linkedRoom = (): string | null => {
  const c = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  return /^[A-HJKMNP-Z]{5}$/.test(c) ? c : null;
};
function setRoomInUrl(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(history.state, '', url);
}

export default function Game({ host, restartKey, pauseKey, challenge, playerName }: GameModuleProps) {
  return <PrismPals key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} />;
}

interface Run {
  mode: Mode;
  level: number;
  id: number;
  day: string;
}
interface Result extends Clear {
  mode: Mode;
  level: number;
  score: number;
  line: string;
  best: boolean;
  note?: string;
}

function PrismPals({ host, pauseKey, challenge, playerName }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string }) {
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(() => readSave() ?? emptySave());
  const saveRef = useRef(save);
  // every write starts from what is stored now, so another tab's levels and dailies are kept
  const commit = useCallback((fn: (s: Save) => Save) => {
    const next = fn(readSave() ?? saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const s = readSave();
      if (s) {
        saveRef.current = s;
        setSave(s);
      }
    };
    const refresh = (): void => setToday(dayKey());
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);
  const name = (save.name || playerName || '').trim().slice(0, 20);
  const mute = (): void => commit((s) => ({ ...s, muted: !s.muted }));

  const [room, setRoom] = useState<string | null>(() => (challenge ? null : linkedRoom()));
  const roundKey = challenge ? `${challenge.id}:${challenge.round}` : '';
  const [opening] = useState(() => {
    if (!challenge) return null;
    const daily = challenge.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(challenge.day);
    const level = daily ? dailyLevel(challenge.day) : challengeLevel(challenge.seed);
    const kept = save.ch[roundKey];
    const end: Result | null = kept ? { mode: 'challenge', level, score: kept.score, line: kept.line, gems: kept.gems, secs: 0, tries: 0, best: false, note: 'You already played this round.' } : null;
    return { run: { mode: 'challenge' as Mode, level, id: 1, day: dayKey() }, end };
  });
  const [run, setRun] = useState<Run | null>(() => opening?.run ?? null);
  const [result, setResult] = useState<Result | null>(() => opening?.end ?? null);
  const [paused, setPaused] = useState(false);
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (run && !result) setPaused(true);
  }
  const live = !!run && !result;
  useEffect(() => {
    if (!live) return;
    const hide = (): void => {
      if (document.visibilityState === 'hidden') setPaused(true);
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [live]);

  const begin = (mode: Mode, level: number): void => {
    setToday(dayKey());
    setResult(null);
    setPaused(false);
    setRun({ mode, level, id: Date.now(), day: dayKey() });
  };
  const toMenu = (): void => {
    setToday(dayKey());
    setRun(null);
    setResult(null);
  };

  const onClear = (r: Run, c: Clear): void => {
    const lv = LEVELS[r.level]!;
    const gemsOf = parseLevel(lv).gems.length;
    const score = levelScore(lv.par, c.secs, c.gems, c.tries);
    const line = resultLine(c.secs, c.gems, gemsOf, c.tries);
    const round = r.mode === 'challenge' && challenge ? { id: challenge.id, round: challenge.round } : undefined;
    if (round && readSave()?.ch[roundKey]) return setResult({ ...c, mode: r.mode, level: r.level, score, line, best: false, note: 'You already played this round.' });
    const cur = readSave() ?? saveRef.current;
    const best = score > (cur.levels[r.level]?.best ?? 0);
    const day = r.day;
    let levels = 0;
    commit((s) => {
      const was = s.levels[r.level];
      const lvls = { ...s.levels, [r.level]: { best: Math.max(was?.best ?? 0, score), gems: Math.max(was?.gems ?? 0, c.gems), secs: was?.secs ? Math.min(was.secs, Math.round(c.secs)) : Math.round(c.secs) } };
      levels = Object.keys(lvls).length;
      const d = s.daily[day];
      return {
        ...s,
        best: Math.max(s.best, score),
        runs: s.runs + 1,
        levels: lvls,
        daily: r.mode === 'daily' ? { ...s.daily, [day]: { best: Math.max(d?.best ?? 0, score), tries: (d?.tries ?? 0) + 1, line: score >= (d?.best ?? 0) ? line : (d?.line ?? line) } } : s.daily,
        ch: round ? Object.fromEntries([...Object.entries(s.ch).filter(([k]) => k !== roundKey).slice(-(MAX_ROUNDS - 1)), [roundKey, { score, line, gems: c.gems }]]) : s.ch,
      };
    });
    const end = { type: 'end' as const, score, stats: { levels, gems: c.gems }, ...(r.mode === 'daily' && day === dayKey() ? { daily: true } : {}) };
    host.report(round ? { ...end, challenge: round } : end);
    window.setTimeout(() => setResult({ ...c, mode: r.mode, level: r.level, score, line, best }), 900);
  };

  const openRoom = async (listed: boolean): Promise<string | null> => {
    try {
      const code = await createRoom('prism-pals', listed);
      setRoomInUrl(code);
      setRoom(code);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not open a room. Try again.';
    }
  };
  const joinRoom = async (code: string): Promise<string | null> => {
    const info = await roomInfo(code);
    if (!info || info.game !== 'prism-pals') return 'No Prism Pals room has that code.';
    setRoomInUrl(code);
    setRoom(code);
    return null;
  };

  if (room)
    return (
      <div className="pri" onPointerDown={() => sfx()}>
        <LiveRoom
          key={room}
          code={room}
          name={seatedName(room) ?? name}
          color={save.color}
          sfx={sfx}
          muted={save.muted}
          onMute={mute}
          onLeave={() => {
            setRoomInUrl(null);
            setRoom(null);
          }}
          onRoom={(code) => {
            setRoomInUrl(code);
            setRoom(code);
          }}
        />
      </div>
    );

  if (run) {
    const daily = save.daily[run.day];
    const next = run.mode === 'solo' ? packLevels(critters(run.level)).find((i) => i > run.level) : undefined;
    const share = `Prism Pals #${dailyNumber(run.day)} 🔷\n${daily?.line ?? result?.line ?? ''}\nBest today: ${daily?.best ?? result?.score ?? 0} (${daily?.tries ?? 1} ${daily?.tries === 1 ? 'try' : 'tries'})\n${location.origin}/games/${SLUG}`;
    return (
      <div className="pri">
        <SoloLevel key={run.id} run={run} sfx={sfx} paused={paused || !!result} muted={save.muted} onMute={mute} onPause={() => setPaused((p) => !p)} onStart={() => host.report({ type: 'start' })} onClear={(c) => onClear(run, c)}>
          {paused && !result && (
            <div className="pri-sheet-wrap" role="dialog" aria-label="Paused" onClick={() => setPaused(false)}>
              <div className="pri-sheet" onClick={(e) => e.stopPropagation()}>
                <h2>Paused</h2>
                <p className="pri-sub">Tab or Q switches pals. Every pal has to reach the door.</p>
                <button className="pri-cta" onClick={() => setPaused(false)} autoFocus>
                  Continue
                </button>
                {run.mode !== 'challenge' && (
                  <>
                    <button className="pri-ghost" onClick={() => begin(run.mode, run.level)}>
                      Start the level over
                    </button>
                    <button className="pri-ghost" onClick={toMenu}>
                      Quit to the menu
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {result && (
            <div className="pri-sheet-wrap" role="dialog" aria-label="Result">
              <div className="pri-sheet is-win">
                <h2>{result.note ? 'Level played' : 'Level clear!'}</h2>
                <p className="pri-score">
                  {result.score}
                  <small>points</small>
                </p>
                {result.best && <p className="pri-best">New best!</p>}
                <ResultLine line={result.line} label={`${Math.round(result.secs)} seconds, ${result.gems} gems, ${result.tries} restarts`} />
                {result.note ? (
                  <p className="pri-sub">{result.note}</p>
                ) : (
                  <p className="pri-sub">
                    1000 + {result.gems * 150} for gems + {timeBonus(LEVELS[result.level]!.par, result.secs)} for time{result.tries ? ` − ${result.tries * 50} for restarts` : ''}
                  </p>
                )}
                <div className="pri-actions">
                  {result.mode === 'challenge' && challenge ? (
                    <a className="pri-cta" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                      See the scoreboard
                    </a>
                  ) : next !== undefined ? (
                    <button className="pri-cta" onClick={() => begin('solo', next)} autoFocus>
                      Next level
                    </button>
                  ) : (
                    <button className="pri-cta" onClick={() => begin(result.mode, result.level)} autoFocus>
                      {result.mode === 'daily' ? 'Try again' : 'Play again'}
                    </button>
                  )}
                  {next !== undefined && (
                    <button className="pri-ghost" onClick={() => begin('solo', result.level)}>
                      Play again
                    </button>
                  )}
                  {result.mode === 'daily' && <ShareButton text={share} />}
                  {result.mode !== 'challenge' && (
                    <button className="pri-ghost" onClick={toMenu}>
                      Menu
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SoloLevel>
      </div>
    );
  }

  return <Menu save={save} commit={commit} today={today} name={name} hasSiteName={!!playerName} muted={save.muted} onMute={mute} onPlay={begin} onOpenRoom={openRoom} onJoinRoom={joinRoom} />;
}

/** One level played alone: every pal is yours, Tab switches. */
function SoloLevel({ run, sfx, paused, muted, onMute, onPause, onStart, onClear, children }: { run: Run; sfx: () => Sfx; paused: boolean; muted: boolean; onMute: () => void; onPause: () => void; onStart: () => void; onClear: (c: Clear) => void; children?: React.ReactNode }) {
  const [coop] = useState(() => {
    const lv = parseLevel(LEVELS[run.level]!);
    return new Coop(lv, 1, 1, lv.spawns.map(() => 1), true, () => undefined, () => undefined);
  });
  const title = run.mode === 'daily' ? `Daily #${dailyNumber(run.day)} · ${coop.w.lv.name}` : run.mode === 'challenge' ? `Challenge · ${coop.w.lv.name}` : `${coop.w.lv.n} pals · ${levelLabel(run.level)} · ${coop.w.lv.name}`;
  return (
    <Stage coop={coop} title={title} paused={paused} sfx={sfx} muted={muted} onMute={onMute} onStart={onStart} onPause={onPause} onRestart={() => coop.restart()} onClear={onClear}>
      {children}
    </Stage>
  );
}

