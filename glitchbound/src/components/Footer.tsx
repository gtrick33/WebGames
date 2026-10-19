import { useGames } from '../platform/liveCatalog';
import { useT } from '../i18n';
import { LangSelect } from './LangPicker';
import { openFeedback } from '../platform/feedback';
import { Link } from '../router/router';
import { LogoMark } from './Logo';
import './Footer.css';

export function Footer() {
  const games = useGames();
  const t = useT();
  return (
    <footer className="site-footer">
      <div className="footer-edge" aria-hidden="true" />
      <div className="wrap footer-inner">
        <div className="footer-top">
          <div className="footer-pitch">
            <LogoMark size={56} />
            <p>{t('An independent studio making small, original browser games. No installs and nothing to buy. Play as a guest, or sign in for quests and leaderboards.')}</p>
            <LangSelect />
          </div>
          <nav className="footer-cols" aria-label="Footer">
            <div>
              <p className="eyebrow">{t('Play')}</p>
              <Link href="/#arcade">{t('The arcade')}</Link>
              <Link href="/daily">{t('Daily Challenge')}</Link>
              <Link href="/leaderboards">{t('Leaderboards')}</Link>
              {games.slice(0, 4).map((g) => (
                <Link key={g.slug} href={`/games/${g.slug}`}>
                  {g.title}
                </Link>
              ))}
            </div>
            <div>
              <p className="eyebrow">{t('Info')}</p>
              <Link href="/about">{t('About')}</Link>
              <Link href="/contact">{t('Contact')}</Link>
              <button className="footer-link-btn" onClick={() => openFeedback()}>
                {t('Give feedback')}
              </button>
              <Link href="/me/bugs">{t('Report a bug')}</Link>
              <Link href="/privacy">{t('Privacy & your data')}</Link>
              <Link href="/terms">{t('Terms of use')}</Link>
              <a href="/sitemap.xml">{t('Sitemap')}</a>
            </div>
          </nav>
        </div>
        <p className="footer-word glitch" data-text="GlitchBound" aria-hidden="true">
          GlitchBound
        </p>
        <p className="footer-legal mono">© {new Date().getFullYear()} GlitchBound · {t('All games are original works.')}</p>
      </div>
    </footer>
  );
}
