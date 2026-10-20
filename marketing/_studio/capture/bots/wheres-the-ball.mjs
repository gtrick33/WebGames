// Where's the Ball?, endless, played like a person: scans the photo, zooms in, pans around a few
// wrong places, sometimes guesses wrong (a ball-ish thing), zooms back out, then finds it.
export default {
  max: 150,
  tail: 3.5,
  async prepare(page) {
    await page.getByRole('button', { name: /play where/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /endless/i }).first().click();
    await page.waitForTimeout(1200);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (levels) => {
      const gb = window.__gb;
      const { W, H } = await gb.mod('/src/games/wheres-the-ball/scene.ts');
      const level = gb.live((v) => gb.has(v, 'scene', 'aim', 'wrong', 'outcome'));
      const aimAt = async (x, y) => {
        const wrap = document.querySelector('.wb-wrap');
        const r = wrap.getBoundingClientRect();
        const px = r.left + (x / W) * r.width, py = r.top + (y / H) * r.height;
        await gb.moveTo(px, py, gb.rand(250, 450));
        await gb.sleep(gb.rand(80, 180));
        wrap.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: px, clientY: py, pointerId: 4, pointerType: 'touch', isPrimary: true }));
        wrap.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: px, clientY: py, pointerId: 4, pointerType: 'touch', isPrimary: true }));
        gb.ripple(px, py);
      };
      const pan = async (x, y, ms = 900) => {
        const v = document.querySelector('.wb-view');
        const tx = (x / W) * v.scrollWidth - v.clientWidth / 2, ty = (y / H) * v.scrollHeight - v.clientHeight / 2;
        const sx = v.scrollLeft, sy = v.scrollTop, t0 = performance.now();
        while (performance.now() - t0 < ms) {
          const k = (performance.now() - t0) / ms, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          v.scrollLeft = sx + (tx - sx) * e;
          v.scrollTop = sy + (ty - sy) * e;
          await new Promise(requestAnimationFrame);
        }
      };
      const zoom = (dir) => gb.tapH(document.querySelector(`button[aria-label="Zoom ${dir}"]`));
      for (let n = 0; n < levels; n++) {
        const L = await gb.until(() => { const l = level(); return l && l.outcome === 'play' && l.wrong.length === 0 && !l.aim ? l : null; }, 10000);
        if (!L) break;
        const b = L.scene.ball;
        await gb.scan(document.querySelector('.wb-view').getBoundingClientRect(), gb.rand(1500, 2600));
        await zoom('in');
        await gb.sleep(450);
        if (gb.chance(0.6)) {
          await zoom('in');
          await gb.sleep(400);
        }
        // Looking in a couple of wrong places.
        for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) {
          await pan(gb.rand(80, W - 80), gb.rand(80, H - 80), gb.rand(700, 1100));
          await gb.think(400, 900);
        }
        if (n === 1 || gb.chance(0.3)) {
          const d = L.scene.decoys?.[0] ?? { x: (b.x + W / 2) % W, y: (b.y + H / 3) % H };
          await pan(d.x, d.y, 800);
          await gb.think(500, 900);
          await aimAt(d.x, d.y);
          await gb.sleep(600);
          await gb.tapH(document.querySelector('.wb-btn-lock'));
          gb.mark('wrong');
          await gb.think(1200, 1800);
          await zoom('out');
          await gb.think(600, 1200);
        }
        await pan(b.x + gb.rand(-120, 120), b.y + gb.rand(-90, 90), 900);
        await gb.think(500, 1000);
        await pan(b.x, b.y, 700);
        await gb.think(400, 800);
        await aimAt(b.x + gb.rand(-0.3, 0.3) * b.r, b.y + gb.rand(-0.3, 0.3) * b.r);
        await gb.think(500, 1000);
        await gb.tapH(document.querySelector('.wb-btn-lock'));
        gb.mark('found', { n });
        await gb.until(() => level()?.outcome !== 'play', 3000);
        await gb.sleep(2200);
        const next = document.querySelector('.wb-btn-big');
        if (next) await gb.tapH(next);
      }
    }, Number(args.levels ?? 4));
  },
};
