import { ALL_SPELLS, smallOf, SPELLS, type StrengthId } from './kit';
import { EVENT_KINDS, type BoonId } from './night';
import { ZONE_KINDS, type Card, type Foe, type Fx, type Hero, type Pet, type Pickup, type PickupKind, type SpellStats, type Vigil } from './sim';

/**
 * How a party's night travels: the host's game runs it and sends how it stands a few times a second, in flat lists of
 * whole numbers to keep the messages small; everyone else's game draws that and fills in between (Vigil.follow). What
 * a hero holds only goes along when it changes, and every so often in case someone reconnected.
 */

const SPELL_AT = new Map(ALL_SPELLS.map((s, i) => [s.id, i]));
const PICKUPS: PickupKind[] = ['meat', 'magnet', 'bomb', 'frenzy', 'chest'];

interface HeroBuild {
  sp: Record<string, number>;
  tk: Record<string, string[]>;
  ev: string[];
  st: Partial<Record<StrengthId, number>>;
  /** What they carry from the nights before: boons, and a wild spell. */
  bn: Partial<Record<BoonId, number>>;
  wd: string | null;
}

interface HeroSnap {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dx: number;
  dy: number;
  hp: number;
  i: number;
  dn: number;
  rv: number;
  fz: number;
  fT: number;
  dc: number;
  rr: number;
  c: Card[] | null;
  cT: number;
  w: number;
  /** The cold, as a percentage, and whether venom is in them. */
  ch: number;
  vn: number;
  b?: HeroBuild;
}

export interface Snap {
  t: number;
  lv: number;
  xp: number;
  k: number;
  over: number;
  sh: number;
  lf: number;
  bn: string | null;
  /** The small line under the clock. */
  tp: string | null;
  /** The event: kind, time × 10, length × 10, x, y, progress as a percentage, trait, count. */
  ev: number[] | null;
  /** The Wild Run's paths: x, y, angle × 100, time × 10. */
  ln: number[];
  /** A land's patches: kind, x, y, size, time × 10, length × 10. */
  zn: number[];
  /** Champions felled and events won. */
  ft: [number, number];
  h: HeroSnap[];
  /** Foes: id, flags, x, y, health as a percentage, facing. */
  f: number[];
  /** Champions' names and pictures, by id. */
  bs: Record<number, [string, string]>;
  /** Spell shots: owner, spell, x, y, vx, vy, size × 10. */
  s: number[];
  /** The Host's shots: x, y, vx, vy. */
  o: number[];
  /** Fields: owner, spell, x, y, size, life × 10, length × 10. */
  fl: number[];
  /** Sparks: x, y, xp (below zero for one that is fading). */
  sp: number[];
  /** Pickups: kind, x, y. */
  pk: number[];
  /** Slams: x, y, size, time × 10, length × 10, safe middle, angle × 100, line's length, line's width, tone. */
  sl: number[];
  /** Companions: owner, spell, x, y, facing. */
  pe: number[];
  fx: Fx[];
  /** Numbers: x, y, n, big + crit × 2. */
  pp: number[];
  /** Falls: x, y, boss + elite × 2. */
  fa: number[];
}

const FLAG_BOSS = 16;
const FLAG_ELITE = 32;
const FLAG_FROZEN = 64;
const FLAG_STUN = 128;
const FLAG_SLOW = 256;
const FLAG_FLASH = 512;
const FLAG_WINDUP = 1024;
const FLAG_SMALL = 2048;
const FLAG_RALLY = 4096;
/** Three bits of what marks it out (night.ts's TRAIT). */
const TRAIT_AT = 8192;
const FLAG_CAST = 65536;
const SLAM = 10;
const MAX_SPARKS = 80;
const MAX_FX = 40;

const PLAIN_STATS = { l: 1, dmg: 0, every: 0, n: 1, size: 0, grow: 1, pierce: 0, burst: 0, bounce: 0, homing: false, slow: false, freeze: false, stun: 0, crit: 0, knock: 0, leech: 0, trail: false, pull: false, echo: false, last: 0, speed: 0, guard: 0, heal: 0, evo: false } satisfies SpellStats;

/** The host's own record of what each player has been told. */
export class SnapWriter {
  private sent = new Map<number, number>();
  private since = 0;

  /** How the night stands now. `dt` is the time since the last one. */
  write(v: Vigil, dt: number): Snap {
    this.since += dt;
    const resend = this.since > 3;
    if (resend) this.since = 0;
    const f: number[] = [];
    const waves = v.waves;
    const bs: Snap['bs'] = {};
    for (const o of v.foes) {
      const at = waves.indexOf(o.def.base ?? o.def);
      f.push(o.id, (at & 15) | (o.boss ? FLAG_BOSS : 0) | (o.elite ? FLAG_ELITE : 0) | (o.frozen > 0 ? FLAG_FROZEN : 0) | (o.stun > 0 ? FLAG_STUN : 0) | (o.slow > 0 ? FLAG_SLOW : 0) | (o.flash > 0 ? FLAG_FLASH : 0) | (o.mode === 1 ? FLAG_WINDUP : 0) | (o.def.base ? FLAG_SMALL : 0) | (o.rally > 0 ? FLAG_RALLY : 0) | (o.trait & 7) * TRAIT_AT | (o.mode === 4 ? FLAG_CAST : 0), Math.round(o.x), Math.round(o.y), Math.max(0, Math.round((o.hp / o.maxHp) * 100)), Math.round((o.mode === 1 ? Math.atan2(o.aimY, o.aimX) : o.face) * 10));
      if (o.boss) bs[o.id] = [o.boss, o.bossSprite ?? o.def.sprite];
    }
    const s: number[] = [];
    for (const o of v.shots) s.push(o.owner, SPELL_AT.get(o.spell) ?? 0, Math.round(o.x), Math.round(o.y), Math.round(o.vx), Math.round(o.vy), Math.round(o.r * 10));
    const os: number[] = [];
    for (const o of v.foeShots) os.push(Math.round(o.x), Math.round(o.y), Math.round(o.vx), Math.round(o.vy));
    const fl: number[] = [];
    for (const o of v.fields) fl.push(o.owner, SPELL_AT.get(o.spell) ?? 0, Math.round(o.x), Math.round(o.y), Math.round(o.r), Math.round(o.life * 10), Math.round(o.max * 10));
    const sp: number[] = [];
    // the newest: those are the ones still lying around near the fight
    for (let i = Math.max(0, v.sparks.length - MAX_SPARKS); i < v.sparks.length; i++) {
      const o = v.sparks[i]!;
      sp.push(Math.round(o.x), Math.round(o.y), (o.age ?? 0) > 6 ? -o.xp : o.xp);
    }
    const pk: number[] = [];
    for (const o of v.pickups) pk.push(PICKUPS.indexOf(o.kind), Math.round(o.x), Math.round(o.y));
    const sl: number[] = [];
    for (const o of v.slams) sl.push(Math.round(o.x), Math.round(o.y), Math.round(o.r), Math.round(o.t * 10), Math.round(o.dur * 10), Math.round(o.inner ?? 0), Math.round((o.a ?? 0) * 100), Math.round(o.len ?? 0), Math.round(o.w ?? 0), o.tone ?? 0);
    const ln: number[] = [];
    for (const o of v.lanes) ln.push(Math.round(o.x), Math.round(o.y), Math.round(o.a * 100), Math.round(o.t * 10));
    const zn: number[] = [];
    for (const o of v.zones) zn.push(ZONE_KINDS.indexOf(o.kind), Math.round(o.x), Math.round(o.y), Math.round(o.r), Math.round(o.t * 10), Math.round(o.dur * 10));
    const e = v.event;
    const pe: number[] = [];
    for (const o of v.pets) pe.push(o.owner, SPELL_AT.get(o.spell) ?? 0, Math.round(o.x), Math.round(o.y), Math.round(o.face * 10));
    const pp: number[] = [];
    for (const o of v.pops.slice(-16)) pp.push(Math.round(o.x), Math.round(o.y), o.n, (o.big ? 1 : 0) + (o.crit ? 2 : 0));
    const fa: number[] = [];
    for (const o of v.falls.slice(-16)) fa.push(Math.round(o.x), Math.round(o.y), (o.boss ? 1 : 0) + (o.elite ? 2 : 0));
    // (the little hits are too many to be worth sending)
    const fx = (v.fxOut ?? []).filter((e) => e.kind !== 'hit').slice(-MAX_FX);
    if (v.fxOut) v.fxOut.length = 0;
    return {
      t: Math.round(v.t * 10) / 10,
      lv: v.level,
      xp: Math.round(v.xp),
      k: v.kills,
      over: v.over ? 1 : 0,
      sh: Math.round(v.shake),
      lf: Math.round(v.levelFlash * 10) / 10,
      bn: v.banner?.text ?? null,
      tp: v.tip?.text ?? null,
      ev: e ? [EVENT_KINDS.indexOf(e.kind), Math.round(e.t * 10), Math.round(e.dur * 10), Math.round(e.x), Math.round(e.y), Math.round(e.prog * 100), e.trait, e.n] : null,
      ln,
      zn,
      ft: [v.feats.champions, v.feats.events],
      h: v.heroes.map((h) => {
        const snap: HeroSnap = { id: h.id, x: Math.round(h.x), y: Math.round(h.y), vx: Math.round(h.vx), vy: Math.round(h.vy), dx: Math.round(h.dirX * 10) / 10, dy: Math.round(h.dirY * 10) / 10, hp: Math.round(h.hp), i: h.iframe > 0 ? 1 : 0, dn: h.down ? 1 : 0, rv: Math.round(h.reviveT * 10) / 10, fz: Math.round(h.frenzy * 100) / 100, fT: Math.round(h.frenzyT * 10) / 10, dc: Math.round(h.dashCd * 10) / 10, rr: h.rerolls, c: h.cards, cT: Math.round(h.cardT), w: h.struck > 0.9 ? 1 : 0, ch: Math.round(h.chill * 100), vn: h.venom > 0 ? 1 : 0 };
        if (resend || this.sent.get(h.id) !== h.rev) {
          this.sent.set(h.id, h.rev);
          snap.b = { sp: h.spells, tk: h.took, ev: [...h.evolved], st: h.strengths, bn: h.boons, wd: h.wild };
        }
        return snap;
      }),
      f,
      bs,
      s,
      o: os,
      fl,
      sp,
      pk,
      sl,
      pe,
      fx,
      pp,
      fa,
    };
  }
}

const spellAt = (i: number): string => ALL_SPELLS[i]?.id ?? ALL_SPELLS[0]!.id;

/** Brings a follower's copy of the night up to what the host says. */
export function applySnap(v: Vigil, n: Snap, meId: number): void {
  v.t = n.t;
  v.level = n.lv;
  v.xp = n.xp;
  v.kills = n.k;
  v.over = !!n.over;
  v.shake = Math.max(v.shake, n.sh);
  v.levelFlash = Math.max(v.levelFlash, n.lf);
  v.banner = n.bn ? { text: n.bn, t: 1 } : null;
  v.tip = n.tp ? { text: n.tp, t: 1 } : null;
  const kind = n.ev ? EVENT_KINDS[n.ev[0]!] : undefined;
  v.event = n.ev && kind ? { kind, t: n.ev[1]! / 10, dur: n.ev[2]! / 10, x: n.ev[3]!, y: n.ev[4]!, prog: n.ev[5]! / 100, trait: n.ev[6]!, n: n.ev[7]! } : null;
  v.lanes = [];
  for (let i = 0; i + 3 < n.ln.length; i += 4) v.lanes.push({ x: n.ln[i]!, y: n.ln[i + 1]!, a: n.ln[i + 2]! / 100, t: n.ln[i + 3]! / 10, hit: new Set() });
  v.zones = [];
  for (let i = 0; i + 5 < n.zn.length; i += 6) v.zones.push({ kind: ZONE_KINDS[n.zn[i]!] ?? 'glade', x: n.zn[i + 1]!, y: n.zn[i + 2]!, r: n.zn[i + 3]!, t: n.zn[i + 4]! / 10, dur: n.zn[i + 5]! / 10 });
  v.feats = { champions: n.ft[0], events: n.ft[1] };
  for (const s of n.h) {
    const h = v.heroOf(s.id);
    if (h) applyHero(h, s, s.id === meId);
  }
  const was = new Map<number, Foe>();
  for (const o of v.foes) was.set(o.id, o);
  const foes: Foe[] = [];
  for (let i = 0; i + 5 < n.f.length; i += 6) {
    const id = n.f[i]!;
    const flags = n.f[i + 1]!;
    const x = n.f[i + 2]!;
    const y = n.f[i + 3]!;
    const wave = v.waves[flags & 15] ?? v.waves[0]!;
    const def = flags & FLAG_SMALL ? smallOf(wave) : wave;
    const boss = n.bs[id];
    const elite = !!(flags & FLAG_ELITE);
    const scale = boss ? 2 : elite ? 1.35 : 1;
    const o: Foe = was.get(id) ?? { id, def, x, y, hp: 100, maxHp: 100, dmg: 0, speed: 0, r: def.r * scale, xp: 0, face: 0, walk: id % 7, flash: 0, slow: 0, frozen: 0, stun: 0, immune: 0, kx: 0, ky: 0, tx: x, ty: y, mode: 0, modeT: 0, aimX: 0, aimY: 0, fireT: 0, elite, boss: boss?.[0] ?? null, bossSprite: boss?.[1] ?? null, trait: Math.floor(flags / TRAIT_AT) & 7, pack: false, rally: 0, cast: 0, shed: 0, dead: false };
    o.tx = x;
    o.ty = y;
    o.hp = n.f[i + 4]!;
    o.face = n.f[i + 5]! / 10;
    o.frozen = flags & FLAG_FROZEN ? 1 : 0;
    o.stun = flags & FLAG_STUN ? 1 : 0;
    o.slow = flags & FLAG_SLOW ? 1 : 0;
    if (flags & FLAG_FLASH) o.flash = 0.08;
    o.rally = flags & FLAG_RALLY ? 1 : 0;
    if (flags & FLAG_WINDUP) {
      if (o.mode !== 1) o.modeT = boss ? 0.9 : 0.7;
      o.mode = 1;
      o.aimX = Math.cos(o.face);
      o.aimY = Math.sin(o.face);
    } else o.mode = flags & FLAG_CAST ? 4 : 0;
    foes.push(o);
  }
  v.foes = foes;
  v.shots = [];
  for (let i = 0; i + 6 < n.s.length; i += 7) {
    const spell = spellAt(n.s[i + 1]!);
    const def = SPELLS[spell]!;
    v.shots.push({ owner: n.s[i]!, spell, el: def.el, x: n.s[i + 2]!, y: n.s[i + 3]!, vx: n.s[i + 4]!, vy: n.s[i + 5]!, r: n.s[i + 6]! / 10, dmg: 0, life: 1, pierce: 0, bounce: 0, color: def.color, back: def.kind === 'boomerang', spin: v.t * 16, st: PLAIN_STATS, hit: new Set(), dead: false });
  }
  v.foeShots = [];
  for (let i = 0; i + 3 < n.o.length; i += 4) v.foeShots.push({ x: n.o[i]!, y: n.o[i + 1]!, vx: n.o[i + 2]!, vy: n.o[i + 3]!, r: 3.5, dmg: 0, life: 1, dead: false });
  v.fields = [];
  for (let i = 0; i + 6 < n.fl.length; i += 7) {
    const spell = spellAt(n.fl[i + 1]!);
    const def = SPELLS[spell]!;
    v.fields.push({ owner: n.fl[i]!, spell, el: def.el, x: n.fl[i + 2]!, y: n.fl[i + 3]!, r: n.fl[i + 4]!, dps: 0, life: n.fl[i + 5]! / 10, max: n.fl[i + 6]! / 10, color: def.color, st: PLAIN_STATS });
  }
  v.sparks = [];
  for (let i = 0; i + 2 < n.sp.length; i += 3) v.sparks.push({ x: n.sp[i]!, y: n.sp[i + 1]!, xp: Math.abs(n.sp[i + 2]!), age: n.sp[i + 2]! < 0 ? 7 : 0, pulled: false, dead: false });
  v.pickups = [];
  for (let i = 0; i + 2 < n.pk.length; i += 3) v.pickups.push({ kind: PICKUPS[n.pk[i]!] ?? 'meat', x: n.pk[i + 1]!, y: n.pk[i + 2]!, t: 0, dead: false } satisfies Pickup);
  v.slams = [];
  for (let i = 0; i + SLAM - 1 < n.sl.length; i += SLAM) v.slams.push({ x: n.sl[i]!, y: n.sl[i + 1]!, r: n.sl[i + 2]!, dmg: 0, t: n.sl[i + 3]! / 10, dur: n.sl[i + 4]! / 10, inner: n.sl[i + 5]!, a: n.sl[i + 6]! / 100, len: n.sl[i + 7]!, w: n.sl[i + 8]!, tone: (n.sl[i + 9]! as 0 | 1 | 2) || 0 });
  const pets: Pet[] = [];
  const old = v.pets;
  for (let i = 0, at = 0; i + 4 < n.pe.length; i += 5, at++) {
    const spell = spellAt(n.pe[i + 1]!);
    const x = n.pe[i + 2]!;
    const y = n.pe[i + 3]!;
    const p: Pet = old[at]?.spell === spell ? old[at]! : { owner: n.pe[i]!, spell, sprite: SPELLS[spell]!.sprite ?? 'wolf', x, y, tx: x, ty: y, face: 0, walk: 0 };
    p.tx = x;
    p.ty = y;
    p.face = n.pe[i + 4]! / 10;
    pets.push(p);
  }
  v.pets = pets;
  const me = v.heroOf(meId);
  for (const e of n.fx) {
    // (this game already showed its own hero's dash when it happened)
    if (e.kind === 'dash' && me && Math.hypot(e.x - me.x, e.y - me.y) < 60) continue;
    v.fx.push({ ...e });
  }
  for (let i = 0; i + 3 < n.pp.length; i += 4) v.pops.push({ x: n.pp[i]!, y: n.pp[i + 1]!, n: n.pp[i + 2]!, big: !!(n.pp[i + 3]! & 1), crit: !!(n.pp[i + 3]! & 2) });
  for (let i = 0; i + 2 < n.fa.length; i += 3) v.falls.push({ x: n.fa[i]!, y: n.fa[i + 1]!, boss: !!(n.fa[i + 2]! & 1), elite: !!(n.fa[i + 2]! & 2) });
}

function applyHero(h: Hero, s: HeroSnap, mine: boolean): void {
  h.tx = s.x;
  h.ty = s.y;
  if (!mine) {
    h.vx = s.vx;
    h.vy = s.vy;
    h.dirX = s.dx;
    h.dirY = s.dy;
  }
  h.hp = s.hp;
  if (s.i) h.iframe = Math.max(h.iframe, 0.2);
  h.down = !!s.dn;
  h.reviveT = s.rv;
  h.frenzy = s.fz;
  h.frenzyT = s.fT;
  h.dashCd = s.dc;
  h.rerolls = s.rr;
  // (the same cards keep their place, so a pick in flight isn't lost when the next report comes)
  if (JSON.stringify(h.cards) !== JSON.stringify(s.c)) h.cards = s.c;
  h.cardT = s.cT;
  if (s.w) h.struck = 1;
  h.chill = s.ch / 100;
  h.venom = s.vn;
  if (s.b) {
    h.spells = s.b.sp;
    h.took = s.b.tk;
    h.evolved = new Set(s.b.ev);
    h.strengths = s.b.st;
    h.boons = s.b.bn;
    h.wild = s.b.wd;
    h.built = {};
    h.rev++;
  }
}
