// Runs in the page before the game loads. A clock the recorder can hold and step: while "stepped", time
// (performance.now, Date.now, requestAnimationFrame, timers, CSS animations) only moves when the recorder
// calls __clock.tick(ms), so every recorded frame is exactly 1/60 s of game time however long the
// screenshot took. While "live" everything runs as normal. Nothing in the game is changed.
(() => {
  if (window.__clock) return;
  const nRaf = window.requestAnimationFrame.bind(window);
  const nNow = performance.now.bind(performance);
  const nDate = Date.now.bind(Date);
  const nST = window.setTimeout.bind(window);
  const nCT = window.clearTimeout.bind(window);
  const nSI = window.setInterval.bind(window);
  const nCI = window.clearInterval.bind(window);
  const dateBase = nDate() - nNow();
  let stepped = false;
  let vnow = 0;
  let shift = 0;
  const now = () => (stepped ? vnow : nNow() + shift);
  performance.now = now;
  Date.now = () => Math.round(dateBase + now());

  let rafQ = [];
  let rafId = 0;
  let pumping = false;
  const flush = () => {
    const run = rafQ;
    rafQ = [];
    const t = now();
    for (const x of run) {
      try { x.cb(t); } catch (e) { console.error(e); }
    }
  };
  const pump = () => {
    if (pumping) return;
    pumping = true;
    nRaf(() => {
      pumping = false;
      if (!stepped) flush();
    });
  };
  window.requestAnimationFrame = (cb) => {
    const i = ++rafId;
    rafQ.push({ i, cb });
    if (!stepped) pump();
    return i;
  };
  window.cancelAnimationFrame = (i) => { rafQ = rafQ.filter((x) => x.i !== i); };

  // timers started while stepped wait on the held clock; ids above 2^30 are ours
  let timers = [];
  let tid = 1 << 30;
  window.setTimeout = (cb, ms = 0, ...args) => {
    if (!stepped || typeof cb !== 'function') return nST(cb, ms, ...args);
    const i = ++tid;
    timers.push({ i, at: vnow + Math.max(0, ms), cb, args, every: 0 });
    return i;
  };
  window.setInterval = (cb, ms = 0, ...args) => {
    if (!stepped || typeof cb !== 'function') return nSI(cb, ms, ...args);
    const i = ++tid;
    timers.push({ i, at: vnow + Math.max(1, ms), cb, args, every: Math.max(1, ms) });
    return i;
  };
  const clear = (native) => (i) => {
    if (i > 1 << 30) timers = timers.filter((x) => x.i !== i);
    else native(i);
  };
  window.clearTimeout = clear(nCT);
  window.clearInterval = clear(nCI);
  const runTimers = () => {
    for (let guard = 0; guard < 500; guard++) {
      const due = timers.filter((x) => x.at <= vnow).sort((a, b) => a.at - b.at)[0];
      if (!due) return;
      if (due.every) due.at += due.every;
      else timers = timers.filter((x) => x !== due);
      try { due.cb(...due.args); } catch (e) { console.error(e); }
    }
  };

  const owned = new Set();
  const stepAnimations = (ms) => {
    for (const a of document.getAnimations()) {
      try {
        if (!owned.has(a)) {
          owned.add(a);
          a.pause();
        }
        const end = a.effect?.getComputedTiming().endTime;
        const next = (Number(a.currentTime) || 0) + ms;
        if (typeof end === 'number' && Number.isFinite(end) && next >= end) a.finish();
        else a.currentTime = next;
      } catch { /* an animation that went away */ }
    }
  };

  window.__clock = {
    now,
    get stepped() { return stepped; },
    hold() {
      if (stepped) return;
      vnow = nNow() + shift;
      stepped = true;
      stepAnimations(0);
    },
    release() {
      if (!stepped) return;
      shift = vnow - nNow();
      stepped = false;
      for (const t of timers) (t.every ? nSI : nST)(t.cb, t.every || Math.max(0, t.at - vnow), ...t.args);
      timers = [];
      for (const a of owned) { try { if (a.playState === 'paused') a.play(); } catch { /* gone */ } }
      owned.clear();
      if (rafQ.length) pump();
    },
    tick(ms) {
      vnow += ms;
      runTimers();
      flush();
      stepAnimations(ms);
    },
    /** A real pause that the held clock doesn't touch (the recorder waits on loads with it). */
    wait: (ms) => new Promise((ok) => nST(ok, ms)),
    frame: () => new Promise((ok) => nRaf(() => ok())),
  };
})();
