import { useState } from 'react';
import { GAMES } from '../catalog/games';
import { t as tr, tDaily, useT } from '../i18n';
import type { QuestView } from '../platform/apiTypes';
import { fmt, templateText } from '../platform/daily';
import { account, useAccount } from '../platform/account';
import { formatCountdown, msUntilMidnight } from '../platform/dates';
import { useNow } from '../platform/hooks';
import { Link } from '../router/router';
import { Burst } from './Burst';
import { Icon } from './Icon';
import { openSignIn } from './openSignIn';
import './Quests.css';

/** A quest's text in the current language, rebuilt from its id (the server sends it in English). */
export function questLabel(q: Pick<QuestView, 'id' | 'label' | 'target'>): string {
  const rounds = /^rounds-(\d+)$/.exec(q.id);
  if (rounds) return tr('Play {n} rounds', { n: rounds[1]! });
  if (q.id === 'best') return tr('Beat one of your personal bests');
  if (q.id === 'daily') return tr('Clear today’s Daily Challenge');
  if (q.id === 'favorite') return tr('Add a game to your favorites');
  const m = /^metric-([a-z0-9-]+)-([A-Za-z]+)-(\d+)$/.exec(q.id);
  const g = m ? GAMES.find((x) => x.slug === m[1]) : undefined;
  const tpl = m && g?.daily ? (g.daily.find((d) => d.metric === m[2] && d.targets.includes(q.target)) ?? g.daily.find((d) => d.metric === m[2])) : undefined;
  if (!g || !tpl) return tr(q.label);
  const text = templateText(tpl, q.target);
  const goal = tDaily({ label: text.replace('{n}', fmt(q.target)), template: text, target: q.target });
  return goal.includes(g.title) ? goal : tr('{goal} in {game}', { goal, game: g.title });
}

function QuestCard({ q, onClaim, busy }: { q: QuestView; onClaim: () => void; busy: boolean }) {
  const pct = Math.round((q.progress / q.target) * 100);
  return (
    <li className={`quest${q.done ? ' is-done' : ''}${q.claimed ? ' is-claimed' : ''}`}>
      <span className="quest-icon">
        <Icon name={q.icon} size={22} />
      </span>
      <div className="quest-main">
        <p className="quest-label">{questLabel(q)}</p>
        <div className="quest-bar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="quest-meta mono">
          {q.progress.toLocaleString('en-US')} / {q.target.toLocaleString('en-US')} · +{q.xp} XP
        </p>
      </div>
      {q.claimed ? (
        <span className="quest-state mono">
          <Icon name="check" size={16} /> {tr('Claimed')}
        </span>
      ) : q.done ? (
        <button className="btn btn-lime btn-sm quest-claim" onClick={onClaim} disabled={busy}>
          {tr('Claim +{n}', { n: q.xp })}
        </button>
      ) : (
        <span className="quest-state mono">{pct}%</span>
      )}
    </li>
  );
}

/** Member daily quests with claimable XP. Guests see what they would get. */
export function QuestBoard({ compact = false }: { compact?: boolean }) {
  useT();
  const { me, status } = useAccount();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const [toast, setToast] = useState('');

  if (!me) {
    return (
      <section className="quests quests-guest panel" aria-labelledby="quests-title">
        <div>
          <p className="eyebrow">{tr('Members only · free')}</p>
          <h2 id="quests-title" className="quests-title">
            {tr('Daily quests')}
          </h2>
          <p className="quests-sub">{tr('Sign in to get three new quests every day. Earn XP, level up, collect badges and get your nickname onto the leaderboards.')}</p>
        </div>
        <ul className="quests-ghost" aria-hidden="true">
          {['Play 3 rounds', 'Beat one of your personal bests', 'Clear today’s Daily Challenge'].map((l, i) => (
            <li key={l} className="quest">
              <span className="quest-icon">
                <Icon name={(['play', 'trophy', 'calendar'] as const)[i]!} size={22} />
              </span>
              <div className="quest-main">
                <p className="quest-label">{tr(l)}</p>
                <div className="quest-bar">
                  <i style={{ width: `${[60, 0, 30][i]}%` }} />
                </div>
              </div>
              <span className="quest-state mono">+{[66, 120, 150][i]} XP</span>
            </li>
          ))}
        </ul>
        <button className="btn btn-magenta btn-lg" onClick={() => openSignIn(tr('Sign in to unlock daily quests.'))} disabled={status === 'loading'}>
          <Icon name="star" /> {tr('Unlock quests')}
        </button>
      </section>
    );
  }

  const claim = async (q: QuestView): Promise<void> => {
    setBusy(true);
    try {
      const res = await account.claimQuest(q.id);
      setBurst((b) => b + 1);
      setToast(res.levelUp ? tr('Level up! You are now level {n}.', { n: account.state.me?.level ?? '' }) : `+${res.xp} XP`);
      window.setTimeout(() => setToast(''), 3000);
    } catch {
      setToast(tr('Could not claim right now. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const pct = Math.round(((me.xp - me.levelFloor) / Math.max(1, me.levelNext - me.levelFloor)) * 100);
  const doneCount = me.quests.filter((q) => q.claimed).length;
  return (
    <section className={`quests panel${compact ? ' quests-compact' : ''}`} aria-labelledby="quests-title">
      {burst > 0 && <Burst key={burst} />}
      <div className="quests-head">
        <div>
          <p className="eyebrow">{tr('Your quests · {a}/{b} claimed', { a: doneCount, b: me.quests.length })}</p>
          <h2 id="quests-title" className="quests-title">
            {tr('Daily quests')}
          </h2>
        </div>
        <div className="quests-level">
          <span className="quests-lvl">
            <span className="mono">LV</span>
            <b>{me.level}</b>
          </span>
          <div className="quests-xp">
            <div className="xpbar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <span className="mono">
              {tr('{a} / {b} XP to level {n}', { a: me.xp - me.levelFloor, b: me.levelNext - me.levelFloor, n: me.level + 1 })}
            </span>
          </div>
        </div>
      </div>
      <ul className="quest-list">
        {me.quests.map((q) => (
          <QuestCard key={q.id} q={q} busy={busy} onClaim={() => void claim(q)} />
        ))}
      </ul>
      <div className="quests-foot">
        <span className="mono">{tr('New quests in {time}', { time: formatCountdown(msUntilMidnight(now)) })}</span>
        {compact ? (
          <Link href="/me" className="quests-link">
            {tr('Profile, badges & bests')} <Icon name="arrowRight" size={16} />
          </Link>
        ) : (
          <Link href="/" className="quests-link">
            {tr('Find a game')} <Icon name="arrowRight" size={16} />
          </Link>
        )}
      </div>
      <p className="quests-toast" role="status">
        {toast}
      </p>
    </section>
  );
}
