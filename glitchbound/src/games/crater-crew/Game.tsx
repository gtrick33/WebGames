/**
 * Crater Crew: turn-based artillery for crews of critters on destructible ground. Play live in a room
 * with friends (2 to 6 crews, live.tsx), today's daily battle (the same map and opponents for
 * everyone), a skirmish against computer crews on any of the ten terrains, or a friends' challenge.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { OnlinePlay } from '../../components/OnlinePlay';
import { ResultLine } from '../../components/ResultLine';
import { openChallengeScores, type ChallengeSpec } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { createRoom, roomInfo } from '../../platform/rooms';
import { shareOrCopy } from '../../platform/share';
import { CHAR_IDS, CHARS, isCharId, type CharId } from './characters';
import { Portrait, TerrainThumb, WeaponIcon } from './icons';
import { LiveRoom, Seg } from './live';
import { CREW_SIZES, crewScore, isLevel, LEVELS, TURN_TIMES, type Level, type Match } from './match';
import { createSfx, type Sfx } from './sound';
import { resumeMatch, SoloBattle, soloMatch, type SoloSetup } from './solo';
import { isTerrainId, TERRAIN_IDS, TERRAINS, type TerrainId } from './terrains';
import { weaponList } from './weapons';
import './Game.css';

const KEY = 'glitchbound.crater-crew';
const EPOCH = '2026-10-29';
const SLUG = 'crater-crew';
type Mode = 'daily' | 'skirmish' | 'challenge';

interface Skirmish {
  terrain: TerrainId | 'random';
  foes: number;
  level: Level;
  size: number;
  secs: number;
}

/** How a challenge round ended (shown again, never replayed). */
interface RoundEnd {
  score: number;
  won: boolean;
  dmg: number;
  kills: number;
  line: string;
  winner: string;
}

/** A friends' challenge round on this device: the battle so far (to pick up after a reload), or how it ended. */
interface ChallengeRound {
  day: string;
  m?: unknown;
  done?: RoundEnd;
}
const MAX_ROUNDS = 20;

interface Save {
  best: number;
  runs: number;
  wins: number;
  bestDamage: number;
  daily: Record<string, { best: number; tries: number; line: string }>;
  muted: boolean;
  char: CharId;
  name: string;
  sk: Skirmish;
  /** Challenge rounds by `${id}:${round}`, the newest last. */
  ch: Record<string, ChallengeRound>;
}

const emptySave = (): Save => ({ best: 0, runs: 0, wins: 0, bestDamage: 0, daily: {}, muted: false, char: 'frog', name: '', sk: { terrain: 'random', foes: 2, level: 'normal', size: 2, secs: 30 }, ch: {} });

/** Saves are untrusted input: every field is checked. */
function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.runs = n(o.runs);
    s.wins = n(o.wins);
    s.bestDamage = n(o.bestDamage);
    s.muted = o.muted === true;
    s.char = isCharId(o.char) ? o.char : 'frog';
    s.name = typeof o.name === 'string' ? o.name.slice(0, 20) : '';
    const k = o.sk;
    if (k && typeof k === 'object')
      s.sk = {
        terrain: k.terrain === 'random' || isTerrainId(k.terrain) ? k.terrain : 'random',
        foes: [1, 2, 3].includes(k.foes) ? k.foes : 2,
        level: isLevel(k.level) ? k.level : 'normal',
        size: (CREW_SIZES as readonly number[]).includes(k.size) ? k.size : 2,
        secs: (TURN_TIMES as readonly number[]).includes(k.secs) ? k.secs : 30,
      };
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries), line: typeof v.line === 'string' ? v.line.slice(0, 40) : '' };
    if (o.ch && typeof o.ch === 'object')
      for (const [k, v] of Object.entries(o.ch).slice(-MAX_ROUNDS)) {
        if (!v || typeof v !== 'object' || k.length > 120) continue;
        const r: ChallengeRound = { day: typeof v.day === 'string' ? v.day.slice(0, 10) : '' };
        const d = v.done;
        if (d && typeof d === 'object') r.done = { score: n(d.score), won: d.won === true, dmg: n(d.dmg), kills: n(d.kills), line: typeof d.line === 'string' ? d.line.slice(0, 40) : '', winner: typeof d.winner === 'string' ? d.winner.slice(0, 40) : '' };
        else if (v.m && typeof v.m === 'object') r.m = v.m;
        s.ch[k] = r;
      }
    return s;
  } catch {
    return emptySave();
  }
}
const writeSave = (s: Save): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the game still works, nothing is kept */
  }
};
/** Stored saves only: null when there is none (or storage is blocked). */
function storedSave(): Save | null {
  try {
    return localStorage.getItem(KEY) === null ? null : loadSave();
  } catch {
    return null;
  }
}
/** A challenge round's entry, the newest last and the oldest dropped. */
function putRound(ch: Record<string, ChallengeRound>, key: string, r: ChallengeRound): Record<string, ChallengeRound> {
  const rest = Object.entries(ch).filter(([k]) => k !== key);
  return Object.fromEntries([...rest.slice(-(MAX_ROUNDS - 1)), [key, r]]);
}
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
/** Today's battlefield: the terrains take turns, day by day. */
export const dailyTerrain = (day: string): TerrainId => TERRAIN_IDS[(dailyNumber(day) - 1) % TERRAIN_IDS.length]!;
const challengeTerrain = (seed: number): TerrainId => TERRAIN_IDS[seed % TERRAIN_IDS.length]!;
/** A day's daily battle: the same map and computer crews for everyone. */
const dailySetup = (day: string, name: string, char: CharId): SoloSetup => ({ seed: hashString(`${SLUG}:${day}`), terrain: dailyTerrain(day), foes: 2, level: 'normal', crewSize: 2, turnSecs: 30, name, char });

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

/** The spoiler-free result line: won or lost, then a burst per 50 damage and a skull per knockout. */
export function resultLine(won: boolean, dmg: number, kills: number): string {
  return `${won ? '🏆' : '🏳️'} ${'💥'.repeat(Math.min(8, Math.floor(dmg / 50)))}${'💀'.repeat(Math.min(6, kills))}`.trim();
}

export default function Game({ host, restartKey, pauseKey, challenge, playerName }: GameModuleProps) {
  return <CraterCrew key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} playerName={playerName} />;
}

interface Result extends RoundEnd {
  mode: Mode;
  best: boolean;
  /** Why the result shows without a battle (a challenge round already played). */
  note?: string;
}

interface Run {
  mode: Mode;
  setup: SoloSetup;
  id: number;
  /** The day the battle started on (a daily started before midnight stays that day's). */
  day: string;
  /** A daily challenge: the round is also that day's daily. */
  daily?: boolean;
  /** A challenge round picked up again after a reload. */
  resume?: Match | null;
}

function CraterCrew({ host, pauseKey, challenge, playerName }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string }) {
  const [today, setToday] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  // every write starts from what is stored now, so another tab's battles and dailies are kept
  const commit = useCallback((fn: (s: Save) => Save) => {
    const next = fn(storedSave() ?? saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== KEY && e.key !== null) return;
      const s = storedSave();
      if (!s) return;
      saveRef.current = s;
      setSave(s);
    };
    // the menu never shows yesterday's battle
    const refresh = (): void => setToday(dayKey());
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);
  const name = (save.name || playerName || '').trim().slice(0, 20);

  const [room, setRoom] = useState<string | null>(() => (challenge ? null : linkedRoom()));
  const roundKey = challenge ? `${challenge.id}:${challenge.round}` : '';
  // a challenge round: today's daily for a daily challenge, else the challenge's own battle; picked up
  // where it was after a reload, and never played twice
  const [opening] = useState(() => {
    if (!challenge) return null;
    const daily = challenge.mode === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(challenge.day);
    const day = daily ? challenge.day : dayKey();
    const setup: SoloSetup = daily ? dailySetup(day, name || 'You', save.char) : { seed: challenge.seed, terrain: challengeTerrain(challenge.seed), foes: 2, level: 'normal', crewSize: 2, turnSecs: 30, name: name || 'You', char: save.char };
    const kept = save.ch[roundKey];
    const own = daily ? save.daily[day] : undefined;
    let resume: Match | null = null;
    if (!kept?.done && !own && kept?.m) resume = resumeMatch(kept.m, soloMatch(setup));
    const run: Run = { mode: 'challenge', setup, id: 1, day, daily, resume };
    const end: Result | null = kept?.done
      ? { ...kept.done, mode: 'challenge', best: false }
      : own
        ? { mode: 'challenge', score: own.best, won: own.line.startsWith('🏆'), dmg: 0, kills: 0, line: own.line, winner: '', best: false, note: 'You already played this daily: your daily result counts here.' }
        : kept?.m && !resume
          ? { mode: 'challenge', score: 0, won: false, dmg: 0, kills: 0, line: '', winner: '', best: false, note: 'This round was already started.' }
          : null;
    return { run, end, report: !kept?.done && !!end };
  });
  const [run, setRun] = useState<Run | null>(() => opening?.run ?? null);
  const [result, setResult] = useState<Result | null>(() => opening?.end ?? null);
  const [paused, setPaused] = useState(false);
  // a round that can't be played (again) ends at once, reported exactly once
  useEffect(() => {
    if (!challenge || !opening?.report || !opening.end) return;
    const e = opening.end;
    commit((s) => ({ ...s, ch: putRound(s.ch, roundKey, { day: opening.run.day, done: { score: e.score, won: e.won, dmg: e.dmg, kills: e.kills, line: e.line, winner: e.winner } }) }));
    host.report({ type: 'end', score: e.score, stats: { damage: e.dmg, kills: e.kills }, challenge: { id: challenge.id, round: challenge.round } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (run && !result) setPaused(true);
  }
  // leaving the tab pauses the battle (and its turn clock)
  const live = !!run && !result;
  useEffect(() => {
    if (!live) return;
    const hide = (): void => {
      if (document.visibilityState === 'hidden') setPaused(true);
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [live]);

  const ended = useRef(false);
  const begin = (mode: Mode): void => {
    const sk = saveRef.current.sk;
    const day = dayKey();
    setToday(day);
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const terrain = sk.terrain === 'random' ? TERRAIN_IDS[seed % TERRAIN_IDS.length]! : sk.terrain;
    const setup: SoloSetup =
      mode === 'daily' ? dailySetup(day, name || 'You', saveRef.current.char) : { seed, terrain, foes: sk.foes, level: sk.level, crewSize: sk.size, turnSecs: sk.secs, name: name || 'You', char: saveRef.current.char };
    setResult(null);
    setPaused(false);
    ended.current = false;
    setRun({ mode, setup, id: Date.now(), day });
  };
  const toMenu = (): void => {
    setToday(dayKey());
    setRun(null);
    setResult(null);
  };

  // a challenge round keeps the battle after every turn (a reload picks it up there)
  const keepRound = (m: Match): void => {
    if (run?.mode !== 'challenge' || !challenge || m.over) return;
    commit((s) => (s.ch[roundKey]?.done ? s : { ...s, ch: putRound(s.ch, roundKey, { day: run.day, m: { ...m, last: null } }) }));
  };

  const onOver = (m: Match): void => {
    if (!run || result || ended.current) return;
    const me = m.crews[0]!;
    const won = m.winner === 0;
    const score = crewScore(m, 0);
    const line = resultLine(won, me.dmg, me.kills);
    const w = m.winner !== null && m.winner >= 0 ? m.crews[m.winner]!.name : '';
    const round = run.mode === 'challenge' && challenge ? { id: challenge.id, round: challenge.round } : undefined;
    // a challenge round ends once: one that already did (another tab) only shows its result
    const kept = round ? storedSave()?.ch[roundKey]?.done : undefined;
    if (kept) {
      ended.current = true;
      setResult({ ...kept, mode: run.mode, best: false });
      return;
    }
    ended.current = true;
    // the daily (also a daily challenge) is booked on the day it started
    const day = run.day;
    const asDaily = run.mode === 'daily' || !!run.daily;
    const cur = storedSave() ?? saveRef.current;
    const best = score > cur.best;
    commit((s) => ({
      ...s,
      best: Math.max(s.best, score),
      runs: s.runs + 1,
      wins: s.wins + (won ? 1 : 0),
      bestDamage: Math.max(s.bestDamage, me.dmg),
      daily: asDaily ? { ...s.daily, [day]: { best: Math.max(s.daily[day]?.best ?? 0, score), tries: (s.daily[day]?.tries ?? 0) + 1, line: score >= (s.daily[day]?.best ?? 0) ? line : (s.daily[day]?.line ?? line) } } : s.daily,
      ch: round ? putRound(s.ch, roundKey, { day, done: { score, won, dmg: me.dmg, kills: me.kills, line, winner: w } }) : s.ch,
    }));
    const end = { type: 'end' as const, score, stats: { damage: me.dmg, kills: me.kills }, ...(asDaily && day === dayKey() ? { daily: true } : {}) };
    host.report(round ? { ...end, challenge: round } : end);
    if (won) sfx().win();
    else sfx().lose();
    window.setTimeout(() => setResult({ mode: run.mode, score, won, dmg: me.dmg, kills: me.kills, line, best, winner: w }), 900);
  };

  const tools = (
    <>
      <button className="cc-icon" onClick={() => commit((s) => ({ ...s, muted: !s.muted }))} aria-label={save.muted ? 'Sound on' : 'Sound off'}>
        {save.muted ? '🔇' : '🔊'}
      </button>
      <GameMenuButton className="cc-icon" />
    </>
  );

  const openRoom = async (listed: boolean): Promise<string | null> => {
    try {
      const code = await createRoom('crater-crew', listed);
      setRoomInUrl(code);
      setRoom(code);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not open a room. Try again.';
    }
  };
  const joinRoom = async (code: string): Promise<string | null> => {
    const info = await roomInfo(code);
    if (!info || info.game !== 'crater-crew') return 'No Crater Crew room has that code.';
    setRoomInUrl(code);
    setRoom(code);
    return null;
  };

  if (room)
    return (
      <div className="cc" onPointerDown={() => sfx()}>
        <LiveRoom
          code={room}
          name={name}
          sfx={sfx}
          muted={save.muted}
          onMute={() => commit((s) => ({ ...s, muted: !s.muted }))}
          tools={tools}
          onLeave={() => {
            setRoomInUrl(null);
            setRoom(null);
          }}
        />
      </div>
    );

  if (run) {
    const daily = save.daily[run.day];
    const share = `Crater Crew #${dailyNumber(run.day)} 💥\n${daily?.line ?? result?.line ?? ''}\nBest today: ${daily?.best ?? result?.score ?? 0} (${daily?.tries ?? 1} ${daily?.tries === 1 ? 'try' : 'tries'})\n${location.origin}/games/${SLUG}`;
    return (
      <div className="cc">
        <SoloBattle
          key={run.id}
          setup={run.setup}
          resume={run.resume}
          onAdvance={keepRound}
          sfx={sfx}
          paused={paused || !!result}
          onPause={() => setPaused((p) => !p)}
          muted={save.muted}
          onMute={() => commit((s) => ({ ...s, muted: !s.muted }))}
          onStart={() => host.report({ type: 'start' })}
          onOver={onOver}
        >
          {paused && !result && (
            <div className="cc-sheet-wrap" role="dialog" aria-label="Paused" onClick={() => setPaused(false)}>
              <div className="cc-sheet" onClick={(e) => e.stopPropagation()}>
                <h2>Paused</h2>
                <button className="cc-cta" onClick={() => setPaused(false)} autoFocus>
                  Continue
                </button>
                {run.mode !== 'challenge' && (
                  <button className="cc-ghost" onClick={() => begin(run.mode)}>
                    Restart the battle
                  </button>
                )}
                {/* a challenge round has one attempt: no way out of it from here */}
                {run.mode !== 'challenge' && (
                  <button className="cc-ghost" onClick={toMenu}>
                    Quit to the menu
                  </button>
                )}
              </div>
            </div>
          )}
          {result && (
            <div className="cc-sheet-wrap" role="dialog" aria-label="Result">
              <div className={`cc-sheet${result.won ? ' is-win' : ''}`}>
                <h2>{result.won ? 'Victory!' : result.winner ? `${result.winner} wins` : 'A draw'}</h2>
                <p className="cc-score">
                  {result.score}
                  <small>points</small>
                </p>
                {result.best && <p className="cc-best">New best!</p>}
                {result.line && <ResultLine line={result.line} label={`${result.won ? 'Won' : 'Lost'}, ${result.dmg} damage, ${result.kills} knockouts`} />}
                {result.note ? (
                  <p className="cc-sub">{result.note}</p>
                ) : (
                  <p className="cc-sub">
                    {result.dmg} damage dealt · {result.kills} {result.kills === 1 ? 'knockout' : 'knockouts'}
                  </p>
                )}
                <div className="cc-actions">
                  {result.mode === 'challenge' && challenge ? (
                    <a className="cc-cta" href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>
                      See the scoreboard
                    </a>
                  ) : (
                    <button className="cc-cta" onClick={() => begin(result.mode)} autoFocus>
                      {result.mode === 'daily' ? 'Try again' : 'Play again'}
                    </button>
                  )}
                  {result.mode === 'daily' && <ShareButton text={share} />}
                  <button className="cc-ghost" onClick={toMenu}>
                    Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </SoloBattle>
      </div>
    );
  }

  return <Menu save={save} commit={commit} today={today} name={name} hasSiteName={!!playerName} tools={tools} onPlay={begin} onOpenRoom={openRoom} onJoinRoom={joinRoom} />;
}

function Menu({
  save,
  commit,
  today,
  name,
  hasSiteName,
  tools,
  onPlay,
  onOpenRoom,
  onJoinRoom,
}: {
  save: Save;
  commit: (fn: (s: Save) => Save) => void;
  today: string;
  name: string;
  hasSiteName: boolean;
  tools: React.ReactNode;
  onPlay: (m: Mode) => void;
  onOpenRoom: (listed: boolean) => Promise<string | null>;
  onJoinRoom: (code: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const daily = save.daily[today];
  const dt = TERRAINS[dailyTerrain(today)];
  const sk = save.sk;
  const setSk = (p: Partial<Skirmish>): void => commit((s) => ({ ...s, sk: { ...s.sk, ...p } }));
  return (
    <div className="cc">
      <div className="cc-scroll cc-menu">
        <div className="cc-panel is-wide">
          <div className="cc-toprow">
            <span />
            <div className="cc-tools">{tools}</div>
          </div>
          <header className="cc-hero">
            <div className="cc-hero-crew" aria-hidden="true">
              {(['fox', 'frog', 'penguin', 'robot', 'duck'] as const).map((c, i) => (
                <Portrait key={c} char={c} size={i === 2 ? 64 : 48} flip={i > 2} />
              ))}
            </div>
            <h1 className="cc-title">Crater Crew</h1>
            <p className="cc-tagline">Take turns lobbing rockets, grenades and meteors across ground that breaks. Last crew standing wins.</p>
          </header>

          <section className="cc-card">
            <h3>Your critter</h3>
            <div className="cc-chars" role="radiogroup" aria-label="Your critter">
              {CHAR_IDS.map((c) => (
                <button key={c} role="radio" aria-checked={save.char === c} className={`cc-char${save.char === c ? ' is-on' : ''}`} onClick={() => commit((s) => ({ ...s, char: c }))} style={{ ['--c' as string]: CHARS[c].color }}>
                  <Portrait char={c} size={44} />
                  <small>{CHARS[c].name}</small>
                </button>
              ))}
            </div>
            <label className="cc-name">
              <span>Your name in battle</span>
              <input value={save.name} placeholder={hasSiteName ? name : 'Pick a name'} maxLength={20} onChange={(e) => commit((s) => ({ ...s, name: e.target.value }))} />
            </label>
          </section>

          <section className="cc-card cc-online">
            <h3>
              Play with friends <small>live, 2 to 6 crews</small>
            </h3>
            <OnlinePlay game="crater-crew" busyLabel="Opening…" onCreate={onOpenRoom} onJoin={(c) => onJoinRoom(c)} />
            <form
              className="cc-join"
              onSubmit={(e) => {
                e.preventDefault();
                const c = code.trim().toUpperCase();
                if (!/^[A-HJKMNP-Z]{5}$/.test(c)) return setErr('Room codes are five letters.');
                void onJoinRoom(c).then((x) => setErr(x ?? ''));
              }}
            >
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={5} aria-label="Room code" className="cc-mono" />
              <button className="cc-ghost">Join</button>
            </form>
            {err && <p className="cc-err">{err}</p>}
          </section>

          <section className="cc-card cc-daily">
            <TerrainThumb id={dt.id} w={150} h={76} />
            <div>
              <h3>
                Daily battle #{dailyNumber(today)} <small>{dt.name}</small>
              </h3>
              <p className="cc-sub">Your crew of two against two computer crews. Same map, same wind for everyone today.</p>
              {daily && (
                <p className="cc-sub">
                  Best today: <b>{daily.best}</b> ({daily.tries} {daily.tries === 1 ? 'try' : 'tries'}) {daily.line}
                </p>
              )}
              <button className="cc-cta" onClick={() => onPlay('daily')}>
                {daily ? 'Play again' : 'Play today’s battle'}
              </button>
            </div>
          </section>

          <section className="cc-card">
            <h3>Skirmish against the computer</h3>
            <div className="cc-terrains" role="radiogroup" aria-label="Terrain">
              <button role="radio" aria-checked={sk.terrain === 'random'} className={`cc-terrain${sk.terrain === 'random' ? ' is-on' : ''}`} onClick={() => setSk({ terrain: 'random' })}>
                <span className="cc-random" aria-hidden="true">
                  🎲
                </span>
                <b>Random</b>
              </button>
              {TERRAIN_IDS.map((id, i) => (
                <button key={id} role="radio" aria-checked={sk.terrain === id} className={`cc-terrain${sk.terrain === id ? ' is-on' : ''}`} onClick={() => setSk({ terrain: id })} title={TERRAINS[id].blurb}>
                  <TerrainThumb id={id} delay={120 + i * 50} />
                  <b>{TERRAINS[id].name}</b>
                </button>
              ))}
            </div>
            <div className="cc-opts">
              <Seg label="Opponents" values={[1, 2, 3] as const} value={sk.foes as 1 | 2 | 3} fmt={(n) => `${n}`} onPick={(n) => setSk({ foes: n })} />
              <Seg label="Computer" values={LEVELS} value={sk.level} fmt={(l) => l[0]!.toUpperCase() + l.slice(1)} onPick={(l) => setSk({ level: l })} />
              <Seg label="Crew size" values={CREW_SIZES} value={sk.size as 1 | 2 | 3} fmt={(n) => `${n}`} onPick={(n) => setSk({ size: n })} />
              <Seg label="Turn time" values={TURN_TIMES} value={sk.secs as 20 | 30 | 45} fmt={(n) => `${n}s`} onPick={(n) => setSk({ secs: n })} />
            </div>
            <button className="cc-cta" onClick={() => onPlay('skirmish')}>
              Start the skirmish
            </button>
          </section>

          <section className="cc-card cc-how">
            <h3>How to play</h3>
            <ul>
              <li>
                <b>Walk</b> with ← → or the ◀ ▶ buttons, <b>jump</b> with Enter or the JUMP button.
              </li>
              <li>
                <b>Aim</b> by dragging on the map (or ↑ ↓). <b>Hold</b> Space or the fire button for power and let go to shoot.
              </li>
              <li>Watch the wind: rockets, splitters and meteors drift with it. Grenades bounce and wait three seconds. Drop dynamite and you get three seconds to run.</li>
              <li>Knock enemies into the water, lava or space for a quick knockout. After ten rounds the liquid starts rising.</li>
            </ul>
            <div className="cc-arsenal">
              {weaponList().map((w) => (
                <span key={w.id} title={w.hint}>
                  <WeaponIcon w={w.id} size={28} />
                  {w.name}
                </span>
              ))}
            </div>
          </section>

          <p className="cc-totals">
            Battles {save.runs} · Wins {save.wins} · Best score {save.best} · Most damage {save.bestDamage}
          </p>
        </div>
      </div>
    </div>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="cc-ghost" onClick={() => void shareOrCopy({ title: 'Crater Crew', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}
