import { useMemo } from 'react';
import { ARCADE, earnedPins, PIN_BOARDS, pinsOf, shelfRank } from '../catalog/pins';
import { gameUrl, getGame } from '../catalog/catalog';
import { BoardError } from '../components/Leaderboard';
import { Icon } from '../components/Icon';
import { openSignIn } from '../components/openSignIn';
import { guestFacts, Pin, rarityLabel, usePins } from '../components/Pins';
import { useT } from '../i18n';
import type { PinsView } from '../platform/apiTypes';
import { useAccount } from '../platform/account';
import { useLiveCatalog } from '../platform/liveCatalog';
import { usePageMeta } from '../platform/meta';
import { useSave } from '../platform/store';
import { useStreakDays } from '../platform/streak';
import { Link, useLocation } from '../router/router';
import { ProfileTabs } from './BugReportPage';
import './InfoPages.css';

export function TrophiesPage() {
  usePageMeta({ title: 'Trophy Shelf', description: 'Every GlitchBound game has four enamel pins to earn, from a first round to the one very few will ever hold.', path: '/trophies' });
  const t = useT();
  const { me } = useAccount();
  const live = useLiveCatalog();
  const friend = new URLSearchParams(useLocation().search).get('friend');
  const { view, failed } = usePins(friend);
  const save = useSave();
  const days = useStreakDays();
  const held = useMemo(() => new Set(view?.pins.map((p) => p.id)), [view]);
  // A guest's own record on this device: shown as what they would hold, never awarded.
  const wouldHold = useMemo(() => (me ? [] : earnedPins(guestFacts(save, days))), [me, save, days]);
  const boards = PIN_BOARDS.filter((b) => !live.settings(b).hidden);
  const points = view?.points ?? 0;
  const { title, next } = shelfRank(points);
  const owner = view?.owner;

  return (
    <div className="wrap info-page">
      {me && !friend && <ProfileTabs current="trophies" />}
      <header className="shelf-head">
        <div>
          <p className="eyebrow">
            <Icon name="star" size={16} /> {owner ? t('A friend’s collection') : t('Your collection')}
          </p>
          <h1 className="info-title">{owner ? owner.nickname : t('Trophy Shelf')}</h1>
          {!owner && <p className="info-lead">{t('Every game has four pins, from a first round to the one very few will ever hold. Once earned, a pin is yours for good.')}</p>}
        </div>
        {view && (me || owner) && (
          <div className="felt shelf-rank">
            <span className="mono">{t('{n} points', { n: points })}</span>
            <span className="shelf-rank-title">{view.rank || title}</span>
            {next && (
              <>
                <span className="shelf-rank-bar" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, (points / next.points) * 100)}%` }} />
                </span>
                <span className="shelf-rank-next">{t('{n} points to {rank}', { n: next.points - points, rank: next.title })}</span>
              </>
            )}
          </div>
        )}
      </header>

      {friend && owner && (
        <p>
          <Link href="/me/friends" className="quests-link">
            <Icon name="arrowLeft" size={16} /> {t('Friends')}
          </Link>
        </p>
      )}

      {!me && (
        <div className="felt shelf-guest">
          <p>{wouldHold.length > 0 ? t('You’d hold {n} pins by now. Sign in and your next rounds count.', { n: wouldHold.length }) : t('Sign in and your rounds start filling this shelf.')}</p>
          <button className="btn btn-magenta" onClick={() => openSignIn(t('Sign in to collect pins on your Trophy Shelf.'))}>
            {t('Sign in to collect')}
          </button>
        </div>
      )}
      {failed && !friend && <BoardError text="The shelf is offline right now. Your game still works." onRetry={() => window.location.reload()} />}

      <div className="shelf-boards">
        <Board id={ARCADE} held={held} view={view} wide />
        {boards.map((b) => (
          <Board key={b} id={b} held={held} view={view} />
        ))}
      </div>
    </div>
  );
}

function Board({ id, held: have, view: v, wide = false }: { id: string; held: Set<string>; view: PinsView | null; wide?: boolean }) {
  const t = useT();
  const pins = pinsOf(id);
  const game = id === ARCADE ? undefined : getGame(id);
  const count = pins.filter((p) => have.has(p.id)).length;
  const head = (
    <>
      {game && <img src={game.art.tile} alt="" width={40} height={40} loading="lazy" style={{ background: game.art.bg }} />}
      <h2 className="shelf-board-title">{game ? game.title : t('The arcade')}</h2>
      <span className="shelf-board-count mono">
        {count} / {pins.length}
      </span>
    </>
  );
  return (
    <section className={`felt shelf-board${wide ? ' is-wide' : ''}${count === pins.length ? ' is-complete' : ''}`}>
      {game ? (
        <Link href={gameUrl(game.slug)} className="shelf-board-head">
          {head}
        </Link>
      ) : (
        <div className="shelf-board-head">{head}</div>
      )}
      <ul className="shelf-board-pins">
        {pins.map((p) => (
          <Pin key={p.id} pin={p} earned={have.has(p.id)} rarity={rarityLabel(v, p.id, t)} />
        ))}
      </ul>
    </section>
  );
  }
