import { useEffect, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { api } from '../../../platform/account';
import { CLASS_IDS, CLASSES } from '../data/classes';
import type { SigilEngine } from '../engine';
import { RING_BOARDS } from '../arena/ranks';
import { levelOf } from '../progress/ranks';
import { clockText } from '../sim/world';
import { VIGIL_MAPS } from '../vigil/kit';

interface Row {
  rank: number;
  nickname: string;
  score: number;
  at: number;
  you: boolean;
  /** A studio or QA account (functions/api/sigilfall/ranks.ts): listed, and marked with a crossed-out eye. */
  staff?: boolean;
}

/** An eye struck through: the mark of a studio or QA account on a board. */
const StaffEye = () => (
  <svg className="rb-rank-staff" viewBox="0 0 24 24" width="14" height="14" role="img" aria-label="Staff account">
    <title>Staff account</title>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <path d="M4 20 20 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/** One place on a board. */
function RankLine({ board, r, below }: { board: string; r: Row; below?: boolean }) {
  return (
    <li className={`${r.you ? 'is-you' : ''}${below ? ' is-below' : ''}`}>
      <b className={`rb-rank-n${r.rank <= 3 && !below ? ` is-top${r.rank}` : ''}`}>{r.rank}</b>
      <span className="rb-rank-name">
        {r.nickname}
        {r.staff && <StaffEye />}
      </span>
      <span className="rb-rank-score">{shown(board, r.score)}</span>
    </li>
  );
}
interface Board {
  board: string;
  rows: Row[];
  mine: Row | null;
  signedIn: boolean;
}

type Tab = 'rift' | 'vigil' | 'ring' | 'level';
const TABS: { id: Tab; name: string; blurb: string }[] = [
  { id: 'rift', name: 'The Rift', blurb: 'The highest Riftstone beaten in time.' },
  { id: 'vigil', name: 'The Vigil', blurb: 'The longest night held.' },
  { id: 'ring', name: 'The Ring', blurb: 'The best rating reached in each kind of fight: every format has its own rating, and its own board.' },
  { id: 'level', name: 'Heroes', blurb: 'The highest hero, and their Paragon level.' },
];

/** How a board's number is written. */
const shown = (board: string, score: number): string => {
  if (board.startsWith('trial') || board === 'stone') return `Riftstone +${score}`;
  if (board.startsWith('vigil')) return clockText(score);
  if (board === 'level') {
    const l = levelOf(score);
    return l.paragon ? `Level ${l.level} · Paragon ${l.paragon}` : `Level ${l.level}`;
  }
  return `${score}`;
};

/** One board: its top players, and the player's own place if it is further down. */
function BoardTable({ board, title, note }: { board: string; title: string; note?: string }) {
  const [state, setState] = useState<{ board: string; data: Board | null; failed: boolean }>({ board: '', data: null, failed: false });
  useEffect(() => {
    let live = true;
    api<Board>(`/api/sigilfall/ranks?board=${encodeURIComponent(board)}`)
      .then((data) => live && setState({ board, data, failed: false }))
      .catch(() => live && setState({ board, data: null, failed: true }));
    return () => {
      live = false;
    };
  }, [board]);
  const loading = state.board !== board;
  const data = loading ? null : state.data;
  return (
    <section className="rb-rank-board" aria-label={title}>
      <h3>{title}</h3>
      {note && <p className="rb-small rb-dim">{note}</p>}
      {loading && <p className="rb-small rb-dim">Reading the roll…</p>}
      {!loading && state.failed && <p className="rb-small rb-dim">The rankings can’t be reached right now. Your own bests are safe on this device.</p>}
      {data && data.rows.length === 0 && !data.mine && <p className="rb-small rb-dim">Nobody is on this board yet. It could be you.</p>}
      {data && (data.rows.length > 0 || data.mine) && (
        <ol className="rb-rank-list">
          {data.rows.map((r, i) => (
            <RankLine key={i} board={board} r={r} />
          ))}
          {data.mine && <RankLine board={board} r={data.mine} below={data.rows.length > 0} />}
        </ol>
      )}
      {data && !data.signedIn && <p className="rb-small rb-dim">Sign in to be listed: a guest’s bests stay on their device.</p>}
    </section>
  );
}

/**
 * The rankings: every player's best in each of the game's modes (the owner: "ranking system - make a page for the
 * leaderboards of the different game modes for all players"). The Rift's tab holds its two boards apart: the Trials
 * (a calling's ready champion, the same for everyone) and a story hero's own Riftstones (their own gear).
 */
export function RankScreen({ engine, onBack }: { engine: SigilEngine; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('rift');
  const [cls, setCls] = useState('');
  const [land, setLand] = useState('');
  // (what this account has done since it was last sent goes up before the boards are read: they wait for it, three
  // seconds at most, so a best just reached is on them the first time they open)
  const [sent, setSent] = useState(false);
  useEffect(() => {
    let live = true;
    const done = (): void => {
      if (live) setSent(true);
    };
    const t = window.setTimeout(done, 3000);
    void engine.reportRanks().finally(done);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [engine]);
  const t = TABS.find((x) => x.id === tab)!;
  return (
    <div className="rb-rift rb-ranks">
      <div className="rb-create-head">
        <button className="rb-btn is-small is-ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>Rankings</h2>
        <GameMenuButton className="rb-iconbtn" />
      </div>
      <div className="rb-seg rb-rank-tabs" role="tablist" aria-label="Game mode">
        {TABS.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === tab} className={x.id === tab ? 'is-on' : ''} onClick={() => setTab(x.id)}>
            {x.name}
          </button>
        ))}
      </div>
      <p className="rb-rift-lead">{t.blurb}</p>
      <div className={`rb-rank-cols${tab === 'ring' ? ' is-three' : ''}`}>
        {!sent && <p className="rb-small rb-dim">Reading the roll…</p>}
        {sent && tab === 'rift' && (
          <>
            <div>
              <label className="rb-rank-pick">
                <span>Rift Trials</span>
                <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Calling">
                  <option value="">Every calling</option>
                  {CLASS_IDS.map((id) => (
                    <option key={id} value={id}>
                      {CLASSES[id].name}
                    </option>
                  ))}
                </select>
              </label>
              <BoardTable board={cls ? `trial:${cls}` : 'trial'} title={cls ? `Rift Trials: ${CLASSES[cls as keyof typeof CLASSES].name}` : 'Rift Trials'} note="Played as a calling’s ready champion, the same for everyone." />
            </div>
            <BoardTable board="stone" title="Story heroes’ Riftstones" note="A level-60 hero of the story, in the gear they have won." />
          </>
        )}
        {sent && tab === 'vigil' && (
          <div>
            <label className="rb-rank-pick">
              <span>Land</span>
              <select value={land} onChange={(e) => setLand(e.target.value)} aria-label="Land">
                <option value="">Anywhere</option>
                {VIGIL_MAPS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <BoardTable board={land ? `vigil:${land}` : 'vigil'} title={land ? `The Vigil: ${VIGIL_MAPS.find((m) => m.id === land)?.name ?? land}` : 'The Vigil'} />
          </div>
        )}
        {sent && tab === 'ring' && RING_BOARDS.map((b) => <BoardTable key={b.part} board={`ring:${b.part}`} title={b.name} />)}
        {sent && tab === 'level' && <BoardTable board="level" title="Highest heroes" />}
      </div>
    </div>
  );
}
