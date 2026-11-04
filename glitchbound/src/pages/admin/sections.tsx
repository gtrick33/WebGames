import { useEffect, useRef } from 'react';
import { SECTION_GAMES } from '../../catalog/catalog';
import { Icon } from '../../components/Icon';
import { Link } from '../../router/router';
import { ChangeLog } from './ChangeLogSection';
import { DailyPlanner } from './DailySection';
import { HomeEditor } from './HomeSection';
import { PartyList } from './PartySection';
import { SectionList } from './SectionsSection';
import { SiteSection } from './SiteSection';
import { useAdminCatalog } from './useAdminCatalog';

/**
 * The admin's sections, in the order of its navigation. Each is a file of its own in pages/admin/ (the
 * Overview and QA ones live in AdminPage.tsx and QaPanel). A new section is one entry here and one file.
 */
export type SectionId = 'dashboard' | 'home' | 'party' | 'sections' | 'daily' | 'site' | 'log' | 'qa' | 'team';

type IconName = 'chart' | 'star' | 'party' | 'sword' | 'calendar' | 'info' | 'menu' | 'bug' | 'user';

export interface Section {
  id: SectionId;
  label: string;
  icon: IconName;
  group: 'Site' | 'Quality';
  /** What it is for, under its title. */
  blurb: string;
}

export const SECTIONS: Section[] = [
  { id: 'dashboard', label: 'Overview', icon: 'chart', group: 'Site', blurb: 'Visitors, members, games played and errors at a glance.' },
  {
    id: 'home',
    label: 'Home page',
    icon: 'star',
    group: 'Site',
    blurb: 'The Sigilfall banner, Our best games, the live games row and the arcade banners, with every game’s settings. One draft: preview it, then publish.',
  },
  { id: 'party', label: 'Party Mode', icon: 'party', group: 'Site', blurb: 'What the party page shows, game by game. Switches save right away.' },
  {
    id: 'sections',
    label: SECTION_GAMES.length === 1 ? SECTION_GAMES[0]!.section!.label : 'Sections',
    icon: 'sword',
    group: 'Site',
    blurb: 'Games big enough for a tab of their own: switch them on or off, pause them, edit their texts.',
  },
  { id: 'daily', label: 'Daily challenges', icon: 'calendar', group: 'Site', blurb: 'The next 14 days of Today’s challenge; hand-pick any day.' },
  { id: 'site', label: 'Notice & holidays', icon: 'info', group: 'Site', blurb: 'A banner on every page, and the holiday look: greeting, decorations, scenery and little events.' },
  { id: 'log', label: 'Change log', icon: 'menu', group: 'Site', blurb: 'Every change made here, newest first.' },
  { id: 'qa', label: 'QA', icon: 'bug', group: 'Quality', blurb: 'Look up a player, give coins, ban, email, and test any game without getting in the way.' },
  { id: 'team', label: 'QA team', icon: 'user', group: 'Quality', blurb: 'Who tests, and invitations.' },
];

/** The section a ?tab= asks for (the old "games" tab is now the home page editor). */
export function sectionOf(asked: string | null): SectionId {
  if (asked === 'games') return 'home';
  return SECTIONS.find((s) => s.id === asked)?.id ?? 'dashboard';
}

export const sectionHref = (id: SectionId): string => (id === 'dashboard' ? '/admin' : `/admin?tab=${id}`);

/** The admin's navigation: a column of sections on wide screens, a row that scrolls on phones. */
export function AdminNav({ current }: { current: SectionId }) {
  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  const nav = useRef<HTMLElement>(null);
  // On a phone it's one row that scrolls: the open section shouldn't be left off the edge.
  useEffect(() => {
    const row = nav.current;
    const link = row?.querySelector<HTMLElement>('.is-on');
    if (!row || !link || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
  }, [current]);
  return (
    <nav className="admin-nav" aria-label="Admin sections" ref={nav}>
      {groups.map((g) => (
        <div key={g} className="admin-nav-group">
          <span className="admin-nav-title mono">{g}</span>
          {SECTIONS.filter((s) => s.group === g).map((s) => (
            <Link key={s.id} href={sectionHref(s.id)} className={`admin-nav-link${current === s.id ? ' is-on' : ''}`} aria-current={current === s.id ? 'page' : undefined}>
              <Icon name={s.icon} size={16} /> {s.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** A section that edits the site's catalog (everything but Overview and QA). */
export function CatalogSection({ id }: { id: SectionId }) {
  const { data, error, busy, toast, send } = useAdminCatalog();
  if (error) return <p className="info-lead">{error}</p>;
  if (!data) return <p className="info-lead">Loading the site settings…</p>;
  // a fresh draft once something is published (the editors start from what is live)
  const published = JSON.stringify([data.settings, data.layout ?? null, data.flagships ?? null, data.multiplayer ?? null]);
  return (
    <div className="ag" aria-busy={busy}>
      <p className="ag-toast" role="status" aria-live="polite">
        {toast}
      </p>
      {id === 'home' ? (
        <HomeEditor key={published} data={data} send={send} busy={busy} />
      ) : id === 'party' ? (
        <PartyList data={data} send={send} busy={busy} />
      ) : id === 'sections' ? (
        <SectionList data={data} send={send} busy={busy} />
      ) : id === 'daily' ? (
        <DailyPlanner data={data} send={send} busy={busy} />
      ) : id === 'site' ? (
        <SiteSection data={data} send={send} busy={busy} />
      ) : (
        <ChangeLog log={data.log} />
      )}
    </div>
  );
}
