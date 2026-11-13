import type { ReactNode } from 'react';
import { titleFx } from '../catalog/titleFx';
import './TitleFx.css';

/**
 * A Sigilfall title in its light (src/catalog/titleFx.ts): the words, with the effect drawn over them. The same here,
 * in the game and on the admin page, where an admin choosing one for a title they give sees it as the player will.
 */
export function TitleFx({ fx, children, className }: { fx: string | null | undefined; children: ReactNode; className?: string }) {
  const def = titleFx(fx);
  return <span className={`tfx tfx-${def.id}${className ? ` ${className}` : ''}`}>{children}</span>;
}
