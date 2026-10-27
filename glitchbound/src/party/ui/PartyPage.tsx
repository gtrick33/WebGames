import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
import { goToRoom, openPartyRoom, PartyRoomPage } from './room/PartyRoom';
import { OnlinePlay, OnlineWindow, RoomBrowser, ROOM_GAME_INFO } from '../../components/OnlinePlay';
import { Avatar } from './shared';
import { AdultLabel } from '../../components/AdultLabel';
import type { RoomGame } from '../../platform/rooms';
import { partySettingsFor } from '../../catalog/settings';
import { useLiveCatalog } from '../../platform/liveCatalog';
import { DEFAULT_FEATURED, PARTY_GAMES } from '../catalog';
import './Party.css';
import { t, useT } from '../../i18n';
import { cardImg } from '../../platform/cardImg';

/** The party line-up as players see it: the admins' Party settings applied (hidden, featured, texts, rooms). */
function usePartyLineup() {
  const live = useLiveCatalog();
  const games = PARTY_GAMES.filter((g) => !partySettingsFor(live.raw, g.id).hidden && (g.id !== 'crass-act' || !live.settings('crass-act').hidden)).map((g) => {
    const s = partySettingsFor(live.raw, g.id);
    return { ...g, title: s.title || g.title, blurb: s.blurb || g.blurb, room: s.room ? g.room : null, label: s.sticker, featured: s.featured };
  });
  // The top row: the three crowd favorites first, then any other game an admin featured (four at most).
  const top = [...DEFAULT_FEATURED.flatMap((id) => games.filter((g) => g.id === id)), ...games.filter((g) => g.featured && !DEFAULT_FEATURED.includes(g.id))].slice(0, 4);
  return {
    all: games,
    modes: games.filter((g) => g.onePhone),
    rooms: games.filter((g) => g.room),
    featured: top,
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
  // Re-render the party screens when the language changes (they use the plain t()).
  useT();
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
  // A new game, or going into or out of a room (same page, so the router keeps the scroll), starts at the top.
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [mode, room]);

  // Empty name slots are just unused seats: they never block a game and are dropped when one starts.
  const problem = playersProblem(session.players.filter((p) => p.name.trim()), t);
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
 * The lobby, laid out like the arcade: the top party games in big cards, then every party game, each
 * card with the ways it can be played (one phone passed around, or everyone's own phone). Picking a
 * one-phone game asks for the players' names in a sheet first; house rules and your own prompts open
 * in sheets too, so they never stand between the group and the first card.
 */
function Lobby({ focus, session, update, problem, onOpen, onAdult }: { focus: string; session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; problem: string | null; onOpen: (m: ModeId) => void; onAdult: () => void }) {
  const [newName, setNewName] = useState('');
  const [sheet, setSheet] = useState<'rules' | 'custom' | 'who' | null>(null);
  // The one-phone game waiting for the players' names.
  const [askFor, setAskFor] = useState<ModeId | null>(null);
  // Opened from a link to one game: bring its card into view (it is highlighted for a moment).
  useEffect(() => {
    if (!focus) return;
    const target = document.querySelector(focus === 'online' ? '.pt-online' : `[data-party-game="${focus}"]`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focus]);
  const [joinCode, setJoinCode] = useState('');
  const [joinMsg, setJoinMsg] = useState('');
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
  // A one-phone game without enough names asks for them first, then starts.
  const pick = (id: ModeId): void => {
    if (!problem) return onOpen(id);
    setAskFor(id);
    setSheet('who');
  };
  const rulesSummary = [
    ...INTENSITIES.filter((x) => s.intensities.includes(x.id) && (x.id !== 'afterdark' || s.adultConfirmed)).map((x) => x.label),
    CONSEQUENCE_LABEL[s.consequence],
  ].join(' · ');
  const customCount = session.custom.challenges.length + session.custom.nhie.length;
  const crassAct = getGame('crass-act');
  const { all, modes, featured } = usePartyLineup();
  // A game's way online (quick match, a public or private room, its public rooms) opens in a window.
  const [online, setOnline] = useState<RoomGame | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const openRoom = (game: RoomGame = 'impostor'): void => {
    // Crass Act asks for the player's age on its own page first.
    if (game === 'crass-act') return navigate('/games/crass-act');
    setOnline(game);
  };
  const createIn = async (game: RoomGame, listed: boolean): Promise<string | null> => {
    try {
      await (game === 'impostor' ? openImpostorRoom(listed) : openPartyRoom(game, listed));
      return null;
    } catch (e) {
      return e instanceof Error ? t(e.message) : t('Could not open a room. Try again.');
    }
  };
  // "Pick for us": a random game that suits the group's size.
  const art = (g: ShownGame): { tile: string; bg: string } | undefined => (g.id === 'crass-act' ? crassAct?.art : g.art && { tile: g.art.tile, bg: g.color });
  const card = (g: ShownGame, i: number) => <PartyCard key={g.id} g={g} i={i} art={art(g)} found={focus === g.id} onPlay={() => pick(g.id as ModeId)} onRoom={() => g.room && openRoom(g.room)} />;
  const surprise = (): void => {
    // "3–16" → at least 3 (two players were sent to One of a Kind, which needs three).
    const fits = modes.filter((m) => named.length >= (Number.parseInt(m.players, 10) || 2));
    // Too few names for any game: picking one still points at the names.
    const choice = anyOf(fits.length ? fits : modes);
    if (choice) pick(choice.id as ModeId);
  };

  return (
    <div className="pt-lobby">
      {online && (
        <OnlineWindow label={t(ROOM_GAME_INFO[online].title)} title={<>{ROOM_GAME_INFO[online].emoji} {t(ROOM_GAME_INFO[online].title)}</>} sub={t('Play online')} onClose={() => setOnline(null)}>
          <OnlinePlay game={online} inlineList onCreate={(listed) => createIn(online, listed)} onJoin={(code, matched) => goToRoom(online, code, matched)} />
        </OnlineWindow>
      )}
      {browseAll && <RoomBrowser onClose={() => setBrowseAll(false)} onJoin={(code, r) => goToRoom(r.game, code)} />}
      <header className="pt-hero">
        <p className="pt-kicker">{t('GlitchBound')}</p>
        <h1 className="pt-title">
          <PartyTitle text={t('Party Mode')} />
        </h1>
        <p className="pt-sub">{t('Friends over, or on a call? {n} games, no sign-up.', { n: all.length })}</p>
      </header>

      {featured.length > 0 && (
        <section className="flagships pt-top" aria-labelledby="pt-top-title">
          <div className="flagships-head">
            <div>
              <p className="eyebrow">⭐ {t('Start here')}</p>
              <h2 id="pt-top-title" className="flagships-title">
                {t('Top party games')}
              </h2>
            </div>
          </div>
          <ul className="flagship-row">{featured.map(card)}</ul>
        </section>
      )}

      <section className="flagships pt-all" aria-labelledby="pt-all-title">
        <div className="flagships-head">
          <div>
            <p className="eyebrow">🎉 {t('Party Mode')}</p>
            <h2 id="pt-all-title" className="flagships-title">
              {t('All party games')}
            </h2>
          </div>
          <div className="pt-all-tools">
            <button className="btn btn-sm" onClick={() => setSheet('who')}>
              👥 {t('Who’s playing?')}
              {named.length > 0 && <span className="pt-count">{named.length}</span>}
            </button>
            <button className="btn btn-sm" onClick={surprise}>
              {t('🎲 Pick for us')}
            </button>
          </div>
        </div>
        <ul className="flagship-row">{all.map(card)}</ul>
      </section>

      <section className="flagships pt-online" aria-labelledby="pt-online-title">
        <div className="flagships-head">
          <div>
            <p className="eyebrow">🌐 {t('Play together')}</p>
            <h2 id="pt-online-title" className="flagships-title">
              {t('Join a room')}
            </h2>
          </div>
        </div>
        <div className="pt-online-row">
          <div className="pt-panel">
            <p className="pt-muted">{t('Open a room, send the link, and everyone joins from their phone: no app, no sign-up. Great on a video call too.')}</p>
            <button className="btn btn-primary" onClick={() => setBrowseAll(true)}>
              🔎 {t('Browse public rooms')}
            </button>
          </div>
          <form
            className="pt-panel pt-join"
            onSubmit={(e) => {
              e.preventDefault();
              const code = joinCode.trim().toUpperCase();
              // /party?room= opens any room (Crass Act ones go on to their own page). /r/ links only work from outside the app.
              if (ROOM_CODE.test(code)) navigate(`/party?room=${code}`);
              else setJoinMsg('Check the code: five letters, like KQTRA (codes never use I, L or O).');
            }}
          >
            <h3>{t('Got a code?')}</h3>
            <div className="pt-add">
              <input className="pt-input pt-code" value={joinCode} onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setJoinMsg('');
                }} placeholder={t('ABCDE')} maxLength={5} aria-label={t('Room code')} autoCapitalize="characters" />
              <button className="pt-btn pt-btn-go" disabled={joinCode.trim().length !== 5}>
                {t('Join')}
              </button>
            </div>
            {joinMsg && (
              <p className="pt-muted" role="alert">
                {joinMsg}
              </p>
            )}
          </form>
        </div>
      </section>

      <div className="pt-extras">
        <button className="pt-extra" onClick={() => setSheet('rules')}>
          <b>{t('⚙️ House rules')}</b>
          <span>{rulesSummary}</span>
        </button>
        <button className="pt-extra" onClick={() => setSheet('custom')}>
          <b>{t('✍️ Your own prompts')}</b>
          <span>{customCount ? t('{n} saved', { n: customCount }) : t('Add inside jokes')}</span>
        </button>
      </div>
      <p className="pt-muted pt-center">{t('Everything stays on this phone. Refreshing is safe: your game picks up where you left off.')}</p>

      {sheet === 'who' && (
        <Sheet
          title={t('Who’s playing?')}
          onClose={() => {
            setSheet(null);
            setAskFor(null);
          }}
          action={
            askFor && {
              label: t('Start {game}', { game: t(all.find((g) => g.id === askFor)?.title ?? '') }),
              disabled: !!problem,
              onClick: () => {
                setSheet(null);
                onOpen(askFor);
              },
            }
          }
        >
          <section className="pt-who" aria-label={t('Who’s playing?')}>
            {named.length > 1 && (
              <button className="pt-link" onClick={shuffle}>
                {t('🔀 Shuffle order')}
              </button>
            )}
            {named.length > 0 && (
              <ul className="pt-names">
                {named.map((p) => (
                  <li key={p.id} className="pt-name-chip" style={{ ['--pc' as string]: p.color }}>
                    <Avatar player={p} size={26} />
                    <span>{p.name}</span>
                    <button onClick={() => remove(p.id)} aria-label={t('Remove {name}', { name: p.name })}>
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
                placeholder={named.length >= MAX_PLAYERS ? t('Full: {n} players is the most', { n: MAX_PLAYERS }) : named.length ? t('Add another name') : t('Type a name, then Enter')}
                maxLength={18}
                aria-label={t('New player name')}
                enterKeyHint="done"
                disabled={named.length >= MAX_PLAYERS}
                autoFocus
              />
              <button className="pt-btn" disabled={!newName.trim() || named.length >= MAX_PLAYERS}>
                {t('+ Add')}
              </button>
            </form>
            {problem && <p className="pt-warn">{problem}</p>}
          </section>
        </Sheet>
      )}
      {sheet === 'rules' && (
        <Sheet title={t('House rules')} onClose={() => setSheet(null)}>
            <div className="pt-rules">
              <p className="pt-label">{t('Content')}</p>
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
                      {t(it.label)} <small>{t(it.note)}</small>
                    </button>
                  );
                })}
              </div>
              <p className="pt-label">{t('When someone skips or loses')}</p>
              <div className="pt-seg" role="radiogroup">
                {(Object.keys(CONSEQUENCE_LABEL) as Consequence[]).map((c) => (
                  <button key={c} role="radio" aria-checked={s.consequence === c} onClick={() => setSettings({ consequence: c })}>
                    {CONSEQUENCE_LABEL[c]}
                  </button>
                ))}
              </div>
              {s.consequence === 'sips' && <p className="pt-muted">{t('Sips are always optional: water or a silly task counts the same. Never drink and drive, and know your limits.')}</p>}
              <p className="pt-label">{t('Skip these topics')}</p>
              <div className="pt-picker">
                {TAGS.map((tag) => {
                  const off = s.excludedTags.includes(tag.id);
                  return (
                    <button key={tag.id} className={`pt-chip pt-chip-off${off ? ' is-on' : ''}`} aria-pressed={off} onClick={() => setSettings({ excludedTags: off ? s.excludedTags.filter((x) => x !== tag.id) : [...s.excludedTags, tag.id] })}>
                      {off ? '🚫 ' : ''}
                      {t(tag.label)}
                    </button>
                  );
                })}
              </div>
              <p className="pt-label">{t('Session length')}</p>
              <div className="pt-seg" role="radiogroup">
                {(['quick', 'standard', 'long'] as const).map((l) => (
                  <button key={l} role="radio" aria-checked={s.length === l} onClick={() => setSettings({ length: l })}>
                    {l === 'quick' ? t('Quick') : l === 'standard' ? t('Standard') : t('Long')} <small>{t('{n} cards', { n: SESSION_CARDS[l] })}</small>
                  </button>
                ))}
              </div>
              <p className="pt-muted">{t('Anyone can skip any card, any time. Nobody has to do anything they’re not comfortable with.')}</p>
            </div>
        </Sheet>
      )}
      {sheet === 'custom' && (
        <Sheet title={t('Your own prompts')} onClose={() => setSheet(null)}>
          <CustomPrompts session={session} update={update} />
        </Sheet>
      )}
    </div>
  );
}

/** A bottom sheet over the lobby (tap outside, Escape or Done to close). */
/** A sheet over the lobby. `action` replaces its Done button (the names sheet starts the game picked). */
function Sheet({ title, onClose, action, children }: { title: string; onClose: () => void; action?: { label: string; disabled: boolean; onClick: () => void } | null; children: ReactNode }) {
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
          <button className="pt-icon" onClick={onClose} aria-label={t('Close')}>
            ✕
          </button>
        </div>
        {children}
        {action ? (
          <button className="pt-btn pt-btn-go" onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </button>
        ) : (
          <button className="pt-btn pt-btn-go" onClick={onClose}>
            {t('Done')}
          </button>
        )}
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
        {t('Challenges (one per line). Use {a} and {b} for random players.', { a: '{A}', b: '{B}' })}
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
        {t('Never Have I Ever statements (one per line)')}
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
        placeholder={t('been to a legendary backyard barbecue')}
      />
      <p className="pt-muted">{t('Saved as you type. Challenges show up in Party Prompts; statements under “Your own” in Never Have I Ever.')}</p>
    </div>
  );
}

/** A big featured card at the top of the lobby. */
/** A party game in the arcade's big card: its art, name, line, players, and the ways to play it. */
function PartyCard({ g, i, art, found, onPlay, onRoom }: { g: ShownGame; i: number; art?: { tile: string; bg: string }; found: boolean; onPlay: () => void; onRoom: () => void }) {
  const sticker = g.label || g.sticker;
  return (
    <li data-party-game={g.id} className={`flagship pop-in pt-gamecard${found ? ' is-found' : ''}`} style={{ '--i': i, '--accent': g.color } as CSSProperties}>
      <div className="flagship-art" style={{ background: art?.bg ?? g.color }}>
        {art ? (
          <img src={art.tile} alt="" width={512} height={512} {...cardImg(i < 4, i < 8)} />
        ) : (
          <span className="pt-card-emoji" aria-hidden="true">
            {g.emoji}
          </span>
        )}
        {/* Bottom corner of the art: the logos are at the top. */}
        {sticker && (
          <span className="sticker flagship-sticker" data-tone="magenta">
            {t(sticker)}
          </span>
        )}
      </div>
      <div className="flagship-body">
        <h3 className="flagship-title">{t(g.title)}</h3>
        {g.adult && <AdultLabel text={t('Adults only')} />}
        <p className="flagship-tag">{t(g.blurb)}</p>
        <p className="flagship-players mono">
          👥 {g.onePhone ? g.players : g.roomPlayers} · ⏱ {g.time}
        </p>
        <div className="pt-card-ctas">
          {g.onePhone && (
            <button className={`btn btn-sm${g.room ? '' : ' btn-primary'}`} onClick={onPlay}>
              {t('📱 One phone')}
            </button>
          )}
          {g.room && (
            <button className="btn btn-sm btn-primary" onClick={onRoom}>
              🌐 {t('Play online')}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function AdultGate({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="pt-modal" role="dialog" aria-modal="true" aria-labelledby="pt-adult">
      <div className="pt-modal-card">
        <p className="pt-modal-icon">🔞</p>
        <h2 id="pt-adult">{t('After Dark is for adults')}</h2>
        <p>{t('These cards include mature flirting, relationship and intimacy-themed prompts. Nothing is explicit, and everything stays optional and consensual.')}</p>
        <p className="pt-muted">{t('By continuing, everyone playing confirms they are 18 or older (or the age of majority where you live). This is a self-declaration, not an ID check.')}</p>
        <div className="pt-row">
          <button className="pt-btn pt-btn-go" onClick={onYes}>
            {t('We’re all 18+')}
          </button>
          <button className="pt-btn" onClick={onNo}>
            {t('Keep it clean')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The translated "Party Mode" with every word after the first in the accent color, as in "Party <span>Mode</span>". */
function PartyTitle({ text }: { text: string }) {
  const [head, ...rest] = text.split(' ');
  return rest.length ? (
    <>
      {head} <span>{rest.join(' ')}</span>
    </>
  ) : (
    <>{text}</>
  );
}
