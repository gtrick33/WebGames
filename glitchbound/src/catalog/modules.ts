import type { ComponentType } from 'react';
import type { GameModuleProps, GamePreviewProps } from '../platform/contract';

/**
 * Loaders for games with `runtime: { kind: 'module' }`. Each game is a separate lazy chunk, so the
 * homepage never downloads game code. Example:
 *
 *   'my-game': () => import('../games/my-game/Game'),
 *
 * The module's default export must be a React component that takes GameModuleProps.
 */
export type GameModuleLoader = () => Promise<{ default: ComponentType<GameModuleProps> }>;

export const GAME_MODULES: Record<string, GameModuleLoader> = {
  'memory-grid': () => import('../games/memory-grid/Game'),
  'color-recall': () => import('../games/color-recall/Game'),
  'letter-pinch': () => import('../games/letter-pinch/Game'),
  'mini-racer': () => import('../games/mini-racer/Game'),
  'color-lab': () => import('../games/color-lab/Game'),
  'spot-the-glitch': () => import('../games/spot-the-glitch/Game'),
  'wheres-the-ball': () => import('../games/wheres-the-ball/Game'),
  'wing-it': () => import('../games/wing-it/Game'),
  crosswire: () => import('../games/crosswire/Game'),
  'wait-what': () => import('../games/wait-what/Game'),
  'crass-act': () => import('../games/crass-act/Game'),
  'to-scale': () => import('../games/to-scale/Game'),
  'square-deal': () => import('../games/square-deal/Game'),
  'outta-here': () => import('../games/outta-here/Game'),
  gloop: () => import('../games/gloop/Game'),
  'gut-check': () => import('../games/gut-check/Game'),
  'star-grid': () => import('../games/star-grid/Game'),
  fussbox: () => import('../games/fussbox/Game'),
  whatsit: () => import('../games/whatsit/Game'),
};

/**
 * Optional looping previews shown on catalogue tiles and in the featured card (a small canvas
 * "attract mode", not the game itself). Lazy-loaded when the tile scrolls into view. Games without
 * one show their tile artwork.
 */
export type GamePreviewLoader = () => Promise<{ default: ComponentType<GamePreviewProps> }>;

export const GAME_PREVIEWS: Record<string, GamePreviewLoader> = {
  'neon-rush': () => import('../games/neon-rush/Preview'),
};
