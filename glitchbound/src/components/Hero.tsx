import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GameEntry } from '../catalog/types';
import { CATEGORIES } from '../catalog/types';
import { isNew } from '../catalog/catalog';
import { Link } from '../router/router';
import { Icon } from './Icon';
import { RoadPreview } from './RoadPreview';
import { Cube, Dot, Pill, Ring, Squiggle, Star, Tri } from './Shapes';
import './Hero.css';

/** Pointer position in [-1, 1], written to CSS variables (no React re-renders). */
function usePointerParallax(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    const tick = (): void => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.setProperty('--mx', x.toFixed(4));
      el.style.setProperty('--my', y.toFixed(4));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = (): void => {
      tx = 0;
      ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref]);
}

/** Re-triggers the glitch class every few seconds. */
function useGlitchPulse(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let off = 0;
    const id = window.setInterval(() => {
      setOn(true);
      off = window.setTimeout(() => setOn(false), 480);
    }, 4200);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(off);
    };
  }, []);
  return on;
}

export function Hero({ featured }: { featured: GameEntry }) {
  const ref = useRef<HTMLElement>(null);
  usePointerParallax(ref);
  const glitching = useGlitchPulse();
  const href = `/games/${featured.slug}`;

  return (
    <section ref={ref} className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-grid" />
        <Pill className="shape s-pill" />
        <Dot className="shape s-dot" />
        <Tri className="shape s-tri" />
        <Star className="shape s-star" />
        <Ring className="shape s-ring" />
        <Squiggle className="shape s-squiggle" stroke="#ffd12e" />
      </div>

      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow">
          <span className="live-dot" /> Independent browser arcade
        </p>
        <h1 id="hero-title" className="hero-title">
          <span className="line">One more round.</span>
          <span className="line">
            <span className={`glitch hero-hl${glitching ? ' is-glitching' : ''}`} data-text="Then another.">
              Then another.
            </span>
          </span>
        </h1>
        <p className="hero-sub">
          GlitchBound makes small, sharp games you can start in a second and think about all day. No installs, no accounts. Just press play.
        </p>
        <div className="hero-ctas">
          <Link href={href} className="btn btn-lime btn-lg">
            <Icon name="play" /> Play {featured.title}
          </Link>
          <Link href="/#arcade" className="btn btn-lg hero-secondary">
            Explore the arcade <Icon name="arrowRight" />
          </Link>
        </div>
        <ul className="hero-facts mono" aria-label="What to expect">
          <li>Free to play</li>
          <li>Runs in your browser</li>
          <li>Your stats stay on your device</li>
        </ul>
      </div>

      <div className="hero-stage">
        <div className="orbit" aria-hidden="true">
          <div className="orbit-ring">
            <Cube className="orbiter o1" />
            <Dot className="orbiter o2" fill="#ffd12e" />
            <Tri className="orbiter o3" fill="#ff5a6c" />
            <Ring className="orbiter o4" fill="#c4f034" />
          </div>
        </div>
        <Link href={href} className="cart" data-accent={featured.accent} aria-label={`Play ${featured.title}`}>
          <div className="cart-screen">
            <RoadPreview className="cart-canvas" />
            <span className="cart-scan" aria-hidden="true" />
            <span className="cart-tag mono">Live preview</span>
          </div>
          <div className="cart-label">
            <div>
              <span className="mono cart-kicker">
                Featured · {CATEGORIES[featured.categories[0]].label}
              </span>
              <span className="cart-title">{featured.title}</span>
            </div>
            <span className="cart-play" aria-hidden="true">
              <Icon name="play" size={26} />
            </span>
          </div>
          {isNew(featured) && <span className="sticker cart-sticker">New</span>}
        </Link>
      </div>
    </section>
  );
}
