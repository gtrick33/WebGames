import { CHUNK_ART, GroundPainter, type GroundSource } from './groundPaint';

/** Paints ground chunks off the main thread (see ground.ts). */

let painter: GroundPainter | null = null;

self.onmessage = (e: MessageEvent<{ type: 'init'; src: GroundSource } | { type: 'paint'; cx: number; cy: number }>) => {
  const m = e.data;
  if (m.type === 'init') painter = new GroundPainter(m.src);
  else if (painter) {
    const buf = new Uint8ClampedArray(CHUNK_ART * CHUNK_ART * 4);
    painter.paint(m.cx, m.cy, buf);
    (self as unknown as Worker).postMessage({ cx: m.cx, cy: m.cy, buf }, [buf.buffer]);
  }
};
