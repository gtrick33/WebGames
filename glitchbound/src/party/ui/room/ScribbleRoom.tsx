import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { TIER_MULT, TIER_NAMES, type Tier } from '../../content/scribble';
import { COLORS, ERASER, H, SIZES, W, type Op } from '../../scribble';
import { CHAT_MAX, CLOCKS, LAPS, MIN_PLAYERS, type Action, type Msg, type RoomView } from '../../rooms/scribbleRoom';
import { InkStore, paint, type Painted } from '../scribbleInk';
import { Clock, Dot, RoomFrame, Scores, seatColor, useLeft, type RoomContext } from './RoomFrame';
import { t } from '../../../i18n';
import './Scribble.css';

type Ctx = RoomContext<RoomView, Action> & { ink: InkStore };
type Turn = NonNullable<RoomView['turn']>;

/** Sending the drawer's strokes: at most this often, and in messages the room accepts. */
const FLUSH_MS = 60;
const FLUSH_CHARS = 1400;
const TIER_TONES = ['#8ad13b', '#ffb020', '#ff4f6d'] as const;

export function ScribbleRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [store] = useState(() => new InkStore());
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'Scribble Scramble', emoji: '🖍️', invite: 'Join my Scribble Scramble room: one of us draws, everyone races to guess the word.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.phase === 'lobby' || v.phase === 'result' ? undefined : `${v.count}/${v.total}`)}
      settings={(ctx) => <Settings {...ctx} />}
      onRelay={store.receive}
    >
      {(ctx) => <Game {...ctx} ink={store} />}
    </RoomFrame>
  );
}

function Settings({ view, send }: RoomContext<RoomView, Action>) {
  const s = view.settings;
  const here = view.players.filter((p) => p.online).length;
  const set = (settings: Partial<RoomView['settings']>): void => send({ t: 'settings', settings });
  return (
    <>
      <h3>{t('How it works')}</h3>
      <ol className="sc-how">
        <li>
          <b>🖍️</b> {t('Each turn one player picks a word: Easy, Medium or Hard. Harder words score more.')}
        </li>
        <li>
          <b>✏️</b> {t('They draw it live, and everyone else sees it appear on their own phone.')}
        </li>
        <li>
          <b>⚡</b> {t('Type your guesses. The faster you get it, the more points; the drawer scores for everyone who does.')}
        </li>
      </ol>
      <div className="pt-picker" role="group" aria-label={t('Rounds')}>
        {LAPS.map((k) => (
          <button key={k} className={`pt-chip${s.laps === k ? ' is-on' : ''}`} aria-pressed={s.laps === k} onClick={() => set({ laps: k })}>
            {k === 1 ? t('Everyone draws once') : t('Everyone draws {n}×', { n: k })} ({t('{n} turns', { n: here * k })})
          </button>
        ))}
      </div>
      <p className="pt-label">{t('Time to draw')}</p>
      <div className="pt-seg" role="radiogroup">
        {CLOCKS.map((c) => (
          <button key={c} role="radio" aria-checked={s.clock === c} onClick={() => set({ clock: c })}>
            ⏱ {c}s
          </button>
        ))}
      </div>
      <label className="pt-switch">
        <input type="checkbox" checked={s.hints} onChange={(e) => set({ hints: e.target.checked })} />
        <span>
          <b>{t('Letter hints')}</b> {t('· letters of the word show as the clock runs down')}
        </span>
      </label>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={here < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        {t('Start')}
      </button>
    </>
  );
}

function Game(ctx: Ctx) {
  const { view, send, me, ink } = ctx;
  const turn = view.turn;
  const drawing = !!turn && turn.drawer === me.n && view.phase === 'draw';

  // A new turn starts on a blank canvas; a phone that is missing strokes asks for the drawing.
  const synced = useRef(0);
  useSyncExternalStore(ink.subscribe, () => `${ink.turn}:${ink.ops.length}:${ink.behind}:${ink.full}`);
  useLayoutEffect(() => {
    if (ink.turn !== view.count) ink.reset(view.count);
  }, [ink, view.count]);
  useEffect(() => {
    const mine = turn?.drawer === me.n;
    const missing = mine ? ink.ops.length === 0 && view.ink > 0 : view.ink > ink.ops.length || ink.behind;
    if (!missing || Date.now() - synced.current < 1500) return;
    synced.current = Date.now();
    send({ t: 'sync' });
  });

  if (view.phase === 'result' || !turn) return <Result {...ctx} />;
  return (
    <div className="sc">
      <Strip view={view} turn={turn} />
      {view.phase === 'choose' ? <Choose {...ctx} turn={turn} /> : <Board {...ctx} turn={turn} drawing={drawing} />}
      <Chat {...ctx} turn={turn} />
    </div>
  );
}

/** Who's playing, their points and who has the word. */
function Strip({ view, turn }: { view: RoomView; turn: Turn }) {
  const ranked = [...view.players].sort((a, b) => b.score - a.score);
  return (
    <ul className="sc-strip" aria-label={t('Scores')}>
      {ranked.map((p) => {
        const hit = turn.hits.find((h) => h.n === p.n);
        return (
          <li key={p.n} className={`${p.n === turn.drawer ? 'is-drawer' : ''}${hit ? ' is-hit' : ''}${p.online ? '' : ' is-away'}`}>
            <Dot p={p} size={30} />
            <span>
              <b>
                {p.name}
                {p.you ? t(' (you)') : ''}
              </b>
              <small className="sc-mono">
                {p.score}
                {hit && <em> +{hit.points}</em>}
              </small>
            </span>
            {p.n === turn.drawer ? <i aria-label={t('Drawing')}>🖍️</i> : hit ? <i aria-label={t('Got it')}>✅</i> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Choose({ view, send, left, byN, me, turn }: Ctx & { turn: Turn }) {
  const drawer = byN(turn.drawer);
  if (turn.drawer !== me.n)
    return (
      <section className="sc-wait pt-panel">
        <p className="sc-big">🤔</p>
        <p className="pt-kicker">{t('{name} is choosing a word…', { name: drawer?.name ?? t('The drawer') })}</p>
        <Clock left={left} />
        {view.host && drawer && !drawer.online && (
          <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
            {t('{name} has gone: skip this turn', { name: drawer.name })}
          </button>
        )}
      </section>
    );
  return (
    <section className="sc-choose pt-panel">
      <p className="pt-kicker">{t('Your turn to draw! Pick a word')}</p>
      <div className="sc-words">
        {(turn.offer ?? []).map((word, i) => (
          <button key={word} className="sc-word" style={{ ['--tone' as string]: TIER_TONES[i] }} onClick={() => send({ t: 'pick', tier: i })}>
            <small>{t(TIER_NAMES[i as Tier])}</small>
            <b>{word}</b>
            <em className="sc-mono">×{TIER_MULT[i as Tier]} {t('points')}</em>
          </button>
        ))}
      </div>
      <Clock left={left} />
    </section>
  );
}

/** The canvas, the word (or its blanks) and the clock; the paint box for the drawer. */
function Board({ view, send, skew, byN, me, ink, turn, drawing }: Ctx & { turn: Turn; drawing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const painted = useRef<Painted | null>(null);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(1);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'fill'>('pen');
  const drawLeft = useLeft(view.phase === 'draw' ? turn.end : null, skew);
  const reveal = view.phase === 'reveal';
  const drawer = byN(turn.drawer);

  // Paint whatever is new (all of it after an undo, a clear or a sync).
  useLayoutEffect(() => {
    const draw = (): void => {
      const c = canvas.current?.getContext('2d', { willReadFrequently: true });
      if (c) painted.current = paint(c, ink.marks, painted.current, ink.version);
    };
    draw();
    return ink.subscribe(draw);
  }, [ink]);

  // The drawer's strokes go out in small batches (and show on their own canvas at once).
  const pending = useRef<Op[]>([]);
  const timer = useRef(0);
  const turnRef = useRef(view.count);
  useEffect(() => {
    turnRef.current = view.count;
  }, [view.count]);
  const flush = (): void => {
    window.clearTimeout(timer.current);
    timer.current = 0;
    while (pending.current.length) {
      const batch: Op[] = [];
      let chars = 0;
      while (pending.current.length && (batch.length === 0 || chars + JSON.stringify(pending.current[0]).length < FLUSH_CHARS)) {
        const op = pending.current.shift()!;
        chars += JSON.stringify(op).length + 1;
        batch.push(op);
      }
      send({ t: 'ink', turn: turnRef.current, ops: batch });
    }
  };
  const emit = (op: Op): void => {
    ink.add([op]);
    // Pen moves join the last one waiting, so a batch stays a handful of ops.
    const last = pending.current[pending.current.length - 1];
    if (op[0] === 1 && last?.[0] === 1 && last.length + op.length < 120) last.push(...op.slice(1));
    else pending.current.push(op);
    if (!timer.current) timer.current = window.setTimeout(flush, FLUSH_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pen = useRef<{ id: number; x: number; y: number } | null>(null);
  const point = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * W);
    const y = Math.round(((e.clientY - r.top) / r.height) * H);
    return [Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y))];
  };
  const down = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!drawing || pen.current) return;
    e.preventDefault();
    const [x, y] = point(e);
    if (tool === 'fill') return emit([2, color, x, y]);
    canvas.current!.setPointerCapture(e.pointerId);
    pen.current = { id: e.pointerId, x, y };
    emit([0, tool === 'eraser' ? ERASER : color, size, x, y]);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const p = pen.current;
    if (!p || e.pointerId !== p.id) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const pts: number[] = [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = point(ev);
      if (Math.abs(x - p.x) + Math.abs(y - p.y) < 3) continue;
      p.x = x;
      p.y = y;
      pts.push(x, y);
    }
    if (pts.length) emit([1, ...pts]);
  };
  const up = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (pen.current?.id !== e.pointerId) return;
    pen.current = null;
    flush();
  };
  // Out of time mid-stroke: the pen lifts.
  useEffect(() => {
    if (!drawing) pen.current = null;
  }, [drawing]);

  return (
    <section className="sc-board">
      <div className="sc-top">
        <p className="sc-who">
          {drawer && <Dot p={drawer} size={26} />}
          {turn.drawer === me.n ? t('You’re drawing') : t('{name} is drawing', { name: drawer?.name ?? '' })}
        </p>
        <p className={`sc-secret${turn.word ? ' is-known' : ''}`} aria-label={turn.word ? t('The word: {word}', { word: turn.word }) : t('The word has {n} letters', { n: (turn.mask ?? '').replace(/ /g, '').length })}>
          {turn.word ?? (turn.mask ?? '').split('').map((ch, i) => <span key={i}>{ch === ' ' ? ' ' : ch}</span>)}
          {turn.tier !== null && <small style={{ background: TIER_TONES[turn.tier] }}>{t(TIER_NAMES[turn.tier])}</small>}
        </p>
        {drawLeft !== null && <p className={`sc-clock sc-mono${drawLeft <= 10 ? ' is-low' : ''}`}>⏱ {drawLeft}</p>}
      </div>
      <div className={`sc-paper${drawing ? ' is-drawing' : ''}${tool === 'fill' && drawing ? ' is-fill' : ''}`}>
        <canvas ref={canvas} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label={drawing ? t('Your canvas: draw the word') : t('The drawing')} role="img" />
        {reveal && <Reveal view={view} turn={turn} byN={byN} />}
        {ink.full && drawing && <p className="sc-full">{t('The canvas is full: undo or clear to keep drawing.')}</p>}
      </div>
      {drawing && (
        <div className="sc-tools">
          <div className="sc-palette" role="radiogroup" aria-label={t('Color')}>
            {COLORS.map((c, i) => (
              <button
                key={c}
                role="radio"
                aria-checked={color === i && tool !== 'eraser'}
                aria-label={t('Color {n}', { n: i + 1 })}
                className={color === i && tool !== 'eraser' ? 'is-on' : ''}
                style={{ background: c }}
                onClick={() => {
                  setColor(i);
                  if (tool === 'eraser') setTool('pen');
                }}
              />
            ))}
          </div>
          <div className="sc-row">
            <div className="sc-sizes" role="radiogroup" aria-label={t('Brush size')}>
              {SIZES.map((px, i) => (
                <button key={px} role="radio" aria-checked={size === i} className={size === i ? 'is-on' : ''} onClick={() => setSize(i)} aria-label={t('Brush size {n}', { n: i + 1 })}>
                  <i style={{ width: Math.max(6, px * 0.8), height: Math.max(6, px * 0.8), background: tool === 'eraser' ? '#fff' : COLORS[color] }} />
                </button>
              ))}
            </div>
            <div className="sc-acts">
              <button className={tool === 'pen' ? 'is-on' : ''} onClick={() => setTool('pen')} aria-pressed={tool === 'pen'} title={t('Brush')}>
                ✏️<span>{t('Brush')}</span>
              </button>
              <button className={tool === 'eraser' ? 'is-on' : ''} onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'} title={t('Eraser')}>
                🧽<span>{t('Eraser')}</span>
              </button>
              <button className={tool === 'fill' ? 'is-on' : ''} onClick={() => setTool('fill')} aria-pressed={tool === 'fill'} title={t('Fill')}>
                🪣<span>{t('Fill')}</span>
              </button>
              <button onClick={() => emit([3])} disabled={!ink.marks.length} title={t('Undo')}>
                ↩️<span>{t('Undo')}</span>
              </button>
              <button onClick={() => emit([4])} disabled={!ink.marks.length} title={t('Clear')}>
                🗑️<span>{t('Clear')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {view.host && view.phase === 'draw' && drawer && !drawer.online && (
        <button className="pt-btn pt-btn-sm pt-btn-ghost" onClick={() => send({ t: 'next' })}>
          {t('{name} has gone: show the word', { name: drawer.name })}
        </button>
      )}
    </section>
  );
}

function Reveal({ view, turn, byN }: { view: RoomView; turn: Turn; byN: Ctx['byN'] }) {
  const gained = Object.entries(turn.gained ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="sc-reveal" role="status">
      <small>{t('The word was')}</small>
      <b>{turn.word}</b>
      {gained.length ? (
        <ul>
          {gained.map(([n, pts]) => {
            const p = byN(Number(n));
            return p ? (
              <li key={n}>
                <Dot p={p} size={22} /> {p.name}
                {Number(n) === turn.drawer ? ' 🖍️' : ''} <em className="sc-mono">+{pts}</em>
              </li>
            ) : null;
          })}
        </ul>
      ) : (
        <p>{t('Nobody got it this time!')}</p>
      )}
      <p className="sc-next sc-mono">{view.count >= view.total ? t('Final scores next…') : t('Next turn in a moment…')}</p>
    </div>
  );
}

function Chat({ view, send, me, byN, turn }: Ctx & { turn: Turn }) {
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLOListElement>(null);
  const isDrawer = turn.drawer === me.n;
  const gotIt = turn.hits.some((h) => h.n === me.n);
  const guessing = view.phase === 'draw' && !isDrawer && !gotIt;
  const last = view.chat[view.chat.length - 1]?.id;
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [last]);
  const submit = (): void => {
    const text = draft.trim();
    if (!text) return;
    send({ t: 'say', text });
    setDraft('');
  };
  const placeholder = guessing ? t('Type your guess…') : view.phase === 'draw' ? (isDrawer ? t('Chat with those who got it') : t('You got it! Chat with the others who did')) : t('Say something…');
  return (
    <section className="sc-chat" aria-label={t('Guesses and chat')}>
      <form
        className="sc-say"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={draft}
          maxLength={CHAT_MAX}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={guessing ? 'is-guess' : ''}
        />
        <button className="pt-btn pt-btn-go" disabled={!draft.trim()}>
          {guessing ? t('Guess') : t('Send')}
        </button>
      </form>
      <ol className="sc-log" ref={log} aria-live="polite">
        {view.chat.map((m) => (
          <Line key={m.id} m={m} byN={byN} />
        ))}
      </ol>
    </section>
  );
}

function Line({ m, byN }: { m: Msg; byN: Ctx['byN'] }) {
  const p = m.n ? byN(m.n) : undefined;
  if (m.kind === 'hit') return <li className="sc-line is-hit">✅ {t('{name} guessed the word!', { name: p?.name ?? '?' })}</li>;
  if (m.kind === 'near') return <li className="sc-line is-near">🔥 {m.text}</li>;
  if (m.kind === 'note') return <li className="sc-line is-note">{m.text}</li>;
  return (
    <li className={`sc-line${m.to ? ' is-inner' : ''}`}>
      <b style={{ color: p ? seatColor(p.n) : undefined }}>{p?.name ?? '?'}</b> {m.text}
    </li>
  );
}

function Result({ view, send }: Ctx) {
  const ranked = [...view.players].filter((p) => view.playing.includes(p.n)).sort((a, b) => (view.points[String(b.n)] ?? 0) - (view.points[String(a.n)] ?? 0));
  const top = view.points[String(ranked[0]?.n)] ?? 0;
  const winners = ranked.filter((p) => (view.points[String(p.n)] ?? 0) === top);
  return (
    <section className="pt-panel pt-imp-result sc-result">
      <p className="sc-big" aria-hidden="true">
        🏆
      </p>
      <h2>
        {top === 0
          ? t('Nobody scored this time. Bolder lines next game?')
          : winners.length === 1
            ? winners[0]!.you
              ? t('You’re the Scribble champ!')
              : t('{name} is the Scribble champ!', { name: winners[0]!.name })
            : t('🏆 A tie: {names}', { names: winners.map((p) => p.name).join(' & ') })}
      </h2>
      <Scores players={view.players} gained={view.points} />
      {view.host ? (
        <div className="pt-row">
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'start' })}>
            {t('Play again')}
          </button>
          <button className="pt-btn" onClick={() => send({ t: 'lobby' })}>
            {t('Settings')}
          </button>
        </div>
      ) : (
        <p className="pt-muted pt-center">{t('The host starts the next game.')}</p>
      )}
    </section>
  );
}
