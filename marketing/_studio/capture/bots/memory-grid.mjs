// Memory Grid, classic mode, played like a person: watches each pattern, taps it back at an uneven
// pace (a pause to remember mid-way on the long ones), and slips up at round `--rounds` (default 9).
export default {
  max: 140,
  tail: 5,
  async prepare(page) {
    await page.getByRole('button', { name: /play memory grid/i }).first().click();
    await page.waitForTimeout(600);
    await page.locator('.mg-mode-classic').click();
    await page.waitForTimeout(500);
  },
  async play(page, rec, { args }) {
    const rounds = Number(args.rounds ?? 9);
    await page.evaluate(async (rounds) => {
      const gb = window.__gb;
      const run = gb.live((v) => gb.has(v, 'sequence', 'phase', 'step', 'round'));
      for (;;) {
        const r = await gb.until(() => { const x = run(); return x && (x.phase === 'input' || x.phase === 'over') ? x : null; }, 15000);
        if (!r || r.phase === 'over') break;
        await gb.think(400, 900);
        const tiles = document.querySelectorAll('.mg-board .mg-tile');
        const seq = r.sequence.slice();
        const fail = r.round >= rounds;
        const slipAt = Math.max(1, Math.floor(seq.length * gb.rand(0.4, 0.8)));
        for (let k = 0; k < seq.length; k++) {
          let t = seq[k];
          if (fail && k === slipAt) t = (t + 1 + Math.floor(Math.random() * (tiles.length - 1))) % tiles.length;
          if (seq.length > 4 && k === Math.floor(seq.length / 2) && gb.chance(0.6)) await gb.think(600, 1300);
          await gb.tapH(tiles[t], { settle: [30, 90] });
          await gb.sleep(gb.rand(120, 380));
          if (fail && t !== seq[k]) break;
        }
        gb.mark(fail ? 'miss' : 'clear', { round: r.round });
        if (fail) break;
        await gb.until(() => run()?.phase !== 'input', 5000);
      }
    }, rounds);
  },
};
