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
import { SoloBattle, type SoloSetup } from './solo';
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
}

const emptySave = (): Save => ({ best: 0, runs: 0, wins: 0, bestDamage: 0, daily: {}, muted: false, char: 'frog', name: '', sk: { terrain: 'random', foes: 2, level: 'normal', size: 2, secs: 30 } });

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
const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
/** Today's battlefield: the terrains take turns, day by day. */
export const dailyTerrain = (day: string): TerrainId => TERRAIN_IDS[(dailyNumber(day) - 1) % TERRAIN_IDS.length]!;
const challengeTerrain = (seed: number): TerrainId => TERRAIN_IDS[seed % TERRAIN_IDS.length]!;

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

interface Result {
  mode: Mode;
  score: number;
  won: boolean;
  dmg: number;
  kills: number;
  line: string;
  best: boolean;
  winner: string;
}

function CraterCrew({ host, pauseKey, challenge, playerName }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec; playerName?: string }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((fn: (s: Save) => Save) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);
  const name = (save.name || playerName || '').trim().slice(0, 20);

  const [room, setRoom] = useState<string | null>(() => (challenge ? null : linkedRoom()));
  const [run, setRun] = useState<{ mode: Mode; setup: SoloSetup; id: number } | null>(() =>
    challenge ? { mode: 'challenge', setup: { seed: challenge.seed, terrain: challengeTerrain(challenge.seed), foes: 2, level: 'normal', crewSize: 2, turnSecs: 30, name: name || 'You', char: save.char }, id: 1 } : null,
  );
  const [result, setResult] = useState<Result | null>(null);
  const [paused, setPaused] = useState(false);

  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (run && !result) setPaused(true);
  }

  const begin = (mode: Mode): void => {
    const sk = saveRef.current.sk;
    const seed = mode === 'daily' ? hashString(`${SLUG}:${today}`) : (Math.random() * 2 ** 32) >>> 0;
    const terrain = mode === 'daily' ? dailyTerrain(today) : sk.terrain === 'random' ? TERRAIN_IDS[seed % TERRAIN_IDS.length]! : sk.terrain;
    const setup: SoloSetup =
      mode === 'daily'
        ? { seed, terrain, foes: 2, level: 'normal', crewSize: 2, turnSecs: 30, name: name || 'You', char: saveRef.current.char }
        : { seed, terrain, foes: sk.foes, level: sk.level, crewSize: sk.size, turnSecs: sk.secs, name: name || 'You', char: saveRef.current.char };
    setResult(null);
    setPaused(false);
    setRun({ mode, setup, id: Date.now() });
  };

  const onOver = (m: Match): void => {
    if (!run || result) return;
    const me = m.crews[0]!;
    const won = m.winner === 0;
    const score = crewScore(m, 0);
    const line = resultLine(won, me.dmg, me.kills);
    const cur = saveRef.current;
    const best = score > cur.best;
    commit((s) => ({
      ...s,
      best: Math.max(s.best, score),
      runs: s.runs + 1,
      wins: s.wins + (won ? 1 : 0),
      bestDamage: Math.max(s.bestDamage, me.dmg),
      daily: run.mode === 'daily' ? { ...s.daily, [today]: { best: Math.max(s.daily[today]?.best ?? 0, score), tries: (s.daily[today]?.tries ?? 0) + 1, line: score >= (s.daily[today]?.best ?? 0) ? line : (s.daily[today]?.line ?? line) } } : s.daily,
    }));
    const end = { type: 'end' as const, score, stats: { damage: me.dmg, kills: me.kills } };
    host.report(run.mode === 'daily' ? { ...end, daily: true } : run.mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    if (won) sfx().win();
    else sfx().lose();
    const w = m.winner !== null && m.winner >= 0 ? m.crews[m.winner]!.name : '';
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
    const daily = save.daily[today];
    const share = `Crater Crew #${dailyNumber(today)} 💥\n${daily?.line ?? result?.line ?? ''}\nBest today: ${daily?.best ?? result?.score ?? 0} (${daily?.tries ?? 1} ${daily?.tries === 1 ? 'try' : 'tries'})\n${location.origin}/games/${SLUG}`;
    return (
      <div className="cc">
        <SoloBattle
          key={run.id}
          setup={run.setup}
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
                <button className="cc-ghost" onClick={() => setRun(null)}>
                  Quit to the menu
                </button>
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
                <ResultLine line={result.line} label={`${result.won ? 'Won' : 'Lost'}, ${result.dmg} damage, ${result.kills} knockouts`} />
                <p className="cc-sub">
                  {result.dmg} damage dealt · {result.kills} {result.kills === 1 ? 'knockout' : 'knockouts'}
                </p>
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
                  <button
                    className="cc-ghost"
                    onClick={() => {
                      setRun(null);
                      setResult(null);
                    }}
                  >
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
              <li>Watch the wind: rockets, splitters and meteors drift with it. Grenades bounce and wait three seconds.</li>
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
