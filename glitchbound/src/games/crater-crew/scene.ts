/**
 * The battle on screen. It holds the turn being shown and its physics world, and moves through the
 * turn's stages: your own turn (your inputs drive the sim live and are recorded step by step), a
 * replay of someone else's turn (their walk, a swing of the aim, then the shot, all through the same
 * physics) and the pause while everything settles. Results that arrive early queue up. Also the
 * camera, the aim and power, and what the HUD shows. Drawing lives in draw.ts.
 */
import { CHARS } from './characters';
import { canFire, endTurn, hasAmmo, MAX_WALK, playWalk, worldFor, crewHealth, suddenDeath, type Match, type TurnInput } from './match';
import { clamp } from './math';
import { fire, IN_JUMP, IN_LEFT, IN_RIGHT, MAX_SHOT_STEPS, settled, settleUnit, stepWorld, walkStep, type Fire, type Unit, type World } from './sim';
import { H, W } from './terrain';
import { TERRAINS } from './terrains';
import { WEAPONS, type WeaponId } from './weapons';
import { Backdrop, type Cam } from './render/backdrop';
import { Fx } from './render/fx';
import { GroundPainter } from './render/ground';
import type { Sfx } from './sound';

/** The active player's position and aim as streamed to the others. */
export interface PosMsg {
  x: number;
  y: number;
  f: number;
  a: number;
  w: string;
  p: number;
  mv: number;
  tx: number;
}

export interface Hud {
  turn: number;
  crew: number;
  mine: boolean;
  stage: Stage['k'];
  /** Seconds left on the turn's clock (-1: not running). */
  secs: number;
  wind: number;
  weapon: WeaponId;
  ammo: Record<WeaponId, number> | null;
  canFire: boolean;
  needsTarget: boolean;
  health: number[];
  sudden: boolean;
  /** The shown battle is over. */
  over: boolean;
}

export type Stage =
  | { k: 'intro'; until: number }
  | { k: 'aim' }
  | { k: 'think'; until: number; next: Match }
  | { k: 'swing'; t: number; from: number; next: Match }
  | { k: 'shot'; steps: number; next: Match | null; fired: boolean }
  | { k: 'settle'; until: number; next: Match | null }
  | { k: 'over' };

export interface SceneOpts {
  match: Match;
  mine: (crew: number) => boolean;
  onTurn: (turn: number, input: TurnInput) => void;
  onPos?: (p: PosMsg) => void;
  onHud: (h: Hud) => void;
  /** A new turn started showing (or the battle ended on screen). */
  onShown: (m: Match) => void;
  sfx: () => Sfx;
  /** How long a computer crew seems to think before its shot (the room already waited in live play). */
  botDelay: number;
}

export interface Keys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  charge: boolean;
}

const SWING_MS = 520;
const SETTLE_MS = 900;
const now = (): number => Date.now();
const CREW_COLORS = Object.fromEntries(Object.values(CHARS).map((c) => [c.id, c.color])) as Record<string, string>;

export class Scene {
  shown: Match;
  world: World;
  painter: GroundPainter;
  back: Backdrop;
  fx: Fx;
  stage: Stage;
  readonly cam: Cam = { x: W / 2, y: 500, z: 1, vw: 800, vh: 450 };
  /** Seconds since the scene started (animations). */
  t = 0;
  /** The player asked for less motion: no screen shake. */
  readonly reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  keys: Keys = { left: false, right: false, up: false, down: false, charge: false };
  private jumpQueued = false;
  private fireQueued = false;
  aim = 450;
  dir: 1 | -1 = 1;
  power = 0;
  weapon: WeaponId = 'rocket';
  /** Meteor Shower's target (world x), -1 for none yet. */
  tx = -1;
  /** The aim and weapon shown while replaying someone else's turn (yours stay as you left them). */
  shownAim = 450;
  shownWeapon: WeaponId = 'rocket';
  private rec: number[] = [];
  private committed = -1;
  private clock: { turn: number; at: number } | null = null;
  clockAt = 0;
  remote: (PosMsg & { at: number; turn: number; unit: number }) | null = null;
  private remoteShown: { x: number; y: number } | null = null;
  private pending: Match[] = [];
  private manualUntil = 0;
  private focus: { x: number; y: number; until: number } | null = null;
  /** Per-unit animation: walk phase, last x, last hurt time. */
  anim = new Map<number, { walk: number; lastX: number; hurtAt: number; moving: number }>();
  private lastHud = '';
  private lastTick = -1;
  private relayStep = 0;
  /** Previous positions, for drawing between physics steps. */
  prev = new WeakMap<object, { x: number; y: number }>();

  constructor(private opts: SceneOpts) {
    this.shown = opts.match;
    this.world = worldFor(this.shown);
    this.painter = new GroundPainter(this.shown.terrain, this.world.mask, this.shown.seed);
    this.painter.reset(this.world.mask, this.shown.craters);
    this.back = new Backdrop(this.shown.terrain, this.shown.seed);
    this.fx = this.makeFx();
    this.stage = this.shown.turn === 0 && !this.shown.over ? { k: 'intro', until: now() + 1800 } : { k: 'aim' };
    if (this.stage.k === 'aim') this.startTurn();
    const u = this.activeUnit();
    if (u) {
      this.cam.x = u.x;
      this.cam.y = u.y - 60;
    }
  }

  private makeFx(): Fx {
    const d = TERRAINS[this.shown.terrain];
    return new Fx([d.soil.light, d.soil.dark, d.top.color, d.soil.speck], d.liquid.top);
  }

  setOpts(o: SceneOpts): void {
    this.opts = o;
  }

  activeUnit(): Unit | undefined {
    return this.world.units.find((u) => u.id === this.shown.active);
  }

  get myTurn(): boolean {
    return this.stage.k === 'aim' && !this.shown.over && this.opts.mine(this.shown.crewTurn) && this.committed !== this.shown.turn;
  }

  /** The room's clock for a turn (its server time already turned into this device's). */
  setClock(turn: number, at: number): void {
    this.clock = { turn, at };
    if (this.shown.turn === turn && this.stage.k === 'aim') this.clockAt = at;
  }

  /** A newer state of the battle (the room's view, or the single-player game's). */
  push(m: Match): void {
    if (m.seed !== this.shown.seed || m.terrain !== this.shown.terrain || m.turn < this.shown.turn || m.crews.length !== this.shown.crews.length) return this.reset(m);
    if (m.turn === this.shown.turn) return;
    if (this.pending.some((p) => p.turn === m.turn)) return;
    this.pending.push(m);
    this.pending.sort((a, b) => a.turn - b.turn);
    // far behind (a phone that slept): jump straight to the newest
    if (this.pending.length > 3) this.reset(this.pending[this.pending.length - 1]!);
  }

  /** Shows a battle from scratch (a new battle, or one this phone fell behind on). */
  reset(m: Match): void {
    const fresh = m.seed !== this.shown.seed || m.terrain !== this.shown.terrain;
    this.shown = m;
    this.pending = [];
    this.world = worldFor(m);
    if (fresh) {
      this.painter = new GroundPainter(m.terrain, this.world.mask, m.seed);
      this.back = new Backdrop(m.terrain, m.seed);
      this.fx = this.makeFx();
    }
    this.painter.reset(this.world.mask, m.craters);
    this.committed = -1;
    this.anim.clear();
    if (fresh && m.turn === 0) this.stage = { k: 'intro', until: now() + 1800 };
    else this.startTurn();
  }

  private startTurn(): void {
    const m = this.shown;
    if (m.over) {
      this.stage = { k: 'over' };
      this.opts.sfx().chargeStop();
      this.opts.onShown(m);
      return;
    }
    this.stage = { k: 'aim' };
    this.rec = [];
    this.power = 0;
    this.fireQueued = false;
    this.jumpQueued = false;
    this.tx = -1;
    this.remote = null;
    this.remoteShown = null;
    this.clockAt = this.clock && this.clock.turn === m.turn ? this.clock.at : now();
    const u = this.activeUnit();
    if (u) this.dir = u.facing;
    // your weapon stays picked from turn to turn, until it runs out
    if (this.opts.mine(m.crewTurn) && !hasAmmo(m, m.crewTurn, this.weapon)) this.weapon = 'rocket';
    this.shownAim = 450;
    this.lastTick = -1;
    this.manualUntil = 0;
    this.opts.sfx().turn(this.opts.mine(m.crewTurn));
    this.opts.onShown(m);
  }

  // ------------------------------------------------------------ input from the HUD and keyboard

  jump(): void {
    if (this.myTurn) this.jumpQueued = true;
  }

  pressFire(): void {
    if (!this.myTurn) return;
    const def = WEAPONS[this.weapon];
    if (def.aim === 'power') this.keys.charge = true;
    else this.fireQueued = true;
  }

  releaseFire(): void {
    if (this.keys.charge) {
      this.keys.charge = false;
      if (this.myTurn && this.power > 0) this.fireQueued = true;
    }
  }

  pickWeapon(w: WeaponId): void {
    if (!this.myTurn || !hasAmmo(this.shown, this.shown.crewTurn, w)) return;
    this.weapon = w;
    this.power = 0;
    this.keys.charge = false;
    this.opts.sfx().chargeStop();
    this.opts.sfx().select();
  }

  /** Aim at a point on the map (a tap or a drag); Meteor Shower takes it as its target. */
  aimAt(wx: number, wy: number): void {
    if (!this.myTurn) return;
    const u = this.activeUnit();
    if (!u) return;
    if (WEAPONS[this.weapon].aim === 'target') {
      this.tx = Math.round(clamp(wx, 0, W));
      return;
    }
    const dx = wx - u.x;
    const dy = wy - (u.y - 11);
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    this.dir = dx >= 0 ? 1 : -1;
    this.aim = Math.round(clamp((Math.atan2(-dy, Math.abs(dx)) * 1800) / Math.PI, -850, 850));
  }

  pan(dx: number, dy: number): void {
    this.cam.x -= dx / this.cam.z;
    this.cam.y -= dy / this.cam.z;
    this.manualUntil = now() + 3500;
    this.clampCam();
  }

  zoom(f: number, sx?: number, sy?: number): void {
    const { vw, vh } = this.cam;
    const zMin = Math.min(vw / (W + 300), vh / (H + 200));
    const before = this.cam.z;
    this.cam.z = clamp(this.cam.z * f, zMin, 2.4);
    if (sx !== undefined && sy !== undefined) {
      // keep the point under the fingers still
      const wx = this.cam.x + (sx - vw / 2) / before;
      const wy = this.cam.y + (sy - vh / 2) / before;
      this.cam.x = wx - (sx - vw / 2) / this.cam.z;
      this.cam.y = wy - (sy - vh / 2) / this.cam.z;
    }
    this.manualUntil = now() + 3500;
    this.clampCam();
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [this.cam.x + (sx - this.cam.vw / 2) / this.cam.z, this.cam.y + (sy - this.cam.vh / 2) / this.cam.z];
  }

  toScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.cam.x) * this.cam.z + this.cam.vw / 2, (wy - this.cam.y) * this.cam.z + this.cam.vh / 2];
  }

  resize(vw: number, vh: number): void {
    const first = this.cam.vw === 800 && this.cam.vh === 450;
    this.cam.vw = vw;
    this.cam.vh = vh;
    if (first) this.cam.z = this.defaultZoom();
    this.clampCam();
  }

  defaultZoom(): number {
    const { vw, vh } = this.cam;
    // a tall phone sees a slice of the map: keep the slice wide enough to find the others
    const want = vh > vw ? vw / 600 : Math.max(vw / 920, vh / 540);
    return clamp(want, Math.min(vw / (W + 300), vh / (H + 200)), 1.8);
  }

  private clampCam(): void {
    const c = this.cam;
    const hw = c.vw / 2 / c.z;
    const hh = c.vh / 2 / c.z;
    c.x = hw * 2 > W + 300 ? W / 2 : clamp(c.x, hw - 150, W + 150 - hw);
    const bottom = this.world.liquidY + 110;
    c.y = hh * 2 > bottom + 300 ? bottom - hh : clamp(c.y, -300 + hh, bottom - hh);
  }

  // ------------------------------------------------------------ the fixed step

  step(dt: number): void {
    this.t += dt;
    for (const u of this.world.units) this.prev.set(u, { x: u.x, y: u.y });
    for (const p of this.world.projs) this.prev.set(p, { x: p.x, y: p.y });
    switch (this.stage.k) {
      case 'intro':
        if (now() >= this.stage.until) this.startTurn();
        break;
      case 'aim':
        // a result for this turn already (the room passed it, or it isn't mine): show that
        if (this.pending.some((p) => p.last?.turn === this.shown.turn)) this.watchStep();
        else if (this.myTurn) this.myStep();
        break;
      case 'think':
        if (now() >= this.stage.until) this.stage = { k: 'swing', t: 0, from: this.shownAim, next: this.stage.next };
        break;
      case 'swing': {
        const s = this.stage;
        s.t += dt * 1000;
        const f = s.next.last!.input.fire!;
        const k = Math.min(1, s.t / SWING_MS);
        this.shownAim = s.from + (f.aim - s.from) * (1 - (1 - k) * (1 - k));
        this.dir = f.dir;
        if (s.t >= SWING_MS) this.replayFire(s.next);
        break;
      }
      case 'shot':
        this.shotStep();
        break;
      case 'settle': {
        const s = this.stage;
        s.next ??= this.pending.find((p) => p.last?.turn === this.shown.turn) ?? null;
        if (s.next && now() >= s.until) this.finish(s.next);
        break;
      }
      case 'over':
        break;
    }
    this.fx.step(dt, this.world.gravity);
    this.follow(dt);
    this.animate();
    this.hud();
  }

  private myStep(): void {
    const u = this.activeUnit();
    const w = this.world;
    if (!u || u.drowned || u.hp <= 0) return this.commit(null);
    const def = WEAPONS[this.weapon];
    let bits = 0;
    if (!this.keys.charge) {
      if (this.keys.left) bits |= IN_LEFT;
      if (this.keys.right) bits |= IN_RIGHT;
      if (this.jumpQueued) bits |= IN_JUMP;
    }
    this.jumpQueued = false;
    if (this.rec.length < MAX_WALK) {
      const air = u.air;
      walkStep(w, u.id, bits);
      this.rec.push(bits);
      if (bits & (IN_LEFT | IN_RIGHT)) this.dir = u.facing;
      if (!air && u.air && bits & IN_JUMP) this.opts.sfx().jump();
    }
    this.drain();
    if (this.keys.up) this.aim = Math.min(850, this.aim + 10);
    if (this.keys.down) this.aim = Math.max(-850, this.aim - 10);
    if (this.keys.charge && def.aim === 'power') {
      this.power = Math.min(100, this.power + 100 / 96);
      this.opts.sfx().charge(this.power);
      if (this.power >= 100) this.fireQueued = true;
    }
    const left = this.clockAt + this.shown.turnSecs * 1000 - now();
    if (left <= 0) return this.commit(null);
    if (u.drowned) return this.commit(null);
    if (this.fireQueued && !u.air) {
      this.fireQueued = false;
      if (def.aim === 'target' && this.tx < 0) return;
      this.commit({ w: this.weapon, aim: def.aim === 'drop' || def.aim === 'target' ? 0 : this.aim, dir: this.dir, power: def.aim === 'power' ? Math.max(1, Math.round(this.power)) : 0, tx: Math.max(0, this.tx) });
      return;
    }
    if (this.opts.onPos && ++this.relayStep % 6 === 0)
      this.opts.onPos({ x: Math.round(u.x), y: Math.round(u.y), f: this.dir, a: this.aim, w: this.weapon, p: Math.round(this.power), mv: u.air ? 2 : bits & (IN_LEFT | IN_RIGHT) ? 1 : 0, tx: Math.max(0, this.tx) });
  }

  /** Ends my turn: the recorded walk and the shot (or none), sent off and played here at once. */
  private commit(f: Fire | null): void {
    const walk: [number, number][] = [];
    for (const b of this.rec) {
      const last = walk[walk.length - 1];
      if (last && last[0] === b) last[1]++;
      else walk.push([b, 1]);
    }
    const input: TurnInput = { walk, fire: f };
    const id = this.shown.active;
    settleUnit(this.world, id);
    const fired = canFire(this.shown, this.world, f);
    if (fired) fire(this.world, id, f!);
    this.committed = this.shown.turn;
    this.keys.charge = false;
    this.opts.sfx().chargeStop();
    this.stage = { k: 'shot', steps: 0, next: null, fired };
    this.drain();
    this.opts.onTurn(this.shown.turn, input);
  }

  private watchStep(): void {
    const next = this.pending.find((p) => p.last?.turn === this.shown.turn);
    if (!next) return;
    this.pending = this.pending.filter((p) => p !== next);
    const input = next.last!.input;
    const id = this.shown.active;
    if (this.rec.length) {
      // I had started walking, but the room moved on without my turn: start from where it began
      this.world = worldFor(this.shown);
      this.painter.setMask(this.world.mask);
      this.rec = [];
    }
    this.committed = -1;
    playWalk(this.world, id, input.walk);
    this.world.events = this.world.events.filter((e) => e.t === 'hurt' || e.t === 'drown' || e.t === 'splash');
    this.drain();
    const u = this.activeUnit();
    if (u) this.dir = u.facing;
    this.shownAim = this.remote?.turn === this.shown.turn ? this.remote.a : this.shownAim;
    if (input.fire && canFire(this.shown, this.world, input.fire)) {
      const bot = !!this.shown.crews[this.shown.crewTurn]?.bot;
      this.shownWeapon = input.fire.w;
      this.stage = { k: 'think', until: now() + (bot ? this.opts.botDelay : 120), next };
    } else this.stage = { k: 'shot', steps: 0, next, fired: false };
  }

  private replayFire(next: Match): void {
    const f = next.last!.input.fire!;
    this.shownAim = f.aim;
    fire(this.world, this.shown.active, f);
    this.stage = { k: 'shot', steps: 0, next, fired: true };
    this.drain();
  }

  private shotStep(): void {
    const s = this.stage as Extract<Stage, { k: 'shot' }>;
    if (!settled(this.world) && s.steps < MAX_SHOT_STEPS) {
      stepWorld(this.world);
      s.steps++;
      for (const p of this.world.projs) if (p.kind === 'rocket' || p.kind === 'meteor' || p.kind === 'splitter') if (s.steps % 2 === 0) this.fx.trail(p.x, p.y, p.kind !== 'splitter');
      this.drain();
      return;
    }
    this.world.projs = [];
    this.stage = { k: 'settle', until: now() + SETTLE_MS, next: s.next ?? this.pending.find((p) => p.last?.turn === this.shown.turn) ?? null };
  }

  /** The turn has played out: check it against the room's result and move on to the next turn. */
  private finish(next: Match): void {
    this.pending = this.pending.filter((p) => p !== next && p.turn > next.turn);
    const expected = endTurn(this.shown, this.world, next.last!.input, false);
    const sameUnits = JSON.stringify(expected.units) === JSON.stringify(next.units);
    const sameGround = expected.craters.length === next.craters.length && expected.craters.every((v, i) => v === next.craters[i]);
    this.shown = next;
    this.world = worldFor(next);
    // the same ground: already painted, scorch marks and all
    if (sameGround) this.painter.setMask(this.world.mask);
    else this.painter.reset(this.world.mask, next.craters);
    if (!sameUnits || !sameGround) this.anim.clear();
    this.startTurn();
  }

  /** Sounds and sparks for what the physics just did. */
  private drain(): void {
    const sfx = this.opts.sfx();
    for (const e of this.world.events) {
      switch (e.t) {
        case 'boom':
          this.fx.boom(e.x, e.y, e.r);
          if (e.r > 10) this.painter.blast(e.x, e.y, e.r);
          sfx.boom(e.r);
          this.focus = { x: e.x, y: e.y, until: now() + 700 };
          break;
        case 'hurt': {
          const u = this.world.units.find((x) => x.id === e.unit);
          if (u) {
            this.fx.text(`-${e.dmg}`, u.x, u.y - 34, this.crewColor(u.crew));
            const a = this.animOf(u);
            a.hurtAt = this.t;
            sfx.hurt();
          }
          break;
        }
        case 'splash':
          this.fx.splash(e.x, e.y, e.big);
          sfx.splash(e.big);
          break;
        case 'drown': {
          const u = this.world.units.find((x) => x.id === e.unit);
          if (u) this.fx.text('Splash!', u.x, this.world.liquidY - 20, '#ffffff', 16);
          break;
        }
        case 'bounce':
          sfx.bounce();
          break;
        case 'launch':
          sfx.launch(e.w);
          break;
        case 'zap':
          this.fx.zap(e.x0, e.y0, e.x1, e.y1);
          sfx.zap();
          break;
        case 'bonk':
          this.fx.text(e.hit ? 'BONK!' : 'whiff', e.x, e.y - 14, e.hit ? '#ffd23f' : '#ffffff', e.hit ? 20 : 13, 1);
          sfx.bonk(e.hit);
          break;
        case 'land': {
          const u = this.world.units.find((x) => x.id === e.unit);
          if (u && e.hard) this.fx.dust(u.x, u.y);
          sfx.land(e.hard);
          break;
        }
        case 'split':
          this.fx.text('Split!', e.x, e.y - 20, '#ffb020', 14, 0.8);
          break;
        case 'jump':
          break;
      }
    }
    this.world.events = [];
  }

  crewColor(crew: number): string {
    return CREW_COLORS[this.shown.crews[crew]?.char ?? 'frog'] ?? '#ffffff';
  }

  animOf(u: Unit): { walk: number; lastX: number; hurtAt: number; moving: number } {
    let a = this.anim.get(u.id);
    if (!a) this.anim.set(u.id, (a = { walk: -1, lastX: u.x, hurtAt: -10, moving: 0 }));
    return a;
  }

  /** Walk cycles from how far each unit moved this step. */
  private animate(): void {
    for (const u of this.world.units) {
      const a = this.animOf(u);
      const x = this.displayPos(u).x;
      const dx = Math.abs(x - a.lastX);
      a.lastX = x;
      a.moving = dx > 0.05 && !u.air ? Math.min(6, a.moving + 1) : Math.max(0, a.moving - 1);
      if (a.moving > 0) a.walk = ((a.walk < 0 ? 0 : a.walk) + 0.045) % 1;
      else a.walk = -1;
    }
  }

  /** Where a unit is drawn: the streamed position for someone else's live walk. */
  displayPos(u: Unit): { x: number; y: number; f: 1 | -1 } {
    const r = this.remote;
    if (this.stage.k === 'aim' && r && r.unit === u.id && r.turn === this.shown.turn && !this.opts.mine(this.shown.crewTurn)) {
      const s = (this.remoteShown ??= { x: u.x, y: u.y });
      s.x += (r.x - s.x) * 0.25;
      s.y += (r.y - s.y) * 0.25;
      return { x: s.x, y: s.y, f: r.f === -1 ? -1 : 1 };
    }
    if (u.id === this.shown.active && (this.stage.k === 'aim' || this.stage.k === 'think' || this.stage.k === 'swing')) return { x: u.x, y: u.y, f: this.dir };
    return { x: u.x, y: u.y, f: u.facing };
  }

  /** The aim drawn for the active unit right now (yours, the streamed one, or a replay's swing). */
  displayAim(): number {
    if (this.myTurn) return this.aim;
    if (this.stage.k === 'aim' && this.remote?.turn === this.shown.turn) return this.remote.a;
    return this.shownAim;
  }

  private follow(dt: number): void {
    const c = this.cam;
    if (now() < this.manualUntil) return;
    let tx: number | null = null;
    let ty = 0;
    const p = this.world.projs[0];
    if (p && this.stage.k === 'shot') {
      tx = p.x;
      ty = p.y;
    } else if (this.focus && now() < this.focus.until) {
      tx = this.focus.x;
      ty = this.focus.y;
    } else if (this.stage.k === 'shot' || this.stage.k === 'settle') {
      const flying = this.world.units.find((u) => u.air && !u.drowned);
      if (flying) {
        tx = flying.x;
        ty = flying.y;
      }
    }
    if (tx === null) {
      const u = this.activeUnit();
      if (u && this.stage.k !== 'intro') {
        const d = this.displayPos(u);
        tx = d.x + (this.myTurn ? this.dir * 60 : 0);
        ty = d.y - 70;
        if (this.myTurn && WEAPONS[this.weapon].aim === 'target' && this.tx >= 0) tx = (d.x + this.tx) / 2;
      } else {
        // the intro sweeps across the map
        tx = W / 2 + Math.sin(this.t * 0.5) * W * 0.3;
        ty = 420;
      }
    }
    const k = 1 - Math.exp(-dt * (p ? 5 : 3.2));
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    this.clampCam();
  }

  private hud(): void {
    const m = this.shown;
    const mine = this.opts.mine(m.crewTurn) && !m.over;
    const running = this.stage.k === 'aim' && !m.over;
    const secs = running ? Math.max(0, Math.ceil((this.clockAt + m.turnSecs * 1000 - now()) / 1000)) : -1;
    if (running && mine && secs <= 5 && secs > 0 && secs !== this.lastTick) {
      this.lastTick = secs;
      this.opts.sfx().tick();
    }
    const u = this.activeUnit();
    const h: Hud = {
      turn: m.turn,
      crew: m.crewTurn,
      mine,
      stage: this.stage.k,
      secs: Math.min(m.turnSecs, secs),
      wind: m.wind,
      weapon: this.weapon,
      ammo: mine ? (m.crews[m.crewTurn]?.ammo ?? null) : null,
      canFire: this.myTurn && !!u && !u.air && (WEAPONS[this.weapon].aim !== 'target' || this.tx >= 0),
      needsTarget: this.myTurn && WEAPONS[this.weapon].aim === 'target' && this.tx < 0,
      health: crewHealth(m),
      sudden: suddenDeath(m),
      over: m.over,
    };
    const sig = JSON.stringify(h);
    if (sig !== this.lastHud) {
      this.lastHud = sig;
      this.opts.onHud(h);
    }
  }

  /** The stream of someone else's live walk. */
  onRemote(p: PosMsg & { turn: number; unit: number }): void {
    if (p.turn !== this.shown.turn) return;
    this.remote = { ...p, at: now() };
  }

}

