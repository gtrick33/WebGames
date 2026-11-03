import { damp } from '../core/math';
import { MOUNT_DEFS } from '../data/mounts';
import { NPCS } from '../data/quests';
import { passerbyLook } from '../render/art/townsfolk';
import type { HeroLook } from '../render/art/hero';
import { npcLookOf } from '../render/sprites';
import { bossHidden } from '../sim/boss';
import { hasStatus } from '../sim/combat';
import { TILE } from '../sim/map';
import { STORY_FADE } from '../sim/pets';
import { SUMMON_TIME, type World } from '../sim/world';
import type { Enemy, Ghost, NpcActor, Pet } from '../sim/types';
import { heightFromRadius, Motion, PERSON_H, type Cast } from './cast';
import type { Held } from './dress';
import { kitOf } from './kits';
import { coatTint, MOUNT_H, mountSprite, SEAT } from './mountLook';

/** A facing in the rules (an angle on the map) as a turn about the vertical. */
export const turnOf = (a: number): number => Math.atan2(Math.cos(a), Math.sin(a));
/** Facing down, left, right, up, as the rules count them. */
const DIR_TURN = [0, -Math.PI / 2, Math.PI / 2, Math.PI];

const WARDS: Record<string, { m: string; h: number }> = {
  gate: { m: 'wooden_gate', h: 26 },
  stone: { m: 'statue_obelisk', h: 34 },
  boat: { m: 'p_boat', h: 22 },
  wagon: { m: 'wagon', h: 24 },
  lantern: { m: 'lantern_standing', h: 26 },
};
const ECHOES = new Set(['echo-of-ysane', 'echo-of-ysane-mere', 'echo-of-ysane-quay', 'echo-of-the-children']);
const ECHO_TINT = [0.74, 0.88, 1.3] as const;
const WARD_LOOKS = new Set(['door', 'gate', 'stone', 'boat', 'wagon', 'lantern']);

const shortest = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
};

interface FoeAnim {
  state: string;
  since: number;
}

const FROZEN = [0.62, 0.86, 1.25] as const;
const CHILLED = [0.82, 0.93, 1.12] as const;


/** Everyone in the rules, told to the cast each frame. */
export class WorldCast {
  private readonly foes = new Map<number, FoeAnim>();
  private readonly hero = new Motion();
  private heroTurn = 0;
  private lastAct: string | null = null;
  private readonly ghosts = new Map<number, { m: Motion; turn: number }>();
  private readonly pets = new Map<number, { m: Motion; turn: number }>();

  reset(): void {
    this.foes.clear();
    this.ghosts.clear();
    this.pets.clear();
  }

  sync(cast: Cast, w: World, dt: number, time: number, o: { look: HeroLook; weapon: Held; folk: number; landOnly: boolean }): void {
    this.syncHero(cast, w, dt, time, o.look, o.weapon, o);
    for (const e of w.enemies) this.syncFoe(cast, e, time);
    for (const n of w.npcs) this.syncNpc(cast, n, w, time, Math.min(1, (w.time - (n.since ?? -Infinity)) / 0.8));
    for (const n of w.leftNpcs) {
      const a = 1 - (w.time - n.left) / (NPCS[n.id]?.down ? 3.2 : 1.2);
      if (a > 0) this.syncNpc(cast, n, w, time, a);
    }
    for (const c of w.chickens) {
      cast.shadow(c.x, c.y, 5);
      cast.creature('chicken', c.x, c.y, c.face < 0 ? -Math.PI / 2 : Math.PI / 2, 15, Math.hypot(c.vx, c.vy) > 4 ? 'walk' : 'idle', time + c.x * 0.1, true);
    }
    if (o.folk > 0.02) {
      for (const f of w.folk) {
        cast.shadow(f.x, f.y, 7);
        cast.person(passerbyLook(f.look), null, false, f.x, f.y, DIR_TURN[f.dir] ?? 0, { clip: f.moving ? 'walk' : 'idle', t: f.moving ? f.walkT : time + f.look * 0.37, loop: true }, { alpha: o.folk });
      }
    }
    for (const c of w.chests) {
      const rare = c.tier === 'epic';
      cast.shadow(c.x, c.y, 8);
      cast.prop(rare ? 'chest_large_gold' : 'chest', c.x, c.y, rare ? 15 : 13, 0, 0, c.open ? [0.55, 0.5, 0.5] : undefined);
    }
    for (const s of w.spores) cast.prop('mushroom_redGroup', s.x, s.y, s.ripe ? 13 : 7, 0, 0, s.fuse > 0 && Math.floor(time * 10) % 2 === 0 ? [1.6, 1.3, 1.3] : undefined);
    for (const d of w.drops) {
      const hop = ((d.z ?? 0) + Math.sin(time * 4 + d.x) * 0.6 + 1.3) / TILE;
      if (d.kind === 'gold') cast.prop('coin', d.x, d.y, 4.5, time * 4 + d.x, hop);
      else if (d.kind === 'potion') cast.prop('w_potion_medium_red', d.x, d.y, 10, time, hop);
      else if (d.kind === 'orb') cast.prop('w_potion_small_red', d.x, d.y, 8, time, hop);
      else if (d.kind === 'shard') cast.prop('stone_tallA', d.x, d.y, 11, time * 1.5, hop, [1.2, 0.5, 1.2]);
    }
    for (const pet of w.pets) this.syncPet(cast, pet, dt, time);
    for (const gh of w.coop?.ghosts ?? []) if (gh.seen > 0) this.syncGhost(cast, gh, dt, time);
  }

  private syncHero(cast: Cast, w: World, dt: number, time: number, look: HeroLook, held: Held, o0: { landOnly: boolean }): void {
    const p = w.player;
    const m = this.hero;
    const speed = Math.hypot(p.vx, p.vy);
    const moving = speed > 10;
    const acting = p.actKind !== null && p.actT > 0;
    const mount = p.riding ? MOUNT_DEFS[p.riding] : undefined;
    // which way they face: where the blow goes, else where they walk
    let want = this.heroTurn;
    if (acting) want = turnOf(p.actAngle);
    else if (moving) want = Math.atan2(p.vx, p.vy);
    else if (!p.form) want = this.heroTurn;
    this.heroTurn = damp(this.heroTurn, shortest(this.heroTurn, want), 16, dt);
    const blink = p.iframe > 0 && !p.dash && dt > 0 && Math.floor(time * 20) % 2 === 0;
    // (safe for a moment: they shine rather than dissolve)
    const alpha = 1;
    const flash = p.flash > 0 ? 0.75 : blink ? 0.4 : 0;
    const clipOf = (kind: string): string => (kind === 'cast' ? 'cast' : kind === 'shoot' ? 'bow' : kind === 'heavy' ? 'chop2' : kind === 'spin' ? 'spin' : 'chop');
    if (p.dead) m.set('die', false);
    else if (mount) m.set('sit');
    else if (p.dash) m.set('dodge', false);
    else if (p.channel) m.set(p.channel.target !== undefined ? 'channel' : 'spin');
    else if (acting) {
      const key = `${p.actKind}`;
      const fresh = this.lastAct !== key || p.actT > (this.lastActT ?? 0) + 0.01;
      m.set(clipOf(p.actKind!), false, 0.08, fresh);
    } else if (moving) m.set(speed > 60 ? 'run' : 'walk');
    else m.set('idle');
    this.lastAct = acting ? `${p.actKind}` : null;
    this.lastActT = p.actT;
    m.advance(dt);

    cast.shadow(p.x, p.y, mount ? 13 : 8);
    if (!p.dead && !o0.landOnly) cast.ring(p.x, p.y, 11, '#22e4ff', 0.75);
    if (p.form) {
      cast.creature(p.form, p.x, p.y, this.heroTurn, 30, acting ? 'chop' : moving ? 'run' : 'idle', time, !acting, { alpha, flash });
      return;
    }
    if (mount) {
      const body = mount.body;
      const coat = coatTint(mount.coat);
      cast.creature(mountSprite(mount), p.x, p.y, this.heroTurn, MOUNT_H[body] ?? 34, moving ? 'run' : 'idle', moving ? p.walkT : time, true, { alpha, flash, tint: coat });
      const bob = moving ? (Math.abs(Math.sin(p.walkT * 7)) * 1.3) / TILE : 0;
      cast.person(look, held, shieldOf(w.hero.cls), p.x, p.y, this.heroTurn, m, { alpha, flash, h: PERSON_H * 0.86, xray: true, lift: ((SEAT[body] ?? 27) - 9) / TILE + bob });
      return;
    }
    // calling the mount: it fades in beside the hero
    if (p.summon > 0 && w.hero.mount && MOUNT_DEFS[w.hero.mount]) {
      const md = MOUNT_DEFS[w.hero.mount]!;
      cast.creature(mountSprite(md), p.x, p.y + 2, this.heroTurn, MOUNT_H[md.body] ?? 34, 'idle', time, true, { alpha: Math.min(1, p.summon / SUMMON_TIME), tint: coatTint(md.coat) });
    }
    cast.person(look, held, shieldOf(w.hero.cls), p.x, p.y, this.heroTurn, m, { alpha, flash, xray: true });
  }

  private lastActT = 0;

  private syncFoe(cast: Cast, e: Enemy, time: number): void {
    if (e.boss && bossHidden(e)) return;
    if (e.dummy) {
      cast.shadow(e.x, e.y, 7);
      cast.prop('scarecrow', e.x, e.y, 26);
      return;
    }
    const sprite = e.boss?.def.sprite ?? e.def.sprite;
    const kit = kitOf(sprite, e.def.id);
    const h = heightFromRadius(e.r);
    let anim = this.foes.get(e.id);
    if (!anim) {
      anim = { state: e.state, since: time };
      this.foes.set(e.id, anim);
    } else if (anim.state !== e.state) {
      anim.state = e.state;
      anim.since = time;
    }
    const since = time - anim.since;
    let clip = 'idle';
    let t = time + e.id * 0.37;
    let loop = true;
    let alpha = 1;
    let rise = 0;
    let sx = 1;
    let sy = 1;
    if (e.dead) {
      clip = 'die';
      t = e.deathT;
      loop = false;
      alpha = Math.max(0, 1 - Math.max(0, e.deathT - 0.7) / 0.5);
      if (alpha <= 0) return;
    } else {
      const atk = kit.atk ?? 'chop';
      switch (e.state) {
        case 'spawn':
          rise = Math.max(0, 1 - since / 0.7);
          break;
        case 'windup':
          clip = atk;
          t = Math.min(since * 0.5, 0.18);
          loop = false;
          break;
        case 'act':
          clip = atk;
          t = since + 0.18;
          loop = false;
          break;
        case 'chase':
        case 'return':
          clip = kit.walk ?? (Math.hypot(e.vx, e.vy) > 62 ? 'run' : 'walk');
          t = e.walkT;
          break;
        default:
          break;
      }
      if (e.def.ai === 'hopper') {
        const k = Math.min(1, Math.hypot(e.vx, e.vy) / 90);
        sx = 1 + (e.state === 'windup' ? 0.15 : -0.1 * k);
        sy = 1 + (e.state === 'windup' ? -0.15 : 0.12 * k);
      }
      if (hasStatus(e, 'stun') || e.boss?.dazed) {
        clip = 'hit';
        t = time * 0.4;
      }
      if (hasStatus(e, 'freeze')) t = anim.since;
    }
    const frozen = hasStatus(e, 'freeze');
    const chilled = hasStatus(e, 'chill');
    const dying = e.boss && e.boss.dying > 0;
    const windFlash = e.state === 'windup' && Math.floor(time * 14) % 2 === 0 ? 0.32 : 0;
    const flash = e.flash > 0 ? 0.8 : dying ? (Math.floor(time * 16) % 2 ? 0.5 : 0) : windFlash;
    cast.shadow(e.x, e.y, e.r + 2);
    if (e.elite.length && !e.dead) cast.ring(e.x, e.y, e.r + 4, '#ffcf5a', 0.6 + Math.sin(time * 5) * 0.2);
    cast.creature(sprite, e.x, e.y, turnOf(e.face), h, clip, t, loop, { alpha, flash, rise, sx, sy, enemy: e.def.id, tint: frozen ? FROZEN : chilled ? CHILLED : undefined });
  }

  private syncNpc(cast: Cast, n: NpcActor, w: World, time: number, alpha: number): void {
    const def = NPCS[n.id];
    const look = npcLookOf(n.id);
    const fallen = def?.down;
    const turn = n.face < 0 ? -0.55 : 0.55;
    const clip = fallen ? 'lie' : 'idle';
    cast.shadow(n.x, n.y, 7);
    // (an echo of the dead is not quite here: it hangs a little off the ground, pale and cold)
    const echo = ECHOES.has(n.id);
    if (look) cast.person(look, null, false, n.x, n.y, turn, { clip, t: time + n.x * 0.1, loop: true }, echo ? { alpha, lift: 0.14 + Math.sin(time * 1.6 + n.x) * 0.04, tint: ECHO_TINT } : { alpha });
    else cast.creature(def?.sprite ?? 'villager', n.x, n.y, turn, PERSON_H, fallen ? 'die' : 'idle', fallen ? 9 : time + n.x * 0.1, !fallen, { alpha });
    void w;
  }

  private syncPet(cast: Cast, pet: Pet, dt: number, time: number): void {
    const look = pet.def.look;
    if (pet.def.role === 'ward' && WARD_LOOKS.has(look ?? 'door')) {
      const ward = WARDS[look ?? 'door'];
      if (ward) {
        const shake = pet.flash > 0 ? Math.sin(time * 60) * 1 : 0;
        cast.prop(ward.m, pet.x + shake, pet.y, ward.h);
      }
      return;
    }
    let s = this.pets.get(pet.id);
    if (!s) {
      s = { m: new Motion(), turn: 0 };
      this.pets.set(pet.id, s);
    }
    const moving = Math.hypot(pet.vx, pet.vy) > 8;
    if (moving) s.turn = damp(s.turn, shortest(s.turn, Math.atan2(pet.vx, pet.vy)), 12, dt);
    else if (pet.actT > 0) s.turn = turnOf(pet.face);
    const fade = pet.story ? Math.min(1, pet.deathT > 0 ? 1 - pet.deathT / STORY_FADE : 1) : 1;
    const alpha = pet.dead ? Math.max(0, 1 - pet.deathT / 0.6) : fade;
    if (alpha <= 0) return;
    if (pet.dead) s.m.set('die', false);
    else if (pet.actT > 0) s.m.set('chop', false, 0.08);
    else s.m.set(moving ? 'walk' : 'idle');
    s.m.advance(dt);
    const flash = pet.flash > 0 ? 0.7 : 0;
    cast.shadow(pet.x, pet.y, pet.r + 1);
    const person = look ? npcLookOf(look) : null;
    if (person) {
      const small = /child/.test(look!) ? 0.72 : 1;
      cast.person(person, null, false, pet.x, pet.y, s.turn, s.m, { alpha, flash, h: PERSON_H * small });
    } else {
      const sprite = pet.def.sprite ?? 'wolf';
      cast.creature(sprite, pet.x, pet.y, s.turn, heightFromRadius(pet.r), s.m.clip, s.m.t, s.m.clip === 'walk' || s.m.clip === 'idle', { alpha, flash });
    }
  }

  private syncGhost(cast: Cast, gh: Ghost, dt: number, time: number): void {
    let s = this.ghosts.get(gh.n);
    if (!s) {
      s = { m: new Motion(), turn: 0 };
      this.ghosts.set(gh.n, s);
    }
    const moving = Math.hypot(gh.vx, gh.vy) > 10;
    if (moving) s.turn = damp(s.turn, shortest(s.turn, Math.atan2(gh.vx, gh.vy)), 14, dt);
    if (gh.dead) s.m.set('die', false);
    else s.m.set(moving ? 'run' : 'idle');
    s.m.advance(dt);
    cast.shadow(gh.x, gh.y, 8);
    const alpha = gh.dead ? 0.55 : gh.untouchable && Math.floor(time * 20) % 2 === 0 ? 0.6 : 1;
    cast.person(gh.look as HeroLook, gh.weapon as Held, gh.cls === 'warrior' || gh.cls === 'paladin', gh.x, gh.y, s.turn, s.m, { alpha, xray: true });
  }
}

export const shieldOf = (cls: string): boolean => cls === 'warrior' || cls === 'paladin';
