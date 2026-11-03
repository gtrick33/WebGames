import { api, useAccount } from '../../../platform/account';
import type { FriendsView } from '../../../platform/apiTypes';
import { useEffect, useState } from 'react';
import { CLASSES } from '../data/classes';
import { KEY_MIN, keyAffixes, KEY_AFFIXES, weekOf } from '../data/keystones';
import { REGION_IDS, REGIONS } from '../data/regions';
import type { ClassId, RegionId } from '../data/types';
import type { SigilEngine } from '../engine';
import { COOP_LEVEL, MAX_PLAYERS } from '../net/room';
import { Frame } from './common';

/**
 * Play together (net/room.ts, net/coop.ts): start a party or join one by its code, share the invite, see
 * who is in, and (the party leader) choose the dungeon and the Riftstone level and start the run. Everyone
 * then fights in the same run, each on their own device.
 */

/** Friends from the site's list, a tap each to ask them in: they see it on any page they have open. */
function FriendInvitePicker({ code }: { code: string }) {
  const { me } = useAccount();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendsView['friends'] | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  if (!me) return null;
  const toggle = (): void => {
    setOpen(!open);
    if (friends) return;
    api<FriendsView>('/api/friends')
      .then((v) => setFriends(v.friends))
      .catch(() => setFriends([]));
  };
  const ask = (id: string): void => {
    setAsked((a) => [...a, id]);
    void api('/api/friends', { body: { action: 'invite', id, game: 'sigilfall', code } }).catch(() => setAsked((a) => a.filter((x) => x !== id)));
  };
  return (
    <div className="rb-party-friends">
      <button className="rb-btn is-small is-ghost" onClick={toggle} aria-expanded={open}>
        Invite a friend
      </button>
      {open && (
        <ul>
          {friends?.length === 0 && <li className="rb-small">No friends yet. Add them under Friends on your profile.</li>}
          {friends?.map((f) => (
            <li key={f.id}>
              <span>{f.nickname}</span>
              <button className="rb-btn is-small" disabled={asked.includes(f.id)} onClick={() => ask(f.id)}>
                {asked.includes(f.id) ? 'Asked' : 'Ask'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PartyPanel({ engine }: { engine: SigilEngine }) {
  const party = engine.party;
  return (
    <Frame title="Play together" onClose={() => engine.closePanel()} className="rb-panel-party">
      {party ? <Lobby engine={engine} /> : <NoParty engine={engine} />}
    </Frame>
  );
}

function NoParty({ engine }: { engine: SigilEngine }) {
  const left = engine.partyLeft;
  const [code, setCode] = useState(left?.code ?? '');
  const why = engine.partyReady();
  const riftstone = (
    <section className="rb-party-mode" key="rift">
      <strong>Riftstone together</strong>
      <p className="rb-small">
        Up to {MAX_PLAYERS} level-{COOP_LEVEL} heroes run a Riftstone, each on their own device: the same enemies, the same clock, and every hero takes their own experience and loot from each kill.
      </p>
      <button className="rb-btn is-gold" disabled={!!why} onClick={() => void engine.createParty('rift')}>
        Start a Riftstone party
      </button>
      {why && <span className="rb-small rb-dim">{why}</span>}
    </section>
  );
  const questing = (
    <section className="rb-party-mode" key="quest">
      <strong>Quest together</strong>
      <p className="rb-small">
        Level up with friends at any level. The hero furthest behind in the story leads, and the others see their world and follow them. Quests a hero has already finished give them nothing
        again; everything else counts for everyone.
      </p>
      <button className={`rb-btn${why ? ' is-gold' : ''}`} onClick={() => void engine.createParty('party')}>
        Start a questing party
      </button>
    </section>
  );
  return (
    <div className="rb-party">
      {left && (
        <p className="rb-warn rb-party-note" role="status">
          {left.why}
        </p>
      )}
      {/* the one this hero can start comes first */}
      {why ? [questing, riftstone] : [riftstone, questing]}
      <form
        className="rb-party-join"
        onSubmit={(e) => {
          e.preventDefault();
          engine.joinParty(code);
        }}
      >
        <label className="rb-small" htmlFor="rb-party-code">
          Got a code from a friend?
        </label>
        <input id="rb-party-code" className="rb-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6))} placeholder="ABCDE" autoComplete="off" spellCheck={false} />
        <button className="rb-btn" type="submit" disabled={code.length < 4}>
          {left && code === left.code ? 'Try again' : 'Join'}
        </button>
      </form>
    </div>
  );
}

function Lobby({ engine }: { engine: SigilEngine }) {
  const party = engine.party!;
  const v = party.view;
  const [sent, setSent] = useState<'' | 'Link copied' | 'Shared'>('');
  const [leaving, setLeaving] = useState(false);
  if (!v) return <p className="rb-dim">{party.state === 'reconnecting' ? 'Reconnecting…' : 'Joining the party…'}</p>;
  const host = v.you === v.host;
  const me = v.seats.find((s) => s.you);
  const h = engine.hero!;
  const link = `${location.origin}/r/${v.code}`;
  const here = v.seats.filter((s) => s.online);
  const rift = v.mode === 'rift';
  const notReady = here.find((s) => !s.card || (rift && s.card.level < COOP_LEVEL));
  const lead = v.seats.find((s) => s.n === v.lead);
  const share = async (): Promise<void> => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Sigilfall party', text: `Join my Sigilfall party: code ${v.code}`, url: link });
        setSent('Shared');
        return;
      } catch (e) {
        // closed by the player: nothing to do; any other failure falls back to copying the link
        if ((e as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setSent('Link copied');
    } catch {
      /* no clipboard either: the code is on screen */
    }
  };
  // leaving as the leader: a Riftstone run ends for everyone; questing, the next hero behind leads
  const leading = v.phase === 'run' && v.lead === v.you && here.length > 1;
  const leaveWarn = leading ? (rift ? 'This ends the run for the whole party.' : 'The party goes on: the hero furthest behind in the story leads.') : '';
  return (
    <div className="rb-party">
      {party.note && (
        <p className="rb-small rb-party-note" role="status">
          {party.note}
        </p>
      )}
      <div className="rb-party-code">
        <span className="rb-kicker">Party code</span>
        <strong>{v.code}</strong>
        <button className="rb-btn is-small" onClick={() => void share()}>
          {sent || 'Invite'}
        </button>
      </div>
      <FriendInvitePicker code={v.code} />
      <ul className="rb-party-seats" aria-label="The party">
        {v.seats.map((s) => (
          <li key={s.n} className={`${s.online ? '' : 'is-away'}${s.you ? ' is-you' : ''}`}>
            <span className="rb-party-name">
              {s.card?.name ?? s.name}
              {/* the host runs the lobby; in a run, the hero who leads is the one everyone follows */}
              {v.phase === 'run' ? s.n === v.lead && <b className="rb-party-lead"> · leads</b> : s.host && <b className="rb-party-lead"> · host</b>}
              {s.you && <span className="rb-dim"> (you)</span>}
            </span>
            <span className="rb-small rb-dim">
              {s.card ? `Level ${s.card.level}${s.card.para ? ` · P${s.card.para}` : ''} ${CLASSES[s.card.cls as ClassId]?.name ?? ''}${rift ? ` · Riftstone +${s.card.keystone}` : ` · ${s.card.story} story quests`}` : 'choosing a hero…'}
              {v.phase === 'run' && s.host && s.n !== v.lead && ' · host'}
              {!s.online && ' · away'}
            </span>
            {host && !s.you && (
              <button className="rb-btn is-small is-ghost" onClick={() => engine.kickFromParty(s.n)} aria-label={`Remove ${s.name} from the party`}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {host && v.phase === 'lobby' && (
        <div className="rb-seg" role="group" aria-label="What the party does">
          <button className={rift ? 'is-on' : ''} onClick={() => engine.setPartyMode('rift')}>
            Riftstone run
          </button>
          <button className={!rift ? 'is-on' : ''} onClick={() => engine.setPartyMode('party')}>
            Quest together
          </button>
        </div>
      )}
      {v.phase === 'run' ? (
        <p className="rb-gold">
          {rift
            ? `In a run: ${v.plan ? `${REGIONS[v.plan.region as RegionId]?.name ?? v.plan.region} · Riftstone +${v.plan.key}` : ''}. Close this to fight.`
            : `Questing together, led by ${lead?.card?.name ?? lead?.name ?? 'the party'}${lead && !lead.online ? ' (connection lost: waiting for them)' : ''}. Everyone travels with them, in their story.`}
        </p>
      ) : !rift ? (
        <p className="rb-small">Questing together: when the run starts, the hero furthest behind in the story leads, the others follow them in their world. Quests a hero already finished give them nothing again.</p>
      ) : host ? (
        <PlanPicker engine={engine} />
      ) : (
        <p className="rb-small">{v.plan ? `The leader chose ${REGIONS[v.plan.region as RegionId]?.name ?? v.plan.region} at Riftstone +${v.plan.key}. Waiting for them to start.` : 'Waiting for the leader to choose the dungeon.'}</p>
      )}
      {rift && me?.card && me.card.level < COOP_LEVEL && <p className="rb-warn">Riftstone runs are for level-{COOP_LEVEL} heroes: this one can’t go along. Choose another hero, or level this one up.</p>}
      {party.error && <p className="rb-warn">{party.error}</p>}
      <div className="rb-party-actions">
        {host && v.phase === 'lobby' && (
          <button className="rb-btn is-gold" disabled={(rift && !v.plan) || !!notReady} onClick={() => engine.startPartyRun()}>
            {rift ? 'Start the run' : 'Set out together'}
          </button>
        )}
        {host && notReady && <span className="rb-small rb-dim">{notReady.card ? `${notReady.card.name} needs level ${COOP_LEVEL}.` : `${notReady.name} is choosing a hero.`}</span>}
        {leaving && leaveWarn ? (
          <button className="rb-btn is-danger" onClick={() => engine.leaveParty()}>
            Leave? {leaveWarn}
          </button>
        ) : (
          <button className="rb-btn is-ghost" onClick={() => (leaveWarn ? setLeaving(true) : engine.leaveParty())}>
            Leave the party
          </button>
        )}
        {(host || v.lead === v.you) && v.phase === 'run' && !rift && (
          <button className="rb-btn" onClick={() => engine.gatherParty()}>
            Gather back in town
          </button>
        )}
      </div>
      {party.state === 'reconnecting' && <p className="rb-small rb-dim">Connection lost: reconnecting…</p>}
      <p className="rb-small rb-dim">Playing as {h.name}.</p>
    </div>
  );
}

/** The leader's choice: a dungeon (any the leader has found) and a level (any the leader has opened). */
function PlanPicker({ engine }: { engine: SigilEngine }) {
  const v = engine.party!.view!;
  const h = engine.hero!;
  const dungeons = REGION_IDS.filter((id) => REGIONS[id].kind === 'dungeon' && h.unlocked.includes(id));
  const region = (v.plan?.region as RegionId | undefined) ?? dungeons[dungeons.length - 1] ?? 'crypt';
  const key = Math.min(v.plan?.key ?? h.keystone, h.keystone);
  const set = (r: RegionId, k: number): void => engine.setPartyPlan(r, Math.max(KEY_MIN, Math.min(h.keystone, k)));
  // a plan from the start: the deepest dungeon found, at the leader's highest level
  const planned = !!v.plan;
  useEffect(() => {
    if (!planned) {
      const t = window.setTimeout(() => set(region, key), 600);
      return () => window.clearTimeout(t);
    }
  }, [planned]); // eslint-disable-line react-hooks/exhaustive-deps
  const [week] = useState(() => weekOf(Date.now()));
  const affixes = keyAffixes(key, week);
  return (
    <div className="rb-party-plan">
      <label className="rb-small" htmlFor="rb-party-dungeon">
        Dungeon
      </label>
      <select id="rb-party-dungeon" className="rb-input" value={region} onChange={(e) => set(e.target.value as RegionId, key)}>
        {dungeons.map((id) => (
          <option key={id} value={id}>
            {REGIONS[id].name}
          </option>
        ))}
      </select>
      <div className="rb-key-row">
        <button className="rb-btn is-small" aria-label="One level lower" disabled={key <= KEY_MIN} onClick={() => set(region, key - 1)}>
          −
        </button>
        <strong className="rb-key-lvl">Riftstone +{key}</strong>
        <button className="rb-btn is-small" aria-label="One level higher" disabled={key >= h.keystone} onClick={() => set(region, key + 1)}>
          +
        </button>
      </div>
      {affixes.length > 0 && <span className="rb-small rb-dim">This week: {affixes.map((a) => KEY_AFFIXES[a].name).join(' · ')}</span>}
    </div>
  );
}
