import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { STYLES, styleOf, type LookKind, type LookSpec } from '../../catalog/looks';
import { BannerArt, FramedAvatar } from '../../components/Looks';
import { NO_MONEY, type MoneySettings } from '../../catalog/settings';
import { MOUNT_EXTRAS, SIGIL_BODIES, SIGIL_GLOWS, SIGIL_SETS, sigilSetOf, type SigilBody, type SigilGlow, type SigilSpec } from '../../catalog/sigilItems';
import { AD_FREE_ID, breaksRules, isBuiltIn, MAX_CENTS, MIN_CENTS, priceText, PRODUCTS, type Product } from '../../catalog/shop';
import { api } from '../../platform/account';
import type { AdminCatalog } from '../../platform/apiTypes';
import { ADS } from '../../platform/env';
import { Link } from '../../router/router';
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
      what: 'Labeled banners. Never in a game, on 18+ pages or for ad-free members. Turn on only when AdSense › Sites says Ready and your European consent message is published: this page can’t check those two.',
      needs: [
        { ok: ADS.enabled && !!ADS.slots.home && !!ADS.slots.game, text: 'AdSense publisher id and both ad units in the build' },
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
      what: 'Opens the Shop tab, the shop inside Sigilfall (the same items at the same prices), the terms of sale and the checkout to everyone. Turning it off closes all of them at once. Whoever bought something keeps it. You see the Shop tab either way, and can test a purchase while it’s closed.',
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
              {r.key === 'shop' && (
                <p className="info-small">
                  <Link href="/shop">Open the shop page</Link>
                </p>
              )}
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

/** A Sigilfall item's picture, from a file of its own: the site's first load names no extra file for it. */
const SigilPictureLazy = lazy(() => import('../../components/SigilPicture').then((m) => ({ default: m.SigilPicture })));
const SigilPicture = (props: Parameters<typeof SigilPictureLazy>[0]) => (
  <Suspense fallback={null}>
    <SigilPictureLazy {...props} />
  </Suspense>
);

const STATES = [
  { id: 'sale', label: 'For sale' },
  { id: 'later', label: 'Planned' },
  { id: 'hidden', label: 'Hidden' },
] as const;
const stateOf = (p: Product): (typeof STATES)[number]['id'] => (p.hidden ? 'hidden' : p.later ? 'later' : 'sale');

function Items({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const [items, setItems] = useState<Product[]>(data.shopItems ?? PRODUCTS);
  const [adding, setAdding] = useState(false);
  const change = (i: number, patch: Partial<Product>): void => setItems((all) => all.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  const bad = items.find((p) => breaksRules(`${p.name} ${p.blurb}`));
  const wrong = items.find((p) => !p.name.trim() || !p.blurb.trim() || p.cents < MIN_CENTS || p.cents > MAX_CENTS);
  return (
    <section className="panel info-block" aria-labelledby="ag-items">
      <h2 id="ag-items" className="side-title">
        Shop items
      </h2>
      <p className="info-small">
        Prices are in euros with VAT included, and what&rsquo;s here is what players pay. Cosmetic items and ad-free, plus the Gloamknight class: nothing else that changes how a game plays, no game currency and no random boxes. No
        countdowns or &ldquo;last chance&rdquo;, and don&rsquo;t show a discount unless the old price really was charged in the last 30 days. Items marked planned can&rsquo;t be bought yet. Ad-free
        and the built-in borders, banners, icons and Sigilfall items can be hidden but not removed. An item someone has bought is never lost: if it&rsquo;s left out of the list, saving keeps it, hidden.
        Ad-free shows in the shop only while banner ads are on.
      </p>
      {items.map((p, i) => (
        <div key={p.id} className={`money-item${p.look || p.sigil ? ' has-look' : ''}`}>
          {p.look && <LookThumb spec={p.look} />}
          {p.sigil && (
            <span className="money-thumb" aria-hidden="true">
              <SigilPicture id={p.id} spec={p.sigil} size={120} />
            </span>
          )}
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
            {STATES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
          {!isBuiltIn(p.id) && (
            <button className="btn btn-sm btn-ghost" onClick={() => setItems((all) => all.filter((_, n) => n !== i))}>
              Remove
            </button>
          )}
          <textarea className="field" aria-label={`What ${p.name} is`} value={p.blurb} maxLength={240} rows={3} onChange={(e) => change(i, { blurb: e.target.value })} />
          {p.look && !isBuiltIn(p.id) && <LookEditor spec={p.look} name={p.name} onChange={(look) => change(i, { look })} />}
          {p.sigil && !isBuiltIn(p.id) && <SigilEditor spec={p.sigil} name={p.name} onChange={(sigil) => change(i, { sigil })} />}
        </div>
      ))}
      {bad && <p className="info-small" role="alert">&ldquo;{bad.name}&rdquo; uses words the rules above don&rsquo;t allow, such as pressure, chance or game currency.</p>}
      {wrong && <p className="info-small" role="alert">Each item needs a name, a description and a price from {priceText(MIN_CENTS)} to {priceText(MAX_CENTS)}.</p>}
      {adding && (
        <NewItem
          taken={items.map((p) => p.id)}
          onCancel={() => setAdding(false)}
          onAdd={(p) => {
            setItems((all) => [...all, p]);
            setAdding(false);
          }}
        />
      )}
      <div className="reset-row">
        {!adding && (
          <button className="btn btn-sm" onClick={() => setAdding(true)}>
            Add an item
          </button>
        )}
        <button className="btn btn-sm btn-primary" disabled={busy || !!bad || !!wrong} onClick={() => void send({ action: 'shopItems', items }, 'Shop items saved')}>
          Save the items
        </button>
      </div>
    </section>
  );
}

/** A look at the size of a list row. */
function LookThumb({ spec }: { spec: LookSpec }) {
  return (
    <span className="money-thumb" aria-hidden="true">
      {spec.kind === 'banner' ? <BannerArt spec={spec} className="money-thumb-banner" /> : <FramedAvatar name="G" size={40} border={spec.kind === 'border' ? spec : undefined} icon={spec.kind === 'icon' ? spec : undefined} />}
    </span>
  );
}

/** A look, big, as players will see it. */
function LookPreview({ spec }: { spec: LookSpec }) {
  return spec.kind === 'banner' ? (
    <BannerArt spec={spec} className="money-preview-banner" />
  ) : (
    <FramedAvatar name="G" size={104} border={spec.kind === 'border' ? spec : undefined} icon={spec.kind === 'icon' ? spec : undefined} />
  );
}

/** The style and colors of a look an admin made. Each color starts as the style's own. */
function LookEditor({ spec, name, onChange }: { spec: LookSpec; name: string; onChange: (spec: LookSpec) => void }) {
  const style = styleOf(spec.kind, spec.style);
  const colors = spec.colors ?? style?.colors ?? [];
  return (
    <div className="money-look">
      <label className="ag-field">
        Style
        <select className="field" aria-label={`Style of ${name}`} value={spec.style} onChange={(e) => onChange({ kind: spec.kind, style: e.target.value, colors: styleOf(spec.kind, e.target.value)?.colors })}>
          {STYLES[spec.kind].map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>
      </label>
      <span className="money-colors" role="group" aria-label={`Colors of ${name}`}>
        {colors.map((c, n) => (
          <input key={n} type="color" aria-label={`Color ${n + 1} of ${name}`} value={c} onChange={(e) => onChange({ ...spec, colors: colors.map((x, k) => (k === n ? e.target.value : x)) })} />
        ))}
        {style && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({ kind: spec.kind, style: spec.style })}>
            Its own colors
          </button>
        )}
      </span>
    </div>
  );
}

type NewKind = LookKind | 'sigil-mount' | 'sigil-look' | 'plain';

const KIND_OPTIONS: { id: NewKind; label: string; blurb: string }[] = [
  { id: 'border', label: 'A border around a member’s picture', blurb: 'A border around your picture on your profile and on the boards.' },
  { id: 'banner', label: 'A banner behind a member’s name', blurb: 'Art across your profile and behind your name on the boards.' },
  { id: 'icon', label: 'A profile icon in place of the picture', blurb: 'An icon in place of your picture on your profile, in the header and on the boards.' },
  { id: 'sigil-mount', label: 'A Sigilfall mount', blurb: 'A Sigilfall mount for every hero on your account. Only a look: it rides at the pace every mount does.' },
  { id: 'sigil-look', label: 'A Sigilfall helmet or armor', blurb: 'Sigilfall armor any class wears, over any gear, from the Wardrobe. Only a look: your stats come from what you equip.' },
  { id: 'plain', label: 'Something else (it does nothing by itself)', blurb: 'What it is, in plain words.' },
];

/** What a new Sigilfall mount or look starts as. */
const NEW_MOUNT: SigilSpec = { kind: 'mount', body: 'drake', coat: '#3a4a6a', mane: '#9fd4ff', tack: '#1a2238', plate: '#6e7280', extras: ['crown', 'veins'], glow: { kind: 'embers', color: '#ffd27a' } };
const NEW_LOOK: SigilSpec = { kind: 'look', slot: 'head', set: SIGIL_SETS[0]!.id, colors: SIGIL_SETS[0]!.colors };

const MOUNT_COLORS: { key: 'coat' | 'mane' | 'tack' | 'plate'; label: (body: SigilBody) => string }[] = [
  { key: 'coat', label: (b) => (b === 'drake' ? 'Scales' : 'Coat') },
  { key: 'mane', label: (b) => (b === 'drake' ? 'Wings' : 'Mane and hooves') },
  { key: 'tack', label: () => 'Saddle' },
  { key: 'plate', label: () => 'Plates and horns' },
];
const SET_COLORS = ['Main', 'Trim', 'Cloth', 'Glow'];

/**
 * A Sigilfall mount's body, colors, extras and glow, or a shop set's piece and colors. Sigilfall builds it from this
 * as soon as the list is saved (src/games/sigilfall/progress/shopGoods.ts): no code change.
 */
function SigilEditor({ spec, name, onChange }: { spec: SigilSpec; name: string; onChange: (spec: SigilSpec) => void }) {
  if (spec.kind === 'look') {
    const colors = spec.colors ?? sigilSetOf(spec.set)?.colors ?? [];
    return (
      <div className="money-look">
        <label className="ag-field">
          Set
          <select className="field" aria-label={`Set of ${name}`} value={spec.set} onChange={(e) => onChange({ ...spec, set: e.target.value as typeof spec.set, colors: sigilSetOf(e.target.value)?.colors })}>
            {SIGIL_SETS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ag-field">
          Piece
          <select className="field" aria-label={`Piece of ${name}`} value={spec.slot} onChange={(e) => onChange({ ...spec, slot: e.target.value === 'chest' ? 'chest' : 'head' })}>
            <option value="head">The helmet</option>
            <option value="chest">The armor</option>
          </select>
        </label>
        <span className="money-colors" role="group" aria-label={`Colors of ${name}`}>
          {colors.map((c, n) => (
            <label key={n} className="info-small money-color">
              <input type="color" aria-label={`${SET_COLORS[n]} color of ${name}`} value={c} onChange={(e) => onChange({ ...spec, colors: colors.map((x, k) => (k === n ? e.target.value : x)) })} />
              {SET_COLORS[n]}
            </label>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({ kind: 'look', slot: spec.slot, set: spec.set })}>
            Its own colors
          </button>
        </span>
      </div>
    );
  }
  const extras = MOUNT_EXTRAS[spec.body];
  const toggle = (id: string, on: boolean): void => {
    const group = extras.find((x) => x.id === id)?.group;
    const rest = spec.extras.filter((x) => x !== id && (!group || extras.find((e) => e.id === x)?.group !== group));
    onChange({ ...spec, extras: on ? [...rest, id] : rest });
  };
  return (
    <div className="money-look">
      <label className="ag-field">
        Body
        <select className="field" aria-label={`Body of ${name}`} value={spec.body} onChange={(e) => onChange({ ...spec, body: e.target.value as SigilBody, extras: [] })}>
          {SIGIL_BODIES.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <span className="money-colors" role="group" aria-label={`Colors of ${name}`}>
        {MOUNT_COLORS.map((c) => (
          <label key={c.key} className="info-small money-color">
            <input type="color" aria-label={`${c.label(spec.body)} color of ${name}`} value={spec[c.key]} onChange={(e) => onChange({ ...spec, [c.key]: e.target.value })} />
            {c.label(spec.body)}
          </label>
        ))}
      </span>
      <fieldset className="money-extras">
        <legend className="info-small">Built onto it</legend>
        {extras.map((x) => (
          <label key={x.id} className="info-small">
            <input type="checkbox" checked={spec.extras.includes(x.id)} onChange={(e) => toggle(x.id, e.target.checked)} /> {x.label}
          </label>
        ))}
      </fieldset>
      <span className="money-colors" role="group" aria-label={`Glow of ${name}`}>
        <label className="ag-field">
          Glow
          <select className="field" aria-label={`Glow of ${name}`} value={spec.glow?.kind ?? ''} onChange={(e) => onChange({ ...spec, glow: e.target.value ? { kind: e.target.value as SigilGlow, color: spec.glow?.color ?? '#ffd27a' } : undefined })}>
            <option value="">None (the runes and veins still glow)</option>
            {SIGIL_GLOWS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="info-small money-color">
          <input type="color" aria-label={`Glow color of ${name}`} value={spec.glow?.color ?? '#ffd27a'} onChange={(e) => onChange({ ...spec, glow: { kind: spec.glow?.kind ?? 'embers', color: e.target.value } })} />
          What glows
        </label>
      </span>
    </div>
  );
}

const slugOf = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);

/**
 * A new shop item. A border, banner or icon works the moment the list is saved: it's one of the site's styles in the
 * colors picked here, so it needs no code. Something else is only a listing until the code gives it a meaning.
 */
function NewItem({ taken, onAdd, onCancel }: { taken: string[]; onAdd: (p: Product) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<NewKind>('border');
  const [look, setLook] = useState<LookSpec>({ kind: 'border', style: STYLES.border[0]!.id, colors: STYLES.border[0]!.colors });
  const [sigil, setSigil] = useState<SigilSpec>(NEW_MOUNT);
  const isSigil = kind === 'sigil-mount' || kind === 'sigil-look';
  const [name, setName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [euros, setEuros] = useState('0.50');
  const option = KIND_OPTIONS.find((o) => o.id === kind)!;
  const style = kind === 'plain' || isSigil ? undefined : styleOf(kind, look.style);
  const sigilName =
    sigil.kind === 'mount' ? `New ${sigil.body === 'deer' ? 'hart' : sigil.body === 'boar' ? 'war-boar' : 'drake'}` : `${(sigilSetOf(sigil.set)?.label.split(':')[0] ?? 'New')} ${sigil.slot === 'head' ? 'helm' : 'armor'}`;
  const suggested = kind === 'plain' ? 'New item' : isSigil ? sigilName : `${(style?.label.split(':')[0] ?? 'New').replace(/^\w/, (c) => c.toUpperCase())} ${kind === 'icon' ? 'icon' : kind}`;
  const title = name.trim() || suggested;
  const text = blurb.trim() || option.blurb;
  const cents = Math.round(Number(euros) * 100);
  const base = `${kind === 'plain' ? 'item' : isSigil ? 'sigilfall' : kind}-${slugOf(title) || 'new'}`;
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  const problem = breaksRules(`${title} ${text}`)
    ? 'The name or description uses words the shop’s rules don’t allow.'
    : !(cents >= MIN_CENTS && cents <= MAX_CENTS)
      ? `The price must be from ${priceText(MIN_CENTS)} to ${priceText(MAX_CENTS)}.`
      : '';
  const pickKind = (k: NewKind): void => {
    setKind(k);
    if (k === 'sigil-mount') {
      setSigil(NEW_MOUNT);
      setEuros('1.99');
    } else if (k === 'sigil-look') {
      setSigil(NEW_LOOK);
      setEuros('0.99');
    } else if (k !== 'plain') setLook({ kind: k, style: STYLES[k][0]!.id, colors: STYLES[k][0]!.colors });
  };
  let preview: ReactNode = <p className="info-small">No preview: this item has no look.</p>;
  if (isSigil) preview = <SigilPicture id="new" spec={sigil} size={320} />;
  else if (kind !== 'plain') preview = <LookPreview spec={look} />;
  return (
    <div className="money-new" role="group" aria-labelledby="money-new-title">
      <h3 id="money-new-title">New item</h3>
      <div className="money-new-grid">
        <div className="money-new-form">
          <label className="ag-field">
            What it is
            <select className="field" value={kind} onChange={(e) => pickKind(e.target.value as NewKind)}>
              {KIND_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {kind !== 'plain' && !isSigil && <LookEditor spec={look} name="the new item" onChange={setLook} />}
          {isSigil && <SigilEditor spec={sigil} name="the new item" onChange={setSigil} />}
          <label className="ag-field">
            Name
            <input className="field" value={name} placeholder={suggested} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="ag-field">
            What it is, for players
            <textarea className="field" value={blurb} placeholder={option.blurb} maxLength={240} rows={2} onChange={(e) => setBlurb(e.target.value)} />
          </label>
          <label className="ag-field money-price">
            Price in euros, VAT included
            <input className="field" type="number" min={MIN_CENTS / 100} max={MAX_CENTS / 100} step="0.01" value={euros} onChange={(e) => setEuros(e.target.value)} />
          </label>
        </div>
        <div className="money-new-preview" aria-label="Preview">
          {preview}
        </div>
      </div>
      {kind === 'plain' && <p className="info-small">It&rsquo;s added as planned: it unlocks nothing until the site&rsquo;s code gives it a meaning, so it can&rsquo;t be sold before that.</p>}
      {problem && (
        <p className="info-small" role="alert">
          {problem}
        </p>
      )}
      <div className="reset-row">
        <button
          className="btn btn-sm btn-primary"
          disabled={!!problem}
          onClick={() => onAdd({ id, name: title, blurb: text, cents, ...(kind === 'plain' ? { later: true } : isSigil ? { sigil } : { look }) })}
        >
          Add to the list
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {isSigil && <p className="info-small">Sigilfall makes it from these settings as soon as the list is saved. Only the drake, hart and boar can be sold: the horses&rsquo; license doesn&rsquo;t cover it.</p>}
      <p className="info-small">Then press Save the items. A new look is for sale as soon as it&rsquo;s saved, unless you set it to planned or hidden.</p>
    </div>
  );
}

interface Report {
  items: { product: string; paid: number; refunded: number; gifted: number; cents: number; currency: string | null }[];
  recent: { id: string; product: string; status: string; amount: number | null; currency: string | null; at: number; nickname: string | null; gift: boolean }[];
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
            {new Date(r.at).toISOString().slice(0, 10)} · {r.nickname ?? 'Deleted account'} · {nameOf(r.product)} · {r.gift ? 'gift' : r.currency === 'test' ? 'test purchase' : priceText(r.amount ?? 0)} · {r.status}
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
