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
export function PartyPanel({ engine }: { engine: SigilEngine }) {
  const party = engine.party;
  return (
    <Frame title="Play together" onClose={() => engine.closePanel()} className="rb-panel-party">
      {party ? <Lobby engine={engine} /> : <NoParty engine={engine} />}
    </Frame>
  );
}

function NoParty({ engine }: { engine: SigilEngine }) {
  const [code, setCode] = useState('');
  const why = engine.partyReady();
  return (
    <div className="rb-party">
      <p>
        Run a Riftstone with up to {MAX_PLAYERS - 1} friends, each on their own device. The party leader chooses the dungeon and the level; everyone fights the same enemies against the
        same clock, and every hero takes their own experience and loot from each kill. Every hero needs level {COOP_LEVEL}.
      </p>
      <div className="rb-party-actions">
        <button className="rb-btn is-gold" disabled={!!why} onClick={() => void engine.createParty()}>
          Start a party
        </button>
        {why && <span className="rb-small rb-dim">{why}</span>}
      </div>
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
          Join
        </button>
      </form>
    </div>
  );
}

function Lobby({ engine }: { engine: SigilEngine }) {
  const party = engine.party!;
  const v = party.view;
  const [copied, setCopied] = useState(false);
  if (!v) return <p className="rb-dim">{party.state === 'reconnecting' ? 'Reconnecting…' : 'Joining the party…'}</p>;
  const host = v.you === v.host;
  const me = v.seats.find((s) => s.you);
  const h = engine.hero!;
  const link = `${location.origin}/r/${v.code}`;
  const here = v.seats.filter((s) => s.online);
  const notReady = here.find((s) => !s.card || s.card.level < COOP_LEVEL);
  const share = async (): Promise<void> => {
    try {
      if (navigator.share) await navigator.share({ title: 'Sigilfall party', text: `Join my Sigilfall party: code ${v.code}`, url: link });
      else await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* the share sheet was closed */
    }
  };
  return (
    <div className="rb-party">
      <div className="rb-party-code">
        <span className="rb-kicker">Party code</span>
        <strong>{v.code}</strong>
        <button className="rb-btn is-small" onClick={() => void share()}>
          {copied ? 'Link copied' : 'Invite'}
        </button>
      </div>
      <ul className="rb-party-seats" aria-label="The party">
        {v.seats.map((s) => (
          <li key={s.n} className={`${s.online ? '' : 'is-away'}${s.you ? ' is-you' : ''}`}>
            <span className="rb-party-name">
              {s.card?.name ?? s.name}
              {s.host && <b className="rb-party-lead"> · leader</b>}
              {s.you && <span className="rb-dim"> (you)</span>}
            </span>
            <span className="rb-small rb-dim">
              {s.card ? `Level ${s.card.level}${s.card.para ? ` · P${s.card.para}` : ''} ${CLASSES[s.card.cls as ClassId]?.name ?? ''} · Riftstone +${s.card.keystone}` : 'choosing a hero…'}
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
      {v.phase === 'run' ? (
        <p className="rb-gold">
          In a run: {v.plan ? `${REGIONS[v.plan.region as RegionId]?.name ?? v.plan.region} · Riftstone +${v.plan.key}` : ''}. Close this to fight.
        </p>
      ) : host ? (
        <PlanPicker engine={engine} />
      ) : (
        <p className="rb-small">{v.plan ? `The leader chose ${REGIONS[v.plan.region as RegionId]?.name ?? v.plan.region} at Riftstone +${v.plan.key}. Waiting for them to start.` : 'Waiting for the leader to choose the dungeon.'}</p>
      )}
      {me?.card && me.card.level < COOP_LEVEL && <p className="rb-warn">Riftstone runs are for level-{COOP_LEVEL} heroes: this one can’t go along. Choose another hero, or level this one up.</p>}
      {party.error && <p className="rb-warn">{party.error}</p>}
      <div className="rb-party-actions">
        {host && v.phase === 'lobby' && (
          <button className="rb-btn is-gold" disabled={!v.plan || !!notReady || here.length < 1} onClick={() => engine.startPartyRun()}>
            Start the run
          </button>
        )}
        {host && notReady && <span className="rb-small rb-dim">{notReady.card ? `${notReady.card.name} needs level ${COOP_LEVEL}.` : `${notReady.name} is choosing a hero.`}</span>}
        <button className="rb-btn is-ghost" onClick={() => engine.leaveParty()}>
          Leave the party
        </button>
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
