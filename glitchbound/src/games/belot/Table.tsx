/**
 * The Belot table, shared by the single-player game and the live room: four places around a felt
 * table (you at the bottom), the trick in the middle, your hand fanned along the bottom, the bidding
 * bar on your call, the declaration toggle on your first card, the score bar on top. It shows a
 * match (the room's view hides other hands as -1 cards) and reports your calls and cards; it never
 * changes the match itself. Sounds and speech bubbles come from comparing each match with the last.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Level } from './ai';
import { CardBack, CardDefs, CardFace, cardLabel, SuitIcon } from './cards';
import {
  AT,
  declarationsOf,
  isLegalCall,
  legalCalls,
  legalCards,
  NT,
  suitOf,
  teamOf,
  TARGET,
  winningPlay,
  type Call,
  type Card,
  type DealScore,
  type Declaration,
  type Match,
  type Played,
  type Seat,
} from './logic';
import type { Sfx } from './sound';
import { contractName, type Words } from './text';

/** How long a full trick stays on the table, then how long it takes to slide to its winner. */
export const TRICK_HOLD_MS = 1100;
export const TRICK_SLIDE_MS = 420;

/** Screen position of an absolute place for a viewer at `me`: 0 bottom, 1 right, 2 top, 3 left. */
const spot = (place: number, me: number): number => (place - me + 4) % 4;
const SPOT_NAME = ['bottom', 'right', 'top', 'left'] as const;

interface Bubble {
  id: number;
  place: number;
  text: string;
  tone: 'call' | 'pass' | 'contra' | 'decl' | 'belote';
}

export interface TableProps {
  w: Words;
  match: Match;
  /** Your place (-1 when watching: you see the table from place 0, without a hand). */
  me: number;
  names: string[];
  bots?: (Level | null)[];
  away?: boolean[];
  onCall?: (c: Call) => void;
  onPlay?: (card: Card, declare: boolean) => void;
  sfx: () => Sfx;
  /** Inputs off (paused, or a sheet is open). */
  locked?: boolean;
  /** Buttons for the right end of the top bar. */
  tools?: ReactNode;
  /** An overlay over the table (score sheet, end of match). */
  overlay?: ReactNode;
  /** A line under the score (e.g. "Deal 2 of 4"). */
  note?: string;
}

function useSize(): [React.RefObject<HTMLDivElement | null>, { w: number; h: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

const callText = (w: Words, c: Call): string => (c.k === 'pass' ? w.pass : c.k === 'double' ? w.contra : c.k === 'redouble' ? w.recontra : contractName(w, c.c));
const declText = (w: Words, d: Declaration): string => (d.kind === 'carre' ? `${w.decl.carre}` : w.decl[d.kind]);

export function Table({ w, match, me, names, bots, away, onCall, onPlay, sfx, locked, tools, overlay, note }: TableProps) {
  const [rootRef, size] = useSize();
  const view = me < 0 ? 0 : me;
  const d = match.deal;
  const k = d.contract;
  const hand = me >= 0 ? d.hands[me]! : [];
  const myTurn = me >= 0 && d.turn === me && !locked;
  const playing = d.phase === 'playing';
  const bidding = d.phase === 'bidding';
  const legal = myTurn && playing ? legalCards(d, me as Seat) : [];
  const firstCard = playing && d.tricks.length === 0 && me >= 0 && !d.trick.some((p) => p.seat === me);
  const myDecl = firstCard && k !== null && hand.every((c) => c >= 0) ? declarationsOf(hand, k) : [];
  const [declareState, setDeclareState] = useState<{ deal: string; on: boolean }>({ deal: '', on: true });
  const declareOn = declareState.deal === `${match.seed}:${match.dealNo}` ? declareState.on : true;
  const setDeclareOn = (f: (x: boolean) => boolean): void => setDeclareState({ deal: `${match.seed}:${match.dealNo}`, on: f(declareOn) });
  const [focus, setFocus] = useState(0);
  const [peek, setPeek] = useState(false);

  // ---- the trick on show: the one being played, or the one just taken (held, then slid to its winner)
  const lastTaken = d.tricks[d.tricks.length - 1] ?? null;
  const [held, setHeld] = useState<{ n: number; cards: Played[]; winner: number; slide: boolean } | null>(null);
  const [seenTricks, setSeenTricks] = useState(d.tricks.length);
  if (seenTricks !== d.tricks.length) {
    setSeenTricks(d.tricks.length);
    setHeld(d.tricks.length > seenTricks && lastTaken ? { n: d.tricks.length, cards: lastTaken.cards, winner: lastTaken.winner, slide: false } : null);
  }
  useEffect(() => {
    if (!held || held.slide) return;
    const a = window.setTimeout(() => setHeld((h) => (h && h.n === held.n ? { ...h, slide: true } : h)), TRICK_HOLD_MS);
    return () => window.clearTimeout(a);
  }, [held]);
  useEffect(() => {
    if (!held?.slide) return;
    const b = window.setTimeout(() => setHeld((h) => (h && h.n === held.n ? null : h)), TRICK_SLIDE_MS);
    return () => window.clearTimeout(b);
  }, [held]);
  const showHeld = held && d.trick.length === 0;
  const shown: Played[] = d.trick.length ? d.trick : showHeld ? held.cards : [];
  const top = k !== null && d.trick.length ? winningPlay(d.trick, k) : null;

  // ---- bubbles and sounds: what changed since the last match we drew (compared in an effect)
  const dealKey = `${match.seed}:${match.dealNo}`;
  const [bubbles, setBubbles] = useState<(Bubble & { deal: string })[]>([]);
  const prevRef = useRef<Match | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = match;
    if (!prev || prev === match) return;
    const pd = prev.deal;
    const sounds: ((s: Sfx) => void)[] = [];
    const add: Omit<Bubble, 'id'>[] = [];
    const sameDeal = prev.seed === match.seed && prev.dealNo === match.dealNo;
    if (!sameDeal) sounds.push((s) => (s.shuffle(), s.deal(8)));
    else {
      for (const c of d.calls.slice(pd.calls.length)) {
        add.push({ place: c.seat, text: callText(w, c.call), tone: c.call.k === 'pass' ? 'pass' : c.call.k === 'bid' ? 'call' : 'contra' });
        sounds.push(c.call.k === 'pass' ? (s) => s.pass() : c.call.k === 'bid' ? (s) => s.call(spot(c.seat, view)) : (s) => s.contra(c.call.k === 'double' ? 2 : 4));
      }
      if (pd.phase === 'bidding' && d.phase === 'playing') sounds.push((s) => s.deal(4));
      if (d.trick.length + d.tricks.length * 4 > pd.trick.length + pd.tricks.length * 4) sounds.push((s) => s.flick());
      d.declared.forEach((list, place) => {
        if (list.length && !pd.declared[place]!.length) {
          add.push({ place, text: list.map((x) => declText(w, x)).join(' + '), tone: 'decl' });
          sounds.push((s) => s.declare());
        }
      });
      for (const b of d.belotes.slice(pd.belotes.length)) {
        add.push({ place: b.seat, text: `${w.belote}!`, tone: 'belote' });
        sounds.push((s) => s.belote());
      }
      if (d.turn !== pd.turn && d.turn === me && (d.phase === 'bidding' || d.phase === 'playing')) sounds.push((s) => s.turn());
    }
    const s = sfx();
    sounds.forEach((fn, i) => window.setTimeout(() => alive.current && fn(s), i * 60));
    if (sameDeal && d.tricks.length > pd.tricks.length) {
      const winner = d.tricks[d.tricks.length - 1]!.winner;
      window.setTimeout(() => alive.current && sfx().sweep(teamOf(winner) === teamOf(view as Seat)), TRICK_HOLD_MS);
    }
    if (!add.length) return;
    const stamp = Date.now();
    const fresh = add.map((b, i) => ({ ...b, id: stamp + i, deal: dealKey }));
    window.setTimeout(() => alive.current && setBubbles((list) => [...list.filter((x) => x.deal === dealKey && !fresh.some((f) => f.place === x.place)), ...fresh]), 0);
    // calls stay up through the bidding; announcements fade after a moment
    window.setTimeout(() => alive.current && setBubbles((list) => list.filter((x) => !fresh.some((f) => f.id === x.id && (f.tone === 'decl' || f.tone === 'belote')))), 2600);
  }, [match, d, dealKey, me, view, w, sfx]);
  // only this deal's bubbles; once play starts, only its announcements
  const shownBubbles = bubbles.filter((b) => b.deal === dealKey && (!playing || b.tone === 'decl' || b.tone === 'belote'));

  // ---- sizes (from the table's own box)
  const cw = Math.round(Math.max(44, Math.min(size.w * 0.125, size.h * 0.13, 104)));
  const ch = Math.round(cw * 1.4);
  const n = hand.length;
  const step = n > 1 ? Math.min(cw * 0.8, (size.w * 0.94 - cw) / (n - 1)) : 0;
  const tw = Math.round(cw * 0.86);

  const play = (c: Card): void => {
    if (!legal.includes(c) || !onPlay) return sfx().nope();
    onPlay(c, declareOn);
  };

  // keyboard: arrows pick a card, Enter plays it; letters make calls
  useEffect(() => {
    if (!myTurn) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (playing && legal.length) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocus((f) => (f + (e.key === 'ArrowRight' ? 1 : legal.length - 1)) % legal.length);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          play(legal[Math.min(focus, legal.length - 1)]!);
        }
      }
      if (bidding && onCall) {
        const map: Record<string, Call> = { '1': { k: 'bid', c: 0 }, '2': { k: 'bid', c: 1 }, '3': { k: 'bid', c: 2 }, '4': { k: 'bid', c: 3 }, n: { k: 'bid', c: NT }, a: { k: 'bid', c: AT }, p: { k: 'pass' }, d: { k: 'double' }, r: { k: 'redouble' } };
        const c = map[e.key.toLowerCase()];
        if (c && isLegalCall(d, c)) {
          e.preventDefault();
          onCall(c);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const bidderSpot = d.bidder !== null ? spot(d.bidder, view) : null;
  const sideName = (place: number): string => [w.you, w.right, w.partner, w.left][spot(place, view)]!;
  const tricksWon: [number, number] = [0, 0];
  for (const t of d.tricks) tricksWon[teamOf(t.winner)]++;
  const usTeam = teamOf(view as Seat);
  const themTeam = (1 - usTeam) as 0 | 1;

  return (
    <div ref={rootRef} className="bl-table" style={{ '--cw': `${cw}px`, '--ch': `${ch}px`, '--tw': `${tw}px` } as CSSProperties}>
      <CardDefs />
      <div className="bl-felt" aria-hidden="true" />
      <header className="bl-bar">
        <div className="bl-score" aria-label={`${w.us} ${match.scores[usTeam]}, ${w.them} ${match.scores[themTeam]}, ${w.to151}`}>
          <span className="bl-team is-us">
            <small>{w.us}</small>
            <b>{match.scores[usTeam]}</b>
          </span>
          <span className="bl-team is-them">
            <small>{w.them}</small>
            <b>{match.scores[themTeam]}</b>
          </span>
          <span className="bl-target mono">{note ?? w.to151.replace('151', String(TARGET))}</span>
          {match.hanging > 0 && <span className="bl-hang mono">{w.hanging(match.hanging)}</span>}
        </div>
        {k !== null && (
          <div className={`bl-contract${bidderSpot !== null && bidderSpot % 2 === 0 ? ' is-ours' : ' is-theirs'}`} title={contractName(w, k)}>
            {k < 4 ? <SuitIcon suit={k} size={20} /> : <b className="bl-kname">{k === NT ? 'NT' : 'AT'}</b>}
            <span className="bl-kfull">{contractName(w, k)}</span>
            <span className="bl-by mono">{d.bidder !== null ? sideName(d.bidder) : ''}</span>
            {d.mult > 1 && <span className="bl-mult mono">×{d.mult}</span>}
          </div>
        )}
        <div className="bl-tools">{tools}</div>
      </header>

      {/* the other three places */}
      {[1, 2, 3].map((sp) => {
        const place = (view + sp) % 4;
        const count = d.hands[place]!.length;
        const bub = shownBubbles.find((b) => b.place === place);
        const turn = d.turn === place && (bidding || playing);
        return (
          <div key={sp} className={`bl-seat is-${SPOT_NAME[sp]}${turn ? ' is-turn' : ''}${away?.[place] ? ' is-away' : ''}`}>
            <div className="bl-plate">
              <span className={`bl-avatar team-${teamOf(place as Seat) === usTeam ? 'us' : 'them'}`} aria-hidden="true">
                {bots?.[place] ? '🤖' : (names[place] ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="bl-who">
                <b>{names[place]}</b>
                <small className="mono">{sp === 2 ? w.partner : bots?.[place] ? w.level[bots[place]!] : sp === 1 ? w.right : w.left}</small>
              </span>
              {d.dealer === place && <span className="bl-dealer mono" title={w.dealer}>D</span>}
            </div>
            <div className="bl-fan" aria-label={`${count}`}>
              {Array.from({ length: count }, (_, i) => (
                <span key={i} className="bl-mini" style={{ '--i': i, '--n': count } as CSSProperties}>
                  <CardBack />
                </span>
              ))}
            </div>
            {bub && (
              <span key={bub.id} className={`bl-bubble tone-${bub.tone}`} role="status">
                {bub.text}
              </span>
            )}
          </div>
        );
      })}

      {playing && (
        <span className="bl-tally mono" aria-label={w.tricks}>
          {w.tricks} {tricksWon[usTeam]}–{tricksWon[themTeam]}
        </span>
      )}

      {/* the trick */}
      <div className={`bl-trick${showHeld ? ' is-held' : ''}${showHeld && held.slide ? ` is-taken to-${SPOT_NAME[spot(held.winner, view)]}` : ''}`} aria-live="polite">
        {shown.map((p) => {
          const sp = spot(p.seat, view);
          const win = (showHeld ? held.winner : top?.seat) === p.seat && (showHeld || d.trick.length > 1);
          return (
            <span key={`${p.seat}-${p.card}`} className={`bl-played at-${SPOT_NAME[sp]}${win ? ' is-top' : ''}`} aria-label={`${names[p.seat]}: ${cardLabel(p.card, w.suits)}`}>
              <CardFace card={p.card} />
            </span>
          );
        })}
        {!shown.length && bidding && <span className="bl-center-note mono">{d.turn === me ? w.yourBid : w.waitingFor(names[d.turn] ?? '')}</span>}
        {!shown.length && playing && d.tricks.length > 0 && (
          <button className="bl-peek mono" onClick={() => setPeek((x) => !x)} aria-expanded={peek}>
            {w.lastTrick}
          </button>
        )}
        {peek && lastTaken && !shown.length && (
          <div className="bl-peekbox" onClick={() => setPeek(false)}>
            {lastTaken.cards.map((p) => (
              <span key={p.card} className={`bl-peekcard${p.seat === lastTaken.winner ? ' is-top' : ''}`}>
                <CardFace card={p.card} />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* you */}
      <div className={`bl-me${myTurn ? ' is-turn' : ''}`}>
        {shownBubbles
          .filter((b) => b.place === me)
          .map((b) => (
            <span key={b.id} className={`bl-bubble is-mine tone-${b.tone}`}>
              {b.text}
            </span>
          ))}
        {bidding && myTurn && onCall && <BidBar w={w} calls={legalCalls(d)} onCall={onCall} />}
        {myDecl.length > 0 && myTurn && (
          <button className={`bl-declare${declareOn ? ' is-on' : ''}`} role="switch" aria-checked={declareOn} onClick={() => setDeclareOn((x) => !x)} title={w.declareHint}>
            <span className="bl-knob" aria-hidden="true" />
            {w.declare}: {myDecl.map((x) => `${declText(w, x)} ${x.points}`).join(' + ')}
          </button>
        )}
        {playing && myTurn && !myDecl.length && <span className="bl-yourturn mono">{w.yourTurn}</span>}
        <div className="bl-hand" style={{ '--step': `${step}px`, '--n': n } as CSSProperties} role="group" aria-label={w.cards}>
          {hand.map((c, i) => {
            const ok = legal.includes(c);
            const off = i - (n - 1) / 2;
            return (
              <button
                key={c >= 0 ? c : `x${i}`}
                className={`bl-card${ok ? ' is-legal' : ''}${playing && myTurn && !ok ? ' is-dim' : ''}${ok && legal.indexOf(c) === focus ? ' is-focus' : ''}`}
                style={{ '--x': `${off * step}px`, '--r': `${off * 2.6}deg`, '--y': `${Math.abs(off) ** 2 * 1.4}px`, '--d': `${i * 60}ms` } as CSSProperties}
                onClick={() => play(c)}
                disabled={!ok}
                aria-label={c >= 0 ? cardLabel(c, w.suits) : ''}
              >
                {c >= 0 ? <CardFace card={c} /> : <CardBack />}
              </button>
            );
          })}
        </div>
      </div>
      {overlay}
    </div>
  );
}

function BidBar({ w, calls, onCall }: { w: Words; calls: Call[]; onCall: (c: Call) => void }) {
  const has = (c: Call): boolean => calls.some((x) => x.k === c.k && (x.k !== 'bid' || x.c === (c as { c: number }).c));
  return (
    <div className="bl-bids" role="group" aria-label={w.yourBid}>
      {[0, 1, 2, 3].map((s) => (
        <button key={s} className="bl-bid is-suit" disabled={!has({ k: 'bid', c: s as 0 })} onClick={() => onCall({ k: 'bid', c: s as 0 })} aria-label={w.suits[s]} title={w.suits[s]}>
          <SuitIcon suit={s} size={26} />
        </button>
      ))}
      <button className="bl-bid" disabled={!has({ k: 'bid', c: NT })} onClick={() => onCall({ k: 'bid', c: NT })}>
        {w.noTrumps}
      </button>
      <button className="bl-bid" disabled={!has({ k: 'bid', c: AT })} onClick={() => onCall({ k: 'bid', c: AT })}>
        {w.allTrumps}
      </button>
      {has({ k: 'double' }) && (
        <button className="bl-bid is-contra" onClick={() => onCall({ k: 'double' })}>
          {w.contra}
        </button>
      )}
      {has({ k: 'redouble' }) && (
        <button className="bl-bid is-contra" onClick={() => onCall({ k: 'redouble' })}>
          {w.recontra}
        </button>
      )}
      <button className="bl-bid is-pass" onClick={() => onCall({ k: 'pass' })}>
        {w.pass}
      </button>
    </div>
  );
}

/** The score sheet after a deal: points by team, what counted, the outcome, the game points. */
export function DealSheet({ w, score, taken, scores, me, names, children }: { w: Words; score: DealScore; taken: number; scores: [number, number]; me: number; names: string[]; children?: ReactNode }) {
  const us = teamOf((me < 0 ? 0 : me) as Seat);
  const them = (1 - us) as 0 | 1;
  const cols = [us, them] as const;
  const bidderTeam = teamOf(score.bidder);
  const declSum = (t: 0 | 1): number => score.decls[t].reduce((n, x) => n + x.points, 0);
  const bidders = bidderTeam === us ? w.us : w.them;
  const k = score.contract;
  // the last trick's 10 (doubled with everything else in no trumps)
  const lastTen = k === NT ? 20 : 10;
  return (
    <div className="bl-sheet-wrap" role="dialog" aria-label={w.gamePoints}>
      <div className={`bl-sheet outcome-${score.outcome}`}>
        <div className="bl-sheet-head">
          <span className="bl-sheet-k">
            {k < 4 ? <SuitIcon suit={k} size={22} /> : null} {contractName(w, k)}
            {score.mult > 1 ? ` ×${score.mult}` : ''}
          </span>
          <span className={`bl-stamp tone-${score.outcome}`}>{score.valat !== null ? w.valat : w.outcome[score.outcome]}</span>
        </div>
        <p className="bl-sheet-line">{w.outcomeLine(score.outcome, `${bidders} (${names[score.bidder]})`, score.hang)}</p>
        <table className="bl-sheet-table">
          <thead>
            <tr>
              <th />
              <th>{w.us}</th>
              <th>{w.them}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{w.cards}</td>
              {cols.map((t) => (
                <td key={t} className="mono">
                  {score.cards[t] - (score.lastTrick === t ? lastTen : 0)}
                </td>
              ))}
            </tr>
            <tr>
              <td>{w.lastTen}</td>
              {cols.map((t) => (
                <td key={t} className="mono">
                  {score.lastTrick === t ? lastTen : '–'}
                </td>
              ))}
            </tr>
            <tr>
              <td>{w.declarations}</td>
              {cols.map((t) => (
                <td key={t} className="mono">
                  {declSum(t) || '–'}
                  {score.decls[t].length > 0 && <small className="bl-decl-list"> {score.decls[t].map((x) => w.decl[x.kind]).join(', ')}</small>}
                </td>
              ))}
            </tr>
            <tr>
              <td>{w.belote}</td>
              {cols.map((t) => (
                <td key={t} className="mono">
                  {score.belote[t] || '–'}
                </td>
              ))}
            </tr>
            {score.valat !== null && (
              <tr>
                <td>{w.valat}</td>
                {cols.map((t) => (
                  <td key={t} className="mono">
                    {score.valat === t ? 90 : '–'}
                  </td>
                ))}
              </tr>
            )}
            <tr className="bl-sum">
              <td>{w.total}</td>
              {cols.map((t) => (
                <td key={t} className="mono">
                  {score.raw[t]}
                </td>
              ))}
            </tr>
            <tr className="bl-game">
              <td>{w.gamePoints}</td>
              {cols.map((t) => (
                <td key={t} className="mono">
                  +{score.game[t] + (score.winner === t ? taken : 0)}
                </td>
              ))}
            </tr>
            <tr className="bl-match">
              <td>{w.to151}</td>
              {cols.map((t) => (
                <td key={t} className="mono">
                  <b>{scores[t]}</b>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {taken > 0 && score.winner !== null && <p className="bl-sheet-note mono">{w.hangTaken(taken)}</p>}
        <div className="bl-sheet-actions">{children}</div>
      </div>
    </div>
  );
}

export const suitShort = (c: Card): number => suitOf(c);
