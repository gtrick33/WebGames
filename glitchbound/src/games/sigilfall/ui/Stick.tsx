import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import type { SigilEngine } from '../engine';
import { toLocal } from './turn';

/**
 * The left thumb's joystick: it appears where the thumb lands (or stays fixed), follows the thumb if it slides far,
 * and lets go on release, cancel or lost capture, so it never sticks. The campaign, The Vigil and The Ring all use this
 * one, with the player's own settings for its size and feel.
 */
export function Stick({ settings: s, onMove }: { settings: Pick<SigilEngine['settings'], 'joystick' | 'joyMode' | 'deadzone' | 'sensitivity'>; onMove: (x: number, y: number) => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const st = useRef<{ id: number; bx: number; by: number } | null>(null);
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

  const release = (): void => {
    st.current = null;
    onMove(0, 0);
    rest();
  };
  useEffect(() => {
    const off = (): void => release();
    window.addEventListener('blur', off);
    document.addEventListener('visibilitychange', off);
    return () => {
      window.removeEventListener('blur', off);
      document.removeEventListener('visibilitychange', off);
    };
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

  const down = (e: RPointerEvent<HTMLDivElement>): void => {
    if (st.current || e.pointerType === 'mouse') return;
    e.preventDefault();
    const z = zone.current!;
    z.setPointerCapture(e.pointerId);
    // in the zone's own box (the game may be turned to landscape on a phone held upright: ui/turn.ts)
    const { x, y } = toLocal(z, e.clientX, e.clientY);
    const fixed = s.joyMode === 'fixed';
    st.current = { id: e.pointerId, bx: fixed ? R + 28 : x, by: fixed ? z.clientHeight - R - 28 : y };
    update(x, y);
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
