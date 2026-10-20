import { useEffect, useRef, useState } from 'react';
import { GAMES } from '../catalog/games';
import { getLiveCatalog } from '../platform/liveCatalog';
import { api } from '../platform/account';
import { track } from '../platform/analytics';
import { LOBBY_DELAY_S, readFeedback, registerFeedbackOpener, shouldAsk, writeFeedback } from '../platform/feedback';
import { useSave } from '../platform/store';
import { Link, matchRoute, useLocation } from '../router/router';
import { Icon } from './Icon';
import { useT } from '../i18n';
import './FeedbackPrompt.css';

const WISHES: { id: string; label: string }[] = [
  { id: 'more_games', label: 'More games' },
  { id: 'more_dailies', label: 'More dailies' },
  { id: 'harder', label: 'Harder' },
  { id: 'easier', label: 'Easier' },
  { id: 'multiplayer', label: 'Play vs friends' },
  { id: 'better_mobile', label: 'Better on phones' },
];
const STAR_WORDS = ['', 'Not for me', 'Meh', 'It’s OK', 'Really fun', 'I love it!'];
/** Pages that count as "the lobby": never interrupt a game in progress. */
const LOBBY = new Set(['home', 'daily', 'leaderboards']);

type Step = 'stars' | 'details' | 'thanks';

/**
 * The "Enjoying GlitchBound?" card: five stars, then an optional comment and a wish. Slides in on
 * lobby pages after a few finished rounds (see platform/feedback.ts), or opens on demand.
 */
export function FeedbackPrompt() {
  const t = useT();
  const save = useSave();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  /** The game the player opened the card from (its "Rate this game" button), if any. */
  const [about, setAbout] = useState('');
  const [step, setStep] = useState<Step>('stars');
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [game, setGame] = useState('');
  const [wish, setWish] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const askedThisVisit = useRef(false);
  const panel = useRef<HTMLDivElement>(null);

  const rounds = Object.values(save.games).reduce((n, g) => n + g.plays, 0);
  // Default the "which game" question to the game this player plays most.
  const favorite = Object.entries(save.games).sort((a, b) => b[1].plays - a[1].plays)[0]?.[0] ?? '';

  const show = (g = '', isManual = false): void => {
    setGame(g || favorite);
    setAbout(g);
    setManual(isManual);
    setStep('stars');
    setStars(0);
    setWish('');
    setMessage('');
    setError('');
    setOpen(true);
  };

  useEffect(() => {
    registerFeedbackOpener((g) => show(g ?? '', true));
    return () => registerFeedbackOpener(null);
  });

  // Lobby timer: ask once per visit, after a quiet moment on a lobby page.
  const route = matchRoute(pathname).name;
  useEffect(() => {
    if (!LOBBY.has(route) || askedThisVisit.current || open) return;
    if (!shouldAsk(readFeedback(), rounds, Date.now())) return;
    const timer = window.setTimeout(() => {
      if (document.hidden || askedThisVisit.current) return;
      askedThisVisit.current = true;
      writeFeedback({ ...readFeedback(), lastShown: Date.now() });
      track('feedback_prompt');
      show();
    }, LOBBY_DELAY_S * 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, rounds, open]);

  // Leaving the lobby for a game hides an unanswered automatic prompt.
  const [seenRoute, setSeenRoute] = useState(route);
  if (seenRoute !== route) {
    setSeenRoute(route);
    if (open && !manual && step === 'stars' && !LOBBY.has(route)) setOpen(false);
  }

  // A card that slid in by itself doesn't take the focus (the player may be typing somewhere); one they opened does.
  useEffect(() => {
    if (open && (manual || step !== 'stars')) panel.current?.querySelector<HTMLElement>('button, textarea')?.focus({ preventScroll: true });
  }, [open, step, manual]);

  const close = (): void => {
    if (step !== 'thanks' && !manual) {
      const s = readFeedback();
      writeFeedback({ ...s, dismissals: s.dismissals + 1 });
    }
    setOpen(false);
  };

  const send = async (): Promise<void> => {
    if (!stars || sending) return;
    setSending(true);
    setError('');
    try {
      await api('/api/feedback', { body: { stars, message: message.trim(), game, wish } });
      writeFeedback({ ...readFeedback(), sentAt: Date.now() });
      track('feedback_sent', { stars });
      setStep('thanks');
    } catch {
      setError(t('Could not send right now. Please try again in a moment.'));
    } finally {
      setSending(false);
    }
  };

  // Escape closes the card wherever the focus is, unless a dialog in front of it takes the key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open], [aria-modal="true"]')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;
  const shown = hover || stars;
  const aboutTitle = GAMES.find((g) => g.slug === about)?.title;

  return (
    <div className="fb" role="dialog" aria-labelledby="fb-title" ref={panel}>
      <button className="fb-close" onClick={close} aria-label={t('Close')}>
        <Icon name="close" size={18} />
      </button>
      {step === 'thanks' ? (
        <div className="fb-thanks">
          <span className="fb-burst" aria-hidden="true">
            ★
          </span>
          <h2 id="fb-title">{t('Thank you!')}</h2>
          <p>{t('We read every note. It shapes what we build next.')}</p>
          <Link href={`/me/bugs${game ? `?game=${game}` : ''}`} className="fb-link" onClick={() => setOpen(false)}>
            <Icon name="bug" size={16} /> {t('Found a bug? Report it')}
          </Link>
        </div>
      ) : (
        <>
          <h2 id="fb-title">{aboutTitle ? t('How do you like {game}?', { game: aboutTitle }) : t('Enjoying GlitchBound?')}</h2>
          <div className="fb-stars" role="radiogroup" aria-label={t('Your rating')} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} ★: ${t(STAR_WORDS[n]!)}`}
                className={`fb-star${n <= shown ? ' is-on' : ''}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => {
                  setStars(n);
                  setStep('details');
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
                </svg>
              </button>
            ))}
          </div>
          <p className="fb-word mono" aria-live="polite">
            {shown ? t(STAR_WORDS[shown]!) : t('Tap a star')}
          </p>
          {step === 'details' && (
            <div className="fb-details">
              <label className="fb-label" htmlFor="fb-msg">
                {stars <= 3 ? t('What should we fix or change?') : t('What would make it even better?')} <span>({t('optional')})</span>
              </label>
              <textarea id="fb-msg" className="field fb-text" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('Tell us anything…')} />
              <p className="fb-label">{t('I’d love…')}</p>
              <div className="fb-chips">
                {WISHES.map((w) => (
                  <button key={w.id} className={`fb-chip${wish === w.id ? ' is-on' : ''}`} aria-pressed={wish === w.id} onClick={() => setWish(wish === w.id ? '' : w.id)}>
                    {t(w.label)}
                  </button>
                ))}
              </div>
              <label className="fb-label" htmlFor="fb-game">
                {t('About a game?')} <span>({t('optional')})</span>
              </label>
              <select id="fb-game" className="field fb-select" value={game} onChange={(e) => setGame(e.target.value)}>
                <option value="">{t('The arcade in general')}</option>
                {GAMES.filter((g) => !getLiveCatalog().settings(g.slug).hidden).map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.title}
                  </option>
                ))}
              </select>
              {error && <p className="fb-error">{error}</p>}
              <button className="btn btn-primary fb-send" onClick={() => void send()} disabled={sending}>
                {sending ? t('Sending…') : t('Send feedback')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
