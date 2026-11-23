import { mixFor } from './audio/mix';
import { rankEntries } from './progress/ranks';
import { readBests } from './vigil/bests';
import { stoneIn, stonesOf, trialHero, trialsOpen, trialStone } from './progress/trial';
import { ambienceOf } from './audio/ambience';
import type { GameHost } from '../../platform/contract';
import { isRetired } from './data/retired';
import { reportOrders, waitingOrders } from '../../platform/sigilfallOrders';
import { sigilfallShop, watchSigilfallShop } from '../../platform/sigilfallShop';
import { setShopGoods } from './progress/shopGoods';
import { account, api } from '../../platform/account';
import { classOpen, heroSlots } from './progress/paidClasses';
import { applyOrder, orderToast } from './progress/gm';
import { announceGm } from './progress/gmArrival';
import { isMainQuest, questSteps, turnInNpc } from './progress/handin';
import { questRewards, rewardSummary, type RewardLine } from './progress/rewards';
import { ACTS, type ActDef } from './data/acts';
import { TALES } from './data/chronicle';
import { CLASSES, MAX_LEVEL } from './data/classes';
import { keyAffixes, weekOf } from './data/keystones';
import { WARDENS } from './data/wardens';
import { NPCS, QUEST_DEFS } from './data/quests';
import { REGIONS, TIERS, type RiftMod } from './data/regions';
import { SKILLS } from './data/skills';
import type { ClassId, Item, RegionId, SigilId, SkillIndex, SlotId, SlotKey } from './data/types';
import { KeyboardMouse, TouchState, type UiKey } from './input/input';
import { holds } from './sim/story';
import { SIGILS, abandonQuest, acceptQuest, activeQuests, currentObjective, handInQuest, handInsFor, offeredBy, trackQuest, allItems, bagSize, HOME, chooseSpec, cantEquip, equip, learnedSkills, learnTalent, newCharacter, questState, respec, swapPick, type Body, type Face, salvage, setSkill, startQuests, unequip, type Character } from './progress/character';
import { itemName } from './progress/items';
import { compareGear } from './progress/compare';
import { canRide, chooseMount, FIRST_RIDE, grantMounts, grantWarden, hasMount, setShelfPoints, syncRift, learnLooks, wearLook, type LookSlot } from './progress/wardrobe';
import { DEFAULT_SETTINGS, loadSave, writeSave, type LoadStatus, type SaveFile, type Settings } from './progress/save';
import { buyItem, buyPotions, restock } from './progress/shop';
import { wager } from './progress/rift';
import { chooseTitle, newTitles, setGivenTitles, titled, titleShown } from './progress/titles';
import { bestRating } from './arena/ranks';
import type { ShopId } from './data/vendors';
import { iconsReady } from './render/art/gameIcons';
import { Renderer } from './render/renderer';
import { setDangerTone } from './render/effects';
import { paceStride } from './render3d/pace';
import { actionLabel, codeMap, resolveBinds, type CampAction } from './input/binds';
import { Sound, type MusicId } from './audio/sound';
import { Steps } from './audio/steps';
import { voiceSound } from './audio/voice';
import type { Interactable } from './sim/types';
import { emptyInput, World, type InputFrame } from './sim/world';
import { advanceScene, endScene, previewScene, sceneDue } from './sim/scene';
import { SCENES } from './data/scenes';
import { applyPreset, PRESETS } from './progress/presets';
import { claimInvites, friendsApi } from '../../platform/friends';
import type { FriendInvite, FriendsView } from '../../platform/apiTypes';
import { resetParagon, spendParagon, type ParaStat } from './progress/paragon';
import { CoopSession, type Role } from './net/coop';
import { Link, type LinkState } from './net/link';
import { COOP_LEVEL, MAX_PLAYERS, type Card, type Mode, type View as PartyView } from './net/room';
import { heldWeapon, heroLook } from './render/sprites';
import { wornLooks } from './progress/wardrobe';
import { giveTips, tipDue, tipShown, tipSteps, type TipId, type TipStep } from './progress/tips';
import { SPEC_LEVEL } from './data/talents';
import { track } from '../../platform/analytics';
import { counted, fallProps, stopProps } from './progress/telemetry';

/**
 * The game around the simulation: heroes and the save, travelling between regions, expeditions
 * (reported to the arcade), the frame loop, sound, and the UI state the React layer shows.
 */

/**
 * A page of the story, over the world (ui/StoryPages.tsx): the narrator's telling as an act begins, a letter or a relic
 * found, the Sigil Rite, or what came of a quest done out in the world. The world waits while one is read, and no scene
 * starts while one is waiting, so the tale is told in its order (the owner: "i do a dungeon and suddenly in my inventory
 * tab i see 4/7 sigils"; and a quest's ending, written in its reward, was never shown when it paid out by itself).
 */
export type StoryPage = { kind: 'tale'; act: string } | { kind: 'find'; quest: string } | { kind: 'sigil'; sigil: SigilId } | { kind: 'deed'; quest: string };

/** A quest page in a dialogue: one offered (Accept), one to hand in (Complete), one just paid (a talk quest). */
export interface DialoguePage {
  kind: 'offer' | 'handin' | 'paid';
  quest: string;
}

/** (`shop` is a vendor's, for gold; `store` is the game's own shop for the things sold for money: ui/Store.tsx) */
export type PanelId = 'hero' | 'wardrobe' | 'skills' | 'talents' | 'quests' | 'map' | 'settings' | 'shop' | 'party' | 'store' | 'rift';

/** A co-op party (net/room.ts): the live connection, the room's latest view, and what went wrong. */
export interface PartyState {
  link: Link;
  view: PartyView | null;
  state: LinkState;
  error: string;
  /** What last happened to the party, in words (shown at the top of its panel until the next). */
  note: string;
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
   * On a touch screen, a piece just picked up that is better for this hero as they play (progress/compare.ts): a small
   * card asks whether to wear it now (ui/EquipAsk.tsx). `id` is when it came up; it goes by itself after a while.
   */
  equipAsk?: { uid: string; id: number } | null;
  /**
   * A quest just finished, as one card (POLISH_PLAN.md piece 10): its name, what it paid (the items it gave, as they
   * are), and the quest it opened. Before, the same moment was three pieces of news one over another.
   */
  questCard: { quest: string; name: string; lines: RewardLine[]; items: Item[]; next: string | null; id: number } | null;
  /**
   * A control being taught (the Prologue's first fight): its key on the bar pulses, with these words over
   * the bar, until the hero uses it (`shown` is when it began) or the time runs out.
   */
  /** A control being taught: a skill's slot, or (on touch) the potion, with a pointer over its button. */
  teach: { slot: SlotKey | 'potion'; text: string; shown: number; until: number } | null;
  /** A hint of the first-timer's tutorial on the screen (the game waits for it, as for a menu). */
  tip: { id: TipId; step: number; spell?: string } | null;
  /** The load went wrong in a way the player should know about. */
  notice: string;
  /**
   * A title over the world: an act beginning, or a land seen for the first time (`id` is when it came up).
   */
  card: TitleCard | null;
  /** A page of the story being read (StoryPage): the world waits for it. */
  story: StoryPage | null;
}

export interface TitleCard {
  /** Small, over the title: "Act II", "Wilds · levels 18–24". */
  over: string;
  text: string;
  sub?: string;
  /** An act's (the screen darkens behind it), else a land's. */
  act: boolean;
  id: number;
}

const STEP = 1 / 60;
/** How long a way taken (a door, a road out of a land) takes to go dark before the next place is made (ms). */
const LEAVE_MS = 260;

/** How long a party waits for a leader who dropped out (their game holds the enemies) before going home. */
const LEAD_WAIT_MS = 20_000;
/** Seconds a new hero sees the gate at dusk before the guard speaks. */
const GREET_AFTER = 1.4;
/** A page of the story (a letter found, a sigil won, what a quest came to) waits this long after the last blow given or taken... */
export const PAGE_AFTER_BLOWS = 1.5;
/** ...and this long more of calm: a breath after the moment, never in the middle of a fight. */
export const PAGE_BREATH = 0.6;
/** How long a title card holds the screen (ms): an act's, a land's. */
const ACT_CARD_MS = 4200;
/** How long after a quest's reward its hint waits (ms): the quest's own toasts are read first. */
const TIP_AFTER_REWARD = 2600;
const LAND_CARD_MS = 3400;

/** What the party's room answers, in words (net/room.ts act). */
const PARTY_ERRORS: Record<string, string> = {
  not_host: 'Only the party leader can do that.',
  no_plan: 'Choose a dungeon first.',
  no_hero: 'Everyone needs to pick a hero first.',
  level: `Every hero needs level ${COOP_LEVEL} for a Riftstone run.`,
  bad_card: 'Your hero could not be shown to the party.',
  full: `That party is full (${MAX_PLAYERS} of ${MAX_PLAYERS}).`,
  in_run: 'That party is in a Riftstone run. Try again when they’re back in town.',
  bad_plan: 'That dungeon or Riftstone level can’t be chosen.',
  not_lead: 'Only the hero leading the party can choose the way.',
  not_lobby: 'Heroes can be changed in the party’s lobby, between runs.',
};
/** On touch screens the hero stands this share of the view's width off the middle (render/renderer.ts frameShift). */
const FRAME_SHIFT = 0.1;

/** When the game looks for game masters' orders (and when the player comes back to the tab: ui/Arrival.tsx). */
const GM_FIRST_MS = 6_000;
const GM_EVERY_MS = 60_000;
/**
 * How often the game asks whether a friend wants this player (platform/friends.ts). Asking also tells friends the
 * player is here, in Sigilfall. Often enough that an invitation feels like it arrived, cheap enough to keep up: one
 * small request, and nothing while the tab is hidden.
 */
const SOCIAL_FIRST_MS = 4_000;
const SOCIAL_EVERY_MS = 8_000;
/** How long a friend's row says "Invited" after asking them. */
export const ASKED_MS = 60_000;
/** Why a friend's code didn't work, in the Friends page's own words (src/pages/FriendsPage.tsx). */
const FRIEND_ERRORS: Record<string, string> = {
  unknown_code: 'That code doesn’t work. Check it with your friend.',
  own_code: 'That’s your own code.',
  too_many: 'That friends list is full.',
  sign_in: 'Sign in to add friends.',
};

/** How long a toast stays (ms): loot and hints longer, to be read. */
const toastTime = (tone: Toast['tone']): number => (tone === 'loot' ? 5000 : tone === 'hint' ? 6000 : 3600);


/** Shorter than this, with nothing earned, a trip out is not reported as a round (the arcade's shortest is 20 s). */
const MIN_ROUND = 20;

/** A hero's state without its save stamp, to tell whether anything changed since the last save. */
const heroSignature = (h: Character): string => JSON.stringify({ ...h, updated: 0 });

/** The Riftstone a world's run finished, for the report (none while it is still under way). */
function keyResult(w: World): RunSummary['key'] | undefined {
  const k = w.keyRun;
  return k?.end ? { key: k.key, time: k.end.time, par: k.par, up: k.end.up, stone: k.end.stone, best: k.end.best, marks: k.end.marks, deaths: k.deaths } : undefined;
}
/** How long the card asking to wear a better piece stays up, unanswered (ms). */
const EQUIP_ASK_MS = 9000;
/** How long a finished quest's card stays up (ms). */
const QUEST_CARD_MS = 5200;

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
  /** The hero's footsteps, counted stride by stride (audio/steps.ts). */
  private readonly steps = new Steps();
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
  /** Title cards waiting for their moment (no one talking, no scene, no panel open). */
  private cards: Omit<TitleCard, 'id'>[] = [];
  /** Pages of the story waiting for their moment (StoryPage), in the order the tale tells them. */
  private pages: StoryPage[] = [];
  /** How long (s) the world has been calm enough for the next page, and how long the next page has waited at all. */
  private pageCalm = 0;
  /** The page up was opened from the Journal (closing it goes back there). */
  private storyFromPanel = false;
  /** Is the page up one read again from the Journal (not just found)? */
  get rereading(): boolean {
    return this.storyFromPanel;
  }
  /** The expedition under way: where, on which tier, and the stone's level for a Riftstone run (else 0). */
  /** The expedition under way; `keyEnd`: the Riftstone it finished, kept when the hero walks out of its dungeon. */
  /** The hero as last stamped (heroSignature): persist() bumps `updated` only when it differs. */
  private heroSig = '';
  /** The run being played; `story` once any of it was played on Story difficulty (it then stays off the leaderboard). */
  private run: { start: number; region: RegionId; tier: number; mods: RiftMod[]; key: number; keyEnd?: RunSummary['key']; story?: boolean } | null = null;
  private hidden = false;
  /** The quest the map was last opened for (MapPanel picks its land when it opens: takeMapQuest). */
  private mapQuest: string | null = null;
  /** The co-op party this hero is in, and the run it is fighting (null playing alone). */
  party: PartyState | null = null;
  /**
   * The player's friends on the site, as the party panel shows them (ui/Friends.tsx): who is online, and who is in
   * this game. Asked for when the panel opens and kept fresh while it is open; a guest has none. `asked` is when
   * each friend was last invited from here.
   */
  friends: { view: FriendsView | null; state: 'idle' | 'loading' | 'ready' | 'offline'; asked: Record<string, number> } = { view: null, state: 'idle', asked: {} };
  /** What friends are asking right now (a party to join): a card over the game until it is answered. */
  invites: FriendInvite[] = [];
  private inviteDone = new Set<number>();
  private socialStart = 0;
  private socialTimer = 0;
  private stopClaim: () => void = () => undefined;
  coop: CoopSession | null = null;
  /** The party's run this game last started (a new one in the room's view starts the next). */
  private partyRun = 0;
  /** An invite this page was opened with (?room=CODE): joined once a hero is chosen. */
  invite = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '') : '';
  /**
   * A friend's invitation into their Ring party, taken (or this page was opened with ?ring=CODE): the title screen opens
   * the Ring, which joins it (ui/RingScreen.tsx) and takes it with `takeRingInvite`.
   */
  ringInvite = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('ring')?.toUpperCase() ?? '') : '';
  /** The Ring has joined the party it was invited into. */
  takeRingInvite(): void {
    if (!this.ringInvite) return;
    this.ringInvite = '';
    this.bump();
  }
  /** Pause asked for by the arcade (left full screen, scrolled away). */
  private toWorldFn: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y });
  touchMode: boolean;
  private pausedDrawAt = 0;
  /** Hints asked for, waiting for the hero to be free. */
  private tipQueue: { id: TipId; spell?: string }[] = [];
  /** No hint before this (performance.now() ms): a quest's end and what it gave are read first. */
  private tipAfter = 0;
  private tipOpenedAt = 0;
  /** The game is turned to landscape on a phone held upright (ui/turn.ts). */
  turned = false;
  dpr = 1;

  constructor(canvas: HTMLCanvasElement, host: GameHost, playerName: string) {
    this.host = host;
    this.renderer = new Renderer(canvas);
    // the skill and talent icons: drawn again with their pictures once the atlas is in
    void iconsReady.then((ok) => ok && this.bump());
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
      questCard: null,
      teach: null,
      tip: null,
      card: null,
      story: null,
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

  /* ----------------------------------------------- game masters (Admin › Sigilfall) */

  private gmStart = 0;
  private gmTimer = 0;
  private gmBusy = false;

  /* ----------------------------------------------- the site's shop (progress/shopGoods.ts) */

  private stopShop: () => void = () => undefined;

  /** What the shop sells and what the account owns, heard again: a mount or look no longer owned comes off at once. */
  private syncShop(): void {
    const { items, owned } = sigilfallShop();
    setShopGoods(items, owned);
    // (and the titles an admin gave the account: every hero of it can wear them, from the moment they arrive)
    setGivenTitles(account.get().me?.sigilTitles);
    const w = this.world;
    if (w?.player.riding && this.hero && !canRide(this.hero, w.player.riding)) w.dismount();
    this.bump();
  }

  /** Looks for orders soon after the game opens (the saves have arrived by then) and then every minute. */
  private startGm(): void {
    this.gmStart = window.setTimeout(() => void this.checkGm(), GM_FIRST_MS);
    this.gmTimer = window.setInterval(() => void this.checkGm(), GM_EVERY_MS);
  }

  /** Carries out what's waiting (progress/gm.ts) and reports how it went. Guests have none; offline, they wait. */
  async checkGm(): Promise<void> {
    if (this.gmBusy || this.hidden || !this.canSave) return;
    this.gmBusy = true;
    try {
      const orders = await waitingOrders();
      if (!orders.length) return;
      const done: { id: string; result: string }[] = [];
      let live = false;
      for (const o of orders) {
        if (o.kind === 'message') {
          // a word for the player: it waits for them to be in the world, where they can see it
          if (!this.world) continue;
          this.toast(`A Game Master says: ${String(o.payload.text ?? '')}`, 'hint');
          done.push({ id: o.id, result: '' });
          continue;
        }
        const result = applyOrder(this.save, o, this.hero, Math.random, heroSlots(account.get().me));
        done.push({ id: o.id, result });
        if (result) continue;
        if (this.hero && this.hero.created === o.created) live = true;
        // (a mount, a look or an item: the card for things received, wherever the player is: ui/Arrival.tsx)
        if (announceGm(this.save, o)) continue;
        const line = orderToast(o);
        if (line && this.world) this.toast(line, 'good');
      }
      if (live && this.world) this.changed();
      else this.bump();
      this.persist();
      await reportOrders(done);
    } finally {
      this.gmBusy = false;
    }
  }

  /**
   * The least time between two frames, in milliseconds (0: every frame the screen offers), for the world and for the
   * modes that draw themselves (the Ring, the Vigil, the hall of heroes). A phone's screen may run at 90 or 120: the
   * game looks no better for it, and the heat is real, so a touch screen is held to sixty. With the battery saver on
   * (Settings.saver), any screen is held to thirty.
   */
  get frameGap(): number {
    return this.settings.saver ? 1000 / 33 : this.touchMode ? 1000 / 66 : 0;
  }

  attach(input: HTMLElement): void {
    this.kbm = new KeyboardMouse(input);
    this.kbm.ultKey = this.settings.ultKey;
    this.kbm.skill4Key = this.settings.skill4Key;
    this.kbm.byCode = codeMap(this.binds());
    this.kbm.onUi = (k) => this.uiKey(k);
    this.last = performance.now();
    this.startGm();
    this.startSocial();
    this.syncShop();
    this.stopShop = watchSigilfallShop(() => this.syncShop());
    const loop = (t: number): void => {
      this.raf = requestAnimationFrame(loop);
      if (t - this.last < this.frameGap) return;
      this.frame(t);
    };
    this.raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
  }

  detach(): void {
    this.reportStop();
    this.stopShop();
    window.clearTimeout(this.gmStart);
    window.clearInterval(this.gmTimer);
    window.clearTimeout(this.socialStart);
    window.clearInterval(this.socialTimer);
    this.stopClaim();
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    this.leaveParty();
    // loot still on the ground goes with the hero, as on the road (never lost by closing the game)
    if (this.world) this.collectLeftovers(this.world, true);
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

  /** When this sitting began, for how long a player stayed before they stopped (progress/telemetry.ts). */
  private sittingFrom = performance.now();
  private stopSent = false;

  /** Where a player stopped playing, sent once a sitting (the page left, or the game closed). */
  private reportStop(): void {
    if (this.stopSent || !counted(this.hero, !!this.trial) || this.ui.screen !== 'game') return;
    this.stopSent = true;
    track('game_stop', stopProps(this.hero, this.world?.region.id ?? null, (performance.now() - this.sittingFrom) / 60_000));
  }

  private onPageHide = (): void => {
    this.reportStop();
    if (this.world) this.collectLeftovers(this.world, true);
    this.persist();
  };

  /** The arcade asked for a pause (full screen left, scrolled away). */
  hostPause(): void {
    if (this.ui.screen === 'game' && !this.isPaused()) this.setUi({ pause: true });
    this.kbm?.release();
    this.touch.release();
  }

  setToWorld(fn: (x: number, y: number) => { x: number; y: number }): void {
    this.toWorldFn = fn;
  }

  /** What plays outside the story (the Ring, the Vigil: each sets its own while it is up; null: the title's). */
  private modeMusic: MusicId = null;

  setModeMusic(id: MusicId): void {
    this.modeMusic = id;
  }

  isPaused(): boolean {
    const u = this.ui;
    return u.screen !== 'game' || u.pause || !!u.panel || !!u.dialogue || !!u.travel || u.death || !!u.reward || !!u.tip || !!u.story || this.hidden;
  }

  /* ------------------------------------------------------------ the frame */

  private frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    // a way being taken: dark enough, the next place is made (first, so this frame draws it, coming up out of the dark)
    if (this.leaving) {
      const k = (now - this.leaving.at) / LEAVE_MS;
      if (k >= 1 || this.ui.screen !== 'game') {
        const go = this.leaving.go;
        this.leaving = null;
        this.renderer.leaving = 0;
        if (this.ui.screen === 'game') go();
      } else this.renderer.leaving = Math.max(0, k);
    }
    // sound follows the pause, however it was left (the pause menu, a panel opened from it, the title): a
    // minimized game paused itself and used to come back silent
    this.sound.suspend(this.hidden || (this.ui.screen === 'game' && this.ui.pause));
    const w = this.world;
    if (!w || this.ui.screen !== 'game') {
      if (this.ui.screen !== 'game') {
        this.sound.setMusic(this.modeMusic ?? 'title');
        this.sound.setAmbience(null);
      }
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
      // a scene playing: the hero's keys take its next line (Space, Enter, a click or a tap on attack), as a quest's
      // words are clicked through; only Skip (or Esc) ends it
      if (w.scene) {
        if (f.interact || f.casts.some((c) => c.slot === 'dodge' || c.slot === 'basic')) advanceScene(w);
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
      // (the greeting waits for a title over the gate to have come and gone)
      if (this.greetIn > 0 && !this.ui.card && !this.cards.length && !this.ui.story && !this.pages.length) {
        this.greetIn -= dt;
        if (this.greetIn <= 0 && this.hero && questState(this.hero, 'briar-dusk') === 'active' && w.region.id === HOME) this.talk('mara-venn');
      }
      this.coop?.frame(dt * 1000);
      this.noteLeaderScene();
      if (this.leadAwayAt && performance.now() - this.leadAwayAt > LEAD_WAIT_MS) {
        this.leadAwayAt = 0;
        this.partyNote('Your party leader has been gone a while: the run is over.', 'warn');
        this.leaveCoopRun();
        // (anyone may end a run whose leader is away: the room goes back to its lobby for everyone)
        this.party?.link.send({ t: 'end' });
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
    // the story's pages: none of its scenes begins while one is waiting, and the next comes up once the world is calm;
    // but what a quest came to waits for the scene of its aftermath, if one is due here, to have been shown first (Elyra
    // taken at the Tear is seen, then told)
    const first = this.pages[0];
    const aftermath = first?.kind === 'deed' && sceneDue(w, first.quest);
    w.holdScenes = !!this.ui.story || (this.pages.length > 0 && !aftermath);
    if (!this.ui.story && this.pages.length && !aftermath) this.turnPage(w, dt);
    this.renderer.aim = paused ? null : this.touch.aim;
    this.renderer.touchMode = this.touchMode;
    this.renderer.frameShift = this.touchMode ? (this.settings.lefty ? -FRAME_SHIFT : FRAME_SHIFT) : 0;
    this.renderer.pointer = this.kbm?.view() ?? null;
    // (behind a menu the world stands still: a few frames a second is all it needs, and the phone stays cool. A talk
    // isn't a menu: the camera's on the people in it, and the fires still burn)
    if (!(this.ui.pause || this.ui.panel) || this.coop || now - this.pausedDrawAt > 150) {
      this.pausedDrawAt = now;
      this.renderer.draw(w, paused ? 0 : dt, now / 1000);
    }
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
    // the hero's feet on what they walk on (audio/steps.ts)
    const foot = this.steps.step(w);
    if (foot) this.sound.play(foot);
    // what happens while someone is talking, or a scene plays (the HUD stepped aside), waits until they have
    // finished: a toast behind them is missed
    if (this.ui.dialogue || w.scene || this.ui.story) this.toastsHeld = true;
    else if (this.toastsHeld) {
      this.toastsHeld = false;
      this.setUi({ toasts: this.ui.toasts.map((x) => ({ ...x, until: t + toastTime(x.tone) })) });
    } else if (this.ui.toasts.some((x) => x.until < t)) this.setUi({ toasts: this.ui.toasts.filter((x) => x.until >= t) });
    // (and a banner, which a scene hides, shows in full once it is over: unless the scene played the moment
    // it announced out, a long while ago)
    if (w.scene) this.bannerHeld = true;
    else if (this.bannerHeld) {
      this.bannerHeld = false;
      if (this.ui.banner) this.setUi({ banner: t - this.ui.banner.id < 4000 ? { ...this.ui.banner, id: t } : null });
    }
    if (this.ui.banner && !this.bannerHeld && t - this.ui.banner.id > 2600) this.setUi({ banner: null });
    // a story told face to face: the camera frames the hero and whoever speaks (and the HUD steps aside)
    const d = this.ui.dialogue;
    const who = d && this.storyTalk() ? w.npcs.find((n) => n.id === d.npc) : undefined;
    w.talkTo = who ? { x: who.x, y: who.y } : null;
    // a title card waits for its moment, then holds the screen a few seconds
    const card = this.ui.card;
    if (card && t - card.id > (card.act ? ACT_CARD_MS : LAND_CARD_MS)) this.setUi({ card: null });
    // (nor while someone's words are up on the picture: a land's name came up across what Mara was saying as the
    // hero first walked into the Whisperwood. It waits for her to finish)
    else if (!card && this.cards.length && !this.ui.dialogue && !this.ui.panel && !this.ui.death && !w.scene && !(this.renderer as SigilEngine['renderer'] | undefined)?.speechBoxes.length)
      this.setUi({ card: { ...this.cards.shift()!, id: t } });
    if (this.ui.levelUp && t - this.ui.levelUp.id > 3600) this.setUi({ levelUp: null });
    if (this.ui.equipAsk && t - this.ui.equipAsk.id > EQUIP_ASK_MS) this.setUi({ equipAsk: null });
    if (this.ui.questCard && t - this.ui.questCard.id > QUEST_CARD_MS) this.setUi({ questCard: null });
    if (this.tipQueue.length) this.showTip(w);
    const boss = w.boss();
    this.sound.setMusic(boss && !boss.dead ? 'boss' : ((w.scene?.music ?? w.storyState?.music ?? REGIONS[w.region.id].music) as MusicId));
    // (the air is the land's own, whatever the story plays over it; a town under siege has none)
    this.sound.setAmbience(ambienceOf(w.storyState?.music ?? REGIONS[w.region.id].music));
    // the music steps back for the story's words and comes forward in a fight (audio/mix.ts)
    this.sound.setMix(mixFor(w, this.ui));
  }

  private handleEvents(w: World): void {
    const events = w.events;
    if (!events.length) return;
    w.events = [];
    let changed = false;
    const newQuests: string[] = [];
    // a quest finishing in this batch: its card gathers what it paid and what it opened (the news would say each apart)
    let card: NonNullable<UiState['questCard']> | null = null;
    for (const ev of events) {
      switch (ev.t) {
        case 'sfx':
          this.sound.play(ev.id, ev.vol);
          break;
        case 'voice': {
          // (audio/voice.ts: the hero's by the body chosen, a companion's by who they are; Settings › Voices turns them off)
          const said = this.settings.voice && this.hero ? voiceSound(ev.who, ev.kind, this.hero.body) : null;
          if (said) this.sound.play(said);
          break;
        }
        case 'toast':
          this.toast(ev.text, ev.tone ?? 'info', ev.item);
          break;
        case 'loot':
          // (a quest's reward is on the quest's card, not news of its own)
          if (card) card.items.push(ev.item);
          else this.toast(itemName(ev.item), 'loot', ev.item);
          if (this.offerEquip(ev.item)) changed = true;
          this.queueTip('bag');
          if (this.hero && !this.hero.opened.includes('hint:equip') && Object.keys(this.hero.equip).length < 2) this.hint('equip');
          break;
        case 'levelup': {
          this.refreshPartyCard();
          const h = this.hero!;
          const skills = [...learnedSkills(h), CLASSES[h.cls].ult].filter((id) => SKILLS[id]?.unlock === ev.level);
          this.ui = { ...this.ui, levelUp: { level: ev.level, skills, id: performance.now() } };
          changed = true;
          if (skills.includes(CLASSES[h.cls].ult)) this.hint('ult');
          const spell = skills.find((id) => id !== CLASSES[h.cls].ult);
          if (spell) this.queueTip('spell', spell);
          if (ev.level >= MAX_LEVEL && h.keystone >= 1) this.queueTip('rift');
          break;
        }
        case 'questDone': {
          const q = QUEST_DEFS[ev.quest];
          if (q && this.hero) this.storyOf(q.id, 'done');
          // (a quest whose ending is told on a page of its own has its name and its pay there)
          const paged = this.pages.some((p) => p.kind === 'deed' && p.quest === ev.quest);
          if (q && this.hero && !q.quiet && !paged) {
            if (card) this.toast(`Quest complete: ${q.name}`, 'quest', undefined, rewardSummary(this.hero, q) || q.reward.text);
            else card = { quest: q.id, name: q.name, lines: questRewards(this.hero, q).filter((l) => l.kind !== 'item'), items: [], next: null, id: performance.now() };
          }
          this.sound.play('questDone');
          // the first horses: how to ride, once the mount is in (granted below, shown when the hero is free)
          if (ev.quest === FIRST_RIDE && this.queueTip('riding')) this.tipAfter = performance.now() + TIP_AFTER_REWARD;
          break;
        }
        case 'questStep': {
          const q = QUEST_DEFS[ev.quest];
          if (q && this.hero) this.storyOf(q.id, 'step');
          if (q && this.hero) this.toast(`${q.name}: next`, 'quest', undefined, currentObjective(this.hero, q).label);
          this.sound.play('quest', 0.6);
          break;
        }
        case 'questReady': {
          const q = QUEST_DEFS[ev.quest];
          if (q && this.hero) this.storyOf(q.id, 'ready');
          const who = q ? turnInNpc(q) : null;
          if (q && who) this.toast(`${q.name}: done`, 'quest', undefined, `Return to ${NPCS[who]?.name ?? 'them'}`);
          this.sound.play('questDone', 0.7);
          break;
        }
        case 'questStart': {
          if (!QUEST_DEFS[ev.quest]?.quiet) newQuests.push(ev.quest);
          // an act begins: its title, once
          const act = ACTS.find((a) => a.opens === ev.quest);
          if (act && !this.hero?.opened.includes(`act:${act.id}`)) this.actBegins(act);
          break;
        }
        case 'bossStart': {
          const b = w.boss();
          // (met for the first time, its name is in the shot of it: no banner after)
          // (its name and title are on its bar, which comes up now: said again in a banner under the bar, the two lay
          // across each other and across what the boss calls)
          if (b?.boss) this.ui = { ...this.ui, boss: { name: b.boss.def.name, title: b.boss.def.title }, banner: w.scene ? this.ui.banner : null };
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
        case 'sigil':
          // the Sigil Rite comes before the page that tells what the quest came to
          if ((SIGILS as string[]).includes(ev.id)) {
            const deed = this.pages.findIndex((p) => p.kind === 'deed');
            this.pages.splice(deed < 0 ? this.pages.length : deed, 0, { kind: 'sigil', sigil: ev.id as SigilId });
          }
          break;
        case 'paragon':
          this.toast(`Paragon ${ev.level}`, 'good', undefined, 'A point to spend in the Hero panel');
          this.sound.play('levelup');
          break;
        case 'banner':
          // a place found comes up as a title over the land; anything else is a banner
          if (ev.place) this.cards.push({ over: ev.sub ?? 'Discovered', text: ev.text, act: false });
          else this.ui = { ...this.ui, banner: { text: ev.text, sub: ev.sub, id: performance.now() } };
          changed = true;
          break;
        case 'death':
          this.deathAt = performance.now() + 1500;
          // where heroes fall, counted without anything personal (progress/telemetry.ts; POLISH_PLAN.md piece 28)
          if (counted(this.hero, !!this.trial)) {
            const b = w.boss();
            track('game_fall', fallProps(this.hero, w.region.id, b && !b.dead ? b.def.id : null));
          }
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
      if (syncRift(this.hero)) {
        this.toast('You found a Riftstone. The Rift Trials are open from the title screen, or at any waystone.', 'good');
        changed = true;
      }
      if (grantWarden(this.hero)) {
        this.toast(`${WARDENS[this.hero.cls].title}: the armor is in your Wardrobe`, 'good');
        this.sound.play('epic');
        changed = true;
      }
      for (const t of newTitles(this.hero, this.ringRating())) {
        this.toast(`New title: ${titled(this.hero.name, titleShown(t, this.hero))}`, 'good', undefined, 'Wear it from the Hero page, under your name.');
        this.sound.play('epic');
        changed = true;
      }
      for (const m of grantMounts(this.hero)) {
        this.toast(`New mount: ${m.name}`, 'good', undefined, this.touchMode ? 'Tap the horseshoe to ride. Choose mounts in the Wardrobe.' : 'Press Y to ride. Choose mounts in the Wardrobe.');
        this.sound.play('epic');
        changed = true;
      }
    }
    if (card) {
      // the quest it opened goes on its card, the way on
      if (newQuests.length) card.next = newQuests.length === 1 ? QUEST_DEFS[newQuests[0]!]!.name : `${QUEST_DEFS[newQuests[0]!]!.name} and ${newQuests.length - 1} more`;
      this.ui = { ...this.ui, questCard: card };
      changed = true;
    } else if (newQuests.length === 1) {
      const q = QUEST_DEFS[newQuests[0]!]!;
      this.toast(`New quest: ${q.name}`, 'quest', undefined, q.objective.label);
    } else if (newQuests.length > 1) this.toast(`${newQuests.length} new quests`, 'quest', undefined, newQuests.map((id) => QUEST_DEFS[id]!.name).join(' · '));
    if (changed) this.bump();
  }

  private endBossBar(): void {
    if (this.ui.boss) this.ui = { ...this.ui, boss: null };
  }

  /** The open panel was opened from the pause menu (it returns there). */
  private panelFromPause = false;

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
    // the tutorial says these in full, the game paused: no toast on top of it
    if (id === 'attack') this.queueTip('combat');
    if ((id === 'equip' && this.queueTip('bag')) || (id === 'spec' && this.queueTip('talents'))) return;
    const touch = this.touchMode;
    // the Prologue's first fight teaches by fighting (its waves ask for these): on the bar itself, the key lit
    if (id === 'attack' || id === 'skill' || id === 'dodge') {
      const slot: SlotKey = id === 'attack' ? 'basic' : id === 'skill' ? 's1' : 'dodge';
      const now = performance.now();
      this.setUi({ teach: { slot, text: this.teachText(id), shown: now, until: now + 10_000 } });
      return;
    }
    // low health on a phone: a pointer over the potion, which stands apart from the skills now (ui/Touch.tsx)
    if (id === 'potion' && touch) {
      const now = performance.now();
      this.setUi({ teach: { slot: 'potion', text: 'Low health! Tap the potion to drink', shown: now, until: now + 8_000 } });
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
              : `Ultimate unlocked! It charges as you deal damage: press ${actionLabel(this.binds(), 'ult') || 'the right mouse button'}.`
            : id === 'potion'
              ? touch
                ? 'Low health! Tap the red potion.'
                : 'Low health! Press 1 to drink a potion.'
              : '';
    if (text) this.toast(text, 'hint');
  }

  /* ------------------------------------------------- the first-timer's tutorial (progress/tips.ts) */

  /** Asks for a hint: it shows as soon as nothing else is on the screen. True if this hero will see it. */
  private queueTip(id: TipId, spell?: string): boolean {
    const h = this.hero;
    if (!h || !tipDue(h, this.settings.tutorial, id)) return false;
    if (!this.tipQueue.some((q) => q.id === id)) this.tipQueue.push({ id, spell });
    return true;
  }

  /** The next hint, once the hero is free: not over a scene, someone talking, a menu or a land still loading. */
  private showTip(w: World): void {
    const h = this.hero;
    // (nor over a line said out of a fight: the first horses' hint came up over Mara's answer to the riders, and the
    // game paused, held her line and the quest's own toasts behind it. In a fight the lesson can't wait for the barks)
    if (!h || this.ui.tip || this.coop || w.keyRun || w.scene || (w.story.talking && !w.story.fighting) || performance.now() < this.tipAfter || this.ui.card || this.pages.length || this.isPaused() || this.renderer.waiting) return;
    const next = this.tipQueue.shift();
    if (!next) return;
    // (turned off since it was asked for, or shown already)
    if (!tipDue(h, this.settings.tutorial, next.id)) return;
    tipShown(h, next.id);
    this.scheduleSave(300);
    this.kbm?.release();
    this.touch.release();
    this.sound.play('open');
    this.tipOpenedAt = performance.now();
    this.setUi({ tip: { id: next.id, step: 0, spell: next.spell } });
  }

  /** The hint on the screen, in steps for this input and this hero. */
  tipPlan(): { id: TipId; step: number; steps: TipStep[] } | null {
    const tip = this.ui.tip;
    const w = this.world;
    const h = this.hero;
    if (!tip || !w || !h) return null;
    const steps = tipSteps(tip.id, { touch: this.touchMode, bar: w.build.bar, resource: w.build.resource ?? null, specChosen: h.spec !== null, spell: tip.spell });
    return { id: tip.id, step: tip.step, steps };
  }

  /** On to the hint's next step, opening what it talks about; after the last, back to the game. */
  tipNext(): void {
    const plan = this.tipPlan();
    if (!plan) return;
    const next = plan.steps[plan.step + 1];
    if (!next) return this.endTip();
    this.sound.play('open');
    this.setUi({ tip: { ...this.ui.tip!, step: plan.step + 1 }, panel: next.panel });
  }

  /** Back to the game. A control being taught over the bar (the first fight) gets its full time again. */
  private endTip(): void {
    this.sound.play('close');
    const teach = this.ui.teach;
    const away = performance.now() - this.tipOpenedAt;
    this.setUi({ tip: null, panel: null, teach: teach ? { ...teach, shown: teach.shown + away, until: teach.until + away } : null });
  }

  /** "Turn off hints": no more of them, for any hero, until Settings or a new hero turns them back on. */
  skipTips(): void {
    this.tipQueue = [];
    this.endTip();
    this.setTutorial(false);
    this.toast('Hints are off. You can turn them back on in Settings.', 'hint');
  }

  /** The Settings choice. On means on: every hero gets the hints they haven't seen yet, from here on. */
  setTutorial(on: boolean): void {
    this.setSettings({ tutorial: on });
    if (on) for (const h of this.save.heroes) if (h) giveTips(h);
  }

  /** A new hero asks whether to show the hints when the player has seen them, or has turned them off. */
  get asksForTips(): boolean {
    return !this.settings.tutorial || this.save.heroes.some(Boolean);
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
    // what any hero's runs have opened, dungeon by dungeon, is its calling's on this account (progress/trial.ts stoneIn)
    if (this.hero && Object.keys(this.hero.stones).length) {
      const mine = { ...(this.save.riftBy[this.hero.cls] ?? {}) };
      for (const [r, n] of Object.entries(this.hero.stones)) mine[r] = Math.max(mine[r] ?? 0, n);
      this.save.riftBy = { ...this.save.riftBy, [this.hero.cls]: mine };
    }
    if (this.hero && this.trial) {
      // a Trial's hero is not kept: only how high the calling's stone has been taken
      this.save.rift = { ...this.save.rift, [this.trial]: Math.max(this.save.rift[this.trial] ?? 1, this.hero.keystone) };
    } else if (this.hero) {
      // how far into a dungeon they have come, kept with where they are (Character.at: a reload takes it up again)
      const w = this.world;
      const at = this.hero.at;
      const mark = w && at && at.region === w.region.id ? w.dungeonMark() : null;
      if (at && mark) this.hero.at = { region: at.region, ...(at.tier ? { tier: at.tier } : {}), ...(at.from ? { from: at.from } : {}), ...mark };
      // whatever the hero carries now, its look is theirs for good
      learnLooks(this.hero, allItems(this.hero));
      // stamped only when something changed: opening a hero without playing doesn't make that copy the newest
      const sig = heroSignature(this.hero);
      if (sig !== this.heroSig) {
        this.hero.updated = Date.now();
        this.heroSig = sig;
      }
      this.save.heroes[this.slot] = this.hero;
      this.save.last = this.slot;
    }
    if (!writeSave(this.save)) {
      if (!this.ui.notice) this.setUi({ notice: 'Progress could not be saved (storage is full or blocked).' });
    }
  }

  setSettings(patch: Partial<Settings>): void {
    this.save.settings = { ...this.save.settings, ...patch };
    // (a run any of which was played on Story stays off the leaderboard, whatever it ends on)
    if (this.run && this.save.settings.difficulty === 'story') this.run.story = true;
    this.applySettings();
    this.scheduleSave(400);
    this.bump();
  }

  private applySettings(): void {
    const s = this.settings;
    this.sound.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
    this.renderer.reducedMotion = s.reducedMotion;
    this.renderer.plates = s.plates;
    this.renderer.setGraphics(s.graphics);
    // (the battery saver's thirty frames a second are chosen, not a machine falling behind: render3d/pace.ts)
    paceStride(s.saver ? 2 : 1);
    setDangerTone(s.dangerTone);
    this.renderer.setZoom(s.zoom);
    if (this.kbm) {
      this.kbm.ultKey = s.ultKey;
      this.kbm.skill4Key = s.skill4Key;
      this.kbm.byCode = codeMap(this.binds());
    }
    if (this.world) this.world.settings = s;
  }

  /** The keys each action answers to now (input/binds.ts): the defaults with the player's own on top. */
  binds(): Record<CampAction, string[]> {
    const s = this.settings;
    return resolveBinds(s.ultKey, s.skill4Key, s.keys ?? {});
  }

  resetSettings(): void {
    this.setSettings({ ...DEFAULT_SETTINGS, rotateSeen: this.settings.rotateSeen });
  }

  /* ------------------------------------------------------------- heroes */

  newHeroScreen(slot: number): void {
    this.setUi({ screen: 'create', createSlot: slot });
  }

  createHero(slot: number, cls: ClassId, name: string, body: Body = 'm', face?: Face, tips = this.settings.tutorial): void {
    // a class sold in the shop is made only once it's bought, and in a place this account plays (progress/paidClasses.ts)
    if (!classOpen(cls, account.get().me) || slot >= heroSlots(account.get().me)) return;
    const c = newCharacter(cls, name || this.defaultName, `hero${slot}`, Date.now(), body);
    if (face) c.face = face;
    // the first hero gets the tutorial; a later one by the player's answer, which is also the Settings choice
    if (tips !== this.settings.tutorial) this.setSettings({ tutorial: tips });
    if (tips) giveTips(c);
    this.save.heroes[slot] = c;
    this.persist();
    this.play(slot);
  }

  /**
   * The calling whose Rift Trial is being played, with its ready hero (progress/trial.ts), or null in the story.
   * Such a hero is nobody's saved hero: nothing of theirs is written down but how high the calling's stone has gone
   * (SaveFile.rift), and wherever the story would send them home, they go back to the title.
   */
  trial: ClassId | null = null;
  /** The place a hero is taken back to as play() begins, while travel() makes it (a dungeon's rooms and checkpoint). */
  private resumeMark: Character['at'] | null = null;

  /** Straight into a Rift Trial from the title, as a calling's ready hero on one of its paths. */
  startRiftTrial(cls: ClassId, spec: 0 | 1 | 2, region: RegionId, pick?: number): void {
    if (!trialsOpen(this.save) || !classOpen(cls, account.get().me) || REGIONS[region]?.kind !== 'dungeon') return;
    // (any stone up to the one the calling has open in this dungeon: a lower one to learn a dungeon on)
    const top = stoneIn(this.save, cls, region);
    const stone = Math.max(1, Math.min(top, Math.floor(pick ?? top)));
    this.trial = cls;
    this.hero = trialHero(cls, spec, Math.max(top, trialStone(this.save, cls)));
    this.hero.stones = stonesOf(this.save, cls);
    this.heroSig = heroSignature(this.hero);
    this.tipQueue = [];
    this.pages = [];
    this.ui = { ...this.ui, screen: 'game', tip: null, panel: null, pause: false, dialogue: null, travel: null, death: false, reward: null, boss: null, toasts: [], teach: null, story: null };
    this.sound.unlock();
    if (!this.travel(region, 2, [], undefined, stone)) this.toTitle();
    this.bump();
  }

  deleteHero(slot: number): void {
    this.save.heroes[slot] = null;
    if (this.save.last === slot) this.save.last = this.save.heroes.findIndex((h) => h) >= 0 ? this.save.heroes.findIndex((h) => h) : 0;
    this.persist();
    this.bump();
  }

  /** What the site's Trophy Shelf has earned in the game: asked once, and only counted if it answers. */
  private askShelf(): void {
    if (this.shelfAsked || typeof fetch !== 'function') return;
    this.shelfAsked = true;
    void fetch('/api/pins')
      .then((r) => (r.ok ? (r.json() as Promise<{ points?: number }>) : null))
      .then((v) => {
        if (typeof v?.points === 'number') setShelfPoints(v.points);
      })
      .catch(() => undefined);
  }
  private shelfAsked = false;

  /** Into the world with this hero, and straight to the party page: the title's "Play together". */
  playTogether(slot: number): void {
    this.play(slot);
    if (this.ui.screen !== 'game' || this.slot !== slot) return;
    this.ui = { ...this.ui, panel: 'party' };
    this.bump();
  }

  /** A hero of the player's own, from the main menu's Riftstone mode: taken straight to the Riftward, where its Gate is. */
  playInRiftward(slot: number): void {
    const h = this.save.heroes[slot];
    if (!h || !h.unlocked.includes('riftward')) return;
    h.at = { region: 'riftward' };
    this.play(slot);
  }

  play(slot: number): void {
    const locked = this.save.heroes[slot];
    if (slot >= heroSlots(account.get().me)) return;
    if (locked && !classOpen(locked.cls, account.get().me)) {
      this.setUi({ notice: `This hero is a ${CLASSES[locked.cls].name}, a class from the shop. Unlock it in the shop to play them again: they're kept, as they were.` });
      return;
    }
    const h = this.save.heroes[slot];
    if (!h) return;
    this.askShelf();
    this.trial = null;
    this.slot = slot;
    this.hero = h;
    this.heroSig = heroSignature(h);
    this.save.last = slot;
    this.tipQueue = [];
    this.pages = [];
    this.ui = { ...this.ui, screen: 'game', tip: null, panel: null, pause: false, dialogue: null, travel: null, death: false, reward: null, boss: null, toasts: [], teach: null, story: null };
    // back where they were when they last played (Character.at): the land, the town, a dungeon at its door. A place
    // that can't be gone to any more (a land the story left, a way lost) is Briarhollow, as it always was
    const at = h.at;
    // (a dungeon is taken up where it was left: its rooms cleared, its last checkpoint; World.restoreMark)
    this.resumeMark = at && REGIONS[at.region]?.kind === 'dungeon' ? at : null;
    if (!at || at.region === HOME || !this.travel(at.region, at.tier ?? 0, [], at.from)) this.travel(HOME, 0, []);
    this.resumeMark = null;
    this.sound.unlock();
    // still in a party's lobby (back from choosing another hero): the party sees the new one
    if (this.party && !this.invite) this.refreshPartyCard(true);
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
    // the act under way, if its title hasn't been seen (a brand-new hero's Prologue, over the gate at dusk)
    for (const act of ACTS) if (questState(h, act.opens) === 'active' && !h.opened.includes(`act:${act.id}`)) this.actBegins(act);
    // a brand-new hero arrives at Briarhollow's gate at dusk, and the guard stops them there: once the gate
    // can be seen (its art in, a moment to look), not over a dark screen
    this.greetIn = questState(h, 'briar-dusk') === 'active' && h.level === 1 && h.stats.time < 1 ? GREET_AFTER : 0;
    if (h.level >= SPEC_LEVEL) this.queueTip('talents');
    // (as the talents': a hero who already rides and hasn't seen it, with the hints on, sees it as the land opens)
    if (hasMount(h)) this.queueTip('riding');
    // (and the endgame, for a hero at the top with a stone)
    if (h.level >= MAX_LEVEL && h.keystone >= 1) this.queueTip('rift');
    // (titles earned before this land was entered are simply theirs: one line, not one for each)
    const owed = newTitles(h, this.ringRating());
    if (owed.length > 1) this.toast(`${owed.length} titles are yours`, 'good', undefined, 'Choose one to wear on the Hero page, under your name.');
    else if (owed.length === 1) this.toast(`New title: ${titled(h.name, titleShown(owed[0]!, h))}`, 'good', undefined, 'Wear it from the Hero page, under your name.');
    this.bump();
  }

  /**
   * Another device's copy of the save arrived (cloud saves merged it into storage while the game is open:
   * platform/syncGate.ts takeSavesLive). On the title or hero screens the whole save is taken in, so the heroes
   * shown are the account's; in play every hero but the one being played, who stays as they are in memory (else
   * this device's next save would write its older copy of the others back over the account's).
   */
  takeArrivedSave(): void {
    // (screens that keep a save of their own, the Ring's, read theirs again)
    for (const fn of this.arrivedFns) fn();
    const loaded = loadSave();
    if (loaded.status === 'newer' || loaded.status === 'blocked') return;
    const next = loaded.save;
    if (this.ui.screen === 'game' && this.hero && this.trial) next.settings = this.save.settings;
    else if (this.ui.screen === 'game' && this.hero) {
      next.heroes[this.slot] = this.hero;
      next.settings = this.save.settings;
      next.last = this.slot;
    }
    // (the Trials' stones never go down: the higher of this device's and the account's, calling by calling)
    for (const [cls, n] of Object.entries(this.save.rift)) next.rift[cls] = Math.max(next.rift[cls] ?? 1, n);
    for (const [cls, m] of Object.entries(this.save.riftBy)) {
      const into = (next.riftBy[cls] ??= {});
      for (const [r, n] of Object.entries(m)) into[r] = Math.max(into[r] ?? 0, n);
    }
    this.save = next;
    this.bump();
  }

  private arrivedFns = new Set<() => void>();
  /**
   * Called whenever another device's copy of any of the game's saves arrives while the game is open (the Ring keeps
   * its own: arena/ladder.ts), so a screen holding one in memory takes the merged copy in rather than writing its own
   * older one back over it. Returns the function that stops it.
   */
  onArrived(fn: () => void): () => void {
    this.arrivedFns.add(fn);
    return () => {
      this.arrivedFns.delete(fn);
    };
  }

  /**
   * Sends this account's bests to the rankings (progress/ranks.ts), for a player who is signed in: at the title, where
   * every mode comes back to. Asked for again only when something has changed. A guest's bests stay on their device.
   */
  reportRanks(): Promise<void> {
    if (!account.get().me || typeof fetch !== 'function') return Promise.resolve();
    // (the Ring's boards are written by the ranked ladder the server keeps, as matches are settled: server/ring.ts)
    const entries = rankEntries(this.save, readBests(), 0);
    const sig = JSON.stringify(entries);
    if (!entries.length || sig === this.ranksSent) return this.ranksGoing;
    this.ranksSent = sig;
    // (the rankings wait for this before they read the boards: RankScreen)
    this.ranksGoing = api('/api/sigilfall/ranks', { body: { entries } }).then(
      () => undefined,
      () => {
        // (offline, or signed out since: asked again next time)
        this.ranksSent = '';
      },
    );
    return this.ranksGoing;
  }
  private ranksGoing: Promise<void> = Promise.resolve();
  private ranksSent = '';

  toTitle(): void {
    this.greetIn = 0;
    this.standDownFromParty();
    if (this.world) this.collectLeftovers(this.world, true);
    this.endRun(false);
    this.persist();
    this.world = null;
    this.hero = null;
    this.trial = null;
    this.cards = [];
    this.tipQueue = [];
    this.pages = [];
    this.setUi({ screen: 'title', tip: null, panel: null, pause: false, dialogue: null, travel: null, death: false, reward: null, boss: null, toasts: [], levelUp: null, equipAsk: null, questCard: null, banner: null, teach: null, card: null, story: null });
    void this.reportRanks();
  }

  /* ------------------------------------------------------------- travel */

  travel(to: RegionId, tier: number, mods: RiftMod[], from?: RegionId, key = 0, party?: { role: Role; seed: number; week: number }): boolean {
    const h = this.hero;
    if (!h) return false;
    const region = REGIONS[to];
    // a land the story no longer goes through (data/retired.ts) can't be reached: the way out of one of its
    // dungeons (a Riftstone run) comes out in Briarhollow
    if (isRetired(to)) return this.world?.region.kind === 'dungeon' && !party ? this.travel(HOME, 0, []) : false;
    // a party's run goes where the host chose: a friend who hasn't found the way yet is taken along
    if (!h.unlocked.includes(to) && !party && !key) return false;
    // a Riftstone run is a stone the hero holds, never above the one open in that dungeon (a party runs the host's)
    if (key > 0 && (region.kind !== 'dungeon' || (!party && (h.keystone < 1 || key > this.openStone(to))))) return false;
    // a Trial's hero has no village and no road: anywhere but a stone's dungeon is the way back to the title
    if (this.trial && !key) {
      this.toTitle();
      return true;
    }
    // Mythic and the Riftstones are for heroes at the top level (the owner: "they shouldnt be accessed by anyone
    // lower of 60 lvl or whatever the max is"); a younger hero asking for Mythic gets Heroic
    if (key > 0 && h.level < MAX_LEVEL) {
      this.toast(`Riftstones are for heroes at level ${MAX_LEVEL}.`, 'info');
      return false;
    }
    if (tier >= 2 && h.level < MAX_LEVEL) tier = Math.min(tier, 1);
    // questing together the party travels as one: the leader's way is everyone's, the others follow
    if (this.coop && !party && this.party?.view?.mode === 'party' && this.party.view.phase === 'run') {
      if (this.coop.role === 'host') this.party.link.send({ t: 'go', region: to, tier: region.safe ? 0 : tier });
      else this.toast('You travel with your party’s leader. Leave the party to go your own way.', 'info');
      return false;
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
      // the stone is for the dungeon it was set in: walking out ends that run (what it earned stays in the report)
      if (this.run.key && to !== this.run.region) {
        this.run.keyEnd = (prev && keyResult(prev)) ?? this.run.keyEnd;
        this.run.key = 0;
      }
      this.run.region = to;
    }
    const stone = this.run?.key ?? 0;
    // (an expedition keeps the difficulty it set out at from land to land: one that set out at Mythic before Mythic
    // was for the top level only, or with a party's leader who is there, still comes down to Heroic for a younger hero)
    if (this.run && this.run.tier >= 2 && h.level < MAX_LEVEL) this.run.tier = 1;
    // (Heroic and Mythic are gone, 2026-11-22: only a Riftstone run is fought above Normal; an old save's resume, or an
    // expedition that set out at one, comes back at Normal)
    const keepTier = stone ? (this.run ? this.run.tier : tier) : 0;
    // a land seen for the first time comes up as a title over it; after that, a banner (asked before the world
    // is made: its first look round already marks some of the land seen)
    const first = !region.interior && !h.opened.includes(`land:${to}`) && !h.seen[to] && !stone;
    if (!region.interior && !h.opened.includes(`land:${to}`)) h.opened.push(`land:${to}`);
    const w = new World({
      region: to,
      tier: region.safe ? 0 : keepTier,
      mods: region.safe ? [] : (this.run?.mods ?? mods),
      hero: h,
      settings: this.settings,
      seed: party ? party.seed : (Math.random() * 2 ** 32) >>> 0,
      from,
      beats: true,
      ...(stone ? { key: stone, affixes: keyAffixes(stone, party ? party.week : weekOf(Date.now())) } : {}),
      ...(party ? { coop: party.role } : {}),
      // (a Rift Trial's hero keeps nothing, so nothing drops for them)
      ...(this.trial ? { noLoot: true } : {}),
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
    if (prev?.player.riding && region.kind !== 'dungeon' && !region.interior && canRide(h, prev.player.riding)) w.player.riding = prev.player.riding;
    // the quests of a land start when the hero first gets there
    for (const q of startQuests(h)) w.emit({ t: 'questStart', quest: q.id });
    // a dungeon taken up again after a reload: as it was left (POLISH_PLAN.md piece 3)
    const resume = this.resumeMark;
    const resumed = !!resume && resume.region === to && (resume.tier ?? 0) === w.tier && !party && !stone;
    if (resumed) w.restoreMark(resume);
    // where the hero is now, for the next time they play (not a Riftstone's run, nor a party's: Character.at)
    if (!party && !stone) {
      if (to === HOME) delete h.at;
      else h.at = { region: to, ...(w.tier ? { tier: w.tier } : {}), ...(from ? { from } : {}), ...(resumed ? (w.dungeonMark() ?? {}) : {}) };
    }
    this.world = w;
    this.renderer.snap(w);
    const sub = region.safe ? region.subtitle : w.keyRun ? `Riftstone +${w.keyRun.key} · the clock is running` : `${region.subtitle}${w.tier ? ` · ${TIERS[w.tier]!.name}` : ''}`;
    if (first) this.cards.push({ over: region.kind === 'town' ? 'Town' : `${region.kind === 'dungeon' ? 'Dungeon' : 'Wilds'} · levels ${region.levels[0] + TIERS[w.tier]!.levels}–${region.levels[1] + TIERS[w.tier]!.levels}`, text: region.name, sub: region.subtitle, act: false });
    this.ui = { ...this.ui, panel: null, travel: null, dialogue: null, boss: null, death: false, reward: null, banner: first ? null : { text: region.name, sub, id: performance.now() } };
    this.persist();
    this.bump();
    return true;
  }

  private startRun(region: RegionId, tier: number, mods: RiftMod[], key: number): void {
    this.run = { start: performance.now(), region, tier, mods, key, ...(this.settings.difficulty === 'story' ? { story: true } : {}) };
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
    const key = (w && keyResult(w)) ?? this.run?.keyEnd;
    return { region: this.run?.region ?? w?.region.id ?? 'emberwick', tier: this.run?.tier ?? 0, xp: r.xp, gold: r.gold, kills: r.kills, bosses: r.bosses, items: r.items, seconds: this.run ? (performance.now() - this.run.start) / 1000 : 0, cleared, ...(key ? { key } : {}) };
  }

  /** An expedition ends (home, or the game closes): its score goes to the arcade. */
  private endRun(toast: boolean): void {
    if (!this.run || !this.hero) {
      this.run = null;
      return;
    }
    const s = this.summary(false);
    // a step out of the gate and back is not a round: nothing to report (the arcade would only call it too short)
    if (s.seconds < MIN_ROUND && !s.xp && !s.gold && !s.kills && !s.bosses && !s.items.length && !s.key) {
      this.run = null;
      return;
    }
    // a Riftstone level beaten in time is worth the most: higher stones climb the board
    const score = Math.round(s.xp + s.gold * 2 + s.bosses * 250 + (s.key && s.key.up > 0 ? s.key.key * 1000 : 0));
    this.hero.stats.bestRun = Math.max(this.hero.stats.bestRun, score);
    // a review hero (jumped to a story beat) plays for looking, not for the leaderboard
    // (a review hero, a Trial's, and a run played on Story difficulty don't go on the leaderboard: Story's foes are softer)
    if (!this.hero.review && !this.trial && !this.run.story && this.settings.difficulty !== 'story') this.host.report({ type: 'end', score, stats: { level: this.hero.level, kills: s.kills, bosses: s.bosses, ...(this.hero.para.l ? { paragon: this.hero.para.l } : {}), ...(s.key ? { mythicPlus: s.key.up > 0 ? s.key.key : 0 } : {}) } });
    // the vendors have new stock when you come back
    restock(this.hero);
    if (toast && (s.kills || s.items.length)) this.toast(`Expedition over: +${s.xp} XP, +${s.gold} gold`, 'good', undefined, `${s.kills} foes defeated${s.items.length ? ` · ${s.items.length} items` : ''}`);
    this.run = null;
  }

  /**
   * A way taken (a door, a road out of a land: POLISH_PLAN.md piece 13): the picture goes dark over LEAVE_MS, then the
   * next place is made and comes up out of the dark (render/renderer.ts). At once in a party (the worlds keep one
   * pace) and for a player who asked for less motion.
   */
  private leaving: { at: number; go: () => void } | null = null;

  private leave(go: () => void): void {
    if (this.leaving) return;
    if (this.coop || this.renderer.reducedMotion) {
      go();
      return;
    }
    this.kbm?.release();
    this.touch.release();
    this.leaving = { at: performance.now(), go };
  }

  /** Talk, travel or leave, depending on what is in front of the hero. */
  interact(it: Interactable): void {
    // (on the way out already: nothing more is taken up)
    if (this.leaving) return;
    if (it.kind === 'npc') this.talk(it.id);
    else if (it.kind === 'waystone') this.openPanel('map');
    else if (it.kind === 'exit' && it.door && !it.locked && this.world) {
      // a door: straight through, no question asked
      const w = this.world;
      if (this.hero && !this.hero.unlocked.includes(it.to as RegionId)) this.hero.unlocked.push(it.to as RegionId);
      this.sound.play('open');
      const { tier, mods } = w;
      const from = w.region.id;
      this.leave(() => this.travel(it.to as RegionId, tier, mods, from));
    } else if (it.kind === 'exit') {
      this.kbm?.release();
      this.touch.release();
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
    this.setUi({ travel: null });
    const { tier, mods } = w;
    const from = w.region.id;
    this.leave(() => this.travel(t.to, tier, mods, from));
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

  /** An act's title, once (it stands for the land's own title, if that hasn't come up yet). */
  private actBegins(act: ActDef): void {
    this.hero?.opened.push(`act:${act.id}`);
    // the narrator tells where the tale stands (its page is the act's title); an act with no telling has its card
    if (TALES[act.id]) this.pages.push({ kind: 'tale', act: act.id });
    else this.cards = [{ over: act.over, text: act.name, act: true }, ...this.cards.filter((c) => c.act)];
  }

  /**
   * The pages a quest's moment brings (StoryPage): what was found as its work was done (at the step that finds it, or
   * when the work is done), and, for a quest done out in the world, what it came to. A quest handed in or paid in a
   * talk tells its ending in the talk itself.
   */
  private storyOf(id: string, moment: 'step' | 'ready' | 'done'): void {
    const h = this.hero;
    const q = QUEST_DEFS[id];
    if (!h || !q) return;
    const find = q.find;
    const kept = h.opened.includes(`kept:${id}`) || this.pages.some((p) => p.kind === 'find' && p.quest === id) || this.ui.story?.kind === 'find' && this.ui.story.quest === id;
    if (find && !kept) {
      const step = h.quests[id]?.step ?? 0;
      const due = find.step !== undefined ? (moment === 'step' && step - 1 === find.step) || (moment !== 'step' && find.step >= questSteps(q).length - 1) : moment !== 'step';
      if (due) this.pages.push({ kind: 'find', quest: id });
    }
    if (moment === 'done' && q.reward.text && !q.quiet && !this.ui.dialogue) this.pages.push({ kind: 'deed', quest: id });
  }

  /** The next page of the story comes up, once nothing else holds the screen and the world has been calm a breath. */
  private turnPage(w: World, dt: number): void {
    const u = this.ui;
    if (u.dialogue || u.panel || u.travel || u.death || u.reward || u.tip || u.pause || w.scene || this.renderer.waiting || this.hidden) {
      this.pageCalm = 0;
      return;
    }
    const p = w.player;
    const fight = w.enemies.some((e) => !e.dead && !e.dummy && e.aggro && Math.abs(e.x - p.x) < 420 && Math.abs(e.y - p.y) < 320);
    // (blows still being traded, or a spell on its way, are a fight too, whoever is in sight)
    const busy = p.dead || w.story.talking || w.story.fighting || fight || p.calm < PAGE_AFTER_BLOWS || !!p.casting || !!p.channel || !!p.windup;
    this.pageCalm = busy ? 0 : this.pageCalm + dt;
    // a breath after the moment, once nobody is fighting or still saying their last words, and never before: however
    // long a fight goes on, the page waits for it to be over. A page used to come up anyway after eight seconds, and
    // the world stood still for it in the middle of the fight (the owner: "the pop ups for the story and letters come
    // out randomly during combat and with some delay")
    if (this.pageCalm < PAGE_BREATH) return;
    const page = this.pages.shift()!;
    this.pageCalm = 0;
    if (page.kind === 'find' && this.hero && !this.hero.opened.includes(`kept:${page.quest}`)) this.hero.opened.push(`kept:${page.quest}`);
    this.kbm?.release();
    this.touch.release();
    this.sound.play(page.kind === 'sigil' ? 'sigil' : page.kind === 'find' ? 'pickupBig' : page.kind === 'tale' ? 'bell' : 'quest');
    this.setUi({ story: page });
  }

  /** The page being read is put down; the next waits its own breath. */
  closeStory(): void {
    if (!this.ui.story) return;
    this.pageCalm = 0.3;
    // (one read again from the Journal goes back to it)
    const back = this.storyFromPanel;
    this.storyFromPanel = false;
    this.sound.play('close');
    if (back) this.questsView = 'journal';
    this.setUi(back ? { story: null, panel: 'quests' } : { story: null });
    this.scheduleSave(300);
  }

  /** A page read again from the Journal (a letter kept, the tale so far, a sigil won). */
  reread(page: StoryPage): void {
    this.storyFromPanel = true;
    this.sound.play('open');
    this.setUi({ panel: null, story: page });
  }

  /** Is the dialogue open a part of the story (anyone's who isn't only trading, or a quest given or taken back)? */
  storyTalk(): boolean {
    const d = this.ui.dialogue;
    return !!d && (d.pages.length > 0 || !NPCS[d.npc]?.shop);
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

  /** Gives up a side quest (progress/character.ts cantAbandon): back to its giver, offered again with nothing done. */
  abandonQuest(id: string): void {
    const h = this.hero;
    if (!h) return;
    const q = abandonQuest(h, id);
    if (!q) return;
    // (what the land shows for it, a marker while it's under way, goes with it)
    this.world?.refreshStoryState();
    this.toast(`Abandoned: ${q.name}`, 'info', undefined, `${NPCS[q.giver]?.name ?? 'Its giver'} can give it to you again.`);
    this.persist();
    this.bump();
  }

  /** A quest on the map: followed by the arrow and the tracker, and the map opened on the land where it is done. */
  showOnMap(id: string): void {
    this.trackQuest(id);
    this.openPanel('map', id);
  }

  /** The quest the open map was opened for (a click on it in the log or the tracker); opened any other way, none. */
  get mapQuestId(): string | null {
    return this.mapQuest;
  }

  /* -------------------------------------------------------------- panels */

  openPanel(p: PanelId, quest?: string): void {
    if (this.ui.screen !== 'game' || this.ui.death || this.ui.reward) return;
    this.kbm?.release();
    this.touch.release();
    this.sound.play('open');
    this.mapQuest = quest ?? null;
    // Settings opened from the pause menu goes back to it when closed (the player paused on purpose)
    this.panelFromPause = p === 'settings' && this.ui.pause;
    this.setUi({ panel: p, pause: false, dialogue: null });
  }

  /** The Quests page opened on its Journal (the tale so far, the crown, the things kept), or on the quests. */
  questsView: 'quests' | 'journal' = 'quests';
  openJournal(): void {
    this.questsView = 'journal';
    this.openPanel('quests');
  }
  /** The page of the Quests panel last looked at (it opens there again). */
  showQuestsView(v: 'quests' | 'journal'): void {
    this.questsView = v;
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

  /** A wager with the Riftbroker: Sigil Marks for an unseen piece for one slot (progress/rift.ts). */
  wager(slot: SlotId): Item | null {
    if (!this.hero) return null;
    const item = wager(this.hero, slot);
    if (!item) return null;
    this.sound.play(item.r === 'legendary' ? 'epic' : 'buy');
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
    const back = this.panelFromPause;
    this.panelFromPause = false;
    this.setUi(back ? { panel: null, pause: true } : { panel: null });
  }

  togglePause(): void {
    if (this.ui.screen !== 'game' || this.ui.tip) return;
    if (this.ui.story) return this.closeStory();
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
    // (Esc ends a scene, as it ends a film anywhere; the menus wait until it is over)
    if (this.world?.scene) {
      if (k === 'pause') this.skipScene();
      return;
    }
    // a hint is answered on its own buttons (Esc puts it away); the keys for the menus wait
    if (this.ui.tip) {
      if (k === 'pause') this.endTip();
      return;
    }
    // (a page of the story is put down with Esc too, as the page's own button does)
    if (this.ui.story) {
      if (k === 'pause') this.closeStory();
      return;
    }
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

  /**
   * On a touch screen, a piece just picked up that this hero would be better off wearing (progress/compare.ts, weighed
   * for their specialization) asks to be worn (ui/EquipAsk.tsx). The newest better piece takes the card's place.
   * Whether it asked.
   */
  private offerEquip(item: Item): boolean {
    const h = this.hero;
    if (!this.touchMode || !h || !h.bag.some((i) => i.uid === item.uid) || cantEquip(h, item)) return false;
    if (!compareGear(h, item).better) return false;
    this.ui = { ...this.ui, equipAsk: { uid: item.uid, id: performance.now() } };
    return true;
  }

  /** The answer to that card: wear it now, or leave it in the bag. */
  answerEquip(wear: boolean): void {
    const ask = this.ui.equipAsk;
    if (!ask) return;
    if (wear) this.equipItem(ask.uid);
    this.setUi({ equipAsk: null });
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

  /** Takes another of a talent choice's three in place of the one taken (progress/character.ts swapPick). */
  swapTalent(id: string): boolean {
    if (!this.hero || !swapPick(this.hero, id)) return false;
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
    // (the pointer over the potion has done its work)
    if (this.ui.teach?.slot === 'potion') this.setUi({ teach: null });
    this.bump();
  }

  /** Review presets are offered on the dev server and with `?review` in the address. */
  get reviewTools(): boolean {
    return import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('review'));
  }

  /**
   * The scene previewer (review tools only: POLISH_PLAN.md piece 12): plays a scene from one of its steps, in its own
   * land (the hero goes there first). The hero then plays for review, as a preset's does: no arcade scores.
   */
  previewScene(id: string, from = 0): boolean {
    const def = SCENES.find((d) => d.id === id);
    if (!def || !this.hero || !this.reviewTools) return false;
    this.hero.review = true;
    // (a review hero may see any land's scene: its land is opened for them, as a preset's is)
    if (!this.hero.unlocked.includes(def.region)) this.hero.unlocked.push(def.region);
    if (this.world?.region.id !== def.region && !this.travel(def.region, 0, [])) return false;
    this.ui = { ...this.ui, panel: null, pause: false };
    const ok = !!this.world && previewScene(this.world, id, from);
    this.bump();
    return ok;
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

  /** Takes a scene's next line (a tap or a click on the picture): the one being written is shown whole first. */
  sceneNext(): void {
    if (this.world?.scene) advanceScene(this.world);
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
  /** Wears a title ('' for none). */
  chooseTitle(id: string): boolean {
    const h = this.hero;
    if (!h || !chooseTitle(h, id, this.ringRating())) return false;
    this.refreshPartyCard();
    this.sound.play('click');
    this.scheduleSave(300);
    this.bump();
    return true;
  }

  /** The best rating the player has reached in The Ring, as this device remembers it (the Ring's titles ask). */
  ringRating(): number {
    return bestRating();
  }

  /**
   * The save's own copy of a hero a screen is holding. A copy of the save from the account (another device's, or this
   * one's come back merged: takeArrivedSave) puts new hero objects in place while a lobby is open, and the lobby's hero
   * is then no longer in the save: changing it changed nothing, and the Ring's "Title & armor" stopped answering (the
   * owner: "can't change character appearance for some reason after getting titles/equipment"). The same hero is the
   * one made at the same moment, of the same class.
   */
  private savedHero(h: Character): Character | null {
    if (this.save.heroes.includes(h)) return h;
    return this.save.heroes.find((x): x is Character => !!x && x.created === h.created && x.cls === h.cls) ?? null;
  }

  /**
   * One of the account's heroes dressed, or given a title, from outside the story (the Ring's lobby): what they wear
   * there is what they wear everywhere.
   */
  dress(asked: Character, slot: LookSlot, id: string | null): boolean {
    const hero = this.savedHero(asked);
    if (!hero || !wearLook(hero, slot, id)) return false;
    if (hero === this.hero) this.changed('equip');
    this.sound.play('equip');
    this.scheduleSave(300);
    this.bump();
    return true;
  }

  entitle(asked: Character, id: string): boolean {
    const hero = this.savedHero(asked);
    if (!hero || !chooseTitle(hero, id, this.ringRating())) return false;
    if (hero === this.hero) this.refreshPartyCard();
    this.sound.play('click');
    this.scheduleSave(300);
    this.bump();
    return true;
  }

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
    return { name: h.name, cls: h.cls, level: h.level, para: h.para.l, keystone: h.keystone, story, look: heroLook(h.cls, h.equip, worn, h.body, h.face), weapon: heldWeapon(h.cls, h.equip.weapon, worn.weapon) };
  }

  /** A party's leader was watching a story scene, as last heard (said once each time one starts). */
  private leaderWatching = false;

  /** Questing together, the leader stopped for a story scene: the others play on, and are told why (once). */
  noteLeaderScene(): void {
    const watching = this.coop?.role === 'guest' && this.coop.leaderScene;
    if (watching && !this.leaderWatching) this.partyNote('The leader is watching a scene', 'info');
    this.leaderWatching = watching;
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
    if (h.level < Math.max(COOP_LEVEL, MAX_LEVEL)) return `Riftstone runs with friends are for heroes at level ${Math.max(COOP_LEVEL, MAX_LEVEL)}.`;
    if (h.keystone < 1) return 'Clear Duskspire on Mythic to earn the Riftstone first.';
    return '';
  }

  /* ------------------------------------------------------------- friends */

  private startSocial(): void {
    // (the game shows its own invitations: the site's bar leaves them to it while it is open)
    // (the Ring's parties too: an invitation to team up there is shown here, not by the site)
    const a = claimInvites('sigilfall');
    const b = claimInvites('sigilfall-ring');
    this.stopClaim = () => {
      a();
      b();
    };
    this.socialStart = window.setTimeout(() => void this.checkSocial(), SOCIAL_FIRST_MS);
    this.socialTimer = window.setInterval(() => void this.checkSocial(), SOCIAL_EVERY_MS);
  }

  /**
   * Asks whether a friend wants this player, which also tells friends they are here; and keeps the friends list
   * fresh while the party panel is open. A guest has neither, and a hidden tab asks nothing (so a player who put
   * the game away is offline to their friends a couple of minutes later).
   */
  async checkSocial(): Promise<void> {
    if (this.hidden) return;
    if (!account.get().me) {
      if (this.invites.length || this.friends.view) {
        this.invites = [];
        this.friends = { view: null, state: 'idle', asked: {} };
        this.bump();
      }
      return;
    }
    try {
      const got = (await friendsApi.invites('sigilfall')).filter((i) => (i.game === 'sigilfall' || i.game === 'sigilfall-ring') && !!i.code && !this.inviteDone.has(i.id));
      const fresh = got.some((i) => !this.invites.some((x) => x.id === i.id));
      if (fresh || got.length !== this.invites.length) {
        this.invites = got;
        if (fresh) this.sound.play('quest');
        this.bump();
      }
    } catch {
      /* offline: it asks again in a moment */
    }
    if (this.ui.panel === 'party') void this.refreshFriends();
  }

  /** Fetches the friends list (the party panel asks as it opens). */
  async refreshFriends(): Promise<void> {
    if (!account.get().me || this.friends.state === 'loading') return;
    if (!this.friends.view) {
      this.friends = { ...this.friends, state: 'loading' };
      this.bump();
    }
    try {
      const view = await friendsApi.list();
      this.friends = { ...this.friends, view, state: 'ready' };
    } catch {
      this.friends = { ...this.friends, state: this.friends.view ? 'ready' : 'offline' };
    }
    this.bump();
  }

  /**
   * Adds a friend by the code they gave: straight onto the player's GlitchBound friends list, the same one the
   * site's Friends page shows. Returns '' when it worked, else what went wrong, in words.
   */
  async addFriend(code: string): Promise<string> {
    try {
      const view = await friendsApi.add(code);
      this.friends = { ...this.friends, view, state: 'ready' };
      this.bump();
      return '';
    } catch (e) {
      return FRIEND_ERRORS[(e as { code?: string } | null)?.code ?? ''] ?? 'That didn’t work. Try again in a moment.';
    }
  }

  /** Asks a friend into the party. With no party yet, a questing party is opened first (any level can join one). */
  async inviteFriend(id: string): Promise<void> {
    if (!this.hero) return;
    if (!this.party) await this.createParty('party');
    const code = this.party?.link.code;
    if (!code) return;
    this.friends = { ...this.friends, asked: { ...this.friends.asked, [id]: Date.now() } };
    this.bump();
    try {
      await friendsApi.invite(id, 'sigilfall', code);
    } catch {
      const asked = { ...this.friends.asked };
      delete asked[id];
      this.friends = { ...this.friends, asked };
      this.toast('The invitation didn’t go out. Try again in a moment.', 'warn');
      this.bump();
    }
  }

  /**
   * Takes a friend's invitation: into their party, here and now, with its panel open. From the hero list it waits
   * for a hero to be chosen, as an invitation by link does.
   */
  acceptInvite(id: number): void {
    const inv = this.invites.find((i) => i.id === id);
    this.answerInvite(id);
    if (!inv?.code) return;
    // a Ring party: to the Ring, by the title screen (a hero in the world is put away first, as going home is)
    if (inv.game === 'sigilfall-ring') {
      this.ringInvite = inv.code.toUpperCase();
      if (this.hero && this.ui.screen === 'game') this.toTitle();
      else this.bump();
      return;
    }
    if (this.hero && this.ui.screen === 'game') {
      this.joinParty(inv.code);
      this.openPanel('party');
    } else {
      this.invite = inv.code.toUpperCase();
      this.bump();
    }
  }

  /** Turns an invitation down: it goes, and the friend is told nothing. */
  declineInvite(id: number): void {
    this.answerInvite(id);
  }

  private answerInvite(id: number): void {
    this.inviteDone.add(id);
    this.invites = this.invites.filter((i) => i.id !== id);
    void friendsApi.done(id).catch(() => undefined);
    this.bump();
  }

  /** Opens a new party room and joins it (the host): for a Riftstone run, or questing together. */
  async createParty(mode: Mode = 'rift'): Promise<void> {
    if (this.party || !this.hero || (mode === 'rift' && this.partyReady())) return;
    this.modeWanted = mode;
    try {
      const link = await Link.create(this.hero!.name, this.partyHandlers());
      this.party = { link, view: null, state: 'connecting', error: '', note: '' };
      this.partyLeft = null;
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
    this.partyLeft = null;
    this.party = { link: new Link(c, this.hero.name, this.partyHandlers()), view: null, state: 'connecting', error: '', note: '' };
    this.bump();
  }

  /**
   * Back to the hero list. In a party's lobby the seat stays (a leader too: nobody else takes the party over)
   * and the party sees this player choosing a hero until the next one's card comes; anywhere else (a run under
   * way) the hero leaves the party as before.
   */
  standDownFromParty(): void {
    const party = this.party;
    if (!party) return;
    if (this.coop || party.view?.phase !== 'lobby') return this.leaveParty();
    this.cardSent = '';
    if (party.link.open) party.link.send({ t: 'nocard' });
    this.bump();
  }

  /** Leaves the party on purpose: the seat goes (a leader's party gets a new one, or its run ends). */
  leaveParty(): void {
    if (!this.party) return;
    if (this.coop) this.leaveCoopRun(false);
    this.party.link.send({ t: 'bye' });
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

  /** Questing together, the host or the leader brings everyone back to the lobby (the session ends there). */
  gatherParty(): void {
    this.party?.link.send({ t: 'end' });
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
          const why = (reason && PARTY_ERRORS[reason]) || reason || 'The party has closed.';
          const code = this.party.link.code;
          this.toast(why, 'warn');
          this.leaveParty();
          // the panel keeps saying why, with the code to try again
          this.partyLeft = { code, why };
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
    const before = party.view;
    party.view = v;
    party.error = '';
    if (before) this.noteChanges(before, v);
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
    // questing together a new leader took over (the last one left): everyone starts again behind them
    const relead = !!this.coop && v.phase === 'run' && v.mode === 'party' && v.run === this.partyRun && v.lead !== this.coop.host;
    if (relead) this.leaveCoopRun(false);
    if (v.phase === 'run' && (v.run !== this.partyRun || relead) && (v.plan || v.mode === 'party')) {
      // the run started (or this hero joined it under way): everyone goes, together (questing, where the
      // leader's game says)
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
        const name = lead?.card?.name ?? lead?.name ?? 'your party';
        this.partyNote(role === 'host' ? (relead ? 'You lead the party now: everyone follows you, in your story' : 'You lead the party: everyone follows you, in your story') : `Questing with ${name}: you follow them, in their story`, 'good');
        // the leader says where the party starts: here
        if (role === 'host' && this.world) party.link.send({ t: 'go', region: this.world.region.id, tier: this.world.tier });
      }
    } else if (this.coop) {
      const lead = v.seats.find((x) => x.n === this.coop!.host);
      if (v.phase !== 'run' || !lead) {
        // the run ended (the leader went home, or left the party): back to town, still in the party
        // (noteChanges has said who and why)
        this.leaveCoopRun(false);
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

  /** This hero leaves the party's run (the leader's leaving ends it for everyone, unless `end` is false). */
  private leaveCoopRun(end = true): void {
    const c = this.coop;
    if (!c) return;
    this.coop = null;
    this.leadAwayAt = 0;
    if (this.world) this.world.coop = null;
    if (end && c.role === 'host') this.party?.link.send({ t: 'end' });
  }

  /** The last party this hero was turned away from or dropped by, and why (the Play together panel says so). */
  partyLeft: { code: string; why: string } | null = null;

  /** Something happened to the party: a toast, and the line at the top of its panel. */
  private partyNote(text: string, tone: 'good' | 'warn' | 'info'): void {
    if (this.party) this.party.note = text;
    this.toast(text, tone);
  }

  /** What changed between two of the room's views, said to this player (who left, who leads, who ended it). */
  private noteChanges(a: PartyView, b: PartyView): void {
    const name = (v: PartyView, n: number): string => {
      const x = v.seats.find((s) => s.n === n);
      return x?.card?.name ?? x?.name ?? 'Someone';
    };
    for (const x of a.seats) if (x.n !== b.you && !b.seats.some((y) => y.n === x.n)) this.partyNote(`${name(a, x.n)} left the party`, 'info');
    for (const x of b.seats) if (!x.you && !a.seats.some((y) => y.n === x.n)) this.partyNote(`${name(b, x.n)} joined the party`, 'good');
    if (a.phase === 'run' && b.phase === 'lobby' && a.run === b.run) {
      const lead = a.lead;
      const gone = !b.seats.some((s) => s.n === lead);
      if (lead !== b.you) this.partyNote(gone ? `${name(a, lead)} left: the run is over` : `${name(a, lead)} ended the run`, 'warn');
      else this.partyNote('The run is over: the party is back in the lobby', 'info');
    }
    if (a.host !== b.host && b.host === b.you && b.phase === 'lobby') this.partyNote('You are the party’s host now', 'info');
    // in the lobby, a friend changing heroes: choosing one, then the new one
    if (b.phase === 'lobby')
      for (const y of b.seats) {
        const x = a.seats.find((s) => s.n === y.n);
        if (y.you || !x) continue;
        if (x.card && !y.card) this.partyNote(`${x.card.name} is choosing another hero`, 'info');
        else if (y.card && (!x.card || x.card.name !== y.card.name || x.card.cls !== y.card.cls))
          this.partyNote(`${x.card?.name ?? y.name} now plays ${y.card.name}, level ${y.card.level} ${CLASSES[y.card.cls as ClassId]?.name ?? ''}`.trim(), 'info');
      }
  }

  returnHome(): void {
    // only when the hero really went (a friend following a questing party can't walk home alone)
    if (this.travel(HOME, 0, [])) this.setUi({ death: false, reward: null });
  }

  /** A hero who may walk home from a death or the menu: not one following a questing party. */
  get canGoHome(): boolean {
    return !(this.coop && this.coop.role === 'guest' && this.party?.view?.mode === 'party' && this.party.view.phase === 'run');
  }

  closeReward(): void {
    this.setUi({ reward: null });
  }

  /**
   * From a cleared dungeon's card: out the way its portal goes (World.portalWay: the land at the dungeon's door, the
   * Riftward after a Riftstone run, Briarhollow only failing those). It had always said Briarhollow, while the portal
   * itself went to the right place (the owner, 2026-11-22).
   */
  leaveCleared(): void {
    const w = this.world;
    if (!w) return;
    const { tier, mods } = w;
    if (this.travel(w.portalWay().to, tier, mods, w.region.id)) this.setUi({ death: false, reward: null });
  }

  /**
   * The stone the playing hero may take into a dungeon: the deepest opened there by them, by another hero of their
   * calling or by its champion in the Riftstone tab (progress/trial.ts stoneIn).
   */
  openStone(region: RegionId): number {
    const h = this.hero;
    return h ? stoneIn(this.save, h.cls, region, h) : 1;
  }

  /** From a Riftstone run's end: the same dungeon again, at the stone open there now. */
  keyAgain(): void {
    const w = this.world;
    const h = this.hero;
    if (!w || !h || !w.keyRun?.end || h.keystone < 1) return;
    this.travel(w.region.id, 2, [], undefined, this.openStone(w.region.id));
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
    // the places this account plays: three, or all of them with the Gloamknight Pack
    for (let i = 0; i < heroSlots(account.get().me); i++) out.push(this.save.heroes[i] ?? null);
    return out;
  }
}
