import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARADES, CHARADES_CATEGORIES } from '../content/charades';
import { draw, freshRng, shuffle, teamTurns } from '../engine';
import type { PartySession } from '../session';
import type { CharadesCard, CharadesCategory, Player } from '../types';
import { Avatar, byId, ModeBar, PassPhone, Results, Timer, useSavedGame, tNodes } from './shared';
import { t } from '../../i18n';

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

type Phase = 'setup' | 'pass' | 'ready' | 'countdown' | 'play' | 'summary' | 'done';

interface Game {
  cfg: Config;
  phase: Phase;
  turn: number;
  /** Player ids of the two teams. */
  teams: [string[], string[]];
  teamScore: [number, number];
  card: CharadesCard | null;
  got: string[];
  skipped: string[];
}

export function CharadesMode({ session, update, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const [r] = useState(freshRng);
  const [game, save] = useSavedGame<Game>(session, update, 'charades', () => ({
    cfg: { teams: session.players.length >= 4, categories: ['movies', 'animals', 'jobs', 'random'], difficulty: 0, style: 'act', seconds: 60, rounds: 1, countdown: 5 },
    phase: 'setup',
    turn: 0,
    teams: [[], []],
    teamScore: [0, 0],
    card: null,
    got: [],
    skipped: [],
  }));
  const { cfg, turn, teamScore, card, got, skipped } = game;
  // Back from a refresh in the middle of a turn: it starts again from "you are up" (the clock restarts).
  const [resumed, setResumed] = useState(() => game.phase === 'countdown' || game.phase === 'play');
  const phase: Phase = resumed ? 'ready' : game.phase;
  const setPhase = (p: Phase): void => save({ phase: p });
  const [peek, setPeek] = useState(true);

  const adult = session.settings.adultConfirmed;
  const deck = useMemo(
    () => CHARADES.filter((c) => cfg.categories.includes(c.category) && (adult || c.category !== 'afterdark') && (cfg.difficulty === 0 || c.difficulty === cfg.difficulty)),
    [cfg.categories, cfg.difficulty, adult],
  );
  const players = session.players;
  const teams = useMemo(() => game.teams.map((ids) => ids.map((id) => byId(players, id)).filter((p): p is Player => !!p)) as [Player[], Player[]], [game.teams, players]);
  // Every turn of the game: teams alternate (A1, B1, A2, B2...) with the same number of turns each,
  // or everyone goes round the circle.
  const actors = useMemo(() => (cfg.teams ? teamTurns(teams, cfg.rounds) : Array.from({ length: cfg.rounds }, () => players).flat()), [cfg.teams, cfg.rounds, teams, players]);
  const totalTurns = actors.length;
  const actor = actors[turn];
  const actorTeam = actor && cfg.teams ? (teams[0].some((p) => p.id === actor.id) ? 0 : 1) : null;

  // The next word, drawn outside the state updaters (React may run an updater twice in development).
  const nextCard = (): CharadesCard | null => {
    const d = draw(deck, session.used.charades ?? [], r);
    setPeek(true);
    update((s) => ({ ...s, used: { ...s.used, charades: d.used } }));
    return d.item;
  };

  const start = (): void => {
    const mixed = shuffle(players, r);
    const half = Math.ceil(mixed.length / 2);
    update((s) => ({ ...s, scores: {} }));
    save({ teams: [mixed.slice(0, half).map((p) => p.id), mixed.slice(half).map((p) => p.id)], teamScore: [0, 0], turn: 0, phase: 'pass' });
  };

  const score = (): void => {
    if (!card || !actor) return;
    if (actorTeam === null) update((s) => ({ ...s, scores: { ...s.scores, [actor.id]: (s.scores[actor.id] ?? 0) + 1 } }));
    navigator.vibrate?.(25);
    const nc = nextCard();
    save((g) => ({ got: [...g.got, card.text], teamScore: actorTeam === null ? g.teamScore : actorTeam === 0 ? [g.teamScore[0] + 1, g.teamScore[1]] : [g.teamScore[0], g.teamScore[1] + 1], card: nc }));
  };
  const skip = (): void => {
    if (!card) return;
    const nc = nextCard();
    save((g) => ({ skipped: [...g.skipped, card.text], card: nc }));
  };
  const heads = cfg.style === 'heads';

  if (phase === 'setup') {
    const set = <K extends keyof Config>(k: K, v: Config[K]): void => save((g) => ({ cfg: { ...g.cfg, [k]: v } }));
    return (
      <div className="pt-screen">
        <ModeBar title={t('Charades')} onExit={onExit} />
        <div className="pt-panel">
          <h3>{t('How do you play?')}</h3>
          <div className="pt-seg" role="radiogroup">
            <button role="radio" aria-checked={!cfg.teams} onClick={() => set('teams', false)}>
              {t('Every player for themselves')}
            </button>
            <button role="radio" aria-checked={cfg.teams} onClick={() => set('teams', true)} disabled={players.length < 4}>
              {t('Two teams')} {players.length < 4 ? t('(4+ players)') : ''}
            </button>
          </div>
          <div className="pt-seg" role="radiogroup" aria-label={t('Style')}>
            {STYLES.map((s) => (
              <button key={s.id} role="radio" aria-checked={cfg.style === s.id} onClick={() => set('style', s.id)}>
                {t(s.label)}
                <small>{t(s.hint)}</small>
              </button>
            ))}
          </div>
          <h3>{t('Categories')}</h3>
          <div className="pt-picker">
            {CHARADES_CATEGORIES.filter((c) => !c.adult || adult).map((c) => {
              const on = cfg.categories.includes(c.id);
              return (
                <button key={c.id} className={`pt-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set('categories', on ? cfg.categories.filter((x) => x !== c.id) : [...cfg.categories, c.id])}>
                  {c.emoji} {t(c.label)}
                </button>
              );
            })}
          </div>
          <div className="pt-grid2">
            <label className="pt-field">
              {t('Difficulty')}
              <select value={cfg.difficulty} onChange={(e) => set('difficulty', Number(e.target.value) as Config['difficulty'])}>
                <option value={0}>{t('Mixed')}</option>
                <option value={1}>{t('Easy')}</option>
                <option value={2}>{t('Medium')}</option>
                <option value={3}>{t('Hard')}</option>
              </select>
            </label>
            <label className="pt-field">
              {t('Time per turn')}
              <select value={cfg.seconds} onChange={(e) => set('seconds', Number(e.target.value))}>
                <option value={30}>30 s</option>
                <option value={60}>60 s</option>
                <option value={90}>90 s</option>
              </select>
            </label>
            <label className="pt-field">
              {t('Get-ready countdown')}
              <select value={cfg.countdown} onChange={(e) => set('countdown', Number(e.target.value) as Config['countdown'])}>
                <option value={0}>{t('None')}</option>
                <option value={5}>5 s</option>
                <option value={10}>10 s</option>
              </select>
            </label>
            <label className="pt-field">
              {t('Turns each')}
              <select value={cfg.rounds} onChange={(e) => set('rounds', Number(e.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
          </div>
          <button className="pt-btn pt-btn-go pt-btn-big" disabled={deck.length < 10} onClick={start}>
            {deck.length < 10 ? t('Pick more categories') : t('Start charades')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done' || turn >= totalTurns || !actor) {
    const scores = cfg.teams ? Object.fromEntries(players.map((p) => [p.id, teamScore[teams[0].some((x) => x.id === p.id) ? 0 : 1]])) : session.scores;
    const best = Math.max(0, ...players.map((p) => session.scores[p.id] ?? 0));
    const champs = players.filter((p) => (session.scores[p.id] ?? 0) === best);
    return (
      <Results
        title={cfg.teams ? (teamScore[0] === teamScore[1] ? t('It’s a tie!') : t('Team {n} wins {a}–{b}!', { n: teamScore[0] > teamScore[1] ? 1 : 2, a: Math.max(...teamScore), b: Math.min(...teamScore) })) : champs.length === 1 ? t('{name} is the charades champion!', { name: champs[0]!.name }) : t('It’s a tie!')}
        players={players}
        scores={scores}
        onAgain={() => setPhase('setup')}
        onMenu={onExit}
      />
    );
  }

  const progress = t('Turn {n}/{total}', { n: turn + 1, total: totalTurns });
  if (phase === 'pass') {
    return (
      <div className="pt-screen">
        <ModeBar title={t('Charades')} progress={progress} onExit={onExit} />
        {cfg.teams && (
          <>
            <p className="pt-score-line">
              {t('Team 1')}{' '}<b>{teamScore[0]}</b> · <b>{teamScore[1]}</b>{' '}{t('Team 2')}
            </p>
            {/* Only the actor's own team guesses, so everyone needs to know the line-up. */}
            <p className="pt-muted pt-center">
              {t('Team {n}', { n: 1 })}: {teams[0].map((p) => p.name).join(', ')} · {t('Team {n}', { n: 2 })}: {teams[1].map((p) => p.name).join(', ')}
            </p>
          </>
        )}
        <PassPhone
          player={actor}
          note={heads ? (cfg.teams ? t('You’re guessing for Team {n}. Don’t look at the words!', { n: actorTeam! + 1 }) : t('You’re guessing. Don’t look at the words!')) : cfg.teams ? t('Acting for Team {n}. Keep the screen to yourself.', { n: actorTeam! + 1 }) : t('Keep the screen to yourself.')}
          onReady={() => save({ got: [], skipped: [], card: nextCard(), phase: 'ready' })}
        />
      </div>
    );
  }

  if (phase === 'ready' && card) {
    return (
      <div className="pt-screen">
        <ModeBar title={t('Charades')} progress={progress} onExit={onExit} />
        <div className="pt-panel pt-center">
          <Avatar player={actor} size={64} />
          <h3>{t('{name}, you are up', { name: actor.name })}</h3>
          {heads ? (
            <p className="pt-muted">
              {tNodes('Hold the phone on your forehead, screen facing out, and guess the word from everyone’s acting. {down} when you get it, {up} to pass (or tap the right or left side). You have {n} seconds.', { n: cfg.seconds }, { down: <b>{t('Nod down')}</b>, up: <b>{t('tilt up')}</b> })}
            </p>
          ) : (
            <p className="pt-muted">{t(STYLES.find((s) => s.id === cfg.style)!.hint)}. {t('Tap ✓ when they get it, Skip if stuck. You have {n} seconds.', { n: cfg.seconds })}</p>
          )}
          <button
            className="pt-btn pt-btn-go pt-btn-big"
            onClick={() => {
              if (heads) askTiltPermission();
              setResumed(false);
              setPhase(cfg.countdown ? 'countdown' : 'play');
            }}
          >
            {cfg.countdown ? t('Start ({n} s to get ready)', { n: cfg.countdown }) : t('Start the clock')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'countdown' && card) {
    return (
      <div className="pt-screen">
        <ModeBar title={t('Charades')} progress={progress} onExit={onExit} />
        <GetReady seconds={cfg.countdown} note={heads ? 'Phone on your forehead, screen facing out' : 'Keep the screen to yourself'} onGo={() => setPhase('play')} />
      </div>
    );
  }

  if (phase === 'play' && card && heads) {
    return (
      <div className="pt-screen">
        <ModeBar title={t('Charades')} progress={progress} onExit={onExit} />
        {/* The whole screen, over the site's header and tab bar, so the word stays big in landscape too. */}
        <div className="pt-heads-play">
          <Timer seconds={cfg.seconds} onEnd={() => setPhase('summary')} onTick={(l) => l <= 3 && (beep(520), navigator.vibrate?.(60))} />
          <Forehead key={`${got.length}:${skipped.length}`} word={card.text} onGot={score} onPass={skip} />
          <p className="pt-muted pt-center">{t('Got {n} so far', { n: got.length })}</p>
        </div>
      </div>
    );
  }

  if (phase === 'play' && card) {
    return (
      <div className="pt-screen">
        <ModeBar title={t('Charades')} progress={progress} onExit={onExit} />
        <Timer seconds={cfg.seconds} onEnd={() => setPhase('summary')} onTick={(l) => l <= 3 && navigator.vibrate?.(60)} />
        <div className="pt-charade">
          <span className="pt-kind">
            {CHARADES_CATEGORIES.find((c) => c.id === card.category)?.emoji} {CHARADES_CATEGORIES.find((c) => c.id === card.category)?.label} · {'★'.repeat(card.difficulty)}
          </span>
          {cfg.style === 'draw' && !peek ? (
            <button className="pt-peek" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>
              {t('Hold to peek at the word')}
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
            {t('Skip')}
          </button>
          <button className="pt-btn pt-btn-go pt-btn-yes" onClick={score}>
            {t('✓ Got it')}
          </button>
        </div>
        <p className="pt-muted pt-center">{t('Got {n} so far', { n: got.length })}</p>
      </div>
    );
  }

  // summary
  return (
    <div className="pt-screen">
      <ModeBar title={t('Charades')} progress={progress} onExit={onExit} />
      <div className="pt-panel pt-center">
        <h3>{t('Time! {name} got {n}', { name: actor.name, n: got.length })}</h3>
        {got.length > 0 && <p>✓ {got.join(' · ')}</p>}
        {skipped.length > 0 && <p className="pt-muted">{t('Skipped:')} {skipped.join(' · ')}</p>}
        {cfg.teams && (
          <p className="pt-score-line">
            {t('Team 1')}{' '}<b>{teamScore[0]}</b> · <b>{teamScore[1]}</b>{' '}{t('Team 2')}
          </p>
        )}
        <button
          className="pt-btn pt-btn-go pt-btn-big"
          onClick={() => save({ turn: turn + 1, phase: turn + 1 >= totalTurns ? 'done' : 'pass' })}
        >
          {turn + 1 >= totalTurns ? t('See results') : t('Next player')}
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
      <p className="pt-kicker">{t('Get ready')}</p>
      <span key={left} className="pt-getready-n">
        {left}
      </span>
      <p className="pt-muted">{note}</p>
      <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => go.current()}>
        {t('Start now')}
      </button>
    </div>
  );
}

/**
 * How much the screen faces up, from the device's tilt: 1 flat on its back, -1 face down, 0 upright
 * (whether the phone is held in portrait or landscape). Null without a motion sensor.
 */
export function screenFacing(beta: number | null, gamma: number | null): number | null {
  if (beta === null) return null;
  const rad = Math.PI / 180;
  return Math.cos(beta * rad) * Math.cos((gamma ?? 0) * rad);
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
  // Tilt, in portrait or landscape: `facing` is how much the screen faces the ceiling (1) or the floor
  // (-1); held upright it is about 0. A nod only counts again once the phone is back upright.
  useEffect(() => {
    let armed = false;
    const on = (e: DeviceOrientationEvent): void => {
      const facing = screenFacing(e.beta, e.gamma);
      if (facing === null) return;
      if (Math.abs(facing) < 0.5) armed = true;
      else if (armed && facing <= -0.8) {
        armed = false;
        answer('got');
      } else if (armed && facing >= 0.8) {
        armed = false;
        answer('pass');
      }
    };
    window.addEventListener('deviceorientation', on);
    return () => window.removeEventListener('deviceorientation', on);
  }, [answer]);
  return (
    <div className={`pt-heads${flash ? ` is-${flash}` : ''}`}>
      <button className="pt-heads-zone is-pass" onClick={() => answer('pass')} aria-label={t('Pass')}>
        <span>{t('⬆ Pass')}</span>
      </button>
      <button className="pt-heads-zone is-got" onClick={() => answer('got')} aria-label={t('Got it')}>
        <span>{t('Got it ⬇')}</span>
      </button>
      <p className="pt-heads-word" aria-live="polite">
        {flash === 'got' ? t('✓ Got it!') : flash === 'pass' ? t('Pass') : word}
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
        {t('Clear')}
      </button>
    </div>
  );
}
