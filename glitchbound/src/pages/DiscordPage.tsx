import { useEffect, useState } from 'react';
import { getGame } from '../catalog/catalog';
import { Icon } from '../components/Icon';
import { callGames, playInCall, startDiscord, watchParticipants, type CallGames, type DiscordSession, type Participant } from '../discord/session';
import { useT } from '../i18n';
import { ApiError } from '../platform/account';
import { playerKey } from '../platform/challenges';
import { useEmbedHost } from '../platform/embed';
import { usePageMeta } from '../platform/meta';
import { Link, navigate } from '../router/router';
import { AdultLabel } from '../components/AdultLabel';
import './InfoPages.css';
import './DiscordPage.css';

/**
 * /discord: the Discord Activity's start page (docs/discord-activity.md). Inside Discord it signs the
 * player in with their Discord name and lets the call pick a game everyone plays together.
 */

const GAMES = [
  { slug: 'wait-what', how: 'Same trivia round for everyone in the call, one try each. Live scoreboard, next round in one tap.' },
  { slug: 'crass-act', how: 'One card table for the whole call: crude, dark and 18+. Everyone plays from their own screen.' },
] as const;
type Slug = (typeof GAMES)[number]['slug'];

const SEAT_COLORS = ['#ff4fc8', '#2ad1f0', '#ffc928', '#b6e62c', '#ff6a1a', '#7b4dff'];

export function DiscordPage() {
  const t = useT();
  usePageMeta({ title: t('GlitchBound on Discord'), path: '/discord' });
  const embed = useEmbedHost();
  return embed?.kind === 'discord' ? <Activity /> : <Outside />;
}

/** Opened in a normal browser: how to start it in Discord. */
function Outside() {
  const t = useT();
  return (
    <div className="wrap info-page dsc">
      <p className="eyebrow">{t('Discord Activity')}</p>
      <h1 className="info-title">{t('Play GlitchBound in a Discord call')}</h1>
      <p className="info-lead">{t('Join a voice channel, press the rocket (Activities) button and pick GlitchBound. Everyone in the call plays the same game together.')}</p>
      <Link href="/" className="btn btn-primary">
        {t('Play in the browser')}
      </Link>
    </div>
  );
}

function errorText(err: unknown, t: ReturnType<typeof useT>): string {
  if (err instanceof ApiError) {
    if (err.code === 'discord_not_configured') return t('The Discord Activity is not set up yet.');
    if (err.code === 'bad_code' || err.code === 'bad_token') return t('Discord did not confirm who you are. Try again.');
    return t('Could not reach GlitchBound. Check your connection.');
  }
  // The SDK rejects with { code, message } when the player declines or the handshake fails.
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
  return msg ? `${t('Discord could not sign you in.')} (${msg})` : t('Discord could not sign you in.');
}

function Activity() {
  const t = useT();
  const [session, setSession] = useState<DiscordSession | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    startDiscord().then(
      (s) => live && setSession(s),
      (e: unknown) => live && setError(errorText(e, t)),
    );
    return () => {
      live = false;
    };
  }, [attempt, t]);
  if (error)
    return (
      <div className="wrap info-page dsc">
        <h1 className="info-title">{t('Not signed in')}</h1>
        <p className="info-lead">{error}</p>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setAttempt((a) => a + 1);
          }}
        >
          <Icon name="restart" /> {t('Try again')}
        </button>
      </div>
    );
  if (!session)
    return (
      <div className="wrap info-page dsc">
        <p className="info-lead" role="status">
          {t('Connecting to Discord…')}
        </p>
      </div>
    );
  return <Picker session={session} />;
}

export function Picker({ session }: { session: DiscordSession }) {
  const t = useT();
  const [people, setPeople] = useState<Participant[]>([]);
  const [running, setRunning] = useState<CallGames | null>(null);
  const [busy, setBusy] = useState<Slug | ''>('');
  const [msg, setMsg] = useState('');
  useEffect(() => watchParticipants(session.sdk, setPeople), [session]);
  // What the others already started, so "Join" shows before anyone says it in voice.
  useEffect(() => {
    let live = true;
    const load = (): void => {
      if (document.visibilityState !== 'hidden') callGames(session.instanceId).then((r) => live && setRunning(r.games), () => undefined);
    };
    load();
    const id = window.setInterval(load, 5000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [session]);

  const pick = async (slug: Slug): Promise<void> => {
    setBusy(slug);
    setMsg('');
    try {
      const r = await playInCall(session.instanceId, slug, session.user.name, playerKey());
      if (r.challenge) return navigate(`/games/wait-what?challenge=${r.challenge}`);
      if (r.room) return navigate(`/games/crass-act?room=${r.room}`);
      throw new Error('empty');
    } catch (e) {
      setMsg(e instanceof ApiError && e.message !== e.code ? e.message : e instanceof ApiError && e.code === 'rooms_unavailable' ? t('Rooms are not available right now. Try again in a minute.') : t('Network error. Try again.'));
      setBusy('');
    }
  };

  return (
    <div className="wrap info-page dsc">
      <p className="eyebrow">{t('Hi {name}!', { name: session.user.name })}</p>
      <h1 className="info-title">{t('Pick a game for the call')}</h1>
      {people.length > 0 && (
        <ul className="dsc-people" aria-label={t('In the Activity')}>
          {people.map((p, i) => (
            <li key={p.id} title={p.name}>
              <span className="dsc-dot" style={{ background: SEAT_COLORS[i % SEAT_COLORS.length] }} aria-hidden="true">
                {[...p.name][0]?.toUpperCase()}
              </span>
              <span className="dsc-name">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
      <ul className="dsc-games">
        {GAMES.map(({ slug, how }) => {
          const game = getGame(slug);
          if (!game) return null;
          const live = running?.[slug];
          return (
            <li key={slug}>
              <button className="dsc-game panel" data-accent={game.accent} disabled={!!busy} onClick={() => void pick(slug)}>
                <img src={game.art.tile} alt="" width={96} height={96} style={{ background: game.art.bg }} />
                <span className="dsc-game-main">
                  <b>
                    {game.title} {game.adult && <AdultLabel text={t('Adults only')} />}
                  </b>
                  <span className="info-small">{t(how)}</span>
                  {live && live.players > 0 && <span className="dsc-live">{t('{n} playing now', { n: live.players })}</span>}
                </span>
                <span className="btn btn-sm btn-primary dsc-go">{busy === slug ? t('Loading…') : live ? t('Join') : t('Start')}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {msg && (
        <p className="dsc-msg" role="alert">
          {msg}
        </p>
      )}
      <p className="info-small">{t('Whoever picks first starts it; everyone else in the call joins the same game. Invite more people with Discord’s invite button.')}</p>
    </div>
  );
}
