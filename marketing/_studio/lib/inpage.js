// Injected into every recorded page (addInitScript). Gives bots a small toolkit as window.__gb:
// read a game's live React state, tap / drag / press keys like a player, and show a tap ripple so
// viewers can see where the "finger" went.
(() => {
  if (window.__gb) return;
  const gb = {};
  window.__gb = gb;

  // ---- React state -------------------------------------------------------------------------
  function rootFiber() {
    const el = document.getElementById('root');
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith('__reactContainer$'));
    // The container keeps the first HostRoot fiber; its FiberRoot's `current` is the live tree.
    return key ? el[key].stateNode?.current ?? el[key] : null;
  }

  /** Every hook value (state values, ref.current, memo values) of every mounted component. */
  function* hookValues() {
    const root = rootFiber();
    if (!root) return;
    const stack = [root];
    while (stack.length) {
      const f = stack.pop();
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
      let h = typeof f.type === 'function' || typeof f.type === 'object' ? f.memoizedState : null;
      let guard = 0;
      while (h && typeof h === 'object' && 'next' in h && guard++ < 200) {
        const v = h.memoizedState;
        if (v && typeof v === 'object') {
          if ('current' in v && Object.keys(v).length === 1) yield { v: v.current, fiber: f, ref: v };
          else if (Array.isArray(v) && v.length === 2 && Array.isArray(v[1])) yield { v: v[0], fiber: f };
          else if (!('create' in v && 'deps' in v)) yield { v, fiber: f };
        } else if (v !== null && v !== undefined) yield { v, fiber: f };
        h = h.next;
      }
      if (f.memoizedProps && typeof f.type === 'function') yield { v: f.memoizedProps, fiber: f, props: true };
    }
  }

  gb.find = (pred) => {
    for (const { v } of hookValues()) {
      try {
        if (pred(v)) return v;
      } catch { /* ignore */ }
    }
    return undefined;
  };
  gb.findAll = (pred) => {
    const out = [];
    for (const { v } of hookValues()) {
      try {
        if (pred(v)) out.push(v);
      } catch { /* ignore */ }
    }
    return out;
  };
  /** Like find, but returns the ref object itself so a bot can read the latest value later. */
  gb.findRef = (pred) => {
    for (const x of hookValues()) {
      try {
        if (x.ref && pred(x.v)) return x.ref;
      } catch { /* ignore */ }
    }
    return undefined;
  };
  /** Imports one of the site's own modules (the dev server compiles /src/... on request). */
  gb.mod = (path) => import(/* @vite-ignore */ path);
  /** The latest value of a state slot matching pred (re-found on every call, since state objects are replaced). */
  gb.live = (pred) => () => gb.find(pred);
  gb.has = (o, ...keys) => o && typeof o === 'object' && keys.every((k) => k in o);

  // ---- Input ----------------------------------------------------------------------------------
  let ripples = true;
  gb.ripples = (on) => (ripples = on);
  function ripple(x, y, color = 'rgba(255,255,255,0.9)') {
    if (!ripples) return;
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
      border:4px solid ${color};box-shadow:0 0 0 3px rgba(29,18,56,.55), inset 0 0 0 3px rgba(29,18,56,.35);background:rgba(255,255,255,.28);
      pointer-events:none;z-index:2147483647;transform:scale(.55);opacity:1;transition:transform .42s cubic-bezier(.2,.9,.3,1),opacity .42s ease-out`;
    document.body.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      d.style.transform = 'scale(1.35)';
      d.style.opacity = '0';
    }));
    setTimeout(() => d.remove(), 600);
  }
  gb.ripple = ripple;

  const center = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  gb.center = center;

  function pointer(type, el, x, y, extra = {}) {
    const ev = new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch',
      isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, pressure: type === 'pointerup' ? 0 : 0.5, ...extra,
    });
    el.dispatchEvent(ev);
  }
  function mouse(type, el, x, y) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: type === 'mouseup' || type === 'click' ? 0 : 1 }));
  }

  /** Taps the element under (x, y), or `el` at its centre. Fires pointer, mouse and click like a touch. */
  gb.tapAt = (x, y, { show = true } = {}) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (show) ripple(x, y);
    pointer('pointerdown', el, x, y);
    mouse('mousedown', el, x, y);
    pointer('pointerup', el, x, y);
    mouse('mouseup', el, x, y);
    mouse('click', el, x, y);
    return el;
  };
  gb.tap = (el, opts) => {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.bottom > innerHeight || r.top < 0) el.scrollIntoView({ block: 'center' });
    const [x, y] = center(el);
    // Tap what is really there; if something covers the target, click the target itself.
    const hit = document.elementFromPoint(x, y);
    if (hit && (hit === el || el.contains(hit))) return gb.tapAt(x, y, opts);
    if (opts?.show !== false) ripple(x, y);
    el.click();
    return el;
  };
  /** Press without release (for hold-to-steer games). Returns release(). */
  gb.hold = (x, y, { show = true } = {}) => {
    const el = document.elementFromPoint(x, y);
    if (show) ripple(x, y);
    pointer('pointerdown', el, x, y);
    mouse('mousedown', el, x, y);
    return () => {
      pointer('pointerup', el, x, y);
      mouse('mouseup', el, x, y);
    };
  };
  /** Drags from (x0,y0) to (x1,y1) over `ms`, resolving when done. */
  gb.drag = (x0, y0, x1, y1, ms = 400, { show = true } = {}) => new Promise((done) => {
    const el = document.elementFromPoint(x0, y0);
    if (show) ripple(x0, y0);
    pointer('pointerdown', el, x0, y0);
    mouse('mousedown', el, x0, y0);
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const x = x0 + (x1 - x0) * e;
      const y = y0 + (y1 - y0) * e;
      const target = document.elementFromPoint(x, y) || el;
      pointer('pointermove', el, x, y);
      mouse('mousemove', target, x, y);
      if (k < 1) requestAnimationFrame(tick);
      else {
        pointer('pointerup', el, x1, y1);
        mouse('mouseup', document.elementFromPoint(x1, y1) || el, x1, y1);
        done();
      }
    };
    requestAnimationFrame(tick);
  });
  /** A finger dot that follows drags and slider moves (shown while `down`). */
  let fingerEl = null;
  gb.finger = (x, y, down = true) => {
    if (!ripples) return;
    if (!fingerEl) {
      fingerEl = document.createElement('div');
      fingerEl.style.cssText = `position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:4px solid rgba(255,255,255,.95);
        box-shadow:0 0 0 3px rgba(29,18,56,.55);background:rgba(255,255,255,.3);pointer-events:none;z-index:2147483647;transition:opacity .2s,transform .2s;`;
      document.body.appendChild(fingerEl);
    }
    fingerEl.style.left = `${x}px`;
    fingerEl.style.top = `${y}px`;
    fingerEl.style.opacity = down ? '1' : '0';
    fingerEl.style.transform = down ? 'scale(1)' : 'scale(1.4)';
  };
  /** Moves a native range input to `to` over `ms` like a thumb drag (React sees input events). */
  gb.slide = (input, to, ms = 700) => new Promise((done) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const from = Number(input.value);
    const r = input.getBoundingClientRect();
    const xAt = (v) => r.left + 12 + ((v - min) / (max - min)) * (r.width - 24);
    const y = r.top + r.height / 2;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      const step = Number(input.step) || 1;
      const v = Math.min(max, Math.max(min, min + Math.round((from + (to - from) * e - min) / step) * step));
      gb.finger(xAt(v), y, true);
      if (Number(input.value) !== v) {
        set.call(input, String(v));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (k < 1) requestAnimationFrame(tick);
      else {
        setTimeout(() => gb.finger(xAt(v), y, false), 120);
        done();
      }
    };
    requestAnimationFrame(tick);
  });
  /** Types into a controlled text input (React sees each keystroke as an input event). */
  gb.fill = async (input, text, gap = 110) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus();
    for (let i = 1; i <= text.length; i++) {
      set.call(input, text.slice(0, i));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await gb.sleep(gap);
    }
  };
  /** Drags through waypoints [[x, y, pauseMs], ...] (a drag that hesitates or changes its mind). */
  gb.dragPath = (points, ms = 420, { show = true } = {}) => new Promise((done) => {
    const [x0, y0] = points[0];
    const el = document.elementFromPoint(x0, y0);
    if (show) ripple(x0, y0);
    pointer('pointerdown', el, x0, y0);
    mouse('mousedown', el, x0, y0);
    let i = 1;
    const leg = () => {
      if (i >= points.length) {
        const [xe, ye] = points[points.length - 1];
        pointer('pointerup', el, xe, ye);
        mouse('mouseup', document.elementFromPoint(xe, ye) || el, xe, ye);
        gb.finger(xe, ye, false);
        return done();
      }
      const [ax, ay] = points[i - 1];
      const [bx, by, pause = 0] = points[i];
      const t0 = performance.now();
      const dur = ms * gb.rand(0.8, 1.2);
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const x = ax + (bx - ax) * e, y = ay + (by - ay) * e;
        pointer('pointermove', el, x, y);
        mouse('mousemove', document.elementFromPoint(x, y) || el, x, y);
        gb.finger(x, y, true);
        if (k < 1) requestAnimationFrame(tick);
        else {
          i++;
          setTimeout(leg, pause);
        }
      };
      requestAnimationFrame(tick);
    };
    leg();
  });
  gb.key = (key, type = 'both', target = window) => {
    const code = key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key;
    const opts = { key, code, bubbles: true, cancelable: true };
    if (type !== 'up') (target === window ? document.activeElement || document.body : target).dispatchEvent(new KeyboardEvent('keydown', opts));
    if (type !== 'down') (target === window ? document.activeElement || document.body : target).dispatchEvent(new KeyboardEvent('keyup', opts));
  };
  /** Types into the focused element / window as key presses. */
  gb.type = async (text, gap = 90) => {
    for (const ch of text) {
      gb.key(ch);
      await gb.sleep(gap);
    }
  };
  gb.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  gb.until = async (fn, ms = 10000, every = 50) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      try {
        const v = fn();
        if (v) return v;
      } catch { /* not yet */ }
      await gb.sleep(every);
    }
    return null;
  };
  gb.byText = (sel, re) => [...document.querySelectorAll(sel)].find((e) => (typeof re === 'string' ? e.textContent.includes(re) : re.test(e.textContent)));
  gb.rand = (a, b) => a + Math.random() * (b - a);

  // ---- Human behaviour ------------------------------------------------------------------------
  // Real players hesitate, look around, change their minds and get things wrong. Bots use these so
  // the footage reads like a person playing, not a solver.
  gb.chance = (p) => Math.random() < p;
  gb.pick = (list) => list[Math.floor(Math.random() * list.length)];
  gb.shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  /** A pause to think: usually short, now and then a long one. */
  gb.think = (a = 500, b = 1400) => gb.sleep(gb.rand(a, b) * (Math.random() < 0.18 ? gb.rand(1.6, 2.4) : 1));
  let fx = null;
  let fy = null;
  let idle = 0;
  /** Glides the finger dot (half-visible: hovering, not touching) to (x, y). */
  gb.moveTo = (x, y, ms = gb.rand(260, 560)) => new Promise((done) => {
    if (!ripples) return done();
    if (fx === null) {
      fx = x + gb.rand(-120, 120);
      fy = y + gb.rand(80, 200);
    }
    const x0 = fx, y0 = fy, t0 = performance.now();
    // A slight curve, like a thumb arcs.
    const bend = gb.rand(-0.18, 0.18);
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const px = x0 + (x - x0) * e - (y - y0) * bend * Math.sin(Math.PI * e);
      const py = y0 + (y - y0) * e + (x - x0) * bend * Math.sin(Math.PI * e);
      gb.finger(px, py, true);
      fingerEl.style.opacity = '0.55';
      fingerEl.style.transform = 'scale(0.82)';
      if (k < 1) requestAnimationFrame(tick);
      else {
        fx = x;
        fy = y;
        const me = ++idle;
        setTimeout(() => me === idle && fingerEl && (fingerEl.style.opacity = '0'), 1400);
        done();
      }
    };
    requestAnimationFrame(tick);
  });
  const jitter = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width * gb.rand(0.32, 0.68), r.top + r.height * gb.rand(0.35, 0.65)];
  };
  /** Hovers over an element for a moment without tapping it. */
  gb.hover = async (el, ms = gb.rand(350, 800)) => {
    if (!el) return;
    const [x, y] = jitter(el);
    await gb.moveTo(x, y);
    await gb.sleep(ms);
  };
  /** Glides to an element, settles, taps. */
  gb.tapH = async (el, { settle = [70, 180] } = {}) => {
    if (!el) return null;
    if (typeof el === 'string') el = document.querySelector(el);
    const r0 = el.getBoundingClientRect();
    if (r0.bottom > innerHeight || r0.top < 0) el.scrollIntoView({ block: 'center', behavior: 'smooth' }), await gb.sleep(450);
    const [x, y] = jitter(el);
    await gb.moveTo(x, y);
    await gb.sleep(gb.rand(...settle));
    if (fingerEl) fingerEl.style.opacity = '0';
    const hit = document.elementFromPoint(x, y);
    if (hit && (hit === el || el.contains(hit))) return gb.tapAt(x, y);
    gb.ripple(x, y);
    el.click();
    return el;
  };
  /** Considers some alternatives (hovering one or two) before tapping the final choice. */
  gb.waver = async (options, final, p = 0.65) => {
    const alts = options.filter((o) => o && o !== final);
    const n = alts.length && gb.chance(p) ? (gb.chance(0.35) ? 2 : 1) : 0;
    for (const o of gb.shuffle(alts).slice(0, n)) await gb.hover(o, gb.rand(380, 900));
    await gb.tapH(final);
  };
  /** Moves the finger around a region (looking for something) for `ms`. */
  gb.scan = async (rect, ms) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await gb.moveTo(rect.left + rect.width * gb.rand(0.1, 0.9), rect.top + rect.height * gb.rand(0.1, 0.9), gb.rand(300, 650));
      await gb.sleep(gb.rand(150, 500));
    }
  };

  // ---- Clean footage -------------------------------------------------------------------------
  gb.clean = () => {
    const s = document.createElement('style');
    s.textContent = `.stage-menu{opacity:0!important;pointer-events:none!important}
      *{cursor:none!important} ::-webkit-scrollbar{display:none}`;
    document.head.appendChild(s);
  };
})();
