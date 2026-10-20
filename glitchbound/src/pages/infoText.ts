/**
 * Texts the About and Contact pages share with their build-time HTML (scripts/seo.ts). Plain data,
 * no React or CSS, so the build can import it.
 */

/** Where players reach the studio: a ticket (bug report, question or data request). No account needed. */
export const CONTACT_PATH = '/me/bugs?category=question';
export const CONTACT_DESCRIPTION = 'How to reach GlitchBound: tickets for bugs, questions and data requests, and feedback.';
export const ABOUT_DESCRIPTION = 'Who makes GlitchBound, what kind of games it has, and the few rules the arcade sticks to.';
