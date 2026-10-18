import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { GAME_PREVIEWS } from '../catalog/modules';
import type { GamePreviewProps } from '../platform/contract';
import { ErrorBoundary } from './ErrorBoundary';
import { fresh } from '../platform/freshBuild';

const LAZY: Record<string, ComponentType<GamePreviewProps>> = Object.fromEntries(Object.entries(GAME_PREVIEWS).map(([slug, load]) => [slug, lazy(fresh(load))]));

export function hasPreview(slug: string): boolean {
  return !!LAZY[slug];
}

/**
 * A game's looping preview, mounted only once its container is near the viewport (so previews
 * never cost anything above or below the fold). Falls back to nothing if the preview fails.
 */
export function GamePreview({ slug, playing = true, className }: { slug: string; playing?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const Preview = LAZY[slug];

  useEffect(() => {
    const el = ref.current;
    if (!el || !Preview) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [Preview]);

  if (!Preview) return null;
  return (
    <div ref={ref} className={`game-preview ${className ?? ''}`}>
      {near && (
        <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <Preview playing={playing} />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}
