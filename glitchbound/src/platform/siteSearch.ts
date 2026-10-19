/**
 * The site-wide search behind the header's Search button ("/"): arcade games, Party Mode games and
 * the site's pages and features ("my profile", "leaderboard", "dark mode"...). Pure, so the tests
 * can check what a query finds; SearchDialog renders the groups and runs the chosen result.
 */
import { matchScore, queryGames } from '../catalog/catalog';
import type { GameEntry } from '../catalog/types';
import type { IconName } from '../components/Icon';
import { PARTY_GAMES, type PartyGame } from '../party/catalog';
import type { StaffRole } from './apiTypes';

/** What a page or feature result does: open a URL, or run one of the dialog's actions. */
export type PageAction = 'signin' | 'signout' | 'feedback' | 'night' | 'day';

export interface PageEntry {
  id: string;
  /** English title; shown through t() (most have translations). */
  title: string;
  icon: IconName;
  href?: string;
  action?: PageAction;
  /** Words and phrases people type for it. */
  keywords: string[];
  /** Only for guests, members or staff. */
  who?: 'guest' | 'member' | 'admin' | 'staff';
  /** Shown before typing anything. */
  quick?: boolean;
}

export const PAGES: PageEntry[] = [
  { id: 'profile', title: 'Profile & quests', icon: 'user', href: '/me', quick: true, keywords: ['my profile', 'profile', 'account', 'my account', 'me', 'quests', 'daily quests', 'level', 'xp', 'badges', 'nickname', 'name', 'stats', 'my bests', 'settings', 'email updates', 'newsletter', 'delete account'] },
  { id: 'daily', title: 'Daily Challenge', icon: 'calendar', href: '/daily', quick: true, keywords: ['daily', 'dailies', 'today', 'challenge of the day', 'streak', 'daily puzzle', 'todays games'] },
  { id: 'party', title: 'Party Mode', icon: 'party', href: '/party', quick: true, keywords: ['party', 'party games', 'friends', 'group', 'together', 'multiplayer', 'pass the phone', 'one phone', 'drinking games'] },
  { id: 'room', title: 'Join a party room', icon: 'party', href: '/party?play=online', keywords: ['join', 'room', 'room code', 'code', 'join room', 'online', 'own phones', 'invite'] },
  { id: 'leaderboards', title: 'Leaderboards', icon: 'crown', href: '/leaderboards', quick: true, keywords: ['leaderboard', 'leaderboards', 'ranks', 'ranking', 'rankings', 'high scores', 'top scores', 'hall of fame', 'best players', 'scores'] },
  { id: 'arcade', title: 'The arcade', icon: 'gamepad', href: '/#arcade', keywords: ['arcade', 'home', 'all games', 'games', 'browse', 'categories'] },
  { id: 'favorites', title: 'Favorites', icon: 'heart', href: '/?fav=1#arcade', keywords: ['favorites', 'favourites', 'my games', 'saved', 'liked', 'hearts'] },
  { id: 'challenges', title: 'Your challenges', icon: 'trophy', href: '/c', keywords: ['challenges', 'challenge a friend', 'friend challenge', 'versus', 'vs', 'duel', 'beat my friend'] },
  { id: 'signin', title: 'Sign in', icon: 'user', action: 'signin', who: 'guest', keywords: ['sign in', 'log in', 'login', 'sign up', 'register', 'create account', 'account', 'join'] },
  { id: 'signout', title: 'Sign out', icon: 'logout', action: 'signout', who: 'member', keywords: ['sign out', 'log out', 'logout', 'exit account'] },
  { id: 'night', title: 'Night', icon: 'moon', action: 'night', keywords: ['dark mode', 'night mode', 'dark theme', 'theme', 'night'] },
  { id: 'day', title: 'Day', icon: 'sun', action: 'day', keywords: ['light mode', 'day mode', 'light theme', 'theme', 'day'] },
  { id: 'bug', title: 'Report a bug', icon: 'bug', href: '/me/bugs', keywords: ['bug', 'report', 'broken', 'problem', 'issue', 'not working', 'crash', 'help', 'support'] },
  { id: 'feedback', title: 'Give feedback', icon: 'chat', action: 'feedback', keywords: ['feedback', 'idea', 'suggestion', 'rate', 'review', 'contact', 'help'] },
  { id: 'privacy', title: 'Privacy & your data', icon: 'link', href: '/privacy', keywords: ['privacy', 'data', 'cookies', 'policy', 'terms', 'gdpr', 'delete my data'] },
  { id: 'admin', title: 'Admin dashboard', icon: 'chart', href: '/admin', who: 'admin', keywords: ['admin', 'dashboard', 'stats', 'analytics', 'games settings'] },
  { id: 'qa', title: 'QA panel', icon: 'bug', href: '/admin?tab=qa', who: 'staff', keywords: ['qa', 'qa panel', 'testing', 'ban', 'coins', 'players', 'test'] },
  { id: 'qa-team', title: 'QA team', icon: 'user', href: '/admin?tab=team', who: 'admin', keywords: ['qa team', 'testers', 'invite tester', 'audit', 'audit trail'] },
];

/** Party games: extra words people use for them. */
const PARTY_WORDS: Partial<Record<PartyGame['id'], string[]>> = {
  impostor: ['spy', 'undercover', 'liar', 'secret word', 'faker', 'imposter', 'social deduction'],
  prompts: ['truth or dare', 'truth', 'dare', 'dares', 'most likely to', 'questions', 'cards'],
  nhie: ['never have i ever', 'nhie', 'fingers', 'confessions'],
  charades: ['act', 'acting', 'mime', 'forehead', 'draw', 'drawing', 'guess', 'sketch'],
  board: ['dice', 'board game', 'snakes and ladders', 'ladders', 'roll'],
  auction: ['bid', 'bidding', 'auction', 'money', 'collection', 'price'],
  rps: ['rock paper scissors', 'rock', 'paper', 'scissors', 'rps', 'roshambo'],
};

/** Lower case, accents dropped, any script (Cyrillic page names match too). */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const words = (q: string): string[] => norm(q).split(' ').filter(Boolean);

/** Every word must match: in the title (best at its start), then in the keywords, then in the rest. */
function score(q: string, title: string, keywords: string[], rest = ''): number {
  const ws = words(q);
  if (!ws.length) return 1;
  const t = norm(title);
  const tWords = t.split(' ');
  const k = keywords.map(norm);
  const kWords = k.join(' ').split(' ');
  const r = norm(rest);
  let total = 0;
  for (const w of ws) {
    if (t.startsWith(w)) total += 12;
    else if (tWords.some((x) => x.startsWith(w))) total += 9;
    else if (k.some((x) => x === w || x.startsWith(`${w} `))) total += 8;
    else if (kWords.some((x) => x.startsWith(w))) total += 6;
    else if (t.includes(w) || k.some((x) => x.includes(w))) total += 3;
    else if (r.includes(w)) total += 1;
    else return 0;
  }
  // A phrase typed whole ("my profile") beats the same words matched one by one.
  const phrase = ws.join(' ');
  if (ws.length > 1 && (t.includes(phrase) || k.some((x) => x.includes(phrase)))) total += 6;
  return total;
}

export interface SearchContext {
  member: boolean;
  role: StaffRole | null;
  /** Arcade games players can see (hidden ones left out). */
  games: GameEntry[];
  /** Party games players can see, with the admins' titles and blurbs. */
  party?: PartyGame[];
  /** The page titles in the player's language match too. */
  translate?: (text: string) => string;
}

export type SearchGroup =
  | { kind: 'games'; best: number; items: GameEntry[] }
  | { kind: 'party'; best: number; items: PartyGame[] }
  | { kind: 'pages'; best: number; items: PageEntry[] };

function allowed(p: PageEntry, ctx: SearchContext): boolean {
  switch (p.who) {
    case 'guest':
      return !ctx.member;
    case 'member':
      return ctx.member;
    case 'admin':
      return ctx.role === 'admin';
    case 'staff':
      return ctx.role !== null;
    default:
      return true;
  }
}

/**
 * Results in groups, the group with the best match first. On a tie games come first, then pages
 * ("party" opens Party Mode before Party Prompts); with nothing typed: games, party games, pages.
 */
export function siteSearch(q: string, ctx: SearchContext): SearchGroup[] {
  const typed = words(q).length > 0;
  // Game search reads Latin letters only: a query in another script finds pages, not every game.
  const latin = /[a-z0-9]/i.test(q.normalize('NFKD'));
  const games = typed && !latin ? [] : queryGames({ q }, ctx.games);
  const gameBest = Math.max(0, ...games.map((g) => matchScore(g, q)));

  // Crass Act is an arcade game too; it shows once, with its art.
  const partyList = (ctx.party ?? PARTY_GAMES).filter((g) => !ctx.games.some((x) => x.slug === g.id));
  const party = partyList
    .map((g) => ({ g, s: score(q, g.title, [...(PARTY_WORDS[g.id] ?? []), 'party game'], `${g.blurb} ${g.roomBlurb ?? ''}`) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const pages = PAGES.filter((p) => allowed(p, ctx) && (typed || p.quick))
    .map((p) => ({ p, s: score(q, p.title, ctx.translate ? [...p.keywords, ctx.translate(p.title)] : p.keywords) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, typed ? 6 : 8);

  const groups: SearchGroup[] = [
    { kind: 'games', best: gameBest, items: games },
    { kind: 'party', best: party[0]?.s ?? 0, items: party.map((x) => x.g) },
    { kind: 'pages', best: pages[0]?.s ?? 0, items: pages.map((x) => x.p) },
  ];
  const order = typed ? { games: 0, pages: 1, party: 2 } : { games: 0, party: 1, pages: 2 };
  return groups.filter((g) => g.items.length > 0).sort((a, b) => (typed ? b.best - a.best : 0) || order[a.kind] - order[b.kind]);
}

/** The Party Mode link for one party game: the lobby opens on it (online games on the rooms tab). */
export const partyHref = (g: Pick<PartyGame, 'id'>): string => `/party?play=${g.id}`;
