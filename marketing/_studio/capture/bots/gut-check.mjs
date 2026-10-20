// Gut Check, endless, played like a person: hovers between "more" and "less", takes longer on the
// close calls, and is wrong at call `--streak` (default 7), which ends the run.
export default {
  max: 120,
  tail: 3.5,
  async prepare(page) {
    await page.getByRole('button', { name: /play gut check/i }).first().click();
    await page.getByRole('button', { name: /play endless/i }).click();
    await page.waitForTimeout(800);
  },
  async play(page, rec, { args }) {
    const streak = Number(args.streak ?? 7);
    await page.evaluate(async (streak) => {
      const gb = window.__gb;
      const logic = await gb.mod('/src/games/gut-check/logic.ts');
      const run = gb.live((v) => gb.has(v, 'pairs', 'i', 'phase', 'call'));
      await gb.sleep(900);
      let last = -1;
      for (;;) {
        let r = await gb.until(() => { const x = run(); return x && x.phase === 'ask' && x.i > last ? x : null; }, 8000);
        if (!r) break;
        const pair = r.pairs[r.i];
        const a = logic.valueOf(pair.left), b = logic.valueOf(pair.right);
        const close = Math.max(a, b) / Math.max(1e-9, Math.min(a, b)) < 2;
        await gb.think(close ? 1500 : 900, close ? 3200 : 2000);
        r = run();
        last = r.i;
        const more = logic.answerIsMore(r.pairs[r.i]);
        const wrong = r.i >= streak;
        const yes = document.querySelector('.gc-call.is-more'), no = document.querySelector('.gc-call.is-less');
        const pick = (more !== wrong) ? yes : no;
        await gb.waver([yes, no], pick, close ? 0.85 : 0.4);
        gb.mark(wrong ? 'miss' : 'right', { streak: r.i + (wrong ? 0 : 1) });
        if (wrong) break;
      }
    }, streak);
  },
};
