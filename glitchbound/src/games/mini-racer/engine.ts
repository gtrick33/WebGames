import type { Ghost } from './ghost';
import { speedOf, CAR, localVelocity, type CarSpec } from './physics';
import type { CarDef } from './cars';
import { Renderer, fmtTime, type HudState } from './render';
import { RaceAudio } from './audio';
import { autopilot, COUNTDOWN, DT, RaceSim, scoreFor, type RaceOptions } from './sim';
import type { Track } from './track';

/**
 * Runs the game loop: fixed 120 Hz physics, interpolated drawing, keyboard + touch input, sound.
 * Everything it creates (rAF, listeners, observers, AudioContext) is released in dispose().
 */

export type UiKey = 'confirm' | 'restart' | 'pause';

export interface EngineCallbacks {
  onFinish(sim: RaceSim): void;
  onUiKey(key: UiKey): void;
  /** The game paused itself (tab hidden or scrolled away). */
  onAutoPause(): void;
}

const KEYMAP: Record<string, keyof typeof EMPTY_KEYS> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
const EMPTY_KEYS = { left: false, right: false };

export class Engine {
  private root: HTMLElement;
  private cb: EngineCallbacks;
  private renderer: Renderer;
  readonly audio = new RaceAudio();
  sim: RaceSim | null = null;
  private attractMode = true;
  private raf = 0;
  private last = 0;
  private acc = 0;
  paused = false;
  private disposed = false;
  private keys = { ...EMPTY_KEYS };
  /** Pointers held on the track: id -> side (-1 left half, 1 right half). */
  private pointers = new Map<number, number>();
  touchMode = false;
  private steer = 0;
  private finishAt = -1;
  private lastCount = 99;
  private hud: HudState = { banner: null, popup: null, best: null, split: null, sectors: [], attract: true, touch: false };
  private frameAvg = 16;
  private dprCap = 2;
  /** Last time the engine sound was retuned (seconds); audio params change ~20x/s, not every frame. */
  private audioAt = 0;
  private cleanups: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, root: HTMLElement, cb: EngineCallbacks) {
    this.root = root;
    this.cb = cb;
    this.renderer = new Renderer(canvas);

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(root);
    this.cleanups.push(() => ro.disconnect());
    this.resize();

    const down = (e: KeyboardEvent): void => this.onKey(e, true);
    const up = (e: KeyboardEvent): void => this.onKey(e, false);
    const blur = (): void => {
      this.keys = { ...EMPTY_KEYS };
    };
    const vis = (): void => {
      if (document.hidden) this.autoPause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    this.cleanups.push(() => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', vis);
    });
    // Hold the left or right half of the screen to steer (touch, pen or mouse). Buttons and
    // overlays stop their own pointer events, so only presses on the track itself steer.
    const sideOf = (e: PointerEvent): number => {
      const r = root.getBoundingClientRect();
      return e.clientX < r.left + r.width / 2 ? -1 : 1;
    };
    const pdown = (e: PointerEvent): void => {
      if (this.attractMode || this.paused || e.target !== canvas) return;
      if (e.pointerType === 'touch') this.touchMode = true;
      this.pointers.set(e.pointerId, sideOf(e));
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    const pmove = (e: PointerEvent): void => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, sideOf(e));
    };
    const pup = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId);
    };
    canvas.addEventListener('pointerdown', pdown);
    canvas.addEventListener('pointermove', pmove);
    canvas.addEventListener('pointerup', pup);
    canvas.addEventListener('pointercancel', pup);
    canvas.addEventListener('lostpointercapture', pup);
    const noMenu = (e: Event): void => e.preventDefault();
    canvas.addEventListener('contextmenu', noMenu);
    // iPhone: quick repeated taps on the track start Safari's double/triple-tap text selection, which
    // pops up the "Copy / Look Up / More" menu. Cancelling the touches' default stops it; steering
    // uses pointer events, which still arrive.
    const noGesture = (e: TouchEvent): void => {
      if (e.cancelable) e.preventDefault();
    };
    canvas.addEventListener('touchstart', noGesture, { passive: false });
    canvas.addEventListener('touchend', noGesture, { passive: false });
    this.cleanups.push(() => {
      canvas.removeEventListener('pointerdown', pdown);
      canvas.removeEventListener('pointermove', pmove);
      canvas.removeEventListener('pointerup', pup);
      canvas.removeEventListener('pointercancel', pup);
      canvas.removeEventListener('lostpointercapture', pup);
      canvas.removeEventListener('contextmenu', noMenu);
      canvas.removeEventListener('touchstart', noGesture);
      canvas.removeEventListener('touchend', noGesture);
    });

    const io = new IntersectionObserver(([entry]) => {
      if (entry && entry.intersectionRatio < 0.4) this.autoPause();
    }, { threshold: [0, 0.4] });
    io.observe(root);
    this.cleanups.push(() => io.disconnect());

    this.raf = requestAnimationFrame(this.frame);
    // Dev-only handle for driving tests from the browser console (stripped from production builds).
    if (import.meta.env.DEV) (window as unknown as { __miniRacer?: Engine }).__miniRacer = this;
  }

  private autoPause(): void {
    if (!this.attractMode && this.sim && !this.sim.finished && !this.paused) {
      this.pause();
      this.cb.onAutoPause();
    }
  }

  private resize(): void {
    const r = this.root.getBoundingClientRect();
    this.renderer.resize(r.width, r.height, Math.min(this.dprCap, window.devicePixelRatio || 1));
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = KEYMAP[e.code];
    const racing = !this.attractMode && !this.paused;
    if (k) {
      this.keys[k] = down;
      if (racing) e.preventDefault();
      if (down && racing) this.touchMode = false;
      return;
    }
    if (!down || e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (e.code === 'Enter') this.cb.onUiKey('confirm');
    else if (e.code === 'KeyR') this.cb.onUiKey('restart');
    else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!this.attractMode) e.preventDefault();
      this.cb.onUiKey('pause');
    }
  }

  setCar(car: Pick<CarDef, 'shape' | 'body' | 'accent'>): void {
    this.renderer.car = car;
  }

  /** Menu background: the autopilot laps the selected track. */
  attract(track: Track): void {
    this.attractMode = true;
    this.paused = false;
    this.renderer.setTrack(track);
    const sim = new RaceSim(track);
    sim.time = 0;
    this.sim = sim;
    this.hud = { banner: null, popup: null, best: null, split: null, sectors: [], attract: true, touch: this.touchMode };
    this.audio.update(0, 0, false);
    this.audio.music(false);
  }

  race(track: Track, spec: CarSpec, ghost: Ghost | null, best: number | null, opts: RaceOptions = {}): void {
    this.attractMode = false;
    this.paused = false;
    this.finishAt = -1;
    this.lastCount = 99;
    this.steer = 0;
    this.renderer.setTrack(track);
    this.sim = new RaceSim(track, ghost, spec, opts);
    this.pointers.clear();
    this.hud = { banner: null, popup: null, best, split: null, sectors: [], attract: false, touch: this.touchMode };
    this.audio.start();
    this.audio.music(true);
    this.acc = 0;
  }

  pause(): void {
    this.paused = true;
    this.audio.update(0, 0, false);
    this.audio.pause();
  }

  /** Fade the race music out (e.g. the arcade asked for a pause while a menu is showing). */
  quiet(): void {
    this.audio.music(false);
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
    this.audio.start();
  }

  setMuted(m: boolean): void {
    this.audio.setMuted(m);
  }

  /** Steering from held keys and held screen halves (both halves held = straight). */
  private readSteer(dt: number): number {
    const k = this.keys;
    let left = k.left;
    let right = k.right;
    for (const side of this.pointers.values()) {
      if (side < 0) left = true;
      else right = true;
    }
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    // Ramp steering so taps are gentle and holds are full lock.
    const rate = target === 0 ? 10 : Math.sign(target) !== Math.sign(this.steer) ? 12 : 6;
    const dlt = target - this.steer;
    this.steer += Math.sign(dlt) * Math.min(Math.abs(dlt), rate * dt);
    return this.steer;
  }

  private frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - (this.last || now)) / 1000));
    this.last = now;
    const sim = this.sim;
    if (!sim) return;
    // Adaptive resolution: if frames are slow, draw fewer pixels. Only decided on the menu's demo
    // lap: resizing the canvas mid-race clears it and costs a hitch of its own.
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    if (this.attractMode && this.frameAvg > 21 && this.dprCap > 1 && !this.paused && !document.hidden) {
      this.dprCap = Math.max(1, this.dprCap - 0.25);
      this.frameAvg = 16;
      this.resize();
    }
    if (!this.paused) {
      this.acc += dt;
      const steer = this.attractMode ? 0 : this.readSteer(dt);
      let steps = 0;
      while (this.acc >= DT && steps < 24) {
        this.acc -= DT;
        steps++;
        const events = sim.step(this.attractMode ? autopilot(sim) : steer);
        if (!this.attractMode) for (const e of events) this.handle(e, sim);
      }
      if (this.attractMode && sim.lap.laps.length >= 5) this.attract(sim.track);
      if (!this.attractMode) {
        if (sim.time < 0) {
          const n = Math.ceil(-sim.time / (COUNTDOWN / 3));
          if (n < this.lastCount) {
            this.lastCount = n;
            this.audio.blip('count');
          }
        }
        if (now - this.audioAt >= 50) {
          this.audioAt = now;
          const { side } = localVelocity(sim.car);
          this.audio.update(speedOf(sim.car) / CAR.maxSpeed, sim.drift.active ? Math.min(1, Math.abs(side) / 200) : 0, !sim.finished || speedOf(sim.car) > 20);
        }
        if (this.finishAt > 0 && sim.time >= 0 && performance.now() >= this.finishAt) {
          this.finishAt = -1;
          this.cb.onFinish(sim);
        }
      }
    }
    this.hud.touch = this.touchMode;
    this.renderer.draw(sim, this.paused ? 1 : Math.min(1, this.acc / DT), this.paused ? 0 : dt, this.hud);
  };

  private handle(e: ReturnType<RaceSim['step']>[number], sim: RaceSim): void {
    const now = this.renderer.now;
    const hud = this.hud;
    switch (e.type) {
      case 'go':
        this.audio.blip('go');
        break;
      case 'missed':
        hud.banner = { text: 'MISSED CHECKPOINT', sub: "This lap won't count", color: '#ff8a7a', until: now + 2 };
        this.audio.blip('miss');
        break;
      case 'lap': {
        const { lap } = e;
        if (!lap.valid) {
          hud.banner = { text: "LAP DIDN'T COUNT", sub: 'Pass every checkpoint post', color: '#ff8a7a', until: now + 2 };
          break;
        }
        if (hud.best === null || lap.time < hud.best) hud.best = lap.time;
        hud.popup = { text: `LAP ${fmtTime(lap.time)}  +${scoreFor(sim.track.def.par, [lap])}`, until: now + 1.8 };
        this.audio.blip('lap');
        break;
      }
      case 'bestLap':
        hud.banner = { text: 'NEW BEST LAP', sub: fmtTime(e.time), color: '#c4f034', until: now + 2 };
        this.audio.blip('best');
        break;
      case 'bump':
        this.audio.blip('bump');
        break;
      case 'driftBank':
        hud.popup = { text: `+${e.points} DRIFT${e.boost ? '  TURBO!' : ''}`, until: now + 1.3 };
        if (e.boost) this.audio.blip('boost');
        break;
      case 'driftLost':
        hud.banner = { text: 'DRIFT LOST', sub: `${e.points} drift points gone`, color: '#ff8a7a', until: now + 1.4 };
        break;
      case 'split': {
        const sp = e.split;
        if (sp.sector === 0) hud.sectors = [];
        hud.sectors[sp.sector] = sp.delta === null ? 'done' : sp.delta <= 0 ? 'green' : 'red';
        hud.split = { sector: sp.sector, delta: sp.delta, time: sp.time, until: now + 2.2 };
        break;
      }
      case 'rescue':
        hud.banner = { text: 'BACK ON TRACK', sub: 'Steer to stay on the road', color: '#ffd12e', until: now + 1.6 };
        this.audio.blip('miss');
        break;
      case 'boostPad':
        this.audio.blip('boost');
        break;
      case 'finish':
        this.finishAt = performance.now() + 1100;
        break;
    }
  }

  /** Clears held keys/touches (e.g. when an overlay opens). */
  releaseInput(): void {
    this.keys = { ...EMPTY_KEYS };
    this.pointers.clear();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.audio.dispose();
    this.sim = null;
  }
}
