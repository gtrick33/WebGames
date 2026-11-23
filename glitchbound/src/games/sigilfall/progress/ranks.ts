import { RING_BOARDS, type Format } from '../arena/ranks';
import { CLASS_IDS, MAX_LEVEL } from '../data/classes';
import type { SaveFile } from './save';

/**
 * Sigilfall's rankings, on the player's side: what this account's bests are, board by board, as the server keeps
 * them (functions/api/sigilfall/ranks.ts). The bests are read from what the game already keeps (the save, the
 * Vigil's nights, the Ring's rating) and sent when the player is at the title; the server only ever raises a row.
 */
export interface RankEntry {
  board: string;
  score: number;
}

/** A hero's place on the level board: the level first, then the Paragon level. */
export const levelScore = (level: number, paragon: number): number => Math.min(MAX_LEVEL, Math.max(0, Math.floor(level))) * 10_000 + Math.min(9999, Math.max(0, Math.floor(paragon)));
export const levelOf = (score: number): { level: number; paragon: number } => ({ level: Math.floor(score / 10_000), paragon: score % 10_000 });

/** Every best this account has, as the boards want them. Boards with nothing on them are left out. */
export function rankEntries(save: Pick<SaveFile, 'heroes'> & { rift?: Record<string, number> }, vigil: Record<string, number>, ringBest: number, ringByFormat: Partial<Record<Format, number>> = {}, season = 0): RankEntry[] {
  const out: RankEntry[] = [];
  const put = (board: string, score: number): void => {
    if (Number.isFinite(score) && score > 0) out.push({ board, score: Math.floor(score) });
  };
  // the Rift Trials: each calling's stone, and the highest of them (a stone that was never raised is no feat)
  const rift = save.rift ?? {};
  let top = 0;
  for (const cls of CLASS_IDS) {
    const n = rift[cls] ?? 0;
    if (n > 1) put(`trial:${cls}`, n);
    top = Math.max(top, n);
  }
  if (top > 1) put('trial', top);
  // a story hero's own Riftstone, and the highest hero
  let stone = 0;
  let level = 0;
  for (const h of save.heroes) {
    if (!h || h.review) continue;
    if (h.level >= MAX_LEVEL) stone = Math.max(stone, h.keystone);
    level = Math.max(level, levelScore(h.level, h.para?.l ?? 0));
  }
  if (stone > 1) put('stone', stone);
  // the Rift season's ladder (data/seasons.ts): the season's best stone in time, each calling's and the highest, on boards
  // of that season's own (a new season, new boards: the ladder starts again)
  if (season > 0) {
    let top = 0;
    const byCls: Partial<Record<string, number>> = {};
    for (const h of save.heroes) {
      if (!h || h.review || h.rseason?.n !== season) continue;
      byCls[h.cls] = Math.max(byCls[h.cls] ?? 0, h.rseason.best);
      top = Math.max(top, h.rseason.best);
    }
    for (const [cls, best] of Object.entries(byCls)) put(`season:s${season}-${cls}`, best ?? 0);
    put(`season:s${season}`, top);
  }
  if (level > levelScore(1, 0)) put('level', level);
  // the Vigil's longest night, land by land and anywhere
  let night = 0;
  for (const [land, t] of Object.entries(vigil)) {
    if (!/^[a-z][a-z-]{1,31}$/.test(land)) continue;
    put(`vigil:${land}`, t);
    night = Math.max(night, t);
  }
  put('vigil', night);
  // the Ring (`ringBest`: 0 until a rating has been fought for; everyone starts with one), and each format's own board
  // (the owner: "make the leaderboard based on the mode 1v1, 2v2, 3v3"), for every format a match has been played in
  put('ring', ringBest);
  for (const b of RING_BOARDS) put(`ring:${b.part}`, ringByFormat[b.format] ?? 0);
  return out;
}

