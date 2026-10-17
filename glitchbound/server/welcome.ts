import { GAMES } from '../src/catalog/games';
import { challengeForDay } from '../src/platform/daily';
import { questsForDay } from '../src/platform/progression';
import { arcadeEmail } from './arcadeMail';
import { emailEnabled, sendBatch, type Mail } from './email';
import { siteUrl, type Env } from './http';
import type { UserRow } from './session';

/** The welcome email for a brand-new member: their nickname, level and their own first quests. */
export function welcomeMail(base: string, user: Pick<UserRow, 'id' | 'email' | 'nickname'>, day: string): Mail {
  const quests = questsForDay(user.id, day, GAMES, false);
  const daily = challengeForDay(day, GAMES);
  const { html, text } = arcadeEmail({
    kicker: 'PLAYER 1 HAS JOINED',
    title: `Welcome to the arcade, ${user.nickname}!`,
    intro: [
      'Your GlitchBound account is ready. You start at level 1, and every day you get three quests of your own. Here are today’s:',
    ],
    hud: `LV 1 · 0 XP · ${quests.length} QUESTS WAITING`,
    list: quests.map((q) => ({ label: q.label, value: `+${q.xp} XP` })),
    outro: daily ? [`Today’s Daily Challenge, the same for everyone: ${daily.label}.`] : [],
    link: { label: 'PRESS START', url: `${base}/me` },
    signoff: 'See you on the leaderboard,\nThe GlitchBound team',
    footer: 'You get this once, because you just created a GlitchBound account. You can change your nickname or delete your account any time on your profile.',
  });
  return { to: user.email, subject: `Welcome to GlitchBound, ${user.nickname}`, html, text };
}

export async function sendWelcome(env: Env, request: Request, user: UserRow, day: string): Promise<void> {
  if (!emailEnabled(env)) return;
  try {
    await sendBatch(env, [welcomeMail(siteUrl(env, request), user, day)]);
  } catch {
    // A welcome email must never break sign-in.
  }
}
