/** Small shared pieces of the Launch Control UI: panels, stickers, stat bars, car pictures, materials. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { drawDriver } from './hud';
import { Icon, MAT_ICON } from './icons';
import { MATERIAL_INFO, MATERIALS, type Mats } from './parts';
import { cachedThumb, requestThumb, thumbKey, type CarLook } from './scene3d';
import { fmtCash } from './util';

export function Panel({ title, eyebrow, onBack, right, children, className = '' }: { title?: string; eyebrow?: string; onBack?: () => void; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`lc-panel ${className}`}>
      {(title || onBack) && (
        <header className="lc-panel-head">
          {onBack && (
            <button className="lc-back" onClick={onBack} aria-label="Back">
              <Icon name="back" size={20} />
            </button>
          )}
          <div className="lc-panel-titles">
            {eyebrow && <span className="lc-eyebrow mono">{eyebrow}</span>}
            {title && <h2 className="lc-h">{title}</h2>}
          </div>
          {right && <div className="lc-panel-right">{right}</div>}
        </header>
      )}
      <div className="lc-panel-body">{children}</div>
    </section>
  );
}

/**
 * A full-screen pop-up (shops, garage, dealer, rivals): a header with the way back and your cash,
 * optional tabs, then the 3D view (the shared stage is docked over `viewRef`) beside or above the content.
 */
export function Sheet({ title, eyebrow, onBack, right, tabs, viewRef, children, className = '' }: { title: string; eyebrow?: string; onBack: () => void; right?: ReactNode; tabs?: ReactNode; viewRef?: (el: HTMLDivElement | null) => void; children: ReactNode; className?: string }) {
  return (
    <section className={`lc-modal ${className}`} role="dialog" aria-label={title}>
      <header className="lc-modal-head">
        <button className="lc-back" onClick={onBack} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <div className="lc-panel-titles">
          {eyebrow && <span className="lc-eyebrow mono">{eyebrow}</span>}
          <h2 className="lc-h">{title}</h2>
        </div>
        {right && <div className="lc-modal-right">{right}</div>}
        <GameMenuButton className="lc-icon" />
      </header>
      {tabs && <div className="lc-modal-tabs">{tabs}</div>}
      <div className={`lc-modal-body${viewRef ? ' has-view' : ''}`}>
        {viewRef && <div ref={viewRef} className="lc-modal-view" aria-hidden="true" />}
        <div className="lc-modal-content">{children}</div>
      </div>
    </section>
  );
}

export function Sticker({ tone = 'yellow', children, flat }: { tone?: string; children: ReactNode; flat?: boolean }) {
  return (
    <span className={`sticker lc-sticker${flat ? ' is-flat' : ''}`} data-tone={tone}>
      {children}
    </span>
  );
}

export function Cash({ n, sign }: { n: number; sign?: boolean }) {
  return (
    <span className={`lc-cash-n mono${sign && n < 0 ? ' is-neg' : ''}`}>
      <i className="lc-coin" aria-hidden="true" />
      {sign && n > 0 ? '+' : ''}
      {n < 0 ? '−' : ''}
      {fmtCash(Math.abs(n))}
    </span>
  );
}

export function StatBar({ label, value, max, text, tone = 'cyan' }: { label: string; value: number; max: number; text: string; tone?: string }) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="lc-stat">
      <span className="lc-stat-label">{label}</span>
      <span className="lc-stat-bar">
        <i style={{ width: `${w}%` }} data-tone={tone} />
      </span>
      <span className="lc-stat-val mono">{text}</span>
    </div>
  );
}

export function Pips({ level, max }: { level: number; max: number }) {
  return (
    <span className="lc-pips" aria-label={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < level ? 'is-on' : ''} />
      ))}
    </span>
  );
}

export function MatsLine({ mats, have }: { mats: Mats; have?: Record<string, number> }) {
  const parts = MATERIALS.filter((m) => mats[m]);
  if (!parts.length) return null;
  return (
    <span className="lc-matline">
      {parts.map((m) => (
        <span key={m} className={`lc-mat${have && have[m]! < mats[m]! ? ' is-short' : ''}`} data-mat={m} title={MATERIAL_INFO[m].name}>
          <Icon name={MAT_ICON[m]} size={14} />
          {mats[m]}
        </span>
      ))}
    </span>
  );
}

/** Every material you hold, for the top bar and the parts shop. */
export function MatsPill({ mats }: { mats: Mats }) {
  return (
    <span className="lc-pill lc-pill-mats mono">
      {MATERIALS.map((m) => (
        <span key={m} className="lc-mat" data-mat={m} title={MATERIAL_INFO[m].name}>
          <Icon name={MAT_ICON[m]} size={14} />
          {mats[m] ?? 0}
        </span>
      ))}
    </span>
  );
}

/** A 3D picture of a car, rendered in the background (one at a time) and cached. */
export function useThumb(look: CarLook, env = 'e-bay'): string {
  const key = thumbKey(look, env);
  const [got, setGot] = useState<{ key: string; url: string }>({ key: '', url: '' });
  const ready = cachedThumb(key);
  const lookRef = useRef(look);
  useEffect(() => {
    lookRef.current = look;
  });
  useEffect(() => {
    if (cachedThumb(key) !== undefined) return;
    return requestThumb(lookRef.current, env, (url) => setGot({ key, url }));
  }, [key, env]);
  return ready ?? (got.key === key ? got.url : '');
}

export function CarThumb({ look, className = '', env }: { look: CarLook; className?: string; env?: string }) {
  const url = useThumb(look, env);
  return url ? <img src={url} width={360} height={200} className={`lc-thumb ${className}`} alt="" /> : <span className={`lc-thumb is-loading ${className}`} />;
}

/** The driver portrait: the player icon (helmet and suit). `badge` puts it in a round frame. */
export function DriverFace({ helmet, suit, size = 64, badge, className = '' }: { helmet: [string, string]; suit: string; size?: number; badge?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [h0, h1] = helmet;
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const px = cv.width;
    ctx.clearRect(0, 0, px, px);
    if (badge) {
      const g = ctx.createRadialGradient(px * 0.5, px * 0.35, px * 0.05, px * 0.5, px * 0.5, px * 0.55);
      g.addColorStop(0, '#3a3a52');
      g.addColorStop(1, '#14141f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.clip();
      drawDriver(ctx, [h0, h1], suit, px / 2, px * 0.44, px * 0.98);
      ctx.restore();
    } else drawDriver(ctx, [h0, h1], suit, px / 2, px * 0.42, px * 0.95);
  }, [h0, h1, suit, badge]);
  const px = Math.round(size * Math.min(3, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  return <canvas ref={ref} width={px} height={px} style={{ width: size, height: size }} className={`lc-face${badge ? ' is-badge' : ''} ${className}`} aria-hidden="true" />;
}

export const posLabel = (p: number): string => (p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : `${p}th`);
