import { useEffect, useState, type CSSProperties } from 'react';
import './Burst.css';

const COLORS = ['#c4f034', '#ffd12e', '#ff5a6c', '#12c6b3', '#2c45ff', '#ff6a1a'];
const SHAPES = ['sq', 'ci', 'tr'] as const;

function makePieces(): { style: CSSProperties; shape: (typeof SHAPES)[number] }[] {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
  return Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 120;
    return {
      shape: SHAPES[i % 3]!,
      style: {
        '--dx': `${Math.cos(angle) * dist}px`,
        '--dy': `${Math.sin(angle) * dist - 40}px`,
        '--rot': `${Math.random() * 540 - 270}deg`,
        background: COLORS[i % COLORS.length],
        animationDelay: `${Math.random() * 60}ms`,
      } as CSSProperties,
    };
  });
}

/**
 * A short, geometric confetti pop for personal bests and cleared dailies. Mount it with a new
 * `key` for each celebration. Skipped for reduced motion.
 */
export function Burst() {
  const [pieces, setPieces] = useState(makePieces);
  useEffect(() => {
    const t = window.setTimeout(() => setPieces([]), 1400);
    return () => window.clearTimeout(t);
  }, []);
  if (pieces.length === 0) return null;
  return (
    <div className="burst" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} className={`burst-p burst-${p.shape}`} style={p.style} />
      ))}
    </div>
  );
}
