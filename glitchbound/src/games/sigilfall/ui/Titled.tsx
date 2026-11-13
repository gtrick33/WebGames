import { TitleFx } from '../../../components/TitleFx';
import { rankTitle, titledParts, type TitleShown } from '../progress/titles';

/**
 * A name with its title, the title in its light (catalog/titleFx.ts): "Blooded Ash", "Ash the Kingslayer". Words alone
 * where there is no title; or, given `orRank` (the Ring's lobby), the rank reached in its place: "Unblooded Ash".
 */
export function Titled({ name, title: worn, orRank, className }: { name: string; title: TitleShown | null; orRank?: { at: number; name: string }; className?: string }) {
  const title = worn ?? (orRank ? rankTitle(orRank) : null);
  if (!title?.text) return <span className={className}>{name}</span>;
  const p = titledParts(name, title);
  return (
    <span className={className}>
      {p.before}
      <TitleFx fx={p.title.fx}>{p.title.text}</TitleFx>
      {p.after}
    </span>
  );
}
