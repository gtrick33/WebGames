import { Rng, hashString } from '../core/rng';
import type { RunStats } from '../game/world';
import type { Profile } from './profile';

export type ChallengeMetric = 'coins_run' | 'dist_run' | 'near_run' | 'dist_total' | 'runs' | 'powerups';

export interface Challenge {
  id: string;
  metric: ChallengeMetric;
  target: number;
  reward: number;
  label: string;
}

const TEMPLATES: { metric: ChallengeMetric; targets: number[]; reward: (t: number) => number; label: (t: number) => string }[] = [
  { metric: 'coins_run', targets: [25, 40, 60], reward: (t) => 40 + t * 2, label: (t) => `Collect ${t} coins in one run` },
  { metric: 'dist_run', targets: [800, 1500, 2200], reward: (t) => 40 + Math.round(t / 20), label: (t) => `Drive ${t.toLocaleString('en-US')} m in one run` },
  { metric: 'near_run', targets: [3, 6, 10], reward: (t) => 50 + t * 10, label: (t) => `Get ${t} near misses in one run` },
  { metric: 'dist_total', targets: [3000, 6000], reward: (t) => Math.round(t / 40), label: (t) => `Drive ${t.toLocaleString('en-US')} m today` },
  { metric: 'runs', targets: [3, 5], reward: (t) => 30 + t * 12, label: (t) => `Play ${t} runs today` },
  { metric: 'powerups', targets: [2, 4], reward: (t) => 50 + t * 15, label: (t) => `Grab ${t} power-ups today` },
];

/** Three deterministic challenges per calendar day (same for everyone on that day). */
export function challengesForDay(day: string): Challenge[] {
  const rng = new Rng(hashString(`neonrush-challenges-${day}`));
  const pool = [...TEMPLATES];
  const out: Challenge[] = [];
  while (out.length < 3 && pool.length > 0) {
    const idx = Math.floor(rng.next() * pool.length);
    const tpl = pool.splice(idx, 1)[0];
    if (!tpl) break;
    const target = rng.pick(tpl.targets);
    out.push({ id: `${day}:${tpl.metric}:${target}`, metric: tpl.metric, target, reward: tpl.reward(target), label: tpl.label(target) });
  }
  return out;
}

/** Reset challenge progress when the day changes. */
export function ensureChallengeDay(profile: Profile, day: string): void {
  if (profile.challenges.day !== day) profile.challenges = { day, progress: {}, claimed: [] };
}

export function challengeProgress(profile: Profile, c: Challenge): number {
  return Math.min(c.target, profile.challenges.progress[c.id] ?? 0);
}

/** Apply a finished run to today's challenges and grant completed rewards once. */
export function applyRunToChallenges(profile: Profile, run: RunStats, day: string): Challenge[] {
  ensureChallengeDay(profile, day);
  const done: Challenge[] = [];
  for (const c of challengesForDay(day)) {
    const prev = profile.challenges.progress[c.id] ?? 0;
    let next = prev;
    switch (c.metric) {
      case 'coins_run': next = Math.max(prev, run.coins); break;
      case 'dist_run': next = Math.max(prev, Math.floor(run.meters)); break;
      case 'near_run': next = Math.max(prev, run.nearMisses); break;
      case 'dist_total': next = prev + Math.floor(run.meters); break;
      case 'runs': next = prev + 1; break;
      case 'powerups': next = prev + run.powerups; break;
    }
    profile.challenges.progress[c.id] = next;
    if (next >= c.target && !profile.challenges.claimed.includes(c.id)) {
      profile.challenges.claimed.push(c.id);
      profile.coins += c.reward;
      done.push(c);
    }
  }
  return done;
}
