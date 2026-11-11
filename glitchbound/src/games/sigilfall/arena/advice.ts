import type { Ability, Effect } from './abilities';

/**
 * When to press an ability, in a sentence or two: what the setup screen says under "Best used" when a player opens
 * one before taking it (the owner: "i want to be able to read my spells ... best uses, best combos"). It is worked
 * out from what the ability does, so a new ability or a changed one is never left with stale advice; the wording
 * keeps to what the rules really do (sim.ts): a hold wears off faster each time it is used on the same fighter,
 * hurt breaks a fear, a daze or a root, a cast can be cut off, and nobody can be hit through a pillar.
 */
export function usesOf(ab: Ability, ranged: boolean): string[] {
  const has = <K extends Effect['k']>(k: K): Extract<Effect, { k: K }> | undefined => ab.effects.find((e): e is Extract<Effect, { k: K }> => e.k === k);
  const hold = ab.effects.find((e): e is Extract<Effect, { k: 'cc' }> => e.k === 'cc');
  const melee = ab.range > 0 && ab.range <= 40;
  const out: string[] = [];
  const say = (line: string): void => {
    if (!out.includes(line)) out.push(line);
  };

  if (ab.super) {
    say('It has no cooldown: it is ready when your meter is full, and combos fill the meter fastest.');
    say(ab.aim === 'friend' ? 'Keep it for the moment a friend is about to fall.' : 'Keep it for the moment that decides the fight: an enemy low on health, or their healer caught and unable to act.');
    if (ab.bolt) say('It flies, so a quick step can dodge it. Throw it at someone who is stunned, rooted or in the middle of a cast.');
    return out;
  }
  if (ab.id === 'dash') {
    say('Step out of the way of anything that flies at you: a bolt, an arrow, a super.');
    say('It also gets you behind a pillar, where nobody can target you.');
    return out;
  }

  const stop = has('interrupt');
  if (stop) say(`Save it for the cast that matters, a heal or a long heavy spell. It cuts the cast off and locks that kind of magic for ${stop.lock} seconds.`);
  if (hold?.cc === 'stun') {
    say('Stun them, then spend your hardest blows while they can’t answer.');
    say('It is also the surest way to stop a cast or to keep a healer from healing.');
  }
  if (hold?.cc === 'fear') {
    say('It sends them running: time to heal, to get away, or to finish a long cast.');
    say('Enough damage breaks it, so don’t hit a fleeing enemy you want kept away.');
  }
  const safe = has('immune');
  if (hold?.cc === 'incap') {
    say('It takes one enemy out of the fight for a moment. Use it on their healer, or on whoever is about to hit you.');
    if (safe) say('Nothing can hurt them while it lasts either, so use the time on the other enemy, or to get away.');
    else say('Any damage breaks it at once, so leave that enemy alone while it lasts.');
  }
  if (hold?.cc === 'root') say(ranged ? 'It pins a melee fighter in place while you walk out of reach.' : 'It pins a runner so they can’t get away from you.');
  if (hold?.cc === 'silence' && !stop) say('A silenced caster can’t cast at all. It is best on a healer while their friend is low.');
  if (hold) say('Each hold of the same kind lasts half as long as the one before on the same enemy, so don’t use two in a row.');
  if (has('trap')) say('Set it where they have to come: at your own feet when a melee fighter is on you, or in a gap between pillars.');
  if (has('knock')) say('It throws them back and cuts off whatever they were casting.');
  if (has('reflect')) say('Press it when you see a big spell being cast at you: the spell goes back at its caster.');
  if (safe && ab.aim !== 'enemy') {
    if (safe.still) say('Nothing can touch you while it lasts, and you can’t act either. Use it to outlast their hardest burst.');
    else if (safe.phys) say('It stops blows and arrows, not spells. Use it when a warrior or a ranger has turned on you.');
    else say(ab.aim === 'friend' ? 'Nothing harmful lands on them while it lasts. Give it to whoever is about to fall.' : 'Nothing harmful lands on you while it lasts. Keep it for the moment they commit everything.');
  }
  if (has('token')) say('It breaks any hold that is on you. Keep it for the stun that would get you killed.');
  if (has('lastgrace')) say('Put it on a friend who is about to die: the killing blow leaves them alive.');
  if (has('absorb')) say(ab.aim === 'friend' ? 'Shield a friend before the burst lands on them, not after.' : 'Put it up before their burst lands, not after.');
  if (has('guard')) say('Press it when they commit their burst.');
  if (has('fury')) say('Press it just before your hardest blows, best of all on a stunned enemy.');
  if (has('dispel')) say(ab.aim === 'enemy' ? 'It strips a shield or a blessing off an enemy. Take their protection away before your burst.' : 'It takes a curse or a magical hold off a friend. Free a healer who has been feared or silenced.');
  if (has('charge')) say('It closes the gap at once. Open the fight with it, or catch someone who is running.');
  if (has('blink') || has('leap') || has('dash')) say('Use it to get out of melee reach, or behind a pillar so they lose sight of you.');
  if (has('break') || has('free')) say('It gets you out of roots and slows: use it to escape, or to stay on a target who keeps you slowed.');
  if (has('speed') && !has('break')) say('Run faster to catch a target or to open a gap.');
  const wound = has('antiheal');
  if (wound) say(`It cuts their healing by ${wound.pct}% while it lasts. Keep it on whoever their healer is trying to save.`);
  const burn = has('dot');
  if (burn) {
    say('Put it on early and keep it on: it goes on hurting them while you move, hide or are held.');
    if (has('backlash')) say('Whoever dispels it is silenced, so their healer has to choose between leaving it on and being shut up.');
  }
  if (has('slow') && !hold) say(ranged ? 'A slowed melee fighter can’t reach you. Keep it on them and keep walking.' : 'A slowed enemy can’t get away from you. Keep it on your target.');
  if (has('hot')) say('Keep it on whoever is being hit: it heals while you are on the move.');
  if (has('heal') && !has('dmg')) {
    if (ab.cast > 0) say('Cast it out of their sight, behind a pillar: they can’t stop a cast they can’t see.');
    else say('It is instant, so nothing can stop it. Keep it for a tight spot.');
  }
  if (has('heal') && has('dmg')) say('It heals you as it hurts them: use it to stay in a fight you would otherwise have to leave.');
  if (has('price')) say('It costs you health, so don’t use it when you are low.');
  if (ab.role === 'burst' && has('dmg') && ab.cast < 1.2) say('It is one of your hardest blows. Spend it where it counts: on a target that can’t get away, or to finish one that is low.');
  if (has('dmg') && ab.cast >= 1.2) say('It is a long cast and they will try to stop it. Cast it while they are stunned or feared, or just after they have used their interrupt.');
  if (has('dmg') && ab.channel) say('It lasts as long as you keep it up: start it when nobody is free to stop you.');
  if (ab.anyState) say('It works even while you are stunned, feared or dazed.');
  if (out.length === 0 || (has('dmg') && ab.cd === 0 && out.length < 2)) {
    say(ab.cd === 0 ? 'It has no cooldown: press it whenever nothing better is ready.' : melee ? 'Use it whenever it is ready and you are in reach.' : 'Use it whenever it is ready and you can see your target.');
  }
  return out.slice(0, 3);
}
