// Whatsit, practice on one theme, played like a person: asks sensible but not perfect questions
// (some barely narrow it down), hesitates over the list, says "I know it", reads a couple of wrong
// cards and crosses them out, then picks the secret.
export default {
  max: 150,
  tail: 5,
  async prepare(page, { args }) {
    await page.getByRole('button', { name: /play whatsit/i }).first().click();
    await page.waitForTimeout(800);
    await page.locator('.whz-theme-btn').nth(Number(args.theme ?? 1)).click();
    await page.waitForTimeout(900);
  },
  async play(page) {
    await page.evaluate(async () => {
      const gb = window.__gb;
      const W = await gb.mod('/src/games/whatsit/logic.ts');
      const B = await gb.mod('/src/games/whatsit/bank/index.ts');
      const play = gb.live((v) => gb.has(v, 'round', 'asked', 'phase', 'crossed'));
      const p0 = await gb.until(() => play()?.phase === 'ask' && play());
      const theme = B.themeById(p0.round.theme);
      const qBtn = (q) => [...document.querySelectorAll('.whz-q')].find((b) => b.textContent.includes(q.text.en));
      await gb.think(1800, 2800);
      for (let guard = 0; guard < 14; guard++) {
        const p = play();
        const left = W.stillFitting(p.round, p.asked);
        if (left.length <= 1) break;
        const scored = theme.questions.filter((q) => !p.asked.includes(q.id)).map((q) => {
          const y = left.filter((id) => W.answer(B.thingById(id), q.id)).length;
          return { q, v: Math.min(y, left.length - y) };
        }).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
        if (!scored.length) break;
        // Not always the best question: any of the top few, now and then a weak one.
        const pool = gb.chance(0.25) ? scored : scored.slice(0, 3);
        const { q } = gb.pick(pool);
        const alt = gb.pick(scored.slice(0, 5)).q;
        if (alt !== q && gb.chance(0.5)) await gb.hover(qBtn(alt), gb.rand(500, 1000));
        await gb.tapH(qBtn(q));
        gb.mark('ask', { q: q.text.en });
        await gb.until(() => play().asked.length > p.asked.length, 3000);
        await gb.think(1500, 2800);
      }
      await gb.tapH(document.querySelector('.whz-btn-ready'));
      await gb.think(700, 1200);
      await gb.tapH(document.querySelector('.whz-sheet .whz-btn-go') ?? gb.byText('button', /know|ready|yes/i));
      await gb.until(() => document.querySelector('.whz-cards'), 4000);
      await gb.think(1500, 2400);
      const p = play();
      const card = (id) => [...document.querySelectorAll('.whz-card')][p.round.lineup.indexOf(id)];
      const decoys = gb.shuffle(p.round.lineup.filter((id) => id !== p.round.secret)).slice(0, 3);
      for (const [k, id] of decoys.entries()) {
        await gb.tapH(card(id));
        await gb.think(1000, 1800);
        if (k < 2) await gb.tapH(gb.byText('.whz-sheet button', /cross out/i));
        else await gb.tapH(gb.byText('.whz-sheet button', /close/i));
        await gb.think(500, 900);
      }
      await gb.tapH(card(p.round.secret));
      await gb.think(1200, 2000);
      await gb.tapH(document.querySelector('.whz-sheet .whz-btn-go'));
      gb.mark('pick', { secret: p.round.secret, name: B.thingById(p.round.secret)?.name?.en, questions: p.asked.length });
    });
  },
};
