import { usePageMeta } from '../platform/meta';
import { bannersOn, rewardedOn, useMoney } from '../platform/money';
import { Link } from '../router/router';
import { CONTACT_PATH, OWNER_EMAIL } from './infoText';
import './InfoPages.css';

/** When these terms last changed (shown on the page; update it with every change). */
export const TERMS_UPDATED = '4 November 2026';

export function TermsPage() {
  usePageMeta({ title: 'Terms of use', description: 'The rules for playing on GlitchBound: free games, fair play, accounts, Party Mode and coins.', path: '/terms' });
  const money = useMoney();

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
            GlitchBound is an independent studio run by Sava Hristov. You can reach us about anything on this page, your account or your data by{' '}
            <Link href={CONTACT_PATH}>opening a ticket</Link> (no account needed) or at <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>.
            {money.address && ` Our address is ${money.address}.`}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-play">
          <h2 id="t-play">Playing</h2>
          <p>
            Every game is free and runs in your browser. {money.shop ? 'You never have to buy anything to play: what the shop sells is optional.' : 'There is nothing to buy.'} You can play as a guest; your progress then stays on your device (see{' '}
            <Link href="/privacy">Privacy &amp; your data</Link>).
          </p>
          <p>
            An account is optional and free. To create one you must be at least 13, and old enough where you live to agree to these terms yourself (14
            in Bulgaria, up to 16 elsewhere in the EU), or have a parent or guardian agree for you.
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
            If you do, we may remove scores or text, rename you, or suspend or close your account. We tell you what we did and why, unless the law stops
            us, and you can reply to us if you think we got it wrong.
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

        <section className="panel info-block" aria-labelledby="t-report">
          <h2 id="t-report">Reporting something illegal</h2>
          <p>
            If you see something illegal or against these rules (a nickname, text in a room, anything players can put on the site), tell us by{' '}
            <Link href={CONTACT_PATH}>opening a ticket</Link> or at <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>. Say where it is and why it is a
            problem, and leave a contact address if you would like to hear back. We look at every report, act on it, and tell you what we decided. That
            address is also our contact point for authorities. We answer in English or Bulgarian.
          </p>
        </section>

        {(bannersOn(money) || rewardedOn(money)) && (
          <section className="panel info-block" aria-labelledby="t-ads">
            <h2 id="t-ads">Ads</h2>
            <p>
              Ads help keep the games free. They are labeled, and never run inside a game or on a page for adults only.{' '}
              {rewardedOn(money) && 'After a daily you may choose to watch a short ad for one more try. It is always your choice, the reward has no money value, and that try doesn’t count for the leaderboards. '}
              <Link href="/privacy">Privacy &amp; your data</Link> says what ads do with your data, and how to change your choice.
            </p>
          </section>
        )}

        {money.shop && (
          <section className="panel info-block" aria-labelledby="t-buy">
            <h2 id="t-buy">Purchases</h2>
            <p>
              The shop sells one-time items for real money: no subscriptions, no game currency and no random boxes. Nothing in it makes you stronger in a game or
              higher on a board. The <Link href="/terms/sale">terms of sale</Link> cover prices, your right to withdraw, and refunds.
            </p>
          </section>
        )}

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
            The games, art, music, puzzles and text on GlitchBound belong to us or to the artists who license them to us. Share links, screenshots, clips and result grids as much as you like;
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
