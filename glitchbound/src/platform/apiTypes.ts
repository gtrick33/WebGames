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
    }[];
  };
}

export interface CloudUsage {
  generatedAt: number;
  limits: { requestsPerDay: number; d1RowsReadPerDay: number; d1RowsWrittenPerDay: number; d1StorageBytesPerDb: number; d1StorageBytesTotal: number };
  databases: { name: string; sizeBytes: number | null; tables: { name: string; rows: number }[] }[];
  analytics: {
    status: 'ok' | 'not_configured' | 'error';
    days: { day: string; requests: number | null; errors: number | null; rowsRead: number; rowsWritten: number; queries: number }[];
    error: string;
  };
}
