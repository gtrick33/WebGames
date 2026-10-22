import { useGames } from '../platform/liveCatalog';
import { usePageMeta } from '../platform/meta';
import { ABOUT_DESCRIPTION } from './infoText';
import { Link } from '../router/router';
import { useT } from '../i18n';
import './InfoPages.css';

export function AboutPage() {
  usePageMeta({ title: 'About', description: ABOUT_DESCRIPTION, path: '/about' });
  const t = useT();
  const games = useGames();

  return (
    <div className="wrap info-page">
      <p className="eyebrow">{t('About')}</p>
      <h1 className="info-title">{t('Small games. Big obsessions.')}</h1>
      <p className="info-lead">
        {t('GlitchBound is an independent browser arcade: {n} original games that start in a second, plus Party Mode for groups. No installs, nothing to buy and no account needed.', { n: games.length })}
      </p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="a-who">
          <h2 id="a-who">{t('Who makes it')}</h2>
          <p>{t('GlitchBound is an independent studio. Every game is designed and built here: no clones, no reskins, no games bought in from elsewhere.')}</p>
        </section>

        <section className="panel info-block" aria-labelledby="a-play">
          <h2 id="a-play">{t('How it works')}</h2>
          <p>
            {t('Every game runs right in your browser, on a phone or a computer. Play as a guest and your bests stay on your device. Sign in for free for daily quests, levels, saves on every device and a spot on the leaderboards.')}{' '}
            <Link href="/leaderboards">{t('See the leaderboards')}</Link>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-daily">
          <h2 id="a-daily">{t('Something new every day')}</h2>
          <p>
            {t('Most games have a daily round: the same puzzle for everyone, new at midnight your time. Clear the Daily Challenge each day to keep your streak going, then compare with friends.')}{' '}
            <Link href="/daily">{t('Today’s Daily Challenge')}</Link>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-ages">
          <h2 id="a-ages">{t('For all ages, with one exception')}</h2>
          <p>
            {t('The arcade is made for everyone. Crass Act, an online card game full of rude, dark humor, and the After Dark cards in Party Mode are for adults only. They carry an 18+ label everywhere they are listed and ask players to confirm their age before they start.')}{' '}
            <Link href="/party">{t('Party Mode')}</Link>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-data">
          <h2 id="a-data">{t('Your data')}</h2>
          <p>
            {t('We keep as little as we can. There are no analytics cookies, and as a guest your bests stay in your browser.')}{' '}
            <Link href="/privacy">{t('Privacy & your data')}</Link> · <Link href="/terms">{t('Terms of use')}</Link>
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="a-hello">
          <h2 id="a-hello">{t('Say hello')}</h2>
          <p>
            {t('An idea for a game, a bug to report or a question?')} <Link href="/contact">{t('Get in touch')}</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
