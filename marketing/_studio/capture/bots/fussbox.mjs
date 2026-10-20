// Fussbox, practice, played like a person: builds test cards on the pickers (changing its mind on a
// picker now and then, rolling the dice once), learns from the dings and buzzes, then takes the
// exam with a wrong answer or two before seeing the rule.
export default {
  max: 150,
  tail: 5,
  async prepare(page, { args }) {
    await page.getByRole('button', { name: /play fussbox/i }).first().click();
    await page.waitForTimeout(800);
    await page.locator('.fbx-levels .fbx-btn').nth(Number(args.level ?? 2) - 1).click();
    await page.waitForTimeout(900);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (tests) => {
      const gb = window.__gb;
      const F = await gb.mod('/src/games/fussbox/logic.ts');
      const play = gb.live((v) => gb.has(v, 'round', 'tests', 'phase', 'marks'));
      const p0 = await gb.until(() => play()?.phase === 'lab' && play());
      const rule = p0.round.rule;
      const pool = F.ALL_CARDS.filter((id) => !p0.round.exam.includes(id) && !p0.round.liked.includes(id) && !p0.round.hated.includes(id));
      const yes = gb.shuffle(pool.filter((id) => F.likes(rule, F.cardOf(id))));
      const no = gb.shuffle(pool.filter((id) => !F.likes(rule, F.cardOf(id))));
      const picks = [];
      for (let i = 0; i < tests; i++) picks.push((i % 2 ? no : yes)[i >> 1] ?? (i % 2 ? yes : no)[i >> 1]);
      const pickers = () => document.querySelectorAll('.fbx-picker');
      const opt = (k, v) => pickers()[k].querySelectorAll('.fbx-pick')[v];
      await gb.think(1800, 2800);
      // Look at the examples first.
      for (const t of document.querySelectorAll('.fbx-trays [class*="card"], .fbx-trays img, .fbx-trays svg')) {
        if (gb.chance(0.35)) await gb.hover(t, gb.rand(300, 600));
      }
      for (const [n, id] of picks.entries()) {
        if (n === 1) {
          await gb.tapH(document.querySelector('.fbx-row .fbx-btn:not(.fbx-btn-go)'));
          gb.mark('dice');
          await gb.think(600, 1100);
        }
        const c = F.cardOf(id);
        for (const [k, attr] of ['count', 'shape', 'colour', 'fill'].entries()) {
          if (opt(k, c[attr]).getAttribute('aria-checked') === 'true') continue;
          if (gb.chance(0.2)) {
            const other = [0, 1, 2].filter((v) => v !== c[attr]);
            await gb.tapH(opt(k, gb.pick(other)));
            await gb.think(300, 700);
          }
          await gb.tapH(opt(k, c[attr]));
          await gb.sleep(gb.rand(150, 400));
        }
        await gb.think(500, 1100);
        await gb.tapH(document.querySelector('.fbx-btn-feed'));
        gb.mark('feed', { liked: F.likes(rule, c) });
        await gb.think(1600, 2600);
      }
      await gb.tapH(document.querySelector('.fbx-btn-exam'));
      await gb.until(() => document.querySelector('.fbx-exam-grid'), 4000);
      await gb.think(1500, 2200);
      const exam = play().round.exam;
      const rows = document.querySelectorAll('.fbx-exam-grid li');
      const slips = new Set([Math.floor(Math.random() * exam.length)]);
      if (gb.chance(0.35)) slips.add(Math.floor(Math.random() * exam.length));
      for (let i = 0; i < exam.length; i++) {
        const like = F.likes(rule, F.cardOf(exam[i]));
        const say = slips.has(i) ? !like : like;
        const y = rows[i].querySelector('.fbx-y'), x = rows[i].querySelector('.fbx-n');
        await gb.think(400, 1100);
        await gb.waver([y, x], say ? y : x, 0.3);
      }
      await gb.think(600, 1200);
      await gb.tapH(document.querySelector('.fbx-exam .fbx-btn-big'));
      const ruleEl = await gb.until(() => document.querySelector('.fbx-rule'), 3000);
      gb.mark('handin', { rule: ruleEl?.textContent.replace(/^the rule was:?/i, '').trim() });
    }, Number(args.tests ?? 5));
  },
};
