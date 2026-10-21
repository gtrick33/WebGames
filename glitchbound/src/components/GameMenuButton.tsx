/**
 * The arcade's game menu (continue, exit full screen, exit game, report a bug) as a button that
 * lives inside a game's own UI, in its top row next to its other buttons. The arcade provides the
 * menu only in full screen (GameMenuContext, set by GameStage); outside full screen the button
 * renders nothing. Pass the game's own icon-button class so it looks like the game's buttons.
 */
import { createContext, useContext, type CSSProperties } from 'react';
import './GameMenuButton.css';

export const GameMenuContext = createContext<(() => void) | undefined>(undefined);

/** The open-menu function in full screen, else undefined (for games that need to know). */
export const useGameMenu = (): (() => void) | undefined => useContext(GameMenuContext);

export function GameMenuButton({ className = '', style, size = 18 }: { className?: string; style?: CSSProperties; size?: number }) {
  const open = useContext(GameMenuContext);
  if (!open) return null;
  return (
    <button
      type="button"
      className={className ? `game-menu-btn ${className}` : 'game-menu-btn is-plain'}
      style={style}
      // games that react to any tap (flap, shift) must not also get this one
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        open();
      }}
      aria-label="Game menu"
      title="Game menu"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
        {/* three dots, not a burger: many games already use a burger for their own menu */}
        <circle cx="12" cy="5.5" r="2.2" fill="currentColor" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <circle cx="12" cy="18.5" r="2.2" fill="currentColor" />
      </svg>
    </button>
  );
}
