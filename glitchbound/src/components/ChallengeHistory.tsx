import { useEffect, useState } from 'react';
import { getGame } from '../catalog/catalog';
import { getLang, useT } from '../i18n';
import type { ChallengeHistoryItem } from '../platform/challenge';
import { challengeHistory } from '../platform/challenges';
import { useLiveCatalog } from '../platform/liveCatalog';
import { Link } from '../router/router';
import '../pages/ChallengePage.css';

const fmt = (n: number): string => n.toLocaleString('en-US');

/** The player's challenge history (null while it loads; empty when it could not be loaded). Fetched again when `version` changes. */
export function useChallengeHistory(version = 0): ChallengeHistoryItem[] | null {
  const [list, setList] = useState<ChallengeHistoryItem[] | null>(null);
  useEffect(() => {
    let live = true;
    challengeHistory().then(
      (r) => live && setList(r.history),
      () => live && setList([]),
    );
    return () => {
      live = false;
    };
  }, [version]);
  return list;
}

/** Who won (or leads, while it is open); a tie names everyone in it. */
export function standing(c: ChallengeHistoryItem, t: ReturnType<typeof useT>): { text: string; you: boolean } {
  const me = c.players.find((p) => p.you)?.name;
  const [one, ...more] = c.leaders;
  if (one === undefined) return { text: t('No scores yet'), you: false };
  if (more.length) return { text: t('Tied: {names}', { names: c.leaders.join(', ') }), you: c.leaders.includes(me ?? '') };
  if (one === me) return { text: c.closed ? t('You won') : t('You lead'), you: true };
  return { text: c.closed ? t('{name} won', { name: one }) : t('{name} leads', { name: one }), you: false };
}

/**
 * Challenges a player was in: the game, when, against whom, everyone's score in the last round
 * played and who won or leads. Each opens its game with the challenge's scoreboard.
 */
export function ChallengeHistoryList({ items }: { items: ChallengeHistoryItem[] }) {
  const t = useT();
  const live = useLiveCatalog();
  return (
    <ul className="chal-list">
      {items.map((c) => {
        const g = getGame(c.game, live.all);
        const others = c.players.filter((p) => !p.you).map((p) => p.name);
        const result = standing(c, t);
        return (
          <li key={c.id} className="chal-item">
            <Link href={`/games/${c.game}?challenge=${c.id}`} className="chal-row" data-accent={g?.accent}>
              {g && <img src={g.art.tile} alt="" width={48} height={48} style={{ background: g.art.bg }} />}
              <span className="chal-row-main">
                <b>{g?.title ?? c.game}</b>
                <span className="info-small">
                  {new Date(c.updatedAt).toLocaleDateString(getLang(), { month: 'short', day: 'numeric' })}
                  {others.length ? ` · ${t('vs {names}', { names: others.join(', ') })}` : ` · ${t('Nobody else joined')}`}
                  {c.round > 1 ? ` · ${t('round {n}', { n: c.round })}` : ''}
                </span>
                {c.players.some((p) => p.score !== null) && (
                  <span className="info-small mono chal-scores">
                    {c.players.map((p, i) => (
                      <span key={p.name}>
                        {i > 0 && ' · '}
                        {p.you ? <b>{p.name}</b> : p.name} {p.score === null ? '–' : fmt(p.score)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className={`chal-badge${result.you ? ' is-turn' : ''}`}>{result.text}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
