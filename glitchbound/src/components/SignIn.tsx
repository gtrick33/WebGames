import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t as tr, useT } from '../i18n';
import { account, ApiError, useAccount } from '../platform/account';
import { track } from '../platform/analytics';
import { navigate } from '../router/router';
import { Icon } from './Icon';
import { onSignInOpen } from './openSignIn';
import './SignIn.css';

interface TokenResponse {
  access_token?: string;
  error?: string;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(opts: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string }) => void;
          }): { requestAccessToken(o?: { prompt?: string }): void };
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;
function loadGoogle(): Promise<void> {
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('Google sign-in could not load'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}


const PERKS: { icon: 'bolt' | 'crown' | 'heart' | 'mail'; text: string }[] = [
  { icon: 'bolt', text: 'Three member quests every day, with XP and levels' },
  { icon: 'crown', text: 'Your name on the leaderboards and Hall of Fame' },
  { icon: 'heart', text: 'Favorites and bests on every device' },
  { icon: 'mail', text: 'Optional email when a new game launches' },
];

/** Google's "G" mark, as required next to "Continue with Google". */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * The whole sign-in / sign-up flow: Google (our own styled button, Google's token popup), or
 * email with a one-time code. New and returning players use the same steps.
 */
export function SignInPanel({ onDone, showPerks = true, notice = '' }: { onDone?: () => void; showPerks?: boolean; notice?: string }) {
  useT();
  const { config } = useAccount();
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'' | 'google' | 'email'>('');
  const [error, setError] = useState('');
  // `notice`: why the last sign-in failed (e.g. an expired email link), shown until the next attempt.
  const [showNotice, setShowNotice] = useState(!!notice);
  const [note, setNote] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  const finish = (method: string): void => {
    track('sign_in', { method });
    onDone?.();
  };
  const message = (err: unknown, fallback: string): string => (err instanceof ApiError && err.message !== err.code ? err.message : fallback);

  // Load Google's script ahead of time: the popup must open in the same tick as the click,
  // or browsers block it.
  useEffect(() => {
    if (config?.googleClientId) void loadGoogle().catch(() => undefined);
  }, [config?.googleClientId]);

  const google = (): void => {
    if (!config?.googleClientId) return;
    setError('');
    setShowNotice(false);
    if (!window.google?.accounts?.oauth2) {
      setBusy('google');
      loadGoogle()
        .then(() => setBusy(''))
        .then(() => setError(tr('Google is ready now. Tap the button again.')))
        .catch(() => {
          setBusy('');
          setError(tr('Google sign-in could not load. Check your connection or content blocker.'));
        });
      return;
    }
    setBusy('google');
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.googleClientId,
      scope: 'openid email profile',
      callback: (r) => {
        if (!r.access_token) {
          setBusy('');
          if (r.error) setError(tr('Google sign-in was cancelled.'));
          return;
        }
        account
          .signInWithGoogleToken(r.access_token)
          .then(() => finish('google'))
          .catch((e: unknown) => setError(message(e, tr('Sign-in failed. Please try again.'))))
          .finally(() => setBusy(''));
      },
      error_callback: (e) => {
        setBusy('');
        setError(e.type === 'popup_closed' ? '' : tr('The Google window could not open. Allow pop-ups for this site and try again.'));
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  };

  const sendCode = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    setError('');
    setShowNotice(false);
    setBusy('email');
    try {
      await account.emailStart(email.trim(), nickname.trim());
      setStep('code');
      setNote(tr('We sent a 6-digit code to {email}. It works for 15 minutes.', { email: email.trim() }));
      requestAnimationFrame(() => codeRef.current?.focus());
    } catch (err) {
      setError(message(err, tr('Could not send the code. Please try again.')));
    } finally {
      setBusy('');
    }
  };

  const verify = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setShowNotice(false);
    setBusy('email');
    try {
      await account.emailVerify(email.trim(), code);
      finish('email');
    } catch (err) {
      setError(message(err, tr('That code did not work.')));
    } finally {
      setBusy('');
    }
  };

  const devSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setShowNotice(false);
    const data = new FormData(e.currentTarget);
    account
      .devSignIn(String(data.get('email')), String(data.get('name')))
      .then(() => finish('dev'))
      .catch((err: unknown) => setError(message(err, 'Dev sign-in failed.')));
  };

  return (
    <div className="signin-panel">
      {showPerks && (
        <ul className="signin-perks">
          {PERKS.map((p) => (
            <li key={p.text}>
              <span className="signin-perk-icon">
                <Icon name={p.icon} size={18} />
              </span>
              {tr(p.text)}
            </li>
          ))}
        </ul>
      )}

      {showNotice && (
        <p className="signin-error" role="alert">
          {notice}
        </p>
      )}

      {step === 'start' && (
        <>
          <button className="google-btn" onClick={google} disabled={!config?.googleClientId || busy !== ''} aria-busy={busy === 'google'}>
            <span className="google-btn-g">
              <GoogleG />
            </span>
            <span>{busy === 'google' ? tr('Waiting for Google…') : tr('Continue with Google')}</span>
          </button>

          <div className="signin-or" role="separator">
            <span>{tr('or use your email')}</span>
          </div>

          <form className="signin-email" onSubmit={(e) => void sendCode(e)}>
            <label className="sr-only" htmlFor="signin-email">
              {tr('Email address')}
            </label>
            <input id="signin-email" className="field" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="sr-only" htmlFor="signin-nick">
              {tr('Nickname (new players, optional)')}
            </label>
            <input
              id="signin-nick"
              className="field"
              maxLength={14}
              autoComplete="nickname"
              placeholder={tr('Nickname (new players, optional)')}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <button className="btn btn-primary" disabled={busy !== '' || !config?.emailEnabled}>
              <Icon name="mail" size={18} /> {busy === 'email' ? tr('Sending…') : tr('Email me a sign-in code')}
            </button>
            {config && !config.emailEnabled && <p className="signin-fine">{tr('Email sign-in opens as soon as our mailer is switched on. Google works now.')}</p>}
          </form>
        </>
      )}

      {step === 'code' && (
        <form className="signin-email" onSubmit={(e) => void verify(e)}>
          <p className="signin-note-ok">{note}</p>
          <label className="sr-only" htmlFor="signin-code">
            {tr('6-digit code')}
          </label>
          <input
            ref={codeRef}
            id="signin-code"
            className="field signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          <button className="btn btn-lime" disabled={busy !== '' || code.length !== 6}>
            {busy === 'email' ? tr('Checking…') : tr('Sign in')}
          </button>
          <div className="signin-row">
            <button type="button" className="link-btn" onClick={() => void sendCode()} disabled={busy !== ''}>
              {tr('Send a new code')}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setStep('start');
                setCode('');
                setNote('');
              }}
            >
              {tr('Use a different email')}
            </button>
          </div>
          <p className="signin-fine">{tr('You can also tap the button in the email; it signs you in on that device.')}</p>
        </form>
      )}

      {config?.devLogin && step === 'start' && (
        <form className="signin-dev" onSubmit={devSubmit}>
          <p className="mono">Local dev sign-in (never in production)</p>
          <input className="field" name="email" type="email" defaultValue="tester@example.com" aria-label="Dev email" required />
          <input className="field" name="name" defaultValue="Tester" aria-label="Dev name" />
          <button className="btn btn-yellow">Sign in (dev)</button>
        </form>
      )}

      {error && (
        <p className="signin-error" role="alert">
          {error}
        </p>
      )}
      <p className="signin-fine">
        {tr('New here? Either option creates your free account. Leaderboards show your nickname (it starts as your Google name and you can change it), never your email.')}{' '}
        <a href="/privacy">{tr('Privacy')}</a>
      </p>
    </div>
  );
}

export function SignInDialog() {
  useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<string | undefined>();
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      onSignInOpen((r) => {
        setReason(r);
        setOpen(true);
      }),
    [],
  );

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="signin-dialog"
      aria-labelledby="signin-title"
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === ref.current) setOpen(false);
      }}
    >
      <div className="signin-box panel">
        <button className="btn btn-icon btn-sm signin-close" onClick={() => setOpen(false)} aria-label={tr('Close')}>
          <Icon name="close" />
        </button>
        <p className="eyebrow">{tr('Free membership')}</p>
        <h2 id="signin-title" className="signin-title">
          {tr('Join the arcade')}
        </h2>
        {reason && <p className="signin-reason">{reason}</p>}
        {open && <SignInPanel onDone={() => setOpen(false)} />}
        <button
          className="link-btn signin-page-link"
          onClick={() => {
            setOpen(false);
            navigate('/signin');
          }}
        >
          {tr('Open the full sign-up page')}
        </button>
      </div>
    </dialog>
  );
}
