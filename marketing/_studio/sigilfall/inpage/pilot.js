// Runs in the page beside the game (dev server only). The pilot plays the hero the way a person at a keyboard
// and mouse would: it decides where to walk, where to point and what to press, then sends real key and
// pointer events to the game's own input code. It never writes to the world: every hit, dodge and spell in a
// recording is the game's own answer to those keys.
(() => {
  const SRC = '/src/games/sigilfall';
  const P = {
    soundLog: null,
    frameNo: 0,
    mode: { kind: 'idle' },
    mods: null,
    keys: new Set(),
    lmb: false,
    mouse: null,
    aimPt: null,
    think: 0,
    target: null,
    fromHero: null,
    toGoal: null,
    goal: null,
    dir: { x: 0, y: 0 },
    dirT: 0,
    pressT: 0,
    seenDanger: 0,
    notes: [],
  };
  const rb = () => window.__rb;
  const world = () => rb()?.world ?? null;
  const stageEl = () => document.querySelector('.rb');
  const canvasEl = () => rb()?.renderer?.canvas ?? stageEl()?.querySelector('canvas');

  P.ready = async () => {
    if (P.mods) return true;
    // (a scene's "Skip" button and its "click for the next line" hint are for the player's hands, not the picture)
    const st = document.createElement('style');
    st.textContent = '.rb-scene-skip, .rb-scene-hint { opacity: 0 !important; }';
    document.head.append(st);
    const [map, wld, boss, items, chr, talents, types, math, classes, regions, retired, bosses] = await Promise.all([
      import(`${SRC}/sim/map.ts`), import(`${SRC}/sim/world.ts`), import(`${SRC}/sim/boss.ts`), import(`${SRC}/progress/items.ts`),
      import(`${SRC}/progress/character.ts`), import(`${SRC}/data/talents.ts`), import(`${SRC}/data/types.ts`), import(`${SRC}/core/math.ts`),
      import(`${SRC}/data/classes.ts`), import(`${SRC}/data/regions.ts`), import(`${SRC}/data/retired.ts`), import(`${SRC}/data/bosses.ts`),
    ]);
    P.mods = { map, wld, boss, items, chr, talents, types, math, classes, regions, retired, bosses };
    // every sound the game asks for, with the frame it asked on (the trailer's sound is rebuilt from these)
    const snd = rb().sound;
    if (!snd.__logged) {
      snd.__logged = true;
      const last = new Map();
      const play = snd.play.bind(snd);
      snd.play = (id, vol = 1) => {
        const t = window.__clock.now();
        if (P.soundLog && t - (last.get(id) ?? -1e9) >= 45) {
          last.set(id, t);
          P.soundLog.push({ f: P.frameNo, id, vol: +vol.toFixed(3) });
        }
        return play(id, vol);
      };
      const music = snd.setMusic.bind(snd);
      let lastMusic;
      snd.setMusic = (id) => {
        if (P.soundLog && id !== lastMusic) P.soundLog.push({ f: P.frameNo, music: id });
        lastMusic = id;
        return music(id);
      };
      const amb = snd.setAmbience.bind(snd);
      let lastAmb;
      snd.setAmbience = (id) => {
        if (P.soundLog && id !== lastAmb) P.soundLog.push({ f: P.frameNo, ambience: id });
        lastAmb = id;
        return amb(id);
      };
    }
    return true;
  };

  /* ------------------------------------------------------------ the hands */

  const CODES = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  const keyEvent = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code.replace('Key', '').toLowerCase(), bubbles: true, cancelable: true }));
  P.hold = (codes) => {
    const want = new Set(codes);
    for (const c of P.keys) if (!want.has(c)) keyEvent('keyup', c);
    for (const c of want) if (!P.keys.has(c)) keyEvent('keydown', c);
    P.keys = want;
  };
  P.press = (code) => {
    keyEvent('keydown', code);
    keyEvent('keyup', code);
  };
  const pointer = (type, x, y, target) => (target ?? canvasEl()).dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', pointerId: 1, isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : P.lmb ? 1 : 0, bubbles: true, cancelable: true }));
  /** Points the mouse at a place in the world. */
  P.point = (wx, wy) => {
    const s = rb().renderer.toScreen(wx, wy);
    const r = stageEl().getBoundingClientRect();
    const x = Math.min(r.right - 2, Math.max(r.left + 2, r.left + s.x));
    const y = Math.min(r.bottom - 2, Math.max(r.top + 2, r.top + s.y));
    P.mouse = { x, y };
    pointer('pointermove', x, y);
  };
  P.button = (down) => {
    if (down === P.lmb || !P.mouse) return;
    P.lmb = down;
    if (down) pointer('pointerdown', P.mouse.x, P.mouse.y);
    else window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', pointerId: 1, button: 0, bubbles: true }));
  };
  P.letGo = () => {
    P.hold([]);
    P.button(false);
  };
  const SLOT_KEY = { s1: 'KeyQ', s2: 'KeyE', s3: 'KeyR', s4: 'KeyC', ult: 'KeyF', dodge: 'Space' };

  /* ------------------------------------------------------------ the head */

  const tileOf = (w, x, y) => Math.floor(y / P.mods.map.TILE) * w.map.w + Math.floor(x / P.mods.map.TILE);
  const alive = (e) => !e.dead && !e.dummy && e.hp > 0 && !P.mods.boss.bossHidden(e);

  /** Walk keys for a direction, held a moment so the hero doesn't twitch between two of the eight ways. */
  const walk = (mx, my, dt, force) => {
    P.dirT -= dt;
    const l = Math.hypot(mx, my);
    if (l < 0.2) {
      P.dir = { x: 0, y: 0 };
      P.hold([...P.keys].filter((c) => !Object.values(CODES).includes(c)));
      return;
    }
    if (P.dirT <= 0 || force || (!P.dir.x && !P.dir.y)) {
      const a = Math.round(Math.atan2(my, mx) / (Math.PI / 4)) * (Math.PI / 4);
      P.dir = { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
      P.dirT = 0.12;
    }
    const want = [];
    if (P.dir.x < 0) want.push(CODES.left);
    if (P.dir.x > 0) want.push(CODES.right);
    if (P.dir.y < 0) want.push(CODES.up);
    if (P.dir.y > 0) want.push(CODES.down);
    P.hold(want);
  };

  /** The mouse glides to where the pilot wants to aim, as a hand does, instead of snapping. */
  const aimAt = (x, y, dt, quick = 9) => {
    if (!P.aimPt) P.aimPt = { x, y };
    const k = 1 - Math.exp(-quick * dt);
    P.aimPt.x += (x - P.aimPt.x) * k;
    P.aimPt.y += (y - P.aimPt.y) * k;
    P.point(P.aimPt.x, P.aimPt.y);
  };

  const pickTarget = (w, m) => {
    const p = w.player;
    P.fromHero = P.mods.map.flowField(w.map, Math.floor(p.x / P.mods.map.TILE), Math.floor(p.y / P.mods.map.TILE), 4000, P.fromHero ?? new Int16Array(w.map.w * w.map.h));
    let best = Infinity;
    let target = null;
    for (const e of w.enemies) {
      if (!alive(e)) continue;
      if (m.only && !m.only.includes(e.def.id)) continue;
      if (m.within && Math.hypot(e.x - (m.at?.x ?? p.x), e.y - (m.at?.y ?? p.y)) > m.within) continue;
      const d = P.fromHero[tileOf(w, e.x, e.y)] ?? -1;
      if (d < 0) continue;
      // a boss before its helpers when asked; otherwise the nearest
      const score = d - (m.bossFirst && e.boss ? 1000 : 0);
      if (score < best) {
        best = score;
        target = e;
      }
    }
    return target;
  };

  const flowTo = (w, pt) => {
    P.toGoal = P.mods.map.flowField(w.map, Math.floor(pt.x / P.mods.map.TILE), Math.floor(pt.y / P.mods.map.TILE), 4000, P.toGoal ?? new Int16Array(w.map.w * w.map.h));
  };

  /** One decision, 60 times a second. `m` is the mode (see the modes at the end of the file). */
  const decide = (dt) => {
    const w = world();
    const m = P.mode;
    if (!w || rb().ui.screen !== 'game' || m.kind === 'idle' || m.kind === 'hands') return;
    const p = w.player;
    if (w.scene || rb().isPaused()) {
      P.letGo();
      return;
    }
    if (p.dead) {
      P.letGo();
      return;
    }
    const { map, wld } = P.mods;
    if (P.mapRef !== w.map) {
      P.mapRef = w.map;
      P.fromHero = null;
      P.toGoal = null;
      P.think = 0;
    }
    P.think -= dt;
    if (P.think <= 0) {
      P.think = 0.25;
      P.target = m.kind === 'walk' && !m.fight ? null : pickTarget(w, m);
      // on the road with nothing close: keep walking
      if (m.kind === 'walk' && P.target && Math.hypot(P.target.x - p.x, P.target.y - p.y) > (m.fight === true ? 150 : m.fight)) P.target = null;
      P.goal = P.target ? { x: P.target.x, y: P.target.y } : (m.to ?? null);
      if (P.goal) flowTo(w, P.goal);
    }
    const target = P.target && alive(P.target) ? P.target : null;
    const skill = (slot) => w.build.skills[w.build.bar[slot] ?? '']?.spec;
    const melee = skill('basic')?.cast === 'melee';

    // danger first, after the moment it takes a person to see it
    const danger = m.brave ? null : w.telegraphs.find((t) => t.tone !== 'player' && (t.kind ?? 'danger') === 'danger' && !t.dead && wld.inside(t, p.x, p.y, p.r + 2));
    if (danger) P.seenDanger += dt;
    else P.seenDanger = 0;
    let mx = 0;
    let my = 0;
    let dodge = false;
    if (danger && P.seenDanger > (m.react ?? 0.18)) {
      let ax = p.x - danger.x;
      let ay = p.y - danger.y;
      if (danger.shape === 'line' || danger.shape === 'cone') {
        ax = -Math.sin(danger.angle);
        ay = Math.cos(danger.angle);
        if ((p.x - danger.x) * ax + (p.y - danger.y) * ay < 0) {
          ax = -ax;
          ay = -ay;
        }
      } else if (danger.shape === 'ring' || danger.shape === 'donut') {
        ax = -ax;
        ay = -ay;
      }
      const l = Math.hypot(ax, ay) || 1;
      mx = ax / l;
      my = ay / l;
      if (danger.dur - danger.t < 0.4 && p.cds.dodge.charges > 0) dodge = true;
    } else if (target) {
      const keep = m.keep ?? (melee ? 10 : 62);
      const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
      const step = P.toGoal ? map.flowStep(w.map, P.toGoal, p.x, p.y) : null;
      const blocked = !map.lineOfSight(w.map, p.x, p.y, target.x, target.y) || !map.lineOfSight(w.map, p.x, p.y - 4, target.x, target.y);
      if (d > keep + target.r + 30 || (step && d > keep + target.r) || (blocked && step)) {
        if (step) {
          mx = step.x;
          my = step.y;
        } else {
          mx = (target.x - p.x) / d;
          my = (target.y - p.y) / d;
        }
      } else if (!melee && d < keep * 0.6) {
        mx = (p.x - target.x) / d;
        my = (p.y - target.y) / d;
      } else if (m.strafe && !melee) {
        // a ranged hero circles a little rather than standing rooted
        const s = Math.sin(w.time * 0.9) > 0 ? 1 : -1;
        mx = (-(target.y - p.y) / d) * s;
        my = ((target.x - p.x) / d) * s;
        if (Math.sin(w.time * 2.3) < 0.2) {
          mx = 0;
          my = 0;
        }
      }
    } else if (P.goal) {
      const step = P.toGoal ? map.flowStep(w.map, P.toGoal, p.x, p.y) : null;
      const d = Math.hypot(P.goal.x - p.x, P.goal.y - p.y);
      if (d < (m.near ?? 10)) {
        m.arrived = true;
      } else if (step) {
        mx = step.x;
        my = step.y;
      } else if (d > 4) {
        mx = (P.goal.x - p.x) / d;
        my = (P.goal.y - p.y) / d;
      }
    }
    if (p.casting && !(danger && P.seenDanger > 0.18)) {
      mx = 0;
      my = 0;
    }
    if (m.still) {
      mx = 0;
      my = 0;
    }
    // walking into something the map's paths don't know (a trunk, a cart): half a second of that and the hero
    // steps round it, one way and then the other, as a person does
    P.stuck = P.stuck ?? { x: p.x, y: p.y, t: 0, slide: 0, side: 1 };
    const sk = P.stuck;
    if (mx || my) {
      sk.t += dt;
      if (sk.t > 0.45) {
        if (Math.hypot(p.x - sk.x, p.y - sk.y) < 5 && sk.slide <= 0) {
          sk.slide = 0.7;
          sk.side = -sk.side;
        }
        sk.x = p.x;
        sk.y = p.y;
        sk.t = 0;
      }
      if (sk.slide > 0) {
        sk.slide -= dt;
        const ax = mx;
        mx = -my * sk.side + ax * 0.25;
        my = ax * sk.side + my * 0.25;
      }
    } else sk.t = 0;
    walk(mx, my, dt, !!danger || sk.slide > 0.66);
    if (dodge && P.pressT <= 0) {
      P.press('Space');
      P.pressT = 0.2;
    }

    P.pressT -= dt;
    if (target && !p.casting) {
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      aimAt(target.x, target.y, dt);
      const reach = (slot) => {
        const spec = skill(slot);
        if (!spec || spec.cast === 'blink' || spec.cast === 'form') return !!spec && !!m.all && spec.cast === 'form' && d < 120;
        if (spec.cast === 'buff' || spec.cast === 'summon') return d < 120;
        if (spec.cast === 'melee' || spec.cast === 'nova' || spec.aim === 'self') return d < Math.max(spec.area, 18) + target.r + 6;
        if (spec.cast === 'dash') return d > 30 && d < spec.range;
        return d < Math.max(60, spec.range * 0.9);
      };
      P.button(reach('basic') && !m.noBasic);
      if (P.pressT <= 0 && !m.noSkills) {
        const cd = (slot) => {
          const spec = skill(slot);
          return !spec ? 0 : spec.cast === 'channel' || spec.cast === 'drain' ? -1 : spec.cooldown;
        };
        const allowed = m.slots ?? ['s1', 's2', 's3', 's4', 'ult'];
        let slot = null;
        if (allowed.includes('ult') && p.ult >= 100 && d < 90) slot = 'ult';
        else slot = ['s1', 's2', 's3', 's4'].filter((s) => allowed.includes(s) && p.cds[s]?.charges > 0 && reach(s)).sort((a, b) => cd(b) - cd(a))[0] ?? null;
        if (slot) {
          P.press(SLOT_KEY[slot]);
          P.notes.push({ f: P.frameNo, cast: slot, id: w.build.bar[slot] });
          P.pressT = m.beat ?? 0.45;
        }
      }
    } else if (!target) {
      P.button(false);
      // looking where the hero walks
      if (mx || my) aimAt(p.x + mx * 80, p.y + my * 80, dt, 4);
    }
    if (m.potion !== false && p.hp < p.maxHp * 0.4 && P.pressT <= 0 && (p.potions ?? 1) > 0 && !P.potionT) {
      P.press('Digit1');
      P.potionT = 1;
    }
    if (P.potionT) P.potionT = Math.max(0, P.potionT - dt);
  };

  P.status = () => {
    const w = world();
    const ui = rb()?.ui;
    if (!w || ui.screen !== 'game') return { screen: ui?.screen ?? null, ...(P.modeStatus() ?? {}) };
    const p = w.player;
    const foes = w.enemies.filter(alive);
    const boss = w.enemies.find((e) => e.boss && !e.dead);
    return {
      screen: ui.screen, region: w.region.id, t: +w.time.toFixed(2), x: Math.round(p.x), y: Math.round(p.y), hp: +(p.hp / p.maxHp).toFixed(2), dead: !!p.dead,
      foes: foes.length, near: foes.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 140).length,
      boss: boss ? { id: boss.def.id, hp: +(boss.hp / boss.maxHp).toFixed(3) } : null, scene: w.scene ? (w.scene.def?.id ?? true) : null,
      arrived: !!P.mode.arrived, cleared: !!w.cleared, death: !!ui.death, reward: !!ui.reward, dialogue: !!ui.dialogue, panel: ui.panel ?? null, waiting: !!rb().renderer.waiting,
    };
  };

  /** One recorded frame: the pilot's move, then exactly `ms` of game time. */
  P.frame = (ms) => {
    try {
      if (P.mode.kind === 'vigil') vigilThink(ms / 1000);
      else if (P.mode.kind === 'ring') ringThink(ms / 1000);
      else decide(ms / 1000);
    } catch (e) { console.error('[pilot]', e); }
    if (P.each) P.each();
    window.__clock.tick(ms);
    P.frameNo++;
    return P.status();
  };

  /* ------------------------------------------------------------ setting a stage */

  /**
   * A hero as a player would have them by `level`: the game's own gear rolled for that level, a path chosen and
   * every talent point spent, the bosses' first-meeting scenes already seen unless `fresh`. Then into the world,
   * at a story beat (`preset`, the game's own review presets) or in a land (`region`).
   */
  P.hero = ({ cls = 'warrior', name = 'Aldric', body = 'm', face, level = 1, rarity = 'rare', spec = 0, seed = 7, preset, region, tier = 0, fresh = false, gear = true, slot = 0, spend = true, bag = [], nearLevel = 0, key = 0, zoom = 1 } = {}) => {
    const e = rb();
    const { chr, items, talents, types, math, classes, regions, bosses } = P.mods;
    if (e.ui.screen === 'game') e.toTitle();
    e.createHero(slot, cls, name, body, face, false);
    const c = e.hero;
    for (let g = 0; c.level < level && g < 300; g++) chr.addXp(c, classes.xpToNext(c.level));
    if (gear && level > 1) {
      const r = math.rng(seed);
      for (const s of types.SLOTS) c.equip[s] = items.rollGear(cls, level, rarity, r, s);
    }
    if (c.level >= talents.SPEC_LEVEL) chr.chooseSpec(c, spec);
    for (let g = 0; spend && chr.freePoints(c) > spend - 1 && g < 400; g++) {
      const node = [...talents.TALENTS[cls]].sort((a, b) => (a.tree === spec ? 0 : 1) - (b.tree === spec ? 0 : 1) || a.row - b.row).find((n) => chr.learnTalent(c, n.id));
      if (!node) break;
    }
    for (const r of Object.keys(regions.REGIONS)) if (!c.unlocked.includes(r)) c.unlocked.push(r);
    // things found on the road, waiting in the bag: [{ rarity, slot, level }] rolled by the game's own loot
    bag.forEach((b, i) => c.bag.push(items.rollGear(cls, b.level ?? level, b.rarity ?? 'epic', math.rng(seed + 31 + i * 7), b.slot)));
    // a hero a few kills short of their next level
    if (nearLevel) c.xp = Math.floor(classes.xpToNext(c.level) * nearLevel);
    if (e.settings.zoom !== zoom) e.setSettings({ zoom });
    if (preset) e.usePreset(preset);
    if (!fresh) for (const id of Object.keys(bosses.BOSSES)) if (!c.opened.includes(`scene:boss-${id}`)) c.opened.push(`scene:boss-${id}`);
    c.review = true;
    e.world?.rebuild();
    if (region && key) {
      c.keystone = Math.max(c.keystone, key);
      e.travel(region, 2, [], undefined, key);
    } else if (region) e.travel(region, tier, []);
    else if (!preset) e.travel(e.world.region.id, 0, []);
    P.clearToasts();
    // (the prologue's title card belongs to a hero's first evening, not to one set down mid-story)
    if (!preset || !/^prologue/.test(preset)) {
      e.cards = [];
      if (e.ui.card) e.ui = { ...e.ui, card: null };
      e.bump();
    }
    return P.status();
  };
  /** The review tools' own notes ("Review: ...") are not part of the game a player sees. */
  P.clearToasts = () => {
    const e = rb();
    for (const t of [...(e.ui.toasts ?? [])]) e.dismissToast(t.id);
  };
  P.regions = () => Object.values(P.mods.regions.REGIONS).filter((r) => !P.mods.retired.isRetired(r.id)).map((r) => ({ id: r.id, name: r.name, kind: r.kind, safe: !!r.safe, levels: r.levels }));
  /** Where things are in the land the hero is in: bosses, people, ways out (for planning a shot). */
  P.places = () => {
    const w = world();
    return {
      size: [w.map.w, w.map.h],
      hero: [Math.round(w.player.x), Math.round(w.player.y)],
      bosses: w.map.markers.filter((m) => m.marker.kind === 'boss').map((m) => ({ id: m.marker.boss, name: P.mods.bosses.BOSSES[m.marker.boss]?.name, x: Math.round((m.tx + 0.5) * P.mods.map.TILE), y: Math.round((m.ty + 0.5) * P.mods.map.TILE) })),
      marks: [...new Set(w.map.markers.map((m) => m.marker.kind))],
      npcs: (w.npcs ?? []).map((n) => ({ id: n.id ?? n.def?.id, x: Math.round(n.x), y: Math.round(n.y) })),
      foes: w.enemies.filter(alive).length,
    };
  };

  /**
   * Stands the hero somewhere before a recording starts (never during one): the nearest open tile to a place, as if
   * they had walked there. `P.nearBoss(id, back)` is a spot `back` pixels south of a boss's den.
   */
  P.stand = (x, y) => {
    const w = world();
    const T = P.mods.map.TILE;
    let best = null;
    for (let r = 0; r < 12 && !best; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const tx = Math.floor(x / T) + dx;
        const ty = Math.floor(y / T) + dy;
        if (tx < 0 || ty < 0 || tx >= w.map.w || ty >= w.map.h || w.map.solid[ty * w.map.w + tx]) continue;
        const px = (tx + 0.5) * T;
        const py = (ty + 0.5) * T;
        if (!best || Math.hypot(px - x, py - y) < Math.hypot(best.x - x, best.y - y)) best = { x: px, y: py };
      }
    }
    if (!best) return false;
    w.player.x = best.x;
    w.player.y = best.y;
    P.aimPt = null;
    return true;
  };
  P.bossSpot = (id) => {
    const w = world();
    const m = w.map.markers.find((k) => k.marker.kind === 'boss' && (!id || k.marker.boss === id));
    return m ? { id: m.marker.boss, x: (m.tx + 0.5) * P.mods.map.TILE, y: (m.ty + 0.5) * P.mods.map.TILE } : null;
  };
  /** Game time run without recording (to reach a moment worth filming): `n` steps of 1/60 s. */
  P.skip = (n) => {
    for (let i = 0; i < n; i++) P.frame(1000 / 60);
    return P.status();
  };

  /** Where a scene of this land plays (its `near` place), by the scene's id. */
  P.sceneSpot = async (id) => {
    const a = await import(`${SRC}/data/scenes.ts`);
    const b = await import(`${SRC}/data/scenes-story.ts`);
    const def = [...a.SCENES, ...b.STORY_SCENES].find((x) => x.id === id);
    return def?.near ? { ...(P.find(def.near) ?? {}), near: def.near, r: def.r } : null;
  };

  /**
   * The mouse pointer, drawn (a headless browser shows none): only for the moments the hero's menus are used,
   * so a viewer can follow the clicks. It is where the real pointer events go.
   */
  P.cursor = (x, y) => {
    let el = document.getElementById('studio-cursor');
    if (x === null) return el?.remove();
    if (!el) {
      el = document.createElement('div');
      el.id = 'studio-cursor';
      el.style.cssText = 'position:fixed;left:0;top:0;width:34px;height:34px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.7))';
      el.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2l15 9.2-6.6 1.5L16 20l-3 1.4-3.5-7.2L4 18.5z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      document.body.append(el);
    }
    el.style.transform = `translate(${x - 5}px, ${y - 3}px)`;
  };

  /** The HUD stepped aside, as the game does it for its own scenes (the boss bar, banners and speech stay). */
  P.clean = (on) => {
    let el = document.getElementById('studio-clean');
    if (on && !el) {
      el = document.createElement('style');
      el.id = 'studio-clean';
      el.textContent = '.rb-ui > :not(.rb-scene, .rb-dialogue, .rb-modal, .rb-bossbar, .rb-banner, .rb-tcard, .rb-announce, .rb-encounter) { opacity: 0 !important; }';
      document.head.append(el);
    } else if (!on && el) el.remove();
  };
  /** A named place of the land (the story's own points), a marker kind, or the far end of the land's roads. */
  P.find = (what) => {
    const w = world();
    const T = P.mods.map.TILE;
    if (w.places[what]) return w.places[what];
    const npc = (w.npcs ?? []).find((n) => (n.id ?? n.def?.id) === what);
    if (npc) return { x: npc.x, y: npc.y };
    const p = w.player;
    const flow = P.mods.map.flowField(w.map, Math.floor(p.x / T), Math.floor(p.y / T), 4000, new Int16Array(w.map.w * w.map.h));
    const ms = w.map.markers.filter((m) => (what === 'far' ? ['waystone', 'boss', 'chest', 'shrine'].includes(m.marker.kind) : m.marker.kind === what || m.marker.id === what || m.marker.boss === what));
    let best = null;
    for (const m of ms) {
      const d = flow[m.ty * w.map.w + m.tx] ?? -1;
      if (d >= 0 && (!best || d > best.d)) best = { d, x: (m.tx + 0.5) * T, y: (m.ty + 0.5) * T };
    }
    return best;
  };

  /* ------------------------------------------------------------ the Vigil and the Ring */

  /** The Vigil is steered with the same keys: away from the press of foes, toward the sparks they leave. */
  const vigilThink = (dt) => {
    const g = window.__vigil;
    if (!g?.v || g.v.over) return P.hold([]);
    const { v, me } = g;
    if (me.cards) {
      P.hold([]);
      P.cardT = (P.cardT ?? 0) + dt;
      // a moment to read the three cards, then one is taken
      if (P.cardT > (P.mode.read ?? 1.3)) {
        P.press('Digit' + (1 + (P.frameNo % 3)));
        P.cardT = -0.5;
      }
      return;
    }
    P.cardT = 0;
    let ax = 0;
    let ay = 0;
    let close = 0;
    for (const f of v.foes) {
      const dx = me.x - f.x;
      const dy = me.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 120) continue;
      const k = 1 / (d * d);
      ax += (dx / d) * k * 900;
      ay += (dy / d) * k * 900;
      if (d < 60) close++;
    }
    let best = null;
    for (const s of v.sparks) {
      const d = Math.hypot(s.x - me.x, s.y - me.y);
      if (d < 150 && (!best || d < best.d)) best = { d, s };
    }
    if (best && close < 5) {
      ax += ((best.s.x - me.x) / (best.d || 1)) * 0.9;
      ay += ((best.s.y - me.y) / (best.d || 1)) * 0.9;
    }
    // keep to the middle of the field: a hero in a corner is a dead hero
    const cx = (v.map.w ?? 0) * 0.5;
    const cy = (v.map.h ?? 0) * 0.5;
    if (cx && cy) {
      ax += ((cx - me.x) / cx) * 0.35;
      ay += ((cy - me.y) / cy) * 0.35;
    }
    if (Math.hypot(ax, ay) < 0.15) {
      ax = Math.cos(v.t * 0.7);
      ay = Math.sin(v.t * 0.7);
    }
    walk(ax, ay, dt, false);
    if (close >= 6 && P.pressT <= 0) {
      P.press('Space');
      P.pressT = 1.2;
    }
    P.pressT -= dt;
  };
  /** In the Ring the hero is played by the game's own arena mind, the one every computer fighter uses. */
  const ringThink = (dt) => {
    const g = window.__ring;
    if (!g?.m || g.m.phase === 'over') return P.hold([]);
    const me = g.m.fighters.find((f) => f.id === P.mode.me) ?? g.m.fighters[0];
    P.brain = P.brain?.for === g.m ? P.brain : { for: g.m, b: g.brains[me.id] };
    const mv = g.botThink(g.m, me, P.brain.b, P.mode.skill ?? 0.75, dt);
    walk(mv.mx, mv.my, dt, false);
  };

  P.modeStatus = () => {
    const vg = window.__vigil;
    if (vg?.v) return { vigil: true, t: +vg.v.t.toFixed(1), level: vg.v.level, kills: vg.v.kills, foes: vg.v.foes.length, hp: vg.me.hp, cards: !!vg.me.cards, cardT: P.cardT ?? 0, over: vg.v.over };
    const rg = window.__ring;
    if (rg?.m) return { ring: true, phase: rg.m.phase, over: rg.m.phase === 'over', t: +(rg.m.t ?? 0).toFixed?.(1), fighters: rg.m.fighters.map((f) => ({ id: f.id, team: f.team, cls: f.cls, hp: Math.round(f.hp), dead: !!f.dead, me: f.me ?? f.you ?? undefined, name: f.name })) };
    return null;
  };

  /**
   * Modes: { kind: 'idle' } hands off; { kind: 'hands' } the script presses keys itself;
   * { kind: 'fight', keep, only, within, at, bossFirst, slots, beat, strafe, brave, still } fights what is there;
   * { kind: 'walk', to: {x, y}, fight: false | true | distance } walks the map's way to a place.
   */
  P.set = (mode) => {
    P.mode = { ...mode };
    P.think = 0;
    if (mode.kind === 'idle') P.letGo();
  };
  window.__pilot = P;
})();
