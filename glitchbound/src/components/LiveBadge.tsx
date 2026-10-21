import { useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import './LiveBadge.css';

/** "Live multiplayer" on a game that friends can play together in a live room (see GameEntry.live). */
export function LiveBadge({ game, className = '' }: { game: GameEntry; className?: string }) {
  const t = useT();
  if (!game.live) return null;
  return (
    <span className={`live-badge ${className}`} title={t('Play live with friends, each on their own device ({n} players)', { n: game.live.players })}>
      <i aria-hidden="true" />
      {t('Live multiplayer')}
    </span>
  );
}
