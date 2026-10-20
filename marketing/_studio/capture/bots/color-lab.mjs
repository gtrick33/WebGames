// Color Lab, practice, played like a person: it picks up a tube and changes its mind, tries pours
// that don't fit (the tube shakes), makes the odd pointless move, undoes one, and works its way to
// the solution (the game's solver keeps it on a solvable path), for `--levels` puzzles (default 2).
export default {
  max: 170,
  tail: 3.5,
  async prepare(page, { args }) {
    await page.getByRole('button', { name: /play color lab/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole('radio', { name: new RegExp(args.size ?? 'medium', 'i') }).click();
    await page.getByRole('button', { name: /^practice$/i }).click();
    await page.waitForTimeout(800);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (levels) => {
      const gb = window.__gb;
      const S = await gb.mod('/src/games/color-lab/sort.ts');
      const level = gb.live((v) => gb.has(v, 'level', 'board', 'history', 'moves', 'status'));
      const tubes = () => document.querySelectorAll('.cl-tube');
      const calm = () => gb.until(() => !document.querySelector('.cl-tube.is-pouring'), 4000);
      const isUp = (i) => tubes()[i]?.classList.contains('is-up');
      const lift = async (i) => {
        for (let t = 0; t < 3 && !isUp(i); t++) {
          await gb.tapH(tubes()[i]);
          await gb.until(() => isUp(i), 600);
        }
      };
      const pourMove = async (m) => {
        await calm();
        const before = level().moves;
        await lift(m.from);
        await gb.think(200, 600);
        await gb.tapH(tubes()[m.to]);
        await gb.until(() => level().moves > before, 3000);
      };
      for (let n = 0; n < levels; n++) {
        const L = await gb.until(() => { const x = level(); return x && x.status === 'play' && x.moves === 0 ? x : null; }, 8000);
        if (!L) break;
        await gb.think(1200, 2200);
        // Look the tubes over first.
        for (const t of gb.shuffle([...tubes()]).slice(0, 2)) await gb.hover(t, gb.rand(300, 600));
        let undone = false;
        for (let guard = 0; guard < 80 && level().status === 'play'; guard++) {
          const b = level().board;
          const sol = S.solveBest(b, 20000);
          if (!sol || !sol.moves.length) break;
          let m = sol.moves[0];
          const roll = Math.random();
          await calm();
          if (roll < 0.09) {
            // Picks one up, thinks better of it, puts it back.
            const other = Math.floor(Math.random() * b.length);
            await lift(other);
            await gb.think(500, 1100);
            await gb.tapH(tubes()[other]);
            gb.mark('rethink');
            await gb.think(300, 700);
          } else if (roll < 0.14) {
            // Tries a pour that doesn't fit.
            const bad = [];
            for (let f = 0; f < b.length; f++) for (let t = 0; t < b.length; t++) if (f !== t && b[f].layers.length && !S.canPour(b, f, t)) bad.push([f, t]);
            if (bad.length) {
              const [f, t] = gb.pick(bad);
              await lift(f);
              await gb.think(200, 500);
              await gb.tapH(tubes()[t]);
              gb.mark('nope');
              await gb.think(600, 1200);
              if (isUp(f)) await gb.tapH(tubes()[f]);
              continue;
            }
          } else if (roll < 0.25) {
            // A move that isn't on the best path (as long as the puzzle stays solvable).
            const alts = S.usefulMoves(b).filter((x) => x.from !== m.from || x.to !== m.to);
            const alt = alts.length ? gb.pick(alts) : null;
            if (alt && S.solveBest(S.pour(b, alt.from, alt.to), 20000)) m = alt;
          }
          await gb.think(350, 1000);
          await pourMove(m);
          // Once per puzzle: "hmm, no" and undo a move.
          if (!undone && guard > 3 && gb.chance(0.2) && level().status === 'play') {
            undone = true;
            await gb.think(600, 1100);
            await gb.tapH(document.querySelector('.cl-tool-undo'));
            gb.mark('undo');
            await gb.think(500, 900);
          }
        }
        await gb.until(() => level().status === 'won', 6000);
        gb.mark('won', { n, moves: level().moves });
        await gb.sleep(2600);
        if (n + 1 < levels) {
          const next = gb.byText('button', /next|another|new puzzle|continue/i);
          if (next) await gb.tapH(next);
        }
      }
    }, Number(args.levels ?? 2));
  },
};
