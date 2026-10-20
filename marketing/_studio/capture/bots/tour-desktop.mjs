// Desktop lobby tour (1920x1080): the entrance, then a real mouse gliding over the game tiles so each
// one's live preview plays, a scroll through the catalogue, and the party banner.
export default {
  url: '/',
  desktop: true,
  max: 80,
  tail: 1,
  async play(page, rec) {
    const glideMouse = async (x, y, steps = 24) => page.mouse.move(x, y, { steps });
    await page.waitForTimeout(3500);
    await page.mouse.move(640, 400);
    const tiles = page.locator('.game-tile, [class*="tile"]:has(img)');
    const boxes = async () => (await tiles.evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }))).filter((b) => b.w > 120 && b.h > 90 && b.y > 60 && b.y < 700);
    rec.mark('hover-hero');
    for (const b of (await boxes()).slice(0, 6)) {
      await glideMouse(b.x, b.y);
      await page.waitForTimeout(2300);
    }
    for (let k = 0; k < 4; k++) {
      await page.mouse.move(1180, 360, { steps: 8 });
      await page.evaluate(async () => {
        const to = scrollY + innerHeight * 0.75, from = scrollY, t0 = performance.now();
        while (performance.now() - t0 < 1100) {
          const q = (performance.now() - t0) / 1100;
          scrollTo(0, from + (to - from) * (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2));
          await new Promise(requestAnimationFrame);
        }
      });
      await page.waitForTimeout(500);
      rec.mark('hover-grid', { k });
      const list = (await boxes()).sort(() => Math.random() - 0.5).slice(0, 3);
      for (const b of list) {
        await glideMouse(b.x, b.y, 20);
        await page.waitForTimeout(2000);
      }
    }
  },
};
