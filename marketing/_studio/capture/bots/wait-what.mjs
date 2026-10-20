// Quizbelief, played like a person: reads each question, hovers over a couple of answers before
// committing, gets a fair share wrong, overshoots the number lever and readjusts, fixes a typo when
// typing, and sometimes puts an order question slightly wrong.
export default {
  max: 170,
  tail: 4,
  async prepare(page, { args }) {
    await page.getByRole('button', { name: /play wait/i }).first().click();
    await page.waitForTimeout(800);
    await page.locator(args.mode === 'endless' ? '.ww-card .ww-btn:not(.ww-btn-go)' : '.ww-card-daily .ww-btn-go').first().click();
    await page.waitForTimeout(900);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (count) => {
      const gb = window.__gb;
      const qs = () => gb.find((v) => Array.isArray(v) && v.length && gb.has(v[0], 'id', 'cat', 'text', 'answers', 'correct'));
      const run = () => gb.find((v) => gb.has(v, 'picks') && Array.isArray(v.picks));
      // Which questions this player gets wrong (about a third, at least one).
      const wrongAt = new Set([1 + Math.floor(Math.random() * 3)]);
      for (let i = 0; i < count; i++) if (gb.chance(0.25)) wrongAt.add(i);
      for (let n = 0; n < count; n++) {
        const ok = await gb.until(() => document.querySelector('.ww-q-card') && run()?.picks.length === n, 8000);
        if (!ok) break;
        const q = qs()[n];
        if (!q) break;
        const kind = q.kind ?? 'choice';
        const wrong = wrongAt.has(n);
        await gb.think(2000, 3400);
        if (kind === 'choice') {
          const btns = [...document.querySelectorAll('.ww-answer')];
          const others = btns.filter((_, i) => i !== q.correct);
          const pick = wrong ? gb.pick(others) : btns[q.correct];
          await gb.waver(btns, pick, 0.8);
        } else if (kind === 'number') {
          const input = document.querySelector('.ww-lever input[type=range]');
          const span = q.num.max - q.num.min;
          const final = q.num.answer + (wrong ? (gb.chance(0.5) ? 1 : -1) * gb.rand(2, 4) * q.num.tol : gb.rand(-0.8, 0.8) * q.num.tol);
          await gb.slide(input, Math.max(q.num.min, Math.min(q.num.max, final + span * gb.rand(0.12, 0.25) * (gb.chance(0.5) ? 1 : -1))), 900);
          await gb.think(500, 1100);
          await gb.slide(input, Math.max(q.num.min, Math.min(q.num.max, final)), 900);
          await gb.think(500, 1000);
          await gb.tapH(document.querySelector('.ww-lever .ww-lock'));
        } else if (kind === 'type') {
          const input = document.querySelector('.ww-type-input');
          const word = wrong ? gb.pick(['no idea', 'paris', 'blue']) : q.answers[0];
          const cut = Math.max(1, Math.floor(word.length * 0.6));
          await gb.fill(input, word.slice(0, cut) + 'x', 150);
          await gb.think(400, 800);
          await gb.fill(input, word, 150);
          await gb.think(300, 700);
          await gb.tapH(document.querySelector('.ww-type .ww-lock'));
        } else if (kind === 'order') {
          const items = [...document.querySelectorAll('.ww-order-item')];
          const order = [...q.order];
          if (wrong && order.length > 2) [order[1], order[2]] = [order[2], order[1]];
          for (const i of order) {
            await gb.think(500, 1200);
            await gb.tapH(items[i]);
          }
          await gb.think(400, 900);
          await gb.tapH(document.querySelector('.ww-order .ww-lock'));
        }
        gb.mark('answer', { n, kind, q: q.text, right: !wrong });
        await gb.until(() => document.querySelector('.ww-reveal'), 4000);
        await gb.sleep(gb.rand(3200, 4200));
        const next = document.querySelector('.ww-reveal .ww-btn-go');
        if (next) await gb.tapH(next);
      }
    }, Number(args.count ?? 6));
  },
};
