import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { SignInPanel } from '../components/SignIn';
import { account, api, ApiError, useAccount } from '../platform/account';
import type { Me } from '../platform/apiTypes';
import { dayKey } from '../platform/dates';
import { Link, navigate } from '../router/router';
import './InfoPages.css';

/** /admin?join=…: the link in a QA invitation email. Sign in with the invited address, then join. */
export function QaJoinPage({ token }: { token: string }) {
  const { me, status } = useAccount();
  const [invite, setInvite] = useState<{ valid: boolean; email?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ valid: boolean; email?: string }>(`/api/qa/invite?token=${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch(() => setInvite({ valid: false }));
  }, [token]);

  const join = async (): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ user: Me }>('/api/qa/accept', { body: { token, day: dayKey() } });
      account.setMe(r.user);
      navigate('/admin?tab=qa');
    } catch (e) {
      setError(e instanceof ApiError && e.message !== e.code ? e.message : 'Could not join. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap info-page">
      <p className="eyebrow">
        <Icon name="bug" size={16} /> GlitchBound QA
      </p>
      <h1 className="info-title">Join the QA team</h1>
      {!invite || status === 'loading' ? (
        <p className="info-lead">Checking your invitation…</p>
      ) : me?.role === 'qa' || me?.role === 'admin' ? (
        <>
          <p className="info-lead">You already have the QA tools.</p>
          <div>
            <Link className="btn btn-primary" href="/admin?tab=qa">
              Open the QA panel
            </Link>
          </div>
        </>
      ) : !invite.valid ? (
        <p className="info-lead">This invitation has expired or was already used. Ask an admin to send you a new one.</p>
      ) : (
        <>
          <p className="info-lead">
            You’re invited to test GlitchBound. The invitation is for <b>{invite.email}</b>: sign in with that address to accept it.
          </p>
          <p className="info-small">As a QA tester, every request and action of your account is recorded and kept for legal and safety reasons.</p>
          {me ? (
            <div className="signin-box panel">
              <p>
                Signed in as <b>{me.email}</b>.
              </p>
              {error && <p className="signin-error">{error}</p>}
              <div className="reset-row">
                <button className="btn btn-primary" disabled={busy} onClick={() => void join()}>
                  Join the QA team
                </button>
                <button className="btn btn-ghost" onClick={() => void account.signOut()}>
                  Use another account
                </button>
              </div>
            </div>
          ) : (
            <div className="signin-box panel">
              <h2 className="signin-title">Sign in first</h2>
              <SignInPanel showPerks={false} onDone={() => undefined} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
