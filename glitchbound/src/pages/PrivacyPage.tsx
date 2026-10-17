import { useState } from 'react';
import { GAMES } from '../catalog/games';
import { Icon } from '../components/Icon';
import { ADS, ANALYTICS } from '../platform/env';
import { usePageMeta } from '../platform/meta';
import { saveStore, useSave } from '../platform/store';
import './InfoPages.css';

export function PrivacyPage() {
  usePageMeta({ title: 'Privacy & your data', description: 'What GlitchBound stores, what it does not, and how to delete your local data.', path: '/privacy' });
  const save = useSave();
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);
  const rounds = Object.values(save.games).reduce((n, g) => n + g.plays, 0);
  const dailies = Object.values(save.daily).filter((d) => d.done).length;
  const embeds = GAMES.filter((g) => g.runtime.kind === 'embed');
  const analyticsOn = ANALYTICS.provider === 'umami' && !!ANALYTICS.umamiWebsiteId;

  return (
    <div className="wrap info-page">
      <p className="eyebrow">Plain language, no tricks</p>
      <h1 className="info-title">Privacy &amp; your data</h1>
      <p className="info-lead">GlitchBound has no accounts and no sign-up. Here is everything it keeps, and the button to delete it.</p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="p-device">
          <h2 id="p-device">Saved on this device</h2>
          <p>
            Your personal bests, rounds played and daily challenge history are stored in this browser&rsquo;s local storage. They never leave
            your device and are not linked to you.
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
                  className="btn btn-ink"
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

        <section className="panel info-block" aria-labelledby="p-analytics">
          <h2 id="p-analytics">Analytics</h2>
          {analyticsOn ? (
            <p>
              We count anonymous events such as &ldquo;a game was started&rdquo; or &ldquo;a search returned 3 results&rdquo; with Umami, a
              cookieless analytics tool. No cookies, no names, no emails, no cross-site tracking.
            </p>
          ) : (
            <p>Analytics are currently switched off. If they are switched on later, they will be cookieless and anonymous, and this page will say so.</p>
          )}
        </section>

        <section className="panel info-block" aria-labelledby="p-ads">
          <h2 id="p-ads">Advertising</h2>
          {ADS.enabled ? (
            <p>
              Some pages show ads from Google AdSense, clearly labelled and never inside a game. Google may use cookies for ads; visitors in the
              EU, UK and Switzerland are asked for consent first. See{' '}
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
            <p>
              Some games load inside GlitchBound from their own website. That game keeps its own progress in your browser and has its own
              privacy policy:
            </p>
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
    </div>
  );
}
