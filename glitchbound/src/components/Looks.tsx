import { lookOf, lookVars, type LookSpec } from '../catalog/looks';
import { PRODUCTS, type Product } from '../catalog/shop';
import { useLiveCatalog } from '../platform/liveCatalog';
import { Avatar } from './Avatar';
import { LookIcon } from './LookIcons';
import './Looks.css';

/**
 * Profile looks on screen (src/catalog/looks.ts). A look is a style plus colors, so the same components draw the
 * built-in looks and the ones an admin makes. Kept apart from Avatar so the header loads none of it until a member
 * wears a look.
 */

/** The shop's items, whose looks say how each id is drawn (the live list, so an admin's new look works at once). */
export const useLookItems = (): readonly Product[] => useLiveCatalog().raw.shopItems ?? PRODUCTS;

const vars = (spec: LookSpec, more: Record<string, string> = {}): Record<string, string> => ({ ...more, ...lookVars(spec) });

/** A profile icon as a round picture of `size` pixels. */
export function IconFace({ spec, size }: { spec: LookSpec; size: number }) {
  return (
    <span className={`avatar avatar-icon look-icon-${spec.style}`} style={{ width: size, height: size, ...vars(spec) }} aria-hidden="true">
      <LookIcon style={spec.style} />
    </span>
  );
}

/** A picture (or an icon in its place), in a border when there is one. The border is drawn inside `size`. */
export function FramedAvatar({ name, src, size, border, icon }: { name: string; src?: string; size: number; border?: LookSpec; icon?: LookSpec }) {
  const inner = border ? Math.round(size * 0.78) : size;
  const face = icon ? <IconFace spec={icon} size={inner} /> : <Avatar name={name} src={src} size={inner} />;
  if (!border) return face;
  return (
    <span className={`avatar-frame look-border-${border.style}`} style={{ width: size, height: size, ...vars(border, { '--s': `${size}px` }) }} aria-hidden="true">
      <span className="frame-ring" />
      <span className="frame-fx" />
      {face}
    </span>
  );
}

/** A member's picture with the border and icon they wear, by their shop ids. */
export function LookAvatar({ name, src, size = 36, border, icon }: { name: string; src?: string; size?: number; border?: string; icon?: string }) {
  const items = useLookItems();
  const b = lookOf(border, items);
  const i = lookOf(icon, items);
  return <FramedAvatar name={name} src={src} size={size} border={b?.kind === 'border' ? b : undefined} icon={i?.kind === 'icon' ? i : undefined} />;
}

/** A banner as art behind something. `row` keeps text on top of it readable. */
export function BannerArt({ spec, row = false, className = '' }: { spec: LookSpec; row?: boolean; className?: string }) {
  return (
    <span className={`look-banner look-banner-${spec.style}${row ? ' is-row' : ''}${className ? ` ${className}` : ''}`} style={vars(spec)} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      {row && <b />}
    </span>
  );
}

/** The banner a member wears, by its shop id. */
export function Banner({ id, row = false, className = '' }: { id: string; row?: boolean; className?: string }) {
  const spec = lookOf(id, useLookItems());
  return spec?.kind === 'banner' ? <BannerArt spec={spec} row={row} className={className} /> : null;
}
