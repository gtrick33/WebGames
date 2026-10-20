import { useEffect, useState, type FormEvent } from 'react';
import { GAMES } from '../catalog/games';
import { Icon } from '../components/Icon';
import { openSignIn } from '../components/openSignIn';
import { api, ApiError, useAccount } from '../platform/account';
import { track } from '../platform/analytics';
import type { BugReportView } from '../platform/apiTypes';
import { usePageMeta } from '../platform/meta';
import { Link, useLocation } from '../router/router';
import './InfoPages.css';

const CATEGORIES: { id: string; label: string; hint: string }[] = [
  { id: 'bug', label: 'Something broke', hint: 'A button, a level or a rule did not work' },
  { id: 'visual', label: 'Looks wrong', hint: 'Overlapping, cut off, unreadable' },
  { id: 'performance', label: 'Slow or laggy', hint: 'Stutters, long loads, battery drain' },
  { id: 'scores', label: 'Scores & saves', hint: 'Lost progress, wrong score, leaderboard' },
  { id: 'account', label: 'Account', hint: 'Sign-in, profile, emails' },
  { id: 'idea', label: 'Idea', hint: 'Not a bug, but it would be better if…' },
  { id: 'question', label: 'Question or request', hint: 'Your data, press, anything else' },
];
const SEVERITIES: { id: string; label: string }[] = [
  { id: 'blocker', label: 'Can’t play' },
  { id: 'annoying', label: 'Annoying' },
  { id: 'minor', label: 'Minor' },
];
const STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: 'Open', tone: 'yellow' },
  fixed: { label: 'Fixed', tone: 'lime' },
  wontfix: { label: 'Closed', tone: 'cyan' },
};

/** Screen and input details, attached so we can reproduce the bug (shown to the player before sending). */
function deviceSummary(): string {
  if (typeof window === 'undefined') return '';
  const touch = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
  const dark = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return `${window.screen.width}×${window.screen.height} screen · ${window.innerWidth}×${window.innerHeight} window · ${Math.round(window.devicePixelRatio * 10) / 10}x · ${touch} · ${dark} · ${navigator.language}`;
}

/** The page of this site the player came from, if the browser says so (another site's address is not sent). */
function fromPage(): string {
  try {
    const ref = new URL(document.referrer);
    return ref.origin === window.location.origin ? ref.pathname : '';
  } catch {
    return '';
  }
}

export function ProfileTabs({ current }: { current: 'me' | 'bugs' }) {
  return (
    <nav className="profile-tabs" aria-label="Profile sections">
      <Link href="/me" className="profile-tab" aria-current={current === 'me' ? 'page' : undefined}>
        <Icon name="user" size={18} /> Profile
      </Link>
      <Link href="/me/bugs" className="profile-tab" aria-current={current === 'bugs' ? 'page' : undefined}>
        <Icon name="bug" size={18} /> Bug reports
      </Link>
    </nav>
  );
}

export function BugReportPage() {
  usePageMeta({ title: 'Report a bug', path: '/me/bugs' });
  const { me } = useAccount();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const presetGame = params.get('game') ?? '';
  const presetCategory = params.get('category') ?? '';
  const [game, setGame] = useState(GAMES.some((g) => g.slug === presetGame) ? presetGame : '');
  // The contact page links here with ?category=question: tickets are the one way to reach the studio.
  const [category, setCategory] = useState(CATEGORIES.some((c) => c.id === presetCategory) ? presetCategory : 'bug');
  const [severity, setSeverity] = useState('annoying');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentId, setSentId] = useState(0);
  const [mine, setMine] = useState<BugReportView[] | null>(null);
  const [device] = useState(deviceSummary);

  useEffect(() => {
    if (!me) return;
    let off = false;
    api<{ reports: BugReportView[] }>('/api/bugs')
      .then((r) => !off && setMine(r.reports))
      .catch(() => !off && setMine([]));
    return () => {
      off = true;
    };
  }, [me, sentId]);

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setSending(true);
    setError('');
    try {
      const res = await api<{ id: number }>('/api/bugs', {
        body: {
          title: String(data.get('title') ?? ''),
          description: [String(data.get('description') ?? ''), String(data.get('steps') ?? '').trim() ? `\n\nSteps:\n${String(data.get('steps'))}` : ''].join(''),
          game,
          category,
          severity,
          device,
          page: fromPage(),
          contact: String(data.get('contact') ?? ''),
        },
      });
      track('bug_report', { category, game: game || 'site' });
      form.reset();
      setSentId(res.id || Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the report. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="wrap info-page profile bug-page">
      {me && <ProfileTabs current="bugs" />}
      <header>
        <h1 className="info-title">Report a bug</h1>
        <p className="info-lead">Something broken, confusing or unfair? Tell us. Every report is read, and we fix things fast.</p>
      </header>

      {sentId ? (
        <section className="panel info-block bug-sent" role="status">
          <h2>
            <Icon name="check" /> Report #{sentId} received. Thank you!
          </h2>
          <p>{me ? 'You can follow its status below.' : 'If you left an email, we will let you know when it is fixed.'}</p>
          <div className="reset-row">
            <button className="btn" onClick={() => setSentId(0)}>
              Report another
            </button>
            <Link href={game ? `/games/${game}` : '/'} className="btn btn-primary">
              Back to {GAMES.find((g) => g.slug === game)?.title ?? 'the arcade'}
            </Link>
          </div>
        </section>
      ) : (
        <form className="panel info-block bug-form" onSubmit={(e) => void submit(e)}>
          <label className="bug-label" htmlFor="bug-game">
            Where did it happen?
          </label>
          <select id="bug-game" className="field" value={game} onChange={(e) => setGame(e.target.value)}>
            <option value="">The website (not a game)</option>
            {GAMES.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title}
              </option>
            ))}
          </select>

          <fieldset className="bug-fieldset">
            <legend className="bug-label">What kind of problem?</legend>
            <div className="bug-cats">
              {CATEGORIES.map((c) => (
                <label key={c.id} className={`bug-cat${category === c.id ? ' is-on' : ''}`}>
                  <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} />
                  <strong>{c.label}</strong>
                  <span>{c.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="bug-fieldset">
            <legend className="bug-label">How bad is it?</legend>
            <div className="seg bug-sev" role="radiogroup">
              {SEVERITIES.map((s) => (
                <button type="button" key={s.id} role="radio" aria-checked={severity === s.id} className={severity === s.id ? 'is-on' : ''} onClick={() => setSeverity(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="bug-label" htmlFor="bug-title">
            Title
          </label>
          <input id="bug-title" name="title" className="field" required minLength={4} maxLength={120} placeholder="e.g. Tubes overlap on my phone in Color Lab" />

          <label className="bug-label" htmlFor="bug-desc">
            What happened?
          </label>
          <textarea id="bug-desc" name="description" className="field bug-text" required minLength={10} maxLength={3000} rows={5} placeholder="What did you expect, and what happened instead?" />

          <label className="bug-label" htmlFor="bug-steps">
            How can we make it happen again? <span>(optional)</span>
          </label>
          <textarea id="bug-steps" name="steps" className="field bug-text" maxLength={900} rows={3} placeholder={'1. Open the daily\n2. Tap…'} />

          {!me && (
            <>
              <label className="bug-label" htmlFor="bug-contact">
                Email for updates <span>(optional)</span>
              </label>
              <input id="bug-contact" name="contact" type="email" className="field" maxLength={120} placeholder="you@example.com" />
            </>
          )}

          <p className="info-small bug-device">
            <Icon name="keyboard" size={16} /> We’ll attach your browser and screen size: <span className="mono">{device}</span>
          </p>
          {error && (
            <p className="bug-error" role="alert">
              {error}
            </p>
          )}
          <div className="reset-row">
            <button className="btn btn-primary btn-lg" disabled={sending}>
              <Icon name="bug" /> {sending ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="mine-title">
        <h2 id="mine-title" className="profile-h2">
          Your reports
        </h2>
        {!me ? (
          <p className="info-lead">
            <button className="link-btn" onClick={() => openSignIn('Sign in to follow your bug reports.')}>
              Sign in
            </button>{' '}
            to see the status of everything you report.
          </p>
        ) : mine === null ? (
          <p className="info-small">Loading…</p>
        ) : mine.length === 0 ? (
          <p className="info-lead">Nothing reported yet. Thanks for playing!</p>
        ) : (
          <ul className="bug-list">
            {mine.map((b) => {
              const st = STATUS[b.status] ?? STATUS.open!;
              return (
                <li key={b.id} className="panel bug-item">
                  <span className="sticker" data-tone={st.tone}>
                    {st.label}
                  </span>
                  <div>
                    <strong>
                      #{b.id} {b.title}
                    </strong>
                    <p className="info-small mono">
                      {GAMES.find((g) => g.slug === b.game)?.title ?? 'Website'} · {new Date(b.ts).toLocaleDateString()}
                      {b.updatedAt > b.ts + 1000 ? ` · updated ${new Date(b.updatedAt).toLocaleDateString()}` : ''}
                    </p>
                    {b.note && <p className="bug-note">“{b.note}”</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
