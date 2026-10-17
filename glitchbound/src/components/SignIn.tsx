import { useEffect, useRef, useState, type FormEvent } from 'react';
import { account, useAccount } from '../platform/account';
import { track } from '../platform/analytics';
import { Icon } from './Icon';
import './SignIn.css';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; auto_select?: boolean; itp_support?: boolean }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
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

/** Opens from anywhere: `openSignIn()`; the dialog lives once in the header. */
const openers = new Set<(reason?: string) => void>();
export function openSignIn(reason?: string): void {
  openers.forEach((fn) => fn(reason));
}

const PERKS: { icon: 'bolt' | 'crown' | 'heart' | 'mail'; text: string }[] = [
  { icon: 'bolt', text: 'Three member quests every day, with XP and levels' },
  { icon: 'crown', text: 'Your name on the leaderboards and Hall of Fame' },
  { icon: 'heart', text: 'Favorites and bests on every device' },
  { icon: 'mail', text: 'Optional email when a new game launches' },
];

export function SignInDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { config } = useAccount();

  useEffect(() => {
    const fn = (r?: string): void => {
      setReason(r);
      setError('');
      setOpen(true);
    };
    openers.add(fn);
    return () => {
      openers.delete(fn);
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) d.close();
  }, [open]);

  // Render Google's own button once the dialog is open (Google requires its button UI).
  useEffect(() => {
    const clientId = config?.googleClientId;
    if (!open || !clientId) return;
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          itp_support: true,
          callback: ({ credential }) => {
            setBusy(true);
            account
              .signInWithGoogle(credential)
              .then(() => {
                track('sign_in', { method: 'google' });
                setOpen(false);
              })
              .catch(() => setError('Sign-in failed. Please try again.'))
              .finally(() => setBusy(false));
          },
        });
        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 300 });
      })
      .catch(() => setError('Google sign-in could not load. Check your connection or content blocker.'));
    return () => {
      cancelled = true;
    };
  }, [open, config?.googleClientId]);

  const devSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    account
      .devSignIn(String(data.get('email')), String(data.get('name')))
      .then(() => setOpen(false))
      .catch(() => setError('Dev sign-in failed.'))
      .finally(() => setBusy(false));
  };

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
        <button className="btn btn-icon btn-sm signin-close" onClick={() => setOpen(false)} aria-label="Close">
          <Icon name="close" />
        </button>
        <p className="eyebrow">Free membership</p>
        <h2 id="signin-title" className="signin-title">
          Join the arcade
        </h2>
        {reason && <p className="signin-reason">{reason}</p>}
        <ul className="signin-perks">
          {PERKS.map((p) => (
            <li key={p.text}>
              <span className="signin-perk-icon">
                <Icon name={p.icon} size={18} />
              </span>
              {p.text}
            </li>
          ))}
        </ul>

        {config?.googleClientId ? (
          <div className="signin-google" ref={buttonRef} aria-busy={busy} />
        ) : config?.devLogin ? null : (
          <p className="signin-note">Sign-in is being switched on. Check back soon; you can keep playing as a guest meanwhile.</p>
        )}

        {config?.devLogin && (
          <form className="signin-dev" onSubmit={devSubmit}>
            <p className="mono">Local dev sign-in (never in production)</p>
            <input className="field" name="email" type="email" defaultValue="tester@example.com" aria-label="Email" required />
            <input className="field" name="name" defaultValue="Tester" aria-label="Name" />
            <button className="btn btn-lime" disabled={busy}>
              Sign in (dev)
            </button>
          </form>
        )}

        {error && (
          <p className="signin-error" role="alert">
            {error}
          </p>
        )}
        <p className="signin-fine">
          We only use your Google name and email to create your account. Leaderboards show your nickname, never your email.{' '}
          <a href="/privacy">Privacy</a>
        </p>
      </div>
    </dialog>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {src && !failed ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initial}
    </span>
  );
}
