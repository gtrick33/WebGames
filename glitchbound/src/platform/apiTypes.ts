import type { PublicCatalog } from '../catalog/settings';
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
  badges: Badge[];
  quests: QuestView[];
  questDay: string;
  joinedAt: number;
}

export interface RunEndResult {
  ok: boolean;
  newBest: boolean;
  rank: number | null;
  dailyCompleted: boolean;
  quests: QuestView[];
  error?: string;
}

export interface LeaderRow {
  rank: number;
  nickname: string;
  level: number;
  score: number;
  at: number;
  you: boolean;
}

export interface HallRow {
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
