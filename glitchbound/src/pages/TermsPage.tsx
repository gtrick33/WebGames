import { fill, rich, useLegalText } from '../i18n/shopText';
import type { LegalText } from '../i18n/shopTypes';
import { usePageMeta } from '../platform/meta';
import { bannersOn, rewardedOn, useMoney } from '../platform/money';
import { Link } from '../router/router';
import { CONTACT_PATH, OWNER_EMAIL } from './infoText';
import './InfoPages.css';

/** When these terms last changed (shown on the page; update it, and `updated` in every src/i18n/legal/<code>.ts, with every change). */
export const TERMS_UPDATED = '4 November 2026';

/** The terms of use. The words are in src/i18n/legal/<code>.ts, one file per language: change every language with the English. */
export function TermsPage() {
  const { words } = useLegalText();
  return words ? <Terms t={words.terms} /> : null;
}

function Terms({ t }: { t: LegalText['terms'] }) {
  usePageMeta({ title: t.title, description: t.meta, path: '/terms' });
  const money = useMoney();
  const parts = {
    ticket: (x: string) => <Link href={CONTACT_PATH}>{x}</Link>,
    privacy: (x: string) => <Link href="/privacy">{x}</Link>,
    sale: (x: string) => <Link href="/terms/sale">{x}</Link>,
    profile: (x: string) => <Link href="/me">{x}</Link>,
    mail: <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>,
    address: money.address ? fill(t.addressLine, { address: money.address }) : '',
    buy: money.shop ? t.buyShop : t.buyNone,
  };

  return (
    <div className="wrap info-page">
      <p className="eyebrow">{fill(t.eyebrow, { date: t.updated })}</p>
      <h1 className="info-title">{t.title}</h1>
      <p className="info-lead">{t.lead}</p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="t-who">
          <h2 id="t-who">{t.whoH}</h2>
          <p>{rich(t.who, parts)}</p>
        </section>

        <section className="panel info-block" aria-labelledby="t-play">
          <h2 id="t-play">{t.playH}</h2>
          <p>{rich(t.play, parts)}</p>
          <p>{t.account}</p>
        </section>

        <section className="panel info-block" aria-labelledby="t-fair">
          <h2 id="t-fair">{t.fairH}</h2>
          <p>{t.fairIntro}</p>
          <ul>
            {t.fair.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>{t.fairAfter}</p>
        </section>

        <section className="panel info-block" aria-labelledby="t-party">
          <h2 id="t-party">{t.partyH}</h2>
          <p>{t.party}</p>
          <p>{t.adults}</p>
        </section>

        <section className="panel info-block" aria-labelledby="t-report">
          <h2 id="t-report">{t.reportH}</h2>
          <p>{rich(t.report, parts)}</p>
        </section>

        {(bannersOn(money) || rewardedOn(money)) && (
          <section className="panel info-block" aria-labelledby="t-ads">
            <h2 id="t-ads">{t.adsH}</h2>
            <p>
              {t.ads} {rewardedOn(money) && `${t.adsRewarded} `}
              {rich(t.adsData, parts)}
            </p>
          </section>
        )}

        {money.shop && (
          <section className="panel info-block" aria-labelledby="t-buy">
            <h2 id="t-buy">{t.buyH}</h2>
            <p>{rich(t.buy, parts)}</p>
          </section>
        )}

        <section className="panel info-block" aria-labelledby="t-coins">
          <h2 id="t-coins">{t.coinsH}</h2>
          <p>{t.coins}</p>
        </section>

        <section className="panel info-block" aria-labelledby="t-ours">
          <h2 id="t-ours">{t.oursH}</h2>
          <p>{t.ours}</p>
          <p>{t.ideas}</p>
        </section>

        <section className="panel info-block" aria-labelledby="t-changes">
          <h2 id="t-changes">{t.changesH}</h2>
          <p>{t.changes}</p>
          <p>{rich(t.leave, parts)}</p>
        </section>

        <section className="panel info-block" aria-labelledby="t-law">
          <h2 id="t-law">{t.lawH}</h2>
          <p>{t.law}</p>
        </section>
      </div>
    </div>
  );
}
