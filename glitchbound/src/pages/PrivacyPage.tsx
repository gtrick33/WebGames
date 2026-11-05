import { useState } from 'react';
import { GAMES } from '../catalog/games';
import { Icon } from '../components/Icon';
import type { Lang } from '../i18n';
import { fill, plural, rich, useLegalText } from '../i18n/shopText';
import type { LegalText } from '../i18n/shopTypes';
import { api, useAccount } from '../platform/account';
import { ANALYTICS } from '../platform/env';
import { openAdChoices } from '../platform/adScript';
import { bannersOn, rewardedOn, useMoney } from '../platform/money';
import { usePageMeta } from '../platform/meta';
import { storageKeys } from '../platform/qa';
import { CONTACT_PATH, OWNER_EMAIL } from './infoText';
import { saveStore, useSave } from '../platform/store';
import { Link } from '../router/router';
import './InfoPages.css';

/** Display preferences stay; everything else the arcade and its games keep in this browser goes. */
const PREFS = new Set(['glitchbound.theme', 'glitchbound.lang', 'glitchbound.music']);
const dataKeys = (): string[] => storageKeys().filter((k) => /^(gb\.|glitchbound|neonrush)/i.test(k) && !PREFS.has(k));

/** Privacy & your data. The words are in src/i18n/legal/<code>.ts, one file per language: change every language with the English. */
export function PrivacyPage() {
  const { lang, words } = useLegalText();
  return words ? <Privacy lang={lang} t={words.privacy} /> : null;
}

function Privacy({ lang, t }: { lang: Lang; t: LegalText['privacy'] }) {
  usePageMeta({ title: t.title, description: t.meta, path: '/privacy' });
  const save = useSave();
  const { me } = useAccount();
  const money = useMoney();
  const adsOn = bannersOn(money) || rewardedOn(money);
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);
  const rounds = Object.values(save.games).reduce((n, g) => n + g.plays, 0);
  const dailies = Object.values(save.daily).filter((d) => d.done).length;
  // Only games on another site: a game built into GlitchBound (Neon Rush) falls under this page.
  const embeds = GAMES.filter((g) => g.runtime.kind === 'embed' && /^https?:/.test(g.runtime.url));
  const parts = {
    ticket: (x: string) => <Link href={CONTACT_PATH}>{x}</Link>,
    terms: (x: string) => <Link href="/terms">{x}</Link>,
    profile: (x: string) => <Link href="/me">{x}</Link>,
    code: (x: string) => <code>{x}</code>,
    choices: (x: string) => (
      <button className="link-btn" onClick={openAdChoices}>
        {x}
      </button>
    ),
    google: (x: string) => (
      <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">
        {x} <Icon name="external" size={14} />
      </a>
    ),
    mail: <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>,
    address: money.address ? `, ${money.address}` : '',
    end: adsOn ? t.adsCookies : '.',
    ads: adsOn ? t.whoAds : '',
    stripe: money.shop ? t.whoStripe : '',
  };

  return (
    <div className="wrap info-page">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1 className="info-title">{t.title}</h1>
      <p className="info-lead">{t.lead}</p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="p-device">
          <h2 id="p-device">{t.deviceH}</h2>
          <p>{t.device}</p>
          <p className="info-small mono">
            {fill(t.now, { rounds: plural(lang, t.rounds, rounds), dailies: plural(lang, t.dailies, dailies) })}
            {saveStore.persistent ? '' : t.noStorage}
          </p>
          <div className="reset-row">
            {!confirming ? (
              <button className="btn" onClick={() => setConfirming(true)} disabled={dataKeys().length === 0}>
                {t.delete}
              </button>
            ) : (
              <>
                <button
                  className="btn btn-magenta"
                  onClick={() => {
                    for (const k of dataKeys()) {
                      try {
                        localStorage.removeItem(k);
                      } catch {
                        /* storage blocked */
                      }
                    }
                    saveStore.reset();
                    // ...and the guest key's cookie, or the server would hand the old key straight back.
                    void api('/api/guest', { method: 'DELETE' }).catch(() => undefined);
                    setConfirming(false);
                    setCleared(true);
                  }}
                >
                  {t.yes}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
                  {t.cancel}
                </button>
              </>
            )}
          </div>
          <p role="status" className="info-small">
            {cleared ? t.done : ''}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-account">
          <h2 id="p-account">{t.accountH}</h2>
          <p>{rich(t.account, parts)}</p>
          <p>{t.gm}</p>
          <p>{me ? rich(t.deleteMe, parts) : t.deleteGuest}</p>
        </section>

        <section className="panel info-block" aria-labelledby="p-friends">
          <h2 id="p-friends">{t.friendsH}</h2>
          <p>{t.friends}</p>
        </section>

        <section className="panel info-block" aria-labelledby="p-challenges">
          <h2 id="p-challenges">{t.challengesH}</h2>
          <p>{rich(t.challenges, parts)}</p>
        </section>

        <section className="panel info-block" aria-labelledby="p-rooms">
          <h2 id="p-rooms">{t.roomsH}</h2>
          <p>{t.rooms}</p>
          <p>{t.discord}</p>
        </section>

        <section className="panel info-block" aria-labelledby="p-email">
          <h2 id="p-email">{t.emailH}</h2>
          <p>{t.email}</p>
        </section>

        <section className="panel info-block" aria-labelledby="p-reports">
          <h2 id="p-reports">{t.reportsH}</h2>
          <p>{t.reports}</p>
        </section>

        <section className="panel info-block" aria-labelledby="p-analytics">
          <h2 id="p-analytics">{t.analyticsH}</h2>
          <p>
            {t.analytics}
            {ANALYTICS.provider === 'umami' && ANALYTICS.umamiWebsiteId ? t.umami : ''}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-ads">
          <h2 id="p-ads">{t.adsH}</h2>
          {adsOn ? (
            <>
              <p>{rich(t.adsOn, parts)}</p>
              {rewardedOn(money) && <p>{t.adsRewarded}</p>}
              <p>{t.adsKids}</p>
            </>
          ) : (
            <p>{t.adsOff}</p>
          )}
        </section>

        {money.shop && (
          <section className="panel info-block" aria-labelledby="p-buy">
            <h2 id="p-buy">{t.buyH}</h2>
            <p>{t.buy}</p>
          </section>
        )}

        {embeds.length > 0 && (
          <section className="panel info-block" aria-labelledby="p-games">
            <h2 id="p-games">{t.gamesH}</h2>
            <p>{t.games}</p>
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

        <section className="panel info-block" aria-labelledby="p-who">
          <h2 id="p-who">{t.whoH}</h2>
          <p>{rich(t.who, parts)}</p>
        </section>

        <section className="panel info-block" aria-labelledby="p-rights">
          <h2 id="p-rights">{t.rightsH}</h2>
          <p>{t.rights}</p>
          <p>{t.rights2}</p>
        </section>
      </div>
      <p className="info-small">{rich(t.footer, parts)}</p>
    </div>
  );
}
