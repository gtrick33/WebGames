// Phone lobby tour: the entrance animation, then a smooth scroll down the arcade (today's dailies, every
// tile, the party banner) and back to the top. `--season halloween|winter` for the holiday looks.
export default {
  url: '/',
  max: 60,
  tail: 1,
  async play(page, rec, { args }) {
    await page.evaluate(async (speed) => {
      const gb = window.__gb;
      await gb.sleep(3800);
      gb.mark('scroll');
      const glide = async (to, ms) => {
        const from = scrollY, t0 = performance.now();
        while (performance.now() - t0 < ms) {
          const k = (performance.now() - t0) / ms, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          scrollTo(0, from + (to - from) * e);
          await new Promise(requestAnimationFrame);
        }
        scrollTo(0, to);
      };
      const H = document.documentElement.scrollHeight - innerHeight;
      // Stop at a few landmarks on the way down.
      for (const f of [0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
        await glide(H * f, 1700 / speed);
        await gb.sleep(900 / speed);
      }
      gb.mark('bottom');
      await glide(0, 2600 / speed);
      await gb.sleep(1500);
    }, Number(args.speed ?? 1));
  },
};
