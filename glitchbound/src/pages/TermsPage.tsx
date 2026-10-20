import { usePageMeta } from '../platform/meta';
import { Link } from '../router/router';
import { CONTACT_PATH } from './infoText';
import './InfoPages.css';

/** When these terms last changed (shown on the page; update it with every change). */
export const TERMS_UPDATED = '19 October 2026';

export function TermsPage() {
  usePageMeta({ title: 'Terms of use', description: 'The rules for playing on GlitchBound: free games, fair play, accounts, Party Mode and coins.', path: '/terms' });

  return (
    <div className="wrap info-page">
      <p className="eyebrow">Plain language · updated {TERMS_UPDATED}</p>
      <h1 className="info-title">Terms of use</h1>
      <p className="info-lead">
        GlitchBound is free to play, with or without an account. By playing you agree to these few rules. They are written to be read, so please do.
      </p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="t-who">
          <h2 id="t-who">Who we are</h2>
          <p>
            GlitchBound is an independent studio. You can reach us about anything on this page, your account or your data by{' '}
            <Link href={CONTACT_PATH}>opening a ticket</Link> (no account needed).
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-play">
          <h2 id="t-play">Playing</h2>
          <p>
            Every game is free and runs in your browser. There is nothing to buy. You can play as a guest; your progress then stays on your device (see{' '}
            <Link href="/privacy">Privacy &amp; your data</Link>).
          </p>
          <p>
            An account is optional and free. To create one you must be at least 13, and old enough where you live to agree to these terms yourself, or
            have a parent or guardian agree for you.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-fair">
          <h2 id="t-fair">Fair play</h2>
          <p>Leaderboards only mean something if everyone plays fair. So please don&rsquo;t:</p>
          <ul>
            <li>use bots, scripts or modified game code, or send made-up scores to our servers;</li>
            <li>knowingly exploit a bug to climb the boards (report it instead, and thank you);</li>
            <li>pick a nickname, or type anything in a room, that is hateful, harassing, sexual about minors or impersonates someone;</li>
            <li>try to break, overload or get into parts of the site that aren&rsquo;t yours.</li>
          </ul>
          <p>
            If you do, we may remove scores, rename you, or suspend or close your account. Where we can, we tell you why, and you can reply to us if you
            think we got it wrong.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-party">
          <h2 id="t-party">Party Mode and live rooms</h2>
          <p>
            Names, answers and prompts you type in a party game are shown to the people in that game. Play with people you know, and be kind. Rooms
            are deleted after three hours without activity.
          </p>
          <p>
            Crass Act and the After Dark cards are for adults only. Everyone playing them must be 18 or over; the group confirms this before they start.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-coins">
          <h2 id="t-coins">Coins, XP and rewards</h2>
          <p>
            Coins, XP, levels, badges and other rewards are part of the games. They have no money value, can&rsquo;t be bought, sold or swapped for
            anything outside GlitchBound, and we may rebalance or reset them, for example to fix a bug or undo cheating.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-ours">
          <h2 id="t-ours">Our games, your words</h2>
          <p>
            The games, art, music, puzzles and text on GlitchBound belong to us. Share links, screenshots, clips and result grids as much as you like;
            please don&rsquo;t copy the games or host them elsewhere.
          </p>
          <p>
            If you send us feedback, a bug report or an idea, we may use it to improve GlitchBound without owing you anything for it. Thank you, honestly.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-changes">
          <h2 id="t-changes">Changes and availability</h2>
          <p>
            We keep adding, changing and sometimes retiring games and features. GlitchBound is provided as it is, and we can&rsquo;t promise it will
            always be online or free of bugs. As far as the law allows, we are not liable for indirect losses from using it. Nothing here limits rights
            you have as a consumer that can&rsquo;t be waived.
          </p>
          <p>
            You can stop playing whenever you like and delete your account from <Link href="/me">your profile</Link>. If these terms change in a way that
            matters, we will say so on the site before the change applies.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-law">
          <h2 id="t-law">Law</h2>
          <p>
            These terms are governed by the law of Bulgaria. If you live elsewhere in the EU, you also keep the protections of the consumer law where you
            live, and you can bring a claim in your local courts.
          </p>
        </section>
      </div>
    </div>
  );
}
