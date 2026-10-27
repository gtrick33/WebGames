import { CATEGORIES, type GameEntry } from '../src/catalog/types';
import { arcadeEmail } from './arcadeMail';
import type { Mail } from './email';
import { gameUrl } from '../src/catalog/urls';

/** A new-game announcement in the arcade style, with a working unsubscribe link and header. */
export function announcementMail(base: string, to: string, unsubscribeToken: string, game: Pick<GameEntry, 'title' | 'tagline' | 'categories'> & { slug?: string }, subject: string, message: string): Mail {
  const unsub = `${base}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const url = game.slug ? `${base}${gameUrl(game.slug)}` : base;
  const { html, text } = arcadeEmail({
    kicker: 'NEW CABINET UNLOCKED',
    title: `${game.title} is live`,
    intro: [...message.split(/\n+/).map((l) => l.trim()).filter(Boolean), game.tagline],
    hud: `${CATEGORIES[game.categories[0]].label.toUpperCase()} · FREE · PLAYS IN YOUR BROWSER`,
    link: { label: `PLAY ${game.title.toUpperCase()}`, url },
    signoff: 'Thanks for playing,\nThe GlitchBound team',
    footer: 'You asked GlitchBound to email you when a new game launches.',
    footerLink: { label: 'Unsubscribe', url: unsub },
  });
  return { to, subject, html, text, unsubscribeUrl: unsub };
}
