import { openFeedback } from '../platform/feedback';
import { usePageMeta } from '../platform/meta';
import { CONTACT_DESCRIPTION, CONTACT_PATH } from './infoText';
import { Link } from '../router/router';
import './InfoPages.css';

export function ContactPage() {
  usePageMeta({ title: 'Contact', description: CONTACT_DESCRIPTION, path: '/contact' });

  return (
    <div className="wrap info-page">
      <p className="eyebrow">Contact</p>
      <h1 className="info-title">Get in touch</h1>
      <p className="info-lead">Questions, ideas, problems or press: everything reaches the GlitchBound studio through a ticket.</p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="c-ticket">
          <h2 id="c-ticket">Open a ticket</h2>
          <p>For anything at all: your account, your data, a question, partnerships or press. No account needed, and signed in you can follow its status.</p>
          <p>
            <Link href={CONTACT_PATH} className="btn btn-sm">
              Open a ticket
            </Link>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="c-bug">
          <h2 id="c-bug">Something broken?</h2>
          <p>
            <Link href="/me/bugs">Report a bug</Link> with the game and what happened. It goes straight onto the list of things to fix, and you don&rsquo;t
            need an account.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="c-ideas">
          <h2 id="c-ideas">Ideas and feedback</h2>
          <p>Loved a game, hated a level, or want a new one? Tell us in a few taps.</p>
          <p>
            <button className="btn btn-sm" onClick={() => openFeedback()}>
              Give feedback
            </button>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="c-data">
          <h2 id="c-data">Your data</h2>
          <p>
            To see, export, correct or delete your data, <Link href={CONTACT_PATH}>open a ticket</Link> and choose &ldquo;Question or request&rdquo;
            (signed in, so we know it is your account). You can also delete your account yourself on your{' '}
            <Link href="/me">profile</Link>. More in <Link href="/privacy">Privacy &amp; your data</Link>.
          </p>
        </section>
      </div>

      <p className="info-small">
        See also the <Link href="/terms">terms of use</Link> and <Link href="/about">about GlitchBound</Link>.
      </p>
    </div>
  );
}
