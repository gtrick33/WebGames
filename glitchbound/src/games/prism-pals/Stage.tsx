/**
 * A level on screen, for solo play and live rooms alike: the canvas (fixed-step loop, crisp on high-DPI
 * screens), the keyboard and the touch buttons, the pal switcher and the top bar. The level itself is a
 * Coop (net.ts): offline it is the host of a room of one.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { PALS } from './critters';
import type { Clear, Coop } from './net';
import { fit, Renderer } from './render';
import { gemsTaken, IN_ACT, IN_JUMP, IN_LEFT, IN_RIGHT, seconds, STEP } from './sim';
import type { Sfx } from './sound';
import { PalFace } from './PalFace';

const KEYS: Record<string, number> = { ArrowLeft: IN_LEFT, KeyA: IN_LEFT, ArrowRight: IN_RIGHT, KeyD: IN_RIGHT, ArrowUp: IN_JUMP, KeyW: IN_JUMP, Space: IN_JUMP, ArrowDown: IN_ACT, KeyS: IN_ACT, KeyE: IN_ACT };
const TOP = 46;

export interface StageProps {
  coop: Coop;
  title: string;
  /** Solo only: the level waits (a live level never does). */
  paused: boolean;
  sfx: () => Sfx;
  /** A name over each critter run by someone else (live). */
  labels?: string[] | null;
  /** Bump when the room hands critters around, so the switcher redraws. */
  roles?: string;
  muted: boolean;
  onMute: () => void;
  onStart?: () => void;
  onPause: () => void;
  onRestart: () => void;
  /** Solo: the level is cleared (the time, gems and restarts it took). */
  onClear?: (c: Clear) => void;
  /** The pause button's label ('Pause' solo, 'Menu' live). */
  pauseLabel?: string;
  extra?: ReactNode;
  children?: ReactNode;
}

export function Stage({ coop, title, paused, sfx, labels, muted, onMute, onStart, onPause, onRestart, onClear, pauseLabel = 'Pause', extra, children }: StageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const held = useRef(0);
  const touch = useRef(0);
  const active = useRef(-1);
  const [activeShown, setActiveShown] = useState(-1);
  const [hud, setHud] = useState({ secs: 0, gems: 0, tries: 0 });
  const [coarse, setCoarse] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const props = useRef({ paused, onStart, onPause, onRestart, onClear, labels, sfx });
  useEffect(() => {
    props.current = { paused, onStart, onPause, onRestart, onClear, labels, sfx };
  });
  const started = useRef(false);
  const begin = (): void => {
    if (started.current) return;
    started.current = true;
    props.current.onStart?.();
  };

  const mineList = (): number[] => coop.w.cr.flatMap((_, i) => (coop.mine(i) ? [i] : []));
  const pick = (i: number): void => {
    if (!coop.mine(i) || active.current === i) return;
    active.current = i;
    setActiveShown(i);
    props.current.sfx().swap();
  };
  const swap = (): void => {
    const mine = mineList();
    if (mine.length < 2) return;
    pick(mine[(mine.indexOf(active.current) + 1) % mine.length]!);
  };

  // keyboard (a button left focused by the menu must not take Space or Enter from the level)
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    const down = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (!e.repeat) props.current.onPause();
        return;
      }
      if (props.current.paused) return;
      const bit = KEYS[e.code];
      if (bit) {
        e.preventDefault();
        held.current |= bit;
        begin();
      } else if (e.code === 'Tab' || e.code === 'KeyQ') {
        e.preventDefault();
        if (!e.repeat) swap();
      } else if (e.code === 'KeyR' && !e.repeat) props.current.onRestart();
    };
    const up = (e: KeyboardEvent): void => {
      const bit = KEYS[e.code];
      if (bit) held.current &= ~bit;
    };
    const blur = (): void => {
      held.current = 0;
      touch.current = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coop]);

  // the loop: fixed steps, drawn every frame
  useEffect(() => {
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const r = new Renderer();
    r.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let size = { w: 1, h: 1, dpr: 1 };
    const resize = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, box.clientWidth);
      const h = Math.max(1, box.clientHeight);
      size = { w, h, dpr };
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let shown = { secs: -1, gems: -1, tries: -1 };
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const w = coop.w;
      if (!coop.mine(active.current)) {
        const first = w.cr.findIndex((_, i) => coop.mine(i));
        active.current = first;
        setActiveShown(first);
      }
      if (!props.current.paused && !document.hidden) {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 8) {
          const bits = held.current | touch.current;
          const input = w.cr.map((_, i) => (i === active.current ? bits : 0));
          const ev = coop.step(input);
          if (ev.length) {
            r.events(ev, w);
            const fx = props.current.sfx();
            const died = ev.some((e) => e.k === 'die');
            for (const e of ev) {
              const own = coop.mine(e.i);
              if (e.k === 'jump' && own) fx.jump();
              else if (e.k === 'land' && own) fx.land();
              else if (e.k === 'spring') fx.spring();
              else if (e.k === 'gem') fx.gem();
              else if (e.k === 'lever') fx.lever();
              else if (e.k === 'gate') fx.gate(w.gates[e.i] === true);
              else if (e.k === 'die' || (e.k === 'reset' && !died)) fx.pop();
              else if (e.k === 'clear') {
                fx.clear();
                props.current.onClear?.({ secs: Math.round(seconds(w) * 10) / 10, gems: gemsTaken(w), tries: w.tries });
              }
            }
          }
          acc -= STEP;
          n++;
        }
        if (n === 8) acc = 0;
      }
      const L = fit(w.lv, size.w, size.h, TOP);
      r.draw(ctx, w, L, size.w, size.h, size.dpr, dt, active.current, w.cr.map((_, i) => coop.mine(i)), props.current.labels ?? null);
      const next = { secs: Math.floor(seconds(w)), gems: gemsTaken(w), tries: w.tries };
      if (next.secs !== shown.secs || next.gems !== shown.gems || next.tries !== shown.tries) {
        shown = next;
        setHud(next);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [coop]);

  // (re-rendered when the room hands critters around: `roles` changes)
  const mine = mineList();
  const press = (e: React.PointerEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* (a pointer the browser no longer tracks) */
    }
    touch.current |= Number(e.currentTarget.dataset.bit);
    setCoarse(true);
    begin();
  };
  const release = (e: React.PointerEvent<HTMLButtonElement>): void => {
    touch.current &= ~Number(e.currentTarget.dataset.bit);
  };
  const lv = coop.w.lv;
  return (
    <div className="pri-stage" ref={wrap} onPointerDown={(e) => e.pointerType === 'touch' && setCoarse(true)}>
      <canvas ref={canvas} className="pri-canvas" aria-label={`${title}: the level`} />
      <div className="pri-hud">
        <div className="pri-hud-left">
          <button className="pri-icon" onClick={() => props.current.onPause()} aria-label={pauseLabel} title={pauseLabel}>
            {pauseLabel === 'Pause' ? 'II' : '☰'}
          </button>
          <span className="pri-title">{title}</span>
        </div>
        <div className="pri-hud-mid" aria-live="polite">
          <span title="Time">⏱ {hud.secs}s</span>
          <span title="Gems">💎 {hud.gems}/{lv.gems.length}</span>
          {hud.tries > 0 && <span title="Restarts">🔁 {hud.tries}</span>}
        </div>
        <div className="pri-hud-right">
          {extra}
          <button className="pri-icon" onClick={onMute} aria-label={muted ? 'Sound on' : 'Sound off'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <GameMenuButton className="pri-icon" />
        </div>
      </div>
      {mine.length > 1 && (
        <div className="pri-pals" role="radiogroup" aria-label="Your pals">
          {mine.map((i) => (
            <button key={i} role="radio" aria-checked={activeShown === i} className={`pri-pal${activeShown === i ? ' is-on' : ''}`} onClick={() => pick(i)} aria-label={PALS[coop.w.cr[i]!.color].name} style={{ ['--c' as string]: PALS[coop.w.cr[i]!.color].color }}>
              <PalFace color={coop.w.cr[i]!.color} size={30} />
            </button>
          ))}
        </div>
      )}
      {coarse && (
        <div className="pri-touch">
          <div className="pri-touch-left">
            <button className="pri-tbtn" aria-label="Left" data-bit={IN_LEFT} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
              ◀
            </button>
            <button className="pri-tbtn" aria-label="Right" data-bit={IN_RIGHT} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
              ▶
            </button>
          </div>
          <div className="pri-touch-right">
            <button className="pri-tbtn is-small" aria-label="Pull a lever" data-bit={IN_ACT} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
              ✋
            </button>
            {mine.length > 1 && (
              <button className="pri-tbtn is-small" aria-label="Switch pal" onPointerDown={(e) => {
                  e.preventDefault();
                  swap();
                }}>
                ⇄
              </button>
            )}
            <button className="pri-tbtn is-jump" aria-label="Jump" data-bit={IN_JUMP} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
              ▲
            </button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
