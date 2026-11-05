import { SALE_TERMS_VERSION } from '../catalog/shop';
import { usePageMeta } from '../platform/meta';
import { useMoney } from '../platform/money';
import { Link } from '../router/router';
import { CONTACT_PATH, OWNER_EMAIL } from './infoText';
import './InfoPages.css';

/**
 * The terms of sale. A draft for a lawyer to check before opening: see docs/LEGAL-READINESS.md. Readable by its address
 * while the shop is closed, hidden from search, because Stripe's reviewers must be able to read the refund policy.
 * Change SALE_TERMS_VERSION with any change here, because purchases record the version agreed to.
 */
export function SaleTermsPage() {
  usePageMeta({ title: 'Terms of sale', description: 'Prices, your right to withdraw, refunds and who you buy from in the GlitchBound shop.', path: '/terms/sale' });
  const money = useMoney();
  return (
    <div className="wrap info-page">
      <p className="eyebrow">Plain language · version {SALE_TERMS_VERSION}</p>
      <h1 className="info-title">Terms of sale</h1>
      <p className="info-lead">These add to the <Link href="/terms">terms of use</Link> when you buy something in the shop. Nothing here limits your rights as a consumer.</p>
      {!money.shop && (
        <p className="info-small" role="status">
          The shop isn&rsquo;t open yet, so nothing can be bought right now. These terms apply once it opens.
        </p>
      )}
      <div className="info-cols">
        <section className="panel info-block">
          <h2>Who you buy from</h2>
          <p>
            GlitchBound is run by Sava Hristov{money.address ? `, ${money.address}` : ''}. Payments go through Stripe, whose Link service acts as the merchant of record: it is the seller on your
            receipt, it collects the VAT, and it handles payment support. We deliver what you bought and look after it. Reach us by <Link href={CONTACT_PATH}>opening a ticket</Link> or at{' '}
            <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>.
          </p>
        </section>
        <section className="panel info-block">
          <h2>What you get</h2>
          <p>
            A one-time purchase, shown with its full price in euros in the shop, VAT included. There are no subscriptions, so there is nothing to cancel and nothing renews. There&rsquo;s no game currency
            and no random boxes, and nothing in the shop helps you win a game or climb a board. A purchase belongs to your account, so you need to be signed in. It reaches your account as soon as the
            payment is confirmed, usually within a minute.
          </p>
          <p>
            <strong>Ad-free</strong> removes ad banners on your account and lets you take your extra try at a daily without watching an ad. It lasts as long as GlitchBound runs. It doesn&rsquo;t affect
            games from other sites that have their own ads.
          </p>
          <p>
            <strong>Borders, banners and profile icons</strong> change how your picture and your name look on your profile, in the header, in friends lists and on the leaderboards, and nothing
            else. You choose which ones to wear, or none, on your profile. Each one lasts as long as GlitchBound runs.
          </p>
        </section>
        <section className="panel info-block">
          <h2>Paying safely</h2>
          <p>
            You pay on Stripe&rsquo;s own checkout page, over an encrypted connection. Your card details go straight to Stripe: we never see or store them. Payment may not be available in every country,
            for example where sanctions or local law don&rsquo;t allow it.
          </p>
        </section>
        <section className="panel info-block">
          <h2>Your right to withdraw</h2>
          <p>
            In the EU you normally have 14 days to withdraw from an online purchase. For digital content that arrives right away, you lose that right once delivery has started, if you asked for it to
            start at once and confirmed that you understood this. You confirm both before you pay, and the confirmation email repeats them. If you didn&rsquo;t receive what you bought, the right
            still stands.
          </p>
        </section>
        <section className="panel info-block">
          <h2>If something is wrong, and refunds</h2>
          <p>
            What you buy has to work as described. If it doesn&rsquo;t, tell us and we&rsquo;ll fix it, and if we can&rsquo;t, you get your money back. This legal guarantee applies whatever else this
            page says. Refunds go back the way you paid. A refunded item leaves your account. To ask for a refund or dispute a charge, <Link href={CONTACT_PATH}>open a ticket</Link> or write to{' '}
            <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>. For anything else, ask us: we are reasonable people.
          </p>
        </section>
        <section className="panel info-block">
          <h2>Under 18?</h2>
          <p>You need a parent or guardian&rsquo;s agreement to buy something, and you confirm that before paying.</p>
        </section>
        <section className="panel info-block">
          <h2>What you can&rsquo;t do</h2>
          <p>Purchases can&rsquo;t be resold, swapped or moved to another account, and they have no money value outside GlitchBound. If we close your account for serious breaches of the terms of use, you may lose them, and we&rsquo;ll tell you why.</p>
        </section>
        <section className="panel info-block">
          <h2>If GlitchBound closes</h2>
          <p>We hope it won&rsquo;t. If it ever does, we&rsquo;ll say so on the site well ahead of time, and your rights as a consumer still apply to anything you bought.</p>
        </section>
        <section className="panel info-block">
          <h2>Disagreements</h2>
          <p>
            Please talk to us first. Bulgarian law applies, and if you live elsewhere in the EU you also keep the protections of the consumer law where you live and can go to your local courts. In
            Bulgaria you can also turn to the Commission for Consumer Protection (kzp.bg) and its conciliation commissions.
          </p>
        </section>
      </div>
    </div>
  );
}
