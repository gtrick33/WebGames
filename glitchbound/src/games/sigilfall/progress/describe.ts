import { PETS } from '../data/pets';
import { SKILLS } from '../data/skills';
import type { BuffDef, ComboCond, DmgType, Effect, GroundSpec, Mod, ProcDef, ResourceDef, SkillOp, StatKey, StatusId } from '../data/types';

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
  shadow: 'Shadow damage',
  holy: 'Holy damage',
  nature: 'Nature damage',
  healing: 'Healing',
  pet: 'Companion damage and health',
};

const PERCENT = new Set<StatKey>(['hpPct', 'power', 'crit', 'critDmg', 'haste', 'speed', 'ultCharge', 'potion', 'physical', 'fire', 'frost', 'lightning', 'poison', 'arcane', 'shadow', 'holy', 'nature', 'healing', 'pet']);

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
  bleed: 'Bleeding',
  curse: 'Cursed',
  fear: 'Feared',
};

export const DMG_NAME: Record<DmgType, string> = { physical: 'physical', fire: 'fire', frost: 'frost', lightning: 'lightning', poison: 'poison', arcane: 'arcane', shadow: 'shadow', holy: 'holy', nature: 'nature' };

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
    case 'bleed':
      return `makes enemies Bleed (${pct(power)} of the hit per second for ${secs(dur)}, through armor)`;
    case 'curse':
      return `curses (${pct(power)} of the hit as damage over time per second, ${secs(dur)})`;
    case 'fear':
      return `terrifies: enemies run from you for ${secs(dur)}`;
  }
}

function groundText(g: GroundSpec): string {
  const what = g.heal ? 'healing ground' : g.look === 'fire' ? 'burning ground' : g.look === 'poison' ? 'a poison cloud' : g.look === 'frost' ? 'a patch of frost' : 'a hazard';
  return `leaves ${what} for ${secs(g.dur)}${g.pull ? ' that drags enemies in' : ''}`;
}

/** A damage-over-time status as a noun. */
const STATUS_WORD: Partial<Record<string, string>> = { burn: 'burn', bleed: 'bleed', poison: 'poison', curse: 'curse' };

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
      // (a small heal keeps its decimal: 0.3% used to read "0%")
      return `heals you for ${e.pct < 3 && e.pct % 1 !== 0 ? e.pct.toFixed(1) : Math.round(e.pct)}% of your health`;
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
    case 'buff':
      return buffText(e.buff);
    case 'resource':
      return `gives ${e.n} ${e.n === 1 ? 'point' : 'points'} of your resource`;
    case 'points':
      return `gives ${e.n} of your specialization's ${e.n === 1 ? 'point' : 'points'}`;
    case 'fear':
      return `terrifies enemies around it for ${secs(e.dur)}`;
    case 'summon':
      return `calls ${e.count === 1 ? `a ${PETS[e.pet]?.name ?? 'companion'}` : `${e.count} ${PETS[e.pet]?.name ?? 'companion'}s`}${e.dur ? ` for ${secs(e.dur)}` : ''}`;
    case 'sacrifice':
      return `costs you ${Math.round(e.pct)}% of your health`;
    case 'cleanse':
      return 'clears every harmful effect on you';
    case 'taunt':
      return `makes enemies around it turn on you for ${secs(e.dur)}`;
    case 'yank':
      return 'drags the enemy hit to you';
    case 'detonate':
      return `sets off every ${STATUS_WORD[e.status] ?? e.status} on the enemy at once (${pct(e.mul)} of what was left${e.radius ? ', on everything near it' : ''})`;
    case 'cast': {
      const what = e.skill === 'basic' ? 'your basic attack' : (SKILLS[e.skill]?.name ?? e.skill);
      const n = e.times && e.times > 1 ? `${e.times} times ` : '';
      return `an echo casts ${what} ${n}at the nearest enemy, free (${pct(e.mul)} damage)`;
    }
  }
}

/** A buff, as a clause: "for 8 s: +20% Damage, 30% less damage taken". */
export function buffText(b: BuffDef): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(b.stats ?? {})) if (v) parts.push(fmtStat(k as StatKey, v));
  if (b.dr) parts.push(`${Math.round(b.dr)}% less damage taken`);
  if (b.hot) parts.push(`heals ${b.hot}% of your health per second`);
  if (b.thorns) parts.push('strikes back at whatever hits you');
  const m = b.empower;
  if (m) {
    const how = [m.pct ? `+${m.pct}% damage${b.max ? ' a stack' : ''}` : '', m.free ? 'free' : '', m.instant ? 'no cast time' : '', m.ready ? 'ready at once' : ''].filter(Boolean);
    const what = m.type ? `${DMG_NAME[m.type].toLowerCase()} skill` : (SKILLS[m.skill]?.name ?? m.skill);
    // (one that lasts, not used up: every cast of it while it is up)
    parts.push(m.keep ? `every ${what} while it lasts: ${how.join(', ')}` : `your next ${m.casts && m.casts > 1 ? `${m.casts} casts of ` : ''}${what}: ${how.join(', ')}`);
  }
  if (b.max && !m) parts.push(`stacks to ${b.max}`);
  return `${b.name} for ${secs(b.dur)}: ${parts.join(', ')}`;
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
      // (ranks add up in binary: three of 0.2 is 0.6000000000000001 unless it is rounded for the eye)
      return `${s}: +${Math.round(op.n * 100) / 100} ${op.label}.`;
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
      return `${s} deals +${op.pct}% damage to ${op.status === 'lowHp' ? 'enemies below 30% health' : op.status === 'far' ? 'enemies a long way off' : `${STATUS_NAME[op.status]} enemies`}.`;
    case 'afterDodge':
      return `${s} deals +${op.pct}% damage within ${secs(op.window)} after a dodge.`;
    case 'gen':
      return `${s} gives ${op.n} more of your resource.`;
    case 'cost':
      return `${s} costs ${op.pct}% less.`;
    case 'combo': {
      const vs = op.combo.vs?.length ? ` against ${comboVsText(op.combo.vs)}` : '';
      if (op.add) return `${s}'s combo hits ${Math.round(op.add * 100)}% harder${vs ? ` and also lands${vs}` : ''}.`;
      if (op.combo.mult) return `${s} is a combo: ×${op.combo.mult} damage${vs}${op.combo.consume ? ', consuming it' : ''}.`;
      return `${s}'s combo also lands${vs}${op.combo.consume ? ', consuming it' : ''}.`;
    }
    case 'build':
      return `${s} builds ${op.n} more ${op.n === 1 ? 'point' : 'points'}.`;
    case 'spend':
      return `${s} spends your points: +${Math.round(op.per * 100)}% damage for each.`;
  }
}

/** What a combo blow needs of its target, in words ("Bleeding or stunned enemies"). */
export function comboVsText(vs: readonly ComboCond[]): string {
  const words = vs.map((v) => (v === 'lowHp' ? 'enemies below 30% health' : v === 'held' ? 'stunned, frozen, rooted or feared enemies' : `${STATUS_NAME[v]} enemies`));
  return words.length <= 1 ? (words[0] ?? 'enemies') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

export const procText = (p: ProcDef): string => p.text;

/**
 * What a skill costs, in the class's own resource and under its own name: mana is a share of the pool (so it grows
 * with the hero), the others are points (sim/cast.ts skillCost). "20 Rage", "3 Zeal", "31 Mana"; null for a free one.
 */
export function costText(res: ResourceDef | null, cost: number, max: number): string | null {
  if (!res || cost <= 0 || max <= 0) return null;
  return `${Math.round(res.kind === 'mana' ? (cost * max) / 100 : cost)} ${res.name}`;
}

/** Everything a mod list does, as lines (stat mods with `when` included). */
export function modLines(mods: Mod[]): string[] {
  return mods.map((m) => {
    if (m.t === 'stat') return `${fmtStat(m.stat, m.v)}${m.when === 'lowHp' ? ' while below half health' : m.when === 'afterDodge' ? ' for 3 s after a dodge' : ''}`;
    if (m.t === 'skill') return opText(m.skill, m.op);
    return procText(m.proc);
  });
}
