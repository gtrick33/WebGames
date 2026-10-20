// Crosswire, practice grid, played like a person: reads each clue (some take longer), types with
// the odd typo fixed by delete, and tries a wrong unscramble of the mystery word before getting it.
// `--spooky` picks a grid whose mystery word fits Halloween; `--seed n` a specific grid.
export default {
  max: 170,
  tail: 4,
  async prepare(page, { args }) {
    await page.getByRole('button', { name: /play crosswire/i }).first().click();
    await page.waitForTimeout(700);
    const skip = page.getByRole('button', { name: /^skip$/i });
    if (await skip.count()) await skip.click();
    if (args.spooky || args.seed) {
      // Pick the practice grid: practicePuzzle() draws its seed from one Math.random() call.
      await page.evaluate(async ({ size, spooky, seed }) => {
        const { makePuzzle } = await import('/src/games/crosswire/grid.ts');
        const SPOOKY = /^(WITCH|WITCHES|GHOST|GHOSTS|SKULL|BAT|BATS|SPIDER|PUMPKIN|CANDY|MUMMY|ZOMBIE|VAMPIRE|CAULDRON|BROOM|HAUNT|COFFIN|CRYPT|OWL)$/;
        let s = Number(seed) || 0;
        if (spooky) for (s = 1; s < 50000 && !SPOOKY.test(makePuzzle(s, size).mystery?.word ?? ''); s++);
        const real = Math.random;
        Math.random = () => {
          Math.random = real;
          return (s + 0.5) / 2 ** 32;
        };
      }, { size: (args.size ?? 'small').toLowerCase(), spooky: !!args.spooky, seed: args.seed });
    }
    await page.getByRole('button', { name: new RegExp(args.size ?? 'small', 'i') }).click();
    await page.waitForTimeout(700);
    const skip2 = page.getByRole('button', { name: /^skip$/i });
    if (await skip2.count()) await skip2.click();
  },
  async play(page) {
    await page.evaluate(async () => {
      const gb = window.__gb;
      const screen = gb.live((v) => gb.has(v, 'kind', 'puzzle') && v.kind === 'play');
      const cursor = gb.live((v) => gb.has(v, 'word', 'pos') && Object.keys(v).length === 2);
      const p = screen().puzzle;
      const G = await gb.mod('/src/games/crosswire/grid.ts');
      const entries = () => gb.find((v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => /^\d+,\d+$/.test(k))) ?? {};
      const key = (ch) => [...document.querySelectorAll('.xw-key')].find((b) => b.textContent.trim().toUpperCase() === ch);
      const back = () => document.querySelector('.xw-key-wide');
      await gb.think(1200, 2000);
      let lastWord = -1;
      for (let guard = 0; guard < 400; guard++) {
        if (document.querySelector('.xw-panel')) break;
        const cur = cursor();
        const w = p.words[cur.word];
        if (cur.word !== lastWord) {
          lastWord = cur.word;
          gb.mark('word', { clue: w.clue, word: w.word });
          // Reading the clue: sometimes it clicks at once, sometimes it takes a while.
          await gb.think(700, 1800);
          if (gb.chance(0.25)) await gb.think(1200, 2400);
        }
        // A slip only where delete really takes it back: the next square of the word must be empty
        // (delete clears the current square if it has a letter, else the previous one).
        const cells = G.wordCells(w);
        const nextCell = cells[cur.pos + 1];
        const e = entries();
        if (gb.chance(0.06) && nextCell && !e[`${nextCell[0]},${nextCell[1]}`]) {
          const wrong = gb.pick('AEIOURSTLN'.split('').filter((c) => c !== w.word[cur.pos]));
          await gb.tapH(key(wrong), { settle: [30, 90] });
          await gb.think(400, 900);
          await gb.tapH(back(), { settle: [30, 90] });
          await gb.sleep(gb.rand(150, 300));
        }
        await gb.tapH(key(w.word[cur.pos]), { settle: [30, 100] });
        await gb.sleep(gb.rand(90, 320));
      }
      gb.mark('grid');
      const input = await gb.until(() => document.querySelector('.xw-input'), 3000);
      if (input && p.mystery) {
        await gb.think(2200, 3400);
        const word = p.mystery.word;
        // A first unscramble that's wrong (same letters, wrong order), then the real one.
        const wrong = word.length > 3 ? word.slice(1) + word[0] : null;
        if (wrong && wrong !== word) {
          await gb.fill(input, wrong, 240);
          await gb.sleep(500);
          await gb.tapH(gb.byText('button', /solve/i));
          gb.mark('wrong-mystery');
          await gb.think(1400, 2200);
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          for (let i = wrong.length - 1; i >= 0; i--) {
            set.call(input, wrong.slice(0, i));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await gb.sleep(70);
          }
          await gb.think(600, 1200);
        }
        await gb.fill(input, word, 260);
        await gb.sleep(500);
        await gb.tapH(gb.byText('button', /solve/i));
        gb.mark('mystery', { word });
      }
    });
  },
};
