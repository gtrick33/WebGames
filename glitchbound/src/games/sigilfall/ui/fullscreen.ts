import { createContext } from 'react';

/**
 * The arcade's way into full screen (src/platform/contract.ts `enterFullscreen`), for the game's own screens to offer:
 * inside the site's page on a desktop the game's stage is small for what it shows (NINE_PLAN.md, piece 8). Undefined
 * while the game already fills the screen, and where the arcade gives none.
 */
export const FullscreenContext = createContext<(() => void) | undefined>(undefined);
