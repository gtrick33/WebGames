import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SigilEngine } from '../engine';
import { GROUND, PAINTABLE } from '../data/ground';
import { LAND_MAPS } from '../data/landmaps';
import { HAND_PLACED, type HandPlaced } from '../data/placed';
import { PROPS, propStandsUp } from '../data/props';
import type { PropFace } from '../data/types';
import { K, TILE } from '../sim/map';
import type { World } from '../sim/world';
import { useFrame } from './GameScreen';
import './PlaceEditor.css';

/**
 * The placement editor (POLISH_PLAN.md piece 15), on the dev server only, with `?place` in the address: set pieces are
 * placed into a land by hand and written to its data file (data/placed/<land>.json, by the dev server's
 * `sigilfall-placement-editor` in vite.config.ts), so they ship with the game.
 *
 * Walk the hero with the keys as ever; a click on the picture sets the chosen prop down on the tile under the
 * pointer, a right click (or Alt and a click) takes up what was placed there by hand. Each change is written at once
 * and the land is stood again where it is (World.remap), with nobody moved.
 *
 * Its Ground page paints a land's own map (every land hand-built, the owner's call of 2026-11-19): grass, roads,
 * water, trees, rocks and the rest, a brush of one, three or five tiles, dragged over the picture; a right click takes
 * up the ground under the pointer as the brush's. The land's rows are written to its map file, data/maps/<land>.json.
 */

/** The ground a prop may be set down on. Walls, water, doors and buildings are the land's own; a tree, a bush or a
 * rock gives way to what is placed there, as does what the land generated. */
const OPEN = new Set<number>([K.Floor, K.Deco, K.Path, K.Cobble, K.Sand, K.Tree, K.Bush, K.Rock, K.Bramble, K.Prop]);

const KIND_NAMES: Record<number, string> = Object.fromEntries(Object.entries(K).map(([name, v]) => [v, name.toLowerCase()]));

const FACES: { id: 's' | PropFace; label: string }[] = [
  { id: 's', label: 'S' },
  { id: 'w', label: 'W' },
  { id: 'n', label: 'N' },
  { id: 'e', label: 'E' },
];

/** All the props, by name. */
const NAMES = Object.keys(PROPS)
  .filter((n) => !!PROPS[n]!.m)
  .sort();

const GROUND_NAME: Record<string, string> = Object.fromEntries(GROUND.map((g) => [g.ch, g.name]));
/** Ground nobody walks through: never painted where someone or something stands. */
const SOLID_GROUND = new Set(GROUND.filter((g) => g.solid).map((g) => g.ch));
const BRUSHES = [1, 3, 5] as const;

interface Under {
  tx: number;
  ty: number;
  ok: boolean;
  what: string;
}

type Undo = { land: string; list: HandPlaced[] } | { land: string; rows: string[] };

/** A stroke of the ground brush: the rows before it, the rows as painted so far, and the tiles it has painted. */
interface Stroke {
  land: string;
  before: string[];
  rows: string[];
  tiles: Set<number>;
  /** Tiles it passed over and left, where someone or something stands. */
  kept: number;
}

/** What is at a tile: its ground, and anything standing there (what was placed by hand first). */
function underOf(w: World, tx: number, ty: number): Under | null {
  const m = w.map;
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null;
  const i = ty * m.w + tx;
  const hand = (HAND_PLACED[w.region.id] ?? []).find((p) => p.tx === tx && p.ty === ty);
  const there = m.markers.filter((pm) => pm.tx === tx && pm.ty === ty).map((pm) => (pm.marker.kind === 'prop' ? pm.marker.prop : pm.marker.kind));
  const ground = LAND_MAPS[w.region.id]?.map[ty]?.[tx];
  const kind = (ground && GROUND_NAME[ground]?.toLowerCase()) || KIND_NAMES[m.kind[i]!] || '?';
  const what = [kind, ...(hand ? [`by hand: ${hand.prop}`] : there.length ? [there.join(', ')] : [])].join(' · ');
  return { tx, ty, ok: OPEN.has(m.kind[i]!) || !!hand, what };
}

/** Whether anyone or anything stands on a tile: a person, a way out, a pack, a chest, a prop, the hero. */
function standsAt(w: World, tx: number, ty: number): boolean {
  if (Math.floor(w.player.x / TILE) === tx && Math.floor(w.player.y / TILE) === ty) return true;
  return w.map.markers.some((pm) => pm.tx === tx && pm.ty === ty) || (HAND_PLACED[w.region.id] ?? []).some((p) => p.tx === tx && p.ty === ty);
}

export default function PlaceEditor({ engine }: { engine: SigilEngine }) {
  const [on, setOn] = useState(true);
  const [page, setPage] = useState<'props' | 'ground'>('props');
  const [query, setQuery] = useState('');
  const [prop, setProp] = useState('barrel');
  const [face, setFace] = useState<'s' | PropFace>('s');
  const [solid, setSolid] = useState(propStandsUp('barrel'));
  const [ground, setGround] = useState('=');
  const [brush, setBrush] = useState<(typeof BRUSHES)[number]>(1);
  const [status, setStatus] = useState('');
  const [undos, setUndos] = useState<Undo[]>([]);
  const info = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGPolygonElement>(null);
  const paint = useRef<SVGPathElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const under = useRef<Under | null>(null);
  const stroke = useRef<Stroke | null>(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? NAMES.filter((n) => n.includes(q)) : NAMES).slice(0, 120);
  }, [query]);
  const reach = page === 'ground' ? (brush - 1) / 2 : 0;

  // the hero can't be hurt while a land is dressed: foes still come, as they would
  useFrame(engine, (w) => {
    if (on) w.player.iframe = Math.max(w.player.iframe, 0.5);
    // (the tile under the pointer, or the brush's square, outlined on the ground as the camera moves; and what a
    // stroke has painted so far, until it is let go)
    const u = under.current;
    const r = engine.renderer as SigilEngine['renderer'] | undefined;
    const box = svg.current?.getBoundingClientRect();
    if (!mark.current || !paint.current || !r || !box) return;
    const c = r.canvas.getBoundingClientRect();
    const at = (x: number, y: number): string => {
      const s = r.toScreenAt(x * TILE, y * TILE, 0);
      return `${(s.x + c.left - box.left).toFixed(1)},${(s.y + c.top - box.top).toFixed(1)}`;
    };
    const st = stroke.current;
    const W = w.map.w;
    const square = (x: number, y: number): string => `M${at(x, y)}L${at(x + 1, y)}L${at(x + 1, y + 1)}L${at(x, y + 1)}Z`;
    paint.current.setAttribute('d', st && on ? [...st.tiles].map((i) => square(i % W, Math.floor(i / W))).join('') : '');
    if (!u || !on) {
      mark.current.setAttribute('points', '');
      return;
    }
    mark.current.setAttribute('points', [at(u.tx - reach, u.ty - reach), at(u.tx + reach + 1, u.ty - reach), at(u.tx + reach + 1, u.ty + reach + 1), at(u.tx - reach, u.ty + reach + 1)].join(' '));
    mark.current.classList.toggle('is-bad', page === 'props' ? !u.ok : !LAND_MAPS[w.region.id]);
  });

  const tileAt = (e: ReactPointerEvent): Under | null => {
    const w = engine.world;
    const r = engine.renderer as SigilEngine['renderer'] | undefined;
    if (!w || !r) return null;
    const c = r.canvas.getBoundingClientRect();
    const p = r.toWorld(e.clientX - c.left, e.clientY - c.top, devicePixelRatio);
    return underOf(w, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
  };

  /** A land's list changed: kept, written to its file, and the land stood again. */
  const change = (land: string, list: HandPlaced[], before: HandPlaced[] | null): void => {
    const w = engine.world;
    if (!w) return;
    if (before) setUndos((u) => [...u, { land, list: before }]);
    if (list.length) HAND_PLACED[land] = list;
    else delete HAND_PLACED[land];
    if (w.region.id === land) w.remap();
    setStatus('Saving…');
    fetch(`/__sigilfall/placed?land=${land}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(list) })
      .then(async (res) => setStatus(res.ok ? `Saved data/placed/${land}.json (${list.length})` : `Not saved: ${await res.text()}`))
      .catch(() => setStatus('Not saved: the dev server is not answering'));
  };

  /** A land's rows changed: kept in its map, written to its file, and the land stood again on its new ground. */
  const repaint = (land: string, rows: string[], before: string[] | null, note = ''): void => {
    const w = engine.world;
    const file = LAND_MAPS[land];
    if (!w || !file) return;
    if (before) setUndos((u) => [...u, { land, rows: before }]);
    rows.forEach((row, y) => {
      file.map[y] = row;
    });
    // (painted, the land is worked by hand: its file says so, and the generator has no say in it any more)
    file.hand = true;
    if (w.region.id === land) w.remap();
    setStatus('Saving…');
    fetch(`/__sigilfall/landmap?land=${land}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows }) })
      .then(async (res) => setStatus(res.ok ? `Saved data/maps/${land}.json${note}` : `Not saved: ${await res.text()}`))
      .catch(() => setStatus('Not saved: the dev server is not answering'));
  };

  /** The brush laid on the tile under the pointer: every paintable tile of its square takes the chosen ground. */
  const brushAt = (w: World, u: Under): void => {
    const st = stroke.current;
    if (!st) return;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const x = u.tx + dx;
        const y = u.ty + dy;
        const row = st.rows[y];
        if (!row || x < 0 || x >= row.length) continue;
        const was = row[x]!;
        if (was === ground || !PAINTABLE.includes(was)) continue;
        // (a person, a way out or a chest is never walled in: solid ground goes round them)
        if (SOLID_GROUND.has(ground) && standsAt(w, x, y)) {
          st.kept++;
          continue;
        }
        st.rows[y] = row.slice(0, x) + ground + row.slice(x + 1);
        st.tiles.add(y * row.length + x);
      }
    }
  };

  const down = (e: ReactPointerEvent): void => {
    const w = engine.world;
    const u = tileAt(e);
    if (!w || !u) return;
    e.preventDefault();
    const land = w.region.id;
    if (page === 'ground') {
      const file = LAND_MAPS[land];
      if (!file) {
        setStatus(`${w.region.name} is laid out in code, not in a map file: its ground isn't painted here`);
        return;
      }
      const here = file.map[u.ty]?.[u.tx];
      if (e.button === 2 || e.altKey) {
        if (here && PAINTABLE.includes(here)) setGround(here);
        return;
      }
      if (e.button !== 0) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      stroke.current = { land, before: [...file.map], rows: [...file.map], tiles: new Set(), kept: 0 };
      brushAt(w, u);
      return;
    }
    const before = HAND_PLACED[land] ?? [];
    const rest = before.filter((p) => p.tx !== u.tx || p.ty !== u.ty);
    if (e.button === 2 || e.altKey) {
      if (rest.length !== before.length) change(land, rest, before);
      return;
    }
    if (e.button !== 0) return;
    if (!u.ok) {
      setStatus(`Not on ${u.what}: walls, water, doors and buildings are the land's own`);
      return;
    }
    change(land, [...rest, { tx: u.tx, ty: u.ty, prop, ...(face !== 's' ? { face } : {}), ...(solid ? { solid: true } : {}) }], before);
  };

  const move = (e: ReactPointerEvent): void => {
    const u = tileAt(e);
    under.current = u;
    if (info.current) info.current.textContent = u ? `${u.tx}, ${u.ty} · ${u.what}` : '';
    const w = engine.world;
    if (u && w && stroke.current && stroke.current.land === w.region.id && e.buttons & 1) brushAt(w, u);
  };

  /** The brush let go: what the stroke painted becomes the land's ground. */
  const up = (): void => {
    const st = stroke.current;
    stroke.current = null;
    if (!st) return;
    const note = st.kept ? ` · ${st.kept} tile(s) left where someone or something stands` : '';
    if (st.tiles.size) repaint(st.land, st.rows, st.before, note);
    else if (st.kept) setStatus(`Nothing painted${note}`);
  };

  const back = (): void => {
    const last = undos[undos.length - 1];
    if (!last) return;
    setUndos(undos.slice(0, -1));
    if ('rows' in last) repaint(last.land, last.rows, null);
    else change(last.land, last.list, null);
  };

  const w = engine.world;
  const land = w?.region.id ?? '';
  const count = (HAND_PLACED[land] ?? []).length;
  const def = PROPS[prop];
  return (
    <>
      {on && (
        <div
          className="rb-place-catch"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={() => {
            under.current = null;
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
      <svg className="rb-place-mark" ref={svg} aria-hidden="true">
        <path ref={paint} className="rb-place-paint" />
        <polygon ref={mark} />
      </svg>
      <div className="rb-place" role="dialog" aria-label="Placement editor">
        <div className="rb-place-head">
          <strong>Placement editor</strong>
          <label>
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> placing
          </label>
        </div>
        <div className="rb-place-land">
          {w?.region.name} <code>{land}</code> · {count} by hand{LAND_MAPS[land] ? '' : ' · map in code'}
        </div>
        <div className="rb-place-row rb-place-pages">
          <button className={page === 'props' ? 'is-on' : ''} onClick={() => setPage('props')}>
            Props
          </button>
          <button className={page === 'ground' ? 'is-on' : ''} onClick={() => setPage('ground')}>
            Ground
          </button>
        </div>
        <div className="rb-place-info" ref={info} />
        {page === 'props' ? (
          <>
            <input className="rb-place-find" placeholder="Find a prop" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="rb-place-list">
              {shown.map((n) => (
                <button
                  key={n}
                  className={n === prop ? 'is-on' : ''}
                  onClick={() => {
                    setProp(n);
                    setSolid(propStandsUp(n));
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="rb-place-chosen">
              <code>{prop}</code>
              {def && (
                <span>
                  {def.w ?? 26}×{def.d ?? 26}×{def.h ?? 26}
                  {def.flat ? ' flat' : ''}
                </span>
              )}
            </div>
            <div className="rb-place-row">
              <span>Faces</span>
              {FACES.map((f) => (
                <button key={f.id} className={f.id === face ? 'is-on' : ''} onClick={() => setFace(f.id)}>
                  {f.label}
                </button>
              ))}
              <label>
                <input type="checkbox" checked={solid} onChange={(e) => setSolid(e.target.checked)} /> solid
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="rb-place-ground">
              {GROUND.map((g) => (
                <button key={g.ch} className={g.ch === ground ? 'is-on' : ''} onClick={() => setGround(g.ch)} title={`${g.name} (${g.ch})`}>
                  <span className="rb-place-swatch" style={{ background: g.color }} />
                  {g.name}
                </button>
              ))}
            </div>
            <div className="rb-place-row">
              <span>Brush</span>
              {BRUSHES.map((b) => (
                <button key={b} className={b === brush ? 'is-on' : ''} onClick={() => setBrush(b)}>
                  {b}×{b}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="rb-place-row">
          <button onClick={back} disabled={!undos.length}>
            Undo
          </button>
          <span className="rb-place-status">{status}</span>
        </div>
        <p className="rb-place-help">
          {page === 'props'
            ? 'Click: set it down. Right click or Alt+click: take up what was placed by hand. Walk with the keys.'
            : 'Drag: paint. Right click or Alt+click: take up the ground there. Solid ground goes round anyone or anything standing. Walk with the keys.'}
        </p>
      </div>
    </>
  );
}
