import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import type { SigilEngine } from '../engine';
import { toLocal } from './turn';

/**
 * The left thumb's joystick: it appears where the thumb lands (or stays fixed), follows the thumb if it slides far,
 * and lets go on release, cancel or lost capture. The campaign, The Vigil and The Ring all use this one, with the
 * player's own settings for its size and feel.
 *
 * It must never stick. On an iPhone it did (the owner, in The Vigil: "the joystick became stucked to the right and i
 * couldnt move it at all"): a thumb's lift that the page is never told of (the phone takes a touch that starts at the
 * screen's edge for a gesture of its own, and the stick's zone begins at that edge) left the stick held hard over, and
 * because it was still "held" it turned every new thumb away. So, none of these relying on the others:
 * - the lift is listened for on the window too, not only on the zone that captured the thumb;
 * - every touch event anywhere carries the list of fingers really on the glass, and the stick believes that list over
 *   its own memory: when no finger that began on the zone is left on it, the stick lets go, whatever it was or wasn't
 *   told;
 * - a thumb that lands on a stick that turned out to be held by nobody takes it at once.
 * A second finger on a stick whose thumb really is still there doesn't take it over, as before.
 */
export function Stick({ settings: s, onMove }: { settings: Pick<SigilEngine['settings'], 'joystick' | 'joyMode' | 'deadzone' | 'sensitivity'>; onMove: (x: number, y: number) => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const st = useRef<{ id: number; bx: number; by: number; fresh: boolean } | null>(null);
  /** A finger the held stick turned away, until the fingers on the glass are counted (it may be the only one there). */
  const knock = useRef<{ id: number; x: number; y: number } | null>(null);
  const R = s.joystick;

  const place = (bx: number, by: number, kx: number, ky: number, active: boolean): void => {
    if (base.current) {
      base.current.style.transform = `translate(${bx - R}px, ${by - R}px)`;
      base.current.classList.toggle('is-active', active);
    }
    if (knob.current) knob.current.style.transform = `translate(${kx - 26}px, ${ky - 26}px)`;
  };
  const rest = (): void => {
    const z = zone.current;
    if (!z) return;
    const bx = R + 28;
    const by = z.clientHeight - R - 28;
    place(bx, by, bx, by, false);
  };
  // back to rest after a render only when no thumb is on it: the game redraws its controls often (a toast, a
  // cooldown), and putting the stick back under a moving thumb made it jump about and jitter
  useEffect(() => {
    if (!st.current) rest();
  });

  const update = (x: number, y: number): void => {
    const c = st.current;
    if (!c) return;
    let dx = x - c.bx;
    let dy = y - c.by;
    let d = Math.hypot(dx, dy);
    // a thumb that slides far drags the stick along with it
    if (s.joyMode === 'float' && d > R * 1.35) {
      const k = (d - R * 1.35) / d;
      c.bx += dx * k;
      c.by += dy * k;
      dx = x - c.bx;
      dy = y - c.by;
      d = Math.hypot(dx, dy);
    }
    const mag = Math.min(1, d / R);
    const dz = s.deadzone;
    let out = mag < dz ? 0 : (mag - dz) / (1 - dz);
    out = Math.min(1, out * s.sensitivity);
    onMove(d > 0 ? (dx / d) * out : 0, d > 0 ? (dy / d) * out : 0);
    const kd = Math.min(d, R);
    place(c.bx, c.by, c.bx + (d > 0 ? (dx / d) * kd : 0), c.by + (d > 0 ? (dy / d) * kd : 0), true);
  };

  /** A thumb takes the stick. `fresh`: its own landing has yet to be seen among the touches (see `counted`). */
  const begin = (id: number, x: number, y: number, fresh: boolean): void => {
    const z = zone.current;
    if (!z) return;
    try {
      z.setPointerCapture(id);
    } catch {
      // (a pointer that can't be captured still moves the stick while it is over the zone)
    }
    const fixed = s.joyMode === 'fixed';
    st.current = { id, bx: fixed ? R + 28 : x, by: fixed ? z.clientHeight - R - 28 : y, fresh };
    update(x, y);
  };
  const release = (): void => {
    st.current = null;
    onMove(0, 0);
    rest();
  };
  useEffect(() => {
    const off = (): void => release();
    const gone = (e: PointerEvent): void => {
      if (st.current && e.pointerId === st.current.id) release();
    };
    const counted = (e: TouchEvent): void => {
      const z = zone.current;
      const c = st.current;
      const k = knock.current;
      knock.current = null;
      if (!c || !z) return;
      // (the thumb it has only just taken: this is that thumb's own landing, and it is on the list as new)
      if (c.fresh && e.type === 'touchstart') {
        c.fresh = false;
        return;
      }
      // is a finger that began on the zone, and not this instant, still on the glass? (A touch's target is where it
      // began, wherever it has gone since.) Then the stick is held, and stays so
      const landing = e.type === 'touchstart' ? new Set(Array.from(e.changedTouches).map((t) => t.identifier)) : null;
      for (const t of Array.from(e.touches)) if (t.target instanceof Node && z.contains(t.target) && !landing?.has(t.identifier)) return;
      // nobody is: it lets go, and a thumb it turned away a moment ago has it
      release();
      if (k) begin(k.id, k.x, k.y, false);
    };
    window.addEventListener('blur', off);
    document.addEventListener('visibilitychange', off);
    window.addEventListener('pointerup', gone, true);
    window.addEventListener('pointercancel', gone, true);
    window.addEventListener('touchstart', counted, true);
    window.addEventListener('touchend', counted, true);
    window.addEventListener('touchcancel', counted, true);
    return () => {
      window.removeEventListener('blur', off);
      document.removeEventListener('visibilitychange', off);
      window.removeEventListener('pointerup', gone, true);
      window.removeEventListener('pointercancel', gone, true);
      window.removeEventListener('touchstart', counted, true);
      window.removeEventListener('touchend', counted, true);
      window.removeEventListener('touchcancel', counted, true);
    };
  });

  const down = (e: RPointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    // in the zone's own box (the game may be turned to landscape on a phone held upright: ui/turn.ts)
    const { x, y } = toLocal(zone.current!, e.clientX, e.clientY);
    // a second finger doesn't take a held stick... unless the count of fingers that follows shows nobody holds it
    if (st.current) {
      if (st.current.id !== e.pointerId) knock.current = { id: e.pointerId, x, y };
      return;
    }
    begin(e.pointerId, x, y, true);
  };
  const move = (e: RPointerEvent<HTMLDivElement>): void => {
    if (!st.current || e.pointerId !== st.current.id) return;
    const { x, y } = toLocal(zone.current!, e.clientX, e.clientY);
    update(x, y);
  };
  const up = (e: RPointerEvent<HTMLDivElement>): void => {
    if (st.current && e.pointerId === st.current.id) release();
  };

  return (
    <div className="rb-joyzone" ref={zone} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
      <div className="rb-joy" ref={base} style={{ width: R * 2, height: R * 2 }} />
      <div className="rb-knob" ref={knob} />
    </div>
  );
}
