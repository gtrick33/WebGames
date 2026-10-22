import { SKILLS } from '../data/skills';
import type { DmgType, Effect, GroundSpec, Mod, ProcDef, SkillOp, StatKey, StatusId } from '../data/types';

/**
 * Plain-language text for stats, effects and modifiers, generated from the same data the simulation
 * runs on, so what an item says is exactly what it does.
 */

export const STAT_LABEL: Record<StatKey, string> = {
  hp: 'Health',
  hpPct: 'Max health',
  power: 'Damage',
  crit: 'Critical chance',
  critDmg: 'Critical damage',
  haste: 'Haste',
  armor: 'Armor',
  speed: 'Move speed',
  regen: 'Health regen',
  ultCharge: 'Ultimate charge',
  potion: 'Potion healing',
  physical: 'Physical damage',
  fire: 'Fire damage',
  frost: 'Frost damage',
  lightning: 'Lightning damage',
  poison: 'Poison damage',
  arcane: 'Arcane damage',
};

const PERCENT = new Set<StatKey>(['hpPct', 'power', 'crit', 'critDmg', 'haste', 'speed', 'ultCharge', 'potion', 'physical', 'fire', 'frost', 'lightning', 'poison', 'arcane']);

export function fmtStat(stat: StatKey, v: number): string {
  const n = stat === 'regen' ? v.toFixed(1) : String(Math.round(v));
  if (stat === 'regen') return `+${n} ${STAT_LABEL[stat]} per second`;
  return `+${n}${PERCENT.has(stat) ? '%' : ''} ${STAT_LABEL[stat]}`;
}

export const STATUS_NAME: Record<StatusId, string> = {
  burn: 'Burning',
  poison: 'Poisoned',
  chill: 'Chilled',
  freeze: 'Frozen',
  shock: 'Shocked',
  stun: 'Stunned',
  root: 'Rooted',
  armorBreak: 'Armor Broken',
  mark: 'Marked',
  weaken: 'Weakened',
};

export const DMG_NAME: Record<DmgType, string> = { physical: 'physical', fire: 'fire', frost: 'frost', lightning: 'lightning', poison: 'poison', arcane: 'arcane' };

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const secs = (v: number): string => `${Number.isInteger(v) ? v : v.toFixed(1)} s`;

function statusText(s: StatusId, dur: number, power: number): string {
  switch (s) {
    case 'burn':
      return `sets enemies Burning (${pct(power)} of the hit as fire damage per second, ${secs(dur)})`;
    case 'poison':
      return `poisons (${pct(power)} of the hit per second for ${secs(dur)}, stacks 3 times)`;
    case 'chill':
      return `chills (${pct(power)} slower for ${secs(dur)})`;
    case 'freeze':
      return `freezes enemies solid for ${secs(dur)}`;
    case 'shock':
      return `shocks (+${Math.round(power)}% damage taken for ${secs(dur)})`;
    case 'stun':
      return `stuns for ${secs(dur)}`;
    case 'root':
      return `roots in place for ${secs(dur)}`;
    case 'armorBreak':
      return `breaks armor (+${Math.round(power)}% damage taken for ${secs(dur)})`;
    case 'mark':
      return `marks (+${Math.round(power)}% damage taken from you for ${secs(dur)})`;
    case 'weaken':
      return `weakens (${Math.round(power)}% less damage dealt for ${secs(dur)})`;
  }
}

function groundText(g: GroundSpec): string {
  const what = g.look === 'fire' ? 'burning ground' : g.look === 'poison' ? 'a poison cloud' : g.look === 'frost' ? 'a patch of frost' : 'a hazard';
  return `leaves ${what} for ${secs(g.dur)}`;
}

export function effectText(e: Effect): string {
  switch (e.kind) {
    case 'status':
      return (e.chance && e.chance < 1 ? `${pct(e.chance)} chance: ` : '') + statusText(e.status, e.dur, e.power);
    case 'explode':
      return `explodes for ${pct(e.mul)} damage around it${e.status ? ` and ${statusText(e.status.status, e.status.dur, e.status.power)}` : ''}`;
    case 'split':
      return `splits into ${e.count} smaller projectiles (${pct(e.mul)} damage each)`;
    case 'chain':
      return `leaps to ${e.jumps} more ${e.jumps === 1 ? 'enemy' : 'enemies'} (${pct(e.mul)} damage)`;
    case 'heal':
      return `heals you for ${Math.round(e.pct)}% of your health`;
    case 'shield':
      return `shields you for ${Math.round(e.pct)}% of your health for ${secs(e.dur)}`;
    case 'nova':
      return `releases a burst around you (${pct(e.mul)} damage${e.dmgType ? `, ${DMG_NAME[e.dmgType]}` : ''})`;
    case 'shockwave':
      return `sends a shockwave rolling forward (${pct(e.mul)} damage)`;
    case 'ground':
      return groundText(e.ground);
    case 'pull':
      return 'pulls enemies in';
    case 'resetCd':
      return e.skill ? `makes ${SKILLS[e.skill]?.name ?? 'a skill'} ready again` : 'makes a random skill ready again';
    case 'cdr':
      return e.s >= 30 ? 'makes every other skill ready again' : `takes ${secs(e.s)} off your cooldowns`;
    case 'charge':
      return `charges your ultimate by ${Math.round(e.pct)}%`;
    case 'riftBurst':
      return `tears a rift that bursts after ${secs(e.delay)}`;
  }
}

const skillName = (id: string): string => (id === '*' ? 'Every skill' : id === 'dodge' ? 'Your dodge' : id === 'basic' ? 'Your basic attack' : SKILLS[id]?.name ?? id);

/** One modifier on one skill, as a sentence. */
export function opText(skill: string, op: SkillOp): string {
  const s = skillName(skill);
  switch (op.op) {
    case 'damage':
      return `${s} deals +${op.pct}% damage.`;
    case 'cooldown':
      return `${s} recharges ${op.pct}% faster.`;
    case 'area':
      return `${s} covers ${op.pct}% more area.`;
    case 'range':
      return `${s} reaches ${op.pct}% farther.`;
    case 'duration':
      return `${s} lasts ${op.pct}% longer.`;
    case 'arc':
      return `${s} sweeps a ${op.pct}% wider arc.`;
    case 'pierce':
      return `${s} passes through ${op.n} more ${op.n === 1 ? 'enemy' : 'enemies'}.`;
    case 'bounce':
      return `${s} bounces to ${op.n} more ${op.n === 1 ? 'enemy' : 'enemies'}.`;
    case 'projectiles':
      return `${s} fires ${op.n} more ${op.n === 1 ? 'projectile' : 'projectiles'}.`;
    case 'charges':
      return `${s} holds ${op.n} more ${op.n === 1 ? 'charge' : 'charges'}.`;
    case 'extra':
      return `${s}: +${op.n} ${op.label}.`;
    case 'convert':
      return `${s} deals ${DMG_NAME[op.dmgType]} damage instead.`;
    case 'onHit':
      return `${s} ${effectText(op.effect)} on hit.`;
    case 'onImpact':
      return `${s} ${effectText(op.effect)} where it lands.`;
    case 'onKill':
      return `${s} ${effectText(op.effect)} when it kills.`;
    case 'onCast':
      return `${s} ${effectText(op.effect)} when you cast it.`;
    case 'trail':
      return `${s} ${groundText(op.ground)} along its path.`;
    case 'bonusVs':
      return `${s} deals +${op.pct}% damage to ${op.status === 'lowHp' ? 'enemies below 30% health' : `${STATUS_NAME[op.status]} enemies`}.`;
    case 'afterDodge':
      return `${s} deals +${op.pct}% damage within ${secs(op.window)} after a dodge.`;
  }
}

export const procText = (p: ProcDef): string => p.text;

/** Everything a mod list does, as lines (stat mods with `when` included). */
export function modLines(mods: Mod[]): string[] {
  return mods.map((m) => {
    if (m.t === 'stat') return `${fmtStat(m.stat, m.v)}${m.when === 'lowHp' ? ' while below half health' : m.when === 'afterDodge' ? ' for 3 s after a dodge' : ''}`;
    if (m.t === 'skill') return opText(m.skill, m.op);
    return procText(m.proc);
  });
}
