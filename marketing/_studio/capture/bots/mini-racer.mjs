// Mini Racer, a 3-rival race: the car is steered by the game's own autopilot line (the one its tests
// and gold times use) through the real race, to the finish screen.
export default {
  max: 150,
  tail: 4,
  async prepare(page, { args }) {
    await page.getByRole('button', { name: /play mini racer/i }).first().click();
    await page.waitForTimeout(900);
    // The menu sits over the attract-mode race: pick the track and the race mode straight on the DOM.
    await page.evaluate(async (track) => {
      const gb = window.__gb;
      const t = await gb.until(() => [...document.querySelectorAll('.mr-track')].find((b) => b.textContent.includes(track)));
      t.click();
      await gb.sleep(300);
      [...document.querySelectorAll('.mr-mode')].find((b) => /rivals/i.test(b.textContent)).click();
    }, args.track ?? 'Sunny Bay');
    await page.waitForTimeout(500);
  },
  async play(page) {
    await page.evaluate(async () => {
      const gb = window.__gb;
      const { autopilot } = await gb.mod('/src/games/mini-racer/sim.ts');
      gb.tap(document.querySelector('.mr-go'));
      const engine = await gb.until(() => gb.find((v) => gb.has(v, 'renderer', 'sim', 'attractMode') && !v.attractMode));
      // Thumbs, not a robot: the autopilot's line plus a slow wobble and a late, overdone correction.
      let t = 0;
      let kick = 0;
      engine.readSteer = function (dt) {
        if (!this.sim) return 0;
        t += dt || 1 / 60;
        if (Math.random() < 0.004) kick = gb.rand(-0.8, 0.8);
        kick *= 0.97;
        const want = autopilot(this.sim) + Math.sin(t * 1.7) * 0.22 + Math.sin(t * 0.63 + 1) * 0.12 + kick;
        return Math.max(-1, Math.min(1, want));
      };
      gb.mark('start');
      await gb.until(() => engine.sim?.finished, 140000, 200);
      gb.mark('finish', { position: engine.sim?.position });
    });
  },
};
