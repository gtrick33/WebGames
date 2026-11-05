/**
 * Profile looks: borders around a member's picture and banners behind their name, on their profile and on the boards.
 * Each one is a shop item with the same id (src/catalog/shop.ts) and is drawn by src/components/Looks.css. They only
 * change how a member looks, never what they can do.
 */
export type LookKind = 'border' | 'banner';

export interface Look {
  id: string;
  kind: LookKind;
}

export const LOOKS: readonly Look[] = [
  { id: 'border-neon-halo', kind: 'border' },
  { id: 'border-solar-flare', kind: 'border' },
  { id: 'border-glitch', kind: 'border' },
  { id: 'banner-sunset-grid', kind: 'banner' },
  { id: 'banner-aurora', kind: 'banner' },
  { id: 'banner-nebula', kind: 'banner' },
];

export const isLook = (id: unknown, kind?: LookKind): id is string => typeof id === 'string' && LOOKS.some((l) => l.id === id && (!kind || l.kind === kind));

/** What a member wears. Empty means nothing. */
export interface Worn {
  border: string;
  banner: string;
}

export const WEARS_NOTHING: Worn = { border: '', banner: '' };

/** What a member chose, kept only where it's a look of that kind they still own (a refund takes it off). */
export function wornFrom(chosen: { border?: string | null; banner?: string | null }, owned: readonly string[]): Worn {
  const keep = (id: string | null | undefined, kind: LookKind): string => (isLook(id, kind) && owned.includes(id) ? id : '');
  return { border: keep(chosen.border, 'border'), banner: keep(chosen.banner, 'banner') };
}
