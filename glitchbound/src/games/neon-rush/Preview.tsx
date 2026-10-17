import { useEffect, useRef } from 'react';
import type { GamePreviewProps } from '../../platform/contract';
import { LANES, layout, PLAYER_Y, PreviewSim, ROW_SPEED } from './previewSim';

/** NEON RUSH attract mode on a 2D canvas. Pauses offscreen, in background tabs and when not `playing`. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 1;
    let h = 1;
    let dpr = 1;
    let sim: PreviewSim | null = null;
    let scroll = 0;
    let t = 0;
    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const carH = layout(w, h).ch / h;
      if (!sim || Math.abs(sim.carH - carH) > 0.01) sim = new PreviewSim(carH);
    };
    resize();

    const roundRect = (x: number, y: number, rw: number, rh: number, r: number): void => {
      ctx.beginPath();
      ctx.roundRect(x, y, rw, rh, r);
    };

    const drawCar = (x: number, y: number, cw: number, ch: number, body: string, player: boolean): void => {
      ctx.save();
      ctx.shadowColor = body;
      ctx.shadowBlur = player ? 22 : 12;
      ctx.fillStyle = body;
      roundRect(x - cw / 2, y - ch / 2, cw, ch, cw * 0.32);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.fillStyle = '#170f30';
      const wy = player ? y - ch * 0.2 : y + ch * 0.07;
      const ry = player ? y + ch * 0.12 : y - ch * 0.3;
      roundRect(x - cw * 0.32, wy, cw * 0.64, ch * 0.13, 3);
      ctx.fill();
      roundRect(x - cw * 0.3, ry, cw * 0.6, ch * 0.1, 3);
      ctx.fill();
      if (player) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x - cw * 0.06, y - ch / 2 + 3, cw * 0.12, ch - 6);
      }
      ctx.restore();
    };

    const draw = (): void => {
      if (!sim) return;
      const { cw, ch, laneW, roadL } = layout(w, h);
      const roadW = laneW * LANES;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#160733');
      g.addColorStop(1, '#2a0f52');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(roadL, 0, roadW, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 3;
      ctx.setLineDash([22, 38]);
      ctx.lineDashOffset = -scroll;
      for (let i = 1; i < LANES; i++) {
        ctx.beginPath();
        ctx.moveTo(roadL + laneW * i, 0);
        ctx.lineTo(roadL + laneW * i, h);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.save();
      ctx.lineWidth = 3;
      ctx.shadowBlur = 16;
      for (const [x, c] of [
        [roadL, '#22e4ff'],
        [roadL + roadW, '#ff3fd2'],
      ] as const) {
        ctx.shadowColor = c;
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.restore();

      for (const r of sim.rows) {
        if (r.collected) continue;
        for (const lane of r.free) {
          if (!r.coins[lane]) continue;
          const pulse = 1 + Math.sin(t * 8 + r.y * 20) * 0.08;
          ctx.save();
          ctx.shadowColor = '#ffd12e';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#ffd12e';
          ctx.beginPath();
          ctx.arc(roadL + laneW * (lane + 0.5), r.y * h, laneW * 0.1 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      for (const r of sim.rows) r.blocked.forEach((lane, i) => drawCar(roadL + laneW * (lane + 0.5), r.y * h, cw, ch, r.colors[i]!, false));
      drawCar(roadL + laneW * (sim.playerX + 0.5), PLAYER_Y * h, cw, ch, '#2c9bff', true);
    };

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const loop = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      sim?.step(dt);
      scroll = (scroll + dt * ROW_SPEED * h * 1.5) % 60;
      draw();
      raf = requestAnimationFrame(loop);
    };
    const start = (): void => {
      if (raf || reduced || !visible || document.hidden || !playingRef.current) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = (): void => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    draw();
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    const onVis = (): void => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    const poll = window.setInterval(() => (playingRef.current ? start() : stop()), 250);
    start();
    return () => {
      stop();
      window.clearInterval(poll);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
