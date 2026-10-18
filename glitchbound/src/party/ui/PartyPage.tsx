import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePageMeta } from '../../platform/meta';
import { TAGS } from '../content/challenges';
import { CONSEQUENCE_LABEL, freshRng, makePlayer, MAX_PLAYERS, playersProblem, SESSION_CARDS } from '../engine';
import { loadSession, saveSession, type ModeId, type PartySession } from '../session';
import type { Consequence, Intensity } from '../types';
import { getGame } from '../../catalog/catalog';
import { Link, navigate, useLocation } from '../../router/router';
import { AuctionMode } from './Auction';
import { ImpostorMode, newImpostor } from './Impostor';
import { ImpostorRoomPage, openImpostorRoom } from './ImpostorRoom';
import { BoardMode } from './Board';
import { CharadesMode } from './Charades';
import { MiniGame, MINIS, type MiniId } from './minis';
import { NeverMode } from './Never';
import { dealPrompt, PromptsMode } from './Prompts';
import { Avatar, ModeBar, PlayerPicker } from './shared';
import './Party.css';

const MODES: { id: ModeId; title: string; emoji: string; blurb: string; time: string; players: string; color: string }[] = [
  { id: 'impostor', title: 'Impostor', emoji: '🕵️', blurb: 'Everyone gets the secret word but one. Find them.', time: '10–40 min', players: '3–16', color: '#7b4dff' },
  { id: 'prompts', title: 'Party Prompts', emoji: '🃏', blurb: 'Truths, dares and “most likely to”, with your names on every card.', time: '15–45 min', players: '2–16', color: '#ff5a6c' },
  { id: 'nhie', title: 'Never Have I Ever', emoji: '🙊', blurb: 'Five fingers up, reveal together. Last one standing wins.', time: '10–30 min', players: '3–16', color: '#a45cff' },
  { id: 'charades', title: 'Charades', emoji: '🎭', blurb: 'Act, describe or draw it before time runs out.', time: '10–30 min', players: '3–16', color: '#ff8a1f' },
  { id: 'board', title: 'Dice Adventure', emoji: '🎲', blurb: 'Roll, race and dodge the nasty slides.', time: '10–35 min', players: '2–8', color: '#2fd1a0' },
  { id: 'auction', title: 'Name Your Price', emoji: '🔨', blurb: 'Bid play money and build the best collection.', time: '15–30 min', players: '2–8', color: '#ffb020' },
  { id: 'mini', title: 'Mini-games', emoji: '⚡', blurb: 'Reaction duels, hot potato, quick trivia and more.', time: '1–3 min each', players: '1–16', color: '#3d7bff' },
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

/** Room codes from invite links (/r/CODE lands on /party?room=CODE). */
const ROOM_CODE = /^[A-HJKMNP-Z]{5}$/;

export function PartyPage() {
  usePageMeta({ title: 'Party Mode', path: '/party' });
  const { search } = useLocation();
  const room = new URLSearchParams(search).get('room')?.toUpperCase() ?? '';
  const inRoom = ROOM_CODE.test(room);
  const [session, update] = useSession();
  const [mode, setMode] = useState<ModeId | null>(session.active?.mode ?? null);
  const [adultAsk, setAdultAsk] = useState(false);
  const [mini, setMini] = useState<{ id: MiniId; players: string[] } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [mode]);

  // Empty name slots are just unused seats: they never block a game and are dropped when one starts.
  const problem = playersProblem(session.players.filter((p) => p.name.trim()));
  const exit = (): void => {
    update((s) => ({ ...s, active: null }));
    setMode(null);
    setMini(null);
  };
  const open = (id: ModeId): void => {
    if (problem) return;
    update((s) => {
      const ready = { ...s, players: s.players.filter((p) => p.name.trim()) };
      if (id === 'impostor') return { ...ready, active: s.active?.mode === 'impostor' ? s.active : { mode: 'impostor', state: newImpostor() } };
      return id === 'prompts' ? dealPrompt({ ...ready, active: { mode: 'prompts', count: 0, limit: SESSION_CARDS[s.settings.length] } }, freshRng()) : ready;
    });
    setMode(id);
  };

  return (
    <div className="party" ref={top}>
      {inRoom && <ImpostorRoomPage key={room} code={room} onLeave={() => navigate('/party')} />}
      {!inRoom && mode === 'impostor' && <ImpostorMode session={session} update={update} onExit={exit} onRoom={() => void openImpostorRoom()} />}
      {!inRoom && mode === 'prompts' && <PromptsMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'nhie' && <NeverMode session={session} update={update} onExit={exit} onNeedAdult={() => setAdultAsk(true)} />}
      {!inRoom && mode === 'charades' && <CharadesMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'board' && <BoardMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'auction' && <AuctionMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'mini' && (
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
      {!mode && !inRoom && <Lobby session={session} update={update} problem={problem} onOpen={open} onAdult={() => setAdultAsk(true)} />}
      {/* Last, so it opens above the house-rules sheet. */}
      {adultAsk && (
        <AdultGate
          onYes={() => {
            update((s) => ({ ...s, settings: { ...s.settings, adultConfirmed: true, intensities: [...new Set([...s.settings.intensities, 'afterdark' as const])] } }));
            setAdultAsk(false);
          }}
          onNo={() => setAdultAsk(false)}
        />
      )}
    </div>
  );
}

/**
 * The lobby, kept to two steps: who's playing (name chips), then pick a game. House rules and your
 * own prompts open in a sheet, so they never stand between the group and the first card.
 */
function Lobby({ session, update, problem, onOpen, onAdult }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; problem: string | null; onOpen: (m: ModeId) => void; onAdult: () => void }) {
  const [newName, setNewName] = useState('');
  const [sheet, setSheet] = useState<'rules' | 'custom' | null>(null);
  const [where, setWhere] = useState<'one' | 'online'>('one');
  const [joinCode, setJoinCode] = useState('');
  const [roomMsg, setRoomMsg] = useState('');
  const [nudge, setNudge] = useState(0);
  const whoRef = useRef<HTMLElement>(null);
  const s = session.settings;
  const setSettings = (patch: Partial<PartySession['settings']>): void => update((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));
  const players = session.players;
  const named = players.filter((p) => p.name.trim());
  const setPlayers = (list: PartySession['players']): void => update((cur) => ({ ...cur, players: list }));
  const add = (): void => {
    const name = newName.trim();
    if (!name || players.length >= MAX_PLAYERS && !players.some((p) => !p.name)) return;
    // Fill an empty slot first.
    const empty = players.findIndex((p) => !p.name);
    if (empty >= 0) setPlayers(players.map((p, i) => (i === empty ? { ...p, name: name.slice(0, 18) } : p)));
    else setPlayers([...players, makePlayer(name, players.length)]);
    setNewName('');
  };
  const remove = (id: string): void => {
    const rest = players.filter((x) => x.id !== id);
    setPlayers(rest.length ? rest : [makePlayer('', 0)]);
  };
  // Turn order matters in some games: one tap to shuffle it.
  const shuffle = (): void => {
    const list = [...players];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    setPlayers(list);
  };
  // Tapping a game without enough players points at the names instead of doing nothing.
  const pick = (id: ModeId): void => {
    if (!problem) return onOpen(id);
    setNudge((n) => n + 1);
    whoRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const rulesSummary = [
    ...INTENSITIES.filter((x) => s.intensities.includes(x.id) && (x.id !== 'afterdark' || s.adultConfirmed)).map((x) => x.label),
    CONSEQUENCE_LABEL[s.consequence],
  ].join(' · ');
  const customCount = session.custom.challenges.length + session.custom.nhie.length;
  const unhinged = getGame('unhinged');
  const openRoom = (): void => {
    setRoomMsg('Opening a room…');
    openImpostorRoom().catch((e: unknown) => setRoomMsg(e instanceof Error ? e.message : 'Could not open a room. Try again.'));
  };
  // "Pick for us": a random game that suits the group's size.
  const surprise = (): void => {
    const fits = MODES.filter((m) => m.id !== 'mini' && (named.length >= 3 || m.id !== 'impostor'));
    pick(fits[Math.floor(Math.random() * fits.length)]!.id);
  };

  return (
    <div className="pt-lobby">
      <header className="pt-hero">
        <p className="pt-kicker">GlitchBound</p>
        <h1 className="pt-title">
          Party <span>Mode</span>
        </h1>
        <p className="pt-sub">Friends over, or on a call? Eight games, no sign-up.</p>
        <div className="pt-where" role="tablist" aria-label="How you play">
          <button role="tab" aria-selected={where === 'one'} className={where === 'one' ? 'is-on' : ''} onClick={() => setWhere('one')}>
            📱 Pass one phone
          </button>
          <button role="tab" aria-selected={where === 'online'} className={where === 'online' ? 'is-on' : ''} onClick={() => setWhere('online')}>
            🌐 Everyone’s phone
          </button>
        </div>
      </header>

      <div className="pt-stars">
        <section className="pt-feature" aria-labelledby="pt-feature-impostor">
          <span className="pt-feature-sticker">New</span>
          <span className="pt-feature-art" aria-hidden="true">
            🕵️
          </span>
          <div className="pt-feature-copy">
            <h2 id="pt-feature-impostor">Impostor</h2>
            <p>Everyone gets the secret word, except one. Say one word each, then vote out the faker.</p>
            <div className="pt-row pt-feature-ctas">
              <button className="pt-btn pt-btn-go" onClick={() => (where === 'one' ? pick('impostor') : openRoom())}>
                {where === 'one' ? 'Play on this phone' : 'Open a room'}
              </button>
              <button className="pt-btn" onClick={() => (where === 'one' ? openRoom() : pick('impostor'))}>
                {where === 'one' ? '🌐 Own phones' : '📱 One phone'}
              </button>
            </div>
          </div>
        </section>
        {unhinged && (
          <section className="pt-feature is-unhinged" aria-labelledby="pt-feature-unhinged">
            <span className="pt-feature-sticker">18+</span>
            <img className="pt-feature-art" src={unhinged.art.tile} alt="" width={88} height={88} style={{ background: unhinged.art.bg }} />
            <div className="pt-feature-copy">
              <h2 id="pt-feature-unhinged">Unhinged</h2>
              <p>The card game for terrible people. Play the most horrible answer, win the round. 3–10 players.</p>
              <div className="pt-row pt-feature-ctas">
                <Link className="pt-btn pt-btn-go" href="/games/unhinged">
                  Play on your phones
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>

      {where === 'online' && (
        <>
          <section className="pt-panel pt-online">
            <h2>Play on everyone’s own phone</h2>
            <p className="pt-muted">Open a room, send the link, and everyone joins from their phone: no app, no sign-up. Great on a video call too.</p>
            <div className="pt-online-games">
              <div className="pt-online-game" style={{ ['--mc' as string]: '#7b4dff' }}>
                <span className="pt-mode-art" aria-hidden="true">
                  🕵️
                </span>
                <div>
                  <b>Impostor</b>
                  <span>3–12 players · secret cards on each phone</span>
                  <button className="pt-btn pt-btn-go pt-btn-sm" onClick={openRoom}>
                    Open a room
                  </button>
                </div>
              </div>
              {unhinged && (
                <Link href="/games/unhinged" className="pt-online-game" style={{ ['--mc' as string]: '#ff5a6c' }}>
                  <img src={unhinged.art.tile} alt="" width={84} height={84} style={{ background: unhinged.art.bg }} />
                  <div>
                    <b>Unhinged 🔞</b>
                    <span>3–10 players · the card game for terrible people</span>
                    <span className="pt-btn pt-btn-sm">Play</span>
                  </div>
                </Link>
              )}
            </div>
            {roomMsg && <p className="pt-muted">{roomMsg}</p>}
          </section>
          <form
            className="pt-panel pt-join"
            onSubmit={(e) => {
              e.preventDefault();
              const code = joinCode.trim().toUpperCase();
              if (/^[A-HJKMNP-Z]{5}$/.test(code)) navigate(`/r/${code}`);
              else setRoomMsg('Room codes are five letters, like KQTRA.');
            }}
          >
            <h2>Got a code?</h2>
            <div className="pt-add">
              <input className="pt-input pt-code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCDE" maxLength={5} aria-label="Room code" autoCapitalize="characters" />
              <button className="pt-btn pt-btn-go" disabled={joinCode.trim().length !== 5}>
                Join
              </button>
            </div>
          </form>
        </>
      )}

      {where === 'one' && (
      <>
      <section ref={whoRef} key={nudge} className={`pt-panel pt-who${problem && nudge ? ' is-nudged' : ''}`} aria-labelledby="pt-players">
        <div className="pt-panel-head">
          <h2 id="pt-players">
            <span className="pt-step">1</span> Who’s playing?
          </h2>
          {named.length > 1 && (
            <button className="pt-link" onClick={shuffle}>
              🔀 Shuffle order
            </button>
          )}
        </div>
        {named.length > 0 && (
          <ul className="pt-names">
            {named.map((p) => (
              <li key={p.id} className="pt-name-chip" style={{ ['--pc' as string]: p.color }}>
                <Avatar player={p} size={26} />
                <span>{p.name}</span>
                <button onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="pt-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input className="pt-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={named.length ? 'Add another name' : 'Type a name, then Enter'} maxLength={18} aria-label="New player name" enterKeyHint="done" />
          <button className="pt-btn" disabled={!newName.trim() || named.length >= MAX_PLAYERS}>
            + Add
          </button>
        </form>
        {problem && <p className="pt-warn">{problem}</p>}
      </section>

      <div className="pt-h2-row">
        <h2 className="pt-h2">
          <span className="pt-step">2</span> Pick a game
        </h2>
        <button className="pt-btn pt-btn-sm pt-surprise" onClick={surprise}>
          🎲 Pick for us
        </button>
      </div>
      <div className="pt-modes pt-modes-lobby">
        {MODES.map((m) => (
          <button key={m.id} className={`pt-mode${problem ? ' is-waiting' : ''}`} style={{ ['--mc' as string]: m.color }} onClick={() => pick(m.id)}>
            <span className="pt-mode-art" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="pt-mode-body">
              <b>{m.title}</b>
              <span>{m.blurb}</span>
              <small>
                👥 {m.players} · ⏱ {m.time}
              </small>
            </span>
          </button>
        ))}
      </div>

      <div className="pt-extras">
        <button className="pt-extra" onClick={() => setSheet('rules')}>
          <b>⚙️ House rules</b>
          <span>{rulesSummary}</span>
        </button>
        <button className="pt-extra" onClick={() => setSheet('custom')}>
          <b>✍️ Your own prompts</b>
          <span>{customCount ? `${customCount} saved` : 'Add inside jokes'}</span>
        </button>
      </div>
      <p className="pt-muted pt-center">Everything stays on this phone. Refreshing is safe: your game picks up where you left off.</p>
      </>
      )}

      {sheet === 'rules' && (
        <Sheet title="House rules" onClose={() => setSheet(null)}>
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
        </Sheet>
      )}
      {sheet === 'custom' && (
        <Sheet title="Your own prompts" onClose={() => setSheet(null)}>
          <CustomPrompts session={session} update={update} onSaved={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  );
}

/** A bottom sheet over the lobby (tap outside, Escape or Done to close). */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="pt-modal pt-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="pt-sheet-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pt-modal-card pt-sheet">
        <div className="pt-sheet-head">
          <h2 id="pt-sheet-title">{title}</h2>
          <button className="pt-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
        <button className="pt-btn pt-btn-go" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function CustomPrompts({ session, update, onSaved }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onSaved?: () => void }) {
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
      <button
        className="pt-btn"
        onClick={() => {
          update((s) => ({ ...s, custom: { challenges: lines(c), nhie: lines(n) } }));
          onSaved?.();
        }}
      >
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
