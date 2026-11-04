import { useCallback, useEffect, useState } from 'react';
import { NO_MONEY, type MoneySettings } from '../../catalog/settings';
import { AD_FREE_ID, breaksRules, MAX_CENTS, MIN_CENTS, priceText, PRODUCTS, type Product } from '../../catalog/shop';
import { api } from '../../platform/account';
import type { AdminCatalog } from '../../platform/apiTypes';
import { ADS } from '../../platform/env';
import type { Send } from './useAdminCatalog';

/**
 * Ads and the shop: the switches, the shop's items and prices, and its sales. All off until the owner opens it. Each
 * switch says what it needs first and can't be turned on while something is missing. docs/LEGAL-READINESS.md has the
 * full list, including what's for a lawyer and an accountant.
 */
export function MoneySection({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  return (
    <>
      <Switches data={data} send={send} busy={busy} />
      <Items data={data} send={send} busy={busy} />
      <Sales items={data.shopItems ?? PRODUCTS} />
    </>
  );
}

function Switches({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const m: MoneySettings = data.money ?? NO_MONEY;
  const [address, setAddress] = useState(m.address);
  const hasAddress = !!m.address.trim();
  const save = (patch: Partial<MoneySettings>, done: string): void => void send({ action: 'money', money: { ...m, ...patch } }, done);

  const rows: { key: 'ads' | 'rewarded' | 'shop'; title: string; what: string; needs: { ok: boolean; text: string }[] }[] = [
    {
      key: 'ads',
      title: 'Banner ads',
      what: 'Labeled banners. Never in a game, on 18+ pages or for ad-free members.',
      needs: [
        { ok: ADS.enabled, text: 'AdSense publisher id and VITE_ADS_ENABLED=on in the build, with ad unit ids, after Google approves the site' },
        { ok: hasAddress, text: 'Your postal address below (the law asks a site that earns money to show it)' },
      ],
    },
    {
      key: 'rewarded',
      title: 'Optional ads for one more try',
      what: 'After a daily, a player may watch a short ad for one extra, unranked try. Google approves this separately.',
      needs: [
        { ok: ADS.enabled, text: 'The same AdSense settings in the build' },
        { ok: hasAddress, text: 'Your postal address below' },
      ],
    },
    {
      key: 'shop',
      title: 'The shop',
      what: 'Opens the Shop tab, the terms of sale and the checkout. Turning it off closes all of them at once. Whoever bought something keeps it.',
      needs: [{ ok: hasAddress, text: 'Your postal address below' }],
    },
  ];

  return (
    <section className="panel info-block" aria-labelledby="ag-money">
      <h2 id="ag-money" className="side-title">
        Switches
      </h2>
      <p className="info-small">
        Everything here is off until you open it. Off means nothing loads and nothing shows, and the Terms and Privacy pages say so. Read <code>docs/LEGAL-READINESS.md</code> before turning anything
        on: it has what only you can do, and what a lawyer or accountant should look at.
      </p>
      {rows.map((r) => {
        const on = m[r.key];
        const ready = r.needs.every((n) => n.ok);
        return (
          <div key={r.key} className="money-row">
            <div>
              <p>
                <strong>{r.title}</strong>
                <span className="mono info-small"> {on ? 'On' : 'Off'}</span>
              </p>
              <p className="info-small">{r.what}</p>
              <ul className="info-small">
                {r.needs.map((n) => (
                  <li key={n.text}>
                    {n.ok ? 'Done: ' : 'Needed: '}
                    {n.text}
                  </li>
                ))}
              </ul>
            </div>
            <button className={`btn btn-sm${on ? ' btn-ghost' : ''}`} disabled={busy || (!on && !ready)} onClick={() => save({ [r.key]: !on }, `${r.title}: ${on ? 'off' : 'on'}`)}>
              {on ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        );
      })}
      <div className="money-row">
        <div>
          <strong>Where banners show</strong>
          <p className="info-small">Each place can be shown or hidden. Google asks for ads to stay well away from games, so a game page&rsquo;s banner sits under its text.</p>
        </div>
        <span className="money-checks">
          <label className="info-small">
            <input type="checkbox" checked={m.adsHome} disabled={busy} onChange={(e) => save({ adsHome: e.target.checked }, 'Home page banner changed')} /> Home page
          </label>
          <label className="info-small">
            <input type="checkbox" checked={m.adsGame} disabled={busy} onChange={(e) => save({ adsGame: e.target.checked }, 'Game page banner changed')} /> Game pages
          </label>
        </span>
      </div>
      <form
        className="money-row"
        onSubmit={(e) => {
          e.preventDefault();
          save({ address: address.trim() }, 'Address saved');
        }}
      >
        <div>
          <label className="ag-field">
            Postal address, shown in the Terms and Privacy pages once set
            <input className="field" value={address} maxLength={160} onChange={(e) => setAddress(e.target.value)} />
          </label>
        </div>
        <button className="btn btn-sm btn-primary" disabled={busy || address.trim() === m.address}>
          Save the address
        </button>
      </form>
    </section>
  );
}

const STATES = [
  { id: 'sale', label: 'For sale' },
  { id: 'later', label: 'Planned' },
  { id: 'hidden', label: 'Hidden' },
] as const;
const stateOf = (p: Product): (typeof STATES)[number]['id'] => (p.hidden ? 'hidden' : p.later ? 'later' : 'sale');

function Items({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const [items, setItems] = useState<Product[]>(data.shopItems ?? PRODUCTS);
  const change = (i: number, patch: Partial<Product>): void => setItems((all) => all.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  const bad = items.find((p) => breaksRules(`${p.name} ${p.blurb}`));
  const wrong = items.find((p) => !p.name.trim() || !p.blurb.trim() || p.cents < MIN_CENTS || p.cents > MAX_CENTS);
  return (
    <section className="panel info-block" aria-labelledby="ag-items">
      <h2 id="ag-items" className="side-title">
        Shop items
      </h2>
      <p className="info-small">
        Prices are in euros with VAT included, and what&rsquo;s here is what players pay. Cosmetic items and ad-free only: nothing that helps anyone win, no game currency and no random boxes. No
        countdowns or &ldquo;last chance&rdquo;, and don&rsquo;t show a discount unless the old price really was charged in the last 30 days. Items marked planned can&rsquo;t be bought yet.
      </p>
      {items.map((p, i) => (
        <div key={p.id} className="money-item">
          <input className="field" aria-label="Name" value={p.name} maxLength={40} onChange={(e) => change(i, { name: e.target.value })} />
          <label className="info-small money-price">
            €
            <input
              className="field"
              aria-label={`Price of ${p.name} in euros`}
              type="number"
              min={MIN_CENTS / 100}
              max={MAX_CENTS / 100}
              step="0.01"
              value={p.cents / 100}
              onChange={(e) => change(i, { cents: Math.round(Number(e.target.value) * 100) })}
            />
          </label>
          <select className="field" aria-label={`State of ${p.name}`} value={stateOf(p)} onChange={(e) => change(i, { later: e.target.value === 'later' ? true : undefined, hidden: e.target.value === 'hidden' ? true : undefined })}>
            {STATES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {p.id !== AD_FREE_ID && (
            <button className="btn btn-sm btn-ghost" onClick={() => setItems((all) => all.filter((_, n) => n !== i))}>
              Remove
            </button>
          )}
          <textarea className="field" aria-label={`What ${p.name} is`} value={p.blurb} maxLength={240} rows={3} onChange={(e) => change(i, { blurb: e.target.value })} />
        </div>
      ))}
      {bad && <p className="info-small" role="alert">&ldquo;{bad.name}&rdquo; uses words the rules above don&rsquo;t allow, such as pressure, chance or game currency.</p>}
      {wrong && <p className="info-small" role="alert">Each item needs a name, a description and a price from {priceText(MIN_CENTS)} to {priceText(MAX_CENTS)}.</p>}
      <div className="reset-row">
        <button
          className="btn btn-sm"
          onClick={() => {
            const name = `New item ${items.length + 1}`;
            setItems((all) => [...all, { id: `${slug(name)}-${Date.now().toString(36)}`, name, blurb: 'What it is, in plain words.', cents: 99, later: true }]);
          }}
        >
          Add an item
        </button>
        <button className="btn btn-sm btn-primary" disabled={busy || !!bad || !!wrong} onClick={() => void send({ action: 'shopItems', items }, 'Shop items saved')}>
          Save the items
        </button>
      </div>
    </section>
  );
}

interface Report {
  items: { product: string; paid: number; refunded: number; gifted: number; cents: number; currency: string | null }[];
  recent: { id: string; product: string; status: string; amount: number | null; at: number; nickname: string | null; gift: boolean }[];
}

function Sales({ items }: { items: Product[] }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [nick, setNick] = useState('');
  const [gift, setGift] = useState(AD_FREE_ID);
  const load = useCallback(() => {
    api<Report>('/api/admin/shop')
      .then(setReport)
      .catch(() => setError('Could not load the sales.'));
  }, []);
  useEffect(load, [load]);
  const act = (body: Record<string, unknown>): void => {
    setError('');
    api('/api/admin/shop', { body })
      .then(load)
      .catch(() => setError(body.action === 'gift' ? 'No player with that nickname.' : 'That didn’t work.'));
  };
  const nameOf = (id: string): string => items.find((p) => p.id === id)?.name ?? id;
  return (
    <section className="panel info-block" aria-labelledby="ag-sales">
      <h2 id="ag-sales" className="side-title">
        Sales
      </h2>
      {error && <p className="info-small" role="alert">{error}</p>}
      {report && !report.items.length && <p className="info-small">No sales yet.</p>}
      {report?.items.map((r) => (
        <p key={r.product} className="info-small">
          <strong>{nameOf(r.product)}:</strong> {r.paid} sold, {priceText(r.cents)} taken before Stripe&rsquo;s share, {r.refunded} refunded, {r.gifted} gifted
        </p>
      ))}
      <form
        className="money-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (nick.trim()) act({ action: 'gift', nickname: nick.trim(), product: gift });
        }}
      >
        <div>
          <label className="ag-field">
            Give an item to a player, for support or a prize. It goes in the change log and never counts as money.
            <input className="field" placeholder="Nickname" value={nick} maxLength={32} onChange={(e) => setNick(e.target.value)} />
          </label>
          <select className="field" aria-label="Item to give" value={gift} onChange={(e) => setGift(e.target.value)}>
            {items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-sm" disabled={!nick.trim()}>
          Give it
        </button>
      </form>
      {!!report?.recent.length && <h3 className="info-small">Latest</h3>}
      {report?.recent.map((r) => (
        <div key={r.id} className="money-row">
          <span className="info-small">
            {new Date(r.at).toISOString().slice(0, 10)} · {r.nickname ?? 'Deleted account'} · {nameOf(r.product)} · {r.gift ? 'gift' : priceText(r.amount ?? 0)} · {r.status}
          </span>
          {r.status === 'paid' && (
            <button className="btn btn-sm btn-ghost" onClick={() => act({ action: 'takeBack', id: r.id })}>
              Take back
            </button>
          )}
        </div>
      ))}
      <p className="info-small">Taking something back doesn&rsquo;t return money: refund it in Stripe, and Stripe&rsquo;s message takes the item back by itself.</p>
    </section>
  );
}
