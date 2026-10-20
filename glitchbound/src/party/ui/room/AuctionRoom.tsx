import { useState } from 'react';
import { AUCTION_THEMES } from '../../content/auction';
import { BUDGETS, CLOCKS, INCREMENTS, LIMITS, MIN_PLAYERS, ROUNDS, type Action, type RoomView, type Wallet } from '../../rooms/auctionRoom';
import { Clock, Dot, RoomFrame, Scores, seatColor, Waiting, type RoomContext } from './RoomFrame';
import { t } from '../../../i18n';

type Ctx = RoomContext<RoomView, Action>;
const RARITY = ['', 'Common', 'Rare', 'Legendary'];

export function AuctionRoomPage({ code, onLeave }: { code: string; onLeave: () => void }) {
  return (
    <RoomFrame<RoomView, Action>
      code={code}
      meta={{ title: 'Name Your Price', emoji: '🔨', invite: 'Join my Name Your Price auction: bid play money, build the best collection.', min: MIN_PLAYERS }}
      onLeave={onLeave}
      kick={(seat) => ({ t: 'kick', seat })}
      progress={(v) => (v.phase === 'auction' && v.sale ? `Item ${Math.min(v.sale.index + 1, v.sale.total)}/${v.sale.total}` : undefined)}
      settings={(ctx) => <Settings {...ctx} />}
    >
      {(ctx) => <Game {...ctx} />}
    </RoomFrame>
  );
}

function Settings({ view, send }: Ctx) {
  const s = view.settings;
  const set = (settings: Partial<RoomView['settings']>): void => send({ t: 'settings', settings });
  const online = view.players.filter((p) => p.online).length;
  const opt = <K extends 'budget' | 'limit' | 'rounds' | 'increment'>(k: K, label: string, values: readonly number[], fmt: (v: number) => string) => (
    <label className="pt-field">
      {label}
      <select value={s[k]} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<RoomView['settings']>)}>
        {values.map((v) => (
          <option key={v} value={v}>
            {fmt(v)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <p className="pt-muted">{t('Bid play money on characters and things. Everyone starts with the same budget and can own a few items. All money is fictional.')}</p>
      <div className="pt-grid2">
        {opt('budget', 'Budget', BUDGETS, (v) => `$${v}`)}
        {opt('limit', 'Items each', LIMITS, (v) => `${v}`)}
        {opt('rounds', 'Items for sale', ROUNDS, (v) => `${v}`)}
        {opt('increment', 'Raise by', INCREMENTS, (v) => `$${v}`)}
      </div>
      <p className="pt-label">{t('Shot clock')}</p>
      <div className="pt-seg" role="radiogroup">
        {CLOCKS.map((c) => (
          <button key={c} role="radio" aria-checked={s.clock === c} onClick={() => set({ clock: c })}>
            {c} s
          </button>
        ))}
      </div>
      <h3>{t('Theme packs')}</h3>
      <div className="pt-picker">
        {AUCTION_THEMES.map((th) => {
          const on = s.themes.includes(th.id);
          return (
            <button key={th.id} className={`pt-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set({ themes: on ? s.themes.filter((x) => x !== th.id) : [...s.themes, th.id] })}>
              {th.emoji} {t(th.label)}
            </button>
          );
        })}
      </div>
      <button className="pt-btn pt-btn-go pt-btn-big" disabled={online < MIN_PLAYERS} onClick={() => send({ t: 'start' })}>
        {t('Open the auction')}
      </button>
    </>
  );
}

function Collection({ w, ctx, vote }: { w: Wallet; ctx: Ctx; vote?: boolean }) {
  const p = ctx.byN(w.n);
  if (!p) return null;
  const votes = ctx.view.result?.votes[String(w.n)] ?? 0;
  return (
    <div className={`pt-collection${ctx.view.myVote === w.n ? ' is-voted' : ''}`}>
      <div className="pt-collection-head">
        <Dot p={p} size={30} />
        <b>
          {p.name}
          {p.you ? t(' (you)') : ''}
        </b>
        <span className="pt-muted">{t('${n} left', { n: w.budget })}</span>
        {vote && !p.you && (
          <button className={`pt-btn pt-btn-sm${ctx.view.myVote === w.n ? ' pt-btn-go' : ''}`} onClick={() => ctx.send({ t: 'vote', seat: w.n })}>
            {ctx.view.myVote === w.n ? t('👍 Your pick') : t('👍 Best')}
          </button>
        )}
        {ctx.view.result && <span className="pt-pill">👍 {votes}</span>}
      </div>
      <ul>
        {w.items.length ? (
          w.items.map((x) => (
            <li key={x.name}>
              {x.emoji} {x.name} <span className="pt-muted">${x.paid}</span>
            </li>
          ))
        ) : (
          <li className="pt-muted">{t('Nothing. Bold strategy.')}</li>
        )}
      </ul>
    </div>
  );
}

function Game(ctx: Ctx) {
  const { view, send, left, me, byN } = ctx;
  const [custom, setCustom] = useState('');
  const sale = view.sale;
  if (!sale) return null;
  const mine = sale.wallets.find((w) => w.n === me.n);

  if (view.phase === 'vote' || view.phase === 'result') {
    return (
      <section className="pt-panel">
        <h2>{view.phase === 'vote' ? t('Collections are in! Vote for the best one') : t('🔨 The results')}</h2>
        {view.phase === 'vote' && (
          <>
            <Clock left={left} />
            <Waiting players={view.players.filter((p) => sale.wallets.some((w) => w.n === p.n))} label="Voted" />
          </>
        )}
        <div className="pt-collections">
          {sale.wallets.map((w) => (
            <Collection key={w.n} w={w} ctx={ctx} vote={view.phase === 'vote' && !!mine} />
          ))}
        </div>
        {view.phase === 'result' && view.result && (
          <>
            <p className="pt-muted">{t('This game: 3 points per vote + 1 per item.')}</p>
            <Scores players={view.players} gained={view.result.gained} />
            {view.host ? (
              <div className="pt-row">
                <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => send({ t: 'start' })}>
                  {t('New auction')}
                </button>
                <button className="pt-btn" onClick={() => send({ t: 'lobby' })}>
                  {t('Settings')}
                </button>
              </div>
            ) : (
              <p className="pt-muted pt-center">{t('The host starts the next auction.')}</p>
            )}
          </>
        )}
      </section>
    );
  }

  const item = sale.item;
  const theme = item ? AUCTION_THEMES.find((t) => t.id === item.theme) : undefined;
  const active = byN(sale.active);
  const leader = byN(sale.leader);
  const inc = view.settings.increment;
  const raises = mine && sale.canBid ? [sale.minBid, sale.minBid + inc * 2, sale.minBid + inc * 5].filter((v, i, a) => v <= mine.budget && a.indexOf(v) === i) : [];

  return (
    <>
      <div className="pt-wallets">
        {sale.wallets.map((w) => {
          const p = byN(w.n);
          return p ? (
            <span key={w.n} className={`pt-wallet${w.n === sale.active ? ' is-now' : ''}${sale.passed.includes(w.n) ? ' is-out' : ''}`} style={{ ['--pc' as string]: seatColor(w.n) }}>
              {p.name}
              {p.you ? t(' (you)') : ''}
              <b>${w.budget}</b>
              <small>
                {w.items.length}/{view.settings.limit}
              </small>
            </span>
          ) : null;
        })}
      </div>
      {item && (
        <article className={`pt-lot pt-rarity-${item.rarity}`}>
          <span className="pt-kind">
            {theme?.emoji} {t(theme?.label ?? '')} · {t(RARITY[item.rarity]!)}
          </span>
          <span className="pt-lot-emoji" aria-hidden="true">
            {item.emoji}
          </span>
          <h2 className="pt-lot-name">{item.name}</h2>
          <p className="pt-lot-bid">
            {leader ? (
              <>
                <b>${sale.bid}</b> · {leader.you ? t('you lead') : t('{name} leads', { name: leader.name })}
              </>
            ) : (
              t('No bids yet')
            )}
          </p>
        </article>
      )}
      {sale.state === 'bidding' ? (
        <section className="pt-actions">
          <Clock left={left} />
          {sale.canBid && mine ? (
            <>
              <p>
                <b>{t('Your move.')}</b> {t('You have ${n}.', { n: mine.budget })}
              </p>
              <div className="pt-row">
                {raises.map((v) => (
                  <button key={v} className="pt-btn pt-btn-go" onClick={() => send({ t: 'bid', amount: v })}>
                    {t('Bid ${n}', { n: v })}
                  </button>
                ))}
                <button className="pt-btn" onClick={() => send({ t: 'pass' })}>
                  {t('Pass')}
                </button>
              </div>
              <form
                className="pt-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Math.floor(Number(custom));
                  if (v >= sale.minBid && v <= mine.budget) {
                    send({ t: 'bid', amount: v });
                    setCustom('');
                  }
                }}
              >
                <input className="pt-input pt-input-sm" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} placeholder={`$${sale.minBid}–${mine.budget}`} aria-label={t('Custom bid')} />
                <button className="pt-btn pt-btn-sm" disabled={!custom}>
                  {t('Bid')}
                </button>
              </form>
            </>
          ) : (
            <p className="pt-muted pt-center">{active ? t('{name} is deciding…', { name: active.name }) : t('Waiting…')}</p>
          )}
        </section>
      ) : (
        <section className="pt-actions">
          <h3 className="pt-center">{sale.state === 'sold' && leader ? (leader.you ? t('🔨 Sold to you for ${n}!', { n: sale.bid }) : t('🔨 Sold to {name} for ${n}!', { name: leader.name, n: sale.bid })) : t('Nobody wanted it. Unsold!')}</h3>
          <Clock left={left} />
          {view.host && (
            <button className="pt-btn pt-btn-go" onClick={() => send({ t: 'next' })}>
              {t('Next item →')}
            </button>
          )}
        </section>
      )}
    </>
  );
}
