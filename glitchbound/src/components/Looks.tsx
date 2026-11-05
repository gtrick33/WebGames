import { isLook } from '../catalog/looks';
import { Avatar } from './Avatar';
import './Looks.css';

/**
 * A member's picture in the border they wear (src/catalog/looks.ts), or the plain picture without one. The border is
 * drawn inside the same size, so it never moves the layout. Kept apart from Avatar so the header loads none of it.
 */
export function LookAvatar({ name, src, size = 36, border }: { name: string; src?: string; size?: number; border?: string }) {
  if (!isLook(border, 'border')) return <Avatar name={name} src={src} size={size} />;
  return (
    <span className={`avatar-frame look-${border}`} style={{ width: size, height: size, ['--s' as string]: `${size}px` }} aria-hidden="true">
      <span className="frame-ring" />
      <span className="frame-fx" />
      <Avatar name={name} src={src} size={Math.round(size * 0.78)} />
    </span>
  );
}

/** A banner a member owns, as art behind something. `row` keeps text on top of it readable. */
export function Banner({ id, row = false, className = '' }: { id: string; row?: boolean; className?: string }) {
  if (!isLook(id, 'banner')) return null;
  return (
    <span className={`look-banner look-${id}${row ? ' is-row' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      {row && <b />}
    </span>
  );
}
