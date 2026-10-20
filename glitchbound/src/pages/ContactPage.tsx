import { openFeedback } from '../platform/feedback';
import { usePageMeta } from '../platform/meta';
import { CONTACT_DESCRIPTION, CONTACT_PATH } from './infoText';
import { Link } from '../router/router';
import { useT } from '../i18n';
import './InfoPages.css';

export function ContactPage() {
  usePageMeta({ title: 'Contact', description: CONTACT_DESCRIPTION, path: '/contact' });
  const t = useT();

  return (
    <div className="wrap info-page">
      <p className="eyebrow">{t('Contact')}</p>
      <h1 className="info-title">{t('Get in touch')}</h1>
      <p className="info-lead">{t('Questions, ideas, problems or press: everything reaches the GlitchBound studio through a ticket.')}</p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="c-ticket">
          <h2 id="c-ticket">{t('Open a ticket')}</h2>
          <p>{t('For anything at all: your account, your data, a question, partnerships or press. No account needed, and signed in you can follow its status.')}</p>
          <p>
            <Link href={CONTACT_PATH} className="btn btn-sm">
              {t('Open a ticket')}
            </Link>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="c-bug">
          <h2 id="c-bug">{t('Something broken?')}</h2>
          <p>
            {t('Report a bug with the game and what happened. It goes straight onto the list of things to fix, and you don’t need an account.')}{' '}
            <Link href="/me/bugs">{t('Report a bug')}</Link>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="c-ideas">
          <h2 id="c-ideas">{t('Ideas and feedback')}</h2>
          <p>{t('Loved a game, hated a level, or want a new one? Tell us in a few taps.')}</p>
          <p>
            <button className="btn btn-sm" onClick={() => openFeedback()}>
              {t('Give feedback')}
            </button>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="c-data">
          <h2 id="c-data">{t('Your data')}</h2>
          <p>
            {t('To see, export, correct or delete your data, open a ticket and choose “Question or request” (signed in, so we know it is your account). You can also delete your account yourself on your profile.')}{' '}
            <Link href={CONTACT_PATH}>{t('Open a ticket')}</Link> · <Link href="/me">{t('Profile')}</Link> · <Link href="/privacy">{t('Privacy & your data')}</Link>
          </p>
        </section>
      </div>

      <p className="info-small">
        <Link href="/terms">{t('Terms of use')}</Link> · <Link href="/about">{t('About GlitchBound')}</Link>
      </p>
    </div>
  );
}
