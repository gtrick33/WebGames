/**
 * Small canvas portraits for the menus and the HUD, drawn with the same vector art as the battle:
 * a critter, a weapon, a terrain thumbnail.
 */
import { useEffect, useRef } from 'react';
import { CHARS, type CharId } from './characters';
import { drawWeapon } from './render/arms';
import { drawCritter } from './render/critters';
import { baseMask, H, W } from './terrain';
import { TERRAINS, type TerrainId } from './terrains';
import type { WeaponId } from './weapons';

function useCanvas(size: number, draw: (c: CanvasRenderingContext2D) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    const c = cv.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    draw(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function Portrait({ char, size = 56, flip = false, look = 0 }: { char: CharId; size?: number; flip?: boolean; look?: number }) {
  const ref = useCanvas(
    size,
    (c) => {
      const k = size / 34;
      c.translate(size / 2, size * 0.86);
      c.scale(flip ? -k : k, k);
      drawCritter(c, char, CHARS[char].color, { t: 0.4, walk: -1, air: false, look, weapon: null, hurt: 0, seed: 1 });
    },
    [char, size, flip, look],
  );
  return <canvas ref={ref} className="cc-portrait" style={{ width: size, height: size }} aria-label={CHARS[char].name} role="img" />;
}

const FIT: Record<WeaponId, [number, number, number]> = {
  rocket: [6, 0.5, 0.74],
  grenade: [8.6, -1.6, 1.42],
  splitter: [7.2, -1.8, 1.08],
  zapper: [8, 0.8, 0.86],
  mallet: [9.8, 0, 0.92],
  dynamite: [10.6, -3.4, 1.3],
  meteor: [6.2, -3.6, 1.14],
};

export function WeaponIcon({ w, size = 34 }: { w: WeaponId; size?: number }) {
  const ref = useCanvas(
    size,
    (c) => {
      // each weapon's middle and how much to enlarge it, so all fill the icon alike
      const [cx, cy, z] = FIT[w];
      c.translate(size / 2, size / 2);
      c.rotate(-0.35);
      c.scale((size / 24) * z, (size / 24) * z);
      c.translate(-cx, -cy);
      drawWeapon(c, w, 0.3);
    },
    [w, size],
  );
  return <canvas ref={ref} className="cc-wicon" style={{ width: size, height: size }} aria-hidden="true" />;
}

/** A small picture of a terrain: its sky, sun and a typical landform (seed 1). Built a moment later. */
export function TerrainThumb({ id, w = 132, h = 66, delay = 0 }: { id: TerrainId; w?: number; h?: number; delay?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const timer = window.setTimeout(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      cv.width = pw;
      cv.height = ph;
      const c = cv.getContext('2d');
      if (!c) return;
      const d = TERRAINS[id];
      const g = c.createLinearGradient(0, 0, 0, ph);
      g.addColorStop(0, d.sky[0]);
      g.addColorStop(0.6, d.sky[1]);
      g.addColorStop(1, d.sky[2]);
      c.fillStyle = g;
      c.fillRect(0, 0, pw, ph);
      if (d.sun.kind !== 'none' && d.sun.kind !== 'glow') {
        c.fillStyle = d.sun.kind === 'planet' ? d.sun.color : d.sun.color;
        c.beginPath();
        c.arc(d.sun.x * pw, d.sun.y * ph, ph * 0.1, 0, Math.PI * 2);
        c.fill();
      }
      const m = baseMask(1, id);
      const img = c.getImageData(0, 0, pw, ph);
      const hex = (s: string): number[] => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
      const top = hex(d.top.color);
      const soil = hex(d.soil.light);
      const dark = hex(d.soil.dark);
      const liquid = hex(d.liquid.top);
      const deep = hex(d.liquid.deep);
      const ly = (d.liquidY / H) * ph;
      for (let y = 0; y < ph; y++) {
        const wy = Math.min(H - 1, Math.floor((y / ph) * H));
        for (let x = 0; x < pw; x++) {
          const wx = Math.min(W - 1, Math.floor((x / pw) * W));
          const o = (y * pw + x) * 4;
          let col: number[] | null = null;
          if (m[wy * W + wx] === 1) {
            const above = Math.max(0, wy - Math.ceil((H / ph) * 1.5));
            const k = Math.min(1, Math.max(0, (wy - 250) / 600));
            col = m[above * W + wx] !== 1 ? top : soil.map((v, j) => v + (dark[j]! - v) * k);
          } else if (y >= ly) col = y < ly + 1.5 ? liquid : deep;
          if (col) {
            img.data[o] = col[0]!;
            img.data[o + 1] = col[1]!;
            img.data[o + 2] = col[2]!;
            img.data[o + 3] = 255;
          }
        }
      }
      c.putImageData(img, 0, 0);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [id, w, h, delay]);
  return <canvas ref={ref} className="cc-thumb" style={{ width: w, height: h }} aria-hidden="true" />;
}
