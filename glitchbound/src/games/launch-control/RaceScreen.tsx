import { useEffect, useRef, useState, type RefObject } from 'react';
import { FAILURE_TEXT } from './parts';
import { LANES, type CarLook, type CarState, type Stage3D } from './scene3d';
import { DISTANCE, DT, Race, shiftRpm, type CarSpec, type Driver, type RaceResult, type ShiftWindow } from './sim';
import type { Sfx } from './sound';
import { fmtEt } from './util';

export interface RacePlan {
  specs: CarSpec[];
  drivers: Driver[];
  looks: CarLook[];
  names: string[];
  env: string;
  seed: number;
}

/** The gauge sweeps 270 degrees, from bottom-left to bottom-right. */
const SWEEP = 270;
const BLUE = '#22e4ff';
const YELLOW = '#ffd12e';
const GREEN = '#3dff7a';
const RED = '#ff3b4e';
const OFF = '#120a2c';
/** The gauge face for a gear: its window in green and yellow, red above (no window: plain, red at the top). */
function gaugeBg(w: ShiftWindow | null): string {
  const a = (f: number): string => `${(SWEEP * f).toFixed(1)}deg`;
  if (!w) return `conic-gradient(from 225deg, ${BLUE} 0deg ${a(0.985)}, ${RED} ${a(0.985)} ${a(1)}, ${OFF} ${a(1)} 360deg)`;
  return `conic-gradient(from 225deg, ${BLUE} 0deg ${a(w.okLo)}, ${YELLOW} ${a(w.okLo)} ${a(w.lo)}, ${GREEN} ${a(w.lo)} ${a(w.hi)}, ${YELLOW} ${a(w.hi)} ${a(w.okHi)}, ${RED} ${a(w.okHi)} ${a(1)}, ${OFF} ${a(1)} 360deg)`;
}
/** The rev strip shows the top half of the revs: 50 % to 100 % of the redline. */
const STRIP_FROM = 0.5;
const pct = (f: number): number => Math.max(0, Math.min(100, ((f - STRIP_FROM) / (1 - STRIP_FROM)) * 100));
type StripState = 'launch' | 'go' | 'shift' | 'top' | 'done';
const STRIP_LABEL: Record<StripState, string> = { launch: 'TAP ON GREEN TO LAUNCH', go: 'GO! TAP NOW', shift: 'SHIFT IN THE GREEN', top: 'TOP GEAR · FLAT OUT', done: 'FINISHED' };

/**
 * The race: the shared 3D stage drawn from behind your car, a HUD updated through refs every
 * frame (no React renders per frame), and one input: tap anywhere, the SHIFT button or Space.
 */
export function RaceScreen({ plan, stageRef, paused, setPaused, onFinish, sfx, nudge: nudgeAtStart, onStart }: { plan: RacePlan; stageRef: RefObject<Stage3D | null>; paused: boolean; setPaused: (p: boolean) => void; onFinish: (r: RaceResult) => void; sfx: () => Sfx; nudge: boolean; onStart: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const onFinishRef = useRef(onFinish);
  const setPausedRef = useRef(setPaused);
  const onStartRef = useRef(onStart);
  const [pop, setPop] = useState<{ text: string; tone: string; key: number } | null>(null);
  const [banner, setBanner] = useState<{ text: string; sub?: string; tone: string } | null>({ text: 'GET READY', sub: 'Tap the moment the light turns green, then shift in the green zone', tone: 'yellow' });
  const [nudge, setNudge] = useState(nudgeAtStart);
  const strip = useRef<HTMLDivElement>(null);
  const zones = useRef<(HTMLElement | null)[]>([]);
  const fill = useRef<HTMLSpanElement>(null);
  const stripLabel = useRef<HTMLSpanElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const needle = useRef<HTMLDivElement>(null);
  const speedEl = useRef<HTMLSpanElement>(null);
  const gearEl = useRef<HTMLSpanElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const posEl = useRef<HTMLSpanElement>(null);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const shiftBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    pausedRef.current = paused;
    onFinishRef.current = onFinish;
    setPausedRef.current = setPaused;
    onStartRef.current = onStart;
  });
  useEffect(() => {
    if (!nudge) return;
    const id = window.setTimeout(() => setNudge(false), 3500);
    return () => window.clearTimeout(id);
  }, [nudge]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = stageRef.current;
    stage?.setEnv(plan.env);
    for (let i = 0; i < LANES; i++) stage?.setCar(i, plan.looks[i] ?? null);
    const race = new Race(plan.specs, plan.drivers, plan.seed);
    const me = race.racers[0]!;
    let clock = 0;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let finishedAt = -1;
    let audioAt = 0;
    let popKey = 0;
    let started = false;
    let shownGear = -2;
    let shownState = '';
    // a slow phone drops the pixel ratio a step at a time
    let dpr = Math.min(1.75, window.devicePixelRatio || 1);
    let frameAvg = 16;
    let adaptAt = 0;
    stage?.setPixelRatio(dpr);
    const s = sfx();
    const popup = (text: string, tone: string): void => setPop({ text, tone, key: ++popKey });

    const onEvents = (evs: ReturnType<Race['step']>): void => {
      for (const e of evs) {
        switch (e.type) {
          case 'amber':
            s.amber();
            setBanner({ text: '●'.repeat(e.n) + '○'.repeat(3 - e.n), tone: 'yellow' });
            break;
          case 'green':
            s.green();
            setBanner({ text: 'GO!', tone: 'lime' });
            window.setTimeout(() => setBanner((b) => (b?.text === 'GO!' ? null : b)), 650);
            break;
          case 'launch':
            if (e.i === 0) {
              if (!started) {
                started = true;
                onStartRef.current();
              }
              if (e.quality === 'perfect') {
                s.perfect();
                popup('PERFECT LAUNCH!', 'lime');
              } else if (e.quality === 'good') popup('GOOD LAUNCH', 'cyan');
              else if (e.quality === 'slow') popup('SLOW START', 'orange');
            }
            break;
          case 'jump':
            if (e.i === 0) {
              s.nope();
              popup('JUMP START!', 'coral');
            }
            break;
          case 'spin':
            if (e.i === 0) {
              s.squeal();
              popup('WHEELSPIN', 'orange');
            }
            break;
          case 'zone':
            if (e.i === 0) s.cue();
            break;
          case 'tooEarly':
            if (e.i === 0) {
              s.nope();
              popup('TOO EARLY', 'orange');
            }
            break;
          case 'shift':
            if (e.i === 0) {
              s.shift();
              if (e.quality === 'perfect') {
                s.perfect();
                popup('PERFECT!', 'lime');
              } else if (e.quality === 'ok') popup('GOOD', 'cyan');
              else if (e.quality === 'early') popup('EARLY', 'orange');
              else popup('LATE', 'coral');
            }
            break;
          case 'limiter':
            if (e.i === 0) s.limiter();
            break;
          case 'fail':
            if (e.i === 0) {
              s.fail();
              setBanner({ text: 'BREAKDOWN', sub: FAILURE_TEXT[e.part], tone: 'coral' });
            }
            break;
          case 'finish':
            if (e.i === 0) {
              const ahead = race.racers.filter((r, k) => k !== 0 && r.phase === 'done' && !r.dnf && r.reaction + r.et < me.reaction + me.et).length;
              const pos = ahead + 1;
              s.finish(pos === 1);
              setBanner({ text: pos === 1 ? 'YOU WON!' : `${pos === 2 ? '2ND' : pos === 3 ? '3RD' : `${pos}TH`} PLACE`, sub: `${fmtEt(me.et)} s · ${Math.round(me.trap * 3.6)} km/h`, tone: pos === 1 ? 'lime' : 'yellow' });
            }
            break;
        }
      }
    };

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      const realDt = now - last;
      let dt = realDt / 1000;
      last = now;
      if (pausedRef.current || document.hidden) {
        s.quiet();
        return;
      }
      // stalls (a background tab, a hidden window) say nothing about the device: skip them
      if (realDt < 120) frameAvg = frameAvg * 0.95 + realDt * 0.05;
      if (now - adaptAt > 1500 && frameAvg > 24 && dpr > 0.8) {
        adaptAt = now;
        dpr = Math.max(0.75, dpr - 0.25);
        stage?.setPixelRatio(dpr);
      }
      dt = Math.min(dt, 0.1);
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < 24) {
        acc -= DT;
        steps++;
        clock += DT;
        if (race.done) {
          if (finishedAt < 0) finishedAt = clock;
          else if (clock - finishedAt > 2.2) {
            cancelAnimationFrame(raf);
            raf = 0;
            s.quiet();
            onFinishRef.current(race.result());
            return;
          }
          continue;
        }
        onEvents(race.step());
      }
      if (clock - audioAt > 0.05) {
        audioAt = clock;
        s.engine(me.dead ? 0 : me.rpm / me.spec.redline, me.phase === 'running' ? 1 : 0.3);
      }
      // HUD: the rev strip and gauge show this gear's window; they move to new spots after each shift
      const frac = Math.min(1.02, shiftRpm(me) / me.spec.redline);
      const canShift = me.phase === 'running' && me.gear < me.spec.gears && !me.stuck && !me.dead;
      const win = canShift || me.phase === 'shifting' ? race.windowOf(0) : null;
      const hot = canShift && !!win && frac >= win.lo && frac <= win.hi;
      const gearKey = me.phase === 'staging' || me.phase === 'done' ? -1 : me.gear;
      if (gearKey !== shownGear) {
        shownGear = gearKey;
        const w = gearKey > 0 ? race.windowOf(0) : null;
        const spans: [number, number][] = w ? [[w.okLo, w.lo], [w.lo, w.hi], [w.hi, w.okHi], [w.okHi, 1]] : [[0, 0], [0, 0], [0, 0], [0.985, 1]];
        spans.forEach(([a, b], k) => {
          const el = zones.current[k];
          if (!el) return;
          el.style.left = `${pct(a)}%`;
          el.style.width = `${Math.max(0, pct(b) - pct(a))}%`;
        });
        if (face.current) face.current.style.background = gaugeBg(w);
      }
      const st: StripState = me.phase === 'staging' ? (race.green && !me.jumped ? 'go' : 'launch') : me.phase === 'done' ? 'done' : me.gear >= me.spec.gears || me.stuck ? 'top' : 'shift';
      if (st !== shownState) {
        shownState = st;
        if (strip.current) strip.current.dataset.state = st;
        if (stripLabel.current) stripLabel.current.textContent = STRIP_LABEL[st];
        if (shiftBtn.current) shiftBtn.current.textContent = st === 'launch' || st === 'go' ? 'LAUNCH' : 'SHIFT';
      }
      if (fill.current) fill.current.style.width = `${pct(me.phase === 'staging' ? me.rpm / me.spec.redline : frac)}%`;
      strip.current?.classList.toggle('is-hot', hot);
      if (needle.current) needle.current.style.transform = `rotate(${-135 + Math.min(1.02, me.rpm / me.spec.redline) * SWEEP}deg)`;
      if (speedEl.current) speedEl.current.textContent = String(Math.round(me.v * 3.6));
      if (gearEl.current) gearEl.current.textContent = me.spec.gears === 1 ? 'D' : String(me.gear);
      if (timeEl.current) timeEl.current.textContent = me.phase === 'staging' ? '0.000' : me.phase === 'done' && !me.dnf ? fmtEt(me.et) : fmtEt(Math.max(0, clock - me.launchAt));
      let place = 1;
      race.racers.forEach((r, i) => {
        const d = dots.current[i];
        if (d) d.style.left = `${Math.min(100, (r.x / DISTANCE) * 100)}%`;
        if (i > 0 && r.x > me.x) place++;
      });
      if (posEl.current) posEl.current.textContent = `P${place}/${race.racers.length}`;
      if (shiftBtn.current) {
        shiftBtn.current.classList.toggle('is-hot', hot);
        shiftBtn.current.classList.toggle('is-idle', !canShift && !(st === 'go'));
        shiftBtn.current.classList.toggle('is-go', st === 'go');
      }
      const state = (r: typeof me): CarState => ({ x: r.x, v: r.v, rpm: r.rpm, redline: r.spec.redline, spinning: r.spinLeft > 0, dead: r.dead });
      stage?.renderRace(race.racers.map(state), race.ambersLit, race.green, clock, dt);
    };
    raf = requestAnimationFrame(frame);

    const tap = (): void => {
      if (pausedRef.current) return;
      race.tap(0);
    };
    const key = (e: KeyboardEvent): void => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setPausedRef.current(!pausedRef.current);
        return;
      }
      if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter' || e.code === 'KeyW') && !e.repeat) {
        e.preventDefault();
        tap();
      }
    };
    const pdown = (e: PointerEvent): void => {
      if ((e.target as HTMLElement).closest('.lc-pause, .lc-overlay')) return;
      e.preventDefault();
      tap();
    };
    window.addEventListener('keydown', key);
    root.addEventListener('pointerdown', pdown);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', key);
      root.removeEventListener('pointerdown', pdown);
      s.quiet();
      stage?.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    };
    // One race per mount: the plan is fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className="lc-race" aria-label="Drag race. Tap or press Space at green to launch, then each time the needle is in the green zone to shift.">
      <div className="lc-hud" aria-hidden="true">
        <div className="lc-hud-top">
          <div className="lc-chip-you">
            <span className="lc-eyebrow mono">You</span>
            <b>{plan.specs[0]!.def.name}</b>
            <span ref={posEl} className="lc-pos mono">
              P1/{plan.names.length}
            </span>
          </div>
          <div ref={strip} className="lc-rev" data-state="launch">
            <div className="lc-rev-track">
              {['y', 'g', 'y', 'r'].map((c, k) => (
                <i
                  key={k}
                  className={`lc-rev-zone is-${c}`}
                  ref={(el) => {
                    zones.current[k] = el;
                  }}
                />
              ))}
              <span ref={fill} className="lc-rev-fill" />
            </div>
            <span ref={stripLabel} className="lc-rev-label mono">
              {STRIP_LABEL.launch}
            </span>
          </div>
        </div>
        {pop && (
          <div key={pop.key} className="lc-pop" data-tone={pop.tone}>
            {pop.text}
          </div>
        )}
        {banner && (
          <div className="lc-banner" data-tone={banner.tone}>
            <b>{banner.text}</b>
            {banner.sub && <span>{banner.sub}</span>}
          </div>
        )}
        <div className="lc-hud-bottom">
          <div className="lc-timer">
            <span ref={timeEl} className="mono">
              0.000
            </span>
            <small className="mono">¼ MILE</small>
            <div className="lc-progress">
              {plan.names.map((n, i) => (
                <span
                  key={n + i}
                  ref={(el) => {
                    dots.current[i] = el;
                  }}
                  className={`lc-dot${i === 0 ? ' is-you' : ''}`}
                />
              ))}
              <i className="lc-progress-flag" />
            </div>
          </div>
          <div className="lc-gauge">
            <div ref={face} className="lc-gauge-face" style={{ background: gaugeBg(null) }}>
              <div ref={needle} className="lc-needle" />
              <span ref={speedEl} className="lc-speed mono">
                0
              </span>
              <small className="mono">km/h</small>
            </div>
            <span ref={gearEl} className="lc-gear mono">
              1
            </span>
          </div>
        </div>
      </div>
      <button className="lc-pause" onClick={() => setPaused(true)} aria-label="Pause">
        <span />
        <span />
      </button>
      <button ref={shiftBtn} className="lc-shift is-idle" aria-label="Launch and shift" tabIndex={-1}>
        LAUNCH
      </button>
      {nudge && (
        <div className="lc-nudge" role="status">
          <span className="lc-nudge-phone" aria-hidden="true" />
          Turn your phone sideways for the full view
        </div>
      )}
    </div>
  );
}
