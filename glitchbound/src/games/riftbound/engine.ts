import type { GameHost } from '../../platform/contract';
import { CLASSES } from './data/classes';
import { NPCS, QUEST_DEFS } from './data/quests';
import { REGIONS, TIERS, type RiftMod } from './data/regions';
import { SKILLS } from './data/skills';
import type { ClassId, Item, RegionId, SlotId } from './data/types';
import { KeyboardMouse, TouchState, type UiKey } from './input/input';
import { BAG_SIZE, equip, learnedSkills, learnTalent, MAX_POTIONS, newCharacter, questState, respec, salvage, setSkill, unequip, type Character } from './progress/character';
import { itemName } from './progress/items';
import { DEFAULT_SETTINGS, HERO_SLOTS, loadSave, writeSave, type LoadStatus, type SaveFile, type Settings } from './progress/save';
import { Renderer } from './render/renderer';
import { Sound, type MusicId } from './audio/sound';
import type { Interactable } from './sim/types';
import { emptyInput, World, type InputFrame } from './sim/world';

/**
 * The game around the simulation: heroes and the save, travelling between regions, expeditions
 * (reported to the arcade), the frame loop, sound, and the UI state the React layer shows.
 */

export type PanelId = 'hero' | 'skills' | 'talents' | 'quests' | 'map' | 'settings';

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
}

export interface UiState {
  screen: 'title' | 'create' | 'game';
  createSlot: number;
  panel: PanelId | null;
  pause: boolean;
  dialogue: { npc: string; lines: string[]; i: number } | null;
  travel: { to: RegionId; label: string; locked: string | null } | null;
  toasts: Toast[];
  banner: { text: string; sub?: string; id: number } | null;
  death: boolean;
  reward: RunSummary | null;
  boss: { name: string; title: string } | null;
  levelUp: { level: number; skills: string[]; id: number } | null;
  /** The load went wrong in a way the player should know about. */
  notice: string;
}

const STEP = 1 / 60;

export class RiftEngine {
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
  readonly frameHooks = new Set<(w: World, e: RiftEngine) => void>();
  private host: GameHost;
  private raf = 0;
  private last = 0;
  private saveAt = 0;
  private autosaveAt = 0;
  private deathAt = 0;
  private rewardAt = 0;
  private nextToast = 1;
  private run: { start: number; region: RegionId; tier: number; mods: RiftMod[] } | null = null;
  private hidden = false;
  /** Pause asked for by the arcade (left full screen, scrolled away). */
  private toWorldFn: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y });
  touchMode: boolean;
  dpr = 1;

  constructor(canvas: HTMLCanvasElement, host: GameHost, playerName: string) {
    this.host = host;
    this.renderer = new Renderer(canvas);
    const loaded = loadSave();
    this.save = loaded.save;
    this.loadStatus = loaded.status;
    this.canSave = loaded.status !== 'newer' && loaded.status !== 'blocked';
    this.touchMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.defaultName = playerName;
    this.ui = {
      screen: 'title',
      createSlot: 0,
      panel: null,
      pause: false,
      dialogue: null,
      travel: null,
      toasts: [],
      banner: null,
      death: false,
      reward: null,
      boss: null,
      levelUp: null,
      notice:
        loaded.status === 'recovered'
          ? 'Your last save could not be read, so your previous save was restored.'
          : loaded.status === 'reset'
            ? 'Your save could not be read and was set aside. Starting fresh.'
            : loaded.status === 'newer'
              ? 'This save is from a newer version of Riftbound. Reload the page to continue it. Nothing will be saved until then.'
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
    this.endRun(false);
    this.persist();
    this.kbm?.dispose();
    this.sound.dispose();
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
    const w = this.world;
    if (!w || this.ui.screen !== 'game') {
      if (this.ui.screen !== 'game') this.sound.setMusic('title');
      return;
    }
    const paused = this.isPaused();
    const f: InputFrame = emptyInput();
    if (!paused) {
      this.touch.fill(f);
      this.kbm?.fill(f, this.toWorldFn, w.player.x, w.player.y);
      // touch: aim with the stick when the mouse isn't in use
      if (this.touchMode) {
        f.aim = null;
        f.aimX = null;
        f.aimY = null;
      }
      for (const c of f.casts) if (c.angle !== null && this.touchMode) c.assist = this.settings.aimAssist;
      if (f.holdBasic && this.touchMode && f.holdBasic.angle !== null) f.holdBasic.assist = this.settings.aimAssist;
      let acc = dt;
      let first = true;
      let steps = 0;
      while (acc > 1e-6 && steps < 8) {
        const s = Math.min(acc, STEP);
        w.input = first ? f : { ...f, casts: [], potion: false, interact: false };
        w.step(s);
        acc -= s;
        first = false;
        steps += 1;
      }
      if (this.hero) this.hero.stats.time += dt;
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
    if (this.ui.toasts.some((x) => x.until < t)) this.setUi({ toasts: this.ui.toasts.filter((x) => x.until >= t) });
    if (this.ui.banner && t - this.ui.banner.id > 2600) this.setUi({ banner: null });
    if (this.ui.levelUp && t - this.ui.levelUp.id > 3600) this.setUi({ levelUp: null });
    const boss = w.boss();
    this.sound.setMusic(boss && !boss.dead ? 'boss' : (REGIONS[w.region.id].music as MusicId));
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
          const h = this.hero!;
          const skills = [...learnedSkills(h), CLASSES[h.cls].ult].filter((id) => SKILLS[id]?.unlock === ev.level);
          this.ui = { ...this.ui, levelUp: { level: ev.level, skills, id: performance.now() } };
          changed = true;
          if (skills.includes(CLASSES[h.cls].ult)) this.hint('ult');
          break;
        }
        case 'questDone': {
          const q = QUEST_DEFS[ev.quest];
          if (q) this.toast(`Quest complete: ${q.name}`, 'quest', undefined, q.reward.text);
          break;
        }
        case 'questStart':
          newQuests.push(ev.quest);
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
        case 'hero':
        case 'quest':
        case 'discover':
          changed = true;
          break;
        default:
          break;
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
    const t: Toast = { id: this.nextToast++, text, tone, item, sub, until: performance.now() + (tone === 'loot' ? 5000 : tone === 'hint' ? 6000 : 3600) };
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
    const text =
      id === 'equip'
        ? touch
          ? 'New gear! Tap the bag to look at it and equip it.'
          : 'New gear! Press I (or click the bag) to equip it.'
        : id === 'talent'
          ? touch
            ? 'You have a talent point: tap the star.'
            : 'You have a talent point: press K.'
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

  /* ------------------------------------------------------------- saving */

  scheduleSave(ms: number): void {
    const at = performance.now() + ms;
    if (!this.saveAt || at < this.saveAt) this.saveAt = at;
  }

  persist(): void {
    if (!this.canSave) return;
    if (this.hero) {
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
    if (this.kbm) this.kbm.ultKey = s.ultKey;
    if (this.world) this.world.settings = s;
  }

  resetSettings(): void {
    this.setSettings({ ...DEFAULT_SETTINGS, rotateSeen: this.settings.rotateSeen });
  }

  /* ------------------------------------------------------------- heroes */

  newHeroScreen(slot: number): void {
    this.setUi({ screen: 'create', createSlot: slot });
  }

  createHero(slot: number, cls: ClassId, name: string): void {
    const c = newCharacter(cls, name || this.defaultName, `hero${slot}`);
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
    h.potions = MAX_POTIONS;
    this.ui = { ...this.ui, screen: 'game', panel: null, pause: false, dialogue: null, travel: null, death: false, reward: null, boss: null, toasts: [] };
    this.travel('emberwick', 0, []);
    this.sound.unlock();
    // a brand-new hero meets the elder first
    if (questState(h, 'first-steps') === 'active' && h.quests['first-steps']?.n === 0 && h.level === 1 && h.stats.time < 1) this.talk('maren');
    this.bump();
  }

  toTitle(): void {
    this.endRun(false);
    this.persist();
    this.world = null;
    this.hero = null;
    this.setUi({ screen: 'title', panel: null, pause: false, dialogue: null, travel: null, death: false, reward: null, boss: null, toasts: [], levelUp: null, banner: null });
  }

  /* ------------------------------------------------------------- travel */

  travel(to: RegionId, tier: number, mods: RiftMod[], from?: RegionId): void {
    const h = this.hero;
    if (!h) return;
    const region = REGIONS[to];
    if (!h.unlocked.includes(to)) return;
    const prev = this.world;
    if (prev) this.collectLeftovers(prev, true);
    // expeditions: leaving the village starts one, coming back ends it
    if (region.safe) this.endRun(true);
    else if (!this.run) this.startRun(to, tier, mods);
    else this.run.region = to;
    const keepTier = this.run ? this.run.tier : tier;
    const w = new World({ region: to, tier: region.safe ? 0 : keepTier, mods: region.safe ? [] : (this.run?.mods ?? mods), hero: h, settings: this.settings, seed: (Math.random() * 2 ** 32) >>> 0, from });
    if (prev && !prev.region.safe && this.run) {
      // carry this expedition's tallies across regions
      w.run = prev.run;
    }
    if (prev) w.player.ult = prev.player.ult;
    if (region.safe) h.potions = MAX_POTIONS;
    this.world = w;
    this.renderer.snap(w);
    this.ui = { ...this.ui, panel: null, travel: null, dialogue: null, boss: null, death: false, banner: { text: region.name, sub: region.safe ? region.subtitle : `${region.subtitle}${w.tier ? ` · ${TIERS[w.tier]!.name}` : ''}`, id: performance.now() } };
    this.persist();
    this.bump();
  }

  private startRun(region: RegionId, tier: number, mods: RiftMod[]): void {
    this.run = { start: performance.now(), region, tier, mods };
    if (this.hero) this.hero.stats.runs += 1;
    this.host.report({ type: 'start' });
  }

  /** Loot still lying in a region goes with the hero (it is never left behind by leaving). */
  private collectLeftovers(w: World, leaving: boolean): void {
    const got = w.collectAll();
    if (got.items > 0 && this.hero) {
      const over = this.hero.bag.length > BAG_SIZE;
      this.toast(`${leaving ? 'Picked up' : 'Collected'} ${got.items} item${got.items === 1 ? '' : 's'} ${leaving ? 'you left behind' : 'from the fight'}`, 'loot', undefined, over ? 'Your bag is over-full: salvage or wear something to pick up more.' : undefined);
    }
    if (got.salvaged > 0) this.toast(`Your bag was full: the rest became ${got.salvaged} gold`, 'warn');
  }

  private summary(cleared: boolean): RunSummary {
    const w = this.world;
    const r = w?.run ?? { xp: 0, gold: 0, kills: 0, bosses: 0, items: [] };
    return { region: this.run?.region ?? w?.region.id ?? 'emberwick', tier: this.run?.tier ?? 0, xp: r.xp, gold: r.gold, kills: r.kills, bosses: r.bosses, items: r.items, seconds: this.run ? (performance.now() - this.run.start) / 1000 : 0, cleared };
  }

  /** An expedition ends (home, or the game closes): its score goes to the arcade. */
  private endRun(toast: boolean): void {
    if (!this.run || !this.hero) {
      this.run = null;
      return;
    }
    const s = this.summary(false);
    const score = Math.round(s.xp + s.gold * 2 + s.bosses * 250);
    this.hero.stats.bestRun = Math.max(this.hero.stats.bestRun, score);
    this.host.report({ type: 'end', score, stats: { level: this.hero.level, kills: s.kills, bosses: s.bosses } });
    if (toast && (s.kills || s.items.length)) this.toast(`Expedition over: +${s.xp} XP, +${s.gold} gold`, 'good', undefined, `${s.kills} foes defeated${s.items.length ? ` · ${s.items.length} items` : ''}`);
    this.run = null;
  }

  /** Talk, travel or leave, depending on what is in front of the hero. */
  interact(it: Interactable): void {
    if (it.kind === 'npc') this.talk(it.id);
    else if (it.kind === 'waystone') this.openPanel('map');
    else if (it.kind === 'exit') {
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
    const entry = npc.talk.find((t) => !t.when || questState(h, t.when.quest) === t.when.state) ?? npc.talk[npc.talk.length - 1]!;
    this.kbm?.release();
    this.touch.release();
    this.sound.play('open');
    this.setUi({ dialogue: { npc: npcId, lines: entry.lines, i: 0 } });
  }

  nextLine(): void {
    const d = this.ui.dialogue;
    if (!d) return;
    if (d.i + 1 < d.lines.length) this.setUi({ dialogue: { ...d, i: d.i + 1 } });
    else this.setUi({ dialogue: null });
  }

  closeDialogue(): void {
    this.setUi({ dialogue: null });
  }

  /* -------------------------------------------------------------- panels */

  openPanel(p: PanelId): void {
    if (this.ui.screen !== 'game' || this.ui.death || this.ui.reward) return;
    this.kbm?.release();
    this.touch.release();
    this.sound.play('open');
    this.setUi({ panel: p, pause: false, dialogue: null });
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

  assignSkill(slot: 0 | 1 | 2, id: string | null): void {
    if (!this.hero || !setSkill(this.hero, slot, id)) return;
    this.changed('click');
  }

  drinkPotion(): void {
    this.world?.drinkPotion();
    this.bump();
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

  returnHome(): void {
    this.setUi({ death: false, reward: null });
    this.travel('emberwick', 0, []);
  }

  closeReward(): void {
    this.setUi({ reward: null });
  }

  /** Heroes in the save, for the title screen. */
  heroes(): (Character | null)[] {
    const out: (Character | null)[] = [];
    for (let i = 0; i < HERO_SLOTS; i++) out.push(this.save.heroes[i] ?? null);
    return out;
  }
}
