import { SALE_TERMS_VERSION } from '../catalog/shop';
import { fill, rich, useLegalText } from '../i18n/shopText';
import type { LegalText } from '../i18n/shopTypes';
import { usePageMeta } from '../platform/meta';
import { useMoney } from '../platform/money';
import { Link } from '../router/router';
import { CONTACT_PATH, OWNER_EMAIL } from './infoText';
import './InfoPages.css';

/**
 * The terms of sale. A draft for a lawyer to check before opening: see docs/LEGAL-READINESS.md. Readable by its address
 * while the shop is closed, hidden from search, because Stripe's reviewers must be able to read the refund policy.
 * Change SALE_TERMS_VERSION with any change here, because purchases record the version agreed to (and the language).
 * The words are in src/i18n/legal/<code>.ts, one file per language: change every language with the English.
 */
export function SaleTermsPage() {
  const { words } = useLegalText();
  return words ? <SaleTerms t={words.sale} /> : null;
}

function SaleTerms({ t }: { t: LegalText['sale'] }) {
  usePageMeta({ title: t.title, description: t.meta, path: '/terms/sale' });
  const money = useMoney();
  const parts = {
    terms: (x: string) => <Link href="/terms">{x}</Link>,
    ticket: (x: string) => <Link href={CONTACT_PATH}>{x}</Link>,
    mail: <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>,
    address: money.address ? `, ${money.address}` : '',
    b: (x: string) => <strong>{x}</strong>,
  };
  const block = (h: string, ...ps: string[]) => (
    <section className="panel info-block">
      <h2>{h}</h2>
      {ps.map((p, i) => (
        <p key={i}>{rich(p, parts)}</p>
      ))}
    </section>
  );
  return (
    <div className="wrap info-page">
      <p className="eyebrow">{fill(t.eyebrow, { version: SALE_TERMS_VERSION })}</p>
      <h1 className="info-title">{t.title}</h1>
      <p className="info-lead">{rich(t.lead, parts)}</p>
      {!money.shop && (
        <p className="info-small" role="status">
          {t.closed}
        </p>
      )}
      <div className="info-cols">
        {block(t.whoH, t.who)}
        {block(t.whatH, t.what, t.gloam, t.adFree, t.looks, t.sigil)}
        {block(t.payingH, t.paying)}
        {block(t.withdrawH, t.withdraw)}
        {block(t.wrongH, t.wrong)}
        {block(t.under18H, t.under18)}
        {block(t.cantH, t.cant)}
        {block(t.closesH, t.closes)}
        {block(t.disputesH, t.disputes)}
      </div>
    </div>
  );
}
