// Color Recall, practice (Normal: a 3 s peek), played like a person: after the peek it drags the
// sliders roughly, overshoots, comes back, nudges with the - / + buttons, sometimes goes back to an
// earlier slider, and ends up a little (or a lot) off. It ends on the summary.
export default {
  max: 140,
  tail: 5,
  async prepare(page) {
    await page.getByRole('button', { name: /play color recall/i }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /practice 5/i }).click();
    await page.waitForTimeout(300);
  },
  async play(page) {
    await page.evaluate(async () => {
      const gb = window.__gb;
      const C = await gb.mod('/src/games/color-recall/color.ts');
      const game = gb.live((v) => gb.has(v, 'mode', 'peekMs', 'rounds', 'index', 'results', 'phase'));
      const input = (name) => document.querySelector(`input[aria-label="${name}"]`);
      const clampTo = (name, v) => (name === 'Hue' ? ((Math.round(v) % 360) + 360) % 360 : Math.max(0, Math.min(100, Math.round(v))));
      // How sharp this player's memory is for each color: mostly decent, sometimes way off.
      const memory = [0.8, 1.6, 0.9, 2.4, 1.2];
      for (let n = 0; n < 5; n++) {
        const g = await gb.until(() => { const x = game(); return x && x.phase === 'guess' && x.index === n ? x : null; }, 15000);
        if (!g) break;
        const hsb = C.rgbToHsb(C.hexToRgb(g.rounds[n].target.hex));
        const m = memory[n];
        // What the player *remembers* (not what was shown).
        const recall = {
          Hue: hsb.h + gb.rand(-14, 14) * m,
          Saturation: hsb.s + gb.rand(-12, 12) * m,
          Brightness: hsb.b + gb.rand(-12, 12) * m,
        };
        await gb.think(500, 1200);
        const order = gb.chance(0.25) ? ['Brightness', 'Hue', 'Saturation'] : ['Hue', 'Saturation', 'Brightness'];
        for (const name of order) {
          const el = input(name);
          const want = recall[name];
          // A rough first drag that overshoots, then back toward the remembered value.
          const span = name === 'Hue' ? 60 : 30;
          await gb.slide(el, clampTo(name, want + gb.rand(0.4, 1) * span * (gb.chance(0.5) ? 1 : -1)), gb.rand(500, 850));
          await gb.think(250, 700);
          await gb.slide(el, clampTo(name, want + gb.rand(-6, 6)), gb.rand(500, 900));
          // Sometimes a few taps on - / + to fine-tune.
          if (gb.chance(0.45)) {
            const row = el.closest('.cr-slider');
            const btns = row.querySelectorAll('.cr-nudge');
            const btn = btns[gb.chance(0.5) ? 0 : 1];
            const taps = 2 + Math.floor(Math.random() * 4);
            for (let k = 0; k < taps; k++) {
              await (k ? gb.tap(btn) : gb.tapH(btn));
              await gb.sleep(gb.rand(140, 300));
            }
          }
          await gb.think(250, 650);
        }
        // Second thoughts about the hue now and then.
        if (gb.chance(0.4)) {
          await gb.slide(input('Hue'), clampTo('Hue', recall.Hue + gb.rand(-10, 10)), gb.rand(600, 900));
          await gb.think(300, 800);
        }
        await gb.think(400, 1100);
        await gb.tapH(gb.byText('button', /lock it in/i));
        await gb.until(() => game()?.phase === 'reveal', 4000);
        gb.mark('reveal', { n, score: game().results[n]?.points });
        await gb.sleep(gb.rand(2600, 3400));
        const next = document.querySelector('.cr-play .cr-btn-go');
        if (next) await gb.tapH(next);
      }
      await gb.sleep(800);
      const txt = document.body.innerText;
      gb.mark('done', { total: /([\d,]+)\s*\/\s*5,000/.exec(txt)?.[1], accuracy: /(\d+)% accuracy/.exec(txt)?.[1] });
    });
  },
};
