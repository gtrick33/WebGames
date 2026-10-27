/**
 * Games whose address is not their slug. Quizbelief launched as "Wait, What?": its slug (and so its saves,
 * scores, settings and art folder) stays `wait-what`, while its pages live at /games/quizbelief. The old
 * address still opens the game; the page then shows the new one, and the server answers it with a 301
 * (functions/games/wait-what). No imports, so the server and the build scripts can use it too.
 */
export const URL_SLUGS: Readonly<Record<string, string>> = { 'wait-what': 'quizbelief' };

const SLUG_OF_URL: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(URL_SLUGS).map(([slug, url]) => [url, slug]));

/** The slug behind an address name (`quizbelief` → `wait-what`); any other name is its own slug. */
export const slugOfUrl = (name: string): string => SLUG_OF_URL[name] ?? name;

/** A game's page by slug: /games/quizbelief for `wait-what`, /games/<slug> for the rest. */
export const gameUrl = (slug: string): string => `/games/${URL_SLUGS[slug] ?? slug}`;
