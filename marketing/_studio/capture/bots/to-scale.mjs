// To Scale, today's five shots, played like a person: drags the size up and down a few times while
// deciding, often lands noticeably off (sometimes way off), locks it in and watches the reveal.
export default {
  max: 150,
  tail: 4,
  async prepare(page) {
    await page.getByRole('button', { name: /play to scale/i }).first().click();
    await page.waitForTimeout(800);
    await page.locator('.ts-btn-go').first().click();
    await page.waitForTimeout(900);
  },
  async play(page) {
    await page.evaluate(async () => {
      const gb = window.__gb;
      const shots = () => gb.find((v) => Array.isArray(v) && v.length && gb.has(v[0], 'ref', 'target', 'ratio', 'start'));
      // How far off each guess ends up (as a share of the true size): good, okay, way off...
      const off = gb.shuffle([0.06, 0.18, 0.3, 0.55, 0.12]);
      for (let n = 0; n < 5; n++) {
        const input = await gb.until(() => document.querySelector('.ts-slider input[type=range]'), 6000);
        if (!input) break;
        const shot = shots()[Math.min(n, shots().length - 1)];
        await gb.think(1800, 3000);
        const want = Math.log(shot.ratio * (1 + off[n] * (gb.chance(0.5) ? 1 : -1)));
        const moves = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < moves; k++) {
          const wobble = (moves - k) * gb.rand(0.25, 0.5) * (k % 2 ? 1 : -1);
          await gb.slide(input, want + wobble, gb.rand(600, 1000));
          await gb.think(350, 900);
        }
        await gb.slide(input, want, gb.rand(500, 800));
        if (gb.chance(0.4)) {
          // A couple of taps on - or + to fine-tune.
          const btn = document.querySelector(`.ts-round[aria-label="${gb.chance(0.5) ? 'Smaller' : 'Bigger'}"]`);
          for (let k = 0; k < 2; k++) {
            await (k ? gb.tap(btn) : gb.tapH(btn));
            await gb.sleep(gb.rand(200, 380));
          }
        }
        await gb.think(500, 1100);
        await gb.tapH(document.querySelector('.ts-lock'));
        gb.mark('lock', { n, ratio: shot.ratio, q: document.querySelector('.ts-question')?.textContent.trim() });
        await gb.sleep(gb.rand(3400, 4200));
        const next = document.querySelector('.ts-lock');
        if (next) await gb.tapH(next);
        await gb.sleep(600);
      }
    });
  },
};
