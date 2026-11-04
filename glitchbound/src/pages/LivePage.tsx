import { useState, type FormEvent } from 'react';
import { orderByLayout } from '../catalog/settings';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import { RoomList } from '../components/OnlinePlay';
import { useT } from '../i18n';
import { useLiveCatalog } from '../platform/liveCatalog';
import { usePageMeta } from '../platform/meta';
import { GAME_ROOM_PAGE, roomInfo, type RoomGame } from '../platform/rooms';
import { useSave } from '../platform/store';
import { Link, navigate } from '../router/router';
import './InfoPages.css';
import './LivePage.css';

/** Where a room is played: its game's page, or Party Mode (rooms from before there were games are Crass Act). */
export const roomPath = (game: RoomGame | undefined, code: string): string => `${GAME_ROOM_PAGE[game ?? 'crass-act'] ?? '/party'}?room=${code}`;

/**
 * Live rooms (/live): the games friends play together at the same moment, each on their own device
 * (GameEntry.live), the public rooms open right now in any game, and a room code box. A page of its
 * own, reached from a quiet chip in the arcade, the "Better with friends" band and the footer, so the
 * home page keeps its order.
 */
export function LivePage() {
  const t = useT();
  usePageMeta({
    title: 'Live rooms',
    description: 'Play GlitchBound games live with friends, each on your own phone or computer: open a room and send the link, or join a public room that is waiting.',
    path: '/live',
  });
  const live = useLiveCatalog();
  const save = useSave();
  const games = orderByLayout(
    live.games.filter((g) => g.live && !live.settings(g.slug).maintenance),
    live.layout,
  );
  return (
    <div className="wrap info-page live-page">
      <p className="eyebrow live-eyebrow">
        <i className="live-dot" aria-hidden="true" /> {t('Live multiplayer')}
      </p>
      <h1 className="info-title">{t('Live rooms')}</h1>
      <p className="info-lead">{t('Play at the same moment as your friends, each on your own phone or computer. Open a room in any game below and send the link, or join one that is waiting.')}</p>

      <section aria-labelledby="live-games">
        <h2 id="live-games" className="sr-only">
          {t('Games with live rooms')}
        </h2>
        <div className="arcade-grid live-grid">
          {games.map((g, i) => (
            <GameTile key={g.slug} game={g} index={i} size="md" best={save.games[g.slug]?.best.score} />
          ))}
        </div>
      </section>

      <div className="live-columns">
        <section className="panel info-block live-rooms" aria-labelledby="live-open">
          <h2 id="live-open">
            <Icon name="party" size={20} /> {t('Rooms open right now')}
          </h2>
          <div className="op">
            <RoomList onJoin={(code, room) => navigate(roomPath(room.game, code))} empty={t('No public rooms right now. Open one in any game above and it shows up here for everyone.')} />
          </div>
        </section>
        <aside className="panel info-block live-side">
          <h2>{t('Join a room')}</h2>
          <CodeBox />
          <p className="info-small">
            {t('Got friends in the same room? Pass one phone around in Party Mode.')} <Link href="/party">{t('Party Mode')} →</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

function CodeBox() {
  const t = useT();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-HJKMNP-Z]{5}$/.test(c)) return setErr(t('Room codes are five letters.'));
    setBusy(true);
    const info = await roomInfo(c);
    setBusy(false);
    if (!info) return setErr(t('No room has that code. It may have closed.'));
    navigate(roomPath(info.game, c));
  };
  return (
    <form className="live-code" onSubmit={(e) => void submit(e)}>
      <label>
        <span className="sr-only">{t('Room code')}</span>
        <input value={code} onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setErr('');
          }} placeholder={t('Room code')} maxLength={5} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="mono" />
      </label>
      <button className="btn btn-primary" disabled={busy}>
        {t('Join')}
      </button>
      {err && (
        <p className="live-err" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
