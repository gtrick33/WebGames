import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { LangPicker } from './LangPicker';
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

const TABS: { href: string; label: string; short?: string; icon: IconName }[] = [
  { href: '/', label: 'Arcade', icon: 'gamepad' },
  { href: '/daily', label: 'Daily', icon: 'calendar' },
  { href: '/party', label: 'Party', icon: 'party' },
  { href: '/leaderboards', label: 'Leaderboards', short: 'Ranks', icon: 'crown' },
];

/** The daily streak, always in view (like a flame you don't want to go out). Pulses when today is not done yet. */
function StreakChip() {
  const t = useT();
  const save = useSave();
  const today = dayKey(useNow(60_000));
  const { streak, atRisk } = streakState(doneDays(save), today);
  if (streak === 0) return null;
  const label = atRisk ? t('{n}-day streak. Finish a daily today to keep it', { n: streak }) : t("{n}-day streak. Today's daily is done", { n: streak });
  return (
    <Link href="/daily" className={`streak-chip${atRisk ? ' is-risk' : ''}`} aria-label={label} title={label}>
      <Icon name="flame" size={18} />
      <span className="mono">{streak}</span>
    </Link>
  );
}

/** One button: follows the system until tapped, then flips between the neon night and toy-box day looks. */
function ThemeToggle() {
  const t = useT();
  const [choice, dark] = useTheme();
  const label = choice === 'auto' ? (dark ? t('Theme: automatic (night). Switch to day') : t('Theme: automatic (day). Switch to night')) : dark ? t('Theme: night. Switch back to automatic') : t('Theme: day. Switch back to automatic');
  return (
    <button className="theme-toggle" onClick={() => setTheme(nextTheme(choice))} aria-label={label} title={label}>
      <Icon name={dark ? 'moon' : 'sun'} size={19} />
      {choice === 'auto' && <span className="theme-auto mono" aria-hidden="true">A</span>}
    </button>
  );
}

function AccountMenu() {
  const t = useT();
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
        <Icon name="user" size={18} /> <span className="hide-xs">{t('Sign in')}</span>
      </button>
    );
  }
  const pct = Math.round(((me.xp - me.levelFloor) / Math.max(1, me.levelNext - me.levelFloor)) * 100);
  const ready = me.quests.filter((q) => q.done && !q.claimed).length;
  return (
    <div className="account" ref={ref}>
      <button className="account-btn" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen((v) => !v)} aria-label={t('Account menu for {name}', { name: me.nickname })}>
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
              {t('Level {n}', { n: me.level })} · {me.xp} XP
            </span>
          </div>
        </div>
        <div className="xpbar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
        <Link href="/me" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="user" size={18} /> {t('Profile & quests')} {ready > 0 && <span className="pill-count">{ready}</span>}
        </Link>
        <Link href="/leaderboards" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="crown" size={18} /> {t('Leaderboards')}
        </Link>
        <Link href="/me/bugs" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="bug" size={18} /> {t('Report a bug')}
        </Link>
        {me.isAdmin && (
          <Link href="/admin" className="account-item" onClick={() => setOpen(false)}>
            <Icon name="chart" size={18} /> {t('Admin dashboard')}
          </Link>
        )}
        <button
          className="account-item"
          onClick={() => {
            setOpen(false);
            void account.signOut();
          }}
        >
          <Icon name="logout" size={18} /> {t('Sign out')}
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const t = useT();
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
          <Link href="/" className="brand" aria-label={t('GlitchBound home')}>
            <LogoMark size={38} />
            <Wordmark />
          </Link>

          <nav className="tabs" aria-label={t('Main')}>
            {TABS.map((tab) => (
              <Link key={tab.href} href={tab.href} className="tab" aria-current={active(tab.href) ? 'page' : undefined}>
                <Icon name={tab.icon} size={18} />
                <span>{t(tab.label)}</span>
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label={t('Search games')}>
              <Icon name="search" size={19} />
              <span className="search-trigger-text">{t('Search')}</span>
              <span className="kbd" aria-hidden="true">
                /
              </span>
            </button>
            <StreakChip />
            <LangPicker />
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      {/* Bottom tab bar on phones: thumb-reachable, always visible. */}
      <nav className="bottom-tabs" aria-label={t('Main (mobile)')}>
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="bottom-tab" aria-current={active(tab.href) ? 'page' : undefined} aria-label={t(tab.label)}>
            <Icon name={tab.icon} size={22} />
            <span>{t(tab.short ?? tab.label)}</span>
          </Link>
        ))}
      </nav>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <SignInDialog />
    </>
  );
}
