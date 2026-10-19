import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePageMeta } from '../../platform/meta';
import { TAGS } from '../content/challenges';
import { cleanName, CONSEQUENCE_LABEL, freshRng, makePlayer, MAX_PLAYERS, playersProblem, SESSION_CARDS } from '../engine';
import { loadSession, saveSession, type ModeId, type PartySession } from '../session';
import type { Consequence, Intensity } from '../types';
import { getGame } from '../../catalog/catalog';
import { navigate, useLocation } from '../../router/router';
import { AuctionMode } from './Auction';
import { ImpostorMode, newImpostor } from './Impostor';
import { openImpostorRoom } from './ImpostorRoom';
import { BoardMode } from './Board';
import { CharadesMode } from './Charades';
import { DialMode } from './Dial';
import { HuesMode } from './Hues';
import { UniqueMode } from './Unique';
import { NeverMode } from './Never';
import { dealPrompt, PromptsMode } from './Prompts';
import { openPartyRoom, PartyRoomPage } from './room/PartyRoom';
import { Avatar } from './shared';
import type { RoomGame } from '../../platform/rooms';
import { partySettingsFor } from '../../catalog/settings';
import { useLiveCatalog } from '../../platform/liveCatalog';
import { DEFAULT_FEATURED, PARTY_GAMES } from '../catalog';
import './Party.css';

/** The party line-up as players see it: the admins' Party settings applied (hidden, featured, texts, rooms). */
function usePartyLineup() {
  const live = useLiveCatalog();
  const games = PARTY_GAMES.filter((g) => !partySettingsFor(live.raw, g.id).hidden && (g.id !== 'crass-act' || !live.settings('crass-act').hidden)).map((g) => {
    const s = partySettingsFor(live.raw, g.id);
    return { ...g, title: s.title || g.title, blurb: s.blurb || g.blurb, room: s.room ? g.room : null, label: s.sticker, featured: s.featured };
  });
  const chosen = games.filter((g) => g.featured);
  return {
    modes: games.filter((g) => g.onePhone),
    rooms: games.filter((g) => g.room),
    featured: chosen.length ? chosen : games.filter((g) => DEFAULT_FEATURED.includes(g.id)),
  };
}
type Lineup = ReturnType<typeof usePartyLineup>;
const anyOf = <T,>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];
type ShownGame = Lineup['modes'][number];

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
  const params = new URLSearchParams(search);
  const room = params.get('room')?.toUpperCase() ?? '';
  // A link to one game (from the site search): the lobby opens on it. 'online' = the rooms tab.
  const play = params.get('play') ?? '';
  const inRoom = ROOM_CODE.test(room);
  const [session, update] = useSession();
  const [mode, setMode] = useState<ModeId | null>(session.active?.mode ?? null);
  const [adultAsk, setAdultAsk] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [mode]);

  // Empty name slots are just unused seats: they never block a game and are dropped when one starts.
  const problem = playersProblem(session.players.filter((p) => p.name.trim()));
  const exit = (): void => {
    update((s) => ({ ...s, active: null }));
    setMode(null);
  };
  const open = (id: ModeId): void => {
    if (problem) return;
    update((s) => {
      // A new game starts a new scoreboard (Impostor points must not carry into Party Prompts).
      const ready = { ...s, players: s.players.filter((p) => p.name.trim()), scores: {} };
      if (id === 'impostor') return { ...ready, active: s.active?.mode === 'impostor' ? s.active : { mode: 'impostor', state: newImpostor() } };
      return id === 'prompts' ? dealPrompt({ ...ready, active: { mode: 'prompts', count: 0, limit: SESSION_CARDS[s.settings.length] } }, freshRng()) : ready;
    });
    setMode(id);
  };

  return (
    <div className="party" ref={top}>
      {inRoom && <PartyRoomPage key={room} code={room} onLeave={() => navigate('/party')} />}
      {!inRoom && mode === 'impostor' && <ImpostorMode session={session} update={update} onExit={exit} onRoom={() => void openImpostorRoom()} />}
      {!inRoom && mode === 'prompts' && <PromptsMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'nhie' && <NeverMode session={session} update={update} onExit={exit} onNeedAdult={() => setAdultAsk(true)} />}
      {!inRoom && mode === 'charades' && <CharadesMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'board' && <BoardMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'auction' && <AuctionMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'dial' && <DialMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'unique' && <UniqueMode session={session} update={update} onExit={exit} />}
      {!inRoom && mode === 'hues' && <HuesMode session={session} update={update} onExit={exit} />}
      {!mode && !inRoom && <Lobby key={play} focus={play} session={session} update={update} problem={problem} onOpen={open} onAdult={() => setAdultAsk(true)} />}
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
function Lobby({ focus, session, update, problem, onOpen, onAdult }: { focus: string; session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; problem: string | null; onOpen: (m: ModeId) => void; onAdult: () => void }) {
  const [newName, setNewName] = useState('');
  const [sheet, setSheet] = useState<'rules' | 'custom' | null>(null);
  // Games you can only play in a room open on the rooms tab.
  const [where, setWhere] = useState<'one' | 'online'>(() => (focus === 'online' || PARTY_GAMES.some((g) => g.id === focus && !g.onePhone) ? 'online' : 'one'));
  // Opened from a link to one game: bring its card into view (it is highlighted for a moment).
  useEffect(() => {
    if (!focus) return;
    const target = document.querySelector(focus === 'online' ? '.pt-online' : `[data-party-game="${focus}"]`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focus]);
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
    if (empty >= 0) setPlayers(players.map((p, i) => (i === empty ? { ...p, name: cleanName(name) } : p)));
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
  const crassAct = getGame('crass-act');
  const { modes, rooms, featured } = usePartyLineup();
  const openRoom = (game: RoomGame = 'impostor'): void => {
    if (game === 'crass-act') return navigate('/games/crass-act');
    setRoomMsg('Opening a room…');
    (game === 'impostor' ? openImpostorRoom() : openPartyRoom(game)).catch((e: unknown) => setRoomMsg(e instanceof Error ? e.message : 'Could not open a room. Try again.'));
  };
  // "Pick for us": a random game that suits the group's size.
  const surprise = (): void => {
    const fits = modes.filter((m) => named.length >= 3 || m.id !== 'impostor');
    const choice = anyOf(fits);
    if (choice) pick(choice.id as ModeId);
  };

  return (
    <div className="pt-lobby">
      <header className="pt-hero">
        <p className="pt-kicker">GlitchBound</p>
        <h1 className="pt-title">
          Party <span>Mode</span>
        </h1>
        <p className="pt-sub">Friends over, or on a call? {modes.length + rooms.filter((r) => !r.onePhone).length} games, no sign-up.</p>
        <div className="pt-where" role="tablist" aria-label="How you play">
          <button role="tab" aria-selected={where === 'one'} className={where === 'one' ? 'is-on' : ''} onClick={() => setWhere('one')}>
            📱 Pass one phone
          </button>
          <button role="tab" aria-selected={where === 'online'} className={where === 'online' ? 'is-on' : ''} onClick={() => setWhere('online')}>
            🌐 Everyone’s phone
          </button>
        </div>
      </header>

      {featured.length > 0 && (
        <div className="pt-stars">
          {featured.map((g) => (
            <Feature key={g.id} g={g} where={where} art={g.id === 'crass-act' ? crassAct?.art : undefined} onPlay={() => pick(g.id as ModeId)} onRoom={() => g.room && openRoom(g.room)} />
          ))}
        </div>
      )}

      {where === 'online' && (
        <>
          <section className="pt-panel pt-online">
            <h2>Play on everyone’s own phone</h2>
            <p className="pt-muted">Open a room, send the link, and everyone joins from their phone: no app, no sign-up. Great on a video call too.</p>
            <div className="pt-online-games">
              {rooms.map((r) => {
                // Crass Act keeps its own art and 18+ sticker; its room opens on its own page (name and age check first).
                const art = r.id === 'crass-act' ? crassAct?.art : undefined;
                const sticker = r.label || (r.id === 'crass-act' ? r.sticker : '');
                return (
                  <div key={r.id} data-party-game={r.id} className={`pt-online-game${focus === r.id ? ' is-found' : ''}`} style={{ ['--mc' as string]: r.color }}>
                    {art ? (
                      <img src={art.tile} alt="" width={84} height={84} style={{ background: art.bg }} />
                    ) : (
                      <span className="pt-mode-art" aria-hidden="true">
                        {r.emoji}
                      </span>
                    )}
                    <div>
                      <b>
                        {r.title}
                        {sticker && <em className="pt-mode-sticker">{sticker}</em>}
                      </b>
                      <span>
                        {r.roomPlayers} players · {r.roomBlurb}
                      </span>
                      <button className="pt-btn pt-btn-go pt-btn-sm" onClick={() => openRoom(r.room!)}>
                        Open a room
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {roomMsg && <p className="pt-muted">{roomMsg}</p>}
          </section>
          <form
            className="pt-panel pt-join"
            onSubmit={(e) => {
              e.preventDefault();
              const code = joinCode.trim().toUpperCase();
              // A full page load: the server's /r/CODE works out which game the room plays (the client
              // router has no /r/ route, so navigate() showed "Page not found").
              if (ROOM_CODE.test(code)) window.location.assign(`/r/${code}`);
              else setRoomMsg('Check the code: five letters, like KQTRA (codes never use I, L or O).');
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
          <input
            className="pt-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={named.length >= MAX_PLAYERS ? `Full: ${MAX_PLAYERS} players is the most` : named.length ? 'Add another name' : 'Type a name, then Enter'}
            maxLength={18}
            aria-label="New player name"
            enterKeyHint="done"
            disabled={named.length >= MAX_PLAYERS}
          />
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
        {modes.map((m) => (
          <button key={m.id} data-party-game={m.id} className={`pt-mode${problem ? ' is-waiting' : ''}${focus === m.id ? ' is-found' : ''}`} style={{ ['--mc' as string]: m.color }} onClick={() => pick(m.id as ModeId)}>
            <span className="pt-mode-art" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="pt-mode-body">
              <b>
                {m.title}
                {m.label && <em className="pt-mode-sticker">{m.label}</em>}
              </b>
              <span>{m.blurb}</span>
              <small>
                👥 {m.players} · ⏱ {m.time}
                {m.room ? ' · 🌐 own phones too' : ''}
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
          <CustomPrompts session={session} update={update} />
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

/** The group's own prompts, saved as they type: Done, ✕ or a tap outside never loses them. */
function CustomPrompts({ session, update }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void }) {
  const [c, setC] = useState(session.custom.challenges.join('\n'));
  const [n, setN] = useState(session.custom.nhie.join('\n'));
  const lines = (t: string): string[] =>
    t
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 100);
  const save = (challenges: string, nhie: string): void => update((s) => ({ ...s, custom: { challenges: lines(challenges), nhie: lines(nhie) } }));
  return (
    <div className="pt-rules">
      <label className="pt-label" htmlFor="pt-cc">
        Challenges (one per line). Use {'{A}'} and {'{B}'} for random players.
      </label>
      <textarea
        id="pt-cc"
        className="pt-input pt-textarea"
        rows={4}
        value={c}
        onChange={(e) => {
          setC(e.target.value);
          save(e.target.value, n);
        }}
        placeholder={'{A}, tell the story of how you met {B}\nEveryone does their best evil laugh'}
      />
      <label className="pt-label" htmlFor="pt-cn">
        Never Have I Ever statements (one per line)
      </label>
      <textarea
        id="pt-cn"
        className="pt-input pt-textarea"
        rows={3}
        value={n}
        onChange={(e) => {
          setN(e.target.value);
          save(c, e.target.value);
        }}
        placeholder="been to Sava’s legendary barbecue"
      />
      <p className="pt-muted">Saved as you type. Challenges show up in Party Prompts; statements under “Your own” in Never Have I Ever.</p>
    </div>
  );
}

/** A big featured card at the top of the lobby. */
function Feature({ g, where, art, onPlay, onRoom }: { g: ShownGame; where: 'one' | 'online'; art?: { tile: string; bg: string }; onPlay: () => void; onRoom: () => void }) {
  const sticker = g.label || g.sticker;
  const both = g.onePhone && !!g.room;
  return (
    <section className={`pt-feature${g.id === 'crass-act' ? ' is-crass-act' : ''}`} style={g.id === 'crass-act' || g.id === 'impostor' ? undefined : { background: `linear-gradient(130deg, ${g.color}, #ff4fa3 75%)` }} aria-labelledby={`pt-feature-${g.id}`}>
      {sticker && <span className="pt-feature-sticker">{sticker}</span>}
      {art ? (
        <img className="pt-feature-art" src={art.tile} alt="" width={88} height={88} style={{ background: art.bg }} />
      ) : (
        <span className="pt-feature-art" aria-hidden="true">
          {g.emoji}
        </span>
      )}
      <div className="pt-feature-copy">
        <h2 id={`pt-feature-${g.id}`}>{g.title}</h2>
        <p>{g.blurb}</p>
        <div className="pt-row pt-feature-ctas">
          {both ? (
            <>
              <button className="pt-btn pt-btn-go" onClick={where === 'one' ? onPlay : onRoom}>
                {where === 'one' ? 'Play on this phone' : 'Open a room'}
              </button>
              <button className="pt-btn" onClick={where === 'one' ? onRoom : onPlay}>
                {where === 'one' ? '🌐 Own phones' : '📱 One phone'}
              </button>
            </>
          ) : g.room ? (
            <button className="pt-btn pt-btn-go" onClick={onRoom}>
              Open a room
            </button>
          ) : (
            <button className="pt-btn pt-btn-go" onClick={onPlay}>
              Play on this phone
            </button>
          )}
        </div>
      </div>
    </section>
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
