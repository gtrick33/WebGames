import { useEffect, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { api } from '../../../platform/account';
import { CLASS_IDS, CLASSES } from '../data/classes';
import type { SigilEngine } from '../engine';
import { levelOf } from '../progress/ranks';
import { clockText } from '../sim/world';
import { VIGIL_MAPS } from '../vigil/kit';

interface Row {
  rank: number;
  nickname: string;
  score: number;
  at: number;
  you: boolean;
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
  { id: 'ring', name: 'The Ring', blurb: 'The best arena rating reached.' },
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
      {data && data.rows.length === 0 && <p className="rb-small rb-dim">Nobody is on this board yet. It could be you.</p>}
      {data && data.rows.length > 0 && (
        <ol className="rb-rank-list">
          {data.rows.map((r, i) => (
            <li key={i} className={r.you ? 'is-you' : ''}>
              <b className={`rb-rank-n${r.rank <= 3 ? ` is-top${r.rank}` : ''}`}>{r.rank}</b>
              <span className="rb-rank-name">{r.nickname}</span>
              <span className="rb-rank-score">{shown(board, r.score)}</span>
            </li>
          ))}
          {data.mine && (
            <li className="is-you is-below">
              <b className="rb-rank-n">{data.mine.rank}</b>
              <span className="rb-rank-name">{data.mine.nickname}</span>
              <span className="rb-rank-score">{shown(board, data.mine.score)}</span>
            </li>
          )}
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
  // (what this account has done since it was last sent goes up before the boards are read)
  useEffect(() => engine.reportRanks(), [engine]);
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
      <div className="rb-rank-cols">
        {tab === 'rift' && (
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
        {tab === 'vigil' && (
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
        {tab === 'ring' && <BoardTable board="ring" title="The Ring" />}
        {tab === 'level' && <BoardTable board="level" title="Highest heroes" />}
      </div>
    </div>
  );
}
