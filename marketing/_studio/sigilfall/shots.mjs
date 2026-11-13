// Every shot the trailers are cut from. A shot sets a stage (a hero the pilot builds, at a story beat or in a
// land), lets some game time pass unfilmed if it needs to, then films while the pilot plays with the keyboard
// and mouse. Nothing here writes to the world while the camera runs.

/** The cast: one hero per calling, the same face in every trailer. */
export const CAST = {
  warrior: { cls: 'warrior', name: 'Aldric', body: 'm' },
  mage: { cls: 'mage', name: 'Seren', body: 'f' },
  ranger: { cls: 'ranger', name: 'Kestrel', body: 'f' },
  paladin: { cls: 'paladin', name: 'Tobias', body: 'm' },
  priest: { cls: 'priest', name: 'Liora', body: 'f' },
  warlock: { cls: 'warlock', name: 'Morrow', body: 'm' },
  druid: { cls: 'druid', name: 'Rowan', body: 'f' },
};
const hero = (cls, more) => ({ ...CAST[cls], ...more });

/** Settings › Camera distance, at its nearest. */
const NEAR = 0.8;

/** A fight: the hero stands `back` south of a boss's den (or where the land puts them), then the pilot fights. */
const fight = (about, h, { boss, back = 150, side = 0, mode = {}, pre = 0, secs = 30, clean = false, until } = {}) => ({
  about,
  async run(g) {
    // (the camera at its nearest, a setting of the game's own, where the HUD is stepped aside for the picture)
    await g.hero(clean ? { zoom: NEAR, ...h } : h);
    if (clean) await g.clean();
    if (boss) await g.nearBoss(boss, back, side);
    if (pre) await g.skip(pre);
    const rec = await g.film();
    await g.mode({ kind: 'fight', bossFirst: !!boss, ...mode });
    await rec.run(secs, until);
  },
});

/** A walk through a land toward a place, fighting what comes close. */
const walk = (about, h, { to = 'far', from, pre = 6, secs = 16, clean = true, fights = 110, mode = {} } = {}) => ({
  about,
  async run(g) {
    await g.hero(clean ? { zoom: NEAR, ...h } : h);
    if (clean) await g.clean();
    if (from) await g.stand(from[0], from[1]);
    const dest = typeof to === 'string' ? await g.find(to) : { x: to[0], y: to[1] };
    console.log('  walking to', to, dest);
    await g.mode({ kind: 'walk', to: dest, fight: fights });
    if (pre) await g.skip(pre);
    const rec = await g.film();
    await g.mode({ kind: 'walk', to: dest, fight: fights, ...mode });
    await rec.run(secs);
  },
});

/**
 * A story scene: the hero walks to where it plays and the camera runs through it. `which` names the scene
 * (other scenes on the way play out unfilmed); `lines` lets the pilot take each line after reading it.
 */
const scene = (about, h, { which, to, secs = 45, tail = 1.5, then } = {}) => ({
  about,
  async run(g) {
    await g.hero(h);
    const spot = to ? await g.find(to) : which ? await g.ev((id) => window.__pilot.sceneSpot(id), which) : null;
    console.log('  scene', which, 'plays near', spot);
    if (spot?.x) await g.mode({ kind: 'walk', to: { x: spot.x, y: spot.y }, fight: false, near: 30 });
    const st = await g.skipUntil((s) => !!s.scene && (!which || String(s.scene).includes(which)), 90);
    console.log('  playing', st?.scene ?? 'never came');
    if (!st) return;
    const rec = await g.film();
    await rec.run(secs, (s) => !s.scene && rec.seconds > 3);
    rec.mark('scene-over');
    if (then) await g.mode(then);
    await rec.run(tail);
  },
});

/** A boss met for the first time: the game's own reveal, then the fight, the HUD stepped aside but for the boss bar. */
const boss = (about, h, id, more = {}) => fight(about, { ...h, fresh: true }, { boss: id, back: 210, secs: 34, clean: true, ...more });

/** A calling at work in a land of its own. */
const calling = (cls, level, region, more = {}) => walk(`${cls} in ${region}`, hero(cls, { level, region, rarity: level >= 50 ? 'epic' : 'rare' }), { secs: 24, fights: 170, clean: true, mode: { all: true, strafe: true, beat: 0.5 }, ...more });

/** Reads a talk with someone to its end: each page for a moment, then its button. */
async function readTalk(g, rec, { read = 2.2, max = 8 } = {}) {
  for (let i = 0; i < max; i++) {
    const st = await rec.run(read);
    if (!st.dialogue) break;
    const btn = g.page.locator('.rb-dialogue-actions button').last();
    if (!(await btn.count())) break;
    await g.point(btn, { frames: i ? 14 : 30, hold: 10 });
  }
}

/** A smaller window on a sharper screen: the menus fill more of the picture, and are filmed at twice the detail. */
const CLOSE = { width: 1280, height: 720, dsf: 1.5 };
/** The arena and the Vigil are seen from far off: filmed at one and a half times the detail, so the edit can come closer. */
const FINE = { width: 1920, height: 1080, dsf: 1.5 };

const withView = (view, shot) => ({ ...shot, view });

export const SHOTS = {
  /* ------------------------------------------------------------ the story */
  vision: withView(FINE, scene('The first vision: a star falls on the border of two kingdoms', hero('warrior', { level: 6, rarity: 'uncommon', preset: 'v3-embers', fresh: true }), { which: 'vision-embers', secs: 34 })),
  night: {
    about: 'Prologue: Briarhollow by night, the houses burning, Mara at the gate, then the raid',
    async run(g) {
      await g.hero(hero('warrior', { level: 3, rarity: 'common', preset: 'prologue-raid', fresh: true, zoom: NEAR }));
      await g.clean();
      const rec = await g.film();
      await rec.run(30, (s) => !s.scene && rec.seconds > 3);
      rec.mark('scene-over');
      await g.mode({ kind: 'fight' });
      await rec.run(34);
    },
  },
  hearth: fight('Act I: Hearthstead burns, the riders in the square', hero('warrior', { level: 18, rarity: 'uncommon', preset: 'hearthstead', fresh: true }), { secs: 30, clean: true, mode: { within: 330 } }),
  king: scene('The Hallow King on his throne (the scene before the last fight)', hero('warrior', { level: 60, rarity: 'epic', preset: 'v3-dusk-the-king', fresh: true }), { which: 'dusk-the-king', secs: 40, then: { kind: 'fight', bossFirst: true } , tail: 14 }),
  elyra: scene('Elyra out of the dark', hero('warrior', { level: 48, rarity: 'rare', preset: 'elyra-free', fresh: true }), { which: 'gloam-elyra-free', secs: 40 }),
  herald: fight('The Pale Herald at the Tear', hero('warrior', { level: 40, rarity: 'rare', preset: 'the-tear', fresh: true }), { secs: 40, clean: true }),

  /* ------------------------------------------------------------ the world */
  'walk-whisper': walk('Whisperwood, a young hero on the forest road', hero('warrior', { level: 4, rarity: 'common', region: 'whisperwood' }), { secs: 18 }),
  'walk-glimmer': walk('The Glimmerwood', hero('warrior', { level: 36, region: 'glimmerwood' }), { secs: 15 }),
  'walk-sun': walk('The Sunscorch Expanse', hero('warrior', { level: 33, region: 'sunscorch' }), { secs: 15 }),
  'walk-vale': walk('The Shattered Vale', hero('warrior', { level: 40, region: 'shattered-vale' }), { secs: 15 }),
  'walk-ember': walk('Emberdeep Caldera', hero('warrior', { level: 53, rarity: 'epic', region: 'emberdeep' }), { secs: 15 }),
  'walk-town': walk('Hearthstead by day', hero('warrior', { level: 16, rarity: 'uncommon', region: 'amberfield' }), { secs: 16, pre: 5, fights: false }),
  'walk-city': walk('Emberwick, the crown city', hero('warrior', { level: 28, region: 'emberwick' }), { secs: 18, pre: 5, fights: false }),
  'walk-hall': walk('The Great Hall', hero('warrior', { level: 28, region: 'great-hall' }), { secs: 12, pre: 4, fights: false, to: 'far' }),

  /* ------------------------------------------------------------ the hero grows */
  hall: {
    about: 'The hall of heroes: the same hero at level 1 and at level 60',
    async run(g) {
      for (const [name, h] of [['hall-1', hero('warrior', { level: 1 })], ['hall-60', hero('warrior', { level: 60, rarity: 'epic' })], ['hall-mage', hero('mage', { level: 60, rarity: 'epic' })]]) {
        await g.ev(() => window.__pilot.ready());
        await g.ev((h) => { window.__clock.release(); window.__pilot.hero(h); window.__rb.toTitle(); }, h);
        await g.sleep(3500);
        await g.ev(() => window.__clock.hold());
        const rec = await g.film(name);
        await rec.run(5);
        await rec.stop();
      }
    },
  },
  equip: {
    about: 'New gear from the bag: the hero changes as it goes on',
    view: CLOSE,
    async run(g) {
      await g.hero(hero('warrior', { level: 30, rarity: 'common', region: 'amberfield', bag: [{ slot: 'chest', rarity: 'epic', level: 36 }, { slot: 'head', rarity: 'epic', level: 36 }, { slot: 'weapon', rarity: 'epic', level: 36 }, { slot: 'offhand', rarity: 'epic', level: 36 }, { slot: 'legs', rarity: 'epic', level: 36 }] }));
      await g.skip(6);
      const rec = await g.film();
      await g.mode({ kind: 'idle' });
      await rec.run(1.6);
      await g.page.keyboard.press('i');
      rec.mark('panel');
      await rec.run(1.2);
      for (let i = 0; i < 5; i++) {
        // (what was worn goes into the bag in front of the rest: the next new piece is one place further on)
        const slot = g.page.locator('.rb-bag-grid .rb-bslot').nth(i);
        if (!(await slot.count())) break;
        await g.point(slot, { frames: i ? 20 : 34, hold: 30 });
        rec.mark('picked');
        await g.point(g.page.getByRole('button', { name: 'Equip', exact: true }), { frames: 22, hold: 34 });
        rec.mark('worn');
      }
      await rec.run(0.8);
      await g.ev(() => window.__pilot.cursor(null));
      await g.page.keyboard.press('Escape');
      rec.mark('closed');
      await rec.run(3);
    },
  },
  talents: {
    about: 'Talents: points spent on the hero’s path',
    view: CLOSE,
    async run(g) {
      await g.hero(hero('mage', { level: 22, region: 'rimeheld', spend: 4 }));
      await g.skip(6);
      const rec = await g.film();
      await rec.run(1);
      await g.page.keyboard.press('k');
      rec.mark('panel');
      await rec.run(1.4);
      for (let i = 0; i < 3; i++) {
        const node = g.page.locator('.rb-node.is-ready:not(.is-full)').last();
        if (!(await node.count())) break;
        await g.point(node, { frames: i ? 20 : 34, hold: 26 });
        const learn = g.page.locator('.rb-talent-pop .rb-btn.is-gold, .rb-talent-detail .rb-btn.is-gold').first();
        if (await learn.count()) await g.point(learn, { frames: 18, hold: 30 });
        rec.mark('learned');
        const shut = g.page.locator('.rb-talent-pop-wrap');
        if (await shut.count()) { await g.page.mouse.click(40, 1040); await rec.run(0.3); }
      }
      await rec.run(1);
    },
  },

  /* ------------------------------------------------------------ the seven callings */
  'cls-warrior': calling('warrior', 20, 'amberfield'),
  'cls-mage': calling('mage', 38, 'rimeheld'),
  'cls-ranger': calling('ranger', 36, 'glimmerwood'),
  'cls-paladin': calling('paladin', 34, 'sunscorch'),
  'cls-priest': calling('priest', 27, 'ashen-barrows'),
  'cls-warlock': calling('warlock', 40, 'shattered-vale'),
  'cls-druid': calling('druid', 53, 'emberdeep'),

  /* ------------------------------------------------------------ bosses */
  ossric: boss('Warden Ossric in the Chapel Crypt', hero('warrior', { level: 6, rarity: 'uncommon', region: 'crypt' }), 'ossric'),
  hrodric: boss('King Hrodric in the Barrow of Kings', hero('warrior', { level: 30, region: 'barrow-of-kings' }), 'king-hrodric'),
  colossus: boss('The Slag Colossus in the Deepforge Halls', hero('warrior', { level: 27, region: 'deepforge-halls' }), 'slag-colossus'),
  sunking: boss('The Sun King in his tomb', hero('mage', { level: 36, region: 'tomb-of-the-sun-king' }), 'the-sun-king', { mode: { strafe: true } }),
  wyrm: boss('The Rime Wyrm in the Rimeheld Vault', hero('ranger', { level: 40, region: 'rimeheld-vault' }), 'the-rime-wyrm', { mode: { strafe: true } }),
  ashkar: boss('Ashkar the Bound on the Molten Throne', hero('warrior', { level: 54, rarity: 'epic', region: 'molten-throne' }), 'ashkar-the-bound', { secs: 44 }),

  /* ------------------------------------------------------------ playing it (the gameplay trailer: the HUD as it is) */
  begin: {
    about: 'A new player: the hall, a hero made, the first steps in Briarhollow',
    view: CLOSE,
    async run(g) {
      await g.ev(() => window.__pilot.ready());
      await g.sleep(2500);
      await g.ev(() => window.__clock.hold());
      const rec = await g.film();
      await rec.run(1.6);
      await g.point(g.page.getByRole('button', { name: /Create your hero/ }), { hold: 50 });
      rec.mark('create');
      await rec.run(0.8);
      await g.point(g.page.getByRole('radio', { name: /Ranger/ }), { frames: 26, hold: 40 });
      await g.point(g.page.getByRole('radio', { name: /Mage/ }), { frames: 22, hold: 46 });
      rec.mark('class');
      await g.point(g.page.getByRole('radio', { name: 'Female' }), { frames: 24, hold: 26 }).catch(() => {});
      await g.point(g.page.getByRole('radio', { name: 'Hair color 6' }), { frames: 22, hold: 26 }).catch(() => {});
      await g.point(g.page.getByRole('radio', { name: /Long/ }), { frames: 16, hold: 26 }).catch(() => {});
      const name = g.page.locator('.rb-create input');
      await g.point(name, { frames: 22, hold: 8 });
      await g.page.keyboard.press('Meta+a');
      for (const ch of 'Seren') {
        await g.page.keyboard.type(ch);
        await rec.run(0.11);
      }
      await rec.run(0.5);
      await g.point(g.page.locator('.rb-create button[type=submit]'), { frames: 24, hold: 20 });
      const ask = g.page.locator('.rb-tip-ask .rb-btn').first();
      if (await ask.count()) await g.point(ask, { frames: 26, hold: 12 });
      rec.mark('begin');
      await g.ev(() => window.__pilot.cursor(null));
      // (the land loads in real time, not game time: nothing is filmed until it is there)
      await g.settle();
      rec.mark('world');
      await rec.run(5);
      await readTalk(g, rec);
      await g.ev(() => window.__pilot.cursor(null));
      // the first-timer hints: one is read, then they are turned off (the choice the card itself offers)
      await rec.run(2.5);
      const off = g.page.locator('.rb-tip-card button', { hasText: /Turn off/ }).first();
      if (await off.count()) {
        rec.mark('tip');
        await rec.run(1.5);
        await g.point(off, { frames: 26, hold: 16 });
      }
      await g.ev(() => window.__pilot.cursor(null));
      rec.mark('fight');
      await g.mode({ kind: 'fight', strafe: true, beat: 0.7 });
      await rec.run(30);
    },
  },
  'first-fights': walk('The first fights in Whisperwood, a level away from the next', hero('mage', { level: 3, rarity: 'common', region: 'whisperwood', nearLevel: 0.8 }), { secs: 42, pre: 0, clean: false, fights: 170, mode: { strafe: true, beat: 0.6 } }),
  'crypt-run': {
    about: 'A dungeon from its door: the Chapel Crypt’s halls, then Warden Ossric',
    async run(g) {
      await g.hero(hero('mage', { level: 6, rarity: 'uncommon', region: 'crypt', fresh: true }));
      const den = await g.find('ossric');
      const rec = await g.film();
      await g.mode({ kind: 'walk', to: den, fight: 190, strafe: true, beat: 0.6 });
      await rec.run(60, (s) => !!s.boss);
      rec.mark('boss');
      await g.mode({ kind: 'fight', bossFirst: true, strafe: true, beat: 0.6 });
      await rec.run(36, (s) => s.dead || s.cleared);
      await rec.run(3);
    },
  },
  rift: {
    about: 'A Riftstone run: a dungeon against the clock',
    async run(g) {
      await g.hero(hero('ranger', { level: 60, rarity: 'epic', region: 'deepforge-halls', key: 3 }));
      console.log(JSON.stringify(await g.status()));
      const far = await g.find('far');
      const rec = await g.film();
      await g.mode({ kind: 'walk', to: far, fight: 200, strafe: true, all: true });
      await rec.run(40);
    },
  },

  /* ------------------------------------------------------------ modes */
  vigil: {
    about: 'The Vigil: a night two minutes in',
    view: FINE,
    async run(g) {
      await g.ev(() => window.__pilot.ready());
      await g.ev(() => { window.__pilot.hero({ cls: 'mage', name: 'Seren', body: 'f', level: 30, region: 'briarhollow' }); window.__rb.toTitle(); });
      await g.sleep(2500);
      await g.click(g.page.getByRole('button', { name: /The Vigil/ }));
      await g.sleep(2500);
      await g.click(g.page.getByText('Mage', { exact: true })).catch((e) => console.log('  no mage row', e.message));
      await g.sleep(800);
      await g.still('vigil-lobby');
      await g.click(g.page.getByRole('button', { name: /Keep the watch/ }));
      await g.page.waitForFunction(() => !!window.__vigil?.v, null, { timeout: 30000 });
      await g.sleep(1500);
      await g.ev(() => { window.__clock.hold(); window.__pilot.set({ kind: 'vigil' }); });
      // the night's first two minutes pass unfilmed: the horde is what the Vigil is
      const st = await g.skip(shotSeconds('vigil-skip', 110));
      console.log(JSON.stringify(st));
      const rec = await g.film();
      await rec.run(shotSeconds('vigil', 60), (s) => !!s.over);
    },
  },
  ring: {
    about: 'The Ring: a three-a-side arena match',
    view: FINE,
    async run(g) {
      await g.ev(() => window.__pilot.ready());
      await g.ev(() => { window.__pilot.hero({ cls: 'warrior', name: 'Aldric', level: 60, rarity: 'epic', region: 'briarhollow' }); window.__rb.toTitle(); });
      await g.sleep(2500);
      await g.click(g.page.getByRole('button', { name: /The Ring/ }));
      await g.sleep(3000);
      await g.still('ring-lobby');
      await g.click(g.page.getByRole('radio', { name: /3/ }).first()).catch(() => {});
      await g.sleep(500);
      await g.click(g.page.locator('button.rb-btn.is-gold.is-big').first());
      await g.page.waitForFunction(() => !!window.__ring?.m, null, { timeout: 60000 });
      await g.sleep(800);
      console.log(JSON.stringify(await g.ev(() => window.__pilot.modeStatus())));
      await g.ev(() => { window.__clock.hold(); window.__pilot.set({ kind: 'ring' }); });
      // (the gates' quarter minute of waiting is not filmed, but for its last count)
      await g.skipUntil((s) => s.phase !== 'gates' && s.phase !== 'prep', 30);
      const rec = await g.film();
      await rec.run(shotSeconds('ring', 45), (s) => s.phase === 'over' && (rec.mark('over'), true));
      await rec.run(4);
    },
  },
};

/** A shot's length can be cut short for a trial run: SHOT_SECONDS=12 node capture.mjs vigil */
function shotSeconds(id, dflt) {
  return Number(process.env[`SECONDS_${id.replace('-', '_').toUpperCase()}`]) || dflt;
}
