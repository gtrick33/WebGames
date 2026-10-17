import type { ComponentType } from 'react';
import type { GameModuleProps } from '../platform/contract';

/**
 * Loaders for games with `runtime: { kind: 'module' }`. Each game is a separate lazy chunk, so the
 * homepage never downloads game code. Example:
 *
 *   'my-game': () => import('../games/my-game/Game'),
 *
 * The module's default export must be a React component that takes GameModuleProps.
 */
export type GameModuleLoader = () => Promise<{ default: ComponentType<GameModuleProps> }>;

export const GAME_MODULES: Record<string, GameModuleLoader> = {};
