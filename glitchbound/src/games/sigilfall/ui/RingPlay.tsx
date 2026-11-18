import { useEffect, useState } from 'react';
import { openSignIn } from '../../../components/openSignIn';
import { useAccount } from '../../../platform/account';
import { byPresence } from '../../../platform/friends';
import { PRESETS, SLOTS } from '../arena/abilities';
import { COMPS } from '../arena/ladder';
import { BOT_CEILING, WIN_CAP } from '../arena/ranked';
import { FORMATS, nextRank, rankOf, seasonEnds, type Format, type Standing } from '../arena/ranks';
import { PLACEMENT } from '../arena/rating';
import { bestFits, bestPreset, healerSpec, honored, slotsFor, specOf, type MateChoice, type Spec } from '../arena/teammates';
import { CLASS_IDS, CLASSES } from '../data/classes';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { classEmblem } from './classEmblem';
import { friendStatus } from './Friends';
import { ArenaChoice } from './RingArena';

/**
 * What kind of fight to find, in a layer over the Ring's main screen, all of it on one page with nothing to scroll
 * (the owner, 2026-11-17: "make the pop up with the arena choosing easier to grasp, currently i have to scroll"; and
 * 2026-11-18, "redesign this screen cuz currently it doesnt look good, keep the whole thing on one page preferably").
 *
 * On the left the fight: the format, the standing in it as a rank card (the ranked ladder's, signed in: arena/ranked.ts;
 * a practice rating on this device, not), and the team: you, then a place for each teammate, each one either a friend
 * in your party or the computer, with a way to invite a friend into it (the owner: "in the partner section where you
 * choose a partner, there should be option to invite a friend"). On the right the arena and how ranked is kept fair.
 * Along the foot the ways to play: a ranked match, a custom game with friends (no rating), the tutorial.
 */

/** Which ladder a player's matches count on: the server's ranked one, or a practice rating kept on this device. */
export type Ladder = 'ranked' | 'loading' | 'offline' | 'guest';

/** One of the party, as the layer shows them. */
export interface PartyMember {
  n: number;
  name: string;
  cls: ClassId | null;
  bar: string[];
  rating: number | null;
  you: boolean;
  online: boolean;
}

/** A party: friends who sat down together in a room to queue ranked as one team (arena/queue.ts). */
export interface PartyShown {
  code: string;
  leader: boolean;
  /** Everyone on the party's side, you first. */
  members: PartyMember[];
  connecting: boolean;
}

const setupName = (s: Spec): string => `${CLASSES[s.cls].name} (${PRESETS[s.cls][s.preset]!.name})`;

const daysLeft = (season: number, now = Date.now()): number => Math.max(1, Math.ceil((seasonEnds(season) - now) / 86_400_000));

/** The standing in the format chosen: its rating, its rank, how far to the next, and how it has gone. */
function RankCard({ standing, format, ladder }: { standing: Standing; format: Format; ladder: Ladder }) {
  const rank = rankOf(standing.best);
  const next = nextRank(standing.best);
  const played = standing.wins + standing.losses;
  const placing = ladder !== 'guest' && played < PLACEMENT;
  const pct = next ? Math.max(0, Math.min(100, ((standing.best - rank.at) / (next.at - rank.at)) * 100)) : 100;
  return (
    <div className={`rb-fight-rank is-${ladder}`} style={{ ['--r' as string]: rank.color }} data-tut="rank">
      <span className="rb-fight-crest" aria-label={`${format}v${format} rating ${standing.rating}, ${rank.name}`}>
        <b>{standing.rating}</b>
        <small>{rank.name}</small>
      </span>
      <span className="rb-fight-climb">
        <span className="rb-fight-bar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
        <small>
          {next ? `${next.name} at ${next.at}` : 'The top rank'}
          <span className="rb-fight-record">
            {' · '}
            {placing ? `placement match ${played + 1} of ${PLACEMENT}` : `${standing.wins} wins, ${standing.losses} losses`}
            {standing.streak >= 2 ? `, ${standing.streak} in a row` : ''}
          </span>
        </small>
      </span>
      {ladder === 'guest' && (
        <span className="rb-fight-practice">
          <small>Practice rating, on this device</small>
          <button className="rb-btn is-small is-gold" onClick={() => openSignIn('Sign in to play ranked in the Ring: your rating is kept by the server and shown on the rankings.')}>
            Sign in for ranked
          </button>
        </span>
      )}
    </div>
  );
}

/**
 * Your team in a 2v2 or a 3v3: you, then a place for each teammate. A friend in the party takes a place first; any
 * place left is the computer's, a class and one of its ready-made setups or Random (the team that wins most beside
 * yours: arena/teammates.ts), with a way to invite a friend into it.
 */
function TeamRow(props: { format: Format; cls: ClassId; bar: string[]; myRating: number; mates: MateChoice[]; onMates: (m: MateChoice[]) => void; party: PartyShown | null; onInvite: () => void; onLeaveParty: () => void; canInvite: boolean }) {
  const { format, cls, bar, party } = props;
  const friends = (party?.members ?? []).filter((m) => !m.you && m.cls);
  const me = specOf(cls, bar);
  const side = [me, ...friends.map((f) => specOf(f.cls!, f.bar))];
  const shown = honored(cls, props.mates);
  const slots = slotsFor(format, side.map((s) => s.cls), shown);
  const fits = bestFits(format, side, shown);
  const set = (i: number, c: MateChoice): void => props.onMates(shown.map((x, j) => (j === i ? c : x)));
  const comps = COMPS[format].filter((c) => c.team.some((t) => t.cls === cls));
  const [copied, setCopied] = useState(false);
  return (
    <div className="rb-fight-team">
      <h3>
        Your team
        {party && (
          <span className="rb-fight-partyline">
            Party <b>{party.code}</b>
            <button
              className="rb-linkbtn"
              onClick={() => {
                void navigator.clipboard?.writeText(party.code).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="rb-linkbtn" onClick={props.onLeaveParty}>
              Leave
            </button>
          </span>
        )}
      </h3>
      <div className="rb-fight-slots">
        <span className="rb-fight-slot is-you" style={{ ['--c' as string]: CLASSES[cls].colors.accent }}>
          <img src={classEmblem(cls)} alt="" draggable={false} />
          <span>
            <b>You</b>
            <small>{CLASSES[cls].name}</small>
          </span>
        </span>
        {friends.map((f) => (
          <span key={f.n} className={`rb-fight-slot is-friend${f.online ? '' : ' is-away'}`} style={{ ['--c' as string]: CLASSES[f.cls!].colors.accent }}>
            <img src={classEmblem(f.cls!)} alt="" draggable={false} />
            <span>
              <b>{f.name}</b>
              <small>
                {CLASSES[f.cls!].name}
                {f.online ? '' : ' · reconnecting'}
              </small>
            </span>
          </span>
        ))}
        {slots.map((x, i) => {
          const could = fits.map((t) => t[i]).filter((t): t is Spec => !!t);
          const names = [...new Set(could.map(setupName))];
          const heals = could.filter(healerSpec).length;
          const role = names.length === 1 ? names[0] : heals === could.length ? 'A healer' : heals === 0 ? 'Damage' : 'Healer or damage';
          return (
            <span key={`c${i}`} className={`rb-fight-slot is-cpu${x === 'random' ? ' is-any' : ''}`} style={{ ['--c' as string]: x === 'random' ? '#ffe39a' : CLASSES[x.cls].colors.accent }}>
              {x === 'random' ? (
                <i className="rb-rp-mate-any" aria-hidden="true">
                  ?
                </i>
              ) : (
                <img src={classEmblem(x.cls)} alt="" draggable={false} />
              )}
              <span className="rb-fight-cpu">
                <select
                  aria-label={`Teammate ${friends.length + i + 1}: the computer`}
                  value={x === 'random' ? 'random' : x.cls}
                  disabled={!!party && !party.leader}
                  onChange={(e) => {
                    const v = e.target.value;
                    set(i, v === 'random' ? 'random' : { cls: v as ClassId, preset: bestPreset(me, v as ClassId) });
                  }}
                >
                  <option value="random">Best fit</option>
                  {CLASS_IDS.filter((c) => !side.some((s) => s.cls === c)).map((c) => (
                    <option key={c} value={c} disabled={slots.some((o, j) => j !== i && o !== 'random' && o.cls === c)}>
                      {CLASSES[c].name}
                    </option>
                  ))}
                </select>
                {x === 'random' ? (
                  <small title={`Best beside your ${PRESETS[cls][me.preset]!.name}: ${names.join(', ')}`}>{role}</small>
                ) : (
                  <select aria-label={`Teammate ${friends.length + i + 1}'s build`} value={x.preset} disabled={!!party && !party.leader} onChange={(e) => set(i, { cls: x.cls, preset: Number(e.target.value) })}>
                    {PRESETS[x.cls].map((p, n) => (
                      <option key={p.id} value={n}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </span>
              {props.canInvite && (
                <button className="rb-fight-invite-btn" onClick={props.onInvite} title="Invite a friend into this place: you queue ranked together" aria-label="Invite a friend">
                  <span aria-hidden="true">+</span> Invite
                </button>
              )}
            </span>
          );
        })}
      </div>
      {!party &&
        comps.length > 0 && (
          <div className="rb-rp-comps rb-fight-comps">
            <small>Teams that work:</small>
            {comps.map((c) => (
              <button key={c.name} title={c.blurb} className="rb-rs-build" onClick={() => props.onMates(c.team.filter((t) => t.cls !== cls).map((t) => ({ cls: t.cls, preset: t.preset })))}>
                {c.name}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}

/** How ranked is kept fair, in a few lines, over the layer (arena/ranked.ts has the rules). */
function FairPlay({ ladder, onClose }: { ladder: Ladder; onClose: () => void }) {
  return (
    <div className="rb-ring-dialog-wrap rb-fight-fairwrap" role="dialog" aria-modal="true" aria-label="Fair play in ranked" onClick={onClose}>
      <div className="rb-ring-dialog rb-fight-fair" onClick={(e) => e.stopPropagation()}>
        <h2>Fair play in ranked</h2>
        <ul>
          <li>{ladder === 'guest' ? 'Signed in, your rating is kept by the server and shown on the rankings.' : 'Your rating is kept by the server and shown on the rankings.'} Every player’s game has to agree on who won.</li>
          <li>Matches against a friend, someone on your network, or your own other account don’t count.</li>
          <li>The same opponent counts for half after two matches in a day, and for nothing after four.</li>
          <li>Leaving a match costs a loss and a half: the room itself sees who left.</li>
          <li>A party of any ratings is matched at its middle one, and each of you wins and loses by your own: the stronger player wins a little and loses a lot, the weaker one the other way round. Nobody wins more than {WIN_CAP} in one match. From {BOT_CEILING}, only matches against people count.</li>
        </ul>
        <button className="rb-btn is-small is-gold" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}

export function PlayLayer(props: {
  format: Format;
  onFormat: (f: Format) => void;
  standing: (f: Format) => Standing;
  ladder: Ladder;
  season: number;
  pick: ClassId;
  bar: string[];
  mates: MateChoice[];
  onMates: (m: MateChoice[]) => void;
  map: string;
  onMap: (id: string) => void;
  note: string;
  ready: boolean;
  barred: boolean;
  party: PartyShown | null;
  onInvite: () => void;
  onLeaveParty: () => void;
  onFind: () => void;
  onCustom: () => void;
  onTutorial: () => void;
  onClose: () => void;
}) {
  const { format, bar, party, ladder } = props;
  const standing = props.standing(format);
  const rank = rankOf(standing.best);
  const follower = !!party && !party.leader;
  const [fair, setFair] = useState(false);
  const label = !props.ready ? `Choose ${SLOTS - bar.length} more abilities` : props.barred ? 'No healers in 1v1' : follower ? 'The party leader starts the search' : `Find a ${ladder === 'guest' ? '' : 'ranked '}${format}v${format} match`;
  return (
    <div className="rb-ring-dialog-wrap rb-ringvl-playwrap" role="dialog" aria-modal="true" aria-label="Choose your fight" onClick={props.onClose}>
      <div className="rb-ring-dialog rb-ringvl-play rb-fight" onClick={(e) => e.stopPropagation()} style={{ ['--r' as string]: rank.color }}>
        <header className="rb-ringvl-playhead rb-fight-head">
          <span className={`rb-fight-badge is-${ladder}`}>{ladder === 'guest' ? 'Practice' : 'Ranked'}</span>
          <h2>Choose your fight</h2>
          <small className="rb-fight-season">
            <button className="rb-linkbtn" onClick={() => setFair(true)}>
              Fair play
            </button>
            {' · '}Season {props.season}, {daysLeft(props.season)} days left
            {ladder === 'offline' ? ' · ranked is out of reach' : ''}
          </small>
          <button className="rb-iconbtn" onClick={props.onClose} aria-label="Close" title="Close">
            ✕
          </button>
        </header>
        <div className="rb-ringvl-playbody rb-fight-body">
          <section className="rb-ringvl-playfight rb-fight-left" aria-label="The fight">
            <div className="rb-rp-formats rb-fight-formats" role="radiogroup" aria-label="Format" data-tut="formats">
              {FORMATS.map((f) => {
                const st = props.standing(f);
                const r = rankOf(st.best);
                // (a party is a team: no 1v1 while in one, and the format is its leader's to choose)
                const shut = !!party && (f === 1 || follower);
                return (
                  <button key={f} role="radio" aria-checked={f === format} aria-disabled={shut || undefined} title={party && f === 1 ? 'A party plays 2v2 or 3v3' : follower ? 'The party leader chooses' : undefined} className={`rb-rp-format${f === format ? ' is-on' : ''}${shut && f !== format ? ' is-shut' : ''}`} style={{ ['--r' as string]: r.color }} onClick={() => !shut && props.onFormat(f)}>
                    <strong>
                      {f}v{f}
                    </strong>
                    <b>{st.rating}</b>
                    <small>{r.name}</small>
                  </button>
                );
              })}
            </div>
            <RankCard standing={standing} format={format} ladder={ladder} />
            {format > 1 ? (
              <TeamRow format={format} cls={props.pick} bar={bar} myRating={standing.mmr ?? standing.rating} mates={props.mates} onMates={props.onMates} party={party} onInvite={props.onInvite} onLeaveParty={props.onLeaveParty} canInvite={ladder !== 'guest' && (!party || party.leader)} />
            ) : (
              <p className="rb-fight-solo">Just you. {props.barred ? 'Healers can’t enter 1v1.' : 'Invite a friend in 2v2 or 3v3 to queue as a team.'}</p>
            )}
          </section>
          <section className="rb-fight-right">
            {follower ? (
              <p className="rb-fight-solo">The party leader chooses the arena and starts the search. You’ll see it here.</p>
            ) : (
              <ArenaChoice map={props.map} onPick={props.onMap} />
            )}
          </section>
        </div>
        {props.note && (
          <p className="rb-rp-error" role="status">
            {props.note}
          </p>
        )}
        <footer className="rb-ringvl-playfoot rb-fight-foot">
          <button className={`rb-btn is-gold is-big${props.barred || follower ? ' is-barred' : ''}`} onClick={props.onFind} aria-disabled={props.barred || follower || undefined}>
            {label}
          </button>
          <button className="rb-btn" onClick={props.onCustom} title="A private room for friends: any sides, any format, and no rating changes hands">
            Custom game
          </button>
          <button className="rb-btn" onClick={props.onTutorial} data-tut="tutorial">
            Tutorial
          </button>
        </footer>
      </div>
      {fair && <FairPlay ladder={ladder} onClose={() => setFair(false)} />}
    </div>
  );
}

/**
 * Inviting a friend into the party: the GlitchBound friends list (who is online, and in Sigilfall, first), a button to
 * ask each one, the party's code for anyone else, and a way to join a friend's party by theirs.
 */
export function InviteDialog({ engine, format, code, asked, onInvite, onJoin, onClose }: { engine: SigilEngine; format: Format; code: string | null; asked: Record<string, number>; onInvite: (id: string) => void; onJoin: (code: string) => void; onClose: () => void }) {
  const { me } = useAccount();
  const [typed, setTyped] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (me) void engine.refreshFriends();
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (me) void engine.refreshFriends();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [engine, me]);
  const view = engine.friends.view;
  const list = view ? byPresence(view.friends, 'sigilfall') : [];
  return (
    <div className="rb-ring-dialog-wrap" role="dialog" aria-modal="true" aria-label="Invite a friend" onClick={onClose}>
      <div className="rb-ring-dialog rb-fight-invite" onClick={(e) => e.stopPropagation()}>
        <h2>Invite a friend</h2>
        <p>
          They join your team and you queue ranked {format === 1 ? '2v2 or 3v3' : `${format}v${format}`} together. Any ratings: the party is matched at its middle one, and each of you wins and loses by your own.
        </p>
        {!me ? (
          <button className="rb-btn is-gold" onClick={() => openSignIn('Sign in to invite friends and play ranked together.')}>
            Sign in
          </button>
        ) : engine.friends.state === 'loading' && !view ? (
          <p className="rb-small rb-dim">Loading your friends…</p>
        ) : list.length ? (
          <ul className="rb-fight-friends">
            {list.map((f) => {
              const sent = now - (asked[f.id] ?? 0) < 60_000;
              return (
                <li key={f.id} className={f.online ? 'is-online' : ''}>
                  <span>
                    <b>{f.nickname}</b>
                    <small>{friendStatus(f, now)}</small>
                  </span>
                  <button className={`rb-btn is-small${f.online ? ' is-gold' : ''}`} disabled={sent} onClick={() => onInvite(f.id)}>
                    {sent ? 'Invited' : 'Invite'}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rb-small rb-dim">No friends on your list yet. Add them from the party panel or the site’s Friends page, or share your party code.</p>
        )}
        {code && (
          <p className="rb-fight-code">
            Party code <b>{code}</b>
          </p>
        )}
        <form
          className="rb-rp-join rb-fight-join"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onJoin(typed.trim().toUpperCase());
          }}
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder="Party code" aria-label="Party code" maxLength={8} autoComplete="off" spellCheck={false} />
          <button type="submit" className="rb-btn" disabled={!typed.trim()}>
            Join
          </button>
        </form>
        <button className="rb-btn is-small" onClick={onClose} autoFocus>
          Done
        </button>
      </div>
    </div>
  );
}
