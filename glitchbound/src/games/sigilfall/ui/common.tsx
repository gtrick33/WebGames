import type { ReactNode } from 'react';
import type { ClassId, Item, Rarity } from '../data/types';
import type { Character } from '../progress/character';
import { heroLook, heroPortraitUrl, itemIconUrl, portraitUrl, skillIconUrl } from '../render/sprites';
import { rarityColor } from '../render/renderer';

/** Small shared pieces of the Sigilfall UI. */

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

/** A portrait; for a hero, pass their gear to show what they wear. */
export function Portrait({ kind, id, size = 48, equip }: { kind: 'hero' | 'creature' | 'npc'; id: string; size?: number; equip?: Character['equip'] }) {
  const src = kind === 'hero' && equip ? heroPortraitUrl(heroLook(id as ClassId, equip), 3) : portraitUrl(kind, id, 4);
  return <img className="rb-portrait" src={src} alt="" style={{ height: size }} draggable={false} />;
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

/** Seconds as m:ss. */
export const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

export function Bar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  return (
    <span className="rb-bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <i style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`, background: color }} />
    </span>
  );
}
