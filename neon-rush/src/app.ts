import { World, type WorldEvent } from './game/world';
import { Autopilot } from './game/autopilot';
import { SIM_DT, type PowerUpKind, POWERUPS } from './game/config';
import { GameRenderer } from './render/renderer';
import { Input } from './input/input';
import { UI, fmt } from './ui/ui';
import { GarageView, renderDaily, renderGameOver, renderMissions, renderProfileChrome, renderStore } from './ui/views';
import { SaveManager, browserStore } from './progression/storage';
import type { Profile, Settings } from './progression/profile';
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
import { createBackend, type BackendService } from './backend/backend';
import { LeaderboardClient, type BoardResult } from './backend/leaderboard';
import { normalizeName, validateName } from './backend/leaderboard-rules';
import { esc } from './ui/ui';
import { dayKey } from './core/dates';
import type { AudioEngine, Sfx } from './audio/audio';

type GameState = 'menu' | 'playing' | 'paused' | 'crashing' | 'gameover';
type Page = 'garage' | 'missions' | 'settings' | 'leaderboard';

const POWER_COLORS: Record<PowerUpKind, string> = { magnet: '#ff3fd2', shield: '#22e4ff', double: '#ffc21a' };
const POWER_LABEL: Record<PowerUpKind, string> = { magnet: 'MAGNET', shield: 'SHIELD', double: '2X COINS' };

export class App {
  private state: GameState = 'menu';
  private page: Page | null = null;
  private dailyOpen = false;
  /** Car details popup over the garage. */
  private carOpen = false;
  private world!: World;
  private attract = true;
  private pilot = new Autopilot(0.06);
  private acc = 0;
  private crashTimer = 0;
  private runId = '';
  private lastSummary: RunSummary | null = null;
  private readonly leaderboard = new LeaderboardClient();
  /** Server-issued run token for the current run (null when offline). */
  private serverRun: string | null = null;
  private boardPeriod: 'daily' | 'all' = 'daily';
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
          'No account needed. Progress is saved on this device. If you set a racer name, that name, a random player id and your best scores are stored on the leaderboard server. Ads are provided by Google, which may use cookies to serve and measure ads; see policies.google.com/technologies/ads.';
      }
    }
    this.ui.text(
      'controlsHint',
      window.matchMedia('(pointer: coarse)').matches ? 'Tap the left or right side to switch lanes' : 'Arrow keys / A D, or click left / right to switch lanes',
    );
    this.ui.onClickSound = () => this.sfx('click');

    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pagehide', () => this.saves.save(this.profile));

    this.renderer.app.ticker.add((t) => this.frame(Math.min(t.deltaMS / 1000, 0.05)));
    this.toMenu();
    this.analytics.track('boot', { ads: this.ads.provider.name, purchases: this.purchases.name });

    // Dev-only hook for automated QA in the browser. Stripped from production builds.
    if (import.meta.env.DEV) (window as unknown as { __neon: unknown }).__neon = this;

    if (canClaimDaily(this.profile, this.today())) window.setTimeout(() => this.state === 'menu' && !this.page && this.openDaily(), 700);
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
    this.world = new World({ seed: (Math.random() * 2 ** 31) | 0, viewHeight: this.renderer.viewHeight });
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
    // Ask the server for a run token in the background; gameplay never waits for it.
    this.serverRun = null;
    const localRun = this.runId;
    void this.leaderboard.startRun(this.profile.playerId).then((id) => {
      if (this.runId === localRun) this.serverRun = id;
    });
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.syncPauseToggles();
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
    this.input.enabled = false;
    this.sfx('crash');
    this.vibrate([60, 40, 120]);
  }

  /** Apply the finished run once and show the summary. */
  private endRun(show = true): RunSummary | null {
    const summary = finishRun(this.profile, this.runId, { ...this.world.stats }, this.today());
    if (!summary) return null;
    this.save();
    this.lastSummary = summary;
    this.ads.onRunCompleted();
    this.analytics.track('run_end', { score: summary.stats.score, meters: Math.floor(summary.stats.meters), coins: summary.stats.coins });
    void this.submitScore(summary, show);
    if (show) {
      this.state = 'gameover';
      renderGameOver(this.ui, summary, this.profile);
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

  /** Send a finished run to the online leaderboard and show the rank on the game-over screen. */
  private async submitScore(summary: RunSummary, show: boolean): Promise<void> {
    const rankEl = this.ui.el('goRank');
    const serverRun = this.serverRun;
    this.serverRun = null;
    const showRank = (html: string) => {
      if (!show) return;
      rankEl.innerHTML = html;
      rankEl.hidden = false;
    };
    rankEl.hidden = true;
    if (!serverRun) {
      showRank('<span class="muted">Online leaderboard unavailable (offline). Your progress is saved.</span>');
      return;
    }
    if (!this.profile.playerName) {
      showRank('<span>Set a racer name to compete on the online leaderboard.</span><button class="btn btn-ghost" data-action="leaderboard">Set name</button>');
      return;
    }
    showRank('<span class="muted">Submitting to the leaderboard...</span>');
    const res = await this.leaderboard.submit({
      runId: serverRun,
      playerId: this.profile.playerId,
      name: this.profile.playerName,
      score: summary.stats.score,
      meters: Math.floor(summary.stats.meters),
      coins: summary.stats.coins,
      nearMisses: summary.stats.nearMisses,
      durationMs: Math.round(summary.stats.time * 1000),
      skin: this.profile.equippedSkin,
    });
    if (this.lastSummary !== summary) return;
    if (!res) showRank('<span class="muted">Could not reach the leaderboard.</span>');
    else if (!res.ok) showRank(`<span class="muted">Score not ranked (${esc(res.message ?? res.error)}).</span>`);
    else {
      const d = res.daily;
      const a = res.allTime;
      showRank(`<span>Today <b>#${d?.rank ?? '-'}</b> · All time <b>#${a?.rank ?? '-'}</b></span><button class="btn btn-ghost" data-action="leaderboard">View leaderboard</button>`);
    }
  }

  private async loadBoard(): Promise<void> {
    const period = this.boardPeriod;
    const status = this.ui.el('boardStatus');
    status.textContent = 'Loading...';
    const res: BoardResult | null = await this.leaderboard.board(period, this.profile.playerId);
    if (this.page !== 'leaderboard' || this.boardPeriod !== period) return;
    const list = this.ui.el('boardList');
    const me = this.ui.el('boardMe');
    if (!res) {
      status.textContent = 'The leaderboard is offline right now. Try again later.';
      list.innerHTML = '';
      me.hidden = true;
      return;
    }
    status.textContent = res.entries.length === 0 ? 'No scores yet. Be the first!' : period === 'daily' ? 'Resets every day at 00:00 UTC.' : '';
    list.innerHTML = res.entries
      .map((e) => `<li class="${e.you ? 'you' : ''}"><span class="rk">${e.rank}</span><span class="nm">${esc(e.name)}<small>${fmt(e.meters)} m</small></span><span class="sc">${fmt(e.score)}</span></li>`)
      .join('');
    const inTop = res.entries.some((e) => e.you);
    me.hidden = !res.me || inTop;
    if (res.me && !inTop) me.innerHTML = `<span class="rk">${res.me.rank}</span><span class="nm">${esc(res.me.name)}<small>You</small></span><span class="sc">${fmt(res.me.score)}</span>`;
  }

  /** Leaving a run from the pause menu still pays out what was earned. */
  private abandonRun(): void {
    if (this.state !== 'paused') return;
    const s = this.endRun(false);
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
    if (page === 'leaderboard') {
      (this.ui.el('nameInput') as HTMLInputElement).value = this.profile.playerName;
      this.ui.selectTab(this.ui.screen('leaderboard'), this.boardPeriod);
      void this.loadBoard();
    }
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
    ui.on('leaderboard', () => this.openPage('leaderboard'));
    ui.on('boardTab', (el) => {
      this.boardPeriod = el.dataset.period === 'all' ? 'all' : 'daily';
      void this.loadBoard();
    });
    this.ui.el('nameForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = this.ui.el('nameInput') as HTMLInputElement;
      const msg = this.ui.el('nameMsg');
      const error = validateName(input.value);
      msg.classList.toggle('err', !!error);
      msg.classList.toggle('ok', !error);
      if (error) {
        msg.textContent = error;
        this.sfx('error');
        return;
      }
      this.profile.playerName = normalizeName(input.value);
      input.value = this.profile.playerName;
      this.save();
      this.sfx('click');
      msg.textContent = 'Saved. Your next run will appear on the leaderboard.';
      input.blur();
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
      this.save();
      void this.audio?.suspend();
    } else if (this.state !== 'paused') {
      void this.audio?.resume();
    }
  };

  private onBlur = (): void => {
    if (this.state === 'playing') this.pause();
  };

  // ------------------------------------------------------------------ frame

  private frame(dt: number): void {
    const r = this.renderer;
    if (r.checkResize()) this.world.setViewHeight(r.viewHeight);

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
