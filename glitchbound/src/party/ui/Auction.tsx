import { useState } from 'react';
import { auctionAwards, canBid, minBid, reduceAuction, startAuction, summaries, type AuctionSettings, type AuctionState } from '../auction';
import { AUCTION_ITEMS, AUCTION_THEMES } from '../content/auction';
import { freshRng, shuffle } from '../engine';
import type { PartySession } from '../session';
import type { AuctionTheme, Player } from '../types';
import { Avatar, byId, ModeBar, Name, Results, Timer, tNodes } from './shared';
import { t } from '../../i18n';

const RARITY = ['', 'Common', 'Rare', 'Legendary'];

export function AuctionMode({ session, update, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const [r] = useState(freshRng);
  const state = session.active?.mode === 'auction' ? session.active.state : null;
  const [cfg, setCfg] = useState<AuctionSettings>({ budget: 20, limit: 5, increment: 1, rounds: 12 });
  const [themes, setThemes] = useState<AuctionTheme[]>(['heroes', 'villains', 'gaming', 'screen']);
  const [timed, setTimed] = useState(false);
  const [custom, setCustom] = useState('');
  const [votes, setVotes] = useState<Record<string, number>>({});

  const set = (s: AuctionState): void => update((cur) => ({ ...cur, active: { mode: 'auction', state: s } }));
  const pool = AUCTION_ITEMS.filter((i) => themes.includes(i.theme));

  if (!state) {
    const opt = <K extends keyof AuctionSettings>(k: K, label: string, values: number[], fmt: (v: number) => string) => (
      <label className="pt-field">
        {label}
        <select value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })}>
          {values.map((v) => (
            <option key={v} value={v}>
              {fmt(v)}
            </option>
          ))}
        </select>
      </label>
    );
    return (
      <div className="pt-screen">
        <ModeBar title={t('Name Your Price')} onExit={onExit} />
        <div className="pt-panel">
          <p className="pt-muted">
            {t('Bid play money on characters and things. Everyone starts with the same budget and can own a few items. Highest bid when everyone else passes wins. All money is fictional.')}
          </p>
          <div className="pt-grid2">
            {opt('budget', 'Budget', [10, 20, 50, 100], (v) => `$${v}`)}
            {opt('limit', 'Items each', [3, 5, 7], (v) => `${v}`)}
            {opt('rounds', 'Items for sale', [8, 12, 16, 24], (v) => `${v}`)}
            {opt('increment', 'Raise by', [1, 2, 5], (v) => `$${v}`)}
          </div>
          <h3>{t('Theme packs')}</h3>
          <div className="pt-picker">
            {AUCTION_THEMES.map((th) => {
              const on = themes.includes(th.id);
              return (
                <button key={th.id} className={`pt-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setThemes(on ? themes.filter((x) => x !== th.id) : [...themes, th.id])}>
                  {th.emoji} {t(th.label)}
                </button>
              );
            })}
          </div>
          <label className="pt-switch">
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
            <span>
              <b>{t('Shot clock')}</b>{' '}{t('· 10 seconds to decide, or you pass')}
            </span>
          </label>
          <button
            className="pt-btn pt-btn-go pt-btn-big"
            disabled={pool.length < cfg.rounds}
            onClick={() => {
              setVotes({});
              set(startAuction(cfg, session.players.map((p) => p.id), shuffle(pool, r)));
            }}
          >
            {pool.length < cfg.rounds ? t('Pick more themes') : t('Open the auction')}
          </button>
        </div>
      </div>
    );
  }

  const player = (id: string): Player => byId(session.players, id)!;
  const item = state.queue[state.index];

  if (state.phase === 'done' || !item) {
    const sums = summaries(state);
    const votedTop = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    const scores = Object.fromEntries(state.players.map((p) => [p.id, (votes[p.id] ?? 0) * 3 + p.items.length]));
    return (
      <Results
        title={t('Collections are in!')}
        players={session.players}
        scores={scores}
        awards={[...auctionAwards(state), ...(votedTop && votedTop[1] > 0 ? [{ title: 'Group’s Favorite', playerId: votedTop[0], why: `${votedTop[1]} vote${votedTop[1] > 1 ? 's' : ''}` }] : [])]}
        onAgain={() => update((s) => ({ ...s, active: null }))}
        onMenu={onExit}
      >
        <p className="pt-muted">{t('Score = 3 per group vote + 1 per item. House rules welcome: argue it out!')}</p>
        <div className="pt-collections">
          {state.players.map((p) => {
            const sum = sums.find((x) => x.id === p.id)!;
            return (
              <div key={p.id} className="pt-collection">
                <div className="pt-collection-head">
                  <Avatar player={player(p.id)} size={32} />
                  <b>{player(p.id).name}</b>
                  <span className="pt-muted">{t('${n} left', { n: sum.left })}</span>
                  <button className="pt-btn pt-btn-sm" onClick={() => setVotes((v) => ({ ...v, [p.id]: (v[p.id] ?? 0) + 1 }))}>
                    👍 {votes[p.id] ?? 0}
                  </button>
                </div>
                <ul>
                  {p.items.length ? (
                    p.items.map((x) => (
                      <li key={x.item.id}>
                        {x.item.emoji} {x.item.name} <span className="pt-muted">${x.paid}</span>
                      </li>
                    ))
                  ) : (
                    <li className="pt-muted">{t('Nothing. Bold strategy.')}</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </Results>
    );
  }

  const active = state.active ? player(state.active) : null;
  const leader = state.leader ? player(state.leader) : null;
  const theme = AUCTION_THEMES.find((t) => t.id === item.theme)!;
  const me = state.active ? state.players.find((p) => p.id === state.active)! : null;
  const raises = me ? [minBid(state), minBid(state) + state.settings.increment * 2, minBid(state) + state.settings.increment * 5].filter((v, i, a) => v <= me.budget && a.indexOf(v) === i) : [];

  return (
    <div className="pt-screen">
      <ModeBar title={t('Name Your Price')} progress={t('Item {n}/{total}', { n: state.index + 1, total: Math.min(state.settings.rounds, state.queue.length) })} onExit={onExit} />
      <div className="pt-wallets">
        {state.players.map((p) => (
          <span key={p.id} className={`pt-wallet${p.id === state.active ? ' is-now' : ''}${state.passed.includes(p.id) ? ' is-out' : ''}`} style={{ ['--pc' as string]: player(p.id).color }}>
            {player(p.id).emoji} {player(p.id).name}
            <b>${p.budget}</b>
            <small>
              {p.items.length}/{state.settings.limit}
            </small>
          </span>
        ))}
      </div>
      <article className={`pt-lot pt-rarity-${item.rarity}`}>
        <span className="pt-kind">
          {theme.emoji} {t(theme.label)} · {t(RARITY[item.rarity]!)}
        </span>
        <span className="pt-lot-emoji" aria-hidden="true">
          {item.emoji}
        </span>
        <h2 className="pt-lot-name">{item.name}</h2>
        <p className="pt-lot-bid">
          {leader ? (
            <>
              <b>${state.bid}</b> · {tNodes('{who} leads', {}, { who: <Name player={leader} /> })}
            </>
          ) : (
            t('No bids yet')
          )}
        </p>
      </article>

      {state.phase === 'bidding' && active && me ? (
        <div className="pt-actions">
          {timed && <Timer key={`${state.index}-${state.active}-${state.bid}`} seconds={10} onEnd={() => set(reduceAuction(state, { type: 'pass' }))} />}
          <p>
            {tNodes('{who}, your move. You have ${n}.', { n: me.budget }, { who: <Name player={active} /> })}
          </p>
          <div className="pt-row">
            {raises.map((v) => (
              <button key={v} className="pt-btn pt-btn-go" onClick={() => set(reduceAuction(state, { type: 'bid', amount: v }))}>
                {t('Bid ${n}', { n: v })}
              </button>
            ))}
            <button className="pt-btn" onClick={() => set(reduceAuction(state, { type: 'pass' }))}>
              {t('Pass')}
            </button>
          </div>
          <form
            className="pt-row"
            onSubmit={(e) => {
              e.preventDefault();
              const v = Math.floor(Number(custom));
              if (canBid(state, me.id) && v >= minBid(state) && v <= me.budget) {
                set(reduceAuction(state, { type: 'bid', amount: v }));
                setCustom('');
              }
            }}
          >
            <input className="pt-input pt-input-sm" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} placeholder={`$${minBid(state)}–${me.budget}`} aria-label={t('Custom bid')} />
            <button className="pt-btn pt-btn-sm" disabled={!custom}>
              {t('Bid')}
            </button>
          </form>
        </div>
      ) : (
        <div className="pt-actions">
          <h3 className="pt-center">
            {state.phase === 'sold' && leader ? (
              <>
                {tNodes('🔨 Sold to {who} for ${n}!', { n: state.bid }, { who: <Name player={leader} /> })}
              </>
            ) : (
              t('Nobody wanted it. Unsold!')
            )}
          </h3>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => set(reduceAuction(state, { type: 'next' }))}>
            {t('Next item →')}
          </button>
        </div>
      )}
    </div>
  );
}
