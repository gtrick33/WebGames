import { useEffect, useMemo, useState } from 'react';
import { NHIE, NHIE_CATEGORIES } from '../content/nhie';
import { cardConsequence, draw, freshRng } from '../engine';
import type { PartySession } from '../session';
import type { NhieStatement } from '../types';
import { Avatar, ModeBar, PlayerPicker, Results } from './shared';
import { t } from '../../i18n';

export const FINGERS = 5;

/** A statement as shown after "Never have I ever…": one full stop, even when it ends in "a.m." or a typed one. */
export const statement = (text: string): string => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

type Nhie = Extract<NonNullable<PartySession['active']>, { mode: 'nhie' }>;

export function NeverMode({ session, update, onExit, onNeedAdult }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void; onNeedAdult: () => void }) {
  const [r] = useState(freshRng);
  const active = session.active?.mode === 'nhie' ? session.active : null;
  const [setup, setSetup] = useState(!active || active.count === 0);
  const [cats, setCats] = useState<string[]>(active?.categories.length ? active.categories : ['casual', 'funny', 'embarrassing']);
  const [reveal, setReveal] = useState(active?.reveal ?? true);
  const own = useMemo(() => session.custom.nhie.map((text, i): NhieStatement => ({ id: `cn-${i}`, text: text.replace(/^never have i ever\s*/i, ''), category: 'casual' })), [session.custom.nhie]);
  // After a refresh the statement that was on the table comes back.
  const [card, setCard] = useState<NhieStatement | null>(() => [...NHIE, ...own].find((s) => s.id === active?.card) ?? null);
  const [stage, setStage] = useState<'think' | 'count' | 'pick'>('think');
  const [count, setCount] = useState(3);
  const [haves, setHaves] = useState<string[]>([]);

  const deck = useMemo(
    () => [
      ...NHIE.filter((s) => cats.includes(s.category) && (s.category !== 'adults' || session.settings.adultConfirmed)),
      ...(cats.includes('custom') ? own : []),
    ],
    [cats, session.settings.adultConfirmed, own],
  );

  useEffect(() => {
    if (stage !== 'count') return;
    const t = window.setTimeout(() => {
      if (count <= 0) setStage('pick');
      else setCount((c) => c - 1);
    }, 700);
    return () => window.clearTimeout(t);
  }, [stage, count]);

  const deal = (st: Nhie): void => {
    const d = draw(deck, session.used.nhie ?? [], r);
    setCard(d.item);
    setHaves([]);
    setStage(reveal ? 'think' : 'pick');
    setCount(3);
    update((s) => ({ ...s, used: { ...s.used, nhie: d.used }, active: { ...st, count: st.count + 1, card: d.item?.id } }));
  };

  const start = (): void => {
    const limit = { quick: 15, standard: 30, long: 60 }[session.settings.length];
    const st: Nhie = { mode: 'nhie', count: 0, limit, reveal, categories: cats, have: {} };
    setSetup(false);
    deal(st);
  };

  if (setup || !active) {
    return (
      <div className="pt-screen">
        <ModeBar title={t('Never Have I Ever')} onExit={onExit} />
        <div className="pt-panel">
          <h3>{t('Pick your categories')}</h3>
          <div className="pt-picker">
            {[...NHIE_CATEGORIES, { id: 'custom' as const, label: `Your own (${session.custom.nhie.length})`, emoji: '✍️', adult: false }].map((c) => {
              const on = cats.includes(c.id);
              const locked = c.adult && !session.settings.adultConfirmed;
              return (
                <button
                  key={c.id}
                  className={`pt-chip${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  disabled={c.id === 'custom' && session.custom.nhie.length === 0}
                  onClick={() => (locked ? onNeedAdult() : setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id]))}
                >
                  {c.emoji} {t(c.label)} {locked ? '🔒' : ''}
                </button>
              );
            })}
          </div>
          <label className="pt-switch">
            <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
            <span>
              <b>{t('Reveal together')}</b>{' '}{t('· everyone thinks, then on “3, 2, 1” all hands go up at once')}
            </span>
          </label>
          <p className="pt-muted">{t('Everyone starts with {n} fingers up. Each time you have done it, one goes down. Last one standing wins.', { n: FINGERS })}</p>
          <button className="pt-btn pt-btn-go pt-btn-big" disabled={!deck.length} onClick={start}>
            {deck.length ? t('Start') : t('Pick at least one category')}
          </button>
        </div>
      </div>
    );
  }

  const fingers = (id: string): number => Math.max(0, FINGERS - (active.have[id] ?? 0));
  const standing = session.players.filter((p) => fingers(p.id) > 0);
  const over = active.count > active.limit || standing.length <= 1;
  if (over || !card) {
    if (!over && !card && deck.length) {
      return (
        <div className="pt-screen">
          <ModeBar title={t('Never Have I Ever')} onExit={onExit} />
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => deal(active)}>
            {t('Continue')}
          </button>
        </div>
      );
    }
    const scores = Object.fromEntries(session.players.map((p) => [p.id, fingers(p.id)]));
    const wild = [...session.players].sort((a, b) => (active.have[b.id] ?? 0) - (active.have[a.id] ?? 0))[0];
    return (
      <Results
        title={standing.length === 1 ? `${standing[0]!.name} has done the least!` : standing.length === 0 ? 'Everyone is out!' : 'Out of statements!'}
        players={session.players}
        scores={scores}
        awards={wild && (active.have[wild.id] ?? 0) > 0 ? [{ title: 'Most Experienced', playerId: wild.id, why: `has done ${active.have[wild.id]} of them` }] : []}
        onAgain={() => {
          setCard(null);
          setSetup(true);
          update((s) => ({ ...s, active: { mode: 'nhie', count: 0, limit: active.limit, reveal, categories: cats, have: {} } }));
        }}
        onMenu={onExit}
      />
    );
  }

  const cons = cardConsequence(session.settings.consequence, 1, `${card.id}:${active.count}`);
  const confirm = (): void => {
    const have = { ...active.have };
    for (const id of haves) have[id] = (have[id] ?? 0) + 1;
    const st = { ...active, have };
    update((s) => ({ ...s, active: st }));
    deal(st);
  };

  return (
    <div className="pt-screen">
      <ModeBar title={t('Never Have I Ever')} progress={`${active.count}/${active.limit}`} onExit={onExit} />
      <div className="pt-fingers">
        {session.players.map((p) => (
          <span key={p.id} className={`pt-finger${fingers(p.id) === 0 ? ' is-out' : ''}`} title={t('{name}: {n} fingers', { name: p.name, n: fingers(p.id) })}>
            <Avatar player={p} size={28} />
            ✋{fingers(p.id)}
          </span>
        ))}
      </div>
      <article className="pt-card pt-card-nhie" key={card.id}>
        <span className="pt-kind">{NHIE_CATEGORIES.find((c) => c.id === card.category)?.emoji} {t('Never have I ever…')}</span>
        <p className="pt-card-text">…{statement(card.text)}</p>
        <p className="pt-cons">
          {session.settings.consequence !== 'points' && session.settings.consequence !== 'none' ? t('If you have: finger down and {what}.', { what: cons }) : t('If you have: finger down.')}
        </p>
      </article>
      {stage === 'think' && (
        <div className="pt-actions">
          <p className="pt-muted">{t('Everyone decides in secret…')}</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => setStage('count')}>
            {t('Ready: count down')}
          </button>
        </div>
      )}
      {stage === 'count' && (
        <div className="pt-countdown" aria-live="assertive">
          {count > 0 ? count : t('Reveal!')}
        </div>
      )}
      {stage === 'pick' && (
        <div className="pt-actions">
          <p className="pt-muted">{t('Tap everyone who HAS done it:')}</p>
          <PlayerPicker players={session.players} selected={haves} label={t('Players who have')} onToggle={(id) => setHaves(haves.includes(id) ? haves.filter((x) => x !== id) : [...haves, id])} />
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={confirm}>
            {haves.length ? (haves.length > 1 ? t('{n} fingers down · next', { n: haves.length }) : t('1 finger down · next')) : t('Nobody! Next')}
          </button>
          <button className="pt-btn pt-btn-ghost" onClick={() => deal(active)}>
            {t('Skip this one')}
          </button>
        </div>
      )}
    </div>
  );
}
