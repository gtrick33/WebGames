import type { ReactNode } from 'react';
import type { Item, Rarity } from '../data/types';
import { itemIconUrl, portraitUrl, skillIconUrl } from '../render/sprites';
import { rarityColor } from '../render/renderer';

/** Small shared pieces of the Riftbound UI. */

export const RARITY_NAME: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

export function ItemIcon({ item, size = 44, label }: { item: Item; size?: number; label?: string }) {
  return (
    <span className={`rb-itemicon is-${item.r}`} style={{ width: size, height: size, ['--rc' as string]: rarityColor(item.r) }}>
      <img src={itemIconUrl(item, 4)} alt={label ?? ''} width={size - 8} height={size - 8} draggable={false} />
      {item.fresh && <i className="rb-new" aria-label="New" />}
    </span>
  );
}

export function SkillIcon({ id, size = 40 }: { id: string; size?: number }) {
  return <img className="rb-skillicon" src={skillIconUrl(id, 4)} alt="" width={size} height={size} draggable={false} />;
}

export function Portrait({ kind, id, size = 48 }: { kind: 'hero' | 'creature'; id: string; size?: number }) {
  return <img className="rb-portrait" src={portraitUrl(kind, id, 4)} alt="" style={{ height: size }} draggable={false} />;
}

/** A framed panel in the game's style. */
export function Frame({ title, onClose, children, wide, className = '' }: { title: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={`rb-frame${wide ? ' is-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="rb-frame-head">
        <h2>{title}</h2>
        {onClose && (
          <button className="rb-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
      </header>
      <div className="rb-frame-body">{children}</div>
    </div>
  );
}

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

export function Bar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  return (
    <span className="rb-bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <i style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`, background: color }} />
    </span>
  );
}
