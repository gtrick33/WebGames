import type { MockAdOutcome } from '../monetization/ads';
import type { MockPurchaseOutcome, Product } from '../monetization/purchases';

export type ScreenId = 'title' | 'hud' | 'pause' | 'gameover' | 'garage' | 'missions' | 'settings' | 'leaderboard' | 'daily' | 'confirm' | 'mock';

const OVERLAYS: ScreenId[] = ['confirm', 'mock'];

/** Thin DOM layer: screen switching, bindings, delegated actions, dialogs and toasts. */
export class UI {
  readonly root: HTMLElement;
  private actions = new Map<string, (el: HTMLElement) => void>();
  private bindCache = new Map<string, HTMLElement[]>();
  private textCache = new Map<string, string>();
  private confirmResolve: ((v: boolean) => void) | null = null;
  private mockResolve: ((v: string) => void) | null = null;
  private mockTimer: number | null = null;
  onClickSound: () => void = () => {};

  constructor() {
    const root = document.getElementById('ui');
    if (!root) throw new Error('#ui missing');
    this.root = root;
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      const action = el.dataset.action ?? '';
      const handler = this.actions.get(action);
      if (handler) {
        this.onClickSound();
        handler(el);
      }
    });
    // Tabs inside pages.
    root.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (!tab) return;
      const page = tab.closest('.screen');
      if (!page) return;
      this.onClickSound();
      this.selectTab(page as HTMLElement, tab.dataset.tab ?? '');
    });
    this.on('confirmYes', () => this.resolveConfirm(true));
    this.on('confirmNo', () => this.resolveConfirm(false));
    this.on('mockComplete', () => this.resolveMock('complete'));
    this.on('mockCancel', () => this.resolveMock('cancel'));
    this.on('mockFail', () => this.resolveMock('fail'));
  }

  on(action: string, handler: (el: HTMLElement) => void): void {
    this.actions.set(action, handler);
  }

  screen(id: ScreenId): HTMLElement {
    const el = document.getElementById(`screen-${id}`);
    if (!el) throw new Error(`screen ${id} missing`);
    return el;
  }

  /** Activate exactly these screens (dialogs/mocks stay as they are). */
  setScreens(ids: ScreenId[]): void {
    for (const el of this.root.querySelectorAll<HTMLElement>('.screen')) {
      const id = el.id.replace('screen-', '') as ScreenId;
      if (OVERLAYS.includes(id)) continue;
      const on = ids.includes(id);
      el.classList.toggle('active', on);
      el.toggleAttribute('inert', !on);
    }
  }

  isActive(id: ScreenId): boolean {
    return this.screen(id).classList.contains('active');
  }

  selectTab(page: HTMLElement, tab: string): void {
    for (const t of page.querySelectorAll<HTMLElement>('[data-tab]')) {
      const on = t.dataset.tab === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    }
    for (const p of page.querySelectorAll<HTMLElement>('[data-panel]')) p.hidden = p.dataset.panel !== tab;
  }

  els(name: string): HTMLElement[] {
    let list = this.bindCache.get(name);
    if (!list) {
      list = [...this.root.querySelectorAll<HTMLElement>(`[data-bind="${name}"]`)];
      this.bindCache.set(name, list);
    }
    return list;
  }

  el(name: string): HTMLElement {
    const e = this.els(name)[0];
    if (!e) throw new Error(`binding ${name} missing`);
    return e;
  }

  /** Set text only if it changed (cheap to call every frame). */
  text(name: string, value: string | number): void {
    const v = String(value);
    if (this.textCache.get(name) === v) return;
    this.textCache.set(name, v);
    for (const e of this.els(name)) e.textContent = v;
  }

  show(name: string, visible: boolean): void {
    for (const e of this.els(name)) e.hidden = !visible;
  }

  width(name: string, fraction: number): void {
    for (const e of this.els(name)) e.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  }

  toast(message: string, kind: 'good' | 'bad' | 'info' = 'info'): void {
    const host = document.getElementById('toasts');
    if (!host) return;
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = message;
    host.appendChild(t);
    window.setTimeout(() => t.remove(), 2700);
  }

  confirm(title: string, text: string, yesLabel = 'OK'): Promise<boolean> {
    this.resolveConfirm(false);
    this.text('confirmTitle', title);
    this.text('confirmText', text);
    this.text('confirmYes', yesLabel);
    const scr = this.screen('confirm');
    scr.classList.add('active');
    scr.removeAttribute('inert');
    (scr.querySelector('[data-action="confirmYes"]') as HTMLElement | null)?.focus();
    return new Promise((resolve) => (this.confirmResolve = resolve));
  }

  private resolveConfirm(v: boolean): void {
    const scr = this.screen('confirm');
    scr.classList.remove('active');
    scr.setAttribute('inert', '');
    const r = this.confirmResolve;
    this.confirmResolve = null;
    r?.(v);
  }

  // ------------------------------------------------------------- dev mocks

  /** Development-only stand-in for an ad. Clearly labelled; never used in production builds. */
  presentMockAd = (kind: 'rewarded' | 'interstitial'): Promise<MockAdOutcome> => {
    const seconds = kind === 'rewarded' ? 3 : 2;
    return this.openMock(
      'AD',
      kind === 'rewarded' ? 'Rewarded video (mock)' : 'Interstitial (mock)',
      kind === 'rewarded'
        ? 'A real rewarded video would play here. The reward is only granted if you press Complete after the timer.'
        : 'A real between-runs ad would show here. It can never appear during a run.',
      seconds,
      kind === 'rewarded' ? 'Complete (grant reward)' : 'Close ad',
    ) as Promise<MockAdOutcome>;
  };

  confirmMockPurchase = (p: Product): Promise<MockPurchaseOutcome> =>
    this.openMock(
      'PURCHASE',
      p.title,
      `${p.description}. Mock price ${p.priceLabel}. No money is charged and nothing is sent anywhere.`,
      0,
      'Approve mock purchase',
    ).then((r) => (r === 'complete' ? 'success' : r === 'cancel' ? 'cancel' : 'fail'));

  private openMock(kind: string, title: string, text: string, seconds: number, completeLabel: string): Promise<string> {
    this.resolveMock('cancel');
    this.text('mockKind', kind);
    this.text('mockTitle', title);
    this.text('mockText', text);
    this.text('mockComplete', completeLabel);
    const btn = this.el('mockComplete') as HTMLButtonElement;
    const bar = this.el('mockBar');
    const scr = this.screen('mock');
    scr.classList.add('active');
    scr.removeAttribute('inert');
    const start = performance.now();
    btn.disabled = seconds > 0;
    bar.style.width = seconds > 0 ? '0%' : '100%';
    if (seconds > 0) {
      this.mockTimer = window.setInterval(() => {
        const t = (performance.now() - start) / (seconds * 1000);
        bar.style.width = `${Math.min(100, t * 100)}%`;
        if (t >= 1) {
          btn.disabled = false;
          if (this.mockTimer !== null) window.clearInterval(this.mockTimer);
          this.mockTimer = null;
        }
      }, 50);
    }
    return new Promise((resolve) => (this.mockResolve = resolve));
  }

  private resolveMock(v: string): void {
    if (this.mockTimer !== null) window.clearInterval(this.mockTimer);
    this.mockTimer = null;
    const scr = this.screen('mock');
    scr.classList.remove('active');
    scr.setAttribute('inert', '');
    const r = this.mockResolve;
    this.mockResolve = null;
    r?.(v);
  }
}

/** Escape text for innerHTML templates. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

export const CHECK_SVG = '<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
export const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
