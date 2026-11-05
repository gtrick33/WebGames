import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { tTab } from '../i18n/short';
import { LangPicker } from './LangPicker';
import { account, useAccount } from '../platform/account';
import { nextTheme, setTheme, useTheme } from '../platform/theme';
import { dayKey } from '../platform/dates';
import { streakState } from '../platform/engage';
import { useNow } from '../platform/hooks';
import { useStreakDays } from '../platform/streak';
import { useLiveCatalog } from '../platform/liveCatalog';
import { gameUrl, SECTION_GAMES } from '../catalog/catalog';
import { GAMES } from '../catalog/games';
import { Link, useLocation } from '../router/router';
import { Icon, type IconName } from './Icon';
import { LogoMark, Wordmark } from './Logo';
import { Avatar } from './Avatar';
import { openSignIn, setSignInLoader } from './openSignIn';
import './Header.css';
import { fresh } from '../platform/freshBuild';

// The search and sign-in dialogs load the first time they are opened.
const SignInDialog = lazy(fresh(() => import('./SignIn').then((m) => ({ default: m.SignInDialog }))));
const SearchDialog = lazy(fresh(() => import('./SearchDialog').then((m) => ({ default: m.SearchDialog }))));
// The border and banner a member wears (components/Looks.tsx): loaded only for one who wears them, as the header is on
// every page's first load.
const LookAvatar = lazy(fresh(() => import('./Looks').then((m) => ({ default: m.LookAvatar }))));
const Banner = lazy(fresh(() => import('./Looks').then((m) => ({ default: m.Banner }))));

/** The member's picture, or their icon, in their border once it has loaded (the plain picture until then). */
function MemberAvatar({ me, size }: { me: { nickname: string; avatar: string; looks?: { border: string; icon: string } }; size: number }) {
  const plain = <Avatar name={me.nickname} src={me.avatar} size={size} />;
  if (!me.looks?.border && !me.looks?.icon) return plain;
  return (
    <Suspense fallback={plain}>
      <LookAvatar name={me.nickname} src={me.avatar} size={size} border={me.looks.border} icon={me.looks.icon} />
    </Suspense>
  );
}

type Tab = { href: string; label: string; short?: string; icon: IconName; slug?: string };

const TABS: Tab[] = [
  // The flagship comes first: games with a section of their own (Sigilfall) lead, in their own gold.
  ...SECTION_GAMES.map((g): Tab => ({ href: g.section!.path, label: g.section!.label, icon: 'sword', slug: g.slug })),
  { href: '/', label: 'Arcade', icon: 'gamepad' },
  { href: '/party', label: 'Party', icon: 'party' },
  { href: '/daily', label: 'Daily', icon: 'calendar' },
  { href: '/leaderboards', label: 'Leaderboards', short: 'Ranks', icon: 'crown' },
];

/** Only once the shop is open (Admin › Ads & shop). */
const SHOP_TAB: Tab = { href: '/shop', label: 'Shop', icon: 'star' };

const PARTY_ONLY_URLS = GAMES.filter((g) => g.partyOnly).map((g) => gameUrl(g.slug));

/** The tabs players see: a section whose game an admin hid is switched off (staff still see it, to test it). */
function useTabs(): Tab[] {
  const live = useLiveCatalog();
  const { me } = useAccount();
  const tabs = TABS.filter((tab) => !tab.slug || !live.settings(tab.slug).hidden || !!me?.role);
  return live.raw.money?.shop ? [...tabs, SHOP_TAB] : tabs;
}

/** The daily streak, always in view (like a flame you don't want to go out). Pulses when today is not done yet. */
function StreakChip() {
  const t = useT();
  const days = useStreakDays();
  const today = dayKey(useNow(60_000));
  const { streak, atRisk } = streakState(days, today);
  if (streak === 0) return null;
  const label = atRisk ? t('{n}-day streak. Clear today’s challenge to keep it', { n: streak }) : t('{n}-day streak. Today’s challenge is cleared', { n: streak });
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
      <button className="btn btn-magenta btn-sm signin-btn" aria-label={t('Sign in')} onClick={() => openSignIn()} disabled={status === 'loading'}>
        <Icon name="user" size={18} /> <span className="hide-xs">{t('Sign in')}</span>
      </button>
    );
  }
  const pct = Math.round(((me.xp - me.levelFloor) / Math.max(1, me.levelNext - me.levelFloor)) * 100);
  const ready = me.quests.filter((q) => q.done && !q.claimed).length;
  return (
    <div className="account" ref={ref}>
      <button className="account-btn" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen((v) => !v)} aria-label={t('Account menu for {name}', { name: me.nickname })}>
        <MemberAvatar me={me} size={36} />
        <span className="account-lvl mono">LV {me.level}</span>
        {ready > 0 && <span className="account-dot" />}
      </button>
      <div id="account-menu" className="account-menu panel" hidden={!open}>
        <div className={`account-head${me.looks?.banner ? ' has-banner' : ''}`}>
          {me.looks?.banner && (
            <Suspense fallback={null}>
              <Banner id={me.looks.banner} row />
            </Suspense>
          )}
          <MemberAvatar me={me} size={44} />
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
        <Link href="/trophies" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="star" size={18} /> {t('Trophy Shelf')}
        </Link>
        <Link href="/me/friends" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="user" size={18} /> {t('Friends')}
        </Link>
        <Link href="/leaderboards" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="crown" size={18} /> {t('Leaderboards')}
        </Link>
        <Link href="/me/bugs" className="account-item" onClick={() => setOpen(false)}>
          <Icon name="bug" size={18} /> {t('Report a bug')}
        </Link>
        {me.role && (
          <Link href="/admin" className="account-item" onClick={() => setOpen(false)}>
            <Icon name="chart" size={18} /> {me.isAdmin ? t('Admin dashboard') : 'QA panel'}
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
  const [searchUsed, setSearchUsed] = useState(false);
  const [signInUsed, setSignInUsed] = useState(false);
  useEffect(() => {
    setSignInLoader(() => setSignInUsed(true));
    return () => setSignInLoader(null);
  }, []);
  if (searchOpen && !searchUsed) setSearchUsed(true);

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

  const tabs = useTabs();
  // A section game's own /games/<slug> address belongs to its tab, not the arcade's.
  const sectionAt = SECTION_GAMES.find((g) => pathname === g.section!.path || pathname === gameUrl(g.slug));
  // A party-only game's page (Crass Act) belongs to the Party tab.
  const partyAt = PARTY_ONLY_URLS.includes(pathname);
  const active = (href: string): boolean =>
    sectionAt ? href === sectionAt.section!.path : partyAt ? href === '/party' : href === '/' ? pathname === '/' || pathname.startsWith('/games/') || pathname === '/live' : pathname.startsWith(href);

  return (
    <>
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wrap header-row">
          <Link href="/" className="brand" aria-label={t('GlitchBound home')}>
            <LogoMark size={38} />
            <Wordmark />
          </Link>

          <nav className="tabs" aria-label={t('Main')}>
            {tabs.map((tab) => (
              <Link key={tab.href} href={tab.href} className={`tab${tab.slug ? ' is-world' : ''}`} aria-current={active(tab.href) ? 'page' : undefined}>
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
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={`bottom-tab${tab.slug ? ' is-world' : ''}`} aria-current={active(tab.href) ? 'page' : undefined} aria-label={t(tab.label)}>
            <Icon name={tab.icon} size={22} />
            <span>{tTab(tab.short ?? tab.label)}</span>
          </Link>
        ))}
      </nav>
      {searchUsed && (
        <Suspense fallback={null}>
          <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
      {signInUsed && (
        <Suspense fallback={null}>
          <SignInDialog />
        </Suspense>
      )}
    </>
  );
}
