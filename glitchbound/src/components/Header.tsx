import { useEffect, useRef, useState } from 'react';
import { categoryCounts } from '../catalog/catalog';
import { Link, useLocation } from '../router/router';
import { Icon } from './Icon';
import { LogoMark, Wordmark } from './Logo';
import { SearchDialog } from './SearchDialog';
import './Header.css';

export function Header() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);
  const cats = categoryCounts();

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation (adjusting state during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setCatsOpen(false);
  }

  // "/" opens search from anywhere (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!catsOpen) return;
    const onDown = (e: PointerEvent): void => {
      if (!catsRef.current?.contains(e.target as Node)) setCatsOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setCatsOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [catsOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle('menu-open', menuOpen);
  }, [menuOpen]);

  const current = (path: string): 'page' | undefined => (pathname === path ? 'page' : undefined);

  return (
    <>
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wrap header-row">
          <Link href="/" className="brand" aria-label="GlitchBound home">
            <LogoMark size={38} />
            <Wordmark />
          </Link>

          <nav className="main-nav" aria-label="Main">
            <Link href="/#arcade" className="nav-link">
              Explore
            </Link>
            <div className="nav-cats" ref={catsRef}>
              <button className="nav-link" aria-expanded={catsOpen} aria-controls="cats-menu" onClick={() => setCatsOpen((v) => !v)}>
                Categories <Icon name="chevronDown" size={16} />
              </button>
              <div id="cats-menu" className="cats-menu panel" hidden={!catsOpen}>
                {cats.map((c) => (
                  <Link key={c.id} href={`/?category=${c.id}#arcade`} className="cats-item" onClick={() => setCatsOpen(false)}>
                    <span>{c.label}</span>
                    <span className="mono">{c.count}</span>
                  </Link>
                ))}
              </div>
            </div>
            <Link href="/daily" className="nav-link" aria-current={current('/daily')}>
              Daily Challenge
            </Link>
          </nav>

          <div className="header-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search games">
              <Icon name="search" size={19} />
              <span className="search-trigger-text">Search games</span>
              <span className="kbd" aria-hidden="true">
                /
              </span>
            </button>
            <button className="btn btn-icon btn-sm menu-toggle" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((v) => !v)}>
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </header>
      <div id="mobile-menu" className="mobile-menu" hidden={!menuOpen}>
        <nav className="wrap" aria-label="Mobile">
          <Link href="/#arcade" className="mobile-link" style={{ ['--i' as string]: 0 }} onClick={() => setMenuOpen(false)}>
            Explore the arcade <Icon name="arrowRight" />
          </Link>
          <Link href="/daily" className="mobile-link" style={{ ['--i' as string]: 1 }} onClick={() => setMenuOpen(false)}>
            Daily Challenge <Icon name="arrowRight" />
          </Link>
          <p className="eyebrow mobile-sub">Categories</p>
          <div className="mobile-cats">
            {cats.map((c) => (
              <Link key={c.id} href={`/?category=${c.id}#arcade`} className="chip" data-accent="yellow" onClick={() => setMenuOpen(false)}>
                {c.label} · {c.count}
              </Link>
            ))}
          </div>
          <button
            className="btn btn-primary btn-lg mobile-search"
            onClick={() => {
              setMenuOpen(false);
              setSearchOpen(true);
            }}
          >
            <Icon name="search" /> Search games
          </button>
        </nav>
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
