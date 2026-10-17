import { useEffect, useRef } from 'react';

/**
 * A tiny looping "attract mode" for NEON RUSH, drawn on a 2D canvas (no game code is loaded).
 * A bot car weaves between three lanes of oncoming traffic and picks up coins. It pauses when
 * offscreen or when the tab is hidden, and shows a single still frame for reduced motion.
 */
const LANES = 3;
const TRAFFIC = ['#ff5a6c', '#ffd12e', '#c4f034', '#ff6a1a', '#12c6b3'];

interface Car {
  lane: number;
  y: number;
  color: string;
}
interface Coin {
  lane: number;
  y: number;
}

export function RoadPreview({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();

    // Simple deterministic RNG so the loop looks the same on every visit.
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    const cars: Car[] = [];
    const coins: Coin[] = [];
    let scroll = 0;
    let spawnIn = 0.4;
    let playerLane = 1;
    let playerX = 1;
    let t = 0;

    const laneX = (lane: number, roadL: number, laneW: number): number => roadL + laneW * (lane + 0.5);

    const spawn = (): void => {
      const blocked = Math.floor(rnd() * LANES);
      cars.push({ lane: blocked, y: -0.15, color: TRAFFIC[Math.floor(rnd() * TRAFFIC.length)]! });
      if (rnd() < 0.35) {
        const other = (blocked + 1 + Math.floor(rnd() * 2)) % LANES;
        cars.push({ lane: other, y: -0.15 - 0.02, color: TRAFFIC[Math.floor(rnd() * TRAFFIC.length)]! });
      } else {
        const free = (blocked + 1 + Math.floor(rnd() * 2)) % LANES;
        for (let i = 0; i < 3; i++) coins.push({ lane: free, y: -0.12 - i * 0.07 });
      }
    };

    const roundRect = (x: number, y: number, rw: number, rh: number, r: number): void => {
      ctx.beginPath();
      ctx.roundRect(x, y, rw, rh, r);
    };

    const drawCar = (x: number, y: number, cw: number, ch: number, body: string, glow: string, player = false): void => {
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = player ? 22 : 14;
      ctx.fillStyle = body;
      roundRect(x - cw / 2, y - ch / 2, cw, ch, cw * 0.32);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      // Windshield + rear window.
      ctx.fillStyle = '#170f30';
      roundRect(x - cw * 0.32, y - ch * (player ? 0.2 : -0.08), cw * 0.64, ch * 0.13, 3);
      ctx.fill();
      roundRect(x - cw * 0.3, y + ch * (player ? 0.12 : -0.3), cw * 0.6, ch * 0.1, 3);
      ctx.fill();
      if (player) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x - cw * 0.06, y - ch / 2 + 3, cw * 0.12, ch - 6);
      }
      ctx.restore();
    };

    const frame = (dt: number): void => {
      t += dt;
      const roadW = Math.min(w * 0.86, h * 0.62);
      const roadL = (w - roadW) / 2;
      const laneW = roadW / LANES;
      const speed = 0.55; // screen heights per second

      if (!reduced) {
        scroll = (scroll + dt * speed * h) % 60;
        spawnIn -= dt;
        if (spawnIn <= 0) {
          spawn();
          spawnIn = 0.75 + rnd() * 0.35;
        }
        for (const c of cars) c.y += dt * speed * 0.72;
        for (const c of coins) c.y += dt * speed;
        // Bot: dodge the nearest car ahead in our lane, prefer lanes with coins.
        const py = 0.78;
        const threat = cars.find((c) => c.lane === playerLane && c.y < py && c.y > py - 0.42);
        if (threat) {
          const options = [playerLane - 1, playerLane + 1].filter((l) => l >= 0 && l < LANES);
          const safe = options.filter((l) => !cars.some((c) => c.lane === l && Math.abs(c.y - py) < 0.3));
          const pick = safe.find((l) => coins.some((c) => c.lane === l && c.y < py)) ?? safe[0];
          if (pick !== undefined) playerLane = pick;
        }
        playerX += (playerLane - playerX) * Math.min(1, dt * 9);
        for (let i = coins.length - 1; i >= 0; i--) {
          const c = coins[i]!;
          if (c.y > 1.1 || (Math.abs(c.lane - playerX) < 0.4 && Math.abs(c.y - py) < 0.05)) coins.splice(i, 1);
        }
        for (let i = cars.length - 1; i >= 0; i--) if (cars[i]!.y > 1.2) cars.splice(i, 1);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Night sky + road.
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1d0b3a');
      g.addColorStop(1, '#2a0f52');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(roadL, 0, roadW, h);

      // Lane dashes.
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

      // Neon edges.
      ctx.save();
      ctx.lineWidth = 3;
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#22e4ff';
      ctx.strokeStyle = '#22e4ff';
      ctx.beginPath();
      ctx.moveTo(roadL, 0);
      ctx.lineTo(roadL, h);
      ctx.stroke();
      ctx.shadowColor = '#ff3fd2';
      ctx.strokeStyle = '#ff3fd2';
      ctx.beginPath();
      ctx.moveTo(roadL + roadW, 0);
      ctx.lineTo(roadL + roadW, h);
      ctx.stroke();
      ctx.restore();

      const cw = laneW * 0.5;
      const ch = cw * 1.85;
      const still = reduced && cars.length === 0;
      const scene: Car[] = still
        ? [
            { lane: 0, y: 0.32, color: TRAFFIC[0]! },
            { lane: 2, y: 0.18, color: TRAFFIC[1]! },
          ]
        : cars;
      const sceneCoins: Coin[] = still ? [0.5, 0.42, 0.34].map((y) => ({ lane: 1, y })) : coins;

      for (const c of sceneCoins) {
        const x = laneX(c.lane, roadL, laneW);
        const pulse = 1 + Math.sin(t * 8 + c.y * 20) * 0.08;
        ctx.save();
        ctx.shadowColor = '#ffd12e';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffd12e';
        ctx.beginPath();
        ctx.arc(x, c.y * h, laneW * 0.1 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const c of scene) drawCar(laneX(c.lane, roadL, laneW), c.y * h, cw, ch, c.color, c.color);
      drawCar(roadL + laneW * (playerX + 0.5), 0.78 * h, cw, ch, '#2c9bff', '#22e4ff', true);
    };

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const loop = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = (): void => {
      if (raf || reduced || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = (): void => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    frame(0);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      resize();
      frame(0);
    });
    ro.observe(canvas);
    const onVis = (): void => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    start();
    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
