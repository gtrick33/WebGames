/**
 * The battle screen, shared by single-player and live rooms: the canvas (scene.ts runs it, draw.ts
 * paints it), mouse / touch / keyboard controls, and the HUD (whose turn, the clock, the wind, every
 * crew's health, the weapon tray, walk / jump / aim / fire buttons).
 */
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { CHARS } from './characters';
import { drawScene } from './draw';
import { WeaponIcon } from './icons';
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

export function Battle(props: BattleProps) {
  const { match } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneBox = useRef<Scene | null>(null);
  const propsRef = useRef(props);
  const [hud, setHud] = useState<Hud | null>(null);
  const [tray, setTray] = useState(false);
  const [toast, setToast] = useState<{ text: string; color: string; id: number } | null>(null);
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
      onTurn: (t: number, i: TurnInput) => propsRef.current.onTurn(t, i),
      onPos: p.onPos ? (x: PosMsg) => propsRef.current.onPos?.(x) : undefined,
      onHud: (h: Hud) => setHud(h),
      onShown: (m: Match) => {
        const crew = m.crews[m.crewTurn];
        if (!m.over && crew) setToast({ text: propsRef.current.mine(m.crewTurn) ? 'Your turn!' : `${crew.name}’s turn`, color: CHARS[crew.char].color, id: m.turn });
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
    const id = window.setTimeout(() => setToast(null), 1700);
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
    const frame = (t: number): void => {
      raf = requestAnimationFrame(frame);
      const s = sceneBox.current;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!s) return;
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
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

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
        if (down && !e.repeat) s.pressFire();
        if (!down) s.releaseFire();
        return;
      }
      if (!down || e.repeat) return;
      if (k === 'Enter' || k === 'j' || k === 'J') {
        e.preventDefault();
        s.jump();
      } else if (/^[1-7]$/.test(k)) s.pickWeapon(weaponList()[Number(k) - 1]!.id);
      else if (k === 'q' || k === 'Q' || k === 'e' || k === 'E' || k === 'Tab') {
        e.preventDefault();
        const list = weaponList().filter((w) => (s.shown.crews[s.shown.crewTurn]?.ammo[w.id] ?? 0) !== 0);
        const i = list.findIndex((w) => w.id === s.weapon);
        const next = list[(i + (k === 'q' || k === 'Q' ? list.length - 1 : 1)) % list.length];
        if (next) s.pickWeapon(next.id);
      } else if (k === 'z' || k === 'Z') overview(s);
      else if (k === 'Escape' || k === 'p' || k === 'P') propsRef.current.onPause();
    };
    const down = (e: KeyboardEvent): void => set(e, true);
    const up = (e: KeyboardEvent): void => set(e, false);
    const blur = (): void => {
      const s = sceneBox.current;
      if (!s) return;
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
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const crew = hud ? match.crews[hud.crew] : undefined;
  const turnColor = crew ? CHARS[crew.char].color : '#fff';
  const weapon = hud?.weapon ?? 'rocket';
  const ammo = hud?.ammo;
  const max = match.crewSize * UNIT_HP;
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
            {match.crews.map((c, i) => (
              <div key={i} className={`cc-crewbar${hud?.crew === i && !hud.over ? ' is-turn' : ''}${(hud?.health[i] ?? 1) <= 0 ? ' is-out' : ''}`} style={{ ['--c' as string]: CHARS[c.char].color }}>
                <span className="cc-crewname">{c.name}</span>
                <span className="cc-bar">
                  <i style={{ width: `${Math.round(((hud?.health[i] ?? max) / max) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="cc-turn" aria-live="polite">
          {hud && !hud.over && crew && (
            <>
              <b style={{ color: turnColor }}>{hud.mine ? 'Your turn' : crew.name}</b>
              {hud.secs >= 0 && <span className={`cc-clock${hud.secs <= 5 ? ' is-low' : ''}`}>{hud.secs}</span>}
            </>
          )}
        </div>
        <div className="cc-row is-right">
          {hud && <Wind wind={hud.wind} calm={TERRAINS[match.terrain].windMax === 0} />}
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
        <div key={toast.id} className="cc-toast" style={{ ['--c' as string]: toast.color }}>
          {toast.text}
        </div>
      )}
      {hud?.mine && hud.stage === 'aim' ? (
        <div className="cc-controls">
          <div className="cc-pad">
            <button className="cc-btn" {...hold('left')} aria-label="Walk left">
              ◀
            </button>
            <button className="cc-btn" onPointerDown={(e) => (e.preventDefault(), sceneBox.current?.jump())} aria-label="Jump">
              ⤒
            </button>
            <button className="cc-btn" {...hold('right')} aria-label="Walk right">
              ▶
            </button>
          </div>
          <button className="cc-weapon" onClick={() => setTray((v) => !v)} aria-expanded={tray} aria-label={`Weapon: ${WEAPONS[weapon].name}. Change weapon`}>
            <WeaponIcon w={weapon} size={30} />
            <span>
              <b>{WEAPONS[weapon].name}</b>
              <small>{hud.needsTarget ? 'Tap the map to aim' : ammo && ammo[weapon] > 0 ? `${ammo[weapon]} left` : 'Change ▴'}</small>
            </span>
          </button>
          <div className="cc-pad">
            <div className="cc-aimpad">
              <button className="cc-btn is-small" {...hold('up')} aria-label="Aim up">
                ▲
              </button>
              <button className="cc-btn is-small" {...hold('down')} aria-label="Aim down">
                ▼
              </button>
            </div>
            <button
              className="cc-fire"
              disabled={!hud.canFire}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                sceneBox.current?.pressFire();
              }}
              onPointerUp={() => sceneBox.current?.releaseFire()}
              onPointerCancel={() => sceneBox.current?.releaseFire()}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={WEAPONS[weapon].aim === 'power' ? 'Fire: hold for power, release to shoot' : 'Fire'}
            >
              {WEAPONS[weapon].aim === 'power' ? 'HOLD' : 'FIRE'}
            </button>
          </div>
        </div>
      ) : (
        hud &&
        !hud.over &&
        crew && (
          <div className="cc-watching">
            {hud.mine ? '' : crew.bot ? `${crew.name} is aiming…` : `Watching ${crew.name}…`}
          </div>
        )
      )}
      {tray && hud?.mine && (
        <div className="cc-tray" role="dialog" aria-label="Weapons">
          {weaponList().map((w, i) => {
            const left = ammo?.[w.id] ?? 0;
            return (
              <button
                key={w.id}
                className={`cc-wcard${w.id === weapon ? ' is-on' : ''}`}
                disabled={left === 0}
                onClick={() => {
                  sceneBox.current?.pickWeapon(w.id as WeaponId);
                  setTray(false);
                }}
              >
                <WeaponIcon w={w.id} size={34} />
                <b>{w.name}</b>
                <small>{w.hint}</small>
                <em>{left < 0 ? '∞' : `×${left}`}</em>
                <kbd>{i + 1}</kbd>
              </button>
            );
          })}
        </div>
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

function Wind({ wind, calm }: { wind: number; calm: boolean }) {
  const n = Math.abs(wind);
  return (
    <div className="cc-wind" aria-label={calm ? 'No wind' : wind === 0 ? 'No wind' : `Wind ${n} to the ${wind > 0 ? 'right' : 'left'}`} title="Wind">
      <span className="cc-wind-l">{wind < 0 ? Array.from({ length: Math.ceil(n / 2) }, (_, i) => <i key={i} />) : null}</span>
      <b>{calm ? 'NO WIND' : 'WIND'}</b>
      <span className="cc-wind-r">{wind > 0 ? Array.from({ length: Math.ceil(n / 2) }, (_, i) => <i key={i} />) : null}</span>
    </div>
  );
}
