import { GAMES } from '../catalog/games';
import { Link } from '../router/router';
import { LogoMark } from './Logo';
import { Dot, Pill, Tri } from './Shapes';
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
              An independent studio making small, original browser games. No installs, no accounts, nothing to buy. Your scores stay on your
              device.
            </p>
          </div>
          <nav className="footer-cols" aria-label="Footer">
            <div>
              <p className="eyebrow">Play</p>
              <Link href="/#arcade">The arcade</Link>
              <Link href="/daily">Daily Challenge</Link>
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
        <div className="footer-shapes" aria-hidden="true">
          <Pill className="fs fs-1" fill="#c4f034" />
          <Dot className="fs fs-2" fill="#ff6a1a" />
          <Tri className="fs fs-3" fill="#12c6b3" />
        </div>
        <p className="footer-legal mono">© {new Date().getFullYear()} GlitchBound · All games are original works.</p>
      </div>
    </footer>
  );
}
