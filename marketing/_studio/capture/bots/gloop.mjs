// Gloop, endless jar, played like a person: slides the dropper around while deciding (sometimes
// back and forth), usually aims for a matching blob but not precisely, and now and then just drops
// it somewhere; plays for `--seconds` (default 60).
export default {
  max: 100,
  tail: 2,
  async prepare(page) {
    await page.getByRole('button', { name: /play gloop/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /endless/i }).first().click();
    await page.waitForTimeout(800);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (seconds) => {
      const gb = window.__gb;
      const S = await gb.mod('/src/games/gloop/sim.ts');
      const simRef = await gb.until(() => gb.findRef((v) => gb.has(v, 'blobs', 'aim', 'dealt')));
      const canvas = document.querySelector('canvas.gl-canvas');
      const toScreen = (wx) => {
        const r = canvas.getBoundingClientRect();
        const k = Math.min(r.width / S.W, r.height / S.H);
        return [r.left + (r.width - S.W * k) / 2 + wx * k, r.top + (r.height - S.H * k) / 2 + (S.DROP_Y + 30) * k];
      };
      const aimFor = (s) => {
        const tier = S.nextTier(s);
        const R = S.RADII[tier];
        const twins = s.blobs.filter((b) => b.tier === tier).sort((a, b) => a.y - b.y);
        if (twins[0] && Math.random() < 0.7) return twins[0].x + gb.rand(-14, 14);
        return R + 8 + Math.random() * (S.W - 2 * R - 16);
      };
      const t0 = performance.now();
      await gb.think(600, 1200);
      while (performance.now() - t0 < seconds * 1000) {
        const s = simRef.current;
        if (!s || s.over) break;
        await gb.until(() => S.canDrop(simRef.current), 3000, 30);
        const R = S.RADII[S.nextTier(s)];
        const clampX = (x) => Math.max(R, Math.min(S.W - R, x));
        const [x0, y] = toScreen(s.aim);
        const [x1] = toScreen(clampX(aimFor(s)));
        const path = [[x0, y]];
        if (gb.chance(0.3)) path.push([toScreen(clampX(gb.rand(R, S.W - R)))[0], y, gb.rand(200, 500)]);
        path.push([x1, y, gb.chance(0.4) ? gb.rand(200, 600) : 0]);
        await gb.dragPath(path, gb.rand(260, 520));
        gb.mark('drop', { score: s.score });
        await gb.think(500, 1200);
      }
    }, Number(args.seconds ?? 60));
  },
};
