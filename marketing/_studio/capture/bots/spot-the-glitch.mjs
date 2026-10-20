// Spot the Glitch, Glitch Rush, played like a person: the finger roams the pictures while looking,
// some differences take a while, there are wrong taps, and the last one is the hardest to find.
export default {
  max: 140,
  tail: 3.5,
  async prepare(page, { args }) {
    await page.getByRole('button', { name: /play spot the glitch/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: new RegExp(args.mode ?? 'rush', 'i') }).first().click();
    await page.waitForTimeout(900);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (pictures) => {
      const gb = window.__gb;
      const { W, H } = await gb.mod('/src/games/spot-the-glitch/scene.ts');
      const pic = gb.live((v) => gb.has(v, 'puzzle', 'found', 'misses', 'hinted'));
      const at = (x, y, side) => {
        const r = document.querySelectorAll('.sg-pic')[side].getBoundingClientRect();
        const k = r.width / W;
        return [r.left + x * k, r.top + y * k, r];
      };
      const tapScene = async (x, y, side) => {
        const [px, py] = at(x, y, side);
        await gb.moveTo(px, py, gb.rand(250, 450));
        await gb.sleep(gb.rand(80, 200));
        const el = document.querySelectorAll('.sg-pic')[side];
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: px, clientY: py, pointerId: 3, pointerType: 'touch', isPrimary: true }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: px, clientY: py, pointerId: 3, pointerType: 'touch', isPrimary: true }));
        gb.ripple(px, py);
      };
      const far = (d) => {
        // A plain spot away from every difference, for a wrong tap.
        for (let k = 0; k < 40; k++) {
          const x = gb.rand(30, W - 30), y = gb.rand(30, H - 30);
          if (d.every((df) => df.spots.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + 40))) return [x, y];
        }
        return [W / 2, H / 2];
      };
      let missed = false;
      for (let n = 0; n < pictures; n++) {
        const p0 = await gb.until(() => { const p = pic(); return p && p.found.length === 0 && !p.finishedAt ? p : null; }, 8000);
        if (!p0) break;
        await gb.think(1200, 2000);
        const order = gb.shuffle(p0.puzzle.diffs.map((_, i) => i));
        for (let k = 0; k < order.length; k++) {
          const d = p0.puzzle.diffs[order[k]];
          const s = d.spots[0];
          const side = gb.chance(0.5) ? 0 : 1;
          // Looking around: longer for later (harder) ones.
          await gb.scan(at(0, 0, side)[2], gb.rand(700, 1500) + k * gb.rand(200, 600));
          if ((!missed && n >= 1 && k === 2) || gb.chance(0.12)) {
            missed = true;
            const [x, y] = far(p0.puzzle.diffs);
            await tapScene(x, y, side);
            gb.mark('miss');
            await gb.think(900, 1600);
          }
          await tapScene(s.x + gb.rand(-4, 4), s.y + gb.rand(-4, 4), side);
          gb.mark('found', { n, k: k + 1 });
          await gb.think(400, 900);
        }
        await gb.until(() => pic()?.finishedAt, 3000);
        await gb.sleep(1600);
        const next = document.querySelector('.sg-btn-big') ?? gb.byText('button', /next/i);
        if (next) await gb.tapH(next);
      }
    }, Number(args.pictures ?? 4));
  },
};
