import { dist } from '../core/math';
import { QUEST_DEFS } from '../data/quests';
import { TILE } from './map';
import type { World } from './world';

/**
 * Where the hero's quests want them to go in the current region: a place (a boss, an exit, the
 * waystone, the next sealed room) or, for hunting quests, the nearest fitting enemy (`soft`: shown on
 * the minimap, not pointed at from the edge of the screen).
 */
export interface Objective {
  x: number;
  y: number;
  soft: boolean;
}

export function objectiveTarget(w: World): Objective | null {
  const h = w.hero;
  const here = w.region.id;
  const place = (x: number, y: number): Objective => ({ x, y, soft: false });
  const markerOf = (pred: (m: (typeof w.map.markers)[number]) => boolean): Objective | null => {
    const m = w.map.markers.find(pred);
    return m ? place((m.tx + 0.5) * TILE, (m.ty + 0.5) * TILE) : null;
  };
  const exitTo = (to: string): Objective | null => {
    const x = w.exits.find((e) => e.to === to);
    return x ? place(x.x, x.y) : null;
  };
  const nearest = (pred: (e: World['enemies'][number]) => boolean): Objective | null => {
    let best: Objective | null = null;
    let bd = Infinity;
    for (const e of w.enemies) {
      if (e.dead || e.dummy || !pred(e)) continue;
      const d = dist(e.x, e.y, w.player.x, w.player.y);
      if (d < bd) {
        bd = d;
        best = { x: e.x, y: e.y, soft: true };
      }
    }
    return best;
  };
  const active = Object.entries(h.quests).filter(([, s]) => s.state === 'active').map(([id]) => QUEST_DEFS[id]!);
  for (const q of active) {
    const o = q.objective;
    if (o.kind === 'tutorial' && here === 'emberwick') {
      const d = w.enemies.find((e) => e.dummy === (o.step === 'dodge' ? 2 : 1));
      if (d) return place(d.x, d.y);
    }
    if (o.kind === 'kill' || o.kind === 'collect') {
      if (here === 'emberwick' && h.unlocked.includes('whisperwood')) {
        const ws = w.waystones[0];
        if (ws) return place(ws.x, ws.y);
      }
      if (o.kind === 'kill' && here === o.region) {
        const t = nearest(() => true);
        if (t) return t;
      }
      if (o.kind === 'collect' && here === 'whisperwood') {
        const t = nearest((e) => e.elite.length > 0);
        if (t) return t;
      }
    }
    if (o.kind === 'boss') {
      if (here === 'emberwick') {
        const ws = w.waystones[0];
        if (ws) return place(ws.x, ws.y);
      }
      if (o.boss === 'grimtusk' && here === 'whisperwood') return markerOf((pm) => pm.marker.kind === 'boss');
      if ((o.boss === 'ossric' || o.boss === 'morgrave') && here === 'whisperwood' && h.unlocked.includes('crypt')) return exitTo('crypt');
      if (here === 'crypt') return markerOf((pm) => pm.marker.kind === 'boss' && pm.marker.boss === o.boss);
    }
    if (o.kind === 'clear' && here === 'crypt') {
      // the next room still to fight, then the sanctum
      const enc = w.encounters.find((e) => e.state !== 'cleared');
      const tiles = enc ? (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]) : [];
      const i = tiles[Math.floor(tiles.length / 2)];
      if (i !== undefined) return place(((i % w.map.w) + 0.5) * TILE, (Math.floor(i / w.map.w) + 0.5) * TILE);
    }
    // the hidden grove stays a secret: no marker
  }
  if (w.portal) return place(w.portal.x, w.portal.y);
  return null;
}
