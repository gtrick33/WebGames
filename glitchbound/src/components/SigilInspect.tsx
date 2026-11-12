import { useEffect, useRef, useState } from 'react';
import type { SigilSpec } from '../catalog/sigilItems';
import './SigilPicture.css';

const FRAMES = 24;

/**
 * A Sigilfall item turning on a stand, to look it over before buying: the game's own model drawn all the way round
 * (brought in only when asked for, since it brings the game's renderer), turning slowly by itself until it's dragged,
 * or turned with the arrow keys. Closes on Escape, the button, or a click outside it.
 */
export function SigilInspect({ spec, name, hint, close, onClose }: { spec: SigilSpec; name: string; hint: string; close: string; onClose: () => void }) {
  const [shots, setShots] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(0);
  const drag = useRef<{ x: number; at: number } | null>(null);
  // (inside Sigilfall on an upright phone the game is turned a quarter: a drag along the item runs down the screen)
  const along = (e: { clientX: number; clientY: number; currentTarget: Element }): number => (e.currentTarget.closest('.is-turned') ? e.clientY : e.clientX);
  const touched = useRef(false);
  const shut = useRef<HTMLButtonElement>(null);
  const size = spec.kind === 'mount' ? 420 : 380;

  useEffect(() => {
    let live = true;
    const got: string[] = [];
    import('../games/sigilfall/shopPicture')
      .then((m) =>
        m.sigilSpin(
          spec,
          size,
          FRAMES,
          (i, url) => {
            got[i] = url;
            if (live) setShots([...got]);
          },
          () => live,
        ),
      )
      .then((ok) => live && !ok && setFailed(true))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [spec, size]);

  // turning by itself, slowly, until someone takes hold of it
  const ready = shots.filter(Boolean).length === FRAMES;
  useEffect(() => {
    if (!ready) return;
    const t = window.setInterval(() => {
      if (!touched.current && !drag.current) setAt((a) => (a + 1) % FRAMES);
    }, 140);
    return () => window.clearInterval(t);
  }, [ready]);

  useEffect(() => {
    shut.current?.focus();
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        touched.current = true;
        setAt((a) => (a + (e.key === 'ArrowLeft' ? -1 : 1) + FRAMES) % FRAMES);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  // (a frame not drawn yet shows the nearest one that is)
  const shown = shots[at] ?? shots.find(Boolean);
  return (
    <div className="sigil-inspect-wrap" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <div className="sigil-inspect" onClick={(e) => e.stopPropagation()}>
        <div className="sigil-inspect-head">
          <h2>{name}</h2>
          <button ref={shut} type="button" className="btn" onClick={onClose}>
            {close}
          </button>
        </div>
        <div
          className={`sigil-pic sigil-inspect-stage ${spec.kind === 'mount' ? 'is-mount' : `is-${spec.slot}`}`}
          onPointerDown={(e) => {
            touched.current = true;
            drag.current = { x: along(e), at };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const step = Math.round((along(e) - d.x) / 14);
            setAt((((d.at - step) % FRAMES) + FRAMES) % FRAMES);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {shown ? <img src={shown} alt="" draggable={false} /> : <span className="info-small">{failed ? 'No picture here: it shows in the game.' : 'Drawing it…'}</span>}
        </div>
        <p className="info-small sigil-inspect-hint">{hint}</p>
      </div>
    </div>
  );
}
