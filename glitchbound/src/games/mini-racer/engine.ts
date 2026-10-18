import type { Ghost } from './ghost';
import { speedOf, CAR, localVelocity, type Input } from './physics';
import { Renderer, fmtTime, type HudState } from './render';
import { RaceAudio } from './audio';
import { autopilot, COUNTDOWN, DT, RaceSim, scoreFor, type Mode } from './sim';
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

export interface TouchInput {
  left: boolean;
  right: boolean;
  brake: boolean;
  drift: boolean;
}

const KEYMAP: Record<string, keyof typeof EMPTY_KEYS> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'drift',
  ShiftLeft: 'drift',
  ShiftRight: 'drift',
};
const EMPTY_KEYS = { left: false, right: false, up: false, down: false, drift: false };

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
  touch: TouchInput = { left: false, right: false, brake: false, drift: false };
  touchMode = false;
  private steer = 0;
  private finishAt = -1;
  private lastCount = 99;
  private hud: HudState = { banner: null, popup: null, best: null, delta: null, attract: true, touch: false };
  private frameAvg = 16;
  private dprCap = 2;
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

  setPaint(color: string): void {
    this.renderer.paint = color;
  }

  /** Menu background: the autopilot laps the selected track. */
  attract(track: Track): void {
    this.attractMode = true;
    this.paused = false;
    this.renderer.setTrack(track);
    const sim = new RaceSim(track, 'hotlap');
    sim.time = 0;
    this.sim = sim;
    this.hud = { banner: null, popup: null, best: null, delta: null, attract: true, touch: this.touchMode };
    this.audio.update(0, 0, false);
  }

  race(track: Track, mode: Mode, ghost: Ghost | null, best: number | null): void {
    this.attractMode = false;
    this.paused = false;
    this.finishAt = -1;
    this.lastCount = 99;
    this.steer = 0;
    this.renderer.setTrack(track);
    this.sim = new RaceSim(track, mode, ghost);
    this.hud = { banner: null, popup: null, best, delta: null, attract: false, touch: this.touchMode };
    this.audio.start();
    this.acc = 0;
  }

  pause(): void {
    this.paused = true;
    this.audio.update(0, 0, false);
    this.audio.pause();
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
    this.audio.start();
  }

  setMuted(m: boolean): void {
    this.audio.setMuted(m);
  }

  private readInput(dt: number): Input {
    const t = this.touch;
    const k = this.keys;
    const left = k.left || t.left;
    const right = k.right || t.right;
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    // Ramp steering so taps are gentle and holds are full lock.
    const rate = target === 0 ? 10 : Math.sign(target) !== Math.sign(this.steer) ? 12 : 6;
    const dlt = target - this.steer;
    this.steer += Math.sign(dlt) * Math.min(Math.abs(dlt), rate * dt);
    const brake = k.down || t.brake ? 1 : 0;
    const throttle = k.up || (this.touchMode && !t.brake) ? 1 : 0;
    return { steer: this.steer, throttle, brake, drift: k.drift || t.drift };
  }

  private frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - (this.last || now)) / 1000));
    this.last = now;
    const sim = this.sim;
    if (!sim) return;
    // Adaptive resolution: if frames are slow, draw fewer pixels.
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    if (this.frameAvg > 21 && this.dprCap > 1 && !this.paused) {
      this.dprCap = Math.max(1, this.dprCap - 0.25);
      this.frameAvg = 16;
      this.resize();
    }
    if (!this.paused) {
      this.acc += dt;
      const input = this.attractMode ? autopilot(sim) : this.readInput(dt);
      let steps = 0;
      while (this.acc >= DT && steps < 24) {
        this.acc -= DT;
        steps++;
        const events = sim.step(this.attractMode ? autopilot(sim) : input);
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
        const { side } = localVelocity(sim.car);
        this.audio.update(speedOf(sim.car) / CAR.maxSpeed, sim.drift.active ? Math.min(1, Math.abs(side) / 200) : 0, !sim.finished || speedOf(sim.car) > 20);
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
        if (hud.best !== null) hud.delta = { value: lap.time - hud.best, until: now + 2.5 };
        if (hud.best === null || lap.time < hud.best) hud.best = lap.time;
        hud.popup = { text: `LAP ${fmtTime(lap.time)}  +${scoreFor(sim.track.def.par, [lap], 0)}`, until: now + 1.8 };
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
        hud.banner = { text: 'DRIFT LOST', sub: `${e.points} points crashed away`, color: '#ff8a7a', until: now + 1.4 };
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
    this.touch = { left: false, right: false, brake: false, drift: false };
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
