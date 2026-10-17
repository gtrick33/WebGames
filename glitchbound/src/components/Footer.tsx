import { GAMES } from '../catalog/games';
import { Link } from '../router/router';
import { LogoMark } from './Logo';
import './Footer.css';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-edge" aria-hidden="true" />
      <div className="wrap footer-inner">
        <div className="footer-top">
          <div className="footer-pitch">
            <LogoMark size={56} />
            <p>
              An independent studio making small, original browser games. No installs and nothing to buy. Play as a guest, or sign in for
              quests and leaderboards.
            </p>
          </div>
          <nav className="footer-cols" aria-label="Footer">
            <div>
              <p className="eyebrow">Play</p>
              <Link href="/#arcade">The arcade</Link>
              <Link href="/daily">Daily Challenge</Link>
              <Link href="/leaderboards">Leaderboards</Link>
              {GAMES.slice(0, 4).map((g) => (
                <Link key={g.slug} href={`/games/${g.slug}`}>
                  {g.title}
                </Link>
              ))}
            </div>
            <div>
              <p className="eyebrow">Info</p>
              <Link href="/privacy">Privacy &amp; your data</Link>
              <a href="/sitemap.xml">Sitemap</a>
            </div>
          </nav>
        </div>
        <p className="footer-word glitch" data-text="GlitchBound" aria-hidden="true">
          GlitchBound
        </p>
        <p className="footer-legal mono">© {new Date().getFullYear()} GlitchBound · All games are original works.</p>
      </div>
    </footer>
  );
}
