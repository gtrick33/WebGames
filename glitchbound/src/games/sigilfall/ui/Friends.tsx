import { useEffect, useState } from 'react';
import { getGame } from '../../../catalog/catalog';
import { openSignIn } from '../../../components/openSignIn';
import { useAccount } from '../../../platform/account';
import type { FriendRow } from '../../../platform/apiTypes';
import { byPresence } from '../../../platform/friends';
import { ASKED_MS, type SigilEngine } from '../engine';
import { MAX_PLAYERS } from '../net/room';

/**
 * Friends, inside the game (the party panel shows this list; the card below is how an invitation arrives). They are
 * the player's GlitchBound friends, the same list as the site's Friends page: who is online and who is in Sigilfall
 * right now, a button to ask each into the party, and a way to add someone by the code they gave, which adds them
 * to that one list.
 */

const GAME = 'sigilfall';

/** "2 h ago", for a friend who isn't here. */
function ago(at: number, now: number): string {
  const mins = Math.floor((now - at) / 60_000);
  if (mins < 60) return 'just now';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** What a friend is doing, in a few words. */
export function friendStatus(f: FriendRow, now: number): string {
  if (f.online) return f.onlineIn === GAME ? 'In Sigilfall' : f.onlineIn ? `In ${getGame(f.onlineIn)?.title ?? 'a game'}` : 'Online';
  const game = f.lastGame ? getGame(f.lastGame) : undefined;
  return game && f.lastAt ? `Offline · played ${game.title} ${ago(f.lastAt, now)}` : 'Offline';
}

export function FriendsSection({ engine }: { engine: SigilEngine }) {
  const { me } = useAccount();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ text: string; good: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  // asked for as the panel opens (the engine keeps it fresh while the panel stays open)
  useEffect(() => {
    if (me) void engine.refreshFriends();
  }, [engine, me]);
  // (the time, for "2 h ago" and for how long a row says Invited: it moves on while the panel is open)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  if (!me) {
    return (
      <section className="rb-friends" aria-labelledby="rb-friends-h">
        <h3 id="rb-friends-h">Friends</h3>
        <p className="rb-small rb-dim">Sign in to see your GlitchBound friends here, who is online, and to invite them with a tap.</p>
        <button className="rb-btn is-small" onClick={() => openSignIn('Sign in to add friends and see who is online.')}>
          Sign in
        </button>
      </section>
    );
  }
  const { view, state, asked } = engine.friends;
  const list = view ? byPresence(view.friends, GAME) : [];
  const online = list.filter((f) => f.online).length;
  const seats = engine.party?.view?.seats.length ?? 0;
  const full = seats >= MAX_PLAYERS;
  const add = async (): Promise<void> => {
    if (busy || code.length < 4) return;
    setBusy(true);
    setSaid(null);
    const had = new Set(view?.friends.map((f) => f.id));
    const why = await engine.addFriend(code);
    setBusy(false);
    if (why) return setSaid({ text: why, good: false });
    const added = engine.friends.view?.friends.find((f) => !had.has(f.id));
    setSaid({ text: added ? `${added.nickname} is on your friends list.` : 'They are already on your friends list.', good: true });
    setCode('');
  };
  const copy = async (): Promise<void> => {
    if (!view) return;
    try {
      await navigator.clipboard.writeText(view.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no clipboard: the code is on the screen */
    }
  };
  return (
    <section className="rb-friends" aria-labelledby="rb-friends-h">
      <h3 id="rb-friends-h">
        Friends
        {view && view.friends.length > 0 && (
          <span className="rb-small rb-dim">
            {' '}
            {online} of {view.friends.length} online
          </span>
        )}
      </h3>
      {state === 'loading' && !view && <p className="rb-small rb-dim">Looking for your friends…</p>}
      {state === 'offline' && !view && (
        <p className="rb-small rb-dim">
          Your friends list can’t be reached right now.{' '}
          <button className="rb-textbtn" onClick={() => void engine.refreshFriends()}>
            Try again
          </button>
        </p>
      )}
      {view && list.length === 0 && <p className="rb-small rb-dim">Nobody yet. Give a friend your code, or type theirs below: you’ll be on each other’s list at once.</p>}
      {list.length > 0 && (
        <ul className="rb-friend-list">
          {list.map((f) => {
            const invited = now - (asked[f.id] ?? 0) < ASKED_MS;
            return (
              <li key={f.id} className={f.online ? (f.onlineIn === GAME ? 'is-here' : 'is-online') : 'is-offline'}>
                <i className="rb-friend-dot" aria-hidden="true" />
                <span className="rb-friend-who">
                  <strong>{f.nickname}</strong>
                  <span className="rb-small rb-dim">
                    Level {f.level} · {friendStatus(f, now)}
                  </span>
                </span>
                <button
                  className={`rb-btn is-small${f.online && !invited ? ' is-gold' : ''}`}
                  disabled={invited || full}
                  onClick={() => void engine.inviteFriend(f.id)}
                  aria-label={invited ? `${f.nickname} was invited` : `Invite ${f.nickname} to your party`}
                  title={full ? 'The party is full' : undefined}
                >
                  {invited ? 'Invited' : 'Invite'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > 0 && !engine.party && <p className="rb-small rb-dim">Inviting a friend opens a questing party for the two of you.</p>}
      <form
        className="rb-friend-add"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label className="rb-small" htmlFor="rb-friend-code">
          Add a friend by their code
        </label>
        <input
          id="rb-friend-code"
          className="rb-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          placeholder="ABCD2345"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
        />
        <button className="rb-btn" type="submit" disabled={busy || code.length < 4}>
          Add
        </button>
      </form>
      {said && (
        <p className={`rb-small ${said.good ? 'rb-friend-ok' : 'rb-warn'}`} role="status">
          {said.text}
        </p>
      )}
      {view && (
        <p className="rb-small rb-friend-mine">
          <span className="rb-dim">Your code</span> <strong>{view.code}</strong>
          <button className="rb-btn is-small is-ghost" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </p>
      )}
    </section>
  );
}

/**
 * A friend's invitation, as it arrives: a card over the game with their name, Join and Not now. It shows wherever the
 * player is (the hero list, the world, a menu), never takes the controls, and stays until it is answered or the
 * invitation runs out.
 */
export function InviteCards({ engine }: { engine: SigilEngine }) {
  const inv = engine.invites[0];
  if (!inv) return null;
  const more = engine.invites.length - 1;
  const inWorld = !!engine.hero && engine.ui.screen === 'game';
  const leaving = inWorld && !!engine.party && (engine.party.view?.seats.length ?? 1) > 1;
  return (
    <div className="rb-invite" role="alertdialog" aria-live="polite" aria-label={`${inv.from} invites you to their party`}>
      <p>
        <strong>{inv.from}</strong> invites you to their party
        {more > 0 && <span className="rb-small rb-dim"> · {more} more</span>}
      </p>
      {leaving && <p className="rb-small rb-dim">Joining leaves the party you’re in.</p>}
      {!inWorld && <p className="rb-small rb-dim">Choose a hero, or make one, and you’ll join them.</p>}
      <div className="rb-invite-row">
        <button className="rb-btn is-small is-gold" onClick={() => engine.acceptInvite(inv.id)}>
          Join
        </button>
        <button className="rb-btn is-small is-ghost" onClick={() => engine.declineInvite(inv.id)}>
          Not now
        </button>
      </div>
    </div>
  );
}
