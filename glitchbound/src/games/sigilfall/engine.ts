import type { GameHost } from '../../platform/contract';
import { isMainQuest, turnInNpc } from './progress/handin';
import { rewardSummary } from './progress/rewards';
import { CLASSES } from './data/classes';
import { keyAffixes, weekOf } from './data/keystones';
import { NPCS, QUEST_DEFS } from './data/quests';
import { REGIONS, TIERS, type RiftMod } from './data/regions';
import { SKILLS } from './data/skills';
import type { ClassId, Item, RegionId, SkillIndex, SlotId, SlotKey } from './data/types';
import { KeyboardMouse, TouchState, type UiKey } from './input/input';
import { holds } from './sim/story';
import { acceptQuest, activeQuests, currentObjective, handInQuest, handInsFor, offeredBy, trackQuest, allItems, bagSize, HOME, chooseSpec, equip, learnedSkills, learnTalent, newCharacter, questState, respec, type Body, salvage, setSkill, startQuests, unequip, type Character } from './progress/character';
import { itemName } from './progress/items';
import { chooseMount, grantMounts, learnLooks, wearLook, type LookSlot } from './progress/wardrobe';
import { DEFAULT_SETTINGS, HERO_SLOTS, loadSave, writeSave, type LoadStatus, type SaveFile, type Settings } from './progress/save';
import { buyItem, buyPotions, restock } from './progress/shop';
import type { ShopId } from './data/vendors';
import { fxArt } from './render/art/atlas';
import { worldLook } from './render/art/world';
import { Renderer } from './render/renderer';
import { Sound, type MusicId } from './audio/sound';
import type { Interactable } from './sim/types';
import { emptyInput, World, type InputFrame } from './sim/world';
import { endScene } from './sim/scene';
import { applyPreset, PRESETS } from './progress/presets';
import { resetParagon, spendParagon, type ParaStat } from './progress/paragon';
import { CoopSession, type Role } from './net/coop';
import { Link, type LinkState } from './net/link';
import { COOP_LEVEL, type Card, type Mode, type View as PartyView } from './net/room';
import { heldWeapon, heroLook } from './render/sprites';
import { wornLooks } from './progress/wardrobe';

/**
 * The game around the simulation: heroes and the save, travelling between regions, expeditions
 * (reported to the arcade), the frame loop, sound, and the UI state the React layer shows.
 */

/** A quest page in a dialogue: one offered (Accept), one to hand in (Complete), one just paid (a talk quest). */
export interface DialoguePage {
  kind: 'offer' | 'handin' | 'paid';
  quest: string;
}

export type PanelId = 'hero' | 'wardrobe' | 'skills' | 'talents' | 'quests' | 'map' | 'settings' | 'shop' | 'party';

/** A co-op party (net/room.ts): the live connection, the room's latest view, and what went wrong. */
export interface PartyState {
  link: Link;
  view: PartyView | null;
  state: LinkState;
  error: string;
}

export interface Toast {
  id: number;
  text: string;
  sub?: string;
  tone: 'info' | 'good' | 'warn' | 'loot' | 'quest' | 'hint';
  item?: Item;
  until: number;
}

export interface RunSummary {
  region: RegionId;
  tier: number;
  xp: number;
  gold: number;
  kills: number;
  bosses: number;
  items: Item[];
  seconds: number;
  cleared: boolean;
  /** A Riftstone run's end: the stone run, the clock against the dungeon's, and the stone after it. */
  key?: { key: number; time: number; par: number; up: number; stone: number; best: boolean; marks: number; deaths: number };
}

export interface UiState {
  screen: 'title' | 'create' | 'game';
  createSlot: number;
  panel: PanelId | null;
  /** The shop that is open (with panel 'shop'), and the vendor keeping it. */
  shop: ShopId | null;
  shopNpc?: string;
  pause: boolean;
  /** Someone's lines, then their quest pages (one at a time: `i` counts the lines, then the pages). */
  dialogue: { npc: string; lines: string[]; i: number; pages: DialoguePage[] } | null;
  travel: { to: RegionId; label: string; locked: string | null } | null;
  toasts: Toast[];
  banner: { text: string; sub?: string; id: number } | null;
  death: boolean;
  reward: RunSummary | null;
  boss: { name: string; title: string } | null;
  levelUp: { level: number; skills: string[]; id: number } | null;
  /**
   * A control being taught (the Prologue's first fight): its key on the bar pulses, with these words over
   * the bar, until the hero uses it (`shown` is when it began) or the time runs out.
   */
  teach: { slot: SlotKey; text: string; shown: number; until: number } | null;
  /** The load went wrong in a way the player should know about. */
  notice: string;
}

const STEP = 1 / 60;

/** How long a party waits for a leader who dropped out (their game holds the enemies) before going home. */
const LEAD_WAIT_MS = 20_000;
/** Seconds a new hero sees the gate at dusk before the guard speaks. */
const GREET_AFTER = 1.4;

/** What the party's room answers, in words (net/room.ts act). */
const PARTY_ERRORS: Record<string, string> = {
  not_host: 'Only the party leader can do that.',
  no_plan: 'Choose a dungeon first.',
  no_hero: 'Everyone needs to pick a hero first.',
  level: `Every hero needs level ${COOP_LEVEL} for a Riftstone run.`,
  bad_card: 'Your hero could not be shown to the party.',
  full: 'That party is full, or already in a run.',
  not_lead: 'Only the hero leading the party can choose the way.',
};
/** On touch screens the hero stands this share of the view's width off the middle (render/renderer.ts frameShift). */
const FRAME_SHIFT = 0.1;

/** How long a toast stays (ms): loot and hints longer, to be read. */
const toastTime = (tone: Toast['tone']): number => (tone === 'loot' ? 5000 : tone === 'hint' ? 6000 : 3600);

export class SigilEngine {
  save: SaveFile;
  loadStatus: LoadStatus;
  /** False when saving would overwrite something we couldn't read (or storage is blocked). */
  canSave: boolean;
  slot = 0;
  hero: Character | null = null;
  world: World | null = null;
  readonly renderer: Renderer;
  readonly sound = new Sound();
  readonly touch = new TouchState();
  kbm: KeyboardMouse | null = null;
  ui: UiState;
  version = 0;
  private listeners = new Set<() => void>();
  /** Per-frame updaters (the HUD writes straight into the DOM). */
  readonly frameHooks = new Set<(w: World, e: SigilEngine) => void>();
  private host: GameHost;
  private raf = 0;
  private last = 0;
  private saveAt = 0;
  private autosaveAt = 0;
  private deathAt = 0;
  private rewardAt = 0;
  private nextToast = 1;
  /** Toasts wait while a dialogue is open (their time starts when it closes). */
  private toastsHeld = false;
  /** A banner waits out a scene (its time starts when the scene ends). */
  private bannerHeld = false;
  /** Seconds of the world in view before a new hero is greeted at the gate (0: no greeting due). */
  private greetIn = 0;
  /** The expedition under way: where, on which tier, and the stone's level for a Riftstone run (else 0). */
  private run: { start: number; region: RegionId; tier: number; mods: RiftMod[]; key: number } | null = null;
  private hidden = false;
  /** The co-op party this hero is in, and the run it is fighting (null playing alone). */
  party: PartyState | null = null;
  coop: CoopSession | null = null;
  /** The party's run this game last started (a new one in the room's view starts the next). */
  private partyRun = 0;
  /** An invite this page was opened with (?room=CODE): joined once a hero is chosen. */
  invite = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '') : '';
  /** Pause asked for by the arcade (left full screen, scrolled away). */
  private toWorldFn: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y });
  touchMode: boolean;
  /** The game is turned to landscape on a phone held upright (ui/turn.ts). */
  turned = false;
  dpr = 1;

  constructor(canvas: HTMLCanvasElement, host: GameHost, playerName: string) {
    this.host = host;
    this.renderer = new Renderer(canvas);
    // start fetching the packed art while the title screen shows: the first lands' looks and the spells
    worldLook('village');
    worldLook('forest');
    fxArt();
    const loaded = loadSave();
    this.save = loaded.save;
    this.loadStatus = loaded.status;
    // a first visit takes the device's reduced-motion setting
    if (loaded.status === 'new' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) this.save.settings.reducedMotion = true;
    this.canSave = loaded.status !== 'newer' && loaded.status !== 'blocked';
    this.touchMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.defaultName = playerName;
    this.ui = {
      screen: 'title',
      createSlot: 0,
      panel: null,
      shop: null,
      pause: false,
      dialogue: null,
      travel: null,
      toasts: [],
      banner: null,
      death: false,
      reward: null,
      boss: null,
      levelUp: null,
      teach: null,
      notice:
        loaded.status === 'recovered'
          ? 'Your last save could not be read, so your previous save was restored.'
          : loaded.status === 'reset'
            ? 'Your save could not be read and was set aside. Starting fresh.'
            : loaded.status === 'newer'
              ? 'This save is from a newer version of Sigilfall. Reload the page to continue it. Nothing will be saved until then.'
              : loaded.status === 'blocked'
                ? 'Your browser is blocking storage, so progress can’t be saved this time.'
                : '',
    };
    this.applySettings();
  }

  readonly defaultName: string;

  get settings(): Settings {
    return this.save.settings;
  }

  /* ------------------------------------------------------------ store */

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;
  bump(): void {
    this.version += 1;
    for (const fn of this.listeners) fn();
  }
  private setUi(patch: Partial<UiState>): void {
    this.ui = { ...this.ui, ...patch };
    this.bump();
  }

  /* ------------------------------------------------------------ lifecycle */

  attach(input: HTMLElement): void {
    this.kbm = new KeyboardMouse(input);
    this.kbm.ultKey = this.settings.ultKey;
    this.kbm.skill4Key = this.settings.skill4Key;
    this.kbm.onUi = (k) => this.uiKey(k);
    this.last = performance.now();
    const loop = (t: number): void => {
      this.raf = requestAnimationFrame(loop);
      this.frame(t);
    };
    this.raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    this.leaveParty();
    this.endRun(false);
    this.persist();
    this.kbm?.dispose();
    this.sound.dispose();
    this.renderer.dispose();
  }

  private onVisibility = (): void => {
    this.hidden = document.hidden;
    if (document.hidden) {
      this.persist();
      this.kbm?.release();
      this.touch.release();
      if (this.ui.screen === 'game' && !this.isPaused()) this.setUi({ pause: true });
    }
    this.sound.suspend(document.hidden || this.ui.pause);
  };

  private onPageHide = (): void => this.persist();

  /** The arcade asked for a pause (full screen left, scrolled away). */
  hostPause(): void {
    if (this.ui.screen === 'game' && !this.isPaused()) this.setUi({ pause: true });
    this.kbm?.release();
    this.touch.release();
  }

  setToWorld(fn: (x: number, y: number) => { x: number; y: number }): void {
    this.toWorldFn = fn;
  }

  isPaused(): boolean {
    const u = this.ui;
    return u.screen !== 'game' || u.pause || !!u.panel || !!u.dialogue || !!u.travel || u.death || !!u.reward || this.hidden;
  }

  /* ------------------------------------------------------------ the frame */

  private frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    // sound follows the pause, however it was left (the pause menu, a panel opened from it, the title): a
    // minimized game paused itself and used to come back silent
    this.sound.suspend(this.hidden || (this.ui.screen === 'game' && this.ui.pause));
    const w = this.world;
    if (!w || this.ui.screen !== 'game') {
      if (this.ui.screen !== 'game') this.sound.setMusic('title');
      return;
    }
    // in a co-op run the world never stops for a menu: the others are still fighting (the hero stands)
    const uiPaused = this.isPaused();
    // (and while a land's art loads, held dark, nothing moves in it)
    const paused = (uiPaused || this.renderer.waiting) && !(this.coop && !this.hidden);
    const f: InputFrame = emptyInput();
    if (!paused) {
      if (!uiPaused) {
        this.touch.fill(f);
        this.kbm?.fill(f, this.toWorldFn, w.player.x, w.player.y);
        // a control being taught is learned once it is used (after a moment to be seen), or its time is up
        const teach = this.ui.teach;
        if (teach) {
          const t = performance.now();
          const used = f.casts.some((c) => c.slot === teach.slot) || (teach.slot === 'basic' && !!f.holdBasic);
          // (and a scene's staging is no time for a lesson)
          if (t > teach.until || (used && t > teach.shown + 1500) || w.scene) this.setUi({ teach: null });
        }
      }
      // touch: aim with the stick when the mouse isn't in use
      if (this.touchMode) {
        f.aim = null;
        f.aimX = null;
        f.aimY = null;
      }
      // a scene playing: the hero's keys skip it (Space, Enter, a click or a tap on attack)
      if (w.scene) {
        if (f.interact || f.casts.some((c) => c.slot === 'dodge' || c.slot === 'basic')) endScene(w, true);
        f.casts = [];
        f.holdBasic = null;
        f.interact = false;
        f.mount = false;
      }
      for (const c of f.casts) if (c.angle !== null && this.touchMode) c.assist = this.settings.aimAssist;
      if (f.holdBasic && this.touchMode && f.holdBasic.angle !== null) f.holdBasic.assist = this.settings.aimAssist;
      let acc = dt;
      let first = true;
      let steps = 0;
      while (acc > 1e-6 && steps < 8) {
        const s = Math.min(acc, STEP);
        w.input = first ? f : { ...f, casts: [], potion: false, interact: false, mount: false };
        w.step(s);
        acc -= s;
        first = false;
        steps += 1;
      }
      if (this.hero) this.hero.stats.time += dt;
      if (this.greetIn > 0) {
        this.greetIn -= dt;
        if (this.greetIn <= 0 && this.hero && questState(this.hero, 'briar-dusk') === 'active' && w.region.id === HOME) this.talk('mara-venn');
      }
      this.coop?.frame(dt * 1000);
      if (this.leadAwayAt && performance.now() - this.leadAwayAt > LEAD_WAIT_MS) {
        this.leadAwayAt = 0;
        this.toast('Your party leader has been gone a while: the run is over.', 'warn');
        this.leaveCoopRun();
        if (!w.region.safe) this.travel(HOME, 0, []);
      }
      if (f.interact && w.interactable) this.interact(w.interactable);
      if (w.pendingExit) {
        const ex = w.pendingExit;
        w.pendingExit = null;
        this.interact(ex);
      }
    } else {
      this.kbm?.fill(emptyInput(), this.toWorldFn, w.player.x, w.player.y);
    }
    this.handleEvents(w);
    this.renderer.aim = paused ? null : this.touch.aim;
    this.renderer.touchMode = this.touchMode;
    this.renderer.frameShift = this.touchMode ? (this.settings.lefty ? -FRAME_SHIFT : FRAME_SHIFT) : 0;
    this.renderer.pointer = this.kbm?.view() ?? null;
    this.renderer.draw(w, paused ? 0 : dt, now / 1000);
    for (const fn of this.frameHooks) fn(w, this);
    // timers that run in real time
    const t = performance.now();
    if (this.deathAt && t > this.deathAt) {
      this.deathAt = 0;
      this.setUi({ death: true });
    }
    if (this.rewardAt && t > this.rewardAt) {
      this.rewardAt = 0;
      // the boss's loot is yours: collected now, so it shows on the reward screen
      this.collectLeftovers(w, false);
      this.setUi({ reward: this.summary(true) });
    }
    if (this.saveAt && t > this.saveAt) {
      this.saveAt = 0;
      this.persist();
    }
    if (t > this.autosaveAt) {
      this.autosaveAt = t + 20_000;
      if (!paused) this.persist();
    }
    // what happens while someone is talking, or a scene plays (the HUD stepped aside), waits until they have
    // finished: a toast behind them is missed
    if (this.ui.dialogue || w.scene) this.toastsHeld = true;
    else if (this.toastsHeld) {
      this.toastsHeld = false;
      this.setUi({ toasts: this.ui.toasts.map((x) => ({ ...x, until: t + toastTime(x.tone) })) });
    } else if (this.ui.toasts.some((x) => x.until < t)) this.setUi({ toasts: this.ui.toasts.filter((x) => x.until >= t) });
    // (and a banner, which a scene hides, shows in full once it is over)
    if (w.scene) this.bannerHeld = true;
    else if (this.bannerHeld) {
      this.bannerHeld = false;
      if (this.ui.banner) this.setUi({ banner: { ...this.ui.banner, id: t } });
    }
    if (this.ui.banner && !this.bannerHeld && t - this.ui.banner.id > 2600) this.setUi({ banner: null });
    if (this.ui.levelUp && t - this.ui.levelUp.id > 3600) this.setUi({ levelUp: null });
    const boss = w.boss();
    this.sound.setMusic(boss && !boss.dead ? 'boss' : ((w.storyState?.music ?? REGIONS[w.region.id].music) as MusicId));
  }

  private handleEvents(w: World): void {
    const events = w.events;
    if (!events.length) return;
    w.events = [];
    let changed = false;
    const newQuests: string[] = [];
    for (const ev of events) {
      switch (ev.t) {
        case 'sfx':
          this.sound.play(ev.id, ev.vol);
          break;
        case 'toast':
          this.toast(ev.text, ev.tone ?? 'info', ev.item);
          break;
        case 'loot':
          this.toast(itemName(ev.item), 'loot', ev.item);
          if (this.hero && !this.hero.opened.includes('hint:equip') && Object.keys(this.hero.equip).length < 2) this.hint('equip');
          break;
        case 'levelup': {
          this.refreshPartyCard();
          const h = this.hero!;
          const skills = [...learnedSkills(h), CLASSES[h.cls].ult].filter((id) => SKILLS[id]?.unlock === ev.level);
          this.ui = { ...this.ui, levelUp: { level: ev.level, skills, id: performance.now() } };
          changed = true;
          if (skills.includes(CLASSES[h.cls].ult)) this.hint('ult');
          break;
        }
        case 'questDone': {
          const q = QUEST_DEFS[ev.quest];
          if (q && this.hero && !q.quiet) this.toast(`Quest complete: ${q.name}`, 'quest', undefined, rewardSummary(this.hero, q) || q.reward.text);
          this.sound.play('questDone');
          break;
        }
        case 'questStep': {
          const q = QUEST_DEFS[ev.quest];
          if (q && this.hero) this.toast(`${q.name}: next`, 'quest', undefined, currentObjective(this.hero, q).label);
          this.sound.play('quest', 0.6);
          break;
        }
        case 'questReady': {
          const q = QUEST_DEFS[ev.quest];
          const who = q ? turnInNpc(q) : null;
          if (q && who) this.toast(`${q.name}: done`, 'quest', undefined, `Return to ${NPCS[who]?.name ?? 'them'}`);
          this.sound.play('questDone', 0.7);
          break;
        }
        case 'questStart':
          if (!QUEST_DEFS[ev.quest]?.quiet) newQuests.push(ev.quest);
          break;
        case 'bossStart': {
          const b = w.boss();
          if (b?.boss) this.ui = { ...this.ui, boss: { name: b.boss.def.name, title: b.boss.def.title }, banner: { text: b.boss.def.name, sub: b.boss.def.title, id: performance.now() } };
          changed = true;
          break;
        }
        case 'bossPhase':
          if (ev.banner) this.ui = { ...this.ui, banner: { text: ev.banner, id: performance.now() } };
          changed = true;
          break;
        case 'bossDown':
          this.ui = { ...this.ui, boss: null, banner: { text: 'Victory!', sub: `${w.region.name}`, id: performance.now() } };
          changed = true;
          break;
        case 'paragon':
          this.toast(`Paragon ${ev.level}`, 'good', undefined, 'A point to spend in the Hero panel');
          this.sound.play('levelup');
          break;
        case 'banner':
          this.ui = { ...this.ui, banner: { text: ev.text, sub: ev.sub, id: performance.now() } };
          changed = true;
          break;
        case 'death':
          this.deathAt = performance.now() + 1500;
          this.endBossBar();
          break;
        case 'cleared':
          this.rewardAt = performance.now() + 2800;
          break;
        case 'checkpoint':
          this.toast('Checkpoint reached · potions refilled', 'good');
          this.sound.play('checkpoint');
          this.scheduleSave(200);
          break;
        case 'hint':
          this.hint(ev.id);
          break;
        case 'save':
          this.scheduleSave(1200);
          changed = true;
          break;
        case 'scene':
          if (ev.playing) this.sound.play('scene');
          changed = true;
          break;
        case 'hero':
        case 'quest':
        case 'discover':
          changed = true;
          break;
        default:
          break;
      }
    }
    // mounts earned by what just happened (a quest's end, a dungeon cleared)
    if (this.hero) {
      for (const m of grantMounts(this.hero)) {
        this.toast(`New mount: ${m.name}`, 'good', undefined, this.touchMode ? 'Tap the horseshoe to ride. Choose mounts in the Wardrobe.' : 'Press Y to ride. Choose mounts in the Wardrobe.');
        this.sound.play('epic');
        changed = true;
      }
    }
    if (newQuests.length === 1) {
      const q = QUEST_DEFS[newQuests[0]!]!;
      this.toast(`New quest: ${q.name}`, 'quest', undefined, q.objective.label);
    } else if (newQuests.length > 1) this.toast(`${newQuests.length} new quests`, 'quest', undefined, newQuests.map((id) => QUEST_DEFS[id]!.name).join(' · '));
    if (changed) this.bump();
  }

  private endBossBar(): void {
    if (this.ui.boss) this.ui = { ...this.ui, boss: null };
  }

  toast(text: string, tone: Toast['tone'], item?: Item, sub?: string): void {
    const t: Toast = { id: this.nextToast++, text, tone, item, sub, until: performance.now() + toastTime(tone) };
    this.ui = { ...this.ui, toasts: [...this.ui.toasts.slice(-2), t] };
    this.bump();
  }

  dismissToast(id: number): void {
    this.setUi({ toasts: this.ui.toasts.filter((t) => t.id !== id) });
  }

  private hint(id: string): void {
    const h = this.hero;
    if (!h || h.opened.includes(`hint:${id}`)) return;
    h.opened.push(`hint:${id}`);
    const touch = this.touchMode;
    // the Prologue's first fight teaches by fighting (its waves ask for these): on the bar itself, the key lit
    if (id === 'attack' || id === 'skill' || id === 'dodge') {
      const slot: SlotKey = id === 'attack' ? 'basic' : id === 'skill' ? 's1' : 'dodge';
      const now = performance.now();
      this.setUi({ teach: { slot, text: this.teachText(id), shown: now, until: now + 10_000 } });
      return;
    }
    const text =
      id === 'equip'
        ? touch
          ? 'New gear! Tap the bag to look at it and equip it.'
          : 'New gear! Press I (or click the bag) to equip it.'
        : id === 'spec'
          ? touch
            ? 'Level 10: talents open! Tap the star to choose your specialization.'
            : 'Level 10: talents open! Press K to choose your specialization.'
          : id === 'ult'
            ? touch
              ? 'Ultimate unlocked! It charges as you deal damage: the big golden button.'
              : `Ultimate unlocked! It charges as you deal damage: press ${this.settings.ultKey === 'rmb' ? 'the right mouse button' : this.settings.ultKey.toUpperCase()}.`
            : id === 'potion'
              ? touch
                ? 'Low health! Tap the red potion.'
                : 'Low health! Press 1 to drink a potion.'
              : '';
    if (text) this.toast(text, 'hint');
  }

  /** The words over the bar for a control being taught (by input, and by what the skill costs). */
  private teachText(id: 'attack' | 'skill' | 'dodge'): string {
    const touch = this.touchMode;
    if (id === 'attack') return touch ? 'Tap the big button to strike: it aims for you' : 'Left-click to strike where the mouse points';
    if (id === 'dodge') return touch ? 'Tap Dodge as it draws: you pass through arrows and blows' : 'Space as it draws: you dodge through arrows and blows';
    const w = this.world;
    const skill = w?.build.bar.s1 ? SKILLS[w.build.bar.s1] : undefined;
    const name = skill?.name ?? 'your skill';
    const res = w?.build.resource;
    // rage and holy power are built by striking, not waiting: say so, or the first try says "not enough"
    const built = res && (res.kind === 'rage' || res.kind === 'holy') ? `: your strikes build the ${res.name} it costs` : '';
    return touch ? `Tap ${name}${built}` : `Q · ${name}${built}`;
  }

  /* ------------------------------------------------------------- saving */

  scheduleSave(ms: number): void {
    const at = performance.now() + ms;
    if (!this.saveAt || at < this.saveAt) this.saveAt = at;
  }

  persist(): void {
    if (!this.canSave) return;
    if (this.hero) {
      // whatever the hero carries now, its look is theirs for good
      learnLooks(this.hero, allItems(this.hero));
      this.hero.updated = Date.now();
      this.save.heroes[this.slot] = this.hero;
      this.save.last = this.slot;
    }
    if (!writeSave(this.save)) {
      if (!this.ui.notice) this.setUi({ notice: 'Progress could not be saved (storage is full or blocked).' });
    }
  }

  setSettings(patch: Partial<Settings>): void {
    this.save.settings = { ...this.save.settings, ...patch };
    this.applySettings();
    this.scheduleSave(400);
    this.bump();
  }

  private applySettings(): void {
    const s = this.settings;
    this.sound.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
    this.renderer.reducedMotion = s.reducedMotion;
    if (this.kbm) {
      this.kbm.ultKey = s.ultKey;
      this.kbm.skill4Key = s.skill4Key;
    }
    if (this.world) this.world.settings = s;
  }

  resetSettings(): void {
    this.setSettings({ ...DEFAULT_SETTINGS, rotateSeen: this.settings.rotateSeen });
  }

  /* ------------------------------------------------------------- heroes */

  newHeroScreen(slot: number): void {
    this.setUi({ screen: 'create', createSlot: slot });
  }

  createHero(slot: number, cls: ClassId, name: string, body: Body = 'm'): void {
    const c = newCharacter(cls, name || this.defaultName, `hero${slot}`, Date.now(), body);
    this.save.heroes[slot] = c;
    this.persist();
    this.play(slot);
  }

  deleteHero(slot: number): void {
    this.save.heroes[slot] = null;
    if (this.save.last === slot) this.save.last = this.save.heroes.findIndex((h) => h) >= 0 ? this.save.heroes.findIndex((h) => h) : 0;
    this.persist();
    this.bump();
  }

  play(slot: number): void {
    const h = this.save.heroes[slot];
    if (!h) return;
    this.slot = slot;
    this.hero = h;
    this.save.last = slot;
    this.ui = { ...this.ui, screen: 'game', panel: null, pause: false, dialogue: null, travel: null, death: false, reward: null, boss: null, toasts: [], teach: null };
    this.travel(HOME, 0, []);
    this.sound.unlock();
    // invited by a link: into the friend's party (its panel says if this hero can't run with it)
    if (this.invite) {
      const code = this.invite;
      this.invite = '';
      this.joinParty(code);
      this.ui = { ...this.ui, panel: 'party' };
      try {
        const url = new URL(location.href);
        url.searchParams.delete('room');
        history.replaceState(history.state, '', url);
      } catch {
        /* no history (tests) */
      }
    }
    // a brand-new hero arrives at Briarhollow's gate at dusk, and the guard stops them there: once the gate
    // can be seen (its art in, a moment to look), not over a dark screen
    this.greetIn = questState(h, 'briar-dusk') === 'active' && h.level === 1 && h.stats.time < 1 ? GREET_AFTER : 0;
    this.bump();
  }

  toTitle(): void {
    this.greetIn = 0;
    this.leaveParty();
    this.endRun(false);
    this.persist();
    this.world = null;
    this.hero = null;
    this.setUi({ screen: 'title', panel: null, pause: false, dialogue: null, travel: null, death: false, reward: null, boss: null, toasts: [], levelUp: null, banner: null, teach: null });
  }

  /* ------------------------------------------------------------- travel */

  travel(to: RegionId, tier: number, mods: RiftMod[], from?: RegionId, key = 0, party?: { role: Role; seed: number; week: number }): void {
    const h = this.hero;
    if (!h) return;
    const region = REGIONS[to];
    // a party's run goes where the host chose: a friend who hasn't found the way yet is taken along
    if (!h.unlocked.includes(to) && !party) return;
    // a Riftstone run is a stone the hero holds (never above it; a party runs the host's), in a dungeon
    if (key > 0 && (region.kind !== 'dungeon' || (key > h.keystone && !party))) return;
    // questing together the party travels as one: the leader's way is everyone's, the others follow
    if (this.coop && !party && this.party?.view?.mode === 'party' && this.party.view.phase === 'run') {
      if (this.coop.role === 'host') this.party.link.send({ t: 'go', region: to, tier: region.safe ? 0 : tier });
      else this.toast('You travel with your party’s leader. Leave the party to go your own way.', 'info');
      return;
    }
    // leaving a party's run (home, the way out): the others go on without this hero
    if (this.coop && !party) this.leaveCoopRun();
    const prev = this.world;
    if (prev) this.collectLeftovers(prev, true);
    // expeditions: leaving the village starts one, coming back ends it; a Riftstone run is always its own
    if (region.safe) this.endRun(true);
    else if (key > 0) {
      this.endRun(false);
      this.startRun(to, 2, [], key);
    } else if (!this.run) this.startRun(to, tier, mods, 0);
    else {
      // the stone is for the dungeon it was set in: walking out ends that run
      if (this.run.key && to !== this.run.region) this.run.key = 0;
      this.run.region = to;
    }
    const stone = this.run?.key ?? 0;
    const keepTier = this.run ? this.run.tier : tier;
    const w = new World({
      region: to,
      tier: region.safe ? 0 : keepTier,
      mods: region.safe ? [] : (this.run?.mods ?? mods),
      hero: h,
      settings: this.settings,
      seed: party ? party.seed : (Math.random() * 2 ** 32) >>> 0,
      from,
      ...(stone ? { key: stone, affixes: keyAffixes(stone, party ? party.week : weekOf(Date.now())) } : {}),
      ...(party ? { coop: party.role } : {}),
    });
    if (party) this.coop?.attach(w);
    if (prev && !prev.region.safe && this.run) {
      // carry this expedition's tallies across regions
      w.run = prev.run;
    }
    if (prev) {
      w.player.ult = prev.player.ult;
      w.player.ultBudget = prev.player.ultBudget;
    }
    // riding on from one open land to the next (never into a dungeon)
    if (prev?.player.riding && region.kind !== 'dungeon' && !region.interior && h.mounts.includes(prev.player.riding)) w.player.riding = prev.player.riding;
    // the quests of a land start when the hero first gets there
    for (const q of startQuests(h)) w.emit({ t: 'questStart', quest: q.id });
    this.world = w;
    this.renderer.snap(w);
    const sub = region.safe ? region.subtitle : w.keyRun ? `Riftstone +${w.keyRun.key} · the clock is running` : `${region.subtitle}${w.tier ? ` · ${TIERS[w.tier]!.name}` : ''}`;
    this.ui = { ...this.ui, panel: null, travel: null, dialogue: null, boss: null, death: false, reward: null, banner: { text: region.name, sub, id: performance.now() } };
    this.persist();
    this.bump();
  }

  private startRun(region: RegionId, tier: number, mods: RiftMod[], key: number): void {
    this.run = { start: performance.now(), region, tier, mods, key };
    if (this.hero) this.hero.stats.runs += 1;
    this.host.report({ type: 'start' });
  }

  /** Loot still lying in a region goes with the hero (it is never left behind by leaving). */
  private collectLeftovers(w: World, leaving: boolean): void {
    const got = w.collectAll();
    if (got.items > 0 && this.hero) {
      const over = this.hero.bag.length > bagSize(this.hero);
      this.toast(`${leaving ? 'Picked up' : 'Collected'} ${got.items} item${got.items === 1 ? '' : 's'} ${leaving ? 'you left behind' : 'from the fight'}`, 'loot', undefined, over ? 'Your bag is over-full: salvage or wear something to pick up more.' : undefined);
    }
    if (got.salvaged > 0) this.toast(`Your bag was full: the rest became ${got.salvaged} gold`, 'warn');
  }

  private summary(cleared: boolean): RunSummary {
    const w = this.world;
    const r = w?.run ?? { xp: 0, gold: 0, kills: 0, bosses: 0, items: [] };
    const k = w?.keyRun;
    const key = k?.end ? { key: k.key, time: k.end.time, par: k.par, up: k.end.up, stone: k.end.stone, best: k.end.best, marks: k.end.marks, deaths: k.deaths } : undefined;
    return { region: this.run?.region ?? w?.region.id ?? 'emberwick', tier: this.run?.tier ?? 0, xp: r.xp, gold: r.gold, kills: r.kills, bosses: r.bosses, items: r.items, seconds: this.run ? (performance.now() - this.run.start) / 1000 : 0, cleared, ...(key ? { key } : {}) };
  }

  /** An expedition ends (home, or the game closes): its score goes to the arcade. */
  private endRun(toast: boolean): void {
    if (!this.run || !this.hero) {
      this.run = null;
      return;
    }
    const s = this.summary(false);
    // a Riftstone level beaten in time is worth the most: higher stones climb the board
    const score = Math.round(s.xp + s.gold * 2 + s.bosses * 250 + (s.key && s.key.up > 0 ? s.key.key * 1000 : 0));
    this.hero.stats.bestRun = Math.max(this.hero.stats.bestRun, score);
    // a review hero (jumped to a story beat) plays for looking, not for the leaderboard
    if (!this.hero.review) this.host.report({ type: 'end', score, stats: { level: this.hero.level, kills: s.kills, bosses: s.bosses, ...(this.hero.para.l ? { paragon: this.hero.para.l } : {}), ...(s.key ? { mythicPlus: s.key.up > 0 ? s.key.key : 0 } : {}) } });
    // the vendors have new stock when you come back
    restock(this.hero);
    if (toast && (s.kills || s.items.length)) this.toast(`Expedition over: +${s.xp} XP, +${s.gold} gold`, 'good', undefined, `${s.kills} foes defeated${s.items.length ? ` · ${s.items.length} items` : ''}`);
    this.run = null;
  }

  /** Talk, travel or leave, depending on what is in front of the hero. */
  interact(it: Interactable): void {
    if (it.kind === 'npc') this.talk(it.id);
    else if (it.kind === 'waystone') this.openPanel('map');
    else if (it.kind === 'exit' && it.door && !it.locked && this.world) {
      // a door: straight through, no question asked
      const w = this.world;
      if (this.hero && !this.hero.unlocked.includes(it.to as RegionId)) this.hero.unlocked.push(it.to as RegionId);
      this.sound.play('open');
      this.travel(it.to as RegionId, w.tier, w.mods, w.region.id);
    } else if (it.kind === 'exit') {
      this.kbm?.release();
      this.touch.release();
      // the art of the land ahead starts loading while the road sign is read
      worldLook(REGIONS[it.to as RegionId].theme);
      this.setUi({ travel: { to: it.to as RegionId, label: it.label, locked: it.locked } });
    }
  }

  confirmTravel(): void {
    const t = this.ui.travel;
    const w = this.world;
    if (!t || !w) return;
    if (t.locked) {
      this.setUi({ travel: null });
      return;
    }
    // walking there is how a new land is found (its waystone then works for travel)
    if (this.hero && !this.hero.unlocked.includes(t.to)) this.hero.unlocked.push(t.to);
    this.travel(t.to, w.tier, w.mods, w.region.id);
  }

  cancelTravel(): void {
    this.setUi({ travel: null });
  }

  /* ----------------------------------------------------------- dialogue */

  talk(npcId: string): void {
    const npc = NPCS[npcId];
    const h = this.hero;
    if (!npc || !h) return;
    const entry = npc.talk.find((t) => !t.when || holds(h, { quest: t.when.quest, is: t.when.state })) ?? npc.talk[npc.talk.length - 1]!;
    // a message delivered, a question asked: talking is the objective (and its hand-in)
    const wasDone = new Set(Object.keys(h.quests).filter((id) => h.quests[id]!.state === 'done'));
    const spoke = activeQuests(h).some((q) => { const o = currentObjective(h, q); return o.kind === 'talk' && o.npc === npcId; });
    this.world?.questProgress((o) => o.kind === 'talk' && o.npc === npcId);
    const paid = Object.keys(h.quests).filter((id) => h.quests[id]!.state === 'done' && !wasDone.has(id) && QUEST_DEFS[id]!.objective.kind !== 'tutorial');
    // then what they take back, and what they ask (each a page of its own: Complete, Accept)
    const pages: DialoguePage[] = [...paid.map((quest) => ({ kind: 'paid' as const, quest })), ...handInsFor(h, npcId).map((q) => ({ kind: 'handin' as const, quest: q.id })), ...offeredBy(h, npcId).map((q) => ({ kind: 'offer' as const, quest: q.id }))];
    // what they say first: always when the talk was the point; otherwise only when there is nothing to hand over
    const lines = spoke || !pages.length ? [...entry.lines] : [];
    this.kbm?.release();
    this.touch.release();
    this.sound.play(pages.length ? 'quest' : 'open');
    this.setUi({ dialogue: { npc: npcId, lines, i: 0, pages } });
  }

  /** The dialogue's page now: a line (null) or a quest page. */
  dialoguePage(): DialoguePage | null {
    const d = this.ui.dialogue;
    return d && d.i >= d.lines.length ? (d.pages[d.i - d.lines.length] ?? null) : null;
  }

  nextLine(): void {
    const d = this.ui.dialogue;
    if (!d) return;
    if (d.i + 1 < d.lines.length + d.pages.length) this.setUi({ dialogue: { ...d, i: d.i + 1 } });
    else this.setUi({ dialogue: null });
  }

  /** Takes the quest on the page now; on to the next page. */
  acceptOffer(): void {
    const page = this.dialoguePage();
    const h = this.hero;
    if (!h || page?.kind !== 'offer') return;
    const q = acceptQuest(h, page.quest);
    if (q) {
      this.world?.emit({ t: 'questStart', quest: q.id });
      const started = startQuests(h);
      started.forEach((s) => this.world?.emit({ t: 'questStart', quest: s.id }));
      this.world?.creditEarly([q, ...started]);
      this.sound.play('quest');
      this.persist();
    }
    this.nextLine();
  }

  /** Hands in the quest on the page now: the reward, and whatever the giver has next joins the pages. */
  completeHandIn(): void {
    const page = this.dialoguePage();
    const h = this.hero;
    const d = this.ui.dialogue;
    if (!h || !d || page?.kind !== 'handin') return;
    const q = handInQuest(h, page.quest);
    if (q) this.world?.completeQuests([q]);
    const known = new Set(d.pages.map((p) => p.quest));
    const more = offeredBy(h, d.npc).filter((x) => !known.has(x.id)).map((x) => ({ kind: 'offer' as const, quest: x.id }));
    this.persist();
    this.setUi({ dialogue: { ...d, pages: [...d.pages, ...more] } });
    this.nextLine();
  }

  closeDialogue(): void {
    this.setUi({ dialogue: null });
  }

  /** Follows a quest with the arrow and the tracker (null: back to the story's own order). */
  trackQuest(id: string | null): void {
    if (!this.hero) return;
    trackQuest(this.hero, id);
    this.persist();
    this.bump();
  }

  /* -------------------------------------------------------------- panels */

  openPanel(p: PanelId): void {
    if (this.ui.screen !== 'game' || this.ui.death || this.ui.reward) return;
    this.kbm?.release();
    this.touch.release();
    this.sound.play('open');
    this.setUi({ panel: p, pause: false, dialogue: null });
  }

  /** A vendor's shop. */
  openShop(shop: ShopId, npc?: string): void {
    if (this.ui.screen !== 'game' || this.ui.death || this.ui.reward) return;
    this.kbm?.release();
    this.touch.release();
    this.sound.play('open');
    this.setUi({ panel: 'shop', shop, shopNpc: npc, pause: false, dialogue: null });
  }

  buy(shop: ShopId, uid: string): Item | null {
    if (!this.hero) return null;
    const item = buyItem(this.hero, shop, uid);
    if (!item) return null;
    this.sound.play('buy');
    this.persist();
    this.bump();
    return item;
  }

  buyPotions(n: number): number {
    if (!this.hero) return 0;
    const got = buyPotions(this.hero, n);
    if (got) {
      this.sound.play('buy');
      this.persist();
      this.bump();
    }
    return got;
  }

  closePanel(): void {
    this.sound.play('close');
    this.setUi({ panel: null });
  }

  togglePause(): void {
    if (this.ui.screen !== 'game') return;
    if (this.ui.panel) return this.closePanel();
    if (this.ui.dialogue) return this.closeDialogue();
    if (this.ui.travel) return this.cancelTravel();
    this.kbm?.release();
    this.touch.release();
    this.setUi({ pause: !this.ui.pause });
    this.sound.suspend(this.ui.pause);
  }

  private uiKey(k: UiKey): void {
    if (this.ui.screen !== 'game' || this.ui.death || this.ui.reward) return;
    if (k === 'pause') return this.togglePause();
    if (this.ui.panel === k) return this.closePanel();
    this.openPanel(k);
  }

  /* ----------------------------------------------- hero changes from the UI */

  private changed(sound = 'equip'): void {
    this.world?.rebuild();
    this.refreshPartyCard();
    if (this.world && this.hero) this.renderer.setHeroWeapon(this.hero.cls, this.world);
    this.sound.play(sound);
    this.scheduleSave(300);
    this.bump();
  }

  equipItem(uid: string): boolean {
    if (!this.hero || !equip(this.hero, uid)) return false;
    this.changed('equip');
    return true;
  }

  unequipSlot(slot: SlotId): boolean {
    if (!this.hero || !unequip(this.hero, slot)) return false;
    this.changed('equip');
    return true;
  }

  salvageItem(uid: string): number {
    if (!this.hero) return 0;
    const g = salvage(this.hero, uid);
    if (g) this.changed('coin');
    return g;
  }

  markSeen(uid: string): void {
    const h = this.hero;
    if (!h) return;
    const it = h.bag.find((i) => i.uid === uid);
    if (it?.fresh) {
      delete it.fresh;
      this.scheduleSave(2000);
      this.bump();
    }
  }

  learn(id: string): boolean {
    if (!this.hero || !learnTalent(this.hero, id)) return false;
    this.changed('talent');
    return true;
  }

  resetTalents(): boolean {
    if (!this.hero || !respec(this.hero)) return false;
    this.changed('reset');
    return true;
  }

  /** Takes (or changes) the specialization. */
  chooseSpec(tree: 0 | 1 | 2): boolean {
    if (!this.hero || !chooseSpec(this.hero, tree)) return false;
    this.changed('levelup');
    const def = CLASSES[this.hero.cls];
    const spec = def.trees[tree];
    const shape = spec.formOnly ? def.forms?.find((f) => f.specSwap?.tree === tree) : undefined;
    this.toast(`${spec.name}: ${SKILLS[spec.skill]?.name ?? ''} learned${shape ? ` (in ${shape.name})` : ''}`, 'good');
    return true;
  }

  assignSkill(slot: SkillIndex, id: string | null): void {
    if (!this.hero || !setSkill(this.hero, slot, id)) return;
    this.changed('click');
  }

  drinkPotion(): void {
    this.world?.drinkPotion();
    this.bump();
  }

  /** Review presets are offered on the dev server and with `?review` in the address. */
  get reviewTools(): boolean {
    return import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('review'));
  }

  /** Jumps the hero to a story beat (progress/presets.ts) and takes them there. */
  usePreset(id: string): void {
    const p = PRESETS.find((x) => x.id === id);
    if (!p || !this.hero || !this.reviewTools) return;
    applyPreset(this.hero, p);
    this.world?.rebuild();
    this.ui = { ...this.ui, panel: null, pause: false };
    this.travel(p.region, 0, []);
    this.toast(`Review: ${p.label}`, 'info', undefined, 'This hero now plays for review and sends no arcade scores.');
    this.refreshPartyCard();
  }

  /** Skips the scene playing (its walks end where they were going). */
  skipScene(): void {
    if (this.world?.scene) endScene(this.world, true);
    this.bump();
  }

  /** The mount button: call the mount, or get down. */
  toggleMount(): void {
    this.world?.toggleMount();
    this.bump();
  }

  /** Wears a Wardrobe look over a slot (null: the equipped item's own look). */
  wearLook(slot: LookSlot, id: string | null): boolean {
    if (!this.hero || !wearLook(this.hero, slot, id)) return false;
    this.changed('equip');
    return true;
  }

  /** Chooses the mount the mount key calls (and swaps it at once if riding). */
  chooseMount(id: string): boolean {
    const h = this.hero;
    if (!h || !chooseMount(h, id)) return false;
    if (this.world?.player.riding) this.world.player.riding = id;
    this.changed('equip');
    return true;
  }

  /* ------------------------------------------------------- death, rewards */

  respawn(): void {
    const w = this.world;
    if (!w) return;
    w.respawn();
    this.renderer.snap(w);
    this.setUi({ death: false, boss: null });
    this.persist();
  }

  /* ------------------------------------------------------------ co-op */

  /** This hero as the party sees them (net/room.ts Card): drawn from it, nothing else. */
  partyCard(): Card | null {
    const h = this.hero;
    if (!h) return null;
    const worn = wornLooks(h);
    const story = Object.entries(h.quests).filter(([id, e]) => e.state === 'done' && isMainQuest(id)).length;
    return { name: h.name, cls: h.cls, level: h.level, para: h.para.l, keystone: h.keystone, story, look: heroLook(h.cls, h.equip, worn, h.body), weapon: heldWeapon(h.cls, h.equip.weapon, worn.weapon) };
  }

  /** The card the party last got from this game (sent again only when it changes). */
  private cardSent = '';

  /** Tells the party how this hero looks now (a new level, new gear). */
  refreshPartyCard(force = false): void {
    const party = this.party;
    const card = this.partyCard();
    if (!party || !card || !party.link.open) return;
    const json = JSON.stringify(card);
    if (!force && json === this.cardSent) return;
    this.cardSent = json;
    party.link.send({ t: 'card', card });
  }

  /** Whether this hero can start a party for a Riftstone run (and why not). */
  partyReady(): string {
    const h = this.hero;
    if (!h) return 'Choose a hero first.';
    if (h.level < COOP_LEVEL) return `Riftstone runs with friends are for heroes at level ${COOP_LEVEL}.`;
    if (h.keystone < 1) return 'Clear Duskspire on Mythic to earn the Riftstone first.';
    return '';
  }

  /** Opens a new party room and joins it (the host): for a Riftstone run, or questing together. */
  async createParty(mode: Mode = 'rift'): Promise<void> {
    if (this.party || !this.hero || (mode === 'rift' && this.partyReady())) return;
    this.modeWanted = mode;
    try {
      const link = await Link.create(this.hero!.name, this.partyHandlers());
      this.party = { link, view: null, state: 'connecting', error: '' };
    } catch (e) {
      this.toast((e as Error).message || 'Could not open a party right now.', 'warn');
    }
    this.bump();
  }

  /** Joins a friend's party by its code. */
  joinParty(code: string): void {
    const c = code.trim().toUpperCase();
    if (!this.hero || !/^[A-Z]{4,6}$/.test(c)) return;
    this.leaveParty();
    this.party = { link: new Link(c, this.hero.name, this.partyHandlers()), view: null, state: 'connecting', error: '' };
    this.bump();
  }

  leaveParty(): void {
    if (!this.party) return;
    if (this.coop) this.leaveCoopRun();
    this.party.link.close();
    this.party = null;
    this.partyRun = 0;
    this.bump();
  }

  /** The host's choice: which dungeon, which Riftstone level (kept until the room is there to take it). */
  setPartyPlan(region: RegionId, key: number): void {
    const party = this.party;
    if (!party) return;
    if (party.link.open && party.view) party.link.send({ t: 'plan', region, key });
    else this.planWanted = { region, key };
  }

  private planWanted: { region: RegionId; key: number } | null = null;
  /** The mode a new party is opened for (sent once the room is there). */
  private modeWanted: Mode | null = null;

  /** The leader switches what the party does (in the lobby). */
  setPartyMode(mode: Mode): void {
    this.party?.link.send({ t: 'mode', mode });
  }

  /** The host starts the run: everyone's game goes there together. */
  startPartyRun(): void {
    this.party?.link.send({ t: 'start', week: weekOf(Date.now()) });
  }

  kickFromParty(n: number): void {
    this.party?.link.send({ t: 'kick', n });
  }

  private partyHandlers() {
    return {
      onView: (v: PartyView) => this.onPartyView(v),
      onRelay: (n: number, d: unknown) => this.coop?.receive(n, d),
      onState: (st: LinkState, reason?: string) => {
        if (!this.party) return;
        this.party.state = st;
        if (st === 'open') this.refreshPartyCard(true);
        if (st === 'gone') {
          this.toast(reason ?? 'The party has closed.', 'warn');
          this.leaveParty();
        }
        this.bump();
      },
      onError: (message: string) => {
        if (!this.party) return;
        this.party.error = PARTY_ERRORS[message] ?? message;
        this.bump();
      },
    };
  }

  private onPartyView(v: PartyView): void {
    const party = this.party;
    if (!party) return;
    party.view = v;
    party.error = '';
    const me = v.seats.find((x) => x.you);
    // the room lost this hero's card (it was kicked and came back, or never got it): send it again
    if (me && !me.card) this.refreshPartyCard(true);
    if (this.modeWanted && v.you === v.host && v.phase === 'lobby') {
      if (v.mode !== this.modeWanted) party.link.send({ t: 'mode', mode: this.modeWanted });
      this.modeWanted = null;
    }
    if (this.planWanted && v.you === v.host && v.phase === 'lobby') {
      party.link.send({ t: 'plan', ...this.planWanted });
      this.planWanted = null;
    }
    const members = v.seats.filter((x) => x.card && x.online).map((x) => ({ n: x.n, card: x.card! }));
    const role: Role = v.you === v.lead ? 'host' : 'guest';
    if (v.phase === 'run' && v.run !== this.partyRun && (v.plan || v.mode === 'party')) {
      // the run started: everyone goes, together (questing, where the leader's game says)
      this.partyRun = v.run;
      this.partyTrip = -1;
      this.coop = new CoopSession(role, v.you, v.lead, (d) => party.link.relay(d));
      this.coop.setMembers(members);
      this.setUi({ panel: null, reward: null, death: false, dialogue: null, travel: null, pause: false });
      if (v.mode === 'rift' && v.plan) {
        this.travel(v.plan.region as RegionId, 2, [], undefined, v.plan.key, { role, seed: v.runSeed, week: v.week });
        this.toast(role === 'host' ? 'The party is in: the clock is running' : 'Your party leader has started the run', 'good');
      } else {
        const lead = v.seats.find((x) => x.n === v.lead);
        this.toast(role === 'host' ? 'You lead the party: everyone follows you, in your story' : `Questing with ${lead?.card?.name ?? lead?.name ?? 'your party'}: you follow them, in their story`, 'good');
        // the leader says where the party starts: here
        if (role === 'host' && this.world) party.link.send({ t: 'go', region: this.world.region.id, tier: this.world.tier });
      }
    } else if (this.coop) {
      const lead = v.seats.find((x) => x.n === this.coop!.host);
      if (v.phase !== 'run' || !lead) {
        // the run ended (the leader went home, or left the party): back to town, still in the party
        const why = !lead ? 'Your party leader left: the run is over.' : '';
        this.leaveCoopRun();
        if (why) this.toast(why, 'warn');
        if (this.world && !this.world.region.safe) this.travel(HOME, 0, []);
      } else {
        this.coop.setMembers(members);
        // a leader who dropped out is waited for a while (their game holds the enemies)
        this.leadAwayAt = lead.online ? 0 : this.leadAwayAt || performance.now();
      }
    }
    // questing together: the leader went somewhere; every game follows
    if (this.coop && v.mode === 'party' && v.phase === 'run' && v.plan && v.trip !== this.partyTrip) {
      this.partyTrip = v.trip;
      this.travel(v.plan.region as RegionId, v.plan.key, [], this.world?.region.id, 0, { role: this.coop.role, seed: v.runSeed + v.trip, week: v.week });
    }
    this.bump();
  }

  /** Questing together: the leader's travels this game has followed. */
  private partyTrip = -1;
  /** When the leader dropped out of the room (0: they are here). */
  private leadAwayAt = 0;

  /** This hero leaves the party's run (the host's leaving ends it for everyone). */
  private leaveCoopRun(): void {
    const c = this.coop;
    if (!c) return;
    this.coop = null;
    if (this.world) this.world.coop = null;
    if (c.role === 'host') this.party?.link.send({ t: 'end' });
  }

  returnHome(): void {
    this.setUi({ death: false, reward: null });
    this.travel(HOME, 0, []);
  }

  closeReward(): void {
    this.setUi({ reward: null });
  }

  /** From a Riftstone run's end: the same dungeon again, at the stone the hero holds now. */
  keyAgain(): void {
    const w = this.world;
    const h = this.hero;
    if (!w || !h || !w.keyRun?.end || h.keystone < 1) return;
    this.travel(w.region.id, 2, [], undefined, h.keystone);
  }

  /** A Paragon point into a line (the Hero panel). */
  paragonPoint(stat: ParaStat, n = 1): boolean {
    if (!this.hero || !spendParagon(this.hero.para, stat, n)) return false;
    this.changed('talent');
    return true;
  }

  /** Every Paragon point back (free). */
  paragonReset(): void {
    if (!this.hero) return;
    resetParagon(this.hero.para);
    this.changed('reset');
  }

  /** Heroes in the save, for the title screen. */
  heroes(): (Character | null)[] {
    const out: (Character | null)[] = [];
    for (let i = 0; i < HERO_SLOTS; i++) out.push(this.save.heroes[i] ?? null);
    return out;
  }
}
