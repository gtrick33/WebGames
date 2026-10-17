import { useState, type FormEvent } from 'react';
import { account, api, ApiError, useAccount } from '../platform/account';
import { track } from '../platform/analytics';
import { Icon } from './Icon';
import './Notify.css';

const NOTICE: Record<string, string> = {
  confirmed: 'You are on the list. We will email you when a new game launches.',
  unsubscribed: 'You are unsubscribed. No more emails from us.',
  invalid: 'That link has expired or was already used.',
};

/** "Email me when a new game drops." Members toggle it; guests confirm by email (double opt-in). */
export function NotifyForm() {
  const { me, config } = useAccount();
  const [email, setEmail] = useState('');
  // Result of the confirm/unsubscribe links in emails: /?notify=confirmed
  const [msg, setMsg] = useState(() => {
    const p = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('notify');
    return p && NOTICE[p] ? NOTICE[p] : '';
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ status: string }>('/api/subscribe', { body: { email } });
      track('subscribe', { via: 'form' });
      setMsg(
        res.status === 'check_inbox'
          ? 'Almost done: check your inbox and click the confirmation link.'
          : res.status === 'confirmed'
            ? 'You were already on the list.'
            : 'Saved. We will send you one confirmation email shortly.',
      );
      setEmail('');
    } catch (err) {
      setMsg(err instanceof ApiError && err.message !== err.code ? err.message : 'Could not sign you up right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="notify wrap section" aria-labelledby="notify-title">
      <div className="notify-box">
        <span className="notify-icon" aria-hidden="true">
          <Icon name="mail" size={30} />
        </span>
        <div className="notify-copy">
          <h2 id="notify-title">New game drops, straight to your inbox</h2>
          <p>One short email when a new game launches. Nothing else. Unsubscribe in one click.</p>
        </div>
        {me ? (
          <label className="notify-toggle">
            <input
              type="checkbox"
              checked={me.notify}
              disabled={busy}
              onChange={(e) => {
                setBusy(true);
                account
                  .update({ notify: e.target.checked })
                  .then((u) => {
                    if (u.notify) track('subscribe', { via: 'member' });
                    setMsg(u.notify ? `We will email ${u.email} when a new game launches.` : 'Turned off. No emails.');
                  })
                  .catch(() => setMsg('Could not save that right now.'))
                  .finally(() => setBusy(false));
              }}
            />
            <span className="notify-switch" aria-hidden="true" />
            <span>Email me about new games</span>
          </label>
        ) : (
          <form className="notify-form" onSubmit={(e) => void submit(e)}>
            <label className="sr-only" htmlFor="notify-email">
              Email address
            </label>
            <input id="notify-email" className="field" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <button className="btn btn-primary" disabled={busy || config === null}>
              Notify me
            </button>
          </form>
        )}
        <p className="notify-msg" role="status">
          {msg}
        </p>
      </div>
    </section>
  );
}
