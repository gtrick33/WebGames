// NEON RUSH (its own project, dev build): the game's attract-mode autopilot drives a real run, with a
// tap ripple on the side of each lane change; after `--seconds` (default 50) it stops steering and
// the run ends in a crash.
export default {
  server: 'neon',
  url: '/',
  max: 120,
  tail: 4,
  async prepare(page) {
    await page.waitForTimeout(1500);
    const later = page.getByRole('button', { name: /^later$/i });
    if (await later.isVisible().catch(() => false)) await later.click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^play$/i }).click();
    await page.waitForTimeout(400);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (seconds) => {
      const gb = window.__gb;
      const app = window.__neon;
      const canvas = document.querySelector('canvas');
      await gb.until(() => !app.attract, 5000);
      gb.mark('start');
      const t0 = performance.now();
      let last = performance.now();
      let nextLook = 0;
      await new Promise((done) => {
        const loop = (now) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          const w = app.world;
          if (w && !w.__studio) {
            const steer = w.steer.bind(w);
            w.steer = (dir) => {
              const r = canvas.getBoundingClientRect();
              gb.ripple(r.left + r.width * (dir < 0 ? 0.22 : 0.78), r.top + r.height * 0.8);
              steer(dir);
            };
            w.__studio = true;
          }
          if (w?.crashed || app.state !== 'playing' && performance.now() - t0 > 3000) return done();
          // A human driver: reacts a beat late (sometimes much later), so some passes are close.
          if (now - t0 < seconds * 1000) {
            if (now > nextLook) {
              app.pilot.update(w, dt);
              nextLook = now + (Math.random() < 0.08 ? gb.rand(140, 240) : gb.rand(0, 70));
            }
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
      gb.mark('crash');
    }, Number(args.seconds ?? 50));
  },
};
