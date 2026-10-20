// Letter Pinch, practice word, played like a person: a favourite opener, then guesses that only
// roughly use the clues at first (and get sharper), typos fixed with the delete key, and real
// thinking time between rows.
export default {
  max: 150,
  tail: 4,
  async prepare(page) {
    await page.getByRole('button', { name: /play letter pinch/i }).first().click();
    await page.waitForTimeout(700);
    const go = page.getByRole('button', { name: /let.s play/i });
    if (await go.count()) await go.click();
    await page.getByRole('tab', { name: /practice/i }).click();
    await page.waitForTimeout(600);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (opener) => {
      const gb = window.__gb;
      const L = await gb.mod('/src/games/letter-pinch/logic.ts');
      const puzzle = gb.live((v) => gb.has(v, 'mode', 'secret', 'rows', 'startedAt') && v.mode === 'practice');
      const keys = () => [...document.querySelectorAll('.lp-key')];
      const key = (ch) => keys().find((b) => b.textContent.trim().toLowerCase() === ch);
      const enter = () => keys().find((b) => /enter/i.test(b.textContent));
      const del = () => document.querySelector('.lp-key[aria-label="Delete letter"]');
      const openers = ['mouse', 'plant', 'night', 'grape', 'cloud', 'stork', 'brick', 'crane', 'tiger'].filter((w) => L.isAllowed(w));
      let guess = opener || gb.pick(openers);
      await gb.think(1200, 2200);
      for (let n = 0; n < 6; n++) {
        for (let i = 0; i < guess.length; i++) {
          // A slip of the thumb now and then: wrong key, pause, delete.
          if (gb.chance(0.07)) {
            const near = gb.pick('qwertyuiopasdfghjklzxcvbnm'.split('').filter((c) => c !== guess[i]));
            await gb.tapH(key(near), { settle: [30, 90] });
            await gb.think(350, 800);
            await gb.tapH(del(), { settle: [30, 90] });
          }
          await gb.tapH(key(guess[i]), { settle: [30, 110] });
          await gb.sleep(gb.rand(60, 260));
        }
        await gb.think(500, 1300);
        await gb.tapH(enter());
        const before = puzzle().rows.length;
        await gb.until(() => puzzle().rows.length > before, 4000);
        const p = puzzle();
        gb.mark('guess', { word: guess, n: p.rows.length });
        if (p.rows.some((r) => r.word === p.secret) || p.endedAt) {
          gb.mark('solved', { word: p.secret, rows: p.rows.length });
          break;
        }
        await gb.think(1800, 3600);
        const w = L.windowsFor(p.rows);
        const tried = new Set(p.rows.map((r) => r.word));
        const fits = L.ANSWER_LIST.filter((x) => !tried.has(x) && L.fits(x, w));
        // Early on, a person uses some of the clues, not all: words that fit most columns.
        const score = (x) => [...x].filter((ch, i) => { const c = ch.charCodeAt(0) - 97; return c >= w[i].lo && c <= w[i].hi; }).length;
        const loose = L.ANSWER_LIST.filter((x) => !tried.has(x) && score(x) >= 4);
        guess = n < 2 && gb.chance(0.65) && loose.length ? gb.pick(loose) : fits.length ? gb.pick(fits) : p.secret;
        if (n >= 4) guess = fits.includes(p.secret) && gb.chance(0.6) ? p.secret : guess;
      }
    }, args.opener ?? null);
  },
};
