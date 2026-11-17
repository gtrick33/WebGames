import { CLASSES } from '../data/classes';
import type { ClassId } from '../data/types';
import { ABILITIES, barCombos, PRESETS, ultOf, type Ability, type BarCombo } from './abilities';
import { steerTo } from './bot';
import { CLASS_EASE, EASE_WORD } from './styles';
import { RANGED, type FighterSetup, type Match, type MatchEvent, type MatchSetup, type MoveInput } from './sim';

/**
 * The Ring's tutorial (the owner, 2026-11-14: "for the practice match, replace it with 'tutorial' where its not a ranked
 * match but rather an explanation for newcomers, make sure everything is shown during a tutorial match please, from
 * character selection, to customizing, to targeting, combos etc").
 *
 * Short, and everything shown at once (the owner, 2026-11-15: a shorter tutorial, but "show everything initially, i
 * dont want stage by stage unlocking new ui element tutorials"). Each screen it stops on has every part of it labeled
 * together (`labels`: a word pinned to each element marked `data-tut`, RingCoach useLabels), and what can't be pointed
 * at (what happens in the arena) is said on the same card. Then only what has to be done by hand is done by hand.
 *
 * In the lobby (LOBBY_STEPS, shown by RingScreen): the main screen, labeled: the class and its playstyles; the rest of
 * the setup on it, labeled; and the layer where the fight to find is chosen, labeled.
 * Then a match against a sparring partner (TutorialRun, driven by RingMatch): the entry, the fight's screen labeled
 * with the arena's rules beside it, then moving, choosing a target, abilities, a combo, walking out of a red circle,
 * placing an ability (if the bar has one), the super, and last a real fight that a newcomer can win. Nothing in it is
 * rated.
 *
 * While it teaches, the match's clock is held (Match.hold), the sparring partner only does what the lesson needs, and
 * neither side can fall. The last fight starts the clock from where it stood, at the start, as a match does.
 *
 * And while it teaches, only what a step is about can be used (the owner, 2026-11-16: "during the tutorial, i suggest
 * you block the buttons unless what the tutorial points you to press, i could open different tabs and the tutorial
 * keeps the text and theres bugs"). In the lobby a step names the parts of the page that work while it is read
 * (`allow`: RingCoach useTutLock makes everything else inert); in the match a step says which of the bar's buttons it
 * takes (`TutorialRun.allows`), and the setup can't be changed from the gates. The tutorial's own Back, Next and Skip
 * always work, and so does leaving.
 */

/** A word pinned to whatever on the screen is marked `data-tut="<spot>"`, all of a step's at once. */
export interface TutLabel {
  spot: string;
  text: string;
  /** Pinned at the right of its element's top edge, where that is the emptier end (the left by default). */
  right?: boolean;
}

export interface LobbyStep {
  id: string;
  title: string;
  text: (cls: ClassId) => string;
  /** What is lit while it's read (a `data-tut` mark on the page), if anything. */
  spot: string | null;
  /** Every part of the page this step names, labeled together. */
  labels?: readonly TutLabel[];
  /** The parts of the page (their `data-tut` marks) that can be used while this step is read: nothing else can. */
  allow: readonly string[];
  /** The lobby's main screen: everything about the hero is on it (2026-11-17), the room with friends is not taught. */
  page: 'play';
  /** A layer over it opened while the step is read: the fight to find (ui/RingScreen.tsx PlayLayer). */
  layer?: 'play';
  /** Where the words sit, so they don't cover what they talk about. */
  at: 'top' | 'bottom' | 'side';
}

export const LOBBY_STEPS: readonly LobbyStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to the Ring',
    text: (cls) => `Short fights, 1v1 to 3v3. Everything about your hero is on this screen: pick a class, then one of its two playstyles. ${CLASSES[cls].name}: ${EASE_WORD[CLASS_EASE[cls]].toLowerCase()} to learn.${CLASS_EASE[cls] === 'easy' ? '' : ' The Warrior is an easy first pick.'}`,
    spot: null,
    labels: [
      { spot: 'classes', text: 'Your class' },
      { spot: 'styles', text: 'Its two playstyles', right: true },
      { spot: 'fight', text: 'Your fight' },
      { spot: 'go', text: 'Find a match', right: true },
    ],
    // (a class and a playstyle may be chosen; the way on is the tutorial's own Next)
    allow: ['classes', 'styles'],
    page: 'play',
    at: 'side',
  },
  {
    id: 'kit',
    title: 'Your setup',
    text: () => 'Point at any icon, or tap it, to read what it does. Your abilities are fixed. What you choose is the talents: one from each row, and they change how your combo works. All of it is saved as you go.',
    spot: null,
    labels: [
      { spot: 'bar', text: 'Your four and your super' },
      { spot: 'combos', text: 'Its combos', right: true },
      { spot: 'talents', text: 'Talents: pick one a row' },
      { spot: 'read', text: 'What it does', right: true },
    ],
    allow: ['styles', 'bar', 'combos', 'talents'],
    page: 'play',
    // (at the side, under the box that reads the icons: along the bottom it lay over the talents it asks to be chosen)
    at: 'side',
  },
  {
    id: 'fight',
    title: 'Your fight',
    text: () => 'Press the fight at the foot of the screen to choose another. 1v1, 2v2 and 3v3 each have a rating of their own, and climbing one earns titles and armor. Any arena is fine. Now, a practice fight.',
    spot: null,
    labels: [
      { spot: 'formats', text: 'A rating each' },
      { spot: 'rank', text: 'Your rank: titles and armor', right: true },
      { spot: 'progress', text: 'Daily challenges and more', right: true },
      { spot: 'arena', text: 'Arena: Any is fine', right: true },
    ],
    allow: ['formats'],
    page: 'play',
    layer: 'play',
    at: 'side',
  },
];

/** The sparring partner: a mage, whose comet is the red circle to step out of and whose fire is the cast to watch. */
export const SPARRING_CLASS: ClassId = 'mage';
const SPAR_PRESET = PRESETS.mage[0]!;
/** Its circle and its cast, by id. */
const SPAR_CIRCLE = 'm-super';
/** How far from the player the circle's middle is put: they stand inside it, nearer one edge (world px). */
export const CIRCLE_OFF = 38;
/** The arena it's taught in: open, with pillars to hide behind. */
export const TUTORIAL_MAP = 'sands';
/** Long enough to read the entry's words and press "ready". */
export const TUTORIAL_GATES = 120;

/** The practice match: the player as they set themselves up, against the sparring partner. */
export function tutorialSetup(me: FighterSetup, seed: number): MatchSetup {
  const spar: FighterSetup = { team: 1, cls: SPARRING_CLASS, name: 'Sparring Partner', bar: [...SPAR_PRESET.bar], talents: [...SPAR_PRESET.talents], ult: SPAR_PRESET.ult };
  return { seed, map: TUTORIAL_MAP, fighters: [{ ...me, team: 0, human: true }, spar], gates: TUTORIAL_GATES };
}

export type MatchStepId = 'gates' | 'screen' | 'move' | 'target' | 'ability' | 'combo' | 'circle' | 'place' | 'super' | 'fight';

/** What a match step lights up on the screen. */
export type MatchSpot = 'prep' | 'plates' | 'foes' | 'target' | 'bar' | 'super' | null;

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
  /** Every part of the fight's screen, labeled together (the step that shows the screen). */
  labels?: readonly TutLabel[];
  /** A word about how the last try went ("Well dodged!"). */
  note: string;
}

/** The fight's screen, every part of it named at once. */
export const MATCH_LABELS: readonly TutLabel[] = [
  { spot: 'plates', text: 'You' },
  { spot: 'foes', text: 'Enemies: health, cast, holds' },
  { spot: 'clock', text: 'Clock · healing fades' },
  { spot: 'target', text: 'Your target' },
  { spot: 'bar', text: 'Your abilities' },
  { spot: 'super', text: 'Super: fills as you fight' },
];

/** How hard the sparring partner hits in the last fight, and when the player is under half health (it eases off). */
export const SPAR_DMG = 0.5;
export const SPAR_DMG_LOW = 0.3;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** How near the sparring partner comes to the player in each step that has it come at all. */
const APPROACH: Partial<Record<MatchStepId, number>> = { target: 170, ability: 90, combo: 90, circle: 120, place: 140, super: 90 };

/** Steps read and then passed with Next; the rest are passed by doing them. */
const READ: ReadonlySet<MatchStepId> = new Set(['screen']);

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
  private tries = 0;
  /** How long the last fight has gone on. */
  fightT = 0;
  /** What the sparring partner's blows were worth before the last fight eased them. */
  private baseDmg = 1;
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
    this.steps = ['gates', 'screen', 'move', 'target', 'ability', 'combo', 'circle', ...(this.placed ? (['place'] as const) : []), 'super', 'fight'];
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
   * newcomer isn't left crossing the whole ground), and within reach for what it does to them.
   */
  foeMove(): MoveInput {
    const me = this.me;
    const foe = this.foe;
    // (for a combo set up by what lands round its user, a snare of frost, near enough to be caught in it)
    const from = this.id === 'combo' ? this.combo()?.from : undefined;
    const near = from?.aim === 'near' ? Math.max(24, from.range - 16) : APPROACH[this.id];
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

  /**
   * Whether the lesson takes this button now. What a step isn't about stays shut until its own step: no abilities
   * while the screen is read or moving and choosing are learned, the four but not the super while abilities, a combo,
   * the circle and placing are, the super alone on its step, and everything in the last fight.
   */
  allows(abId: string): boolean {
    const ab = ABILITIES[abId];
    const sup = !!ab?.super || abId === this.me.ult;
    switch (this.id) {
      case 'gates':
      case 'screen':
      case 'move':
      case 'target':
        return false;
      case 'ability':
      case 'combo':
      case 'circle':
      case 'place':
        return !sup;
      case 'super':
        return sup;
      default:
        return true;
    }
  }

  /** What a shut button says when it is pressed. */
  shutWhy(): string {
    return this.id === 'super' ? 'Your super first: the tutorial is showing it' : this.id === 'gates' ? 'Press I’m ready first' : 'Not yet: the tutorial gets to that next';
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
      case 'fight':
        // (a match of its own from here: the clock goes on from where it was held, the start, so healing weakens from
        // thirty-five seconds in, as in any match)
        this.free = true;
        m.hold = false;
        me.hp = me.maxHp;
        me.charge = 0;
        foe.hp = foe.maxHp;
        foe.charge = 0;
        foe.cast = null;
        this.fightT = 0;
        // (a gentle opponent: it hits for half, and less again while the player is hurt, so that a newcomer's first
        // fight is one they can win)
        this.baseDmg = foe.mods.dmg;
        foe.mods = { ...foe.mods, dmg: this.baseDmg * SPAR_DMG };
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
      // (nobody falls while it teaches)
      foe.hp = Math.max(foe.hp, Math.round(foe.maxHp * 0.5));
      me.hp = Math.max(me.hp, Math.round(me.maxHp * 0.3));
    }
    if (this.free && m.phase === 'fight') {
      this.fightT += h;
      foe.mods.dmg = this.baseDmg * (me.hp < me.maxHp * 0.5 ? SPAR_DMG_LOW : SPAR_DMG);
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
      this.say('It hit you. Try again: start walking out as soon as the circle appears.');
      this.wait = 1.6;
      return;
    }
    if (this.circleUp) return;
    this.wait -= h;
    if (this.wait > 0) return;
    this.foe.charge = 1;
    // (a little toward the sparring partner, not on the player's middle: with no Swift Step since 2026-11-15, a circle is
    // left by walking, and the near edge is in walking reach before it lands)
    const away = Math.sign(this.foe.x - me.x) || 1;
    if (m.press(this.foeId, SPAR_CIRCLE, { x: me.x + away * CIRCLE_OFF, y: me.y }) === null) this.circleUp = true;
    else this.wait = 0.3;
  }

  /**
   * The combo this player's playstyle is taught: the points it builds and spends, if it has them; else the first ability
   * that lands harder on a target another has set up; else whatever its abilities make together.
   */
  private combo(): BarCombo | null {
    const me = this.me;
    const all = barCombos(me.cls, me.bar, me.ult).filter((c) => !c.from.veiled && !c.from.super && !c.to.super);
    return all.find((c) => c.kind === 'points') ?? all.find((c) => c.kind === 'combo') ?? all[0] ?? null;
  }

  /** The words for the step as it stands. */
  view(keys: TutorialKeys): TutorialView {
    const me = this.me;
    const t = keys.touch;
    const keyOf = (ab: Ability): string => {
      if (ab.super) return t ? 'the gold button' : keys.super;
      const i = me.bar.indexOf(ab.id);
      return t ? `button ${i + 1}` : (keys.ab[i] ?? String(i + 1));
    };
    const melee = !RANGED.has(me.cls);
    const sup = ultOf(me.cls, me.ult);
    const out = (title: string, text: string, spot: MatchSpot, short = ''): TutorialView => ({ id: this.id, n: this.i + 1, of: this.steps.length, title, text, short: this.readNow() ? '' : short, next: this.readNow(), spot, note: this.note });
    const press = (what: string): string => (t ? `Tap ${what}` : `Press ${what}`);
    switch (this.id) {
      case 'gates':
        return out('The entry', `Before every match you wait here behind the gates. In a real match you can still change your setup here. When you’re ready, press I’m ready${t ? '' : ` or ${keys.dash}`}.`, 'prep');
      case 'screen':
        return {
          ...out(
            'Your screen',
            'Every part of it is labeled. In the arena: a red circle is an attack about to land, so keep moving and walk out of it. Green spheres heal you. The sigil in the middle heals and fills a third of your super. Pillars block sight: nobody aims at what they can’t see. Stuns and roots get shorter each time in a row (the chips by the nameplates). Healing weakens as a match goes on, until none is left.',
            null,
          ),
          labels: MATCH_LABELS,
        };
      case 'move':
        return out('Move', t ? 'Move with your left thumb: put it down anywhere on the left side and push.' : 'Move with W A S D or the arrow keys. You can use abilities while you move.', null, t ? 'Push with your left thumb to move.' : 'Move with W A S D or the arrow keys.');
      case 'target':
        // (on a phone the ◎ button over the top-right ability is there only with two or more of them: it is told of
        // here, where choosing is learned, as no sparring match has it to point at)
        return out('Choose your enemy', `${t ? 'Tap your sparring partner, or their nameplate on the right.' : `Click your sparring partner, click their nameplate on the right, or press ${keys.nextFoe}.`} Your attacks go to whoever is your target.${t ? ' Against two or more, a ◎ button comes up over your top-right ability: tap it for the next enemy, or slide from it toward the one you want.' : ''}`, 'foes', t ? 'Tap your sparring partner or their nameplate.' : `Click them or their nameplate, or press ${keys.nextFoe}.`);
      case 'ability': {
        const first = ABILITIES[me.bar[0] ?? ''];
        const reach = melee ? (keys.closeIn ? ' You fight up close: press it from afar and you walk there by yourself.' : ' You fight up close, so walk right up to them first.') : ' You attack from range, so you can stay back.';
        return out('Use your abilities', `${t ? 'Tap the ability buttons on the right.' : `Press 1 to 4 (or click the buttons).`} Try ${first ? `${first.name} (${keyOf(first)})` : 'one'} and another.${reach} The dark sweep over a button is its cooldown.`, 'bar', `${t ? 'Tap two of your ability buttons' : 'Use two abilities: press 1 to 4'}${melee && keys.closeIn ? '. You walk up by yourself.' : '.'}`);
      }
      case 'combo': {
        const c = this.combo();
        if (!c) return out('Combos', 'A button glows when it is at its strongest. Your talents say how your combo is made.', 'bar');
        if (c.kind === 'points') return out('Land a combo', `${c.from.name} builds ${c.name}, and ${c.to.name} spends them all: the more it spends, the harder it hits. Use ${c.from.name} (${keyOf(c.from)}) three times, then ${c.to.name} (${keyOf(c.to)}). The pips over your bar count them, and ${c.to.name} glows when they are full.`, 'bar', `Use ${c.from.name} (${keyOf(c.from)}) three times, then ${c.to.name} (${keyOf(c.to)}).`);
        const friendly = c.from.aim === 'friend' || c.to.aim === 'friend' ? ' Here they go on you; in a team fight, on whoever you’re helping.' : '';
        return out('Land a combo', `${c.from.name} sets up ${c.to.name}. Use ${c.from.name} (${keyOf(c.from)}), then ${c.to.name} (${keyOf(c.to)}) for ${c.name}: it hits much harder. A button glows when its combo is ready.${friendly}`, 'bar', `Use ${c.from.name} (${keyOf(c.from)}), then ${c.to.name} (${keyOf(c.to)}): the second hits much harder.`);
      }
      case 'circle':
        return out('Walk out of red circles', 'Look out! A red circle means an attack is about to land there (it’s slowed down for now). Walk out of it before it lands: the nearest edge is the quickest way.', null, 'Red circle! Walk out of it before it lands.');
      case 'place': {
        const p = this.placed!;
        return out('Place an ability', `${p.name} lands on a patch of ground, like the comet did. ${t ? `Hold its button and push the circle where you want it, or just tap it to drop it on your target.` : `Press ${keyOf(p)}, then click where it should land. Press it twice to drop it on your target.`}`, 'bar', t ? `Hold ${p.name} and push its circle, or just tap it.` : `Press ${keyOf(p)}, then click where ${p.name} should land.`);
      }
      case 'super':
        return out('Your super', `Your super meter fills as you fight; we filled it for you. ${t ? 'Tap the gold button' : `Press ${keys.super}`} to unleash ${sup.name}: ${sup.text}${sup.aim === 'ground' ? (t ? ' Hold the button and push to place it.' : ' Click where it should land.') : ''}`, 'super', `Your super is full. ${press(t ? 'the gold button' : keys.super)} to unleash ${sup.name}.`);
      case 'fight':
        return out('Now, a real fight', `Your sparring partner fights back now, gently. Use everything: combos, your super, the spheres. In a team fight, your teammates’ nameplates sit under yours: ${t ? 'tap one' : `click one or press ${keys.nextFriend}`} to choose who your heals go to.${t ? ' In a team fight, the ◎ button over your top-right ability switches between them.' : ''} Win it!`, null, 'Win the fight! Use everything you’ve learned.');
    }
  }
}

