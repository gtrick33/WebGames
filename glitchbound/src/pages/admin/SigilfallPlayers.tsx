import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { CLASSES, MAX_LEVEL, xpToNext } from '../../games/sigilfall/data/classes';
import { ITEMS } from '../../games/sigilfall/data/items';
import { MOUNT_DEFS } from '../../games/sigilfall/data/mounts';
import { QUEST_DEFS } from '../../games/sigilfall/data/quests';
import { REGIONS } from '../../games/sigilfall/data/regions';
import { SKILLS } from '../../games/sigilfall/data/skills';
import { TALENTS } from '../../games/sigilfall/data/talents';
import { RARITIES, SLOTS, type ClassId, type Item, type RegionId } from '../../games/sigilfall/data/types';
import { bagSize, freePoints, PERKS, spentPoints, talentPoints, type Character } from '../../games/sigilfall/progress/character';
import { fmtStat } from '../../games/sigilfall/progress/describe';
import { itemName, itemStats } from '../../games/sigilfall/progress/items';
import { validateCharacter } from '../../games/sigilfall/progress/save';
import { api, ApiError } from '../../platform/account';
import type { GmOrderView, GmOverview, GmPlayerDetail, GmPlayerRow } from '../../platform/apiTypes';
import { Link, navigate, useLocation } from '../../router/router';
import './SigilfallPlayers.css';

/**
 * Admin › Sigilfall › Players: every signed-in player with a save on the server, and for each of their heroes what a
 * game master needs: level, gold, gear, bag, talents, quests, dungeons, bosses, mounts, the Ring and the Vigil. Orders
 * filed here wait on the server until the player's own game carries them out (progress/gm.ts). Guests' heroes never
 * leave their device, as the Privacy page promises; they show up here once the player signs in.
 */

const when = (ms: number): string => (ms ? new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never');
const ago = (ms: number): string => {
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 2) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
};
const hours = (seconds: number): string => {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`;
};
const classOf = (cls: string): string => CLASSES[cls as ClassId]?.name ?? cls;
const errorText = (e: unknown, fallback: string): string => (e instanceof ApiError ? (e.message && e.message !== e.code ? e.message : fallback) : 'Network error. Try again.');
const TIERS = ['Normal', 'Heroic', 'Mythic'];

/** The section's two pages, by address, so a player's page can be linked and reloaded. */
export function SigilfallPlayers() {
  const { search } = useLocation();
  const player = new URLSearchParams(search).get('player');
  return player ? <PlayerPage key={player} id={player} /> : <PlayerList />;
}

/* ------------------------------------------------------------------ everyone */

const SORTS = [
  { id: 'recent', label: 'Played last' },
  { id: 'level', label: 'Highest level' },
  { id: 'time', label: 'Most time played' },
  { id: 'joined', label: 'Newest members' },
];

interface ListResponse {
  overview: GmOverview;
  rows: GmPlayerRow[];
  total: number;
  page: number;
}

function PlayerList() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState('recent');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let on = true;
    api<ListResponse>(`/api/admin/sigilfall/players?q=${encodeURIComponent(term)}&sort=${sort}&offset=${offset}`).then(
      (r) => {
        if (!on) return;
        setData(r);
        setError('');
      },
      (e: unknown) => on && setError(errorText(e, 'Could not load the players.')),
    );
    return () => {
      on = false;
    };
  }, [term, sort, offset]);

  const o = data?.overview;
  return (
    <section className="panel info-block gm" aria-labelledby="gm-players">
      <div className="admin-row">
        <h2 id="gm-players">
          <Icon name="user" /> Players
        </h2>
        <span className="mono info-small">game master tools</span>
      </div>
      <p className="info-small">
        Every signed-in player with a hero on the server. Open one to see their heroes’ progress, gear, talents, quests and dungeons, and to help them out. What you do waits until their game next
        checks, about a minute if they’re playing, and is written to the change log. Guests’ heroes stay on their own device until they sign in.
      </p>
      {o && (
        <>
          <div className="gm-tiles">
            <Tile label="Players" value={o.players} />
            <Tile label="Playing now" value={o.online} tone={o.online ? 'on' : undefined} />
            <Tile label="Played this week" value={o.active7d} />
            <Tile label="Heroes" value={o.heroes} />
            <Tile label="Orders waiting" value={o.waiting} />
          </div>
          {o.classes.length > 0 && (
            <ul className="gm-classes" aria-label="Heroes by class">
              {o.classes.map((c) => (
                <li key={c.cls}>
                  <b>{classOf(c.cls)}</b> {c.heroes} <span className="info-small">avg {c.avgLevel} · top {c.topLevel}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <form
        className="gm-search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setOffset(0);
          setTerm(q.trim());
        }}
      >
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nickname, email, hero name or player id" aria-label="Find a player" maxLength={80} />
        <select
          className="field"
          aria-label="Order"
          value={sort}
          onChange={(e) => {
            setOffset(0);
            setSort(e.target.value);
          }}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm">
          <Icon name="search" size={16} /> Find
        </button>
      </form>
      {error && <p className="info-small" role="alert">{error}</p>}
      {data && data.rows.length === 0 && <p className="info-small">{term ? 'No player matches that.' : 'No signed-in player has made a hero yet.'}</p>}
      {data && data.rows.length > 0 && (
        <ul className="gm-list">
          {data.rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin?tab=sections&player=${encodeURIComponent(r.id)}`} className="gm-row">
                <span className="gm-who">
                  <b>
                    {r.online && <i className="gm-dot" title="Playing now" />}
                    {r.nickname}
                  </b>
                  <span className="info-small">{r.email}</span>
                </span>
                <span className="gm-heroes">
                  {r.heroes.length === 0 && <span className="info-small">No heroes right now</span>}
                  {r.heroes.map((h) => (
                    <span key={h.slot} className="gm-hero-chip" title={`${classOf(h.cls)}, ${hours(h.time)} played`}>
                      <b>{h.name}</b> {classOf(h.cls)} {h.level}
                    </span>
                  ))}
                </span>
                <span className="gm-when">
                  {r.banned && <span className="gm-chip is-warn">Banned</span>}
                  <span className="mono info-small">{r.online ? 'playing now' : ago(r.savedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > data.page && (
        <div className="gm-pages">
          <button className="btn btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - data.page))}>
            Newer
          </button>
          <span className="mono info-small">
            {offset + 1}–{Math.min(offset + data.page, data.total)} of {data.total}
          </span>
          <button className="btn btn-sm" disabled={offset + data.page >= data.total} onClick={() => setOffset(offset + data.page)}>
            Older
          </button>
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: ReactNode; tone?: 'on' | 'warn' }) {
  return (
    <div className={`gm-tile${tone ? ` is-${tone}` : ''}`}>
      <small className="mono">{label}</small>
      <b>{value}</b>
    </div>
  );
}

/* ------------------------------------------------------------------ one player */

function PlayerPage({ id }: { id: string }) {
  const { search } = useLocation();
  const asked = Number(new URLSearchParams(search).get('hero') ?? '');
  const [data, setData] = useState<GmPlayerDetail | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(
    () =>
      api<{ player: GmPlayerDetail }>(`/api/admin/sigilfall/players/${encodeURIComponent(id)}`).then(
        (r) => {
          setData(r.player);
          setError('');
        },
        (e: unknown) => setError(errorText(e, 'Could not open that player.')),
      ),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const heroes = useMemo(() => {
    const raw = (data?.save as { heroes?: unknown[] } | null)?.heroes;
    if (!Array.isArray(raw)) return [] as (Character | null)[];
    return raw.map((h, i) => (h ? validateCharacter(h, i) : null));
  }, [data]);
  const slot = heroes[asked] ? asked : Math.max(0, heroes.findIndex((h) => h));
  const hero = heroes[slot] ?? null;

  const send = useCallback(
    async (body: Record<string, unknown>, done: string): Promise<boolean> => {
      try {
        await api('/api/admin/sigilfall/orders', { body: { userId: id, ...body } });
        setToast(done);
        await load();
        return true;
      } catch (e) {
        setToast(errorText(e, 'That didn’t work.'));
        return false;
      }
    },
    [id, load],
  );
  const order = useCallback(
    (kind: string, payload: Record<string, unknown>, label: string, note: string): Promise<boolean> =>
      send({ action: 'file', slot, created: hero?.created ?? 0, heroName: hero?.name ?? '', kind, payload, label, note }, 'Order filed. It reaches the player when their game next checks.'),
    [send, slot, hero],
  );

  if (error && !data) {
    return (
      <section className="panel info-block gm">
        <BackLink />
        <p className="info-lead" role="alert">
          {error}
        </p>
      </section>
    );
  }
  if (!data) return <p className="info-lead">Loading the player…</p>;
  return (
    <div className="gm">
      <p className="ag-toast" role="status" aria-live="polite">
        {toast}
      </p>
      <section className="panel info-block" aria-labelledby="gm-name">
        <BackLink />
        <div className="gm-head">
          <div>
            <h2 id="gm-name">
              {data.online && <i className="gm-dot" title="Playing now" />}
              {data.nickname}
            </h2>
            <p className="info-small">
              {data.email} · member since {when(data.createdAt)} · last seen {when(data.lastSeen)}
            </p>
            <p className="info-small">{data.savedAt ? `Save from ${when(data.savedAt)} (${ago(data.savedAt)}).` : 'Nothing saved on the server yet.'}</p>
            {data.banned && (
              <p className="gm-chip is-warn">
                Banned{data.banReason ? `: ${data.banReason}` : ''}
              </p>
            )}
          </div>
          <div className="reset-row">
            <button className="btn btn-sm" onClick={() => void load()}>
              <Icon name="restart" size={16} /> Refresh
            </button>
            <Link className="btn btn-sm" href={`/admin?tab=qa&player=${encodeURIComponent(data.id)}`}>
              <Icon name="user" size={16} /> Ban or email
            </Link>
          </div>
        </div>
        <Message onSend={(text, note) => send({ action: 'file', slot: -1, created: 0, heroName: '', kind: 'message', payload: { text }, label: '', note }, 'Message filed. The player sees it in the game.')} />
      </section>

      {heroes.some((h) => h) ? (
        <div className="seg gm-tabs" role="tablist" aria-label="Heroes">
          {heroes.map((h, i) =>
            h ? (
              <button key={i} role="tab" aria-selected={i === slot} className={i === slot ? 'is-on' : ''} onClick={() => navigate(`/admin?tab=sections&player=${encodeURIComponent(id)}&hero=${i}`, { replace: true, scroll: false })}>
                {h.name} · {classOf(h.cls)} {h.level}
              </button>
            ) : null,
          )}
        </div>
      ) : (
        <section className="panel info-block">
          <p className="info-small">This player has no heroes right now.</p>
        </section>
      )}

      {hero && <HeroSheet key={`${hero.created}-${data.savedAt}`} hero={hero} data={data} order={order} />}
      <Orders orders={data.orders} send={send} />
      <Graves graves={data.graves} send={send} />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin?tab=sections" className="gm-back">
      <Icon name="arrowLeft" size={16} /> All players
    </Link>
  );
}

function Message({ onSend }: { onSend: (text: string, note: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="gm-inline"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        void onSend(text.trim(), '').then((ok) => {
          setBusy(false);
          if (ok) setText('');
        });
      }}
    >
      <input className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={240} placeholder="A message from a Game Master, shown in their game" aria-label="Message to the player" />
      <button className="btn btn-sm" disabled={busy || !text.trim()}>
        <Icon name="mail" size={16} /> Send
      </button>
    </form>
  );
}

type OrderFn = (kind: string, payload: Record<string, unknown>, label: string, note: string) => Promise<boolean>;

function HeroSheet({ hero: h, data, order }: { hero: Character; data: GmPlayerDetail; order: OrderFn }) {
  const need = h.level >= MAX_LEVEL ? 0 : xpToNext(h.level);
  const quests = Object.values(h.quests);
  const count = (s: string): number => quests.filter((q) => q.state === s).length;
  return (
    <>
      <section className="panel info-block" aria-label={`${h.name}, overview`}>
        <div className="admin-row">
          <h2>
            {h.name} <span className="info-small">{classOf(h.cls)}{h.spec !== null ? ` · ${CLASSES[h.cls].trees[h.spec].name}` : ''}</span>
          </h2>
          <span className="mono info-small">last played {when(h.updated)}</span>
        </div>
        <div className="gm-tiles">
          <Tile label="Level" value={h.level} />
          <Tile label="Experience" value={need ? `${Math.floor((h.xp / need) * 100)}%` : 'Max'} />
          <Tile label="Paragon" value={h.para.l} />
          <Tile label="Gold" value={h.gold.toLocaleString('en-US')} />
          <Tile label="Shards" value={h.shards} />
          <Tile label="Sigil Marks" value={h.marks.toLocaleString('en-US')} />
          <Tile label="Potions" value={h.potions} />
          <Tile label="Difficulty" value={TIERS[h.tier] ?? h.tier} />
          <Tile label="Riftstone" value={h.keystone || 'None'} />
          <Tile label="Time played" value={hours(h.stats.time)} />
          <Tile label="Foes beaten" value={h.stats.kills.toLocaleString('en-US')} />
          <Tile label="Deaths" value={h.stats.deaths} />
          <Tile label="Quests done" value={`${count('done')} / ${Object.keys(QUEST_DEFS).length}`} />
          <Tile label="Lands open" value={`${h.unlocked.length} / ${Object.keys(REGIONS).length}`} />
        </div>
      </section>

      <Actions hero={h} order={order} />

      <div className="info-cols gm-cols">
        <Gear hero={h} order={order} />
        <Talents hero={h} />
      </div>
      <Quests hero={h} order={order} />
      <div className="info-cols gm-cols">
        <Dungeons hero={h} />
        <Collection hero={h} data={data} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ what they have */

function ItemLine({ item, onRemove }: { item: Item; onRemove?: (item: Item) => void }) {
  const stats = itemStats(item).slice(0, 3);
  return (
    <li className="gm-item">
      <span className={`gm-rar is-${item.r}`} title={item.r} aria-hidden="true" />
      <span className="gm-item-name">
        <b>{itemName(item)}</b>
        <span className="info-small">
          {item.r} · item level {item.il}
          {stats.length > 0 && ` · ${stats.map(([s, v]) => fmtStat(s, v)).join(', ')}`}
        </span>
      </span>
      {onRemove && (
        <button className="btn btn-sm btn-ghost" onClick={() => onRemove(item)}>
          Remove
        </button>
      )}
    </li>
  );
}

function Gear({ hero: h, order }: { hero: Character; order: OrderFn }) {
  const remove = (item: Item): void => {
    if (window.confirm(`Remove ${itemName(item)} from ${h.name}?`)) void order('removeItem', { uid: item.uid }, itemName(item), '');
  };
  return (
    <section className="panel info-block" aria-labelledby="gm-gear">
      <h2 id="gm-gear">Gear</h2>
      <ul className="gm-items">
        {SLOTS.map((s) => {
          const item = h.equip[s];
          return item ? <ItemLine key={s} item={item} onRemove={remove} /> : (
            <li key={s} className="gm-item is-empty">
              <span className="info-small">{s}: nothing worn</span>
            </li>
          );
        })}
      </ul>
      <h3 className="admin-h3">
        Bag · {h.bag.length} / {bagSize(h)}
      </h3>
      {h.bag.length === 0 ? (
        <p className="info-small">Empty.</p>
      ) : (
        <ul className="gm-items gm-scroll">
          {h.bag.map((item) => (
            <ItemLine key={item.uid} item={item} onRemove={remove} />
          ))}
        </ul>
      )}
      {(h.held?.length ?? 0) > 0 && (
        <>
          <h3 className="admin-h3">Waiting for room · {h.held!.length}</h3>
          <ul className="gm-items">
            {h.held!.map((item) => (
              <ItemLine key={item.uid} item={item} onRemove={remove} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Talents({ hero: h }: { hero: Character }) {
  const nodes = TALENTS[h.cls];
  const trees = CLASSES[h.cls].trees;
  return (
    <section className="panel info-block" aria-labelledby="gm-talents">
      <h2 id="gm-talents">Talents and skills</h2>
      <p className="info-small">
        {h.spec === null ? 'No specialization chosen.' : `Specialization: ${trees[h.spec].name}.`} {spentPoints(h)} of {talentPoints(h)} points spent, {freePoints(h)} free
        {h.freeRespec ? '; a free reset is waiting.' : '.'}
      </p>
      {trees.map((tree, i) => {
        const taken = nodes.filter((n) => n.tree === i && h.talents[n.id]);
        if (!taken.length) return null;
        return (
          <div key={tree.name}>
            <h3 className="admin-h3">{tree.name}</h3>
            <ul className="gm-chips">
              {taken.map((n) => (
                <li key={n.id} className="gm-chip">
                  {n.name} {h.talents[n.id]}/{n.ranks}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <h3 className="admin-h3">Skills on the bar</h3>
      <ul className="gm-chips">
        {h.skills.map((s, i) => (
          <li key={i} className="gm-chip">
            {s ? (SKILLS[s]?.name ?? s) : 'Empty'}
          </li>
        ))}
      </ul>
    </section>
  );
}

const STATE_LABEL: Record<string, string> = { done: 'Done', active: 'Under way', ready: 'Ready to hand in', offered: 'Offered' };

function Quests({ hero: h, order }: { hero: Character; order: OrderFn }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState('started');
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return Object.values(QUEST_DEFS)
      .filter((d) => {
        const state = h.quests[d.id]?.state;
        if (show === 'started' && (!state || state === 'done')) return false;
        if (show === 'done' && state !== 'done') return false;
        if (show === 'none' && state) return false;
        return !term || d.name.toLowerCase().includes(term) || d.id.includes(term);
      })
      .slice(0, 60);
  }, [q, show, h.quests]);
  return (
    <section className="panel info-block" aria-labelledby="gm-quests">
      <h2 id="gm-quests">Quests</h2>
      <div className="gm-search">
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a quest" aria-label="Find a quest" maxLength={60} />
        <select className="field" value={show} onChange={(e) => setShow(e.target.value)} aria-label="Which quests">
          <option value="started">Under way</option>
          <option value="done">Done</option>
          <option value="none">Not started</option>
          <option value="all">All</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="info-small">No quests here.</p>
      ) : (
        <ul className="gm-items gm-scroll">
          {rows.map((d) => {
            const state = h.quests[d.id]?.state;
            return (
              <li key={d.id} className="gm-item">
                <span className="gm-item-name">
                  <b>{d.name}</b>
                  <span className="info-small">{state ? STATE_LABEL[state] : 'Not started'}</span>
                </span>
                <span className="gm-item-actions">
                  {state !== 'done' && (
                    <button className="btn btn-sm btn-ghost" onClick={() => void order('quest', { id: d.id, state: 'done' }, d.name, '')}>
                      Complete
                    </button>
                  )}
                  {state && (
                    <button className="btn btn-sm btn-ghost" onClick={() => void order('quest', { id: d.id, state: 'reset' }, d.name, '')}>
                      Reset
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Dungeons({ hero: h }: { hero: Character }) {
  const regions = Object.values(REGIONS).filter((r) => r.kind === 'dungeon');
  const seen = regions.filter((r) => TIERS.some((_, t) => h.clears[`${r.id}:${t}`]) || h.bestKeys[r.id]);
  const bosses = Object.entries(h.bosses).sort((a, b) => b[1] - a[1]);
  return (
    <section className="panel info-block" aria-labelledby="gm-dungeons">
      <h2 id="gm-dungeons">Dungeons and bosses</h2>
      {seen.length === 0 ? (
        <p className="info-small">No dungeon cleared yet.</p>
      ) : (
        <div className="gm-table-wrap">
          <table className="gm-table">
            <thead>
              <tr>
                <th scope="col">Dungeon</th>
                {TIERS.map((t) => (
                  <th key={t} scope="col">
                    {t}
                  </th>
                ))}
                <th scope="col">Best stone</th>
              </tr>
            </thead>
            <tbody>
              {seen.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.name}</th>
                  {TIERS.map((_, t) => (
                    <td key={t}>{h.clears[`${r.id}:${t}`] ?? '·'}</td>
                  ))}
                  <td>{h.bestKeys[r.id] ?? '·'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="admin-h3">Bosses beaten · {bosses.length}</h3>
      {bosses.length === 0 ? (
        <p className="info-small">None yet.</p>
      ) : (
        <ul className="gm-chips">
          {bosses.slice(0, 40).map(([id, n]) => (
            <li key={id} className="gm-chip">
              {id.replace(/-/g, ' ')} ×{n}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Collection({ hero: h, data }: { hero: Character; data: GmPlayerDetail }) {
  const ring = (data.ring as { standings?: Record<string, { rating?: number; best?: number; wins?: number; losses?: number }> } | null)?.standings ?? {};
  const vigil = (data.vigil ?? {}) as Record<string, number>;
  return (
    <section className="panel info-block" aria-labelledby="gm-world">
      <h2 id="gm-world">World and collection</h2>
      <h3 className="admin-h3">Lands open · {h.unlocked.length}</h3>
      <ul className="gm-chips">
        {h.unlocked.map((r) => (
          <li key={r} className="gm-chip">
            {REGIONS[r]?.name ?? r}
          </li>
        ))}
      </ul>
      <h3 className="admin-h3">Mounts · {h.mounts.length}</h3>
      {h.mounts.length === 0 ? (
        <p className="info-small">None.</p>
      ) : (
        <ul className="gm-chips">
          {h.mounts.map((m) => (
            <li key={m} className={`gm-chip${h.mount === m ? ' is-on' : ''}`}>
              {MOUNT_DEFS[m]?.name ?? m}
            </li>
          ))}
        </ul>
      )}
      <h3 className="admin-h3">Story gifts · {h.perks.length}</h3>
      {h.perks.length === 0 ? (
        <p className="info-small">None yet.</p>
      ) : (
        <ul className="gm-chips">
          {h.perks.map((p) => (
            <li key={p} className="gm-chip">
              {PERKS[p]?.name ?? p}
            </li>
          ))}
        </ul>
      )}
      <p className="info-small">{h.looks.length} looks in the Wardrobe.</p>
      <h3 className="admin-h3">The Ring</h3>
      {Object.keys(ring).length === 0 ? (
        <p className="info-small">No matches saved.</p>
      ) : (
        <ul className="gm-chips">
          {Object.entries(ring).map(([f, s]) => (
            <li key={f} className="gm-chip">
              {f}: {s.rating ?? 0} (best {s.best ?? 0}) {s.wins ?? 0}–{s.losses ?? 0}
            </li>
          ))}
        </ul>
      )}
      <h3 className="admin-h3">The Vigil</h3>
      {Object.keys(vigil).length === 0 ? (
        <p className="info-small">No nights saved.</p>
      ) : (
        <ul className="gm-chips">
          {Object.entries(vigil).map(([map, t]) => (
            <li key={map} className="gm-chip">
              {map}: {Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ what a game master can do */

function Actions({ hero: h, order }: { hero: Character; order: OrderFn }) {
  const [note, setNote] = useState('');
  const go = (kind: string, payload: Record<string, unknown>, label = ''): Promise<boolean> => order(kind, payload, label, note);
  return (
    <section className="panel info-block" aria-labelledby="gm-actions">
      <div className="admin-row">
        <h2 id="gm-actions">
          <Icon name="bolt" /> Game master
        </h2>
        <span className="mono info-small">for {h.name}</span>
      </div>
      <label className="ag-field gm-note">
        <span>Why (goes in the log with each order below)</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ticket, reason, anything you’d want to remember" />
      </label>
      <div className="gm-actions">
        <GiveAmount go={go} />
        <SetLevel hero={h} go={go} />
        <GiveItem hero={h} go={go} />
        <GiveGear hero={h} go={go} />
        <PickOne title="Open a land" verb="Open" kind="unlock" options={Object.values(REGIONS).filter((r) => !r.interior && !h.unlocked.includes(r.id as RegionId)).map((r) => ({ id: r.id, name: r.name }))} go={go} />
        <PickOne title="Give a mount" verb="Give" kind="mount" options={Object.values(MOUNT_DEFS).filter((m) => !h.mounts.includes(m.id)).map((m) => ({ id: m.id, name: m.name }))} go={go} />
        <PickOne title="Give a story gift" verb="Give" kind="perk" options={Object.entries(PERKS).filter(([id]) => !h.perks.includes(id as never)).map(([id, p]) => ({ id, name: p.name }))} go={go} />
        <Difficulty hero={h} go={go} />
        <Rename hero={h} go={go} />
        <div className="gm-action">
          <h3 className="admin-h3">Talents</h3>
          <p className="info-small">The next reset is free, whatever their level.</p>
          <button className="btn btn-sm" disabled={!!h.freeRespec} onClick={() => void go('respec', {})}>
            Give a free reset
          </button>
        </div>
      </div>
    </section>
  );
}

type Go = (kind: string, payload: Record<string, unknown>, label?: string) => Promise<boolean>;

function GiveAmount({ go }: { go: Go }) {
  const [what, setWhat] = useState('gold');
  const [n, setN] = useState('');
  const amount = Math.floor(Math.abs(Number(n)));
  return (
    <div className="gm-action">
      <h3 className="admin-h3">Gold and the like</h3>
      <div className="gm-inline">
        <select className="field" value={what} onChange={(e) => setWhat(e.target.value)} aria-label="What">
          <option value="gold">Gold</option>
          <option value="shards">Shards</option>
          <option value="marks">Sigil Marks</option>
          <option value="potions">Potions</option>
        </select>
        <input className="field" type="number" min={1} value={n} onChange={(e) => setN(e.target.value)} placeholder="How many" aria-label="How many" />
      </div>
      <div className="reset-row">
        <button className="btn btn-sm" disabled={!amount} onClick={() => void go(what, { amount })}>
          Give
        </button>
        <button className="btn btn-sm btn-ghost" disabled={!amount} onClick={() => void go(what, { amount: -amount })}>
          Take
        </button>
      </div>
    </div>
  );
}

function SetLevel({ hero: h, go }: { hero: Character; go: Go }) {
  const [n, setN] = useState(String(h.level));
  const level = Math.floor(Number(n));
  return (
    <div className="gm-action">
      <h3 className="admin-h3">Level</h3>
      <p className="info-small">Going down gives back talents that no longer fit.</p>
      <div className="gm-inline">
        <input className="field" type="number" min={1} max={MAX_LEVEL} value={n} onChange={(e) => setN(e.target.value)} aria-label="Level" />
        <button className="btn btn-sm" disabled={!(level >= 1 && level <= MAX_LEVEL) || level === h.level} onClick={() => void go('level', { level })}>
          Set
        </button>
      </div>
    </div>
  );
}

function GiveItem({ hero: h, go }: { hero: Character; go: Go }) {
  const [q, setQ] = useState('');
  const [id, setId] = useState('');
  const [il, setIl] = useState(String(h.level));
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ITEMS.filter((i) => (!i.cls || i.cls === h.cls) && (!term || i.name.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [q, h.cls]);
  const def = list.find((i) => i.id === id) ?? list[0];
  return (
    <div className="gm-action">
      <h3 className="admin-h3">A named item</h3>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item" aria-label="Find an item" maxLength={60} />
      <select className="field" value={def?.id ?? ''} onChange={(e) => setId(e.target.value)} aria-label="Item">
        {list.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.rarity}, {i.slot})
          </option>
        ))}
      </select>
      <div className="gm-inline">
        <input className="field" type="number" min={1} max={200} value={il} onChange={(e) => setIl(e.target.value)} aria-label="Item level" />
        <button className="btn btn-sm" disabled={!def} onClick={() => def && void go('item', { id: def.id, il: Math.floor(Number(il)) || 1 }, def.name)}>
          Give
        </button>
      </div>
    </div>
  );
}

function GiveGear({ hero: h, go }: { hero: Character; go: Go }) {
  const [rarity, setRarity] = useState('rare');
  const [slot, setSlot] = useState('weapon');
  const [il, setIl] = useState(String(h.level));
  return (
    <div className="gm-action">
      <h3 className="admin-h3">A rolled piece of gear</h3>
      <div className="gm-inline">
        <select className="field" value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Rarity">
          {RARITIES.slice(0, 3).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select className="field" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Slot">
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="gm-inline">
        <input className="field" type="number" min={1} max={200} value={il} onChange={(e) => setIl(e.target.value)} aria-label="Item level" />
        <button className="btn btn-sm" onClick={() => void go('gear', { rarity, slot, il: Math.floor(Number(il)) || 1 })}>
          Give
        </button>
      </div>
    </div>
  );
}

function PickOne({ title, verb, kind, options, go }: { title: string; verb: string; kind: string; options: { id: string; name: string }[]; go: Go }) {
  const sorted = useMemo(() => [...options].sort((a, b) => a.name.localeCompare(b.name)), [options]);
  const [id, setId] = useState('');
  const picked = sorted.find((o) => o.id === id) ?? sorted[0];
  return (
    <div className="gm-action">
      <h3 className="admin-h3">{title}</h3>
      {sorted.length === 0 ? (
        <p className="info-small">They have them all.</p>
      ) : (
        <div className="gm-inline">
          <select className="field" value={picked?.id ?? ''} onChange={(e) => setId(e.target.value)} aria-label={title}>
            {sorted.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button className="btn btn-sm" disabled={!picked} onClick={() => picked && void go(kind, { id: picked.id }, picked.name)}>
            {verb}
          </button>
        </div>
      )}
    </div>
  );
}

function Difficulty({ hero: h, go }: { hero: Character; go: Go }) {
  const [tier, setTier] = useState(String(h.tier));
  const [stone, setStone] = useState(String(h.keystone));
  return (
    <div className="gm-action">
      <h3 className="admin-h3">Difficulty and Riftstone</h3>
      <div className="gm-inline">
        <select className="field" value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Difficulty">
          {TIERS.map((t, i) => (
            <option key={t} value={i}>
              {t}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" disabled={Number(tier) === h.tier} onClick={() => void go('tier', { tier: Number(tier) })}>
          Set
        </button>
      </div>
      <div className="gm-inline">
        <input className="field" type="number" min={0} max={999} value={stone} onChange={(e) => setStone(e.target.value)} aria-label="Riftstone level" />
        <button className="btn btn-sm" disabled={Number(stone) === h.keystone} onClick={() => void go('keystone', { level: Math.floor(Number(stone)) })}>
          Set
        </button>
      </div>
    </div>
  );
}

function Rename({ hero: h, go }: { hero: Character; go: Go }) {
  const [name, setName] = useState('');
  return (
    <div className="gm-action">
      <h3 className="admin-h3">Rename the hero</h3>
      <div className="gm-inline">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder={h.name} aria-label="New name" />
        <button
          className="btn btn-sm"
          disabled={!name.trim()}
          onClick={() =>
            void go('rename', { name: name.trim() }).then((ok) => {
              if (ok) setName('');
            })
          }
        >
          Rename
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ what was asked, and what came of it */

const orderState = (o: GmOrderView): { text: string; tone: 'wait' | 'done' | 'warn' | 'off' } => {
  if (o.cancelledAt) return { text: 'Called back', tone: 'off' };
  if (!o.appliedAt) return { text: 'Waiting for their game', tone: 'wait' };
  return o.result ? { text: `Couldn’t: ${o.result}`, tone: 'warn' } : { text: `Done ${when(o.appliedAt)}`, tone: 'done' };
};

function Orders({ orders, send }: { orders: GmOrderView[]; send: (body: Record<string, unknown>, done: string) => Promise<boolean> }) {
  return (
    <section className="panel info-block" aria-labelledby="gm-orders">
      <h2 id="gm-orders">Orders · {orders.length}</h2>
      {orders.length === 0 ? (
        <p className="info-small">Nothing asked of this player’s game yet.</p>
      ) : (
        <ul className="gm-items">
          {orders.map((o) => {
            const s = orderState(o);
            return (
              <li key={o.id} className="gm-item">
                <span className="gm-item-name">
                  <b>
                    {o.heroName ? `${o.heroName}: ` : ''}
                    {o.summary}
                  </b>
                  <span className="info-small">
                    {when(o.at)} · {o.by}
                    {o.note ? ` · ${o.note}` : ''}
                  </span>
                </span>
                <span className="gm-item-actions">
                  <span className={`gm-chip is-${s.tone}`}>{s.text}</span>
                  {s.tone === 'wait' && (
                    <button className="btn btn-sm btn-ghost" onClick={() => void send({ action: 'cancel', id: o.id }, 'Called back.')}>
                      Call back
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Graves({ graves, send }: { graves: GmPlayerDetail['graves']; send: (body: Record<string, unknown>, done: string) => Promise<boolean> }) {
  if (!graves.length) return null;
  return (
    <section className="panel info-block" aria-labelledby="gm-graves">
      <h2 id="gm-graves">Deleted heroes</h2>
      <p className="info-small">Kept for 120 days. A hero comes back into a free slot the next time the player’s game checks.</p>
      <ul className="gm-items">
        {graves.map((g) => (
          <li key={g.id} className="gm-item">
            <span className="gm-item-name">
              <b>{g.name}</b>
              <span className="info-small">
                {classOf(g.cls)} {g.level} · deleted {when(g.deletedAt)}
              </span>
            </span>
            <span className="gm-item-actions">
              {g.restoredAt ? (
                <span className="gm-chip is-done">Brought back {when(g.restoredAt)}</span>
              ) : (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    if (window.confirm(`Bring ${g.name} back to this player?`)) void send({ action: 'restore', graveId: g.id }, 'Filed. They come back when the player’s game next checks.');
                  }}
                >
                  Bring back
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
