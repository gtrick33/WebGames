import { CLASSES } from '../data/classes';
import type { ClassId } from '../data/types';
import { ABILITIES, barCombos, PRESETS, ultOf, type Ability } from './abilities';
import { steerTo } from './bot';
import { CLASS_EASE, CLASS_WAY, EASE_WORD } from './styles';
import { CLOSE_FROM, RANGED, type FighterSetup, type Match, type MatchEvent, type MatchSetup, type MoveInput } from './sim';

/**
 * The Ring's tutorial (the owner, 2026-11-14: "for the practice match, replace it with 'tutorial' where its not a ranked
 * match but rather an explanation for newcomers, make sure everything is shown during a tutorial match please, from
 * character selection, to customizing, to targeting, combos etc").
 *
 * Two halves. In the lobby (LOBBY_STEPS, shown by RingScreen) it walks through choosing a class, the formats, the
 * ranks, the arenas and the setup page: playstyles, abilities, combos, talents, the super and the extras. Then a match
 * against a sparring partner (TutorialRun, driven by RingMatch) teaches one thing at a time, each done for real before
 * the next: the entry, the nameplates, moving, choosing a target, abilities, a combo, Momentum, stepping out of a red
 * circle, placing an ability, the super, the healing spheres, the sigil, pillars, holds and casts, teammates and the
 * Gloam, and last a real fight against a gentle opponent. Nothing in it is rated.
 *
 * While it teaches, the match's clock is held (Match.hold), the sparring partner only does what the lesson needs, and
 * neither side can fall. Kept apart from the screen so it can be tried on a bare match.
 */

/** The setup page's tabs (RingSetup.tsx). */
export type SetupTab = 'abilities' | 'talents' | 'super';

export interface LobbyStep {
  id: string;
  title: string;
  text: (cls: ClassId) => string;
  /** What is lit while it's read (a `data-tut` mark on the page), if anything. */
  spot: string | null;
  page: 'play' | 'setup';
  /** On the setup page: the playstyle cards, or everything (and which tab). */
  mode?: 'styles' | 'custom';
  tab?: SetupTab;
  /** Where the words sit, so they don't cover what they talk about. */
  at: 'top' | 'bottom';
}

export const LOBBY_STEPS: readonly LobbyStep[] = [
  { id: 'welcome', title: 'Welcome to the Ring', text: () => 'The Ring is short fights between heroes: one against one, two against two, or three against three. This tutorial shows you everything, then lets you practice on a sparring partner. Nothing in it changes your rating.', spot: null, page: 'play', at: 'bottom' },
  { id: 'classes', title: 'Pick a class', text: (cls) => `Each class fights its own way: up close or from range, and some can heal. Click one to see it. ${CLASSES[cls].name}: ${CLASS_WAY[cls].toLowerCase()}, ${EASE_WORD[CLASS_EASE[cls]].toLowerCase()} to learn.${CLASS_EASE[cls] === 'easy' ? '' : ' The Warrior is an easy first pick.'}`, spot: 'classes', page: 'play', at: 'bottom' },
  { id: 'formats', title: 'Choose your fight', text: () => '1v1, 2v2 or 3v3. Each has its own rating, starting at 1000: a win raises it and a loss lowers it. In 2v2 and 3v3 the computer fills your team, or your friends do.', spot: 'formats', page: 'play', at: 'bottom' },
  { id: 'rank', title: 'Climb the ranks', text: () => 'Your rank, and how far it is to the next. Every rank gives you a title and a suit of armor to keep. Rewards shows them all.', spot: 'rank', page: 'play', at: 'bottom' },
  { id: 'arena', title: 'Arenas', text: () => 'Each arena has its own pillars to hide behind. Any picks one for you, so you can leave it as it is.', spot: 'arena', page: 'play', at: 'bottom' },
  { id: 'loadout', title: 'What you bring', text: () => 'Five abilities, then your Swift Step and your super (the round one): open any of them to read what it does and when to use it. Under them, your talents. Let’s open your setup.', spot: 'loadout', page: 'play', at: 'top' },
  { id: 'styles', title: 'Pick a playstyle', text: (cls) => `Each card is a ready-made ${CLASSES[cls].name} build. Pick the one that sounds like you: it fills your setup at once, ready to fight with as it is.`, spot: 'styles', page: 'setup', mode: 'styles', at: 'bottom' },
  { id: 'kit', title: 'Your abilities', text: () => 'Customize opens everything. Every class has twelve abilities and brings five. Click one to read what it does, when to use it and what it combines with, then equip it.', spot: 'kit', page: 'setup', mode: 'custom', tab: 'abilities', at: 'bottom' },
  { id: 'combos', title: 'Combos', text: () => 'These pairs work together: use the first, then the second, and the second hits much harder. Each different combo in a row builds Momentum.', spot: 'combos', page: 'setup', mode: 'custom', tab: 'abilities', at: 'bottom' },
  { id: 'talents', title: 'Talents', text: () => 'Pick one from each row. Talents change how your whole class fights, whatever is on your bar.', spot: 'panel', page: 'setup', mode: 'custom', tab: 'talents', at: 'top' },
  { id: 'super', title: 'Your super', text: () => 'A big ability that’s ready when its meter is full. The meter fills as you deal damage or heal. Each class has two to choose from.', spot: 'panel', page: 'setup', mode: 'custom', tab: 'super', at: 'top' },
  { id: 'sets', title: 'Saved as you go', text: () => 'Each class has three setups, saved as you change them. Now let’s try it all in a practice fight.', spot: 'sets', page: 'setup', mode: 'custom', tab: 'abilities', at: 'bottom' },
];

/** The sparring partner: a mage, whose comet is the red circle to step out of and whose fire is the cast to watch. */
export const SPARRING_CLASS: ClassId = 'mage';
const SPAR_PRESET = PRESETS.mage[0]!;
/** Its circle and its cast, by id. */
const SPAR_CIRCLE = 'm-super';
const SPAR_CAST = 'm-lash';
/** The arena it's taught in: open, with pillars to hide behind. */
export const TUTORIAL_MAP = 'sands';
/** Long enough to read the entry's words and press "ready". */
export const TUTORIAL_GATES = 120;

/** The practice match: the player as they set themselves up, against the sparring partner. */
export function tutorialSetup(me: FighterSetup, seed: number): MatchSetup {
  const spar: FighterSetup = { team: 1, cls: SPARRING_CLASS, name: 'Sparring Partner', bar: [...SPAR_PRESET.bar], talents: [...SPAR_PRESET.talents], ult: SPAR_PRESET.ult };
  return { seed, map: TUTORIAL_MAP, fighters: [{ ...me, team: 0, human: true }, spar], gates: TUTORIAL_GATES };
}

export type MatchStepId = 'gates' | 'plates' | 'move' | 'target' | 'ability' | 'combo' | 'momentum' | 'circle' | 'place' | 'super' | 'sphere' | 'sigil' | 'pillar' | 'holds' | 'friends' | 'gloam' | 'fight';

/** What a match step lights up on the screen. */
export type MatchSpot = 'prep' | 'plates' | 'foes' | 'target' | 'bar' | 'step' | 'super' | null;

/** The keys the words name, as they read on this player's keyboard (or a phone's buttons). */
export interface TutorialKeys {
  touch: boolean;
  ab: string[];
  dash: string;
  super: string;
  nextFoe: string;
  nextFriend: string;
  /** "Close in automatically" is on (an ability pressed out of reach walks there first). */
  closeIn: boolean;
}

export interface TutorialView {
  id: MatchStepId;
  n: number;
  of: number;
  title: string;
  text: string;
  /**
   * What to do, in one line, for a step done by doing it: what the panel shows while the match goes on, the whole of
   * `text` a press away (empty for a step that is read).
   */
  short: string;
  /** It's read, then Next (otherwise it's done by doing it). */
  next: boolean;
  spot: MatchSpot;
  /** A word about how the last try went ("Well dodged!"). */
  note: string;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const cap = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/** How near the sparring partner comes to the player in each step that has it come at all. */
const APPROACH: Partial<Record<MatchStepId, number>> = { target: 170, ability: 90, combo: 90, circle: 120, place: 140, super: 90, holds: 150 };

/** Steps read and then passed with Next; the rest are passed by doing them. */
const READ: ReadonlySet<MatchStepId> = new Set(['plates', 'momentum', 'holds', 'friends', 'gloam']);

export class TutorialRun {
  readonly steps: MatchStepId[];
  i = 0;
  /** The sparring partner fights back (the last step). */
  free = false;
  private note = '';
  private noteT = 0;
  private moved = 0;
  private lastAt: { x: number; y: number } | null = null;
  private targeted = false;
  private uses = 0;
  private combos0 = 0;
  private hiddenT = 0;
  private tries = 0;
  private circleUp = false;
  private wait = 0;
  /** The ability on the player's bar that is placed on the ground, if any (its own step). */
  readonly placed: Ability | null;

  constructor(
    readonly m: Match,
    readonly myId: number,
    readonly foeId: number,
  ) {
    m.hold = true;
    const me = m.fighters[myId]!;
    this.placed = me.bar.map((id) => ABILITIES[id]).find((ab): ab is Ability => !!ab && ab.aim === 'ground') ?? null;
    this.steps = ['gates', 'plates', 'move', 'target', 'ability', 'combo', 'momentum', 'circle', ...(this.placed ? (['place'] as const) : []), 'super', 'sphere', 'sigil', 'pillar', 'holds', 'friends', 'gloam', 'fight'];
    const foe = m.fighters[foeId];
    if (foe) foe.target = myId;
  }

  get id(): MatchStepId {
    return this.steps[this.i]!;
  }
  private get me() {
    return this.m.fighters[this.myId]!;
  }
  private get foe() {
    return this.m.fighters[this.foeId]!;
  }

  /** How fast the match runs: slowed while a red circle falls, so a newcomer has time to see it and step. */
  pace(): number {
    return this.id === 'circle' && this.m.zones.some((z) => z.ab === SPAR_CIRCLE) ? 0.35 : 1;
  }

  /**
   * Where the sparring partner walks while it is only helping: over to the player for the lessons done on it (so a
   * newcomer isn't left crossing the whole ground), and within reach for what it does to them; never while they learn
   * to hide behind a pillar, or go for a sphere or the sigil.
   */
  foeMove(): MoveInput {
    const me = this.me;
    const foe = this.foe;
    const near = APPROACH[this.id];
    if (near !== undefined && (dist(me, foe) > near || !this.m.sees(foe, me))) return steerTo(this.m, foe, me.x, me.y);
    return { mx: 0, my: 0 };
  }

  /** The player chose someone (a click, a nameplate, Tab). */
  onTarget(id: number): void {
    if (id === this.foeId) this.targeted = true;
  }

  /** A step that is read, then passed with Next (a bar with no combo makes its step one of them). */
  readNow(): boolean {
    return READ.has(this.id) || (this.id === 'combo' && !this.combo());
  }

  /** Next, on a step that is read. */
  next(): void {
    if (this.readNow()) this.advance();
  }

  private say(note: string): void {
    this.note = note;
    this.noteT = 3.5;
  }

  private advance(note?: string): void {
    if (this.i >= this.steps.length - 1) return;
    this.i++;
    if (note) this.say(note);
    this.enter();
  }

  /** What a step sets up as it begins. */
  private enter(): void {
    const { m, me, foe } = this;
    switch (this.id) {
      case 'move':
        this.moved = 0;
        this.lastAt = { x: me.x, y: me.y };
        break;
      case 'target':
        this.targeted = false;
        break;
      case 'ability':
        this.uses = 0;
        break;
      case 'combo':
        this.combos0 = me.score.combos ?? 0;
        break;
      case 'circle':
        this.tries = 0;
        this.circleUp = false;
        this.wait = 0.6;
        break;
      case 'super':
        me.charge = 1;
        break;
      case 'sphere':
        me.hp = Math.round(me.maxHp * 0.45);
        for (const o of m.orbs) o.at = Math.min(o.at, m.clock);
        break;
      case 'sigil':
        m.sigilAt = m.clock;
        break;
      case 'pillar':
        this.hiddenT = 0;
        break;
      case 'holds':
        this.wait = 0.4;
        break;
      case 'gloam':
        // (let go of the clock where the Gloam begins: it closes in while this is read, and on through the last fight)
        m.hold = false;
        m.clock = Math.max(m.clock, CLOSE_FROM - 1);
        break;
      case 'fight':
        this.free = true;
        me.hp = me.maxHp;
        foe.hp = foe.maxHp;
        foe.cast = null;
        // (a gentle opponent: it hits for a little over half)
        foe.mods = { ...foe.mods, dmg: foe.mods.dmg * 0.6 };
        break;
      default:
        break;
    }
  }

  /** After each frame of the match, before its events are taken away: what was done, and what the lesson does next. */
  after(h: number): void {
    const { m, me, foe } = this;
    if (this.noteT > 0) {
      this.noteT -= h;
      if (this.noteT <= 0) this.note = '';
    }
    if (!this.free && m.phase === 'fight') {
      // (nobody falls while it teaches, and a caster never runs dry)
      foe.hp = Math.max(foe.hp, Math.round(foe.maxHp * 0.5));
      me.hp = Math.max(me.hp, Math.round(me.maxHp * 0.3));
      me.mana = me.maxMana;
    }
    const mine = (k: string): boolean => m.events.some((e) => e.k === k && 'id' in e && e.id === this.myId);
    switch (this.id) {
      case 'gates':
        if (m.phase === 'fight') this.advance();
        break;
      case 'move': {
        if (this.lastAt) this.moved += dist(me, this.lastAt);
        this.lastAt = { x: me.x, y: me.y };
        if (this.moved >= 45) this.advance('Good.');
        break;
      }
      case 'target':
        if (this.targeted) this.advance();
        break;
      case 'ability':
        this.uses += m.events.filter((e) => e.k === 'ab' && e.id === this.myId && me.bar.includes(e.ab)).length;
        if (this.uses >= 2) this.advance('Nice hits.');
        break;
      case 'combo':
        if (this.combo() && (me.score.combos ?? 0) > this.combos0) this.advance('Combo!');
        break;
      case 'circle':
        this.circle(h);
        break;
      case 'place':
        if (m.events.some((e) => e.k === 'ab' && e.id === this.myId && e.ab === this.placed?.id)) this.advance('Right on target.');
        break;
      case 'super':
        if (mine('super')) this.advance('That’s your super.');
        else me.charge = 1;
        break;
      case 'sphere':
        if (mine('orb')) this.advance('Healed.');
        // (a healer who heals up first is hurt again: the lesson is the sphere)
        else if (me.hp >= me.maxHp * 0.98) me.hp = Math.round(me.maxHp * 0.45);
        break;
      case 'sigil':
        if (mine('sigil')) this.advance('Sigil taken.');
        else if (!m.sigil && m.events.some((e) => e.k === 'sigil' && e.id === this.foeId)) m.sigilAt = m.clock;
        break;
      case 'pillar':
        this.hiddenT = m.sees(me, foe) ? 0 : this.hiddenT + h;
        if (this.hiddenT >= 0.4) this.advance('Hidden: they can’t aim at you now.');
        break;
      case 'holds':
        // (a cast to watch on their nameplate: their fire, now and then)
        this.wait -= h;
        if (this.wait <= 0 && !foe.cast) {
          foe.target = this.myId;
          m.press(this.foeId, SPAR_CAST);
          this.wait = 3;
        }
        break;
      default:
        break;
    }
  }

  /** The red circle: the comet comes down on the player, slowed, until they step out of it (or three have landed). */
  private circle(h: number): void {
    const { m, me } = this;
    const fell = m.events.find((e): e is Extract<MatchEvent, { k: 'zone' }> => e.k === 'zone' && e.ab === SPAR_CIRCLE);
    if (fell) {
      this.circleUp = false;
      if (dist(me, fell) > fell.r) {
        this.advance('Well dodged!');
        return;
      }
      this.tries++;
      if (this.tries >= 3) {
        this.advance('It takes practice. You’ll get it.');
        return;
      }
      this.say(`It hit you. Try again: ${this.keys?.touch ? 'tap the blue button' : `press ${this.keys?.dash ?? 'Space'}`} as soon as the circle appears.`);
      this.wait = 1.6;
      return;
    }
    if (this.circleUp) return;
    this.wait -= h;
    if (this.wait > 0) return;
    this.foe.charge = 1;
    if (m.press(this.foeId, SPAR_CIRCLE, { x: me.x, y: me.y }) === null) this.circleUp = true;
    else this.wait = 0.3;
  }

  /** The keys, as last asked for (the words of a retry use them). */
  private keys: TutorialKeys | null = null;

  /** The combo this player's bar can make, if any: what sets it up, and what lands it. */
  private combo() {
    const me = this.me;
    return barCombos(me.cls, me.bar, me.ult)[0] ?? null;
  }

  /** The words for the step as it stands. */
  view(keys: TutorialKeys): TutorialView {
    this.keys = keys;
    const me = this.me;
    const t = keys.touch;
    const keyOf = (ab: Ability): string => {
      if (ab.super) return t ? 'the gold button' : keys.super;
      const i = me.bar.indexOf(ab.id);
      return t ? `button ${i + 1}` : (keys.ab[i] ?? String(i + 1));
    };
    const melee = !RANGED.has(me.cls);
    const sup = ultOf(me.cls, me.ult);
    const stepKey = t ? 'the blue button' : keys.dash;
    const out = (title: string, text: string, spot: MatchSpot, short = ''): TutorialView => ({ id: this.id, n: this.i + 1, of: this.steps.length, title, text, short: this.readNow() ? '' : short, next: this.readNow(), spot, note: this.note });
    const press = (what: string): string => (t ? `Tap ${what}` : `Press ${what}`);
    switch (this.id) {
      case 'gates':
        return out('The entry', `Before every match you wait here behind the gates. You can still change your setup (Change my setup). When you’re ready, press I’m ready${t ? '' : ` or ${keys.dash}`}.`, 'prep');
      case 'plates':
        return out('Who’s who', 'You’re on the left, your sparring partner on the right. The bars show health (and a caster’s mana); holds and casts show under the names and over every fighter’s head.', 'plates');
      case 'move':
        return out('Move', t ? 'Move with your left thumb: put it down anywhere on the left side and push.' : 'Move with W A S D or the arrow keys. You can use abilities while you move.', null, t ? 'Push with your left thumb to move.' : 'Move with W A S D or the arrow keys.');
      case 'target':
        // (on a phone the ◎ button under the enemies' nameplates is there only with two or more of them: it is told of
        // here, where choosing is learned, as no sparring match has it to point at)
        return out('Choose your enemy', `${t ? 'Tap your sparring partner, or their nameplate on the right.' : `Click your sparring partner, click their nameplate on the right, or press ${keys.nextFoe}.`} Your attacks go to whoever is your target.${t ? ' Against two or more, a ◎ button comes up under their nameplates: tap it for the next enemy, or slide from it toward the one you want.' : ''}`, 'foes', t ? 'Tap your sparring partner or their nameplate.' : `Click them or their nameplate, or press ${keys.nextFoe}.`);
      case 'ability': {
        const first = ABILITIES[me.bar[0] ?? ''];
        const reach = melee ? (keys.closeIn ? ' You fight up close: press it from afar and you walk there by yourself.' : ' You fight up close, so walk right up to them first.') : ' You attack from range, so you can stay back.';
        return out('Use your abilities', `${t ? 'Tap the ability buttons on the right.' : `Press 1 to 5 (or click the buttons).`} Try ${first ? `${first.name} (${keyOf(first)})` : 'one'} and another.${reach} The dark sweep over a button is its cooldown.`, 'bar', `${t ? 'Tap two of your ability buttons' : 'Use two abilities: press 1 to 5'}${melee && keys.closeIn ? '. You walk up by yourself.' : '.'}`);
      }
      case 'combo': {
        const c = this.combo();
        if (!c) return out('Combos', 'Your bar has no combo yet. On the setup page, take an ability together with the one that sets it up.', 'bar');
        const friendly = c.from.aim === 'friend' || c.to.aim === 'friend' ? ' Here they go on you; in a team fight, on whoever you’re helping.' : '';
        return out('Land a combo', `${c.from.name} sets up ${c.to.name}. Use ${c.from.name} (${keyOf(c.from)}), then ${c.to.name} (${keyOf(c.to)}) for ${c.name}: it hits much harder. A button glows when its combo is ready.${friendly}`, 'bar', `Use ${c.from.name} (${keyOf(c.from)}), then ${c.to.name} (${keyOf(c.to)}): the second hits much harder.`);
      }
      case 'momentum':
        return out('Momentum', 'Land different combos one after another, each within 7 seconds of the last, to build Momentum up to ×4: harder combos and a faster super.', null);
      case 'circle':
        return out('Step out of red circles', `Look out! A red circle means an attack is about to land there (it’s slowed down for now). ${cap(t ? 'tap' : 'press')} ${stepKey} for your Swift Step to get out before it lands.`, 'step', `Red circle! ${press(stepKey)} to step out of it before it lands.`);
      case 'place': {
        const p = this.placed!;
        return out('Place an ability', `${p.name} lands on a patch of ground, like the comet did. ${t ? `Hold its button and push the circle where you want it, or just tap it to drop it on your target.` : `Press ${keyOf(p)}, then click where it should land. Press it twice to drop it on your target.`}`, 'bar', t ? `Hold ${p.name} and push its circle, or just tap it.` : `Press ${keyOf(p)}, then click where ${p.name} should land.`);
      }
      case 'super':
        return out('Your super', `Your super meter fills as you fight; we filled it for you. ${t ? 'Tap the gold button' : `Press ${keys.super}`} to unleash ${sup.name}: ${sup.text}${sup.aim === 'ground' ? (t ? ' Hold the button and push to place it.' : ' Click where it should land.') : ''}`, 'super', `Your super is full. ${press(t ? 'the gold button' : keys.super)} to unleash ${sup.name}.`);
      case 'sphere':
        return out('Healing spheres', 'You’re hurt. Green healing spheres rise around the arena: walk into one to get some health back. It rises again a little later.', null, 'You’re hurt: walk into a green healing sphere.');
      case 'sigil':
        return out('The sigil', 'A sigil rose in the middle of the arena. Run over it: it heals you, fills a third of your super and speeds you up. Grab it before your enemy does.', null, 'Run over the sigil in the middle of the arena.');
      case 'pillar':
        return out('Pillars block sight', 'Step behind a pillar so your sparring partner can’t see you. Nobody can aim at someone they can’t see, and a healer can’t reach a friend out of sight.', 'target', 'Hide behind a pillar so they can’t see you.');
      case 'holds':
        return out('Casts and holds', 'Watch their nameplate: a bar fills while they cast, and an interrupt cuts it off. Stuns, fears, roots and the like hold a fighter for a moment, and each one in a row lasts half as long.', 'foes');
      case 'friends':
        return out('Teammates', `In 2v2 and 3v3 your teammates’ nameplates sit under yours. ${t ? 'Tap one' : `Click one or press ${keys.nextFriend}`} to choose who your heals go to.${t ? ' In a team fight, the ◎ button under the enemies’ nameplates switches between them.' : ''}`, 'plates');
      case 'gloam':
        return out('The Gloam', 'Forty seconds in, the Gloam closes in from the edges and burns whoever stands in it, and healing weakens as a match goes on. Stay near the middle.', null);
      case 'fight':
        return out('Now, a real fight', 'Your sparring partner fights back now, gently. Use everything: combos, the Swift Step, your super, the spheres. Win it!', null, 'Win the fight! Use everything you’ve learned.');
    }
  }
}

