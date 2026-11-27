/** A pal's portrait for the menus and the lobby: the in-game drawing on a small canvas. */
import { useEffect, useRef } from 'react';
import type { ColorId } from './critters';
import { drawPal } from './draw';

export function PalFace({ color, size = 44, flip = false }: { color: ColorId; size?: number; flip?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawPal(ctx, color, size / 2, size * 0.92, size * 0.95, { face: flip ? -1 : 1 });
  }, [color, size, flip]);
  return <canvas ref={ref} className="pri-face" style={{ width: size, height: size }} aria-hidden="true" />;
}
