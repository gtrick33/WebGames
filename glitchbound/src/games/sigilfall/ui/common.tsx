import type { Face } from '../progress/character';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { ClassId, Item, Rarity } from '../data/types';
import type { Character } from '../progress/character';
import { heroLook, heroPortraitUrl, itemIconUrl, portraitUrl, skillIconUrl, type WornLooks, hasPersonLook } from '../render/sprites';
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
export function Portrait({ kind, id, size = 48, equip, worn, body, face }: { face?: Face; kind: 'hero' | 'creature' | 'npc'; id: string; size?: number; equip?: Character['equip']; worn?: WornLooks; body?: Character['body'] }) {
  const src = kind === 'hero' && (equip || body) ? heroPortraitUrl(heroLook(id as ClassId, equip ?? {}, worn, body, face), 3) : portraitUrl(kind, id, 4);
  // people (heroes, townsfolk) are drawn smooth like the world's figures; creatures stay crisp pixel art
  const smooth = kind === 'hero' || (kind === 'npc' && hasPersonLook(id));
  return <img className={`rb-portrait${smooth ? ' is-smooth' : ''}`} src={src} alt="" style={{ height: size }} draggable={false} />;
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** A framed panel in the game's style: focus moves into it (its open tab, else Close), stays there, and goes back when it closes. */
export function Frame({ title, onClose, children, wide, className = '', label }: { title: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? el.querySelector<HTMLElement>('.rb-frame-head .rb-x') ?? el).focus({ preventScroll: true });
    return () => {
      // back to where the keys were, if that was another panel or a conversation. Not to a button of the HUD: the
      // button that opened the panel kept the keys once it was shut, and the next press of Space (the dodge) pressed
      // that button and opened the panel again (the owner: "when you close the menu, if i hit space, it opens the menu
      // again ... unfocus them on close"). There the keys go back to the game
      if (before && before !== document.body && before.isConnected && before.closest('.rb-frame, .rb-dialogue, .rb-modal')) {
        before.focus({ preventScroll: true });
        return;
      }
      const a = document.activeElement;
      if (a instanceof HTMLElement && a !== document.body) a.blur();
    };
  }, []);
  // Tab and Shift+Tab go round the panel's own controls
  const trap = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.getClientRects().length > 0);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div ref={ref} tabIndex={-1} onKeyDown={trap} className={`rb-frame${wide ? ' is-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : undefined)}>
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
