import { useGames } from '../platform/liveCatalog';
import { usePageMeta } from '../platform/meta';
import { ABOUT_DESCRIPTION } from './infoText';
import { Link } from '../router/router';
import './InfoPages.css';

export function AboutPage() {
  usePageMeta({ title: 'About', description: ABOUT_DESCRIPTION, path: '/about' });
  const games = useGames();

  return (
    <div className="wrap info-page">
      <p className="eyebrow">About</p>
      <h1 className="info-title">Small games. Big obsessions.</h1>
      <p className="info-lead">
        GlitchBound is an independent browser arcade: {games.length} original games that start in a second, plus Party Mode for groups. No installs,
        nothing to buy and no account needed.
      </p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="a-who">
          <h2 id="a-who">Who makes it</h2>
          <p>
            GlitchBound is an independent studio run by Sava Hristov. Every game is designed and built here: no clones, no reskins, no games bought in
            from elsewhere.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-play">
          <h2 id="a-play">How it works</h2>
          <p>
            Every game runs right in your browser, on a phone or a computer. Play as a guest and your bests stay on your device. Sign in for free if you
            want daily quests, levels and a spot on the <Link href="/leaderboards">leaderboards</Link>.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-daily">
          <h2 id="a-daily">Something new every day</h2>
          <p>
            Most games have a daily round: the same puzzle for everyone, new at midnight your time. Clear them to keep your streak going, then compare
            with friends. Start with <Link href="/daily">today&rsquo;s Daily Challenge</Link>.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-ages">
          <h2 id="a-ages">For all ages, with one exception</h2>
          <p>
            The arcade is made for everyone. Crass Act, an online card game full of rude, dark humor, and the After Dark cards in{' '}
            <Link href="/party">Party Mode</Link> are for adults only. They carry an 18+ label everywhere they are listed and ask players to confirm their
            age before they start.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-data">
          <h2 id="a-data">Your data</h2>
          <p>
            We keep as little as we can. There are no analytics cookies, and as a guest your bests stay in your browser. The details are in{' '}
            <Link href="/privacy">Privacy &amp; your data</Link> and the <Link href="/terms">terms of use</Link>.
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-hello">
          <h2 id="a-hello">Say hello</h2>
          <p>
            An idea for a game, a bug to report or a question? <Link href="/contact">Get in touch</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
