import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARADES, CHARADES_CATEGORIES } from '../content/charades';
import { draw, freshRng, shuffle } from '../engine';
import type { PartySession } from '../session';
import type { CharadesCard, CharadesCategory, Player } from '../types';
import { Avatar, ModeBar, PassPhone, Results, Timer } from './shared';

type Style = 'act' | 'clues' | 'draw' | 'heads';
const STYLES: { id: Style; label: string; hint: string }[] = [
  { id: 'act', label: '🤐 Act it', hint: 'No talking, no sounds' },
  { id: 'clues', label: '🗣️ Clues', hint: 'Talk, but never say the word' },
  { id: 'draw', label: '✏️ Draw it', hint: 'Sketch on the phone, no letters' },
  { id: 'heads', label: '📱 Forehead', hint: 'Phone on your forehead, everyone else acts it out' },
];

interface Config {
  teams: boolean;
  categories: CharadesCategory[];
  difficulty: 0 | 1 | 2 | 3;
  style: Style;
  seconds: number;
  rounds: number;
  /** Seconds to get the phone into place before the word shows and the clock starts (0 = none). */
  countdown: 0 | 5 | 10;
}

export function CharadesMode({ session, update, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const [r] = useState(freshRng);
  const [cfg, setCfg] = useState<Config>({ teams: session.players.length >= 4, categories: ['movies', 'animals', 'jobs', 'random'], difficulty: 0, style: 'act', seconds: 60, rounds: 1, countdown: 5 });
  const [phase, setPhase] = useState<'setup' | 'pass' | 'ready' | 'countdown' | 'play' | 'summary' | 'done'>('setup');
  const [turn, setTurn] = useState(0);
  const [teams, setTeams] = useState<[Player[], Player[]]>([[], []]);
  const [teamScore, setTeamScore] = useState<[number, number]>([0, 0]);
  const [card, setCard] = useState<CharadesCard | null>(null);
  const [got, setGot] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [peek, setPeek] = useState(true);

  const adult = session.settings.adultConfirmed;
  const deck = useMemo(
    () => CHARADES.filter((c) => cfg.categories.includes(c.category) && (adult || c.category !== 'afterdark') && (cfg.difficulty === 0 || c.difficulty === cfg.difficulty)),
    [cfg.categories, cfg.difficulty, adult],
  );
  // Actors alternate teams (A1, B1, A2, B2...) or go round the circle.
  const actors = useMemo(() => {
    if (!cfg.teams) return session.players;
    const out: Player[] = [];
    for (let i = 0; i < Math.max(teams[0].length, teams[1].length); i++) {
      if (teams[0][i]) out.push(teams[0][i]!);
      if (teams[1][i]) out.push(teams[1][i]!);
    }
    return out;
  }, [cfg.teams, teams, session.players]);
  const totalTurns = actors.length * cfg.rounds;
  const actor = actors[turn % Math.max(1, actors.length)];
  const actorTeam = actor && cfg.teams ? (teams[0].some((p) => p.id === actor.id) ? 0 : 1) : null;

  const nextCard = (): void => {
    const d = draw(deck, session.used.charades ?? [], r);
    setCard(d.item);
    setPeek(true);
    update((s) => ({ ...s, used: { ...s.used, charades: d.used } }));
  };

  const start = (): void => {
    const mixed = shuffle(session.players, r);
    const half = Math.ceil(mixed.length / 2);
    setTeams([mixed.slice(0, half), mixed.slice(half)]);
    setTeamScore([0, 0]);
    setTurn(0);
    update((s) => ({ ...s, scores: {}, active: { mode: 'charades', data: null } }));
    setPhase('pass');
  };

  const score = (): void => {
    if (!card || !actor) return;
    setGot((g) => [...g, card.text]);
    if (actorTeam !== null) setTeamScore((t) => (actorTeam === 0 ? [t[0] + 1, t[1]] : [t[0], t[1] + 1]));
    else update((s) => ({ ...s, scores: { ...s.scores, [actor.id]: (s.scores[actor.id] ?? 0) + 1 } }));
    navigator.vibrate?.(25);
    nextCard();
  };
  const skip = (): void => {
    if (!card) return;
    setSkipped((s) => [...s, card.text]);
    nextCard();
  };
  const heads = cfg.style === 'heads';

  if (phase === 'setup') {
    const set = <K extends keyof Config>(k: K, v: Config[K]): void => setCfg({ ...cfg, [k]: v });
    return (
      <div className="pt-screen">
        <ModeBar title="Charades" onExit={onExit} />
        <div className="pt-panel">
          <h3>How do you play?</h3>
          <div className="pt-seg" role="radiogroup">
            <button role="radio" aria-checked={!cfg.teams} onClick={() => set('teams', false)}>
              Every player for themselves
            </button>
            <button role="radio" aria-checked={cfg.teams} onClick={() => set('teams', true)} disabled={session.players.length < 4}>
              Two teams {session.players.length < 4 ? '(4+ players)' : ''}
            </button>
          </div>
          <div className="pt-seg" role="radiogroup" aria-label="Style">
            {STYLES.map((s) => (
              <button key={s.id} role="radio" aria-checked={cfg.style === s.id} onClick={() => set('style', s.id)}>
                {s.label}
                <small>{s.hint}</small>
              </button>
            ))}
          </div>
          <h3>Categories</h3>
          <div className="pt-picker">
            {CHARADES_CATEGORIES.filter((c) => !c.adult || adult).map((c) => {
              const on = cfg.categories.includes(c.id);
              return (
                <button key={c.id} className={`pt-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set('categories', on ? cfg.categories.filter((x) => x !== c.id) : [...cfg.categories, c.id])}>
                  {c.emoji} {c.label}
                </button>
              );
            })}
          </div>
          <div className="pt-grid2">
            <label className="pt-field">
              Difficulty
              <select value={cfg.difficulty} onChange={(e) => set('difficulty', Number(e.target.value) as Config['difficulty'])}>
                <option value={0}>Mixed</option>
                <option value={1}>Easy</option>
                <option value={2}>Medium</option>
                <option value={3}>Hard</option>
              </select>
            </label>
            <label className="pt-field">
              Time per turn
              <select value={cfg.seconds} onChange={(e) => set('seconds', Number(e.target.value))}>
                <option value={30}>30 s</option>
                <option value={60}>60 s</option>
                <option value={90}>90 s</option>
              </select>
            </label>
            <label className="pt-field">
              Get-ready countdown
              <select value={cfg.countdown} onChange={(e) => set('countdown', Number(e.target.value) as Config['countdown'])}>
                <option value={0}>None</option>
                <option value={5}>5 s</option>
                <option value={10}>10 s</option>
              </select>
            </label>
            <label className="pt-field">
              Turns each
              <select value={cfg.rounds} onChange={(e) => set('rounds', Number(e.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
          </div>
          <button className="pt-btn pt-btn-go pt-btn-big" disabled={deck.length < 10} onClick={start}>
            {deck.length < 10 ? 'Pick more categories' : 'Start charades'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done' || turn >= totalTurns || !actor) {
    const scores = cfg.teams ? Object.fromEntries(session.players.map((p) => [p.id, teamScore[teams[0].some((x) => x.id === p.id) ? 0 : 1]])) : session.scores;
    return (
      <Results
        title={cfg.teams ? (teamScore[0] === teamScore[1] ? 'It’s a tie!' : `Team ${teamScore[0] > teamScore[1] ? 1 : 2} wins ${Math.max(...teamScore)}–${Math.min(...teamScore)}!`) : 'Charades champion!'}
        players={session.players}
        scores={scores}
        onAgain={() => setPhase('setup')}
        onMenu={onExit}
      />
    );
  }

  const progress = `Turn ${turn + 1}/${totalTurns}`;
  if (phase === 'pass') {
    return (
      <div className="pt-screen">
        <ModeBar title="Charades" progress={progress} onExit={onExit} />
        {cfg.teams && (
          <p className="pt-score-line">
            Team 1 <b>{teamScore[0]}</b> · <b>{teamScore[1]}</b> Team 2
          </p>
        )}
        <PassPhone
          player={actor}
          note={heads ? `You’re guessing${cfg.teams ? ` for Team ${actorTeam! + 1}` : ''}. Don’t look at the words!` : cfg.teams ? `Acting for Team ${actorTeam! + 1}. Keep the screen to yourself.` : 'Keep the screen to yourself.'}
          onReady={() => {
            setGot([]);
            setSkipped([]);
            nextCard();
            setPhase('ready');
          }}
        />
      </div>
    );
  }

  if (phase === 'ready' && card) {
    return (
      <div className="pt-screen">
        <ModeBar title="Charades" progress={progress} onExit={onExit} />
        <div className="pt-panel pt-center">
          <Avatar player={actor} size={64} />
          <h3>{actor.name}, you are up</h3>
          {heads ? (
            <p className="pt-muted">
              Hold the phone on your forehead, screen facing out, and guess the word from everyone’s acting. <b>Nod down</b> when you get it, <b>tilt up</b> to pass (or tap the right or left side). You have {cfg.seconds} seconds.
            </p>
          ) : (
            <p className="pt-muted">{STYLES.find((s) => s.id === cfg.style)!.hint}. Tap ✓ when they get it, Skip if stuck. You have {cfg.seconds} seconds.</p>
          )}
          <button
            className="pt-btn pt-btn-go pt-btn-big"
            onClick={() => {
              if (heads) askTiltPermission();
              setPhase(cfg.countdown ? 'countdown' : 'play');
            }}
          >
            {cfg.countdown ? `Start (${cfg.countdown} s to get ready)` : 'Start the clock'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'countdown' && card) {
    return (
      <div className="pt-screen">
        <ModeBar title="Charades" progress={progress} onExit={onExit} />
        <GetReady seconds={cfg.countdown} note={heads ? 'Phone on your forehead, screen facing out' : 'Keep the screen to yourself'} onGo={() => setPhase('play')} />
      </div>
    );
  }

  if (phase === 'play' && card && heads) {
    return (
      <div className="pt-screen">
        <ModeBar title="Charades" progress={progress} onExit={onExit} />
        <Timer seconds={cfg.seconds} onEnd={() => setPhase('summary')} onTick={(l) => l <= 3 && (beep(520), navigator.vibrate?.(60))} />
        <Forehead key={`${got.length}:${skipped.length}`} word={card.text} onGot={score} onPass={skip} />
        <p className="pt-muted pt-center">Got {got.length} so far</p>
      </div>
    );
  }

  if (phase === 'play' && card) {
    return (
      <div className="pt-screen">
        <ModeBar title="Charades" progress={progress} onExit={onExit} />
        <Timer seconds={cfg.seconds} onEnd={() => setPhase('summary')} onTick={(l) => l <= 3 && navigator.vibrate?.(60)} />
        <div className="pt-charade">
          <span className="pt-kind">
            {CHARADES_CATEGORIES.find((c) => c.id === card.category)?.emoji} {CHARADES_CATEGORIES.find((c) => c.id === card.category)?.label} · {'★'.repeat(card.difficulty)}
          </span>
          {cfg.style === 'draw' && !peek ? (
            <button className="pt-peek" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>
              Hold to peek at the word
            </button>
          ) : (
            <p className="pt-charade-word" onClick={() => cfg.style === 'draw' && setPeek(false)}>
              {card.text}
            </p>
          )}
          {cfg.style === 'draw' && <Sketch key={card.id} onStart={() => setPeek(false)} />}
        </div>
        <div className="pt-row pt-charade-btns">
          <button className="pt-btn pt-btn-skip" onClick={skip}>
            Skip
          </button>
          <button className="pt-btn pt-btn-go pt-btn-yes" onClick={score}>
            ✓ Got it
          </button>
        </div>
        <p className="pt-muted pt-center">Got {got.length} so far</p>
      </div>
    );
  }

  // summary
  return (
    <div className="pt-screen">
      <ModeBar title="Charades" progress={progress} onExit={onExit} />
      <div className="pt-panel pt-center">
        <h3>Time! {actor.name} got {got.length}</h3>
        {got.length > 0 && <p>✓ {got.join(' · ')}</p>}
        {skipped.length > 0 && <p className="pt-muted">Skipped: {skipped.join(' · ')}</p>}
        {cfg.teams && (
          <p className="pt-score-line">
            Team 1 <b>{teamScore[0]}</b> · <b>{teamScore[1]}</b> Team 2
          </p>
        )}
        <button
          className="pt-btn pt-btn-go pt-btn-big"
          onClick={() => {
            setTurn((t) => t + 1);
            setPhase(turn + 1 >= totalTurns ? 'done' : 'pass');
          }}
        >
          {turn + 1 >= totalTurns ? 'See results' : 'Next player'}
        </button>
      </div>
    </div>
  );
}

let audio: AudioContext | null = null;
/** A short beep, so a player with the phone on their forehead hears the countdown and their answers. */
function beep(freq: number, ms = 130): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const t = audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  } catch {
    /* no audio: the screen still shows everything */
  }
}

/** iPhones only report tilt after the player allows it, which has to happen inside a tap. */
function askTiltPermission(): void {
  const ask = (window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined)?.requestPermission;
  if (ask) void ask().catch(() => undefined);
  beep(440, 60); // also unlocks audio inside the tap
}

/** A big get-ready countdown, so the player has time to put the phone in place. Beeps on the last three. */
function GetReady({ seconds, note, onGo }: { seconds: number; note: string; onGo: () => void }) {
  const [left, setLeft] = useState(seconds);
  const go = useRef(onGo);
  useEffect(() => {
    go.current = onGo;
  });
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (left <= 1) {
        beep(880, 260);
        navigator.vibrate?.(120);
        go.current();
      } else {
        if (left <= 4) {
          beep(587);
          navigator.vibrate?.(40);
        }
        setLeft(left - 1);
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return (
    <div className="pt-panel pt-center pt-getready" role="timer" aria-live="assertive">
      <p className="pt-kicker">Get ready</p>
      <span key={left} className="pt-getready-n">
        {left}
      </span>
      <p className="pt-muted">{note}</p>
      <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => go.current()}>
        Start now
      </button>
    </div>
  );
}

/**
 * Forehead: the word faces the room while the guesser holds the phone to their forehead. Nodding down
 * (screen to the floor) scores, tilting up (screen to the ceiling) passes; tapping either half works too.
 */
function Forehead({ word, onGot, onPass }: { word: string; onGot: () => void; onPass: () => void }) {
  const [flash, setFlash] = useState<'got' | 'pass' | null>(null);
  const busy = useRef(false);
  const act = useRef({ onGot, onPass });
  useEffect(() => {
    act.current = { onGot, onPass };
  });
  const answer = useCallback((kind: 'got' | 'pass') => {
    if (busy.current) return;
    busy.current = true;
    setFlash(kind);
    beep(kind === 'got' ? 988 : 330, kind === 'got' ? 180 : 240);
    navigator.vibrate?.(kind === 'got' ? 40 : [30, 60, 30]);
    window.setTimeout(() => (kind === 'got' ? act.current.onGot() : act.current.onPass()), 650);
  }, []);
  // Tilt: upright in portrait the phone reads about 90°; it only counts again once it's back upright.
  useEffect(() => {
    let armed = false;
    const on = (e: DeviceOrientationEvent): void => {
      const b = e.beta;
      if (b === null) return;
      if (b > 60 && b < 120) armed = true;
      else if (armed && (b >= 145 || b <= -150)) {
        armed = false;
        answer('got');
      } else if (armed && b <= 30 && b > -60) {
        armed = false;
        answer('pass');
      }
    };
    window.addEventListener('deviceorientation', on);
    return () => window.removeEventListener('deviceorientation', on);
  }, [answer]);
  return (
    <div className={`pt-heads${flash ? ` is-${flash}` : ''}`}>
      <button className="pt-heads-zone is-pass" onClick={() => answer('pass')} aria-label="Pass">
        <span>⬆ Pass</span>
      </button>
      <button className="pt-heads-zone is-got" onClick={() => answer('got')} aria-label="Got it">
        <span>Got it ⬇</span>
      </button>
      <p className="pt-heads-word" aria-live="polite">
        {flash === 'got' ? '✓ Got it!' : flash === 'pass' ? 'Pass' : word}
      </p>
    </div>
  );
}

/** A tiny drawing pad for "Draw it" charades. */
function Sketch({ onStart }: { onStart: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1d1238';
  }, []);
  const pos = (e: React.PointerEvent): { x: number; y: number } => {
    const b = ref.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  return (
    <div className="pt-sketch">
      <canvas
        ref={ref}
        onPointerDown={(e) => {
          onStart();
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          last.current = pos(e);
        }}
        onPointerMove={(e) => {
          if (!last.current) return;
          const ctx = ref.current!.getContext('2d')!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
        }}
        onPointerUp={() => (last.current = null)}
      />
      <button
        className="pt-btn pt-btn-sm pt-btn-ghost"
        onClick={() => {
          const c = ref.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
        }}
      >
        Clear
      </button>
    </div>
  );
}
