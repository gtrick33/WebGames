import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SigilEngine } from '../engine';
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

interface Under {
  tx: number;
  ty: number;
  ok: boolean;
  what: string;
}

/** What is at a tile: its ground, and anything standing there (what was placed by hand first). */
function underOf(w: World, tx: number, ty: number): Under | null {
  const m = w.map;
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null;
  const i = ty * m.w + tx;
  const hand = (HAND_PLACED[w.region.id] ?? []).find((p) => p.tx === tx && p.ty === ty);
  const there = m.markers.filter((pm) => pm.tx === tx && pm.ty === ty).map((pm) => (pm.marker.kind === 'prop' ? pm.marker.prop : pm.marker.kind));
  const what = [KIND_NAMES[m.kind[i]!] ?? '?', ...(hand ? [`by hand: ${hand.prop}`] : there.length ? [there.join(', ')] : [])].join(' · ');
  return { tx, ty, ok: OPEN.has(m.kind[i]!) || !!hand, what };
}

export default function PlaceEditor({ engine }: { engine: SigilEngine }) {
  const [on, setOn] = useState(true);
  const [query, setQuery] = useState('');
  const [prop, setProp] = useState('barrel');
  const [face, setFace] = useState<'s' | PropFace>('s');
  const [solid, setSolid] = useState(propStandsUp('barrel'));
  const [status, setStatus] = useState('');
  const [undos, setUndos] = useState<{ land: string; list: HandPlaced[] }[]>([]);
  const info = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGPolygonElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const under = useRef<Under | null>(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? NAMES.filter((n) => n.includes(q)) : NAMES).slice(0, 120);
  }, [query]);

  // the hero can't be hurt while a land is dressed: foes still come, as they would
  useFrame(engine, (w) => {
    if (on) w.player.iframe = Math.max(w.player.iframe, 0.5);
    // (the tile under the pointer, outlined on the ground as the camera moves)
    const u = under.current;
    const r = engine.renderer as SigilEngine['renderer'] | undefined;
    const box = svg.current?.getBoundingClientRect();
    if (!mark.current || !r || !box) return;
    if (!u || !on) {
      mark.current.setAttribute('points', '');
      return;
    }
    const c = r.canvas.getBoundingClientRect();
    const pts = [
      [u.tx, u.ty],
      [u.tx + 1, u.ty],
      [u.tx + 1, u.ty + 1],
      [u.tx, u.ty + 1],
    ].map(([x, y]) => {
      const s = r.toScreenAt(x! * TILE, y! * TILE, 0);
      return `${(s.x + c.left - box.left).toFixed(1)},${(s.y + c.top - box.top).toFixed(1)}`;
    });
    mark.current.setAttribute('points', pts.join(' '));
    mark.current.classList.toggle('is-bad', !u.ok);
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

  const down = (e: ReactPointerEvent): void => {
    const w = engine.world;
    const u = tileAt(e);
    if (!w || !u) return;
    e.preventDefault();
    const land = w.region.id;
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
  };

  const back = (): void => {
    const last = undos[undos.length - 1];
    if (!last) return;
    setUndos(undos.slice(0, -1));
    change(last.land, last.list, null);
  };

  const w = engine.world;
  const land = w?.region.id ?? '';
  const count = (HAND_PLACED[land] ?? []).length;
  const def = PROPS[prop];
  return (
    <>
      {on && <div className="rb-place-catch" onPointerDown={down} onPointerMove={move} onPointerLeave={() => {
            under.current = null;
          }} onContextMenu={(e) => e.preventDefault()} />}
      <svg className="rb-place-mark" ref={svg} aria-hidden="true">
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
          {w?.region.name} <code>{land}</code> · {count} by hand
        </div>
        <div className="rb-place-info" ref={info} />
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
        <div className="rb-place-row">
          <button onClick={back} disabled={!undos.length}>
            Undo
          </button>
          <span className="rb-place-status">{status}</span>
        </div>
        <p className="rb-place-help">Click: set it down. Right click or Alt+click: take up what was placed by hand. Walk with the keys.</p>
      </div>
    </>
  );
}
