/** The games a friend can be invited into, and where the invite leads. */
export const INVITE_PATHS: Record<string, string> = { sigilfall: '/sigilfall?room=' };

export const invitePath = (game: string, code: string): string | null => (INVITE_PATHS[game] ? `${INVITE_PATHS[game]}${encodeURIComponent(code)}` : null);
