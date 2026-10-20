// Party Mode, Impostor on one phone: adds four players, picks Impostor and passes the phone around
// (each player peeks at their card), then plays the vote. Walks the real screens with the main button.
export default {
  url: '/party',
  max: 90,
  tail: 3,
  async prepare(page) {
    await page.getByRole('button', { name: /play on this phone/i }).first().click();
    await page.waitForTimeout(900);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (game) => {
      const gb = window.__gb;
      const input = document.querySelector('.pt-input');
      input.scrollIntoView({ block: 'center' });
      await gb.sleep(600);
      for (const name of ['Mia', 'Leo', 'Ana', 'Sam']) {
        await gb.fill(input, name, 120);
        await gb.sleep(250);
        gb.tap(gb.byText('button', /\+ add/i));
        await gb.sleep(500);
      }
      gb.mark('players');
      await gb.sleep(600);
      const card = [...document.querySelectorAll('.pt-mode')].find((b) => b.textContent.toLowerCase().includes(game));
      gb.tap(card);
      gb.mark('pick', { game });
      await gb.sleep(1500);
      // Walk the game: the big button on each screen; vote for a suspect; the impostor's last guess.
      for (let i = 0; i < 30; i++) {
        const suspects = document.querySelectorAll('.pt-imp-suspect');
        const options = document.querySelectorAll('.pt-imp-options .pt-btn');
        if (suspects.length) {
          await gb.sleep(1800);
          // The group catches the impostor (the round's secret is in the game state).
          const round = gb.find((v) => gb.has(v, 'impostors', 'word'));
          const imp = round?.impostors?.[0];
          const players = gb.find((v) => Array.isArray(v) && v.length >= 3 && gb.has(v[0], 'id', 'name', 'color'));
          const name = players?.find((p) => p.id === imp)?.name;
          const target = [...suspects].find((b) => name && b.textContent.trim() === name) ?? [...suspects].find((b) => name && b.textContent.includes(name)) ?? suspects[0];
          await gb.waver([...suspects], target, 0.9);
          gb.mark('vote');
        } else if (options.length) {
          await gb.sleep(2200);
          // The impostor's last-chance guess at the word: a wrong one, so the group wins.
          const word = gb.find((v) => gb.has(v, 'impostors', 'word'))?.word;
          const wrongs = [...options].filter((o) => o.textContent.trim() !== word);
          await gb.waver([...options], gb.pick(wrongs.length ? wrongs : [...options]), 0.9);
          gb.mark('guess');
        } else {
          const big = [...document.querySelectorAll('.pt-screen .pt-btn-big')].find((b) => !b.disabled);
          if (!big) break;
          const pass = !!document.querySelector('.pt-pass');
          if (pass) gb.mark('pass');
          else if (document.querySelector('.pt-imp-talk')) gb.mark('talk');
          else if (/you are the impostor/i.test(document.querySelector('.pt-screen')?.textContent ?? '')) gb.mark('impostor-card');
          else if (/secret word/i.test(document.querySelector('.pt-screen')?.textContent ?? '') && !document.querySelector('.pt-imp-intro')) gb.mark('card');
          await gb.sleep(pass ? gb.rand(1100, 1700) : gb.rand(2000, 3200));
          gb.mark('step', { text: big.textContent.trim().slice(0, 40) });
          await gb.tapH(big);
        }
        await gb.sleep(700);
        if (document.querySelector('.pt-imp-result')) {
          gb.mark('result', { caught: /caught/i.test(document.querySelector('.pt-imp-result').textContent) });
          await gb.sleep(1500);
          document.querySelector('.pt-imp-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }
    }, (args.game ?? 'impostor').toLowerCase());
  },
};
