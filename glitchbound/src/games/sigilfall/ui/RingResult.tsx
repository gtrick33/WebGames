import { useEffect, useRef, useState } from 'react';
import { nextRank, rankOf } from '../arena/ranks';
import type { RingReward } from '../arena/rewards';
import { RewardsEarned } from './RingRewards';
import { ABILITIES } from '../arena/abilities';
import type { BestMoment, Fighter, Match } from '../arena/sim';
import type { TrackGain } from '../arena/record';
import { CLASSES } from '../data/classes';
import { iconPicture } from '../render/art/gameIcons';

export interface RatingOutcome {
  before: number;
  after: number;
  /** The best they had reached, before and after this match (ranks are kept). */
  bestBefore: number;
  bestAfter: number;
  rankUp: string | null;
  streak: number;
  /** What the climb has just earned (arena/rewards.ts). */
  rewards?: RingReward[];
}

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const VICTORY_COLORS = ['#ffe39a', '#ffd257', '#ff9a3d', '#ffffff', '#7fe06a', '#8fd8ff', '#ff7ab8'];
const DEFEAT_COLORS = ['#ff5a4a', '#c8324a', '#ff9a5a', '#6a5a60'];

/** What floats behind the result: confetti for a win, embers and ash for a loss. */
function Particles({ kind, burst }: { kind: 'win' | 'loss' | 'draw'; burst: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d');
    if (!g) return;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const size = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
    ro?.observe(c);
    const W = (): number => c.clientWidth || 1;
    const H = (): number => c.clientHeight || 1;
    const colors = kind === 'win' ? VICTORY_COLORS : DEFEAT_COLORS;
    const make = (fromBurst: boolean): { x: number; y: number; vx: number; vy: number; s: number; r: number; vr: number; c: string; life: number } => {
      if (fromBurst) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 320;
        return { x: W() / 2, y: H() * 0.26, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: 3 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, c: colors[Math.floor(Math.random() * colors.length)]!, life: 1.2 + Math.random() };
      }
      if (kind === 'win') return { x: Math.random() * W(), y: -10 - Math.random() * H(), vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 70, s: 3 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 7, c: colors[Math.floor(Math.random() * colors.length)]!, life: 99 };
      return { x: Math.random() * W(), y: H() + Math.random() * H(), vx: (Math.random() - 0.5) * 14, vy: -14 - Math.random() * 34, s: 1 + Math.random() * 2.4, r: 0, vr: 0, c: colors[Math.floor(Math.random() * colors.length)]!, life: 99 };
    };
    const bits = Array.from({ length: kind === 'win' ? 90 : 60 }, () => make(false));
    if (kind === 'win' || burst) for (let i = 0; i < (burst ? 110 : 60); i++) bits.push(make(true));
    let raf = 0;
    let last = performance.now();
    const draw = (dt: number, t: number): void => {
      g.clearRect(0, 0, W(), H());
      for (const b of bits) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.r += b.vr * dt;
        if (b.life < 90) {
          b.life -= dt;
          b.vy += 240 * dt;
          b.vx *= 1 - dt * 1.3;
        }
        if (b.life <= 0) continue;
        if (b.life > 90 && kind === 'win' && b.y > H() + 10) {
          b.y = -10;
          b.x = Math.random() * W();
        }
        if (b.life > 90 && kind !== 'win' && b.y < -10) {
          b.y = H() + 10;
          b.x = Math.random() * W();
        }
        g.globalAlpha = b.life < 90 ? Math.min(1, b.life) : kind === 'win' ? 0.85 : 0.35 + Math.sin(t * 3 + b.x) * 0.3;
        g.fillStyle = b.c;
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.r);
        // confetti turns over in the air
        g.scale(1, b.vr ? Math.abs(Math.cos(b.r * 1.7)) * 0.9 + 0.1 : 1);
        g.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * (b.vr ? 1.5 : 1));
        g.restore();
      }
      g.globalAlpha = 1;
    };
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      draw(dt, now / 1000);
    };
    // one frame at once (for a pane that isn't animating), and on with it unless the player prefers stillness
    draw(0.016, 0);
    if (!still) raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [kind, burst]);
  return <canvas ref={ref} className="rb-rr-bits" aria-hidden="true" />;
}

/** The number rolling from what it was to what it is. */
function useRollingNumber(from: number, to: number): number {
  const [n, setN] = useState(from);
  useEffect(() => {
    const began = performance.now();
    const STEPS = 1100;
    const id = setInterval(() => {
      const u = Math.min(1, (performance.now() - began - 500) / STEPS);
      if (u <= 0) return;
      const eased = 1 - (1 - u) ** 3;
      setN(Math.round(from + (to - from) * eased));
      if (u >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [from, to]);
  return n;
}

/** The climb to the next rank, filling from where it stood to where it stands. */
function RankClimb({ o }: { o: RatingOutcome }) {
  const rank = rankOf(o.bestAfter);
  const next = nextRank(o.bestAfter);
  const share = (best: number): number => (next ? Math.max(0, Math.min(1, (best - rank.at) / (next.at - rank.at))) : 1);
  const [filled, setFilled] = useState(rankOf(o.bestBefore).name === rank.name ? share(o.bestBefore) : 0);
  useEffect(() => {
    const t = setTimeout(() => setFilled(share(o.bestAfter)), 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.bestAfter]);
  return (
    <span className="rb-rr-climb" style={{ ['--r' as string]: rank.color }}>
      <b>{rank.name}</b>
      <span className="rb-rr-climb-bar">
        <i style={{ width: `${filled * 100}%` }} />
      </span>
      <small>{next ? `${next.name} at ${next.at}` : 'The top of the ladder'}</small>
    </span>
  );
}

function Row({ f, top, mine, doll, awards }: { f: Fighter; top: { dmg: number; heal: number }; mine: boolean; doll: string; awards: string[] }) {
  return (
    <div className={`rb-rr-row${mine ? ' is-me' : ''}${f.dead ? ' is-fallen' : ''}`} style={{ ['--c' as string]: CLASSES[f.cls].colors.accent }}>
      <span className="rb-rr-face">
        <img src={doll} alt="" draggable={false} />
      </span>
      <span className="rb-rr-who">
        <b>{f.name}</b>
        <small>
          {CLASSES[f.cls].name}
          {awards.map((a) => (
            <em key={a}>{a}</em>
          ))}
        </small>
      </span>
      <span className="rb-rr-stat is-dmg">
        <i style={{ width: `${top.dmg ? (f.score.dmg / top.dmg) * 100 : 0}%` }} />
        <b>{f.score.dmg.toLocaleString('en-US')}</b>
      </span>
      <span className="rb-rr-stat is-heal">
        <i style={{ width: `${top.heal ? (f.score.heal / top.heal) * 100 : 0}%` }} />
        <b>{f.score.heal.toLocaleString('en-US')}</b>
      </span>
      <span className="rb-rr-num is-combos">{f.score.combos ?? 0}</span>
      <span className="rb-rr-num">{Math.round(f.score.cc)}s</span>
      <span className="rb-rr-num">{f.score.kicks}</span>
    </div>
  );
}

/**
 * The match's best moment: the combo or super that did the most in one landing, whose it was, and what (the plan the
 * owner took up: "a best moment card on the result screen"). Nothing when nobody landed one.
 */
export function bestOf(match: Match): { f: Fighter; best: BestMoment } | null {
  let out: { f: Fighter; best: BestMoment } | null = null;
  for (const f of match.fighters) {
    const best = f.score.best;
    if (best && ABILITIES[best.ab] && best.n > 0 && (!out || best.n > out.best.n)) out = { f, best };
  }
  return out;
}

function BestCard({ match, myId }: { match: Match; myId: number }) {
  const top = bestOf(match);
  if (!top) return null;
  const ab = ABILITIES[top.best.ab]!;
  const heal = ab.role === 'heal' || ab.aim === 'friend' || ab.aim === 'self';
  const who = top.f.id === myId ? 'You' : top.f.name;
  return (
    <p className={`rb-rr-best${top.f.id === myId ? ' is-mine' : ''}`}>
      <img src={iconPicture(ab.icon)} alt="" draggable={false} />
      <span>
        <small>Best moment</small>
        <b>{who}</b> · {top.best.combo ? `${top.best.combo} (${ab.name})` : ab.name}, {top.best.n.toLocaleString('en-US')} {heal ? 'healed' : 'damage'}
      </span>
    </p>
  );
}

/** A match's end: who won, what it did to your standing, and who did what. */
export function RingResult({ match, myId, won, draw, rating, rival, dolls, lesson, track, tutorial, againLabel, onAgain, onSetup, onExit }: { match: Match; myId: number; won: boolean; draw: boolean; rating: RatingOutcome | null; rival?: string; dolls: string[]; lesson?: string | null; track?: TrackGain | null; tutorial?: boolean; againLabel: string; onAgain: () => void; onSetup: () => void; onExit: () => void }) {
  const kind = draw ? 'draw' : won ? 'win' : 'loss';
  // (ready for the keyboard, without scrolling the verdict off the top of a short screen)
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus({ preventScroll: true }), []);
  const shown = useRollingNumber(rating?.before ?? 0, rating?.after ?? 0);
  const change = rating ? rating.after - rating.before : 0;
  const myTeam = match.fighters[myId]?.team ?? 0;
  const teams = [myTeam, myTeam === 0 ? 1 : 0] as const;
  const top = { dmg: Math.max(0, ...match.fighters.map((f) => f.score.dmg)), heal: Math.max(0, ...match.fighters.map((f) => f.score.heal)) };
  const award = (pick: (f: Fighter) => number): number | null => {
    const best = match.fighters.reduce((a, b) => (pick(b) > pick(a) ? b : a));
    return pick(best) > 0 ? best.id : null;
  };
  const most = { dmg: award((f) => f.score.dmg), heal: award((f) => f.score.heal), cc: award((f) => f.score.cc), kicks: award((f) => f.score.kicks), combos: award((f) => f.score.combos ?? 0) };
  const awardsOf = (f: Fighter): string[] => [most.dmg === f.id ? 'Most damage' : '', most.heal === f.id ? 'Most healing' : '', most.cc === f.id ? 'Most control' : '', most.kicks === f.id ? 'Most interrupts' : '', most.combos === f.id ? 'Most combos' : ''].filter(Boolean);
  const me = match.fighters[myId];
  const line = draw ? `Nobody left standing after ${clock(match.clock)}.` : `${won ? 'You beat' : 'You fell to'} ${rival ?? 'the other team'} in ${clock(match.clock)}.`;
  return (
    <div className={`rb-rr is-${kind}`} role="dialog" aria-label="Match result">
      <i className="rb-rr-rays" aria-hidden="true" />
      <Particles kind={kind} burst={!!rating?.rankUp} />
      <div className="rb-rr-body">
        <header className="rb-rr-head">
          <h2>{draw ? 'Draw' : won ? 'Victory' : 'Defeat'}</h2>
          <p>{line}</p>
        </header>
        {rating ? (
          <section className="rb-rr-rating" aria-label="Your rating">
            {me && <img className="rb-rr-doll" src={dolls[myId]} alt="" draggable={false} />}
            <span className="rb-rr-number">
              <small>Your rating</small>
              <strong>{shown}</strong>
            </span>
            <span className={`rb-rr-delta ${change > 0 ? 'is-up' : change < 0 ? 'is-down' : ''}`}>
              {change > 0 ? '▲ +' : change < 0 ? '▼ −' : ''}
              {Math.abs(change)}
            </span>
            <RankClimb o={rating} />
            {rating.streak >= 2 && <span className="rb-rr-streak">{rating.streak} wins in a row</span>}
          </section>
        ) : tutorial ? (
          <section className="rb-rr-rating is-friendly is-tutorial">
            <span className="rb-rr-number">
              <small>Tutorial complete</small>
              <strong>You know the Ring now</strong>
            </span>
            <p>Find a real match when you’re ready. If nobody else is looking for one, you fight the computer’s teams, which go easy on a newcomer. The tutorial is under the Tutorial button whenever you want it again.</p>
          </section>
        ) : (
          <section className="rb-rr-rating is-friendly">
            <span className="rb-rr-number">
              <small>A friendly match</small>
              <strong>No rating changed</strong>
            </span>
          </section>
        )}
        <BestCard match={match} myId={myId} />
        {/* what the challenges it finished did to the season track, and what the track gave */}
        {track && (
          <p className={`rb-rr-track${track.rewards.length ? ' is-reward' : ''}`}>
            <img src={iconPicture('scholar_scroll_on_violet')} alt="" draggable={false} />
            <span>
              <small>Season track</small>
              <b>+{track.gained}</b> · {track.points} points, tier {track.tier}
              {track.rewards.length > 0 && (
                <>
                  {' '}
                  · New: <b>{track.rewards.map((r) => r.name).join(', ')}</b>
                </>
              )}
            </span>
          </p>
        )}
        {lesson && (
          <p className="rb-rr-lesson">
            <b>Try this next time:</b> {lesson}
          </p>
        )}
        {rating?.rankUp && (
          <p className="rb-rr-rankup">
            <img src={iconPicture('crit_up_status_star_burst_on_gold')} alt="" draggable={false} />
            New rank: <b>{rating.rankUp}</b>
          </p>
        )}
        {rating?.rewards && <RewardsEarned rewards={rating.rewards} />}
        <section className="rb-rr-board" aria-label="Scoreboard">
          <div className="rb-rr-cols" aria-hidden="true">
            <span />
            <span />
            <span>Damage</span>
            <span>Healing</span>
            <span>Combos</span>
            <span>Control</span>
            <span>Interrupts</span>
          </div>
          {teams.map((t, n) => (
            <div key={t} className={`rb-rr-team ${n === 0 ? 'is-ours' : 'is-theirs'}`}>
              <h3>{n === 0 ? 'Your team' : 'Their team'}</h3>
              {match.fighters
                .filter((f) => f.team === t)
                .map((f) => (
                  <Row key={f.id} f={f} top={top} mine={f.id === myId} doll={dolls[f.id] ?? ''} awards={awardsOf(f)} />
                ))}
            </div>
          ))}
        </section>
        <footer className="rb-rr-foot">
          <button ref={again} className="rb-btn is-gold is-big" onClick={onAgain}>
            {againLabel}
          </button>
          <button className="rb-btn" onClick={onSetup}>
            Change my setup
          </button>
          <button className="rb-btn is-ghost" onClick={onExit}>
            Back to the lobby
          </button>
        </footer>
      </div>
    </div>
  );
}
