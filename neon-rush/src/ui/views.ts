import { SKINS, DEFAULT_SKIN_ID, RARITY_LABEL, SHADER_LABEL, SHAPE_LABEL, TRAIL_LABEL, describeUnlock, getSkin, type CarShape, type Rarity, type SkinDef } from '../cosmetics/skins';
import { owns } from '../cosmetics/shop';
import { ACHIEVEMENTS, getAchievement } from '../progression/achievements';
import { challengesForDay, challengeProgress } from '../progression/challenges';
import { DAILY_REWARDS, canClaimDaily, nextStreak } from '../progression/daily';
import { xpToNext } from '../progression/levels';
import type { Profile } from '../progression/profile';
import type { RunSummary } from '../progression/run';
import type { Product } from '../monetization/purchases';
import { CHECK_SVG, LOCK_SVG, esc, fmt, type UI } from './ui';

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Shared header bits: coins, level, XP and notification dots. */
export function renderProfileChrome(ui: UI, p: Profile, today: string): void {
  ui.text('coins', fmt(p.coins));
  ui.text('level', p.level);
  ui.width('xpbar', p.xp / xpToNext(p.level));
  ui.text('xpText', `${fmt(p.xp)} / ${fmt(xpToNext(p.level))} XP`);
  ui.text('bestScore', fmt(p.bestScore));
  ui.text('bestDistance', fmt(p.bestDistance));
  ui.show('dailyDot', canClaimDaily(p, today));
  // Fresh challenges today that the player has not looked at or played yet.
  ui.show('missionDot', p.challenges.day !== today && p.gamesPlayed > 0);
}

// ------------------------------------------------------------------ garage

export interface GarageDeps {
  preview: (skin: SkinDef) => Promise<string>;
}

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const priceOf = (s: SkinDef): number => (s.unlock.type === 'coins' ? s.unlock.price : s.unlock.type === 'level' ? s.unlock.level * 400 : s.unlock.type === 'starter' ? 0 : 3000);
/** Garage order: by rarity, then by cost. */
const ORDERED: SkinDef[] = [...SKINS].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || priceOf(a) - priceOf(b));
const SHAPES: CarShape[] = [...new Set(SKINS.map((s) => s.shape))];

export class GarageView {
  selected = DEFAULT_SKIN_ID;
  private filter: CarShape | 'all' | 'owned' = 'all';
  private previews = new Map<string, string>();
  private queue: SkinDef[] = [];
  private loading = false;
  private built = false;
  private observer: IntersectionObserver | null = null;

  constructor(private readonly ui: UI, private readonly deps: GarageDeps) {}

  setFilter(f: string): void {
    this.filter = f === 'all' || f === 'owned' || (SHAPES as string[]).includes(f) ? (f as GarageView['filter']) : 'all';
  }

  private build(): void {
    const filters = this.ui.el('garageFilters');
    filters.innerHTML = [['all', 'All'], ['owned', 'Owned'], ...SHAPES.map((sh) => [sh, SHAPE_LABEL[sh]])]
      .map(([k, label]) => `<button class="filter-chip" data-action="garageFilter" data-filter="${k}">${esc(label as string)}</button>`)
      .join('');
    const grid = this.ui.el('skinGrid');
    grid.innerHTML = ORDERED.map(
      (s) => `<button class="skin-card r-${s.rarity} fx-${s.shader}" data-action="selectSkin" data-skin="${s.id}" style="--glow:${hex(s.glow)}" aria-label="${esc(s.name)}">
        <span class="rarity-pip">${RARITY_LABEL[s.rarity]}</span>
        <span class="car-img"><span class="skeleton"></span></span>
        <span class="name">${esc(s.name)}</span>
        <span class="tag"></span>
      </button>`,
    ).join('');
    this.built = true;
    // Render previews only when a card scrolls into view, one per frame.
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.skin ?? '';
          this.observer?.unobserve(e.target);
          this.enqueue(getSkin(id));
        }
      }, { rootMargin: '200px' });
      for (const card of grid.querySelectorAll('.skin-card')) this.observer.observe(card);
    } else {
      ORDERED.forEach((s) => this.enqueue(s));
    }
  }

  private enqueue(s: SkinDef): void {
    if (this.previews.has(s.id) || this.queue.includes(s)) return;
    this.queue.push(s);
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    const grid = this.ui.el('skinGrid');
    while (this.queue.length > 0) {
      const s = this.queue.shift() as SkinDef;
      const url = await this.deps.preview(s);
      this.previews.set(s.id, url);
      const skel = grid.querySelector(`[data-skin="${s.id}"] .skeleton`);
      if (skel) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = url;
        skel.replaceWith(img);
      }
      if (s.id === this.selected) this.ui.el('showcaseImg').setAttribute('src', url);
      await new Promise((r) => requestAnimationFrame(r));
    }
    this.loading = false;
  }

  render(p: Profile): void {
    if (!this.built) this.build();
    const grid = this.ui.el('skinGrid');
    for (const chip of this.ui.el('garageFilters').querySelectorAll<HTMLElement>('.filter-chip')) chip.classList.toggle('active', chip.dataset.filter === this.filter);
    this.ui.text('garageCount', `${p.ownedSkins.length} / ${SKINS.length} owned`);
    for (const s of SKINS) {
      const card = grid.querySelector<HTMLElement>(`[data-skin="${s.id}"]`);
      if (!card) continue;
      const owned = owns(p, s.id);
      card.hidden = this.filter === 'owned' ? !owned : this.filter !== 'all' && s.shape !== this.filter;
      const equipped = p.equippedSkin === s.id;
      card.classList.toggle('locked', !owned);
      card.classList.toggle('selected', this.selected === s.id);
      card.querySelector('.equipped-badge')?.remove();
      card.querySelector('.lock')?.remove();
      if (equipped) card.insertAdjacentHTML('afterbegin', '<span class="equipped-badge">ON</span>');
      else if (!owned && s.unlock.type !== 'coins') card.insertAdjacentHTML('afterbegin', LOCK_SVG);
      const tag = card.querySelector('.tag');
      if (tag) {
        tag.innerHTML = owned
          ? equipped ? 'Equipped' : 'Owned'
          : s.unlock.type === 'coins'
            ? `<span class="coin-ico"></span>${fmt(s.unlock.price)}`
            : s.unlock.type === 'level' ? `Level ${s.unlock.level}` : 'Achievement';
      }
    }
    this.renderShowcase(p);
  }

  private renderShowcase(p: Profile): void {
    const s = getSkin(this.selected);
    const ui = this.ui;
    ui.text('showcaseName', s.name);
    ui.text('showcaseTag', s.tagline);
    ui.el('showcaseMeta').innerHTML = [
      `<span class="pill r-${s.rarity}">${RARITY_LABEL[s.rarity]}</span>`,
      `<span class="pill">${SHAPE_LABEL[s.shape]}</span>`,
      s.shader !== 'none' ? `<span class="pill fx">${SHADER_LABEL[s.shader]}</span>` : '',
      `<span class="pill fx">${TRAIL_LABEL[s.trailStyle]}</span>`,
    ].join('');
    const img = ui.el('showcaseImg');
    img.className = `fx-${s.shader}`;
    const url = this.previews.get(s.id);
    if (url) img.setAttribute('src', url);
    else this.enqueue(s);
    (img.parentElement as HTMLElement).style.setProperty('--glow', hex(s.glow));
    const status = ui.el('showcaseStatus');
    const btn = ui.el('showcaseBtn') as HTMLButtonElement;
    const owned = owns(p, s.id);
    status.classList.toggle('locked', !owned);
    btn.hidden = false;
    btn.disabled = false;
    if (owned) {
      const equipped = p.equippedSkin === s.id;
      status.textContent = equipped ? 'EQUIPPED' : 'OWNED';
      if (equipped && s.id === DEFAULT_SKIN_ID) btn.hidden = true;
      btn.textContent = equipped ? 'Unequip' : 'Equip';
      btn.dataset.mode = equipped ? 'unequip' : 'equip';
    } else if (s.unlock.type === 'coins') {
      const short = s.unlock.price - p.coins;
      status.textContent = short > 0 ? `NEED ${fmt(short)} MORE COINS` : 'AVAILABLE';
      btn.textContent = `Buy · ${fmt(s.unlock.price)}`;
      btn.dataset.mode = 'buy';
      btn.disabled = short > 0;
    } else {
      let progress = '';
      if (s.unlock.type === 'level') progress = ` (you are level ${p.level})`;
      if (s.unlock.type === 'achievement') {
        const a = getAchievement(s.unlock.achievementId);
        if (a) progress = ` · ${a.name}: ${fmt(Math.min(a.target, a.progress(p, null)))} / ${fmt(a.target)}`;
      }
      status.textContent = `LOCKED · ${describeUnlock(s)}${progress}`.toUpperCase();
      btn.hidden = true;
    }
  }
}

// ------------------------------------------------------------------ store

export function renderStore(ui: UI, products: Product[], p: Profile, isMock: boolean): void {
  ui.show('storeMock', isMock);
  ui.el('storeGrid').innerHTML = products
    .map((prod) => {
      const ownedAll = prod.kind === 'non_consumable' &&
        ((prod.grants.entitlements ?? []).every((e) => p.entitlements.includes(e)) && (prod.grants.skins ?? []).every((s) => p.ownedSkins.includes(s)));
      return `<div class="store-card">
        <h3>${esc(prod.title)}</h3>
        <p>${esc(prod.description)}</p>
        <button class="btn ${ownedAll ? 'btn-ghost' : 'btn-primary'}" data-action="buyProduct" data-product="${prod.id}" ${ownedAll ? 'disabled' : ''}>
          ${ownedAll ? 'Owned' : `${esc(prod.priceLabel)}${isMock ? ' (mock)' : ''}`}
        </button>
      </div>`;
    })
    .join('');
}

// ------------------------------------------------------------------ missions

export function renderMissions(ui: UI, p: Profile, today: string, now: Date): void {
  const challenges = challengesForDay(today);
  ui.el('challengeList').innerHTML = challenges
    .map((c) => {
      const prog = p.challenges.day === today ? challengeProgress(p, c) : 0;
      const done = p.challenges.day === today && p.challenges.claimed.includes(c.id);
      return `<li class="mission ${done ? 'done' : ''}">
        <div class="grow">
          <div class="title">${esc(c.label)}</div>
          <div class="prog"><span class="xpbar big"><i style="width:${Math.round((prog / c.target) * 100)}%"></i></span>${fmt(prog)} / ${fmt(c.target)}</div>
        </div>
        ${done ? CHECK_SVG : `<div class="reward"><span class="coin-ico"></span>${fmt(c.reward)}</div>`}
      </li>`;
    })
    .join('');

  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 60000));
  ui.text('resetIn', `${Math.floor(mins / 60)}h ${mins % 60}m`);

  ui.el('achievementList').innerHTML = ACHIEVEMENTS.map((a) => {
    const done = p.achievements[a.id] !== undefined;
    const prog = done ? a.target : a.perRun ? 0 : Math.min(a.target, a.progress(p, null));
    return `<li class="mission ${done ? 'done' : ''}">
      <div class="grow">
        <div class="title">${esc(a.name)}</div>
        <div class="desc">${esc(a.description)}</div>
        ${a.perRun && !done ? '' : `<div class="prog"><span class="xpbar big"><i style="width:${Math.round((prog / a.target) * 100)}%"></i></span>${fmt(prog)} / ${fmt(a.target)}</div>`}
      </div>
      ${done ? CHECK_SVG : `<div class="reward"><span class="coin-ico"></span>${fmt(a.reward)}</div>`}
    </li>`;
  }).join('');

  const unlocked = Object.keys(p.achievements).length;
  const stats: [string, string][] = [
    ['Best score', fmt(p.bestScore)],
    ['Best distance', `${fmt(p.bestDistance)} m`],
    ['Runs played', fmt(p.gamesPlayed)],
    ['Lifetime distance', `${fmt(p.lifetimeDistance / 1000)} km`],
    ['Coins collected', fmt(p.totalCoins)],
    ['Near misses', fmt(p.totalNearMisses)],
    ['Cars owned', `${p.ownedSkins.length} / ${SKINS.length}`],
    ['Achievements', `${unlocked} / ${ACHIEVEMENTS.length}`],
  ];
  ui.el('statsGrid').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

// ------------------------------------------------------------------ daily

export function renderDaily(ui: UI, p: Profile, today: string): void {
  const claimable = canClaimDaily(p, today);
  const streak = claimable ? nextStreak(p, today) : p.daily.streak;
  const todayIdx = (Math.max(1, streak) - 1) % DAILY_REWARDS.length;
  ui.el('dailyStrip').innerHTML = DAILY_REWARDS.map((r, i) => {
    const cls = i < todayIdx || (!claimable && i === todayIdx) ? 'claimed' : i === todayIdx ? 'today' : '';
    return `<li class="${cls}">DAY ${i + 1}<span class="coin-ico"></span><b>${r}</b></li>`;
  }).join('');
  const btn = ui.el('dailyClaimBtn') as HTMLButtonElement;
  btn.disabled = !claimable;
  btn.textContent = claimable ? `Claim ${DAILY_REWARDS[todayIdx]} coins` : 'Come back tomorrow';
}

// ------------------------------------------------------------------ game over

export function renderGameOver(ui: UI, s: RunSummary, p: Profile): void {
  ui.text('goScore', fmt(s.stats.score));
  ui.text('goDistance', `${fmt(s.stats.meters)} m`);
  ui.text('goCoins', fmt(s.stats.coins));
  ui.text('goNear', fmt(s.stats.nearMisses));
  ui.text('goCombo', s.stats.bestCombo > 1 ? `x${s.stats.bestCombo}` : '-');
  ui.show('goNewBest', s.newBestScore);
  ui.text('goEarned', fmt(s.rewards.coinsEarned));
  ui.text('goBreakdown', `${fmt(s.rewards.coinsCollected)} collected + ${fmt(s.rewards.distanceBonus)} distance bonus`);
  ui.text('goXp', fmt(s.rewards.xpEarned));
  ui.text('goLevel', p.level);
  ui.width('goXpBar', 0);
  requestAnimationFrame(() => requestAnimationFrame(() => ui.width('goXpBar', p.xp / xpToNext(p.level))));

  const items: string[] = [];
  for (const l of s.levelUps) items.push(`<li><b>LEVEL UP</b> Level ${l.level}<span class="coin-text">+${fmt(l.reward)}</span></li>`);
  for (const sk of s.skinsUnlocked) items.push(`<li><b>NEW CAR</b> ${esc(sk.name)} unlocked</li>`);
  for (const a of s.achievements) items.push(`<li><b>ACHIEVEMENT</b> ${esc(a.name)}<span class="coin-text">+${fmt(a.reward)}</span></li>`);
  for (const c of s.challenges) items.push(`<li><b>CHALLENGE</b> ${esc(c.label)}<span class="coin-text">+${fmt(c.reward)}</span></li>`);
  const list = ui.el('goUnlocks');
  list.innerHTML = items.map((h, i) => h.replace('<li>', `<li style="animation-delay:${0.15 + i * 0.1}s">`)).join('');
  list.hidden = items.length === 0;
}
