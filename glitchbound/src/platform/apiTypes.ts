import type { Worn } from '../catalog/looks';
import type { PublicCatalog } from '../catalog/settings';
import type { TitleFxId } from '../catalog/titleFx';
/** Shapes exchanged between the site and /api (Pages Functions). Shared by both sides. */

export interface PublicConfig {
  /** Google OAuth Web Client ID; empty means sign-in is not configured yet. */
  googleClientId: string;
  /** Local development only: a fake sign-in for testing. Always false in production. */
  devLogin: boolean;
  /** Whether announcement/confirmation emails can be sent (Resend configured). */
  emailEnabled: boolean;
}

export type QuestIcon = 'play' | 'trophy' | 'calendar' | 'bolt' | 'heart';

export interface QuestView {
  id: string;
  label: string;
  icon: QuestIcon;
  xp: number;
  target: number;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export interface Badge {
  id: string;
  label: string;
  hint: string;
  earned: boolean;
}

export interface BestView {
  score: number;
  stats: Record<string, number>;
  at: number;
  /** Leaderboard position of this best (1 = top) and how many members have a best in the game. */
  rank?: number;
  players?: number;
}

export interface Me {
  /** What this member's one-time purchases unlocked (src/catalog/shop.ts). */
  owned?: string[];
  /** Those of them an admin gave rather than the member bought (a card for a new one thanks them differently). */
  gifts?: string[];
  /** The border and banner this member wears, from the ones they own (src/catalog/looks.ts). */
  looks?: Worn;
  id: string;
  nickname: string;
  email: string;
  avatar: string;
  isAdmin: boolean;
  /** Staff role: admins see the whole admin panel, QA testers only its QA tab. */
  role: StaffRole | null;
  xp: number;
  level: number;
  levelFloor: number;
  levelNext: number;
  notify: boolean;
  favorites: string[];
  bests: Record<string, BestView>;
  rounds: number;
  streak: number;
  /**
   * Days this member cleared the Daily Challenge, newest first (up to 400), as the server recorded them
   * from checked rounds. The site counts the streak from these, so it is the same on every device.
   */
  dailyDays: string[];
  badges: Badge[];
  quests: QuestView[];
  questDay: string;
  joinedAt: number;
  /** When the newest cloud save changed (0: none): a device that already has it skips the download. */
  savesAt?: number;
  /** Sigilfall titles an admin gave this member (Admin › Sigilfall): any of their heroes can wear them. */
  sigilTitles?: SigilTitleGrant[];
}

/** A Sigilfall title an admin gave a member, with the light it wears (src/catalog/titleFx.ts). */
export interface SigilTitleGrant {
  id: string;
  /** The words, as the admin typed them (src/catalog/titleFx.ts cleanTitle). */
  name: string;
  fx: TitleFxId;
  /** Read before the name ("Blooded Ash") rather than after it ("Ash the Kingslayer"). */
  before: boolean;
  /** When it was given. */
  at: number;
}

export interface RunEndResult {
  ok: boolean;
  newBest: boolean;
  rank: number | null;
  dailyCompleted: boolean;
  quests: QuestView[];
  /** Trophy Shelf pins this round earned. */
  newPins?: string[];
  error?: string;
}

export interface FriendRow extends RowLooks {
  id: string;
  nickname: string;
  level: number;
  points: number;
  rank: string;
  lastGame: string | null;
  lastAt: number | null;
  /** Their tab was in front of them in the last couple of minutes (server/friends.ts). Older servers don't say. */
  online?: boolean;
  /** The game they are in while they are online ('sigilfall'), or null for the site. */
  onlineIn?: string | null;
}

export interface FriendsView {
  code: string;
  friends: FriendRow[];
  blocked: { id: string; nickname: string }[];
}

export interface FriendInvite {
  id: number;
  game: string;
  from: string;
  href: string;
  /** The room's code: a game that shows the invitation inside itself joins by it. Older servers don't send it. */
  code?: string;
}

export interface PinsView {
  pins: { id: string; at: number }[];
  points: number;
  rank: string;
  rarity: { players: number; held: Record<string, number> };
  /** Whose shelf this is, when it is a friend's. */
  owner: { nickname: string; level: number } | null;
}

/** The looks a member wears on the boards (src/catalog/looks.ts), set only when they wear one. */
export interface RowLooks {
  border?: string;
  banner?: string;
  icon?: string;
}

export interface LeaderRow extends RowLooks {
  rank: number;
  nickname: string;
  level: number;
  score: number;
  at: number;
  you: boolean;
}

export interface HallRow extends RowLooks {
  rank: number;
  nickname: string;
  level: number;
  crowns: number;
  podiums: number;
  records: number;
  games: number;
  you: boolean;
}

export interface AdminStats {
  generatedAt: number;
  users: { total: number; new7d: number; active7d: number; recent: { nickname: string; email: string; createdAt: number }[] };
  subscribers: { confirmed: number; pending: number; unsubscribed: number };
  games: { slug: string; title: string; views: number; starts: number; ends: number; visitors: number; players: number; signedInRounds: number; avgScore: number | null; bestScore: number | null; loadErrors: number }[];
  /** Per UTC day. returning = visitors whose browser had visited before; dailyPlayers = visitors who finished a daily. */
  daily: { day: string; visitors: number; starts: number; rounds: number; returning: number; dailyPlayers: number }[];
  searches: { q: string; n: number; zeroResults: number }[];
  /** Signed-in players with a Sigilfall save, and how many are at it right now. */
  sigilfall: { players: number; online: number };
  /** Core Web Vitals of real visits, last 7 days: the 75th percentile (null while there's no data). */
  vitals: { device: string; visits: number; lcp: number | null; inp: number | null; cls: number | null }[];
  errors: { kinds: { kind: string; n: number }[]; latest: { ts: number; kind: string; game: string; message: string; path: string; browser: string }[] };
  announcements: { game: string; subject: string; sentAt: number; recipients: number }[];
  emailEnabled: boolean;
}

/** A member's own bug report, as listed on /me/bugs. */
export interface BugReportView {
  id: number;
  ts: number;
  title: string;
  game: string;
  category: string;
  severity: string;
  status: string;
  note: string;
  updatedAt: number;
}

export interface AdminReports {
  feedback: {
    total30d: number;
    average: number;
    /** Counts for 1 to 5 stars. */
    distribution: number[];
    byGame: { game: string; n: number; average: number }[];
    wishes: { wish: string; n: number }[];
    latest: { ts: number; stars: number; message: string; game: string; wish: string; browser: string; nickname: string | null }[];
  };
  bugs: {
    open: number;
    fixed: number;
    wontfix: number;
    /** Whether new reports and crashes are mirrored to GitHub issues (the GITHUB_TOKEN secret is set). */
    github: boolean;
    list: {
      id: number;
      ts: number;
      title: string;
      description: string;
      game: string;
      category: string;
      severity: string;
      device: string;
      page: string;
      contact: string;
      status: string;
      note: string;
      nickname: string | null;
      /** The GitHub issue it was filed as. */
      issueUrl: string | null;
    }[];
  };
}

export interface CloudUsageDay {
  day: string;
  /** Pages Functions requests (the site's API). */
  requests: number | null;
  errors: number | null;
  /** Requests to the rooms worker itself (count toward the same daily Workers limit). */
  workerRequests: number | null;
  rowsRead: number;
  rowsWritten: number;
  queries: number;
  /** Live rooms (Durable Objects). Null when that metric could not be read. */
  doRequests: number | null;
  doGbSeconds: number | null;
  doRowsRead: number | null;
  doRowsWritten: number | null;
  wsMessages: number | null;
  doStoredBytes: number | null;
}

export interface CloudUsage {
  generatedAt: number;
  limits: {
    requestsPerDay: number;
    d1RowsReadPerDay: number;
    d1RowsWrittenPerDay: number;
    d1StorageBytesPerDb: number;
    d1StorageBytesTotal: number;
    doRequestsPerDay: number;
    doGbSecondsPerDay: number;
    doRowsReadPerDay: number;
    doRowsWrittenPerDay: number;
    doStorageBytes: number;
  };
  databases: { name: string; sizeBytes: number | null; tables: { name: string; rows: number }[] }[];
  analytics: {
    status: 'ok' | 'not_configured' | 'error';
    days: CloudUsageDay[];
    error: string;
  };
  /** Live rooms from the site's own analytics (works without the API token). */
  rooms: {
    games: { game: string; opened: number; joins: number; players: number; openedToday: number }[];
    days: { day: string; opened: number; joins: number }[];
  };
}

/** GET /api/admin/catalog: the Games tab's data. */
export interface AdminCatalog extends PublicCatalog {
  log: { ts: number; admin: string; action: string; detail: string }[];
}

/** GET /api/admin/members?q=: a member in the admin's player picker (src/pages/admin/PlayerPicker.tsx). */
export interface AdminMember {
  id: string;
  nickname: string;
  email: string;
  lastSeen: number;
}

/** GET /api/admin/shop?q=&offset=&limit=: sales by item, and one page of the purchases (newest first) that match. */
export interface ShopReport {
  /** Paid items and money taken, by item and currency. */
  items: { product: string; paid: number; refunded: number; gifted: number; cents: number; currency: string | null }[];
  recent: ShopSale[];
  /** How many purchases match, over every page. */
  total: number;
  offset: number;
  limit: number;
}

export interface ShopSale {
  id: string;
  product: string;
  status: string;
  amount: number | null;
  currency: string | null;
  at: number;
  /** Null once the account is deleted. */
  nickname: string | null;
  email: string | null;
  gift: boolean;
}

/* ------------------------------------------------------------------ Sigilfall's game masters */

/** One hero, as the player list shows them. */
export interface GmHeroRow {
  slot: number;
  name: string;
  cls: string;
  level: number;
  created: number;
  updated: number;
  tier: number;
  keystone: number;
  /** Seconds played. */
  time: number;
}

export interface GmPlayerRow {
  id: string;
  nickname: string;
  email: string;
  createdAt: number;
  lastSeen: number;
  /** When their save last reached the server. */
  savedAt: number;
  online: boolean;
  banned: boolean;
  heroes: GmHeroRow[];
}

export interface GmOverview {
  players: number;
  online: number;
  active7d: number;
  heroes: number;
  /** Orders no game has carried out yet. */
  waiting: number;
  classes: { cls: string; heroes: number; avgLevel: number; topLevel: number }[];
}

export interface GmOrderView {
  id: string;
  slot: number;
  created: number;
  heroName: string;
  kind: string;
  summary: string;
  note: string;
  by: string;
  at: number;
  appliedAt: number | null;
  /** '' when it went through, otherwise why it couldn't. */
  result: string;
  cancelledAt: number | null;
}

/** One player's Sigilfall, as the server holds it (the save is the game's own, for the game's own code to read). */
export interface GmPlayerDetail {
  id: string;
  nickname: string;
  email: string;
  createdAt: number;
  lastSeen: number;
  banned: boolean;
  banReason: string;
  savedAt: number;
  online: boolean;
  save: unknown;
  ring: unknown;
  vigil: unknown;
  /** The shop items they bought for the game (the Gloamknight Pack, mounts, Wardrobe looks), by id. */
  bought: string[];
  orders: GmOrderView[];
  graves: { id: string; created: number; name: string; cls: string; level: number; deletedAt: number; restoredAt: number | null }[];
}

/** A Sigilfall title an admin gave, as the admin sees it: taken-back ones too. */
export interface GmTitle extends SigilTitleGrant {
  /** The admin who gave it. */
  by: string;
  revokedAt: number | null;
}

/* ------------------------------------------------------------------ QA tools and the QA team */

export type StaffRole = 'admin' | 'qa';

/** A player in the QA tab's search results. */
export interface QaPlayerRow {
  id: string;
  nickname: string;
  email: string;
  level: number;
  createdAt: number;
  lastSeen: number;
  banned: boolean;
  role: StaffRole | null;
}

export interface QaGrant {
  id: string;
  game: string;
  amount: number;
  note: string;
  by: string;
  at: number;
  /** When the game collected it (null while it waits for the player to open the game). */
  claimedAt: number | null;
}

export interface QaEmail {
  subject: string;
  body: string;
  by: string;
  at: number;
  ok: boolean;
}

/** One player, opened in the QA tab. */
export interface QaPlayer extends QaPlayerRow {
  xp: number;
  rounds: number;
  ban: { at: number; reason: string; by: string } | null;
  bests: { game: string; score: number; at: number }[];
  runs: { game: string; score: number | null; status: string; at: number }[];
  grants: QaGrant[];
  emails: QaEmail[];
}

/** A QA team member in the admin's QA team tab. `expired`: invited, but the link ran out. */
export interface StaffRow {
  email: string;
  status: 'invited' | 'active' | 'blocked' | 'expired';
  userId: string | null;
  nickname: string | null;
  invitedBy: string;
  invitedAt: number;
  acceptedAt: number | null;
  updatedBy: string;
  updatedAt: number;
  lastActivity: number | null;
  actions30d: number;
}

/** One row of the QA audit trail. */
export interface AuditRow {
  id: number;
  ts: number;
  actor: string;
  kind: 'request' | 'action' | 'auth';
  action: string;
  targetId: string | null;
  targetEmail: string | null;
  detail: string;
  status: number | null;
  ip: string;
  userAgent: string;
}

/* ------------------------------------------------------------------ Admin › Sigilfall: the Ring, the Campaign, the Vigil */

/** A player's standing in one of the Ring's formats, as the admin sees it (this season's, as the player sees it). */
export interface RingAdminStanding {
  userId: string;
  nickname: string;
  email: string;
  banned: boolean;
  format: number;
  rating: number;
  mmr: number;
  best: number;
  wins: number;
  losses: number;
  streak: number;
  season: number;
  /** What is written, before the season's reset is applied to it (null: never played that format). */
  stored: { rating: number; season: number } | null;
  updatedAt: number;
}

/** A player's own numbers in a rated match, as their game reported them (arena/ranked.ts MatchStats). */
export interface RingAdminStats {
  cls: string;
  secs: number;
  dmg: number;
  heal: number;
  cc: number;
  kicks: number;
  combos: number;
  supers: number;
}

export interface RingAdminMatch {
  id: string;
  format: number;
  kind: 'bots' | 'people';
  createdAt: number;
  settledAt: number | null;
  /** 't0' (the first side won), 't1', 'draw', 'void', or null while it is open. */
  result: string | null;
  note: string | null;
  /** The computer's rating, against the computer. */
  rival: number;
  /** How long it ran, in seconds: by the players' own clocks (`measured`), else from its start to the first report. */
  secs: number | null;
  measured: boolean;
  players: {
    userId: string;
    nickname: string;
    team: 0 | 1;
    party: boolean;
    rating: number;
    mmr: number;
    report: string | null;
    reportedAt: number | null;
    change: number | null;
    note: string | null;
    stats: RingAdminStats | null;
  }[];
}

export interface RingAdminOverview {
  season: number;
  seasonEnds: number;
  /** Matches not settled yet. */
  open: number;
  formats: {
    format: number;
    players: number;
    active7d: number;
    avgRating: number;
    topRating: number;
    matches: number;
    matches24h: number;
    matches7d: number;
    vsPeople: number;
    /** Reports with the player's numbers in them, the last 30 days, and their averages. */
    withStats: number;
    avgSecs: number;
    avgDmg: number;
    avgHeal: number;
  }[];
  /** Every match by how it ended ('t0', 't1', 'draw', 'void', 'open'), and by why it counted less. */
  results: Record<string, number>;
  notes: Record<string, number>;
  /** Each class in each format, the last 30 days of reports with numbers. */
  classes: { format: number; cls: string; played: number; wins: number; decided: number; avgDmg: number; avgHeal: number; avgSecs: number }[];
}

export interface RingAdminPlayer {
  userId: string;
  nickname: string;
  standings: RingAdminStanding[];
  matches: RingAdminMatch[];
  total: number;
}

/** A row on one of Sigilfall's boards, as the admin sees it. */
export interface BoardAdminRow {
  userId: string;
  nickname: string;
  email: string;
  banned: boolean;
  rank: number;
  score: number;
  at: number;
  /** Kept off this board by an admin. */
  held: boolean;
  reason?: string;
  by?: string;
}

export interface BoardSummary {
  board: string;
  players: number;
  top: number;
  avg: number;
}

export interface CampaignAdminOverview {
  players: number;
  playedToday: number;
  heroes: number;
  /** Heroes jumped ahead with a review preset (they send no scores). */
  reviewHeroes: number;
  hoursPlayed: number;
  avgMinutes: number;
  avgLevel: number;
  maxed: number;
  topParagon: number;
  kills: number;
  deaths: number;
  stoneHeroes: number;
  topStone: number;
  avgStone: number;
  levels: { from: number; to: number; heroes: number }[];
  tiers: { tier: number; heroes: number }[];
  /** Where heroes stand now ('' for heroes who haven't travelled yet). */
  lands: { land: string; heroes: number; avgLevel: number }[];
  quests: { id: string; done: number; active: number }[];
  bosses: { id: string; kills: number; heroes: number }[];
  /** The Rift Trials: each calling's highest stone across players. */
  trials: { cls: string; players: number; top: number; avg: number }[];
  boards: BoardSummary[];
}

export interface VigilAdminOverview {
  players: number;
  active7d: number;
  /** Each land's longest nights, in seconds. */
  lands: { land: string; players: number; top: number; avg: number; tenMinutes: number; active7d: number }[];
  boards: BoardSummary[];
}
