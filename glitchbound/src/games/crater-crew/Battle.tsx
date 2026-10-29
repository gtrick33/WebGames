/**
 * The battle screen, shared by single-player and live rooms: the canvas (scene.ts runs it, draw.ts
 * paints it), mouse / touch / keyboard controls, and the HUD (whose turn, the clock, the wind, every
 * crew's health, the weapon picker, walk / jump / aim / fire buttons, and tips for a first battle).
 */
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { CHARS } from './characters';
import { drawScene } from './draw';
import { Portrait, WeaponIcon } from './icons';
import { UNIT_HP, type Match, type TurnInput } from './match';
import { Scene, type Hud, type PosMsg } from './scene';
import type { Sfx } from './sound';
import { STEP } from './sim';
import { TERRAINS } from './terrains';
import { WEAPONS, weaponList, type WeaponId } from './weapons';

export interface BattleProps {
  match: Match;
  mine: (crew: number) => boolean;
  onTurn: (turn: number, input: TurnInput) => void;
  onPos?: (p: PosMsg) => void;
  onShown: (m: Match) => void;
  /** The room's clock for the newest turn, in this device's time. */
  clock?: { turn: number; at: number } | null;
  botDelay: number;
  sfx: () => Sfx;
  /** Single player: the battle stops while paused. Live rooms keep going. */
  paused: boolean;
  onPause: () => void;
  muted: boolean;
  onMute: () => void;
  sceneRef?: MutableRefObject<Scene | null>;
  /** Extra buttons in the top row (the room code…). */
  tools?: ReactNode;
  /** Over the battle (the result, the pause sheet, notices). */
  children?: ReactNode;
}

/** Shots fired with the tips showing; they stop after a couple. */
const COACH_KEY = 'glitchbound.crater-crew.coach';
const COACH_SHOTS = 2;
function coachShots(): number {
  try {
    return Number(localStorage.getItem(COACH_KEY)) || 0;
  } catch {
    return COACH_SHOTS;
  }
}
function setCoachShots(n: number): void {
  try {
    localStorage.setItem(COACH_KEY, String(n));
  } catch {
    /* blocked storage: the tips just show again next time */
  }
}

export function Battle(props: BattleProps) {
  const { match } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fireBtn = useRef<HTMLButtonElement>(null);
  const sceneBox = useRef<Scene | null>(null);
  const propsRef = useRef(props);
  const [hud, setHud] = useState<Hud | null>(null);
  const [tray, setTray] = useState(false);
  const [peek, setPeek] = useState<WeaponId | null>(null);
  const [coach, setCoach] = useState(() => typeof window !== 'undefined' && coachShots() < COACH_SHOTS);
  const [touch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  const [toast, setToast] = useState<{ text: string; sub: string; color: string; id: number; mine: boolean } | null>(null);
  // a tall phone only sees a slice of the battlefield
  const [tip, setTip] = useState(() => typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.2);
  useEffect(() => {
    const id = window.setTimeout(() => setTip(false), 5000);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    propsRef.current = props;
  });

  // the scene lives as long as the screen; new states of the battle are pushed into it
  useEffect(() => {
    const p = propsRef.current;
    const opts = {
      match: p.match,
      mine: (c: number) => propsRef.current.mine(c),
      onTurn: (t: number, i: TurnInput) => {
        if (i.fire) {
          const n = coachShots() + 1;
          setCoachShots(n);
          if (n >= COACH_SHOTS) setCoach(false);
        }
        setTray(false);
        propsRef.current.onTurn(t, i);
      },
      onPos: p.onPos ? (x: PosMsg) => propsRef.current.onPos?.(x) : undefined,
      onHud: (h: Hud) => setHud(h),
      onShown: (m: Match) => {
        const crew = m.crews[m.crewTurn];
        if (!m.over && crew) {
          const mine = propsRef.current.mine(m.crewTurn);
          setToast({ text: mine ? 'Your turn!' : `${crew.name}’s turn`, sub: windLine(m.wind, TERRAINS[m.terrain].windMax), color: CHARS[crew.char].color, id: m.turn, mine });
        }
        if (!propsRef.current.mine(m.crewTurn)) setTray(false);
        propsRef.current.onShown(m);
      },
      sfx: () => propsRef.current.sfx(),
      botDelay: p.botDelay,
    };
    const s = new Scene(opts);
    sceneBox.current = s;
    if (p.sceneRef) p.sceneRef.current = s;
    return () => {
      sceneBox.current = null;
      if (p.sceneRef) p.sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneBox.current?.push(match);
  }, [match]);

  useEffect(() => {
    if (props.clock) sceneBox.current?.setClock(props.clock.turn, props.clock.at);
  }, [props.clock]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1900);
    return () => window.clearTimeout(id);
  }, [toast]);

  // the loop: fixed physics steps, drawing blended between them
  useEffect(() => {
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      sceneBox.current?.resize(r.width, r.height);
    });
    ro.observe(box);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let shownPower = -1;
    let failed = false;
    const frame = (t: number): void => {
      raf = requestAnimationFrame(frame);
      const s = sceneBox.current;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!s) return;
      try {
        if (!(propsRef.current.paused && !propsRef.current.clock)) {
          acc += dt;
          let n = 0;
          while (acc >= STEP && n < 12) {
            s.step(STEP);
            acc -= STEP;
            n++;
          }
          if (n === 12) acc = 0;
        }
        drawScene(ctx, s, dpr, Math.min(1, acc / STEP));
      } catch (e) {
        // one bad frame must not end the battle: report it once and keep going
        if (!failed) console.error('Crater Crew frame failed', e);
        failed = true;
      }
      // the fire button's ring fills with the power (no React render per frame)
      const power = Math.round(s.power);
      if (power !== shownPower && fireBtn.current) {
        shownPower = power;
        fireBtn.current.style.setProperty('--p', String(power));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const trayOpen = useRef(tray);
  useEffect(() => {
    trayOpen.current = tray;
  }, [tray]);

  // keyboard
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean): void => {
      const s = sceneBox.current;
      if (!s || (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
      const k = e.key;
      const map: Record<string, keyof Scene['keys']> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
      if (map[k]) {
        s.keys[map[k]!] = down;
        e.preventDefault();
        return;
      }
      if (k === ' ') {
        // never also "click" a focused button
        e.preventDefault();
        if (down && !e.repeat) {
          setTray(false);
          s.pressFire();
        }
        if (!down) s.releaseFire();
        return;
      }
      if (!down || e.repeat) return;
      if (k === 'Enter' || k === 'j' || k === 'J') {
        e.preventDefault();
        s.jump();
      } else if (/^[1-7]$/.test(k)) {
        s.pickWeapon(weaponList()[Number(k) - 1]!.id);
        setTray(false);
      } else if (k === 'q' || k === 'Q' || k === 'e' || k === 'E' || k === 'Tab') {
        e.preventDefault();
        const list = weaponList().filter((w) => (s.shown.crews[s.shown.crewTurn]?.ammo[w.id] ?? 0) !== 0);
        const i = list.findIndex((w) => w.id === s.weapon);
        const next = list[(i + (k === 'q' || k === 'Q' ? list.length - 1 : 1)) % list.length];
        if (next) s.pickWeapon(next.id);
      } else if (k === 'z' || k === 'Z') overview(s);
      else if (k === 'Escape') {
        if (trayOpen.current) setTray(false);
        else propsRef.current.onPause();
      } else if (k === 'p' || k === 'P') propsRef.current.onPause();
    };
    const down = (e: KeyboardEvent): void => set(e, true);
    const up = (e: KeyboardEvent): void => set(e, false);
    const blur = (): void => {
      const s = sceneBox.current;
      if (!s) return;
      s.cancelFire();
      s.keys = { left: false, right: false, up: false, down: false, charge: false };
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  // pointer: drag to aim on your turn (or pan when watching), two fingers or right-drag to pan and pinch, wheel to zoom
  const ptrs = useRef(new Map<number, { x: number; y: number; pan: boolean }>());
  const pinch = useRef<number | null>(null);
  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onDown = (e: React.PointerEvent): void => {
    const s = sceneBox.current;
    if (!s) return;
    canvas.current?.setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    const pan = e.button === 2 || e.button === 1 || !s.myTurn || ptrs.current.size > 0;
    ptrs.current.set(e.pointerId, { x, y, pan });
    if (ptrs.current.size === 2) {
      for (const p of ptrs.current.values()) p.pan = true;
      const [a, b] = [...ptrs.current.values()];
      pinch.current = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    } else if (!pan) s.aimAt(...s.toWorld(x, y));
  };
  const onMove = (e: React.PointerEvent): void => {
    const s = sceneBox.current;
    const p = ptrs.current.get(e.pointerId);
    if (!s || !p) return;
    const [x, y] = local(e);
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const before = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
      p.x = x;
      p.y = y;
      const [a2, b2] = [...ptrs.current.values()];
      const mid = { x: (a2!.x + b2!.x) / 2, y: (a2!.y + b2!.y) / 2 };
      const d = Math.hypot(a2!.x - b2!.x, a2!.y - b2!.y);
      s.pan(mid.x - before.x, mid.y - before.y);
      if (pinch.current) s.zoom(d / pinch.current, mid.x, mid.y);
      pinch.current = d;
      return;
    }
    if (p.pan) s.pan(x - p.x, y - p.y);
    else s.aimAt(...s.toWorld(x, y));
    p.x = x;
    p.y = y;
  };
  const onUp = (e: React.PointerEvent): void => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
  };
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const wheel = (e: WheelEvent): void => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      sceneBox.current?.zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    cv.addEventListener('wheel', wheel, { passive: false });
    return () => cv.removeEventListener('wheel', wheel);
  }, []);

  const hold = (key: 'left' | 'right' | 'up' | 'down') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (sceneBox.current) sceneBox.current.keys[key] = true;
    },
    onPointerUp: () => {
      if (sceneBox.current) sceneBox.current.keys[key] = false;
    },
    onPointerCancel: () => {
      if (sceneBox.current) sceneBox.current.keys[key] = false;
    },
    onLostPointerCapture: () => {
      if (sceneBox.current) sceneBox.current.keys[key] = false;
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const crew = hud ? match.crews[hud.crew] : undefined;
  const turnColor = crew ? CHARS[crew.char].color : '#fff';
  const weapon = hud?.weapon ?? 'rocket';
  const def = WEAPONS[weapon];
  const ammo = hud?.ammo;
  const max = match.crewSize * UNIT_HP;
  const aiming = !!hud?.mine && hud.stage === 'aim';
  const shown = peek ?? weapon;
  return (
    <div className="cc-battle" ref={wrap}>
      <canvas
        ref={canvas}
        className="cc-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Battlefield. Drag to aim on your turn, two fingers to look around."
      />
      <div className="cc-hud-top">
        <div className="cc-row">
          <button className="cc-icon" onClick={props.onPause} aria-label="Pause">
            II
          </button>
          <GameMenuButton className="cc-icon" />
          <div className="cc-crews" aria-label="Crews’ health">
            {match.crews.map((c, i) => {
              const hp = hud?.health[i] ?? max;
              return (
                <div key={i} className={`cc-crewbar${hud?.crew === i && !hud.over ? ' is-turn' : ''}${hp <= 0 ? ' is-out' : ''}`} style={{ ['--c' as string]: CHARS[c.char].color }} title={c.name}>
                  <Portrait char={c.char} size={18} />
                  <span className="cc-crewname">{c.name}</span>
                  <span className="cc-bar">
                    <i style={{ width: `${Math.max(0, Math.round((hp / max) * 100))}%` }} />
                  </span>
                  <em>{Math.max(0, Math.round(hp))}</em>
                </div>
              );
            })}
          </div>
        </div>
        <div className="cc-turn" aria-live="polite" style={{ ['--c' as string]: turnColor }}>
          {hud && !hud.over && crew && (
            <>
              <Portrait char={crew.char} size={26} />
              <b>{hud.mine ? 'Your turn' : crew.name}</b>
              {hud.secs >= 0 && <span className={`cc-clock${hud.secs <= 5 ? ' is-low' : ''}`}>{hud.secs}</span>}
            </>
          )}
        </div>
        <div className="cc-row is-right">
          {hud && <Wind wind={hud.wind} max={TERRAINS[match.terrain].windMax} />}
          {props.tools}
          <button className="cc-icon" onClick={props.onMute} aria-label={props.muted ? 'Sound on' : 'Sound off'}>
            {props.muted ? '🔇' : '🔊'}
          </button>
          <button className="cc-icon" onClick={() => sceneBox.current && overview(sceneBox.current)} aria-label="Zoom out to the whole map" title="Whole map (Z)">
            ⤢
          </button>
        </div>
      </div>
      {tip && <div className="cc-tip">Tip: turn your phone sideways to see more of the battlefield</div>}
      {hud?.sudden && !hud.over && <div className="cc-sudden">Sudden death: {TERRAINS[match.terrain].liquid.name} is rising!</div>}
      {toast && (
        <div key={toast.id} className={`cc-toast${toast.mine ? ' is-mine' : ''}`} style={{ ['--c' as string]: toast.color }}>
          <b>{toast.text}</b>
          {toast.sub && <small>{toast.sub}</small>}
        </div>
      )}
      {aiming && coach && !tray && (
        <div className="cc-coach" role="note">
          <button className="cc-coach-x" onClick={() => {
              setCoach(false);
              setCoachShots(COACH_SHOTS);
            }} aria-label="Hide tips">
            ×
          </button>
          <p>
            <b>Aim</b> {def.aim === 'target' ? (touch ? 'Tap the battlefield where the meteors should fall' : 'Click the battlefield where the meteors should fall') : def.aim === 'drop' ? 'No aiming needed: it drops at your feet' : touch ? 'Drag anywhere on the battlefield' : 'Drag on the battlefield, or ↑ ↓'}
          </p>
          <p>
            <b>Fire</b> {def.aim === 'power' ? (touch ? 'Hold FIRE to power up, let go to shoot' : 'Hold Space (or FIRE) to power up, let go to shoot') : touch ? 'Tap FIRE' : 'Press Space or FIRE'}
          </p>
          <p>
            <b>Move</b> {touch ? '◀ ▶ walk, JUMP hops. Tap the weapon to switch' : '← → walk, Enter jumps, 1–7 or Q / E switch weapons'}
          </p>
        </div>
      )}
      {aiming ? (
        <div className="cc-controls">
          <div className="cc-pad cc-move">
            <button className="cc-btn" {...hold('left')} aria-label="Walk left">
              ◀
            </button>
            <button className="cc-btn is-jump" onPointerDown={(e) => (e.preventDefault(), sceneBox.current?.jump())} aria-label="Jump">
              <span aria-hidden="true">⤴</span>
              <small>JUMP</small>
            </button>
            <button className="cc-btn" {...hold('right')} aria-label="Walk right">
              ▶
            </button>
          </div>
          <button className={`cc-weapon${tray ? ' is-open' : ''}`} onClick={() => {
              setPeek(null);
              setTray((v) => !v);
            }}
            aria-expanded={tray} aria-label={`Weapon: ${def.name}. Change weapon`}>
            <WeaponIcon w={weapon} size={36} />
            <span>
              <b>{def.name}</b>
              <small>{hud.needsTarget ? 'Tap the map to aim' : ammo && ammo[weapon] > 0 ? `${ammo[weapon]} left · Change` : 'Change weapon'}</small>
            </span>
            <i className="cc-caret" aria-hidden="true">
              ▴
            </i>
          </button>
          <div className="cc-pad cc-shoot">
            {(def.aim === 'power' || def.aim === 'line' || def.aim === 'swing') && (
              <div className="cc-aimpad">
                <button className="cc-btn is-small" {...hold('up')} aria-label="Aim up">
                  ▲
                </button>
                <button className="cc-btn is-small" {...hold('down')} aria-label="Aim down">
                  ▼
                </button>
              </div>
            )}
            <button
              ref={fireBtn}
              className={`cc-fire${def.aim === 'power' ? ' is-power' : ''}`}
              disabled={!hud.canFire}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                setTray(false);
                sceneBox.current?.pressFire();
              }}
              onPointerUp={() => sceneBox.current?.releaseFire()}
              onPointerCancel={() => sceneBox.current?.cancelFire()}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={def.aim === 'power' ? 'Fire: hold for power, release to shoot' : 'Fire'}
            >
              <span>FIRE</span>
              {def.aim === 'power' && <small>hold</small>}
            </button>
          </div>
        </div>
      ) : (
        hud &&
        !hud.over &&
        crew &&
        !hud.mine && (
          <div className="cc-watching" style={{ ['--c' as string]: turnColor }}>
            {crew.bot ? `${crew.name} is aiming…` : `Watching ${crew.name}…`}
          </div>
        )
      )}
      {tray && aiming && (
        <>
          <div className="cc-tray-shade" onPointerDown={() => setTray(false)} aria-hidden="true" />
          <div className="cc-tray" role="dialog" aria-label="Pick a weapon">
            <div className="cc-tray-grid">
              {weaponList().map((w, i) => {
                const left = ammo?.[w.id] ?? 0;
                return (
                  <button
                    key={w.id}
                    className={`cc-wcard${w.id === weapon ? ' is-on' : ''}`}
                    disabled={left === 0}
                    onPointerEnter={() => setPeek(w.id)}
                    onPointerLeave={() => setPeek(null)}
                    onFocus={() => setPeek(w.id)}
                    onClick={() => {
                      sceneBox.current?.pickWeapon(w.id as WeaponId);
                      setTray(false);
                    }}
                  >
                    <WeaponIcon w={w.id} size={42} />
                    <b>{w.name}</b>
                    <em className={left > 0 ? 'is-few' : ''}>{left < 0 ? '∞' : `×${left}`}</em>
                    <kbd>{i + 1}</kbd>
                  </button>
                );
              })}
            </div>
            <p className="cc-tray-hint">
              <b>{WEAPONS[shown].name}</b> {WEAPONS[shown].hint}
            </p>
          </div>
        </>
      )}
      {props.children}
    </div>
  );
}

/** Zooms out to show the whole map (and back). */
function overview(s: Scene): void {
  const fit = Math.min(s.cam.vw / 1900, s.cam.vh / 1000);
  if (s.cam.z > fit * 1.2) s.zoom(fit / s.cam.z, s.cam.vw / 2, s.cam.vh / 2);
  else s.zoom(s.defaultZoom() / s.cam.z, s.cam.vw / 2, s.cam.vh / 2);
}

/** The wind in words, for the turn banner. */
function windLine(wind: number, max: number): string {
  if (max === 0) return 'No wind here';
  if (wind === 0) return 'No wind this turn';
  const k = Math.abs(wind) / max;
  return `${k > 0.66 ? 'Strong' : k > 0.33 ? 'Steady' : 'Light'} wind to the ${wind > 0 ? 'right →' : '← left'}`;
}

/** A gauge from the middle: the bar runs the way the wind blows, as far as it is strong. */
function Wind({ wind, max }: { wind: number; max: number }) {
  const calm = max === 0 || wind === 0;
  const k = max ? Math.min(1, Math.abs(wind) / max) : 0;
  const label = max === 0 ? 'No wind' : wind === 0 ? 'Calm' : `Wind ${wind > 0 ? '→' : '←'}`;
  return (
    <div className="cc-wind" aria-label={calm ? 'No wind' : `Wind ${Math.abs(wind)} of ${max} to the ${wind > 0 ? 'right' : 'left'}`} title="Wind: rockets, splitters and meteors drift with it">
      <small>{label}</small>
      <span className="cc-wind-bar">
        {!calm && <i className={wind < 0 ? 'is-l' : 'is-r'} style={{ width: `${Math.max(12, k * 50)}%` }} />}
      </span>
    </div>
  );
}
