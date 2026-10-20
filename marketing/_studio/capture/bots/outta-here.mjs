// Outta Here, endless, played like a person: looks over each board, hovers an arrow or two before
// tapping, and now and then taps one that's blocked (it bumps and costs a heart), for `--levels`
// levels (default 4). The first bump is always on level 2.
export default {
  max: 170,
  tail: 3,
  async prepare(page) {
    await page.getByRole('button', { name: /play outta here/i }).first().click();
    await page.waitForTimeout(700);
    const skip = page.getByRole('button', { name: /^skip$/i });
    if (await skip.count()) await skip.click();
    await page.getByRole('button', { name: /endless/i }).first().click();
    await page.waitForTimeout(800);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (levels) => {
      const gb = window.__gb;
      const O = await gb.mod('/src/games/outta-here/logic.ts');
      const run = gb.live((v) => gb.has(v, 'level', 'gone', 'leaving', 'hearts', 'phase'));
      const U = 10;
      const xy = (size, cell) => {
        const svg = document.querySelector('svg.oh-board').getBoundingClientRect();
        const span = size * U + 4;
        return [svg.left + (((cell % size) * U + U / 2 + 2) / span) * svg.width, svg.top + ((Math.floor(cell / size) * U + U / 2 + 2) / span) * svg.height];
      };
      const tapCell = async (size, cell) => {
        const [x, y] = xy(size, cell);
        await gb.moveTo(x, y, gb.rand(220, 420));
        await gb.sleep(gb.rand(60, 160));
        gb.tapAt(x, y);
      };
      let bumps = 0;
      await gb.think(1000, 1800);
      for (let n = 0; n < levels; n++) {
        await gb.scan(document.querySelector('svg.oh-board').getBoundingClientRect(), gb.rand(900, 1700));
        let bumped = false;
        for (let guard = 0; guard < 200; guard++) {
          const r = run();
          if (!r || r.phase !== 'play') break;
          const left = r.level.arrows.filter((a) => !r.gone.has(a.id));
          if (!left.length) break;
          const free = left.filter((x) => O.canLeave(r.level, r.gone, x));
          const stuck = left.filter((x) => !O.canLeave(r.level, r.gone, x));
          let a = gb.pick(free);
          const wantBump = !bumped && r.hearts > 1 && bumps < 3 && stuck.length && (n === 1 ? guard === 2 : gb.chance(0.05));
          if (wantBump) {
            a = gb.pick(stuck);
            bumped = true;
            bumps++;
            gb.mark('bump');
          }
          if (!a) break;
          if (gb.chance(0.25) && left.length > 2) {
            const o = gb.pick(left.filter((x) => x !== a));
            const [hx, hy] = xy(r.level.size, o.cells[o.cells.length - 1]);
            await gb.moveTo(hx, hy);
            await gb.think(300, 700);
          }
          await gb.think(350, 1000);
          await tapCell(r.level.size, a.cells[a.cells.length - 1]);
          await gb.sleep(160);
        }
        await gb.until(() => run()?.phase !== 'play', 4000);
        gb.mark('cleared', { n: run()?.n });
        await gb.sleep(1500);
        const banner = document.querySelector('.oh-banner');
        if (banner && n + 1 < levels) await gb.tapH(banner);
        await gb.sleep(700);
      }
    }, Number(args.levels ?? 4));
  },
};
