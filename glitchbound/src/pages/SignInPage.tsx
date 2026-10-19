import { useEffect } from 'react';
import { Icon } from '../components/Icon';
import { SignInPanel } from '../components/SignIn';
import { useAccount } from '../platform/account';
import { usePageMeta } from '../platform/meta';
import { Link, navigate } from '../router/router';
import './InfoPages.css';

/** Why the email link sent the player back here (?error=…); shown until they try again. */
const ERRORS: Record<string, string> = {
  link: 'That sign-in link has expired or was already used. Ask for a new code below.',
  banned: 'This account has been suspended. If you think this is a mistake, write to hello@glitchboundstudio.com.',
};

/** /signin: sign up or sign in with Google or an email code. */
export function SignInPage() {
  usePageMeta({ title: 'Sign in or create an account', description: 'Join GlitchBound for free with Google or your email: daily quests, levels and leaderboards.', path: '/signin' });
  const { me } = useAccount();
  const errorParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('error') : null;

  useEffect(() => {
    if (me) navigate('/me', { replace: true });
  }, [me]);

  return (
    <div className="wrap info-page">
      <div className="signin-page">
        <div className="info-block">
          <p className="eyebrow">
            <Icon name="star" size={16} /> Free membership
          </p>
          <h1 className="info-title">Join the arcade</h1>
          <p className="info-lead">
            One account for every GlitchBound game. Sign in with Google, or with any email address: we send you a one-time code, so there is no
            password to remember or leak.
          </p>
          <ul className="info-steps">
            <li>Three new member quests every day. Finish them for XP and level up.</li>
            <li>Your nickname on each game&rsquo;s leaderboard and in the Hall of Fame.</li>
            <li>Favorites, bests and your daily streak on every device.</li>
            <li>Optional email when a new game launches. Delete your account any time.</li>
          </ul>
          <p className="info-small">
            Rather not? Every game is free to play as a guest. <Link href="/">Back to the arcade</Link>
          </p>
        </div>
        <div className="signin-box panel">
          <h2 className="signin-title">Sign in or sign up</h2>
          <SignInPanel showPerks={false} onDone={() => navigate('/me')} notice={errorParam ? (ERRORS[errorParam] ?? '') : ''} />
        </div>
      </div>
    </div>
  );
}
