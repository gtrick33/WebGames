import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { CLASSES } from '../data/classes';
import { REGIONS } from '../data/regions';
import type { RegionId } from '../data/types';
import type { SigilEngine } from '../engine';
import type { Character } from '../progress/character';
import { heroTitle, wornLooks } from '../progress/wardrobe';
import { iconPicture, iconsReady } from '../render/art/gameIcons';
import { VIGIL_ICON } from '../render/art/iconPicks';
import { makeMotes, paintSanctumLight, paintSanctumStone, PLINTHS, SANCTUM_H, SANCTUM_W } from '../render/sanctum';
import { heroDollUrl, heroLook } from '../render/sprites';

const VIEWS = ['down', 'side', 'up'] as const;
/** Banners and sigil for the hall before there is a hero to take their color from. */
const EMPTY_COLOR = '#8d6bff';

const farthest = (unlocked: RegionId[]) => unlocked.map((id) => REGIONS[id]).reduce((a, b) => (b.levels[1] > a.levels[1] ? b : a), REGIONS.emberwick);

/** Where a slot stands, by how far it is from the chosen one on the ring. */
function placeOf(offset: number): { x: number; y: number; scale: number; dim: boolean } {
  if (offset === 0) return { x: 0, y: 0, scale: 1, dim: false };
  return { x: offset * PLINTHS.dx, y: PLINTHS.y - 286 - 2, scale: 0.6, dim: true };
}

/**
 * The first thing a player sees: their hero, standing on the dais in the Wardens' Sanctum. Arrows, the keyboard or a
 * swipe walk the ring of heroes round; an empty place is a shadow with a plus. Drag the hero to turn them. The
 * hall's banners and the sigil under their feet take the color of whoever stands there.
 */
export function CharacterSelect({ engine, onRift, onVigil, onRing, onSettings, confirmDelete, setConfirmDelete }: { engine: SigilEngine; onRift: (slot: number) => void; onVigil: () => void; onRing: () => void; onSettings: () => void; confirmDelete: number | null; setConfirmDelete: (n: number | null) => void }) {
  const heroes = engine.heroes();
  const n = heroes.length;
  const [at, setAt] = useState(() => Math.max(0, engine.save.last));
  const [view, setView] = useState(0);
  // the modes' icons come with the atlas
  const [, setIcons] = useState(false);
  useEffect(() => {
    void iconsReady.then(setIcons);
  }, []);
  const hero: Character | null = heroes[at] ?? null;
  const color = hero ? CLASSES[hero.cls].colors.main : EMPTY_COLOR;

  /* ------------------------------------------------- the hall, on its canvas */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);
  const flareRef = useRef(1);
  useEffect(() => {
    colorRef.current = color;
    flareRef.current = 1;
  }, [color, at]);
  useEffect(() => {
    const c = canvasRef.current!;
    const g = c.getContext('2d')!;
    const stone = document.createElement('canvas');
    stone.width = SANCTUM_W;
    stone.height = SANCTUM_H;
    paintSanctumStone(stone.getContext('2d')!);
    const motes = makeMotes(60);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      flareRef.current = Math.max(0, flareRef.current - dt * 1.3);
      g.drawImage(stone, 0, 0);
      paintSanctumLight(g, colorRef.current, now / 1000, flareRef.current, motes);
    };
    // one still frame right away, for a pane that isn't animating yet
    g.drawImage(stone, 0, 0);
    paintSanctumLight(g, colorRef.current, 0, 0, motes);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ------------------------------------------------- walking the ring */
  const go = useCallback(
    (d: number) => {
      setAt((a) => (a + d + n) % n);
      setView(0);
      setConfirmDelete(null);
      engine.sound.play('quest', 0.25);
    },
    [engine, n, setConfirmDelete],
  );
  const primary = useCallback(() => {
    if (hero) engine.play(at);
    else engine.newHeroScreen(at);
  }, [at, engine, hero]);
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'ArrowLeft') go(-1);
      else if (e.code === 'ArrowRight') go(1);
      else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) primary();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, primary]);

  /* ------------------------------------------------- the stage follows the pointer a little, for depth */
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // the hall covers the stage, whatever its shape
    const box = boxRef.current!;
    const fit = (): void => box.style.setProperty('--scale', String(Math.max(box.clientWidth / SANCTUM_W, box.clientHeight / SANCTUM_H)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  const move = (e: ReactPointerEvent): void => {
    const box = boxRef.current;
    if (!box || e.pointerType !== 'mouse') return;
    const r = box.getBoundingClientRect();
    box.style.setProperty('--px', String((e.clientX - r.left) / r.width - 0.5));
    box.style.setProperty('--py', String((e.clientY - r.top) / r.height - 0.5));
  };

  /* ------------------------------------------------- swipe to walk, drag the hero to turn them */
  const drag = useRef<{ x: number; turned: boolean; onHero: boolean } | null>(null);
  const down = (e: ReactPointerEvent, onHero: boolean): void => {
    drag.current = { x: e.clientX, turned: false, onHero };
  };
  const up = (e: ReactPointerEvent): void => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.onHero) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 44) go(dx < 0 ? 1 : -1);
  };
  const dragMove = (e: ReactPointerEvent): void => {
    move(e);
    const d = drag.current;
    if (!d?.onHero) return;
    if (Math.abs(e.clientX - d.x) > 26) {
      d.x = e.clientX;
      d.turned = true;
      setView((v) => (v + 1) % 4);
    }
  };

  const shownView = (i: number): { view: (typeof VIEWS)[number]; flip: boolean } => {
    if (i !== at) return { view: 'down', flip: false };
    return view === 3 ? { view: 'side', flip: true } : { view: VIEWS[view]!, flip: false };
  };
  const dolls = useMemo(() => heroes.map((h) => (h ? VIEWS.map((v) => heroDollUrl(heroLook(h.cls, h.equip, wornLooks(h), h.body, h.face), v, 4)) : null)), [heroes]);
  // an empty place shows the shape of someone who could stand there
  const shadow = useMemo(() => heroDollUrl(heroLook('warrior'), 'down', 4), []);

  return (
    <div className="cs" ref={boxRef} onPointerMove={dragMove} onPointerDown={(e) => down(e, false)} onPointerUp={up} style={{ ['--cc' as string]: color }}>
      <div className="cs-stage">
        <canvas ref={canvasRef} className="cs-hall" width={SANCTUM_W} height={SANCTUM_H} aria-hidden="true" />
        {heroes.map((h, i) => {
          const off = ((i - at + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);
          const p = placeOf(off);
          const sv = shownView(i);
          return (
            <button
              key={i}
              type="button"
              className={`cs-figure${off === 0 ? ' is-here' : ' is-away'}${h ? '' : ' is-empty'}`}
              style={{ transform: `translate(${p.x}px, ${p.y}px) scale(${p.scale})`, zIndex: off === 0 ? 3 : 2 }}
              aria-label={off === 0 ? (h ? `${h.name}. Drag to turn` : 'Empty place: make a new hero') : h ? `Choose ${h.name}` : 'Choose the empty place'}
              onPointerDown={(e) => {
                if (off === 0 && h) {
                  e.stopPropagation();
                  down(e, true);
                }
              }}
              onClick={() => {
                if (off !== 0) go(off);
                else if (!h) engine.newHeroScreen(i);
                else if (!drag.current?.turned) setView((v) => (v + 1) % 4);
              }}
            >
              <span className="cs-shadow" />
              {h ? (
                <img className={`cs-doll${off === 0 ? ' is-breathing' : ''}${sv.flip ? ' is-flip' : ''}`} src={dolls[i]![VIEWS.indexOf(sv.view)]} alt="" draggable={false} />
              ) : (
                <>
                  <img className="cs-doll is-shape" src={shadow} alt="" draggable={false} />
                  <span className="cs-plus" aria-hidden="true">
                    +
                  </span>
                </>
              )}
              {off !== 0 && h && <span className="cs-tag">{h.name}</span>}
            </button>
          );
        })}
      </div>

      <div className="cs-top">
        <div className="cs-mark">
          <span className="cs-kicker">A GlitchBound adventure</span>
          <span className="cs-word">Sigilfall</span>
        </div>
        <div className="cs-top-btns">
          <button className="rb-iconbtn" onClick={onSettings} aria-label="Settings">
            ⚙
          </button>
          <GameMenuButton className="rb-iconbtn" />
        </div>
      </div>

      <button className="cs-arrow is-left" onClick={() => go(-1)} aria-label="Previous hero">
        <i />
      </button>
      <button className="cs-arrow is-right" onClick={() => go(1)} aria-label="Next hero">
        <i />
      </button>

      <div className="cs-id" key={at}>
        {hero ? (
          <>
            <h1 className="cs-name">{hero.name}</h1>
            <p className="cs-line">
              <b style={{ color: CLASSES[hero.cls].colors.accent }}>
                Level {hero.level} {CLASSES[hero.cls].name}
              </b>
              <span> · {heroTitle(hero) ?? farthest(hero.unlocked).name}</span>
            </p>
          </>
        ) : (
          <>
            <h1 className="cs-name">A place waits</h1>
            <p className="cs-line">Seven callings, five acts, one Crown. Who will you be?</p>
          </>
        )}
        <ol className="cs-dots" aria-label={`Hero ${at + 1} of ${n}`}>
          {heroes.map((h, i) => (
            <li key={i} className={`${i === at ? 'is-on' : ''}${h ? '' : ' is-free'}`} />
          ))}
        </ol>
      </div>

      <div className="cs-actions">
        <div className="cs-mode-stack">
          <button className="cs-mode is-vigil" onClick={onVigil}>
            <img className="cs-mode-glyph" src={iconPicture(VIGIL_ICON.vigil!)} alt="" draggable={false} />
            <span>
              <strong>The Vigil</strong>
              <small>Hold the line</small>
            </span>
          </button>
          <button className="cs-mode is-ring" onClick={onRing}>
            <img className="cs-mode-glyph" src={iconPicture(VIGIL_ICON.ring!)} alt="" draggable={false} />
            <span>
              <strong>The Ring</strong>
              <small>Arena, 1v1 to 3v3</small>
            </span>
          </button>
        </div>
        <button className="cs-enter" onClick={primary} autoFocus>
          {hero ? 'Enter the world' : 'Create your hero'}
        </button>
        {hero && hero.keystone >= 1 ? (
          <button className="cs-mode is-rift" onClick={() => onRift(at)}>
            <img className="cs-mode-glyph" src={iconPicture(VIGIL_ICON.rift!)} alt="" draggable={false} />
            <span>
              <strong>Rift Trials</strong>
              <small>Riftstone +{hero.keystone}</small>
            </span>
          </button>
        ) : (
          <span className="cs-mode-gap" />
        )}
      </div>

      {hero && (
        <div className="cs-delete">
          {confirmDelete === at ? (
            <>
              <button
                className="rb-btn is-small is-danger"
                onClick={() => {
                  engine.deleteHero(at);
                  setConfirmDelete(null);
                }}
              >
                Delete {hero.name} for good?
              </button>
              <button className="rb-btn is-small is-ghost" onClick={() => setConfirmDelete(null)}>
                Keep
              </button>
            </>
          ) : (
            <button className="cs-delete-btn" onClick={() => setConfirmDelete(at)} aria-label={`Delete ${hero.name}`}>
              Delete hero
            </button>
          )}
        </div>
      )}
    </div>
  );
}
