import { TitleFx } from '../../../components/TitleFx';
import type { TitleShown } from '../progress/titles';

/**
 * A name on a Ring nameplate. With a title, the name and the title share its one line and roll up through it, one and
 * then the other, over and over, as a slot machine's reel turns (the owner: "if u have title, in the nameplates your
 * name is invisible, i was thinking of making a rolling carousel where it shows your name, the title and keeps rolling
 * indefinitely"). The name comes round again at the bottom, so the reel goes on with no jump back. For those who asked
 * for less motion the two simply take turns (Game.css). Without a title, the name as it always was.
 */
export function NameReel({ name, title }: { name: string; title?: TitleShown | null }) {
  if (!title) return <b>{name}</b>;
  return (
    <span className="rb-ring-reel">
      <span className="rb-ring-reel-track">
        <b>{name}</b>
        <small className="rb-ring-title">
          <TitleFx fx={title.fx}>{title.text}</TitleFx>
        </small>
        {/* (the name comes round again, so the reel turns on without a jump: said once is enough) */}
        <b aria-hidden="true">{name}</b>
      </span>
    </span>
  );
}
