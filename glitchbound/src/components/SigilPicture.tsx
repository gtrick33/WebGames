import { useEffect, useState } from 'react';
import { PRODUCTS } from '../catalog/shop';
import type { SigilSpec } from '../catalog/sigilItems';
import './SigilPicture.css';

/** The built-in Sigilfall items have their pictures made already (public/shop/sigilfall/), so the shop shows them at once. */
const MADE = new Set(PRODUCTS.filter((p) => p.sigil).map((p) => p.id));
export const madePicture = (id: string): string | null => (MADE.has(id) ? `/shop/sigilfall/${id.replace(/^sigilfall-/, '')}.webp` : null);
/** An item's made picture, or a pack's: the first of its pieces that has one. */
export const itemPicture = (p: { id: string; includes?: string[] }): string | null => madePicture(p.id) ?? (p.includes ?? []).map(madePicture).find((x) => x !== null) ?? null;

const canDraw = (): boolean => typeof window !== 'undefined' && typeof window.WebGLRenderingContext !== 'undefined';

/**
 * A Sigilfall item as the game draws it: its made picture, or (an item an admin made, or a preview while it's being
 * made) the game's own renderer, brought in only then, drawing it a moment after its last change.
 */
export function SigilPicture({ id, spec, size = 320, className = '' }: { id: string; spec: SigilSpec; size?: number; className?: string }) {
  const made = madePicture(id);
  const key = JSON.stringify(spec);
  const [drawn, setDrawn] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (made || !canDraw()) return;
    let live = true;
    const t = window.setTimeout(() => {
      import('../games/sigilfall/shopPicture')
        .then((m) => m.sigilPicture(JSON.parse(key) as SigilSpec, size))
        .then((url) => live && setDrawn({ key, url }))
        .catch(() => live && setDrawn({ key, url: null }));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [made, key, size]);
  const url = made ?? (drawn?.key === key ? drawn.url : undefined);
  const label = spec.kind === 'mount' ? 'The mount' : spec.slot === 'head' ? 'The helmet, worn' : 'The armor, worn';
  return (
    <div className={`sigil-pic ${spec.kind === 'mount' ? 'is-mount' : `is-${spec.slot}`} ${className}`}>
      {url ? <img src={url} alt={label} draggable={false} /> : <span className="info-small">{url === null || !canDraw() ? 'No picture here: it shows in the game.' : 'Drawing it…'}</span>}
    </div>
  );
}
