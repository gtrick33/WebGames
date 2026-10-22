import { useRef } from 'react';
import { NPCS } from '../data/quests';
import type { Theme } from '../data/types';
import type { SigilEngine } from '../engine';
import { K, TILE, type TileMap } from '../sim/map';
import { objectiveTarget } from '../sim/objective';
import type { World } from '../sim/world';
import { useFrame } from './GameScreen';

/**
 * A small, quiet map in the corner: the ground around the hero, the waystone, exits, vendors, chests,
 * nearby enemies and the quest marker (at the edge, pointing, when it is further away).
 */

/** Tiles shown across the minimap. */
const SPAN = 44;
/** Device-independent size of the minimap, in CSS pixels. */
const SIZE = 88;

const COLORS: Record<Theme, { floor: string; wall: string; path: string; cobble: string; water: string; solid: string }> = {
  village: { floor: '#3f7a3a', wall: '#1d3a22', path: '#a8885a', cobble: '#8a8a96', water: '#2f6cc0', solid: '#5a4434' },
  forest: { floor: '#356a3e', wall: '#12301c', path: '#86704c', cobble: '#7a7a86', water: '#245aa0', solid: '#2a4a30' },
  crypt: { floor: '#4e4c62', wall: '#16142a', path: '#5e5870', cobble: '#5e5870', water: '#24406a', solid: '#2a283e' },
};

const base = new WeakMap<TileMap, HTMLCanvasElement>();

/** One pixel per tile, colored by what the tile is. */
function baseLayer(map: TileMap, theme: Theme): HTMLCanvasElement {
  const hit = base.get(map);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = map.w;
  c.height = map.h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(map.w, map.h);
  const pal = COLORS[theme];
  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const cols = { floor: rgb(pal.floor), wall: rgb(pal.wall), path: rgb(pal.path), cobble: rgb(pal.cobble), water: rgb(pal.water), solid: rgb(pal.solid) };
  for (let i = 0; i < map.w * map.h; i++) {
    const k = map.kind[i];
    const col =
      k === K.Wall || k === K.Tree || k === K.Cracked || k === K.Illusion
        ? cols.wall
        : k === K.Path || k === K.Bridge
          ? cols.path
          : k === K.Cobble
            ? cols.cobble
            : k === K.Water
              ? cols.water
              : map.solid[i]
                ? cols.solid
                : cols.floor;
    img.data.set([col[0], col[1], col[2], 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  base.set(map, c);
  return c;
}

export function Minimap({ engine }: { engine: SigilEngine }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef(0);
  useFrame(engine, (w: World) => {
    const c = ref.current;
    if (!c) return;
    const now = performance.now();
    if (now - last.current < 90) return;
    last.current = now;
    draw(c, w);
  });
  return (
    <button className="rb-minimap-hud" onClick={() => engine.openPanel('map')} aria-label="Map (opens the full map)">
      <canvas ref={ref} width={SIZE * 2} height={SIZE * 2} />
    </button>
  );
}

function draw(c: HTMLCanvasElement, w: World): void {
  const g = c.getContext('2d')!;
  const S = c.width;
  const px = S / SPAN;
  const p = w.player;
  const ox = p.x / TILE - SPAN / 2;
  const oy = p.y / TILE - SPAN / 2;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, S, S);
  g.save();
  // round window
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#0d0a18';
  g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.92;
  g.drawImage(baseLayer(w.map, w.region.theme), ox, oy, SPAN, SPAN, 0, 0, S, S);
  g.globalAlpha = 1;
  const at = (x: number, y: number): [number, number] => [(x / TILE - ox) * px, (y / TILE - oy) * px];
  const dot = (x: number, y: number, col: string, r: number): void => {
    const [sx, sy] = at(x, y);
    if (sx < -r || sy < -r || sx > S + r || sy > S + r) return;
    g.fillStyle = '#0d0a18';
    g.fillRect(Math.round(sx - r - 1), Math.round(sy - r - 1), r * 2 + 2, r * 2 + 2);
    g.fillStyle = col;
    g.fillRect(Math.round(sx - r), Math.round(sy - r), r * 2, r * 2);
  };
  // enemies close by: small red dots, bosses bigger
  for (const e of w.enemies) {
    if (e.dead || e.dummy) continue;
    dot(e.x, e.y, e.boss ? '#ff3fd2' : e.elite.length ? '#ffb02e' : '#ff4a4a', e.boss ? 4 : 2);
  }
  for (const ch of w.chests) if (!ch.open) dot(ch.x, ch.y, '#ffcf5a', 3);
  for (const x of w.exits) dot(x.x, x.y, '#ff3fd2', 4);
  for (const ws of w.waystones) dot(ws.x, ws.y, '#22e4ff', 4);
  for (const n of w.npcs) dot(n.x, n.y, NPCS[n.id]?.shop ? '#ffd84d' : '#ffffff', 3);
  g.restore();
  // the hero, pointing where they face
  g.save();
  g.translate(S / 2, S / 2);
  g.rotate(p.aim);
  g.fillStyle = '#0d0a18';
  g.beginPath();
  g.moveTo(9, 0);
  g.lineTo(-6, -7);
  g.lineTo(-3, 0);
  g.lineTo(-6, 7);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(7, 0);
  g.lineTo(-4, -5);
  g.lineTo(-2, 0);
  g.lineTo(-4, 5);
  g.closePath();
  g.fill();
  g.restore();
  // the quest marker: on the map when it fits, on the rim pointing at it otherwise
  const t = objectiveTarget(w);
  if (t) {
    let [sx, sy] = at(t.x, t.y);
    const cx = S / 2;
    const cy = S / 2;
    const rim = S / 2 - 9;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d > rim) {
      sx = cx + ((sx - cx) / d) * rim;
      sy = cy + ((sy - cy) / d) * rim;
    }
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;
    g.save();
    g.translate(sx, sy);
    g.scale(pulse, pulse);
    g.fillStyle = '#0d0a18';
    g.beginPath();
    g.moveTo(0, -9);
    g.lineTo(8, 0);
    g.lineTo(0, 9);
    g.lineTo(-8, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffe066';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(5.5, 0);
    g.lineTo(0, 6);
    g.lineTo(-5.5, 0);
    g.closePath();
    g.fill();
    g.restore();
  }
  // a thin rim
  g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.stroke();
}
