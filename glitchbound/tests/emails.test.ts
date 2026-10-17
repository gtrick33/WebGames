import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { announcementMail } from '../server/announcement';
import { welcomeMail } from '../server/welcome';

const BASE = 'https://glitchboundstudio.com';
const out = process.env.EMAIL_PREVIEW_DIR;

describe('emails', () => {
  it('welcome lists the member’s own quests and one link, with a text part', () => {
    const m = welcomeMail(BASE, { id: 'u-1', email: 'p@example.com', nickname: 'NeonQueen' }, '2026-10-18');
    expect(m.subject).toBe('Welcome to GlitchBound, NeonQueen');
    expect(m.html).toContain('PLAYER 1 HAS JOINED');
    expect(m.html.match(/<a /g)).toHaveLength(1);
    expect(m.html).not.toMatch(/<img/);
    expect(m.text).toContain('[ ] Play');
    expect(m.text).toContain(`${BASE}/me`);
    if (out) writeFileSync(`${out}/welcome.html`, m.html);
  });

  it('announcement escapes content, links to the game and carries an unsubscribe link', () => {
    const m = announcementMail(BASE, 'p@example.com', 'tok123', { slug: 'x', title: 'Pixel <Drift>', tagline: 'One button.', categories: ['racing'] }, 'New', 'Line one\nLine two');
    expect(m.html).toContain('Pixel &lt;Drift&gt; is live');
    expect(m.html).toContain(`${BASE}/games/x`);
    expect(m.unsubscribeUrl).toBe(`${BASE}/api/unsubscribe?token=tok123`);
    expect(m.html).toContain('Unsubscribe');
    expect(m.html).not.toMatch(/<img/);
    if (out) writeFileSync(`${out}/announce.html`, m.html);
  });
});
