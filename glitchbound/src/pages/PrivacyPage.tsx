import { useState } from 'react';
import { GAMES } from '../catalog/games';
import { Icon } from '../components/Icon';
import { useAccount } from '../platform/account';
import { ADS, ANALYTICS } from '../platform/env';
import { usePageMeta } from '../platform/meta';
import { saveStore, useSave } from '../platform/store';
import { Link } from '../router/router';
import './InfoPages.css';

export function PrivacyPage() {
  usePageMeta({ title: 'Privacy & your data', description: 'What GlitchBound stores, what it does not, and how to delete your data.', path: '/privacy' });
  const save = useSave();
  const { me } = useAccount();
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);
  const rounds = Object.values(save.games).reduce((n, g) => n + g.plays, 0);
  const dailies = Object.values(save.daily).filter((d) => d.done).length;
  const embeds = GAMES.filter((g) => g.runtime.kind === 'embed');

  return (
    <div className="wrap info-page">
      <p className="eyebrow">Plain language, no tricks</p>
      <h1 className="info-title">Privacy &amp; your data</h1>
      <p className="info-lead">You can play every game without an account. Here is everything GlitchBound keeps, and how to delete it.</p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="p-device">
          <h2 id="p-device">Saved on this device</h2>
          <p>
            As a guest, your bests, rounds played, favorites and Daily Challenge history are stored in this browser&rsquo;s local storage. They never
            leave your device. The date of your last visit is kept there too; our anonymous statistics only learn whether you have visited before and
            how many days ago, never who you are.
          </p>
          <p className="info-small mono">
            Right now: {rounds} {rounds === 1 ? 'round' : 'rounds'} recorded · {dailies} daily {dailies === 1 ? 'challenge' : 'challenges'} cleared
            {saveStore.persistent ? '' : ' · storage unavailable, nothing is kept after you leave'}
          </p>
          <div className="reset-row">
            {!confirming ? (
              <button className="btn" onClick={() => setConfirming(true)} disabled={rounds === 0 && dailies === 0}>
                Delete my GlitchBound data
              </button>
            ) : (
              <>
                <button
                  className="btn btn-magenta"
                  onClick={() => {
                    saveStore.reset();
                    setConfirming(false);
                    setCleared(true);
                  }}
                >
                  Yes, delete everything
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </>
            )}
          </div>
          <p role="status" className="info-small">
            {cleared ? 'Done. Your local GlitchBound data has been deleted.' : ''}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-account">
          <h2 id="p-account">If you sign in</h2>
          <p>
            Sign-in uses Google. We receive your name, email address and profile picture from Google and store them with your nickname, XP, favorites,
            bests, quest progress and the scores of rounds you finish while signed in. Leaderboards show only your nickname and level. We use a single
            essential cookie to keep you signed in.
          </p>
          <p>
            {me ? (
              <>
                You can delete your account and all of this data at any time from <Link href="/me">your profile</Link>.
              </>
            ) : (
              'You can delete your account and all of this data at any time from your profile.'
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-email">
          <h2 id="p-email">New-game emails</h2>
          <p>
            Only if you ask for them. Guests confirm their address with one email first. Every email has a one-click unsubscribe link. We send through
            Resend and never share or sell the list.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-analytics">
          <h2 id="p-analytics">Analytics and crash reports</h2>
          <p>
            We count anonymous events (a page was viewed, a game was started or finished, a search returned results) and collect crash reports so we
            can fix bugs. There are no analytics cookies: visitors are counted with a key that is derived from the request and changes every day, and IP
            addresses are never stored.
            {ANALYTICS.provider === 'umami' && ANALYTICS.umamiWebsiteId ? ' We also use Umami, a cookieless analytics tool.' : ''}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-ads">
          <h2 id="p-ads">Advertising</h2>
          {ADS.enabled ? (
            <p>
              Some pages show ads from Google AdSense, clearly labelled and never inside a game. Google may use cookies for ads; visitors in the EU, UK
              and Switzerland are asked for consent first. See{' '}
              <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">
                how Google uses data <Icon name="external" size={14} />
              </a>
              .
            </p>
          ) : (
            <p>There are no ads on GlitchBound right now.</p>
          )}
        </section>

        {embeds.length > 0 && (
          <section className="panel info-block" aria-labelledby="p-games">
            <h2 id="p-games">Games from their own sites</h2>
            <p>Some games load inside GlitchBound from their own website. That game keeps its own progress in your browser and has its own privacy policy:</p>
            <ul className="info-links">
              {embeds.map((g) => (
                <li key={g.slug}>
                  <a href={g.homepage ?? (g.runtime.kind === 'embed' ? g.runtime.url : '#')} target="_blank" rel="noopener">
                    {g.title} <Icon name="external" size={14} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="info-small">Questions or deletion requests: sava.hristov@glitchboundstudio.com</p>
    </div>
  );
}
