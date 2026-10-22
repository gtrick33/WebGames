import type { SlotKey } from '../data/types';
import type { AimPreview } from '../render/renderer';
import type { CastRequest } from '../sim/cast';
import type { InputFrame } from '../sim/world';

/**
 * Input adapters. Gameplay never reads the keyboard or the touch screen directly: each adapter fills
 * the same InputFrame. Desktop: WASD/arrows, mouse aim, left button attacks, Q E R skills, Space
 * dodges, the ultimate on a key you choose. Touch: the on-screen controls write into TouchState.
 */

export type UltKey = 'f' | 't' | 'shift' | 'rmb';

/** Menu shortcuts the keyboard adapter reports to the UI. */
export type UiKey = 'pause' | 'hero' | 'skills' | 'talents' | 'quests' | 'map';

export class KeyboardMouse {
  private keys = new Set<string>();
  private queued: SlotKey[] = [];
  private lmb = false;
  private mouse: { x: number; y: number } | null = null;
  private potion = false;
  private interact = false;
  /** Last time the mouse or keyboard was used (to switch the controls shown). */
  lastUsed = 0;
  ultKey: UltKey = 'f';
  onUi: ((k: UiKey) => void) | null = null;
  private target: HTMLElement;
  private off: (() => void)[] = [];

  constructor(target: HTMLElement) {
    this.target = target;
    const on = <K extends keyof WindowEventMap>(el: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions): void => {
      el.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', (e) => this.key(e, true));
    on(window, 'keyup', (e) => this.key(e, false));
    on(window, 'blur', () => this.release());
    on(target, 'pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = target.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.lastUsed = performance.now();
    });
    on(target, 'pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = target.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.lastUsed = performance.now();
      // clicks on buttons and panels are for the UI, not attacks
      if (!(e.target instanceof HTMLCanvasElement)) return;
      if (e.button === 0) this.lmb = true;
      if (e.button === 2 && this.ultKey === 'rmb') this.queued.push('ult');
    });
    on(window, 'pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.lmb = false;
    });
    on(target, 'contextmenu', (e) => e.preventDefault());
    on(target, 'pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.lmb = false;
    });
  }

  private key(e: KeyboardEvent, down: boolean): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const code = e.code;
    const move = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k);
    if (move || k === ' ') e.preventDefault();
    if (down) {
      this.lastUsed = performance.now();
      if (!e.repeat) {
        if (code === 'KeyQ') this.queued.push('s1');
        else if (code === 'KeyE') this.queued.push('s2');
        else if (code === 'KeyR') this.queued.push('s3');
        else if (k === ' ') this.queued.push('dodge');
        else if ((this.ultKey === 'f' && code === 'KeyF') || (this.ultKey === 't' && code === 'KeyT') || (this.ultKey === 'shift' && k === 'Shift')) this.queued.push('ult');
        else if (code === 'Digit1' || code === 'KeyH') this.potion = true;
        else if (code === 'KeyG' || k === 'Enter' || (this.ultKey !== 'f' && code === 'KeyF')) this.interact = true;
        else if (k === 'Escape' || code === 'KeyP') this.onUi?.('pause');
        else if (code === 'KeyI' || code === 'KeyB' || code === 'KeyC') this.onUi?.('hero');
        else if (code === 'KeyK' || code === 'KeyN') this.onUi?.('talents');
        else if (code === 'KeyJ' || code === 'KeyL') this.onUi?.('quests');
        else if (code === 'KeyM') this.onUi?.('map');
        else if (code === 'KeyU') this.onUi?.('skills');
      }
      this.keys.add(k);
    } else this.keys.delete(k);
  }

  /** Lets go of everything (focus lost, menu opened): nothing stays held. */
  release(): void {
    this.keys.clear();
    this.lmb = false;
    this.queued = [];
  }

  /** Movement from the keys. */
  move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }

  /** Fills the frame. `toWorld` turns the mouse into a world point; the hero is at (px, py). */
  fill(f: InputFrame, toWorld: (x: number, y: number) => { x: number; y: number }, px: number, py: number): void {
    const m = this.move();
    if (m.x || m.y) {
      f.mx = m.x;
      f.my = m.y;
    }
    if (this.mouse) {
      const w = toWorld(this.mouse.x, this.mouse.y);
      f.aimX = w.x;
      f.aimY = w.y;
      f.aim = Math.atan2(w.y - py, w.x - px);
    }
    const angle = f.aim;
    for (const slot of this.queued) f.casts.push({ slot, angle, dist: null, assist: 0 });
    this.queued = [];
    if (this.lmb && this.mouse) f.holdBasic = { slot: 'basic', angle, dist: null, assist: 0 };
    if (this.potion) f.potion = true;
    if (this.interact) f.interact = true;
    this.potion = false;
    this.interact = false;
  }

  /** Casts a slot from the desktop skill bar (clicked with the mouse). */
  queue(slot: SlotKey): void {
    this.queued.push(slot);
  }

  dispose(): void {
    for (const fn of this.off) fn();
    this.off = [];
    void this.target;
  }
}

/** What the touch controls hold right now; the engine reads it every frame. */
export class TouchState {
  mx = 0;
  my = 0;
  casts: CastRequest[] = [];
  holdBasic: CastRequest | null = null;
  potion = false;
  interact = false;
  aim: AimPreview | null = null;
  lastUsed = 0;

  /** Setters for the touch controls (React handlers call these). */
  setMove(x: number, y: number): void {
    this.mx = x;
    this.my = y;
    if (x || y) this.lastUsed = performance.now();
  }
  setHold(req: CastRequest | null): void {
    this.holdBasic = req;
  }
  setAim(a: AimPreview | null): void {
    this.aim = a;
  }
  push(req: CastRequest): void {
    this.casts.push(req);
  }

  fill(f: InputFrame): void {
    if (this.mx || this.my) {
      f.mx = this.mx;
      f.my = this.my;
    }
    f.casts.push(...this.casts);
    this.casts = [];
    if (this.holdBasic) f.holdBasic = this.holdBasic;
    if (this.potion) f.potion = true;
    if (this.interact) f.interact = true;
    this.potion = false;
    this.interact = false;
  }

  release(): void {
    this.mx = 0;
    this.my = 0;
    this.holdBasic = null;
    this.aim = null;
    this.casts = [];
  }
}
