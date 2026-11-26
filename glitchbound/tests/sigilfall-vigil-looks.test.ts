/**
 * The Vigil after the owner played it on his phone (2026-11-26): every spell looks like itself, an evolution looks like
 * something else and grander, what flies is small, chests and lights are pointed to, there are more kinds of event, the
 * lobby says one short thing per card, and a long press picks up no text.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { FX, type Fx3D } from '../src/games/sigilfall/render3d/fx3d';
import type { Cast } from '../src/games/sigilfall/render3d/cast';
import { EVOLVED, flyer, LOOKS, lookOf } from '../src/games/sigilfall/render/vigilLooks';
import { DEEDS } from '../src/games/sigilfall/vigil/deeds';
import { ALL_SPELLS, spellsOf } from '../src/games/sigilfall/vigil/kit';
import { EVENT_KINDS, EVENTS, RULES, TRAIT, WISPS, type EventKind } from '../src/games/sigilfall/vigil/night';
import { Vigil, type Foe, type Fx, type Hero, type VigilInput } from '../src/games/sigilfall/vigil/sim';
import { applySnap, SnapWriter } from '../src/games/sigilfall/vigil/snapshot';

const STILL: VigilInput = { mx: 0, my: 0 };
const DT = 1 / 30;

interface Inside {
  bag: EventKind[];
  nextEvent: number;
  spawnT: number;
  hurt(f: Foe, dmg: number, by?: Hero): void;
}
const inside = (v: Vigil): Inside => v as unknown as Inside;

function quiet(seed = 7): Vigil {
  const v = new Vigil(seed, 2000, 2000, { rules: [] });
  v.me.hp = 1e9;
  v.me.spells = {};
  inside(v).spawnT = -1e9;
  inside(v).nextEvent = 1e9;
  return v;
}
function begin(v: Vigil, kind: EventKind): void {
  inside(v).bag = [kind];
  inside(v).nextEvent = 0;
  v.step(DT, STILL);
  inside(v).nextEvent = 1e9;
  expect(v.eventLog[v.eventLog.length - 1]).toBe(kind);
}
function steps(v: Vigil, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    if (v.cards) v.choose(0);
    v.step(DT, STILL);
  }
}

/** An Fx3D and a Cast that only remember what was asked of them. */
function recorder(): { fx: Fx3D; cast: Cast; puts: { kind: number; w: number }[]; models: string[] } {
  const puts: { kind: number; w: number }[] = [];
  const models: string[] = [];
  const fx = { put: (q: { kind: number; w?: number }) => puts.push({ kind: q.kind, w: q.w ?? 0 }) } as unknown as Fx3D;
  const cast = { thrown: (id: string) => models.push(id), creature: (id: string) => models.push(id) } as unknown as Cast;
  return { fx, cast, puts, models };
}

describe('The Vigil: every spell looks like itself', () => {
  it('every spell has a look, and every spell that evolves has another for its evolution', () => {
    for (const s of ALL_SPELLS) {
      expect(LOOKS[s.id], s.id).toBeTruthy();
      expect(!!EVOLVED[s.id], `${s.id} evolves: ${!!s.evolve}`).toBe(!!s.evolve);
    }
    expect(Object.keys(LOOKS).length).toBe(ALL_SPELLS.length);
  });

  it('no two looks share their colors, anywhere: a fire spell of one class is not another class’s fire', () => {
    const all = [...Object.values(LOOKS), ...Object.values(EVOLVED)];
    expect(new Set(all.map((l) => l.a.toLowerCase())).size).toBe(all.length);
    // and within a class, no two spells share their particle and their shape
    for (const cls of CLASS_IDS) {
      const shapes = spellsOf(cls).map((s) => `${LOOKS[s.id]!.motif}/${LOOKS[s.id]!.body}`);
      expect(new Set(shapes).size, `${cls}: ${shapes.join(' ')}`).toBe(shapes.length);
    }
  });

  it('the ranger’s shots are arrows and its blast is a volley, not a mage’s fireball or meteor', () => {
    for (const s of spellsOf('ranger')) expect(['ember', 'comet', 'star'], s.id).not.toContain(LOOKS[s.id]!.body);
    expect(LOOKS['seeking-arrow']!.body).toBe('arrow');
    expect(LOOKS['blast-arrow']!.body).toBe('arrows');
    expect(LOOKS['arrow-storm']!.body).toBe('arrows');
  });

  it('an evolution changes its look whole: other colors, another particle, and grandeur on top', () => {
    for (const [id, evo] of Object.entries(EVOLVED)) {
      const base = LOOKS[id]!;
      expect(evo.a, id).not.toBe(base.a);
      expect(evo.motif, id).not.toBe(base.motif);
      expect(evo.grand, id).toBe(true);
      expect(base.grand, id).toBeFalsy();
      expect(lookOf(id, true)).toBe(evo);
      expect(lookOf(id, false)).toBe(base);
    }
    // (a spell that has no evolution keeps its own look either way)
    expect(lookOf('chain-spark', true)).toBe(LOOKS['chain-spark']);
  });

  it('what flies is drawn about its own hit size: a ball of lightning is no longer twice the hero', () => {
    for (const s of ALL_SPELLS) {
      const r = s.id === 'ball-lightning' ? 7 : 4;
      const { fx, cast, puts } = recorder();
      flyer(fx, cast, lookOf(s.id), 0, 0, 200, 0, r, 0, 1, 3);
      // the body itself (not its trail, nor the soft glow round an evolution)
      const body = puts.filter((p) => p.kind !== FX.trail && p.kind !== FX.glow);
      for (const p of body) expect(p.w, s.id).toBeLessThanOrEqual(r * 2.4 * 1.9);
    }
    // it was r × 8 wide for a lightning shot (render/effects.ts's shot): 56 for Ball Lightning, which is 7 across
    const { fx, cast, puts } = recorder();
    flyer(fx, cast, lookOf('ball-lightning'), 0, 0, 70, 0, 7, 0, 1, 3);
    expect(Math.max(...puts.filter((p) => p.kind !== FX.trail).map((p) => p.w))).toBeLessThan(56 * 0.6);
  });

  it('an arrow flies as an arrow, a thrown axe as an axe, a shield as a shield', () => {
    for (const [id, model] of [
      ['seeking-arrow', 'w_arrow_A'],
      ['thrown-axe', 'w_axe_A'],
      ['thrown-hammer', 'w_hammer_A'],
    ] as const) {
      const { fx, cast, models } = recorder();
      flyer(fx, cast, lookOf(id), 0, 0, 200, 0, 4, 0, 1, 3);
      expect(models, id).toContain(model);
    }
  });

  it('what a spell makes is told which spell it is, and whether it has evolved, and a friend’s game hears it', () => {
    const v = new Vigil(3, 2000, 2000, { cls: 'mage', rules: [] });
    v.me.hp = 1e9;
    inside(v).nextEvent = 1e9;
    v.fxOut = [];
    const seen: Fx[] = [];
    for (let i = 0; i < 30 * 12; i++) {
      v.me.spells = { 'frost-ring': 6 };
      v.me.cards = null;
      v.owed = 0;
      v.step(DT, STILL);
      seen.push(...v.fx.filter((f) => f.kind === 'nova'));
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((f) => f.spell === 'frost-ring' && !f.evo)).toBe(true);
    v.me.evolved.add('frost-ring');
    const later: Fx[] = [];
    for (let i = 0; i < 30 * 8; i++) {
      v.me.cards = null;
      v.owed = 0;
      v.step(DT, STILL);
      later.push(...v.fx.filter((f) => f.kind === 'nova'));
    }
    expect(later.some((f) => f.spell === 'frost-ring' && f.evo)).toBe(true);
    // (and what isn't a spell is no spell's: a level, a pickup)
    expect(v.fx.filter((f) => f.kind === 'level').every((f) => f.spell === undefined)).toBe(true);
    const friend = new Vigil(3, 2000, 2000, { cls: 'mage', rules: [] });
    applySnap(friend, JSON.parse(JSON.stringify(new SnapWriter().write(v, 1))), 0);
    expect(friend.fx.some((f) => f.kind === 'nova' && f.spell === 'frost-ring' && f.evo)).toBe(true);
  });
});

describe('The Vigil: three more kinds of event', () => {
  it('there are ten, each with a deed, and every kind still comes before any comes again', () => {
    expect(EVENT_KINDS.length).toBe(10);
    for (const k of ['gilded', 'wisps', 'hound'] as EventKind[]) {
      expect(EVENTS[k].text.length, k).toBeGreaterThan(15);
      expect(DEEDS.some((d) => d.id === `event:${k}`), k).toBe(true);
    }
    const v = new Vigil(21, 2000, 2000);
    for (let t = 0; t < 11 * 60 && v.eventLog.length < EVENT_KINDS.length; t += 1 / 10) {
      v.me.hp = 1e9;
      if (v.cards) v.choose(0);
      v.step(1 / 10, STILL);
    }
    expect([...v.eventLog].sort()).toEqual([...EVENT_KINDS].sort());
  });

  it('the Gilded Host: a crowd in gold that leaves gold sparks, and a chest once three in four are felled', () => {
    const v = quiet();
    begin(v, 'gilded');
    const gold = v.foes.filter((f) => f.trait === TRAIT.gilded);
    expect(gold.length).toBe(v.event!.n);
    const sparks = v.sparks.length;
    inside(v).hurt(gold[0]!, gold[0]!.hp + 1);
    expect(v.sparks.length).toBe(sparks + 3);
    for (const f of gold.slice(1, Math.ceil(gold.length * 0.75))) inside(v).hurt(f, f.hp + 1);
    steps(v, 17);
    expect(v.event).toBeNull();
    expect(v.pickups.some((p) => p.kind === 'chest')).toBe(true);
    expect(v.foes.some((f) => f.trait === TRAIT.gilded)).toBe(false);
    expect(v.wonLog).toContain('gilded');
    // too few felled: they scatter, and there is nothing
    const w = quiet();
    begin(w, 'gilded');
    steps(w, 17);
    expect(w.pickups.some((p) => p.kind === 'chest')).toBe(false);
    expect(w.wonLog).not.toContain('gilded');
  });

  it('the Lost Lights: touch all of them for a chest and some mending; they go out in the end', () => {
    const v = quiet();
    begin(v, 'wisps');
    const lights = v.pickups.filter((p) => p.kind === 'wisp');
    expect(lights.length).toBe(WISPS);
    v.me.hp = 10;
    const owed = v.me.owed;
    for (const p of lights) {
      v.me.x = p.x;
      v.me.y = p.y;
      v.step(DT, STILL);
    }
    v.step(DT, STILL);
    expect(v.event).toBeNull();
    expect(v.wonLog).toContain('wisps');
    // (its chest falls where the hero stands, so it is theirs at once: a choice)
    expect(v.me.owed + (v.me.cards ? 1 : 0)).toBeGreaterThan(owed);
    expect(v.me.hp).toBeGreaterThan(10);
    const w = quiet();
    begin(w, 'wisps');
    steps(w, EVENTS.wisps.secs + 0.5);
    expect(w.pickups.some((p) => p.kind === 'wisp')).toBe(false);
    expect(w.wonLog).not.toContain('wisps');
  });

  it('the Bloodhound: one fast hunter, a chest if it is felled, gone if not', () => {
    const v = quiet();
    begin(v, 'hound');
    const hound = v.foes.find((f) => f.trait === TRAIT.hound)!;
    expect(hound).toBeTruthy();
    expect(hound.elite).toBe(true);
    expect(hound.speed).toBeGreaterThanOrEqual(84);
    inside(v).hurt(hound, hound.hp + 1);
    expect(v.pickups.some((p) => p.kind === 'chest')).toBe(true);
    expect(v.event).toBeNull();
    expect(v.wonLog).toContain('hound');
    const w = quiet();
    begin(w, 'hound');
    w.foes.find((f) => f.trait === TRAIT.hound)!.speed = 0;
    steps(w, EVENTS.hound.secs + 0.5);
    expect(w.foes.some((f) => f.trait === TRAIT.hound)).toBe(false);
    expect(w.wonLog).not.toContain('hound');
  });

  it('a friend’s game sees the lights and the marked hunters', () => {
    const party = [
      { id: 1, cls: 'mage' as const, name: 'A' },
      { id: 2, cls: 'warrior' as const, name: 'B' },
    ];
    const host = new Vigil(8, 2000, 2000, { party, rules: [] });
    for (const h of host.heroes) {
      h.hp = 1e9;
      h.spells = {};
    }
    inside(host).spawnT = -1e9;
    begin(host, 'wisps');
    const friend = new Vigil(8, 2000, 2000, { party, rules: [] });
    applySnap(friend, JSON.parse(JSON.stringify(new SnapWriter().write(host, 1))), 2);
    expect(friend.pickups.filter((p) => p.kind === 'wisp').length).toBe(WISPS);
    expect(friend.event?.kind).toBe('wisps');
    host.event = null;
    begin(host, 'hound');
    applySnap(friend, JSON.parse(JSON.stringify(new SnapWriter().write(host, 1))), 2);
    expect(friend.foes.some((f) => f.trait === TRAIT.hound)).toBe(true);
  });
});

describe('The Vigil on a phone: less to read, nothing to pick up', () => {
  it('every land’s rule is one short sentence', () => {
    for (const r of Object.values(RULES)) {
      expect(r.text.length, r.id).toBeLessThanOrEqual(62);
      expect(r.text.replace(/\.$/, ''), r.id).not.toMatch(/\. /);
    }
  });

  it('the lobby no longer shows a land’s tagline beside its rule, nor a spell’s evolution in full', () => {
    const lobby = readFileSync('src/games/sigilfall/ui/VigilLobby.tsx', 'utf8');
    expect(lobby).not.toContain('m.blurb');
    expect(lobby).not.toContain('shown.evolve.text');
    expect(lobby).not.toContain('Not found yet');
  });

  it('a long press in the Vigil picks up no words, and calls up nothing of the browser’s', () => {
    const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
    const at = css.indexOf('.rb-vigil,\n.rb-vlobby,\n.rb-vend,\n.rb-vfire {');
    expect(at).toBeGreaterThan(0);
    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toContain('-webkit-touch-callout: none');
    expect(rule).toContain('user-select: none');
  });
});

describe('The Vigil on a phone: a held thumb picks up nothing', () => {
  it('a selection that would begin in the Vigil is stopped, one that forms is dropped, and the press menu stays shut', async () => {
    const { stopSelecting } = await import('../src/games/sigilfall/ui/noSelect');
    document.body.innerHTML = '<div class="rb-vigil"><span id="clock">0:31</span><input id="field" value="ok"></div><p id="outside">elsewhere</p>';
    const stop = stopSelecting(document);
    const fire = (id: string, type: string): boolean => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      document.getElementById(id)!.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(fire('clock', 'selectstart')).toBe(true);
    expect(fire('clock', 'contextmenu')).toBe(true);
    // what is typed into, and what is outside the Vigil, are left alone
    expect(fire('field', 'selectstart')).toBe(false);
    expect(fire('outside', 'selectstart')).toBe(false);
    const sel = document.getSelection()!;
    const r = document.createRange();
    r.selectNodeContents(document.getElementById('clock')!);
    sel.removeAllRanges();
    sel.addRange(r);
    document.dispatchEvent(new Event('selectionchange'));
    expect(document.getSelection()!.toString()).toBe('');
    stop();
    expect(fire('clock', 'selectstart')).toBe(false);
    document.body.innerHTML = '';
  });
});
