/**
 * Where's the Ball? rules as pure functions: aim, confirm, hints, three tries per level, scoring,
 * the daily set and share text. A tap only aims; nothing counts until the player confirms, so a
 * stray tap can never ruin a run. Time comes in as `now` (ms).
 */
import { daysBetween, hashString } from '../../platform/dates';
import { dailyVariant, hasPhotos, makePhotoScene, PHOTO_FROM, runVariant } from './photo';
import { isHit, makeScene, warmth, type Scene } from './scene';

export const EPOCH = '2026-10-18';
export const DAILY_LEVELS = 5;
export const MAX_LEVEL = 1000;
export const TRIES = 3;
export const WRONG_COST = 150;
export const HINT_COST = 200;
export const MAX_HINTS = 2;
export const LIVES = 3;

export interface Guess {
  x: number;
  y: number;
  heat: 'hot' | 'warm' | 'cold';
}

export interface LevelState {
  scene: Scene;
  aim: { x: number; y: number } | null;
  wrong: Guess[];
  hints: number;
  startedAt: number;
  finishedAt: number | null;
  outcome: 'play' | 'found' | 'missed';
}

export function startLevel(scene: Scene, now: number): LevelState {
  return { scene, aim: null, wrong: [], hints: 0, startedAt: now, finishedAt: null, outcome: 'play' };
}

export function aim(s: LevelState, x: number, y: number): LevelState {
  return s.outcome === 'play' ? { ...s, aim: { x, y } } : s;
}

export function confirm(s: LevelState, slop: number, now: number): LevelState {
  if (s.outcome !== 'play' || !s.aim) return s;
  const { x, y } = s.aim;
  if (isHit(s.scene, x, y, slop)) return { ...s, outcome: 'found', finishedAt: now };
  const wrong = [...s.wrong, { x, y, heat: warmth(s.scene, x, y) }];
  const missed = wrong.length >= TRIES;
  return { ...s, wrong, aim: null, outcome: missed ? 'missed' : 'play', finishedAt: missed ? now : null };
}

export function hint(s: LevelState): LevelState {
  return s.outcome === 'play' && s.hints < MAX_HINTS ? { ...s, hints: s.hints + 1 } : s;
}

export function giveUp(s: LevelState, now: number): LevelState {
  return s.outcome === 'play' ? { ...s, outcome: 'missed', finishedAt: now } : s;
}

export const secondsOf = (s: LevelState, now: number): number => Math.max(0, ((s.finishedAt ?? now) - s.startedAt) / 1000);

/** Found: 400 + a speed bonus (600, minus 10 a second), minus wrong guesses and hints; at least 100. */
export function levelScore(s: LevelState): number {
  if (s.outcome !== 'found') return 0;
  const secs = secondsOf(s, s.finishedAt ?? s.startedAt);
  return Math.max(100, Math.round(400 + Math.max(0, 600 - secs * 10) - s.wrong.length * WRONG_COST - s.hints * HINT_COST));
}

export interface LevelResult {
  found: boolean;
  score: number;
  seconds: number;
  wrong: number;
  hints: number;
}

export function resultOf(s: LevelState): LevelResult {
  return { found: s.outcome === 'found', score: levelScore(s), seconds: Math.round(secondsOf(s, s.finishedAt ?? s.startedAt) * 10) / 10, wrong: s.wrong.length, hints: s.hints };
}

export function dailyScene(day: string, index: number): Scene {
  const seed = hashString(`wheres-the-ball:${day}:${index}`);
  // From PHOTO_FROM the daily uses real photos, each library photo once before any repeats.
  if (day >= PHOTO_FROM && hasPhotos()) {
    const v = dailyVariant(daysBetween(PHOTO_FROM, day), index);
    if (v) return makePhotoScene(seed, index, v.photo, v.zoom);
  }
  return makeScene(seed, index);
}

/** Endless level `index` of a run (photos when the library has them). */
export function endlessScene(runSeed: number, index: number): Scene {
  const seed = (runSeed + index * 7919) >>> 0;
  const v = hasPhotos() ? runVariant(runSeed, index) : null;
  return v ? makePhotoScene(seed, index, v.photo, v.zoom) : makeScene(seed, index);
}

export function dailyNumber(day: string): number {
  return Math.max(1, daysBetween(EPOCH, day) + 1);
}

export const totalScore = (rs: readonly LevelResult[]): number => rs.reduce((n, r) => n + r.score, 0);

export function endStats(rs: readonly LevelResult[], extra: Record<string, number> = {}): { score: number; stats: Record<string, number> } {
  const found = rs.filter((r) => r.found);
  const stats: Record<string, number> = { found: found.length, ...extra };
  if (found.length) stats.fastest = Math.max(1, Math.round(Math.min(...found.map((r) => r.seconds))));
  return { score: totalScore(rs), stats };
}

/** 🎾 for a quick find, 🟩 found, 🟨 found with help or misses, 🟥 not found. Never shows where. */
export function squareFor(r: LevelResult): string {
  if (!r.found) return '🟥';
  if (r.wrong || r.hints) return '🟨';
  return r.seconds <= 10 ? '🎾' : '🟩';
}

export function shareText(day: string, rs: readonly LevelResult[], streak: number, url: string): string {
  const lines = [
    `Where's the Ball? #${dailyNumber(day)}`,
    `${rs.map(squareFor).join('')}  ${rs.filter((r) => r.found).length}/${DAILY_LEVELS} found`,
    `${totalScore(rs).toLocaleString('en-US')} / ${(DAILY_LEVELS * MAX_LEVEL).toLocaleString('en-US')}`,
  ];
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`);
  lines.push(url);
  return lines.join('\n');
}
