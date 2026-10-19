/** The label every listing of an adults-only game carries (`adult` in the registry). Pass the translated "Adults only". */
export function AdultLabel({ text = 'Adults only' }: { text?: string }) {
  return (
    <span className="adult-label">
      <b>18+</b>
      <span className="adult-label-text">{text}</span>
    </span>
  );
}
