import { World, type WorldEvent } from './game/world';
import { Autopilot } from './game/autopilot';
import { SIM_DT, type PowerUpKind, POWERUPS } from './game/config';
import { GameRenderer } from './render/renderer';
import { Input } from './input/input';
import { UI, fmt } from './ui/ui';
import { GarageView, renderDaily, renderGameOver, renderMissions, renderProfileChrome, renderStore } from './ui/views';
import { SAVE_KEY, SaveManager, browserStore } from './progression/storage';
import { challengeKey, mergeChallengeRounds, putChallengeRound, type ChallengeRound, type Profile, type Settings } from './progression/profile';
import { finishRun, grantRewardOnce, type RunSummary } from './progression/run';
import { claimDaily, canClaimDaily } from './progression/daily';
import { evaluateAchievements } from './progression/achievements';
import { ensureChallengeDay } from './progression/challenges';
import { buySkin, equipSkin, unequipSkin } from './cosmetics/shop';
import { getSkin } from './cosmetics/skins';
import { AdManager } from './monetization/ads';
import { grantPurchase, type PurchaseProvider } from './monetization/purchases';
import { selectProviders } from './monetization/providers';
import { LocalAnalytics } from './analytics/analytics';
import { listenToHost, notifyHost, runEndMessage, type HostCommand } from './analytics/embed';
import { createBackend, type BackendService } from './backend/backend';
import { dayKey } from './core/dates';
import type { AudioEngine, Sfx } from './audio/audio';

type GameState = 'menu' | 'playing' | 'paused' | 'crashing' | 'gameover';
type Page = 'garage' | 'missions' | 'settings';

const POWER_COLORS: Record<PowerUpKind, string> = { magnet: '#ff3fd2', shield: '#22e4ff', double: '#ffc21a' };
const POWER_LABEL: Record<PowerUpKind, string> = { magnet: 'MAGNET', shield: 'SHIELD', double: '2X COINS' };

export class App {
  private state: GameState = 'menu';
  private page: Page | null = null;
  private dailyOpen = false;
  /** A friends' challenge round from the arcade: every run uses this seed while it is set. */
  private challengeSeed: number | null = null;
  /** The run on screen is the challenge round's one counted attempt. */
  private challengeRun = false;
  /** The run on screen is reported to the arcade (not a practice run beside a challenge). */
  private reporting = true;
  /** The challenge round was found already started when the game loaded, and was ended for it. */
  private staleRound = false;
  private checkpointAt = 0;
  /** Car details popup over the garage. */
  private carOpen = false;
  private world!: World;
  private attract = true;
  private pilot = new Autopilot(0.06);
  private acc = 0;
  private crashTimer = 0;
  private runId = '';
  private lastSummary: RunSummary | null = null;
  private profile: Profile;
  private readonly saves: SaveManager;
  private readonly ui = new UI();
  private renderer!: GameRenderer;
  private input!: Input;
  private garage!: GarageView;
  private audio: AudioEngine | null = null;
  private audioLoading = false;
  private readonly ads: AdManager;
  private readonly purchases: PurchaseProvider;
  private readonly analytics = new LocalAnalytics(import.meta.env.DEV);
  readonly backend: BackendService;
  private powerPills = new Map<PowerUpKind, { el: HTMLElement; bar: HTMLElement }>();
  private lastCoins = -1;
  private events: WorldEvent[] = [];

  constructor() {
    this.saves = new SaveManager(browserStore());
    const loaded = this.saves.load();
    this.profile = loaded.profile;
    if (loaded.status === 'recovered') this.ui.toast('Your save data was damaged, so a fresh profile was started.', 'bad');

    const env = import.meta.env;
    const mon = selectProviders(
      {
        DEV: env.DEV,
        VITE_AD_PROVIDER: env.VITE_AD_PROVIDER,
        VITE_PURCHASE_PROVIDER: env.VITE_PURCHASE_PROVIDER,
        VITE_ADSENSE_CLIENT: env.VITE_ADSENSE_CLIENT,
        VITE_ADSENSE_TEST: env.VITE_ADSENSE_TEST,
        VITE_ADS_ENABLED: env.VITE_ADS_ENABLED,
      },
      { presentMockAd: this.ui.presentMockAd, confirmMockPurchase: this.ui.confirmMockPurchase },
      {
        soundOn: () => this.profile.settings.sfxVolume > 0 || this.profile.settings.musicVolume > 0,
        onAdStart: () => void this.audio?.suspend(),
        onAdEnd: () => void this.audio?.resume(),
      },
    );
    this.ads = new AdManager(mon.ads, mon.adPolicy, {
      isRunActive: () => this.state === 'playing' || this.state === 'paused' || this.state === 'crashing',
      hasNoAdsEntitlement: () => this.profile.entitlements.includes('no_ads'),
    });
    this.purchases = mon.purchases;
    this.backend = createBackend(env);
    void this.ads.provider.init().catch(() => undefined);
  }

  async boot(): Promise<void> {
    const gameEl = document.getElementById('game');
    if (!gameEl) throw new Error('#game missing');
    this.renderer = await GameRenderer.create(gameEl, this.renderSettings());
    this.renderer.setSkin(this.profile.equippedSkin);
    this.garage = new GarageView(this.ui, { preview: (s) => this.renderer.art.skinPreview(s) });
    this.garage.selected = this.profile.equippedSkin;
    this.newAttractWorld();

    this.input = new Input(gameEl, {
      steer: (dir) => {
        if (this.state === 'playing') this.world.steer(dir);
      },
      pause: () => {
        if (this.carOpen) this.closeCar();
        else if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      },
      confirm: () => {
        if (this.ui.isActive('confirm') || this.ui.isActive('mock')) return;
        if (this.state === 'menu' && !this.page && !this.dailyOpen) this.startRun();
        else if (this.state === 'paused') this.resume();
      },
      gesture: () => void this.unlockAudio(),
    });

    this.bindActions();
    this.buildPowerPills();
    this.applySettings();
    this.ui.text('version', __APP_VERSION__);
    if (this.ads.provider.name === 'adsense-h5') {
      const privacy = document.querySelector('#screen-settings .settings-section:last-of-type p');
      if (privacy) {
        privacy.textContent =
          'No account needed. Progress is saved on this device. Ads are provided by Google, which may use cookies to serve and measure ads; see policies.google.com/technologies/ads.';
        const link = document.createElement('a');
        link.className = 'link';
        link.href = './privacy.html';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = ' Privacy policy';
        privacy.append(link);
      }
    }
    this.ui.text(
      'controlsHint',
      window.matchMedia('(pointer: coarse)').matches ? 'Tap the left or right side to switch lanes' : 'Arrow keys / A D, or click left / right to switch lanes',
    );
    this.ui.onClickSound = () => this.sfx('click');

    document.addEventListener('visibilitychange', this.onVisibility);
    listenToHost((c) => this.onHostCommand(c));
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pagehide', () => {
      this.checkpoint();
      this.saves.save(this.profile);
    });
    // Another tab (or the standalone game) saved: carry on from its save, not a stale copy.
    window.addEventListener('storage', (e) => {
      if (e.key === SAVE_KEY || e.key === null) this.adoptStoredSave();
    });

    this.renderer.app.ticker.add((t) => {
      this.renderer.trackFrame(t.deltaMS, this.state === 'playing' || this.state === 'menu');
      this.frame(Math.min(t.deltaMS / 1000, 0.05));
      this.renderer.setStill(this.state === 'paused');
    });
    this.toMenu();
    this.analytics.track('boot', { ads: this.ads.provider.name, purchases: this.purchases.name });

    // Dev-only hook for automated QA in the browser. Stripped from production builds.
    if (import.meta.env.DEV) (window as unknown as { __neon: unknown }).__neon = this;

    if (canClaimDaily(this.profile, this.today())) window.setTimeout(() => this.state === 'menu' && !this.page && this.challengeSeed === null && this.openDaily(), 700);
  }

  // ------------------------------------------------------------------ helpers

  private today(): string {
    return dayKey(new Date());
  }

  private save(): void {
    this.saves.save(this.profile);
  }

  private renderSettings() {
    return { lowQuality: this.profile.settings.lowQuality, screenShake: this.profile.settings.screenShake };
  }

  private sfx(s: Sfx): void {
    this.audio?.play(s);
  }

  private vibrate(ms: number | number[]): void {
    const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
    if (this.profile.settings.vibration && activated && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* unsupported */
      }
    }
  }

  /** Audio is lazy-loaded on the first user gesture (browsers require a gesture anyway). */
  private async unlockAudio(): Promise<void> {
    if (this.audio) {
      if (!document.hidden && this.state !== 'paused') void this.audio.resume();
      return;
    }
    if (this.audioLoading) return;
    this.audioLoading = true;
    try {
      const { AudioEngine } = await import('./audio/audio');
      this.audio = new AudioEngine();
      this.audio.setVolumes(this.profile.settings.sfxVolume, this.profile.settings.musicVolume);
      this.audio.setIntensity(this.state === 'playing' ? 1 : 0);
      await this.audio.resume();
      this.audio.startMusic();
    } catch (err) {
      console.warn('[audio] unavailable', err);
    }
  }

  private newAttractWorld(): void {
    this.world = new World({ seed: (Math.random() * 2 ** 31) | 0, viewHeight: this.renderer.viewHeight });
    this.world.distanceUnits = 400 * 20; // a little traffic for the demo
    this.attract = true;
  }

  private updateScreens(): void {
    if (this.page) {
      this.ui.setScreens(this.page === 'garage' && this.carOpen ? ['garage', 'car'] : [this.page]);
      return;
    }
    switch (this.state) {
      case 'menu':
        this.ui.setScreens(this.dailyOpen ? ['title', 'daily'] : ['title']);
        break;
      case 'playing':
      case 'crashing':
        this.ui.setScreens(['hud']);
        break;
      case 'paused':
        this.ui.setScreens(['hud', 'pause']);
        break;
      case 'gameover':
        this.ui.setScreens(['gameover']);
        break;
    }
  }

  private refreshChrome(): void {
    renderProfileChrome(this.ui, this.profile, this.today());
    this.renderChallenge();
  }

  private challengeRound(): ChallengeRound | undefined {
    return this.challengeSeed === null ? undefined : this.profile.challengeRounds[challengeKey(this.challengeSeed)];
  }

  /** The title screen during a friends' challenge: the round card instead of the best score. */
  private renderChallenge(): void {
    const on = this.challengeSeed !== null;
    const round = this.challengeRound();
    this.ui.show('chalCard', on);
    this.ui.show('bestLine', !on);
    this.ui.text('playBtn', on && round?.done ? 'PRACTICE' : 'PLAY');
    if (!on) return;
    if (!round?.done) {
      this.ui.text('chalTitle', 'CHALLENGE ROUND');
      this.ui.text('chalText', 'This run counts: one attempt, the same traffic for everyone.');
    } else if (this.staleRound) {
      this.ui.text('chalTitle', 'ROUND ALREADY STARTED');
      this.ui.text('chalText', `This round was already started, so it ended with ${fmt(round.score)} points. Practice runs don't count.`);
    } else {
      this.ui.text('chalTitle', 'YOUR RUN IS IN');
      this.ui.text('chalText', `You scored ${fmt(round.score)}. Practice runs use other traffic and don't count.`);
    }
  }

  /** Keep the challenge round's progress in the save, so a reload can't replay it. */
  private checkpoint(): void {
    if (!this.challengeRun || this.challengeSeed === null || this.attract) return;
    const s = this.world.stats;
    putChallengeRound(this.profile, challengeKey(this.challengeSeed), { score: s.score, meters: Math.floor(s.meters), coins: s.coins, nearMisses: s.nearMisses, done: false });
  }

  private adoptStoredSave(): void {
    const fresh = this.saves.load().profile;
    mergeChallengeRounds(fresh, this.profile);
    this.profile = fresh;
    if (this.state !== 'playing' && this.state !== 'paused' && this.state !== 'crashing') this.renderer.setSkin(this.profile.equippedSkin);
    this.applySettings();
    if (this.page === 'garage') this.garage.render(this.profile);
    this.refreshChrome();
  }

  // ------------------------------------------------------------------ flow

  private toMenu(): void {
    this.state = 'menu';
    this.acc = 0;
    this.page = null;
    this.input.enabled = false;
    if (!this.attract || this.world.crashed) this.newAttractWorld();
    this.renderer.clearTransient();
    this.audio?.setIntensity(0);
    this.refreshChrome();
    this.updateScreens();
  }

  private startRun(): void {
    if (this.ui.isActive('mock')) return;
    this.page = null;
    this.dailyOpen = false;
    // A challenge round is played once on its seed; runs after it are practice on other traffic.
    this.challengeRun = this.challengeSeed !== null && !this.challengeRound()?.done;
    this.reporting = this.challengeSeed === null || this.challengeRun;
    const seed = this.challengeRun && this.challengeSeed !== null ? this.challengeSeed : (Math.random() * 2 ** 31) | 0;
    this.world = new World({ seed, viewHeight: this.renderer.viewHeight });
    this.attract = false;
    this.runId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    this.acc = 0;
    this.lastCoins = -1;
    this.lastSummary = null;
    this.renderer.clearTransient();
    this.state = 'playing';
    this.input.enabled = true;
    this.updateScreens();
    // Restart the GO animation.
    const go = this.ui.el('hudGo');
    go.hidden = true;
    void go.offsetWidth;
    go.hidden = false;
    this.ui.show('hudTutorial', this.profile.gamesPlayed < 3);
    this.sfx('go');
    this.audio?.setIntensity(1);
    void this.unlockAudio();
    this.analytics.track('run_start', { games: this.profile.gamesPlayed });
    this.checkpointAt = 0;
    if (this.challengeRun) {
      this.checkpoint();
      this.save();
    }
    if (this.reporting) notifyHost({ type: 'start' });
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.syncPauseToggles();
    // A challenge round has one attempt: no Restart or Main menu that would throw it away.
    this.ui.show('pauseNote', this.challengeRun);
    this.ui.show('pauseRestart', !this.challengeRun);
    this.ui.show('pauseHome', !this.challengeRun);
    this.checkpoint();
    this.save();
    this.updateScreens();
    this.audio?.setIntensity(0);
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.acc = 0;
    this.input.enabled = true;
    this.updateScreens();
    this.audio?.setIntensity(1);
    void this.audio?.resume();
  }

  private onCrash(): void {
    this.state = 'crashing';
    this.crashTimer = 0;
    this.checkpoint();
    this.input.enabled = false;
    this.sfx('crash');
    this.vibrate([60, 40, 120]);
  }

  /** Apply the finished run once and show the summary. */
  private endRun(show = true, abandoned = false): RunSummary | null {
    const summary = finishRun(this.profile, this.runId, { ...this.world.stats }, this.today(), Date.now(), abandoned);
    if (!summary) return null;
    const wasChallenge = this.challengeRun;
    this.challengeRun = false;
    if (wasChallenge && !abandoned && this.challengeSeed !== null) {
      const s = summary.stats;
      putChallengeRound(this.profile, challengeKey(this.challengeSeed), { score: s.score, meters: Math.floor(s.meters), coins: s.coins, nearMisses: s.nearMisses, done: true });
      this.staleRound = false;
    }
    this.save();
    this.lastSummary = summary;
    this.ads.onRunCompleted();
    this.analytics.track('run_end', { score: summary.stats.score, meters: Math.floor(summary.stats.meters), coins: summary.stats.coins });
    // Practice beside a challenge is never reported, nor is a challenge run left unfinished.
    if (this.reporting && !(wasChallenge && abandoned)) notifyHost(runEndMessage(summary.stats));
    if (show) {
      this.state = 'gameover';
      renderGameOver(this.ui, summary, this.profile);
      const practice = this.challengeSeed !== null && !wasChallenge;
      this.ui.show('goChallenge', wasChallenge || practice);
      this.ui.text('goChallenge', wasChallenge ? `Your challenge score is in: ${fmt(summary.stats.score)}. The scoreboard shows how everyone did.` : 'Practice run: not counted in the challenge.');
      this.ui.text('goAgain', this.challengeSeed !== null ? 'Practice (not counted)' : 'Play again');
      const canAd = this.ads.canOfferRewarded() && summary.rewards.coinsCollected > 0;
      this.ui.show('adOffer', canAd);
      this.ui.text('adAmount', fmt(summary.rewards.coinsCollected));
      (this.ui.el('adOffer').querySelector('button') as HTMLButtonElement).disabled = false;
      this.audio?.setIntensity(0);
      if (summary.levelUps.length > 0 || summary.achievements.length > 0) window.setTimeout(() => this.sfx('levelUp'), 350);
      this.refreshChrome();
      this.updateScreens();
    }
    return summary;
  }

  /** Leaving a run from the pause menu still pays out what was earned. */
  private abandonRun(): void {
    if (this.state !== 'paused') return;
    const s = this.endRun(false, true);
    if (s && s.rewards.coinsEarned > 0) this.ui.toast(`+${fmt(s.rewards.coinsEarned)} coins banked`, 'good');
  }

  /** Between-runs ads only ever happen here, after a completed run and before the next action. */
  private async afterGameOver(next: () => void): Promise<void> {
    await this.ads.maybeShowInterstitial();
    next();
  }

  private openPage(page: Page): void {
    this.page = page;
    this.carOpen = false;
    if (page === 'garage') {
      this.garage.selected = this.profile.equippedSkin;
      this.garage.render(this.profile);
      this.ui.selectTab(this.ui.screen('garage'), 'skins');
      const storeOn = this.purchases.isAvailable();
      this.ui.show('storeTab', storeOn);
      if (storeOn) void this.purchases.getProducts().then((p) => renderStore(this.ui, p, this.profile, this.purchases.isMock));
    }
    if (page === 'missions') {
      ensureChallengeDay(this.profile, this.today());
      renderMissions(this.ui, this.profile, this.today(), new Date());
    }
    if (page === 'settings') this.syncSettingsInputs();
    this.refreshChrome();
    this.updateScreens();
  }

  private openCar(skinId: string): void {
    this.garage.selected = skinId;
    this.garage.render(this.profile);
    this.carOpen = true;
    this.updateScreens();
  }

  private closeCar(): void {
    this.carOpen = false;
    this.updateScreens();
  }

  private closePage(): void {
    this.carOpen = false;
    this.page = null;
    if (this.state === 'gameover' && this.lastSummary) renderGameOver(this.ui, this.lastSummary, this.profile);
    this.refreshChrome();
    this.updateScreens();
  }

  private openDaily(): void {
    this.dailyOpen = true;
    renderDaily(this.ui, this.profile, this.today());
    this.updateScreens();
  }

  // ------------------------------------------------------------------ actions

  private bindActions(): void {
    const ui = this.ui;
    ui.on('play', () => this.startRun());
    ui.on('pause', () => this.pause());
    ui.on('resume', () => this.resume());
    ui.on('restart', () => {
      if (this.state === 'paused') {
        this.abandonRun();
        this.startRun();
      } else if (this.state === 'gameover') void this.afterGameOver(() => this.startRun());
    });
    ui.on('home', () => {
      if (this.state === 'paused') {
        this.abandonRun();
        this.toMenu();
      } else if (this.state === 'gameover') void this.afterGameOver(() => this.toMenu());
      else this.toMenu();
    });
    ui.on('garage', () => this.openPage('garage'));
    ui.on('missions', () => this.openPage('missions'));
    ui.on('settings', () => this.openPage('settings'));
    ui.on('hostMenu', () => {
      if (this.state === 'playing') this.pause();
      notifyHost({ type: 'menu' });
    });
    ui.on('back', () => this.closePage());
    ui.on('daily', () => this.openDaily());
    ui.on('closeModal', () => {
      this.dailyOpen = false;
      this.updateScreens();
    });
    ui.on('claimDaily', () => {
      const r = claimDaily(this.profile, this.today());
      if (!r) return;
      this.save();
      this.sfx('buy');
      ui.toast(`+${r.amount} coins · day ${r.streak} streak`, 'good');
      renderDaily(ui, this.profile, this.today());
      this.refreshChrome();
      window.setTimeout(() => {
        this.dailyOpen = false;
        if (this.state === 'menu') this.updateScreens();
      }, 600);
    });

    ui.on('watchAd', (el) => void this.watchRewardedAd(el as HTMLButtonElement));

    // Garage
    ui.on('selectSkin', (el) => this.openCar(el.dataset.skin ?? this.garage.selected));
    ui.on('closeCar', () => this.closeCar());
    // Tapping the dimmed backdrop closes the popup too.
    ui.screen('car').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeCar();
    });
    ui.on('garageFilter', (el) => {
      this.garage.setFilter(el.dataset.filter ?? 'all');
      this.garage.render(this.profile);
    });
    ui.on('skinPrimary', (el) => void this.skinPrimary(el.dataset.mode ?? ''));
    ui.on('buyProduct', (el) => void this.buyProduct(el.dataset.product ?? ''));

    // Settings
    ui.on('resetProgress', async () => {
      const ok = await ui.confirm('Reset progress?', 'This permanently erases your coins, cars, records and achievements on this device.', 'Reset');
      if (!ok) return;
      this.profile = this.saves.reset();
      this.renderer.setSkin(this.profile.equippedSkin);
      this.applySettings();
      this.syncSettingsInputs();
      this.refreshChrome();
      ui.toast('Progress reset', 'info');
    });
    for (const input of ui.root.querySelectorAll<HTMLInputElement>('[data-setting]')) {
      input.addEventListener('input', () => this.onSettingInput(input));
      input.addEventListener('change', () => this.onSettingInput(input));
    }
  }

  private async watchRewardedAd(btn: HTMLButtonElement): Promise<void> {
    const summary = this.lastSummary;
    if (!summary || this.state !== 'gameover') return;
    btn.disabled = true;
    const res = await this.ads.showRewarded('double_coins');
    if (res.status === 'completed') {
      const amount = summary.rewards.coinsCollected;
      // Keyed by run: a second callback or a second tap can never pay twice.
      if (grantRewardOnce(this.profile, `ad:double:${summary.runId}`, amount)) {
        this.save();
        this.sfx('buy');
        this.ui.toast(`+${fmt(amount)} bonus coins${this.ads.isMock ? ' (dev mock)' : ''}`, 'good');
        this.ui.text('goEarned', fmt(summary.rewards.coinsEarned + amount));
        this.refreshChrome();
      }
      this.ui.show('adOffer', false);
    } else {
      btn.disabled = false;
      const msg = res.status === 'cancelled' ? 'Ad closed early, so no bonus this time.' : 'No ad is available right now.';
      this.ui.toast(msg, 'info');
      if (res.status !== 'cancelled') this.ui.show('adOffer', false);
    }
  }

  private async skinPrimary(mode: string): Promise<void> {
    const skin = getSkin(this.garage.selected);
    if (mode === 'equip') {
      equipSkin(this.profile, skin.id);
      this.renderer.setSkin(skin.id);
      this.sfx('click');
    } else if (mode === 'unequip') {
      unequipSkin(this.profile);
      this.renderer.setSkin(this.profile.equippedSkin);
    } else if (mode === 'buy' && skin.unlock.type === 'coins') {
      // The popup itself is the confirmation step: it shows the car, the price and your balance.
      const r = buySkin(this.profile, skin.id);
      if (r === 'ok') {
        equipSkin(this.profile, skin.id);
        this.renderer.setSkin(skin.id);
        this.sfx('buy');
        this.ui.toast(`${skin.name} is yours!`, 'good');
        for (const a of evaluateAchievements(this.profile, null)) this.ui.toast(`Achievement: ${a.name} +${a.reward}`, 'good');
        this.analytics.track('skin_buy', { skin: skin.id });
      } else {
        this.sfx('error');
        this.ui.toast(r === 'insufficient' ? 'Not enough coins yet.' : 'That car cannot be bought.', 'bad');
      }
    }
    this.save();
    this.garage.render(this.profile);
    this.refreshChrome();
  }

  private async buyProduct(productId: string): Promise<void> {
    if (!this.purchases.isAvailable()) return;
    const res = await this.purchases.purchase(productId);
    if (res.status !== 'success') {
      if (res.status !== 'cancelled') this.ui.toast('Purchase did not complete. You were not charged.', 'info');
      return;
    }
    const g = grantPurchase(this.profile, res, { allowUnverifiedMock: this.purchases.isMock && import.meta.env.DEV });
    if (g === 'granted') {
      this.save();
      this.sfx('buy');
      this.ui.toast(`Purchase applied${this.purchases.isMock ? ' (dev mock, no charge)' : ''}`, 'good');
    } else if (g === 'unverified') {
      this.ui.toast('Purchase could not be verified, nothing was granted.', 'bad');
    }
    this.garage.render(this.profile);
    void this.purchases.getProducts().then((p) => renderStore(this.ui, p, this.profile, this.purchases.isMock));
    this.refreshChrome();
  }

  // ------------------------------------------------------------------ settings

  private applySettings(): void {
    const s = this.profile.settings;
    this.audio?.setVolumes(s.sfxVolume, s.musicVolume);
    this.renderer.setSettings(this.renderSettings());
  }

  private syncSettingsInputs(): void {
    const s = this.profile.settings;
    for (const input of this.ui.root.querySelectorAll<HTMLInputElement>('#screen-settings [data-setting]')) {
      const key = input.dataset.setting as keyof Settings;
      const v = s[key];
      if (input.type === 'range') input.value = String(Math.round((v as number) * 100));
      else input.checked = Boolean(v);
    }
  }

  private syncPauseToggles(): void {
    const s = this.profile.settings;
    for (const input of this.ui.root.querySelectorAll<HTMLInputElement>('#screen-pause [data-setting]')) {
      input.checked = input.dataset.setting === 'sfx' ? s.sfxVolume > 0 : s.musicVolume > 0;
    }
  }

  private onSettingInput(input: HTMLInputElement): void {
    const s = this.profile.settings;
    const key = input.dataset.setting ?? '';
    switch (key) {
      case 'sfxVolume':
      case 'musicVolume':
        s[key] = Number(input.value) / 100;
        break;
      case 'vibration':
      case 'screenShake':
      case 'lowQuality':
        s[key] = input.checked;
        break;
      case 'sfx':
        s.sfxVolume = input.checked ? s.sfxVolume || 0.8 : 0;
        break;
      case 'music':
        s.musicVolume = input.checked ? s.musicVolume || 0.5 : 0;
        break;
    }
    this.applySettings();
    this.save();
  }

  // ------------------------------------------------------------------ lifecycle

  private onVisibility = (): void => {
    if (document.hidden) {
      if (this.state === 'playing') this.pause();
      this.checkpoint();
      this.save();
      void this.audio?.suspend();
    } else if (this.state !== 'paused') {
      void this.audio?.resume();
    }
  };

  private onBlur = (): void => {
    if (this.state === 'playing') this.pause();
  };

  /** Commands from the GlitchBound arcade when the game is embedded there. */
  private onHostCommand(c: HostCommand): void {
    if (c.type === 'coins') {
      // A gift from the arcade (its QA team or an admin): straight into the wallet.
      this.profile.coins += c.amount;
      this.save();
      this.refreshChrome();
      this.ui.toast(`+${fmt(c.amount)} coins from GlitchBound`, 'good');
      return;
    }
    if (c.type === 'challenge') {
      this.onChallenge(c.seed);
      return;
    }
    if (c.type === 'menu') {
      // In the arcade's full screen, its game menu (exit full screen, exit game) gets a button in our top bars.
      this.ui.show('hostMenu', c.available);
      return;
    }
    if (c.type === 'pause') {
      // The arcade asks for a pause when the player leaves full screen or scrolls away: go fully
      // silent (not just the calm pause loop). Resume, or the next tap on a menu, brings sound back.
      if (this.state === 'playing') this.pause();
      void this.audio?.suspend();
      return;
    }
    // ('identity', the arcade's player name: the game has no board of its own to show it on)
  }

  /** A friends' challenge round from the arcade (seed), or its end (null). */
  private onChallenge(seed: number | null): void {
    this.challengeSeed = seed;
    const round = this.challengeRound();
    if (seed !== null && round && !round.done && !this.challengeRun) {
      // Started in an earlier visit (reload, or the arcade's Restart) and a real-time run can't be
      // resumed: it ends now with the score it reached, reported once.
      putChallengeRound(this.profile, challengeKey(seed), { ...round, done: true });
      this.staleRound = true;
      this.save();
      notifyHost({ type: 'end', score: round.score, stats: { meters: round.meters, coins: round.coins, nearMisses: round.nearMisses } });
    }
    if (seed !== null && this.dailyOpen) this.dailyOpen = false;
    this.refreshChrome();
    if (this.state === 'menu') this.updateScreens();
  }

  // ------------------------------------------------------------------ frame

  private frame(dt: number): void {
    const r = this.renderer;
    if (r.checkResize()) {
      this.world.setViewHeight(r.viewHeight);
      // A still (paused) scene isn't redrawn by itself: draw the new layout once.
      if (this.state === 'paused') {
        r.render(this.world, 0, 0);
        r.app.render();
      }
    }

    switch (this.state) {
      case 'menu': {
        // Attract mode: the autopilot drives behind the menu (same fixed-step accumulator as gameplay).
        this.acc += dt;
        while (this.acc >= SIM_DT) {
          this.acc -= SIM_DT;
          this.pilot.update(this.world, SIM_DT);
          this.world.update(SIM_DT);
          r.handleEvents(this.world.events, this.world);
          if (this.world.crashed) break;
        }
        if (this.world.crashed || this.world.meters > 6000) this.newAttractWorld();
        r.render(this.world, dt, this.world.speed, this.acc);
        break;
      }
      case 'playing': {
        this.acc += dt;
        this.events.length = 0;
        while (this.acc >= SIM_DT) {
          this.acc -= SIM_DT;
          this.world.update(SIM_DT);
          for (const e of this.world.events) this.events.push(e);
          if (this.world.crashed) break;
        }
        this.onEvents(this.events);
        r.handleEvents(this.events, this.world);
        r.render(this.world, dt, this.world.speed, this.acc);
        if (this.world.crashed) this.onCrash();
        else if (this.challengeRun && this.world.stats.time - this.checkpointAt >= 5) {
          this.checkpointAt = this.world.stats.time;
          this.checkpoint();
          this.save();
        }
        this.updateHud();
        break;
      }
      case 'paused':
        r.render(this.world, 0, 0);
        break;
      case 'crashing':
        this.crashTimer += dt;
        r.render(this.world, dt * 0.6, 0);
        if (this.crashTimer > 1.0) this.endRun();
        break;
      case 'gameover':
        r.render(this.world, dt, 0);
        break;
    }
  }

  private onEvents(events: readonly WorldEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'coin':
          this.sfx('coin');
          break;
        case 'nearMiss':
          this.sfx('nearMiss');
          this.vibrate(15);
          break;
        case 'powerup':
          this.sfx('powerup');
          this.vibrate(20);
          break;
        case 'shieldHit':
          this.sfx('shield');
          this.vibrate(80);
          break;
        case 'laneChange':
          this.sfx('lane');
          break;
        default:
          break;
      }
    }
  }

  private buildPowerPills(): void {
    const host = this.ui.el('hudPowers');
    for (const k of ['shield', 'magnet', 'double'] as PowerUpKind[]) {
      const el = document.createElement('div');
      el.className = 'power-pill';
      el.style.color = POWER_COLORS[k];
      el.hidden = true;
      el.innerHTML = `<i></i><span>${POWER_LABEL[k]}</span><span class="meter"><b></b></span>`;
      host.appendChild(el);
      this.powerPills.set(k, { el, bar: el.querySelector('b') as HTMLElement });
    }
  }

  private updateHud(): void {
    const w = this.world;
    this.ui.text('hudScore', fmt(w.score));
    this.ui.text('hudDistance', fmt(w.meters));
    if (w.stats.coins !== this.lastCoins) {
      this.ui.text('hudCoins', fmt(w.stats.coins));
      if (this.lastCoins >= 0) {
        const chip = this.ui.el('hudCoins').parentElement;
        chip?.classList.add('bump');
        window.setTimeout(() => chip?.classList.remove('bump'), 110);
      }
      this.lastCoins = w.stats.coins;
    }
    const combo = this.ui.el('hudCombo');
    const showCombo = w.combo > 1;
    if (combo.hidden === showCombo) combo.hidden = !showCombo;
    if (showCombo) this.ui.text('hudCombo', `COMBO x${w.combo}`);
    for (const [k, pill] of this.powerPills) {
      const t = w.active[k];
      const on = t > 0;
      if (pill.el.hidden === on) pill.el.hidden = !on;
      if (on) pill.bar.style.width = `${(t / POWERUPS[k].duration) * 100}%`;
    }
  }
}
