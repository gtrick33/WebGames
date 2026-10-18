import { useEffect, useRef, useState } from 'react';
import { usePageMeta } from '../../platform/meta';
import { TAGS } from '../content/challenges';
import { CONSEQUENCE_LABEL, freshRng, makePlayer, MAX_PLAYERS, playersProblem, SESSION_CARDS } from '../engine';
import { loadSession, saveSession, type ModeId, type PartySession } from '../session';
import type { Consequence, Intensity } from '../types';
import { AuctionMode } from './Auction';
import { BoardMode } from './Board';
import { CharadesMode } from './Charades';
import { MiniGame, MINIS, type MiniId } from './minis';
import { NeverMode } from './Never';
import { dealPrompt, PromptsMode } from './Prompts';
import { Avatar, ModeBar, PlayerPicker } from './shared';
import './Party.css';

const MODES: { id: ModeId; title: string; emoji: string; blurb: string; time: string; players: string; color: string }[] = [
  { id: 'prompts', title: 'Party Prompts', emoji: '🃏', blurb: 'Truths, dares, “most likely to”, duels and new rules, with your names in every card.', time: '15–45 min', players: '2–16', color: '#ff5a6c' },
  { id: 'nhie', title: 'Never Have I Ever', emoji: '🙊', blurb: 'Five fingers up. Reveal together. Last one standing has the cleanest record.', time: '10–30 min', players: '3–16', color: '#a45cff' },
  { id: 'charades', title: 'Charades', emoji: '🎭', blurb: 'Act, describe or draw it before the clock runs out. Solo or in teams.', time: '10–30 min', players: '3–16', color: '#ff8a1f' },
  { id: 'board', title: 'Dice Adventure', emoji: '🎲', blurb: 'A party board game: roll, race, land on challenges, shortcuts and nasty slides.', time: '10–35 min', players: '2–8', color: '#2fd1a0' },
  { id: 'auction', title: 'Name Your Price', emoji: '🔨', blurb: 'Bid play money on heroes, villains and dream cars. Build the best collection.', time: '15–30 min', players: '2–8', color: '#ffb020' },
  { id: 'mini', title: 'Mini-games', emoji: '⚡', blurb: 'Reaction duels, rock-paper-scissors, hot potato, trivia and memory.', time: '1–3 min each', players: '1–16', color: '#3d7bff' },
];

const INTENSITIES: { id: Intensity; label: string; note: string }[] = [
  { id: 'casual', label: '😊 Casual', note: 'Everyone' },
  { id: 'spicy', label: '🌶️ Spicy', note: 'Flirty & cheeky' },
  { id: 'afterdark', label: '🔞 After Dark', note: 'Adults only' },
];

/** The session, persisted after every change. */
function useSession(): [PartySession, (fn: (s: PartySession) => PartySession) => void] {
  const [s, setS] = useState<PartySession>(loadSession);
  const update = (fn: (s: PartySession) => PartySession): void =>
    setS((cur) => {
      const next = fn(cur);
      saveSession(next);
      return next;
    });
  return [s, update];
}

export function PartyPage() {
  usePageMeta({ title: 'Party Mode', path: '/party' });
  const [session, update] = useSession();
  const [mode, setMode] = useState<ModeId | null>(session.active?.mode ?? null);
  const [adultAsk, setAdultAsk] = useState(false);
  const [mini, setMini] = useState<{ id: MiniId; players: string[] } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [mode]);

  const problem = playersProblem(session.players);
  const exit = (): void => {
    update((s) => ({ ...s, active: null }));
    setMode(null);
    setMini(null);
  };
  const open = (id: ModeId): void => {
    if (problem) return;
    if (id === 'prompts') update((s) => dealPrompt({ ...s, active: { mode: 'prompts', count: 0, limit: SESSION_CARDS[s.settings.length] } }, freshRng()));
    setMode(id);
  };

  return (
    <div className="party" ref={top}>
      {adultAsk && (
        <AdultGate
          onYes={() => {
            update((s) => ({ ...s, settings: { ...s.settings, adultConfirmed: true, intensities: [...new Set([...s.settings.intensities, 'afterdark' as const])] } }));
            setAdultAsk(false);
          }}
          onNo={() => setAdultAsk(false)}
        />
      )}
      {mode === 'prompts' && <PromptsMode session={session} update={update} onExit={exit} />}
      {mode === 'nhie' && <NeverMode session={session} update={update} onExit={exit} onNeedAdult={() => setAdultAsk(true)} />}
      {mode === 'charades' && <CharadesMode session={session} update={update} onExit={exit} />}
      {mode === 'board' && <BoardMode session={session} update={update} onExit={exit} />}
      {mode === 'auction' && <AuctionMode session={session} update={update} onExit={exit} />}
      {mode === 'mini' && (
        <div className="pt-screen">
          <ModeBar title="Mini-games" onExit={exit} />
          {mini ? (
            <MiniGame
              key={mini.id + mini.players.join()}
              id={mini.id}
              players={mini.players.map((id) => session.players.find((p) => p.id === id)!).filter(Boolean)}
              onDone={(winner) => {
                if (winner) update((s) => ({ ...s, scores: { ...s.scores, [winner]: (s.scores[winner] ?? 0) + 1 } }));
                setMini(null);
              }}
            />
          ) : (
            <MiniPicker session={session} onPlay={setMini} />
          )}
        </div>
      )}
      {!mode && <Lobby session={session} update={update} problem={problem} onOpen={open} onAdult={() => setAdultAsk(true)} />}
    </div>
  );
}

function Lobby({ session, update, problem, onOpen, onAdult }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; problem: string | null; onOpen: (m: ModeId) => void; onAdult: () => void }) {
  const [newName, setNewName] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const s = session.settings;
  const setSettings = (patch: Partial<PartySession['settings']>): void => update((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));
  const players = session.players;
  const setPlayers = (list: PartySession['players']): void => update((cur) => ({ ...cur, players: list }));
  const add = (): void => {
    const name = newName.trim();
    if (!name || players.length >= MAX_PLAYERS) return;
    // Fill an empty slot first.
    const empty = players.findIndex((p) => !p.name);
    if (empty >= 0) setPlayers(players.map((p, i) => (i === empty ? { ...p, name: name.slice(0, 18) } : p)));
    else setPlayers([...players, makePlayer(name, players.length)]);
    setNewName('');
  };
  const move = (i: number, d: -1 | 1): void => {
    const j = i + d;
    if (j < 0 || j >= players.length) return;
    const list = [...players];
    [list[i], list[j]] = [list[j]!, list[i]!];
    setPlayers(list);
  };

  return (
    <div className="pt-lobby">
      <header className="pt-hero">
        <p className="pt-kicker">GlitchBound</p>
        <h1 className="pt-title">
          Party <span>Mode</span>
        </h1>
        <p className="pt-sub">One phone. Your friends. Six ways to make the night louder.</p>
      </header>

      <section className="pt-panel" aria-labelledby="pt-players">
        <div className="pt-panel-head">
          <h2 id="pt-players">Who’s playing?</h2>
          <span className="pt-pill">{players.filter((p) => p.name).length} players</span>
        </div>
        <ol className="pt-players">
          {players.map((p, i) => (
            <li key={p.id}>
              <Avatar player={p} size={36} />
              <input
                className="pt-input"
                value={p.name}
                maxLength={18}
                placeholder={`Player ${i + 1}`}
                aria-label={`Player ${i + 1} name`}
                onChange={(e) => setPlayers(players.map((x) => (x.id === p.id ? { ...x, name: e.target.value.slice(0, 18) } : x)))}
              />
              <button className="pt-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.name || 'player'} up`}>
                ↑
              </button>
              <button className="pt-icon" onClick={() => move(i, 1)} disabled={i === players.length - 1} aria-label={`Move ${p.name || 'player'} down`}>
                ↓
              </button>
              <button className="pt-icon" onClick={() => setPlayers(players.filter((x) => x.id !== p.id))} disabled={players.length <= 1} aria-label={`Remove ${p.name || 'player'}`}>
                ✕
              </button>
            </li>
          ))}
        </ol>
        <form
          className="pt-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input className="pt-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a name and press Enter" maxLength={18} aria-label="New player name" />
          <button className="pt-btn" disabled={!newName.trim() || players.length >= MAX_PLAYERS}>
            + Add
          </button>
        </form>
        {problem && <p className="pt-warn">{problem}</p>}
      </section>

      <section className="pt-panel" aria-labelledby="pt-rules">
        <button className="pt-panel-head pt-toggle" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules}>
          <h2 id="pt-rules">House rules</h2>
          <span className="pt-muted">
            {INTENSITIES.filter((x) => s.intensities.includes(x.id) && (x.id !== 'afterdark' || s.adultConfirmed))
              .map((x) => x.label)
              .join(' · ')}{' '}
            · {CONSEQUENCE_LABEL[s.consequence]} {showRules ? '▴' : '▾'}
          </span>
        </button>
        {showRules && (
          <div className="pt-rules">
            <p className="pt-label">Content</p>
            <div className="pt-picker">
              {INTENSITIES.map((it) => {
                const on = s.intensities.includes(it.id) && (it.id !== 'afterdark' || s.adultConfirmed);
                return (
                  <button
                    key={it.id}
                    className={`pt-chip${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      if (it.id === 'afterdark' && !s.adultConfirmed) return onAdult();
                      const next = on ? s.intensities.filter((x) => x !== it.id) : [...s.intensities, it.id];
                      setSettings({ intensities: next.length ? next : ['casual'] });
                    }}
                  >
                    {it.label} <small>{it.note}</small>
                  </button>
                );
              })}
            </div>
            <p className="pt-label">When someone skips or loses</p>
            <div className="pt-seg" role="radiogroup">
              {(Object.keys(CONSEQUENCE_LABEL) as Consequence[]).map((c) => (
                <button key={c} role="radio" aria-checked={s.consequence === c} onClick={() => setSettings({ consequence: c })}>
                  {CONSEQUENCE_LABEL[c]}
                </button>
              ))}
            </div>
            {s.consequence === 'sips' && <p className="pt-muted">Sips are always optional: water or a silly task counts the same. Never drink and drive, and know your limits.</p>}
            <p className="pt-label">Skip these topics</p>
            <div className="pt-picker">
              {TAGS.map((t) => {
                const off = s.excludedTags.includes(t.id);
                return (
                  <button key={t.id} className={`pt-chip pt-chip-off${off ? ' is-on' : ''}`} aria-pressed={off} onClick={() => setSettings({ excludedTags: off ? s.excludedTags.filter((x) => x !== t.id) : [...s.excludedTags, t.id] })}>
                    {off ? '🚫 ' : ''}
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="pt-label">Session length</p>
            <div className="pt-seg" role="radiogroup">
              {(['quick', 'standard', 'long'] as const).map((l) => (
                <button key={l} role="radio" aria-checked={s.length === l} onClick={() => setSettings({ length: l })}>
                  {l === 'quick' ? 'Quick' : l === 'standard' ? 'Standard' : 'Long'} <small>{SESSION_CARDS[l]} cards</small>
                </button>
              ))}
            </div>
            <p className="pt-muted">Anyone can skip any card, any time. Nobody has to do anything they’re not comfortable with.</p>
          </div>
        )}
      </section>

      <section className="pt-panel" aria-labelledby="pt-custom">
        <button className="pt-panel-head pt-toggle" onClick={() => setShowCustom((v) => !v)} aria-expanded={showCustom}>
          <h2 id="pt-custom">Your own prompts</h2>
          <span className="pt-muted">
            {session.custom.challenges.length + session.custom.nhie.length} saved {showCustom ? '▴' : '▾'}
          </span>
        </button>
        {showCustom && <CustomPrompts session={session} update={update} />}
      </section>

      <h2 className="pt-h2">Pick a game</h2>
      <div className="pt-modes">
        {MODES.map((m) => (
          <button key={m.id} className="pt-mode" style={{ ['--mc' as string]: m.color }} onClick={() => onOpen(m.id)} disabled={!!problem}>
            <span className="pt-mode-art" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="pt-mode-body">
              <b>{m.title}</b>
              <span>{m.blurb}</span>
              <small>
                ⏱ {m.time} · 👥 {m.players}
              </small>
            </span>
          </button>
        ))}
      </div>
      <p className="pt-muted pt-center">Everything stays on this phone. Refreshing is safe: your game picks up where you left off.</p>
    </div>
  );
}

function CustomPrompts({ session, update }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void }) {
  const [c, setC] = useState(session.custom.challenges.join('\n'));
  const [n, setN] = useState(session.custom.nhie.join('\n'));
  const lines = (t: string): string[] =>
    t
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 100);
  return (
    <div className="pt-rules">
      <label className="pt-label" htmlFor="pt-cc">
        Challenges (one per line). Use {'{A}'} and {'{B}'} for random players.
      </label>
      <textarea id="pt-cc" className="pt-input pt-textarea" rows={4} value={c} onChange={(e) => setC(e.target.value)} placeholder={'{A}, tell the story of how you met {B}\nEveryone does their best evil laugh'} />
      <label className="pt-label" htmlFor="pt-cn">
        Never Have I Ever statements (one per line)
      </label>
      <textarea id="pt-cn" className="pt-input pt-textarea" rows={3} value={n} onChange={(e) => setN(e.target.value)} placeholder="been to Sava’s legendary barbecue" />
      <button className="pt-btn pt-btn-go" onClick={() => update((s) => ({ ...s, custom: { challenges: lines(c), nhie: lines(n) } }))}>
        Save prompts
      </button>
    </div>
  );
}

function MiniPicker({ session, onPlay }: { session: PartySession; onPlay: (m: { id: MiniId; players: string[] }) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <div className="pt-panel">
      <h3>Who’s playing?</h3>
      <PlayerPicker players={session.players} selected={sel} label="Players" onToggle={(id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])} />
      <div className="pt-modes">
        {MINIS.map((m) => {
          const need = m.players === 'all' ? 2 : m.players;
          const ok = m.players === 'all' ? sel.length >= 2 : sel.length === need;
          return (
            <button
              key={m.id}
              className="pt-mode pt-mode-sm"
              disabled={!ok}
              onClick={() => onPlay({ id: m.id, players: m.players === 'all' ? sel : sel.slice(0, need) })}
            >
              <span className="pt-mode-art" aria-hidden="true">
                {m.emoji}
              </span>
              <span className="pt-mode-body">
                <b>{m.title}</b>
                <span>{m.blurb}</span>
                <small>{m.players === 'all' ? 'Pick 2+ players' : `Pick exactly ${m.players}`}</small>
              </span>
            </button>
          );
        })}
      </div>
      <p className="pt-muted">Wins: {session.players.map((p) => `${p.name} ${session.scores[p.id] ?? 0}`).join(' · ')}</p>
    </div>
  );
}

function AdultGate({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="pt-modal" role="dialog" aria-modal="true" aria-labelledby="pt-adult">
      <div className="pt-modal-card">
        <p className="pt-modal-icon">🔞</p>
        <h2 id="pt-adult">After Dark is for adults</h2>
        <p>These cards include mature flirting, relationship and intimacy-themed prompts. Nothing is explicit, and everything stays optional and consensual.</p>
        <p className="pt-muted">By continuing, everyone playing confirms they are 18 or older (or the age of majority where you live). This is a self-declaration, not an ID check.</p>
        <div className="pt-row">
          <button className="pt-btn pt-btn-go" onClick={onYes}>
            We’re all 18+
          </button>
          <button className="pt-btn" onClick={onNo}>
            Keep it clean
          </button>
        </div>
      </div>
    </div>
  );
}
