// Wing It: endless sky, flown by the same autopilot the game's tests use, tapping the screen for real.
// Flies until `--target` pillars (default 48: past meadow, sunset and night, into space), then crashes
// so the take ends on the result card.
export default {
  max: 90,
  tail: 3,
  async prepare(page) {
    await page.getByRole('button', { name: /play wing it/i }).first().click();
    await page.getByRole('button', { name: /fly endless/i }).click();
    await page.waitForTimeout(900);
  },
  async play(page, rec, { args }) {
    const target = Number(args.target ?? 50);
    // 1 = an average player's timing; 0 = the tests' autopilot. Long runs need a steadier hand.
    const sloppy = Number(args.sloppy ?? (target > 40 ? 0.45 : 1));
    await page.evaluate(async ([target, sloppy]) => {
      const gb = window.__gb;
      const ref = await gb.until(() => gb.findRef((v) => gb.has(v, 'pillars', 'vy', 'started')));
      const canvas = document.querySelector('canvas.wi-canvas');
      const r = canvas.getBoundingClientRect();
      const tx = r.left + r.width * 0.5;
      const ty = r.top + r.height * 0.78;
      const PILLAR_W = 70, BIRD_X = 120, HIT_R = 12, H = 640;
      const gapCentre = (p, t) => p.gapY + (p.sway ? Math.sin(t * 1.6 + p.phase) * p.sway : 0);
      await gb.sleep(700);
      gb.mark('takeoff');
      let lastScore = 0;
      let lastTap = 0;
      let lastPillar = null;
      let drift = 0;
      let late = 0;
      let frameDt = 1 / 60;
      let lastFrame = performance.now();
      await new Promise((done) => {
        const loop = () => {
          const s = ref.current;
          if (!s) return requestAnimationFrame(loop);
          if (s.dead) return done();
          if (s.score !== lastScore) {
            lastScore = s.score;
            if (s.score % 15 === 0) gb.mark('biome', { score: s.score });
          }
          const now = performance.now();
          frameDt = Math.min(0.1, (now - lastFrame) / 1000) * 0.3 + frameDt * 0.7;
          lastFrame = now;
          if (!s.started) {
            gb.tapAt(tx, ty);
            lastTap = now;
          } else if (s.score < target) {
            // A person's timing: aims for a spot that drifts within the gap and reacts a little late,
            // so some passes are close calls.
            const p = s.pillars.find((x) => x.x + PILLAR_W > BIRD_X - HIT_R);
            if (p && p !== lastPillar) {
              lastPillar = p;
              drift = gb.rand(-0.07, 0.05) * p.gapH * sloppy;
            }
            const goal = p ? gapCentre(p, s.t + 0.2) + p.gapH / 2 - HIT_R - 16 + drift : H / 2;
            // Look ahead by about two frames, so a slow frame rate (a busy machine) doesn't make it late.
            const ahead = Math.max(0.06, Math.min(0.14, frameDt * 2));
            if (s.y + Math.max(0, s.vy) * ahead > goal && s.vy > 0 && now - lastTap > 120) {
              if (!late) late = now + gb.rand(0, 22) * sloppy;
              if (now >= late) {
                gb.tapAt(tx, ty);
                lastTap = now;
                late = 0;
                // An extra nervous flap now and then.
                if (Math.random() < 0.015) setTimeout(() => !ref.current.dead && gb.tapAt(tx, ty), gb.rand(140, 220));
              }
            }
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
      gb.mark('crash', { score: ref.current?.score });
    }, [target, sloppy]);
  },
};
