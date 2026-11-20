import { useRef } from 'react';
import { NPCS } from '../data/quests';
import type { SigilEngine } from '../engine';
import { TILE } from '../sim/map';
import { objectiveTarget, objectiveTargets } from '../sim/objective';
import type { World } from '../sim/world';
import { useFrame } from './GameScreen';
import { useHudBox } from './hudBoxes';
import { drawMapIcon, type MapIcon } from './mapIcons';
import { groundOf, MAP_PX } from './Panels';
import { npcMark } from '../render/renderer';
import { FOG_CELL, fogSeen, type Fog } from '../progress/fog';

/**
 * A small, quiet map in the corner: the ground around the hero, the waystone, exits, vendors, chests,
 * nearby enemies and the quest marker (at the edge, pointing, when it is further away).
 */

/** Tiles shown across the minimap. */
const SPAN = 44;
/** Device-independent size of the minimap, in CSS pixels. */
const SIZE = 88;

const fogs = new WeakMap<Fog, { c: HTMLCanvasElement; count: number }>();

/** One pixel per fog cell: dark where unexplored (redrawn when more is seen). */
function fogLayer(fog: Fog): HTMLCanvasElement {
  let hit = fogs.get(fog);
  if (!hit) {
    const c = document.createElement('canvas');
    c.width = fog.w;
    c.height = fog.h;
    hit = { c, count: -1 };
    fogs.set(fog, hit);
  }
  if (hit.count !== fog.count) {
    hit.count = fog.count;
    const g = hit.c.getContext('2d')!;
    const img = g.createImageData(fog.w, fog.h);
    for (let i = 0; i < fog.cells.length; i++) {
      if (fog.cells[i]) continue;
      img.data[i * 4] = 13;
      img.data[i * 4 + 1] = 10;
      img.data[i * 4 + 2] = 24;
      img.data[i * 4 + 3] = 225;
    }
    g.putImageData(img, 0, 0);
  }
  return hit.c;
}

export function Minimap({ engine }: { engine: SigilEngine }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // (a spoken line written along the top of the picture stops short of the map: render/renderer.ts)
  const hud = useRef<HTMLButtonElement>(null);
  useHudBox(engine, 'map', hud);
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
    <button ref={hud} className="rb-minimap-hud" onClick={() => engine.openPanel('map')} aria-label="Map (opens the full map)">
      {/* (the land's name on a plate over the map, as a phone's map wears it) */}
      {engine.world && <span className="rb-minimap-name">{engine.world.region.name}</span>}
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
  // the land as the full map paints it (ui/Panels.tsx groundOf: grass with a grain, roads with their edges, woods as
  // crowns, roofs with a ridge), drawn smooth: one hand for both maps (POLISH_PLAN.md piece 11). It was one flat square
  // of color a tile, blown up
  g.imageSmoothingEnabled = true;
  g.drawImage(groundOf(w.map, w.region.theme), ox * MAP_PX, oy * MAP_PX, SPAN * MAP_PX, SPAN * MAP_PX, 0, 0, S, S);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  // the fog of war: what the hero has not been near yet stays dark (soft at its edge)
  if (!w.fog.all) {
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(fogLayer(w.fog), ox / FOG_CELL, oy / FOG_CELL, SPAN / FOG_CELL, SPAN / FOG_CELL, 0, 0, S, S);
    g.restore();
  }
  const seen = (x: number, y: number): boolean => fogSeen(w.fog, x / TILE, y / TILE);
  const at = (x: number, y: number): [number, number] => [(x / TILE - ox) * px, (y / TILE - oy) * px];
  const dot = (x: number, y: number, col: string, r: number): void => {
    const [sx, sy] = at(x, y);
    if (sx < -r || sy < -r || sx > S + r || sy > S + r) return;
    g.fillStyle = '#0d0a18';
    g.fillRect(Math.round(sx - r - 1), Math.round(sy - r - 1), r * 2 + 2, r * 2 + 2);
    g.fillStyle = col;
    g.fillRect(Math.round(sx - r), Math.round(sy - r), r * 2, r * 2);
  };
  const icon = (x: number, y: number, name: MapIcon): void => {
    if (!seen(x, y)) return;
    const [sx, sy] = at(x, y);
    if (sx < -12 || sy < -12 || sx > S + 12 || sy > S + 12) return;
    drawMapIcon(g, name, sx, sy, 2);
  };
  // enemies close by: small red dots (elites orange); a boss is a skull
  for (const e of w.enemies) {
    if (e.dead || e.dummy || e.boss || !seen(e.x, e.y)) continue;
    dot(e.x, e.y, e.elite.length ? '#ffb02e' : '#ff4a4a', 2);
  }
  for (const ch of w.chests) if (!ch.open) icon(ch.x, ch.y, 'chest');
  for (const x of w.exits) icon(x.x, x.y, x.door ? 'door' : 'road');
  for (const ws of w.waystones) icon(ws.x, ws.y, 'waystone');
  for (const n of w.npcs) icon(n.x, n.y, npcMark(w, n.id) ?? (NPCS[n.id]?.shop ? 'merchant' : 'person'));
  for (const e of w.enemies) if (e.boss && !e.dead) icon(e.x, e.y, 'boss');
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
  // every other quest, smaller and quieter, only where it is on the map (the rim points at the followed one alone)
  g.save();
  g.globalAlpha = 0.7;
  for (const o of objectiveTargets(w)) {
    if (o.quest === t?.quest) continue;
    const [sx, sy] = at(o.x, o.y);
    if (Math.hypot(sx - S / 2, sy - S / 2) > S / 2 - 12) continue;
    drawMapIcon(g, o.main ? 'quest' : 'questSide', sx, sy, 1);
  }
  g.restore();
  if (t) {
    let [sx, sy] = at(t.x, t.y);
    const cx = S / 2;
    const cy = S / 2;
    const rim = S / 2 - 12;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d > rim) {
      sx = cx + ((sx - cx) / d) * rim;
      sy = cy + ((sy - cy) / d) * rim;
    }
    // the quest's "!" (it breathes a little, so it is the first thing the eye finds)
    g.save();
    g.globalAlpha = 0.85 + Math.sin(performance.now() / 200) * 0.15;
    drawMapIcon(g, 'quest', sx, sy, 2);
    g.restore();
  }
  // a thin rim
  g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.stroke();
}
