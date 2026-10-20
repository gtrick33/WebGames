import { useEffect, useRef, useState } from 'react';
import { FAILURE_TEXT } from './parts';
import { Stage3D, type CarLook, type CarState } from './scene3d';
import { DISTANCE, DT, PERFECT_FROM, Race, type Driver, type RaceResult, type CarSpec } from './sim';
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

/** The race itself: the 3D view, a DOM HUD updated by refs every frame, and one button: SHIFT. */
export function RaceScreen({ plan, paused, setPaused, onFinish, sfx, portraitNudge }: { plan: RacePlan; paused: boolean; setPaused: (p: boolean) => void; onFinish: (r: RaceResult) => void; sfx: () => Sfx; portraitNudge: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const onFinishRef = useRef(onFinish);
  const setPausedRef = useRef(setPaused);
  const [phase, setPhase] = useState<'staging' | 'running' | 'done'>('staging');
  const [pop, setPop] = useState<{ text: string; tone: string; key: number } | null>(null);
  const [banner, setBanner] = useState<{ text: string; sub?: string; tone: string } | null>({ text: 'GET READY', tone: 'yellow' });
  const [nudge, setNudge] = useState(portraitNudge);
  // refs for the per-frame HUD
  const rpmFill = useRef<HTMLDivElement>(null);
  const needle = useRef<HTMLDivElement>(null);
  const speedEl = useRef<HTMLSpanElement>(null);
  const gearEl = useRef<HTMLSpanElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const shiftBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    pausedRef.current = paused;
    onFinishRef.current = onFinish;
    setPausedRef.current = setPaused;
  });
  useEffect(() => {
    if (!nudge) return;
    const id = window.setTimeout(() => setNudge(false), 3200);
    return () => window.clearTimeout(id);
  }, [nudge]);

  useEffect(() => {
    const gl = glRef.current;
    const root = rootRef.current;
    if (!gl || !root) return;
    let stage: Stage3D | null = null;
    try {
      stage = new Stage3D(gl);
    } catch {
      stage = null;
    }
    stage?.setEnv(plan.env);
    plan.looks.forEach((l, i) => stage?.setCar(i, l));
    const race = new Race(plan.specs, plan.drivers, plan.seed);
    const me = race.racers[0]!;
    let clock = 0;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let finishedAt = -1;
    let audioAt = 0;
    let popKey = 0;
    let lastPhase = '';
    const size = (): void => stage?.resize(root.clientWidth, root.clientHeight, Math.min(2, window.devicePixelRatio || 1));
    size();
    const ro = new ResizeObserver(size);
    ro.observe(root);
    const s = sfx();
    const popup = (text: string, tone: string): void => setPop({ text, tone, key: ++popKey });

    const onEvents = (evs: ReturnType<Race['step']>): void => {
      for (const e of evs) {
        switch (e.type) {
          case 'amber':
            s.amber();
            setBanner({ text: '●'.repeat(e.n), tone: 'yellow' });
            break;
          case 'green':
            s.green();
            setBanner({ text: 'GO!', tone: 'lime' });
            window.setTimeout(() => setBanner((b) => (b?.text === 'GO!' ? null : b)), 700);
            break;
          case 'spin':
            if (e.i === 0) {
              s.squeal();
              popup('WHEELSPIN', 'orange');
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
          case 'finish': {
            if (e.i === 0) {
              const ahead = race.racers.filter((r, k) => k !== 0 && r.phase === 'done' && !r.dnf && r.reaction + r.et < me.reaction + me.et).length;
              const pos = ahead + 1;
              s.finish(pos === 1);
              setBanner({ text: pos === 1 ? 'YOU WON!' : `${pos === 2 ? '2ND' : pos === 3 ? '3RD' : `${pos}TH`} PLACE`, sub: `${fmtEt(me.et)} s · ${Math.round(me.trap * 3.6)} km/h`, tone: pos === 1 ? 'lime' : 'yellow' });
            }
            break;
          }
        }
      }
    };

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      let dt = (now - last) / 1000;
      last = now;
      if (pausedRef.current || document.hidden) {
        s.quiet();
        return;
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
      const ph = me.phase === 'staging' ? 'staging' : me.phase === 'done' ? 'done' : 'running';
      if (ph !== lastPhase) {
        lastPhase = ph;
        setPhase(ph);
      }
      if (clock - audioAt > 0.05) {
        audioAt = clock;
        s.engine(me.dead ? 0 : me.rpm / me.spec.redline, me.phase === 'running' ? 1 : 0.3);
      }
      const frac = Math.min(1.02, me.rpm / me.spec.redline);
      if (rpmFill.current) rpmFill.current.style.width = `${Math.round(frac * 1000) / 10}%`;
      if (needle.current) needle.current.style.transform = `rotate(${-120 + frac * 240}deg)`;
      if (speedEl.current) speedEl.current.textContent = String(Math.round(me.v * 3.6));
      if (gearEl.current) gearEl.current.textContent = me.spec.gears === 1 ? 'D' : String(me.gear);
      if (timeEl.current) timeEl.current.textContent = me.phase === 'staging' ? '0.000' : me.phase === 'done' && !me.dnf ? fmtEt(me.et) : fmtEt(Math.max(0, clock - me.launchAt));
      race.racers.forEach((r, i) => {
        const d = dots.current[i];
        if (d) d.style.left = `${Math.min(100, (r.x / DISTANCE) * 100)}%`;
      });
      if (shiftBtn.current) {
        const hot = me.phase === 'running' && frac >= PERFECT_FROM && me.gear < me.spec.gears;
        shiftBtn.current.classList.toggle('is-hot', hot);
        shiftBtn.current.classList.toggle('is-idle', me.phase !== 'running');
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
      if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') && !e.repeat) {
        e.preventDefault();
        tap();
      }
    };
    const pdown = (e: PointerEvent): void => {
      if ((e.target as HTMLElement).closest('.lc-pause')) return;
      e.preventDefault();
      tap();
    };
    window.addEventListener('keydown', key);
    root.addEventListener('pointerdown', pdown);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', key);
      root.removeEventListener('pointerdown', pdown);
      s.quiet();
      stage?.dispose();
    };
    // One race per mount: the plan is fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className="lc-race">
      <canvas ref={glRef} className="lc-canvas" aria-label="Drag strip. Tap or press Space to shift." />
      <div className="lc-hud" aria-hidden="true">
        <div className="lc-hud-top">
          <div className="lc-hud-you">
            <span className="lc-eyebrow mono">You</span>
            <b>{plan.specs[0]!.def.name}</b>
          </div>
          <div className="lc-shiftmeter">
            <div className="lc-shiftmeter-track">
              <i className="lc-shiftmeter-zone" style={{ left: '80%', width: '12%' }} />
              <i className="lc-shiftmeter-perfect" style={{ left: '92%', width: '8%' }} />
              <div ref={rpmFill} className="lc-shiftmeter-fill" />
            </div>
            <span className="lc-shiftmeter-label mono">{phase === 'staging' ? 'LAUNCH CONTROL ARMED' : phase === 'done' ? 'FINISHED' : 'SHIFT IN THE GREEN'}</span>
          </div>
          <div className="lc-hud-rivals">
            <span className="lc-eyebrow mono">{plan.names.length - 1} rivals</span>
            <b>{plan.names[1]}</b>
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
            <small className="mono">1/4 MILE</small>
            <div className="lc-progress">
              {plan.names.map((n, i) => (
                <span
                  key={n + i}
                  ref={(el) => {
                    dots.current[i] = el;
                  }}
                  className={`lc-dot${i === 0 ? ' is-you' : ''}`}
                  title={n}
                />
              ))}
            </div>
          </div>
          <div className="lc-gauge">
            <div className="lc-gauge-face">
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
      <button ref={shiftBtn} className="lc-shift is-idle" aria-label="Shift">
        SHIFT
      </button>
      {nudge && (
        <div className="lc-nudge" role="status">
          <span className="lc-nudge-phone" aria-hidden="true" />
          Turn your phone for the full view
        </div>
      )}
    </div>
  );
}
