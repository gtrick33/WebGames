import './ResultLine.css';

/**
 * A game's spoiler-free emoji result (the same line its share text carries), shown big on its end
 * screen so players see exactly what their friends will get. `label` is the result in words for
 * screen readers.
 */
export function ResultLine({ line, label }: { line: string; label: string }) {
  return (
    <p className="result-line" role="img" aria-label={label}>
      {line}
    </p>
  );
}
