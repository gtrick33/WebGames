import { TRIALS_OPEN_AT, trialsOpen } from '../progress/trial';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { uiIcon } from './uiIcons';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { CLASSES } from '../data/classes';
import { REGIONS } from '../data/regions';
import type { RegionId } from '../data/types';
import type { SigilEngine } from '../engine';
import { SIGILS, type Character } from '../progress/character';
import { rankOf, topStanding } from '../arena/ranks';
import { wornLooks } from '../progress/wardrobe';
import { wornTitleShown } from '../progress/titles';
import { TitleFx } from '../../../components/TitleFx';
import { longestNight } from '../vigil/bests';
import { iconPicture, iconsReady } from '../render/art/gameIcons';
import { VIGIL_ICON } from '../render/art/iconPicks';
import { heldWeapon, heroLook } from '../render/sprites';
import { Hall3D, type HallHero } from '../render3d/hall';
import { shieldOf } from '../render3d/worldCast';

/** How far apart the others stand, on the stage's own grid. */
const PLINTHS = { dx: 184, y: 286 };
const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const farthest = (unlocked: RegionId[]) => unlocked.map((id) => REGIONS[id]).reduce((a, b) => (b.levels[1] > a.levels[1] ? b : a), REGIONS.emberwick);

/** Where a slot stands, by how far it is from the chosen one on the ring. */
function placeOf(offset: number): { x: number; y: number; scale: number; dim: boolean } {
  if (offset === 0) return { x: 0, y: 0, scale: 1, dim: false };
  return { x: offset * PLINTHS.dx, y: -22, scale: 0.6, dim: true };
}

/**
 * The first thing a player sees: their hero, standing on the dais in the Wardens' Sanctum. Arrows, the keyboard or a
 * swipe walk the ring of heroes round; an empty place is a shadow with a plus. Drag the hero to turn them. The
 * hall's banners and the sigil under their feet take the color of whoever stands there.
 */
export function CharacterSelect({ engine, onRift, onVigil, onRing, onRanks, onSettings, onStore, confirmDelete, setConfirmDelete }: { engine: SigilEngine; onRift: (slot: number) => void; onVigil: () => void; onRing: () => void; onRanks: () => void; onSettings: () => void; onStore?: () => void; confirmDelete: number | null; setConfirmDelete: (n: number | null) => void }) {
  const heroes = engine.heroes();
  const n = heroes.length;
  // (the last hero played may be in a place this account no longer plays: the pack's, after a refund)
  const [at, setAt] = useState(() => Math.max(0, Math.min(engine.save.last, n - 1)));
  // the modes' icons come with the atlas
  const [, setIcons] = useState(false);
  useEffect(() => {
    void iconsReady.then(setIcons);
  }, []);
  const hero: Character | null = heroes[at] ?? null;
  const heroTitle = hero ? wornTitleShown(hero, engine.ringRating()) : null;
  const color = hero ? CLASSES[hero.cls].colors.main : '#8d6bff';
  const [night] = useState(longestNight);
  const [standing] = useState(topStanding);

  /* ------------------------------------------------- the hall, in 3D, with everyone in it */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cast = useMemo<(HallHero | null)[]>(() => heroes.map((h) => (h ? { look: heroLook(h.cls, h.equip, wornLooks(h), h.body, h.face), held: heldWeapon(h.cls, h.equip.weapon, wornLooks(h).weapon), shield: shieldOf(h.cls), color: CLASSES[h.cls].colors.accent, sigils: SIGILS.map((id) => h.perks.includes(id)) } : null)), [heroes]);
  const liveRef = useRef({ cast, at, spin: 0.2 });
  useEffect(() => {
    liveRef.current.cast = cast;
    liveRef.current.at = at;
  }, [cast, at]);
  useEffect(() => {
    const c = canvasRef.current!;
    const box = c.parentElement!;
    let hall: Hall3D;
    try {
      hall = new Hall3D(c);
    } catch {
      return undefined;
    }
    const fit = (): void => {
      if (box.clientWidth && box.clientHeight) hall.fit(box.clientWidth, box.clientHeight, Math.min(2, window.devicePixelRatio || 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const live = liveRef.current;
      hall.frame(live.cast, live.at, live.spin, dt, now / 1000);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      hall.dispose();
    };
  }, []);

  /* ------------------------------------------------- walking the ring */
  const go = useCallback(
    (d: number) => {
      setAt((a) => (a + d + n) % n);
      liveRef.current.spin = 0.2;
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
  // (before the first paint, and never to nothing: a hall that starts at the wrong size slides into place, and takes
  // the hero with it)
  useLayoutEffect(() => {
    // the hall covers the stage, whatever its shape
    const box = boxRef.current!;
    const fit = (): void => {
      if (!box.clientWidth || !box.clientHeight) return;
      box.style.setProperty('--scale', String(Math.max(box.clientWidth / 640, box.clientHeight / 360)));
    };
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
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.turned = true;
    d.x = e.clientX;
    liveRef.current.spin += dx * 0.016;
  };

  return (
    <div className="cs" ref={boxRef} onPointerMove={dragMove} onPointerDown={(e) => down(e, false)} onPointerUp={up} style={{ ['--cc' as string]: color }}>
      <canvas ref={canvasRef} className="cs-hall" aria-hidden="true" />
      <div className="cs-stage">
        {heroes.map((h, i) => {
          const off = ((i - at + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);
          const p = placeOf(off);
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
                else if (!drag.current?.turned) liveRef.current.spin += Math.PI / 2;
              }}
            >
              <span className="cs-body" />
              {!h && (
                <span className="cs-plus" aria-hidden="true">
                  +
                </span>
              )}
              {off !== 0 && h && <span className="cs-tag">{h.name}</span>}
            </button>
          );
        })}
      </div>

      <div className="cs-top">
        <div className="cs-mark">
          <span className="cs-kicker">A GlitchBound adventure</span>
          <img className="cs-word" src="/games/sigilfall/logo.svg" alt="Sigilfall" width={673} height={168} />
        </div>
        <div className="cs-top-btns">
          {hero && (
            <button className="rb-iconbtn cs-delete" onClick={() => setConfirmDelete(at)} aria-label={`Delete ${hero.name}`} title={`Delete ${hero.name}`}>
              🗑
            </button>
          )}
          {/* (the game's own shop, where there is one: a small button among the others, never more) */}
          {onStore && (
            <button className="rb-iconbtn cs-store" onClick={onStore} aria-label="Shop" title="Shop">
              <img src={uiIcon('store', 2)} alt="" draggable={false} />
            </button>
          )}
          <button className="rb-iconbtn" onClick={onRanks} aria-label="Rankings" title="Rankings">
            ♛
          </button>
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
            <h2 className="cs-name">{hero.name}</h2>
            {/* (their level and calling on a line of their own, large: the owner could not read them on a big screen) */}
            <p className="cs-line">
              <b className="cs-class" style={{ color: CLASSES[hero.cls].colors.accent }}>
                Level {hero.level} {CLASSES[hero.cls].name}
              </b>
              <span className="cs-place">{heroTitle ? <TitleFx fx={heroTitle.fx}>{heroTitle.text}</TitleFx> : farthest(hero.unlocked).name}</span>
            </p>
          </>
        ) : (
          <>
            <h2 className="cs-name">A place waits</h2>
            <p className="cs-line">Eight callings, five acts, one Crown. Who will you be?</p>
          </>
        )}
        <ol className="cs-dots" aria-label={`Hero ${at + 1} of ${n}`}>
          {heroes.map((h, i) => (
            <li key={i} className={`${i === at ? 'is-on' : ''}${h ? '' : ' is-free'}`} />
          ))}
        </ol>
      </div>

      {/* the ways in: the story in the middle, the three other modes and playing with friends beside it. Each says in
          a line what it is, and where this hero stands in it. */}
      <div className="cs-actions">
        {/* (the Trials are the account's, not a hero's: open once any hero has reached level 20, played as a calling's
            own ready champion: progress/trial.ts) */}
        <button className={`cs-mode is-rift${trialsOpen(engine.save) ? '' : ' is-locked'}`} disabled={!trialsOpen(engine.save)} onClick={() => onRift(at)}>
          <img className="cs-mode-glyph" src={iconPicture(VIGIL_ICON.rift!)} alt="" draggable={false} />
          <span>
            <strong>Rift Trials</strong>
            <small>{trialsOpen(engine.save) ? `Dungeons against the clock · best stone +${Math.max(1, ...Object.values(engine.save.rift))}` : `Opens when a hero reaches level ${TRIALS_OPEN_AT}`}</small>
          </span>
        </button>
        <button className="cs-mode is-ring" onClick={onRing}>
          <img className="cs-mode-glyph" src={iconPicture(VIGIL_ICON.ring!)} alt="" draggable={false} />
          <span>
            <strong>The Ring</strong>
            <small>
              Arena duels · {standing.rating} {rankOf(standing.best).name}
            </small>
          </span>
        </button>
        <button className="cs-enter" onClick={primary} autoFocus>
          <span>{hero ? 'Enter the world' : 'Create your hero'}</span>
          {hero && <small>The story · {farthest(hero.unlocked).name}</small>}
        </button>
        <button className="cs-mode is-vigil" onClick={onVigil}>
          <img className="cs-mode-glyph" src={iconPicture(VIGIL_ICON.vigil!)} alt="" draggable={false} />
          <span>
            <strong>The Vigil</strong>
            <small>{night > 0 ? `Hold out against the horde · best ${clock(night)}` : 'Hold out against the endless horde'}</small>
          </span>
        </button>
        <button className={`cs-mode is-party${hero ? '' : ' is-locked'}`} disabled={!hero} onClick={() => engine.playTogether(at)}>
          <span className="cs-mode-glyph is-party" aria-hidden="true">
            ⚑
          </span>
          <span>
            <strong>Play together</strong>
            <small>{hero ? 'The story or a Rift, with up to three friends' : 'Make a hero first'}</small>
          </span>
        </button>
      </div>

      {hero && confirmDelete === at && (
        <div className="rb-ring-dialog-wrap" role="dialog" aria-label={`Delete ${hero.name}`}>
          <div className="rb-ring-dialog">
            <h2>Delete {hero.name}?</h2>
            <p>
              Level {hero.level} {CLASSES[hero.cls].name}. This hero, their gear and their story are gone for good.
            </p>
            <div className="rb-vigil-actions">
              <button className="rb-btn" onClick={() => setConfirmDelete(null)} autoFocus>
                Keep them
              </button>
              <button
                className="rb-btn is-danger"
                onClick={() => {
                  engine.deleteHero(at);
                  setConfirmDelete(null);
                }}
              >
                Delete for good
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
