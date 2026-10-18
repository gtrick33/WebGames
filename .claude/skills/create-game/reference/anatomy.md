# Anatomy of a GlitchBound module game

Distilled from the 11 module games in `glitchbound/src/games/`. `wing-it` is the cleanest full example of every
pattern below; open it alongside this file. `<slug>` = the game's slug, `xx` = its CSS prefix (e.g. `wi`).

```
glitchbound/
  src/games/<slug>/
    DESIGN.md        half-page design note
    Game.tsx         default export: the React component (lazy chunk, loaded on Play)
    Game.css         styles, every class prefixed `xx-`
    logic.ts|sim.ts  pure rules / simulation / generation (seeded, no React, no DOM)
    sound.ts         createSfx(): Web Audio synth effects
    store.ts         (optional) the local save, when it outgrows Game.tsx
    render.ts        (canvas games) drawing, separate from sim
    words.ts / levels.ts / bank/   (content) data files
  tests/<slug>.test.ts
  public/games/<slug>/tile.webp, wide.webp, og.jpg
  src/catalog/games.ts    + registry entry
  src/catalog/modules.ts  + loader line
```

## Shared helpers to reuse (do not re-implement)

| Import | What |
| --- | --- |
| `../../platform/contract` | `GameModuleProps`, `GameHost` |
| `../../platform/challenge` | `ChallengeSpec`, `openChallengeScores` (end-screen link to `/c/<id>`) |
| `../../platform/dates` | `dayKey()` local `YYYY-MM-DD`, `daysBetween(a, b)`, `addDays`, `hashString(s)` → uint32 |
| `../../platform/share` | `shareOrCopy({ title, text })` → `'shared' \| 'copied' \| …` |
| `../../platform/daily` | `currentStreak` etc. for per-game streaks |
| `../../components/ResultLine` | big spoiler-free emoji result line on the end screen (same line as the share text) |

## Seeded RNG (put in logic.ts)

```ts
/** mulberry32: a tiny deterministic RNG, so a seed gives everyone the same round. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Seeds: daily `hashString('<slug>:' + today)`, endless `(Math.random() * 2 ** 32) >>> 0`, challenge `challenge.seed`.

## Game.tsx skeleton

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChallengeSpec } from '../../platform/challenge';
import { openChallengeScores } from '../../platform/challenge';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { dayKey, daysBetween, hashString } from '../../platform/dates';
import { shareOrCopy } from '../../platform/share';
import { ResultLine } from '../../components/ResultLine';
import { /* newRound, step, scoreOf, resultLine … */ } from './logic';
import { createSfx, type Sfx } from './sound';
import './Game.css';

const KEY = 'glitchbound.<slug>';
const EPOCH = 'YYYY-MM-DD'; // release day: daily #1
type Mode = 'daily' | 'endless' | 'challenge';

interface Save {
  best: number;
  runs: number;
  /** Per-day daily record (best + tries, plus what the share line needs). */
  daily: Record<string, { best: number; tries: number }>;
  muted: boolean;
}
const emptySave = (): Save => ({ best: 0, runs: 0, daily: {}, muted: false });

/** Saves are untrusted input: validate every field, keep at most ~60 days. */
function loadSave(): Save {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>;
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    const s = emptySave();
    s.best = n(o.best);
    s.runs = n(o.runs);
    s.muted = o.muted === true;
    if (o.daily && typeof o.daily === 'object')
      for (const [d, v] of Object.entries(o.daily).slice(-60))
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.daily[d] = { best: n(v.best), tries: n(v.tries) };
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

// The arcade bumps restartKey on Restart: keying the inner component resets all state for free.
export default function Game({ host, restartKey, pauseKey, challenge }: GameModuleProps) {
  return <MyGame key={restartKey} host={host} pauseKey={pauseKey} challenge={challenge} />;
}

function MyGame({ host, pauseKey, challenge }: { host: GameHost; pauseKey?: number; challenge?: ChallengeSpec }) {
  const [today] = useState(() => dayKey());
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef(save);
  const commit = useCallback((s: Save) => {
    saveRef.current = s;
    setSave(s);
    writeSave(s);
  }, []);
  // A friends' challenge skips the menu: one round on the challenge's seed.
  const [screen, setScreen] = useState<'menu' | 'play' | 'result'>(challenge ? 'play' : 'menu');
  const [mode, setMode] = useState<Mode>(challenge ? 'challenge' : 'daily');
  const [paused, setPaused] = useState(false);
  const sfxRef = useRef<Sfx | null>(null);
  const sfx = useCallback((): Sfx => (sfxRef.current ??= createSfx(() => saveRef.current.muted)), []);
  useEffect(() => () => sfxRef.current?.dispose(), []);

  const begin = (m: Mode): void => {
    const seed = m === 'challenge' && challenge ? challenge.seed : m === 'daily' ? hashString(`<slug>:${today}`) : (Math.random() * 2 ** 32) >>> 0;
    setMode(m);
    // …build the round from seed…
    setPaused(false);
    setScreen('play');
  };

  // Report 'start' on the first real input of a round (not on opening the menu).
  // host.report({ type: 'start' });

  const finish = (score: number, stats: Record<string, number>): void => {
    const cur = saveRef.current;
    commit({
      ...cur,
      best: Math.max(cur.best, score),
      runs: cur.runs + 1,
      daily: mode === 'daily' ? { ...cur.daily, [today]: { best: Math.max(cur.daily[today]?.best ?? 0, score), tries: (cur.daily[today]?.tries ?? 0) + 1 } } : cur.daily,
    });
    const end = { type: 'end' as const, score, stats }; // stats keys must be declared in the registry
    host.report(mode === 'daily' ? { ...end, daily: true } : mode === 'challenge' && challenge ? { ...end, challenge: { id: challenge.id, round: challenge.round } } : end);
    setScreen('result');
  };

  // The arcade asks for a pause (left full screen / scrolled away): pause timers, loops, music.
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    if (screen === 'play') setPaused(true);
  }

  // Keyboard: listen on window while playing; Escape/P toggles pause; ignore e.repeat for actions.

  if (screen === 'menu') return <Menu /* daily card (#N, today's best/tries), endless card, totals, mute */ />;
  // play: HUD with aria-live, pause button (☰ / II), "Paused · tap to continue" overlay.
  // result: big score, "New best!", <ResultLine line={…} label={…} />, then:
  //   challenge → <a href={`/c/${challenge.id}`} onClick={openChallengeScores} autoFocus>See the scoreboard</a>
  //   otherwise → Play again (autoFocus); daily → Share button; Menu button.
  return null;
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="xx-btn" onClick={() => void shareOrCopy({ title: '<Title>', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}
```

Share text format (daily only, no spoilers, no personal data):

```
<Title> #<N> <emoji>
<emoji result line>
Best today: <best> (<tries> tries)
${window.location.origin}/games/<slug>
```

### Real-time / canvas games (see wing-it)

- Simulation in `sim.ts`: `newSim(seed)`, `step(sim)` at a fixed `STEP` returning events; `render.ts` draws a frame.
- One `requestAnimationFrame` loop in an effect: accumulate `dt` (clamped to 0.1 s), run fixed steps (cap ~24 per
  frame), skip when `paused || document.hidden`, interpolate the draw.
- Size the canvas from a `ResizeObserver` (never read `clientWidth` in the loop); clamp DPR to 2.
- Push HUD values into React state **only when they change**, never every frame.
- Input: `onPointerDown` on the canvas (`touch-action: none`) + window `keydown`.

### DOM / puzzle games (see color-lab, letter-pinch, crosswire)

- State in `useState` + a reducer-like pure `logic.ts`; resume an unfinished daily from the save.
- Buttons are real `<button>`s with `aria-label`s; the board is keyboard-navigable.

## sound.ts

Copy `src/games/wing-it/sound.ts` and change only the effects: a lazily created `AudioContext` (after a user
gesture), `tone(from, to, at, dur, gain, type)` helper, `isMuted()` checked on every sound, `dispose()` closes the
context. No audio files.

## Game.css

```css
/* <Title>: one-line mood of the look. */
.xx {
  --xx-ink: #1d1238;
  position: absolute;
  inset: 0;               /* the stage sizes the game; fill it */
  overflow: hidden;
  font-family: var(--font);
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.xx button { font: inherit; color: inherit; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { /* drop decorative animation */ }
```

Each game has its own look (it does not have to use the site's purple), but stays bold, bright and readable,
with tap targets ≥ 44 px and no layout that breaks at 360 px wide.

## Registry entry (src/catalog/games.ts)

```ts
{
  slug: '<slug>',
  title: '<Title>',
  tagline: '…',                         // ≤ 90 chars
  description: 'Two or three sentences. ' + 'Mention the daily and the modes.',
  categories: ['arcade'],
  moods: ['quick'],
  tags: ['…'],                          // search keywords
  released: 'YYYY-MM-DD',               // today
  accent: 'teal',
  emoji: '🎯',
  art: { tile: '/games/<slug>/tile.webp', wide: '/games/<slug>/wide.webp', alt: 'Describe the art', bg: '#123456' },
  runtime: { kind: 'module' },
  aspect: 'portrait',
  controls: { keyboard: ['…'], touch: ['…'] },
  stats: [{ key: 'score', label: 'Best score' } /*, { key: 'time', label: 'Fastest', unit: 's', lowerIsBetter: true } */],
  highlights: ['Factual bullets only'],
  ownDaily: { label: 'Today’s …' },
  challenge: { label: 'One round on the same …: highest score wins.' },
  daily: [{ metric: 'score', targets: [100, 200, 300], label: 'Score {n} in one <Title> round' }],
  limits: { scorePerSecond: 10, minSeconds: 3 },
},
```

`validateCatalog` (run by tests and build) enforces: kebab slug, unique, tagline ≤ 110, valid date, known
categories, a `score` stat, daily metrics in `stats`, positive targets, `{n}` in daily labels, art paths starting `/`.
