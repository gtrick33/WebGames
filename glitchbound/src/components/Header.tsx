import { useEffect, useRef, useState } from 'react';
import { account, useAccount } from '../platform/account';
import { nextTheme, setTheme, useTheme } from '../platform/theme';
import { dayKey } from '../platform/dates';
import { streakState } from '../platform/engage';
import { useNow } from '../platform/hooks';
import { doneDays } from '../platform/save';
import { useSave } from '../platform/store';
import { Link, useLocation } from '../router/router';
import { Icon, type IconName } from './Icon';
import { LogoMark, Wordmark } from './Logo';
import { SearchDialog } from './SearchDialog';
import { Avatar, openSignIn, SignInDialog } from './SignIn';
import './Header.css';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Arcade', icon: 'gamepad' },
  { href: '/daily', label: 'Daily', icon: 'calendar' },
  { href: '/leaderboards', label: 'Leaderboards', icon: 'crown' },
];

/** The daily streak, always in view (like a flame you don't want to go out). Pulses when today is not done yet. */
function StreakChip() {
  const save = useSave();
  const today = dayKey(useNow(60_000));
  const { streak, atRisk } = streakState(doneDays(save), today);
  if (streak === 0) return null;
  const label = atRisk ? `${streak}-day streak. Finish a daily today to keep it` : `${streak}-day streak. Today's daily is done`;
  return (
    <Link href="/daily" className={`streak-chip${atRisk ? ' is-risk' : ''}`} aria-label={label} title={label}>
      <Icon name="flame" size={18} />
      <span className="mono">{streak}</span>
    </Link>
  );
}

/** One button: follows the system until tapped, then flips between the neon night and toy-box day looks. */
function ThemeToggle() {
  const [choice, dark] = useTheme();
  const label = choice === 'auto' ? `Theme: automatic (${dark ? 'night' : 'day'}). Switch to ${dark ? 'day' : 'night'}` : `Theme: ${dark ? 'night' : 'day'}. Switch back to automatic`;
  return (
    <button className="theme-toggle" onClick={() => setTheme(nextTheme(choice))} aria-label={label} title={label}>
      <Icon name={dark ? 'moon' : 'sun'} size={19} />
      {choice === 'auto' && <span className="theme-auto mono" aria-hidden="true">A</span>}
    </button>
  );
}

function AccountMenu() {
  const { me, status } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me) {
    return (
      <button className="btn btn-magenta btn-sm signin-btn" onClick={() => openSignIn()} disabled={status === 'loading'}>
        <Icon name="user" size={18} /> <span className="hide-xs">Sign in</span>
      </button>
    );
  }
  const pct = Math.round(((me.xp - me.levelFloor) / Math.max(1, me.levelNext - me.levelFloor)) * 100);
  const ready = me.quests.filter((q) => q.done && !q.claimed).length;
  return (
    <div className="account" ref={ref}>
      <button className="account-btn" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen((v) => !v)} aria-label={`Account menu for ${me.nickname}`}>
        <Avatar name={me.nickname} src={me.avatar} size={36} />
        <span className="account-lvl mono">LV {me.level}</span>
        {ready > 0 && <span className="account-dot" />}
      </button>
      <div id="account-menu" className="account-menu panel" hidden={!open}>
        <div className="account-head">
          <Avatar name={me.nickname} src={me.avatar} size={44} />
          <div>
            <strong>{me.nickname}</strong>
            <span className="mono">
              Level {me.level} · {me.xp} XP
            </span>
          </div>
        </div>
        <div className="xpbar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
        <Link href="/me" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="user" size={18} /> Profile &amp; quests {ready > 0 && <span className="pill-count">{ready}</span>}
        </Link>
        <Link href="/leaderboards" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="crown" size={18} /> Leaderboards
        </Link>
        <Link href="/me/bugs" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="bug" size={18} /> Report a bug
        </Link>
        {me.isAdmin && (
          <Link href="/admin" className="account-item" onClick={() => setOpen(false)}>
            <Icon name="chart" size={18} /> Admin dashboard
          </Link>
        )}
        <button
          className="account-item"
          onClick={() => {
            setOpen(false);
            void account.signOut();
          }}
        >
          <Icon name="logout" size={18} /> Sign out
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const active = (href: string): boolean => (href === '/' ? pathname === '/' || pathname.startsWith('/games/') : pathname.startsWith(href));

  return (
    <>
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wrap header-row">
          <Link href="/" className="brand" aria-label="GlitchBound home">
            <LogoMark size={38} />
            <Wordmark />
          </Link>

          <nav className="tabs" aria-label="Main">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className="tab" aria-current={active(t.href) ? 'page' : undefined}>
                <Icon name={t.icon} size={18} />
                <span>{t.label}</span>
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search games">
              <Icon name="search" size={19} />
              <span className="search-trigger-text">Search</span>
              <span className="kbd" aria-hidden="true">
                /
              </span>
            </button>
            <StreakChip />
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      {/* Bottom tab bar on phones: thumb-reachable, always visible. */}
      <nav className="bottom-tabs" aria-label="Main (mobile)">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="bottom-tab" aria-current={active(t.href) ? 'page' : undefined}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <SignInDialog />
    </>
  );
}
