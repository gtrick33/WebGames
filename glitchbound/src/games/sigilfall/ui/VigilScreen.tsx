import { useEffect, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import type { SigilEngine } from '../engine';
import { newCharacter, type Face } from '../progress/character';
import { DEFAULT_SETTINGS } from '../progress/save';
import { creatureSprite } from '../render/sprites';
import { Renderer } from '../render/renderer';
import { TILE } from '../sim/map';
import { World } from '../sim/world';
import { iconPicture } from '../render/art/gameIcons';
import { VIGIL_ICON } from '../render/art/iconPicks';
import { MAX_SPELL, MAX_STRENGTH, SPELLS, STRENGTHS, type SpellId, type StrengthId } from '../vigil/kit';
import { Vigil, type Card } from '../vigil/sim';
import { toLocal } from './turn';

const BEST_KEY = 'sigilfall.vigil.best';

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveBest(t: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(t)));
  } catch {
    /* a browser that keeps nothing: the run still counted */
  }
}

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const cardName = (c: Card): string => (c.kind === 'heal' ? 'A Moment’s Rest' : c.kind === 'spell' ? (c.evolve ? SPELLS[c.id].evolve!.name : SPELLS[c.id].name) : STRENGTHS[c.id].name);
const cardText = (c: Card): string => {
  if (c.kind === 'heal') return 'You have everything. Catch your breath: regain 30% health.';
  if (c.kind === 'strength') return STRENGTHS[c.id].text;
  if (c.evolve) return SPELLS[c.id].evolve!.text;
  return c.level === 1 ? SPELLS[c.id].text : SPELLS[c.id].next;
};
const spellIcon = (id: SpellId, evolved = false): string => iconPicture(VIGIL_ICON[evolved ? (id === 'ember-bolt' ? 'phoenix' : 'zero') : id]!);
const strengthIcon = (id: StrengthId): string => iconPicture(VIGIL_ICON[id]!);
const cardIcon = (c: Card): string => (c.kind === 'heal' ? strengthIcon('mend') : c.kind === 'spell' ? spellIcon(c.id, c.evolve) : strengthIcon(c.id));
const cardTag = (c: Card): string => (c.kind === 'heal' ? '' : c.kind === 'spell' && c.evolve ? 'Evolves' : c.level === 1 ? 'New' : `Level ${c.level}`);

/** What this run holds, along the foot of the screen. */
function Loadout({ v }: { v: Vigil }) {
  const spells = Object.entries(v.spells) as [SpellId, number][];
  const strengths = Object.entries(v.strengths) as [StrengthId, number][];
  return (
    <div className="rb-vigil-loadout" aria-label="What you hold">
      {spells.map(([id, l]) => (
        <span key={id} className={`rb-vigil-slot${v.evolved.has(id) ? ' is-evolved' : ''}`} title={v.evolved.has(id) ? SPELLS[id].evolve?.name : SPELLS[id].name}>
          <img src={spellIcon(id, v.evolved.has(id))} alt={SPELLS[id].name} draggable={false} />
          <small>{l >= MAX_SPELL ? 'MAX' : l}</small>
        </span>
      ))}
      {strengths.length > 0 && <i className="rb-vigil-gap" />}
      {strengths.map(([id, l]) => (
        <span key={id} className="rb-vigil-slot is-small" title={STRENGTHS[id].name}>
          <img src={strengthIcon(id)} alt={STRENGTHS[id].name} draggable={false} />
          <small>{l >= MAX_STRENGTH ? 'MAX' : l}</small>
        </span>
      ))}
    </div>
  );
}

/** The lit disc of a spark, drawn once and stamped. */
function makeStamp(size: number, inner: string, outer: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.45, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * Sigilfall: The Vigil. Hold the line against the Ashen Host for as long as you can. The land is drawn by the game's
 * own renderer (the real map and the hero's paper doll); the Host and the spells are drawn over it on a second
 * canvas, because the renderer's careful depth sorting is too dear for hundreds of foes. Nobody here is stopped by
 * trees or walls: the Host walks through them, so a hero caught on one would only die for it.
 */
export function VigilScreen({ engine, face, body, onBack }: { engine: SigilEngine; face?: Face; body?: 'm' | 'f'; onBack: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [, tick] = useState(0);
  const [view, setView] = useState<Vigil | null>(null);
  const [best, setBest] = useState(readBest);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  const hudT = useRef<HTMLSpanElement>(null);
  const hudK = useRef<HTMLSpanElement>(null);
  const hudL = useRef<HTMLSpanElement>(null);
  const hudXp = useRef<HTMLElement>(null);
  const hudHp = useRef<HTMLElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const hurtRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const bossRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current!;
    const base = baseRef.current!;
    const top = topRef.current!;
    const hero = newCharacter('mage', 'The Watch', 'vigil');
    if (face) hero.face = face;
    if (body) hero.body = body;
    // the land: a real region of the game, emptied of everything but the land itself
    const world = new World({ region: 'whisperwood', tier: 0, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed: 7, handIns: false });
    world.enemies.length = 0;
    const renderer = new Renderer(base);
    renderer.landOnly = true;
    renderer.setHeroWeapon('mage', world);
    const map = world.map;
    const v = new Vigil((Math.random() * 2 ** 32) >>> 0, world.player.x, world.player.y, () => false, { x0: TILE, y0: TILE, x1: (map.w - 1) * TILE, y1: (map.h - 1) * TILE });
    let shown = false;
    let raf = 0;
    let last = performance.now();
    let dpr = 1;
    const g = top.getContext('2d')!;
    const fit = (): void => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = box.clientWidth;
      const h = box.clientHeight;
      renderer.resize(w, h, dpr, engine.touchMode);
      top.width = Math.round(w * dpr);
      top.height = Math.round(h * dpr);
      top.style.width = `${w}px`;
      top.style.height = `${h}px`;
      renderer.snap(world);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);

    /* ------------------------------------------------------ input */
    const keys = new Set<string>();
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') setPaused((p) => !p);
      if (v.cards) {
        const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (n >= 0 && v.cards[n]) {
          v.choose(n);
          tick((x) => x + 1);
        }
        if (e.code === 'KeyR') {
          v.reroll();
          tick((x) => x + 1);
        }
      }
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent): void => {
      keys.delete(e.code);
    };
    const blur = (): void => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    // a finger anywhere is a joystick from where it touched
    let touch: { id: number; x: number; y: number; dx: number; dy: number } | null = null;
    const pdown = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' || touch) return;
      const p = toLocal(box, e.clientX, e.clientY);
      touch = { id: e.pointerId, x: p.x, y: p.y, dx: 0, dy: 0 };
    };
    const pmove = (e: PointerEvent): void => {
      if (!touch || e.pointerId !== touch.id) return;
      const p = toLocal(box, e.clientX, e.clientY);
      touch.dx = p.x - touch.x;
      touch.dy = p.y - touch.y;
    };
    const pup = (e: PointerEvent): void => {
      if (touch?.id === e.pointerId) touch = null;
    };
    box.addEventListener('pointerdown', pdown);
    box.addEventListener('pointermove', pmove);
    window.addEventListener('pointerup', pup);
    window.addEventListener('pointercancel', pup);

    const inputNow = (): { mx: number; my: number } => {
      let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      if (touch) {
        const len = Math.hypot(touch.dx, touch.dy);
        if (len > 6) {
          const k = Math.min(1, len / 44) / len;
          mx = touch.dx * k;
          my = touch.dy * k;
        }
      }
      return { mx, my };
    };

    /* ------------------------------------------------------ drawing */
    const ember = makeStamp(32, '#fff2c0', 'rgba(255,120,40,0.85)');
    const spark = makeStamp(24, '#e8fff8', 'rgba(120,220,255,0.8)');
    const mote = makeStamp(32, '#ffffff', 'rgba(150,120,255,0.85)');
    const toTop = (x: number, y: number): { x: number; y: number } => {
      const s = renderer.toScreen(x, y);
      return { x: s.x * dpr, y: s.y * dpr };
    };
    let cards: Card[] | null = null;
    let over = false;
    // what is flying about, drawn only here so the simulation stays pure
    const pops: { x: number; y: number; n: number; big: boolean; t: number }[] = [];
    const bits: { x: number; y: number; vx: number; vy: number; t: number; dur: number; c: string; s: number }[] = [];
    const BIT = ['#ffe39a', '#ffb45c', '#ff7a3d', '#ffffff', '#c9b8ff'];
    const rings: { x: number; y: number; t: number; dur: number; r: number; c: string }[] = [];
    let flashWas = 0;
    const draw = (dt: number): void => {
      for (const p of v.pops) pops.push({ ...p, t: 0 });
      v.pops.length = 0;
      for (const f of v.falls) {
        const n = f.boss ? 60 : 7;
        for (let i = 0; i < n && bits.length < 400; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = (f.boss ? 60 : 26) + Math.random() * (f.boss ? 160 : 60);
          bits.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24, t: 0, dur: 0.3 + Math.random() * 0.4, c: BIT[i % BIT.length]!, s: f.boss ? 2.4 : 1.4 });
        }
        if (f.boss) rings.push({ x: f.x, y: f.y, t: 0, dur: 0.7, r: 120, c: '#ffe39a' });
      }
      v.falls.length = 0;
      if (v.levelFlash > flashWas) {
        rings.push({ x: v.x, y: v.y, t: 0, dur: 0.6, r: 90, c: '#ffe39a' });
        rings.push({ x: v.x, y: v.y, t: -0.12, dur: 0.6, r: 60, c: '#8fd8ff' });
      }
      flashWas = v.levelFlash;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, top.width, top.height);
      // the kick, on both canvases so the land shakes with the Host
      const sx = v.shake > 0 ? (Math.random() - 0.5) * v.shake * dpr : 0;
      const sy = v.shake > 0 ? (Math.random() - 0.5) * v.shake * dpr : 0;
      box.style.setProperty('--kx', `${sx / dpr}px`);
      box.style.setProperty('--ky', `${sy / dpr}px`);
      const a = toTop(0, 0);
      const b = toTop(1, 0);
      const k = b.x - a.x;
      for (const f of v.fields) {
        const p = toTop(f.x, f.y);
        const alpha = Math.min(1, f.life / 0.5);
        g.globalAlpha = 0.34 * alpha;
        g.fillStyle = '#ff6a2a';
        g.beginPath();
        g.ellipse(p.x, p.y, f.r * k, f.r * k * 0.72, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.8 * alpha;
        g.strokeStyle = '#ffb45c';
        g.lineWidth = 1.5 * dpr;
        g.stroke();
        g.globalAlpha = 1;
      }
      for (const s of v.sparks) {
        const p = toTop(s.x, s.y);
        const r = (s.xp > 3 ? 7 : 4.5) * k;
        g.drawImage(spark, p.x - r, p.y - r, r * 2, r * 2);
      }
      // the Host, back to front
      const order = v.foes.slice().sort((m, n) => m.y - n.y);
      const left = -60;
      for (const f of order) {
        const p = toTop(f.x, f.y);
        if (p.x < left || p.y < left || p.x > top.width + 60 || p.y > top.height + 60) continue;
        const frame = Math.floor(f.walk * 6 + f.id) % 2;
        const sp = creatureSprite(f.def.sprite, frame);
        const scale = f.boss ? 2 : 1;
        const w = (sp.width / sp.k) * k * scale;
        const h = (sp.height / sp.k) * k * scale;
        const flip = Math.cos(f.face) < 0;
        g.fillStyle = 'rgba(8,4,16,0.35)';
        g.beginPath();
        g.ellipse(p.x, p.y + 1, w * 0.34, w * 0.14, 0, 0, Math.PI * 2);
        g.fill();
        const img = f.flash > 0 ? (flip ? sp.wf : sp.w) : flip ? sp.f : sp.c;
        if (f.frozen > 0) g.filter = 'hue-rotate(170deg) brightness(1.5)';
        else if (f.slow > 0) g.filter = 'hue-rotate(160deg)';
        g.drawImage(img as CanvasImageSource, p.x - w / 2, p.y - h + 3 * k, w, h);
        g.filter = 'none';
      }
      for (const s of v.shots) {
        const p = toTop(s.x, s.y);
        const r = s.r * 2.2 * k;
        g.drawImage(ember, p.x - r, p.y - r, r * 2, r * 2);
      }
      for (const [x, y] of v.motePoints()) {
        const p = toTop(x, y);
        const r = 8 * k;
        g.drawImage(mote, p.x - r, p.y - r, r * 2, r * 2);
      }
      for (const fx of v.fx) {
        const u = fx.t / fx.dur;
        if (fx.kind === 'ring') {
          const p = toTop(fx.x, fx.y);
          g.globalAlpha = 1 - u;
          g.strokeStyle = '#bfeaff';
          g.lineWidth = (5 - u * 3) * k;
          g.beginPath();
          g.ellipse(p.x, p.y, fx.r * k * (0.3 + u * 0.7), fx.r * k * (0.3 + u * 0.7) * 0.74, 0, 0, Math.PI * 2);
          g.stroke();
        } else if (fx.kind === 'bolt') {
          g.globalAlpha = 1 - u;
          g.lineWidth = 2.4 * k;
          g.strokeStyle = '#dff2ff';
          g.beginPath();
          fx.pts.forEach(([x, y], i) => {
            const p = toTop(x, y);
            if (i) g.lineTo(p.x, p.y);
            else g.moveTo(p.x, p.y);
          });
          g.stroke();
        } else if (fx.kind === 'star') {
          const p = toTop(fx.x, fx.y);
          // it falls for the first part, then the ground takes it
          const fall = Math.min(1, u * 2.4);
          const q = toTop(fx.x + 60 * (1 - fall), fx.y - 170 * (1 - fall));
          if (fall < 1) {
            const r = 16 * k;
            g.drawImage(ember, q.x - r, q.y - r, r * 2, r * 2);
          } else {
            const w = (u - 0.42) / 0.58;
            g.globalAlpha = 1 - w;
            g.fillStyle = '#ffb45c';
            g.beginPath();
            g.ellipse(p.x, p.y, fx.r * k * (0.5 + w * 0.5), fx.r * k * (0.5 + w * 0.5) * 0.72, 0, 0, Math.PI * 2);
            g.fill();
          }
        } else {
          const p = toTop(fx.x, fx.y);
          g.globalAlpha = 1 - u;
          const r = fx.r * k * (0.4 + u * 0.6);
          g.drawImage(ember, p.x - r, p.y - r, r * 2, r * 2);
        }
        g.globalAlpha = 1;
      }
      for (const b of bits) {
        b.t += dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += 140 * dt;
        const p = toTop(b.x, b.y);
        g.globalAlpha = Math.max(0, 1 - b.t / b.dur);
        g.fillStyle = b.c;
        g.fillRect(p.x, p.y, b.s * k, b.s * k);
      }
      for (let i = bits.length - 1; i >= 0; i--) if (bits[i]!.t >= bits[i]!.dur) bits.splice(i, 1);
      for (const r of rings) {
        r.t += dt;
        if (r.t < 0) continue;
        const u = r.t / r.dur;
        const p = toTop(r.x, r.y);
        g.globalAlpha = Math.max(0, 1 - u);
        g.strokeStyle = r.c;
        g.lineWidth = (6 - u * 5) * k;
        g.beginPath();
        g.ellipse(p.x, p.y, r.r * k * (0.15 + u * 0.85), r.r * k * (0.15 + u * 0.85) * 0.74, 0, 0, Math.PI * 2);
        g.stroke();
      }
      for (let i = rings.length - 1; i >= 0; i--) if (rings[i]!.t >= rings[i]!.dur) rings.splice(i, 1);
      g.globalAlpha = 1;
      g.textAlign = 'center';
      for (const n of pops) {
        n.t += dt;
        const u = n.t / 0.62;
        const p = toTop(n.x + Math.sin(n.y) * 3, n.y - u * 14);
        const size = (n.big ? 10 : 6.4) * k * (u < 0.18 ? 1 + (0.18 - u) * 2.6 : 1);
        g.font = `700 ${size}px Georgia, serif`;
        g.globalAlpha = Math.max(0, 1 - u * u);
        g.lineWidth = 2.4 * dpr;
        g.strokeStyle = '#1c0e08';
        g.strokeText(String(n.n), p.x, p.y);
        g.fillStyle = n.big ? '#ffd257' : '#fff6e0';
        g.fillText(String(n.n), p.x, p.y);
      }
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i]!.t >= 0.62) pops.splice(i, 1);
      g.globalAlpha = 1;
      // the hero's own health under their feet
      const hp = toTop(v.x, v.y + 9);
      const bw = 26 * k;
      g.fillStyle = '#120a20';
      g.fillRect(hp.x - bw / 2 - k * 0.5, hp.y - k * 0.5, bw + k, 3 * k);
      g.fillStyle = v.hp / v.maxHp < 0.3 ? '#ff4f6a' : '#7fe06a';
      g.fillRect(hp.x - bw / 2, hp.y, bw * (v.hp / v.maxHp), 2 * k);
    };

    /* ------------------------------------------------------ the loop */
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      if (!shown) {
        shown = true;
        setView(v);
      }
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const time = now / 1000;
      if (!pausedRef.current) v.step(dt, inputNow());
      const p = world.player;
      p.x = v.x;
      p.y = v.y;
      p.vx = v.cards || pausedRef.current ? 0 : v.vx;
      p.vy = v.cards || pausedRef.current ? 0 : v.vy;
      if (Math.hypot(p.vx, p.vy) > 1) {
        p.walkT += dt;
        p.dir = Math.abs(v.dirX) > Math.abs(v.dirY) ? (v.dirX < 0 ? 1 : 2) : v.dirY < 0 ? 3 : 0;
      }
      p.iframe = v.iframe;
      renderer.draw(world, v.cards || pausedRef.current ? 0 : dt, time);
      draw(v.cards || pausedRef.current ? 0 : dt);
      if (hurtRef.current) hurtRef.current.style.opacity = String(Math.max(v.struck * 0.75, v.hp / v.maxHp < 0.25 ? 0.28 + Math.sin(now / 240) * 0.14 : 0));
      if (flashRef.current) flashRef.current.style.opacity = String(v.levelFlash * 0.55);
      const boss = v.foes.find((f) => f.boss);
      if (bossRef.current) {
        bossRef.current.style.display = boss ? 'grid' : 'none';
        if (boss) {
          bossRef.current.querySelector('b')!.textContent = boss.boss;
          bossRef.current.querySelector('i')!.style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
        }
      }
      if (hudT.current) hudT.current.textContent = clock(v.t);
      if (hudK.current) hudK.current.textContent = String(v.kills);
      if (hudL.current) hudL.current.textContent = String(v.level);
      if (hudXp.current) hudXp.current.style.width = `${(v.xp / v.xpNext) * 100}%`;
      if (hudHp.current) hudHp.current.style.width = `${(v.hp / v.maxHp) * 100}%`;
      if (banner.current) banner.current.textContent = v.banner?.text ?? '';
      if (v.cards !== cards) {
        cards = v.cards;
        if (cards) engine.sound.play('quest', 0.7);
        tick((x) => x + 1);
      }
      if (v.over && !over) {
        over = true;
        setBest((b) => {
          const next = Math.max(b, Math.floor(v.t));
          saveBest(next);
          return next;
        });
        tick((x) => x + 1);
      }
    };
    raf = requestAnimationFrame(frame);
    // review tool on the dev server: a hidden pane runs no animation frames, so frames can be stepped by hand
    if (import.meta.env.DEV) (window as unknown as { __vigil?: unknown }).__vigil = { v, frame, keys };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerup', pup);
      window.removeEventListener('pointercancel', pup);
      box.removeEventListener('pointerdown', pdown);
      box.removeEventListener('pointermove', pmove);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const v = view;
  const newBest = v?.over && Math.floor(v.t) >= best;
  return (
    <div className="rb-vigil" ref={boxRef}>
      <div className="rb-vigil-world">
        <canvas ref={baseRef} className="rb-vigil-canvas" />
        <canvas ref={topRef} className="rb-vigil-canvas" />
      </div>
      <div className="rb-vigil-hurt" ref={hurtRef} aria-hidden="true" />
      <div className="rb-vigil-flash" ref={flashRef} aria-hidden="true" />
      <div className="rb-vigil-xp">
        <i ref={hudXp} />
      </div>
      <div className="rb-vigil-hud">
        <div className="rb-vigil-stat">
          <span ref={hudT} className="rb-vigil-clock">
            0:00
          </span>
          <span className="rb-dim">
            Level <b ref={hudL}>1</b> · <b ref={hudK}>0</b> felled
          </span>
          <span className="rb-vigil-hp">
            <i ref={hudHp} />
          </span>
        </div>
        <div className="rb-vigil-buttons">
          <button className="rb-iconbtn" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume' : 'Pause'}>
            {paused ? '▶' : '❚❚'}
          </button>
          <GameMenuButton className="rb-iconbtn" />
        </div>
      </div>
      <div className="rb-vigil-banner" ref={banner} role="status" />
      <div className="rb-vigil-boss" ref={bossRef} style={{ display: 'none' }}>
        <b />
        <span>
          <i />
        </span>
      </div>
      {v && <Loadout v={v} />}

      {v?.cards && !v.over && (
        <div className="rb-vigil-modal" role="dialog" aria-label="Level up">
          <h2 className="rb-vigil-levelup">Level {v.level}</h2>
          <p className="rb-dim">Choose one. The night waits.</p>
          <div className="rb-vigil-cards">
            {v.cards.map((c, i) => (
              <button
                key={`${c.kind}-${i}`}
                className={`rb-vigil-card${c.kind === 'spell' && c.evolve ? ' is-evolve' : ''}${c.kind === 'strength' ? ' is-strength' : ''}`}
                style={{ ['--i' as string]: i }}
                onClick={() => {
                  v.choose(i);
                  tick((x) => x + 1);
                }}
              >
                <span className="rb-vigil-tag">{cardTag(c)}</span>
                <span className="rb-vigil-icon">
                  <img src={cardIcon(c)} alt="" draggable={false} />
                </span>
                <strong>{cardName(c)}</strong>
                <span>{cardText(c)}</span>
                {c.kind === 'spell' && !c.evolve && (
                  <span className="rb-vigil-pips" aria-hidden="true">
                    {Array.from({ length: MAX_SPELL }, (_, n) => (
                      <i key={n} className={n < c.level ? 'is-on' : ''} />
                    ))}
                  </span>
                )}
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
          <button
            className="rb-btn is-small is-ghost"
            disabled={v.rerolls <= 0}
            onClick={() => {
              v.reroll();
              tick((x) => x + 1);
            }}
          >
            Reroll ({v.rerolls})
          </button>
        </div>
      )}

      {paused && !v?.over && !v?.cards && (
        <div className="rb-vigil-modal" role="dialog" aria-label="Paused">
          <h2>The night waits</h2>
          <div className="rb-vigil-actions">
            <button className="rb-btn is-gold" onClick={() => setPaused(false)}>
              Resume
            </button>
            <button className="rb-btn is-ghost" onClick={onBack}>
              Leave the Vigil
            </button>
          </div>
        </div>
      )}

      {v?.over && (
        <div className="rb-vigil-modal is-over" role="dialog" aria-label="The Vigil is over">
          <h2>The line broke</h2>
          <p className="rb-vigil-final">
            You held for <b>{clock(v.t)}</b>
          </p>
          <p className="rb-dim">
            {v.kills} felled · level {v.level}
            {newBest ? ' · your longest night' : ` · your longest night is ${clock(best)}`}
          </p>
          <div className="rb-vigil-actions">
            <button
              className="rb-btn is-gold is-big"
              onClick={() => {
                setPaused(false);
                setRun((r) => r + 1);
              }}
            >
              Hold again
            </button>
            <button className="rb-btn is-ghost" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
