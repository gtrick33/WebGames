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
import { buildLabel } from '../../../buildLabel';

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
  const color = hero ? CLASSES[hero.cls].colors.main : '#8d6bff';
  const [night] = useState(longestNight);
  const [standing] = useState(topStanding);
  // the small menu behind the cog, top right: the rankings, the shop, the settings and deleting a hero
  const [menu, setMenu] = useState(false);

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
      // (the hall is a menu: no faster than a touch screen is held to, nor than the battery saver asks)
      if (now - last < engine.frameGap) return;
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
  }, [engine]);

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
      else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) onRing();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, onRing]);

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
          {/* (which build this is, small, so the latest can be told apart: src/buildLabel.ts) */}
          <small className="cs-version" title={`Built ${__BUILD__.day}`}>
            {buildLabel()}
          </small>
        </div>
        {/* (one cog for the hall's own things, beside the arcade's menu: the owner, 2026-11-21, "too many buttons") */}
        <div className="cs-top-btns">
          <button className={`rb-iconbtn cs-cog${menu ? ' is-on' : ''}`} onClick={() => setMenu((m) => !m)} aria-label="Options" aria-expanded={menu} title="Options">
            ⚙
          </button>
          <GameMenuButton className="rb-iconbtn" />
          {menu && (
            <>
              <button className="cs-menu-shade" aria-label="Close options" onClick={() => setMenu(false)} />
              <div className="cs-menu" role="menu">
                <button role="menuitem" onClick={() => (setMenu(false), onRanks())}>
                  <span aria-hidden="true">♛</span> Rankings
                </button>
                {onStore && (
                  <button role="menuitem" onClick={() => (setMenu(false), onStore())}>
                    <img src={uiIcon('store', 2)} alt="" draggable={false} /> Shop
                  </button>
                )}
                <button role="menuitem" onClick={() => (setMenu(false), onSettings())}>
                  <span aria-hidden="true">⚙</span> Settings
                </button>
                {hero && (
                  <button role="menuitem" className="is-danger" onClick={() => (setMenu(false), setConfirmDelete(at))}>
                    <span aria-hidden="true">🗑</span> Delete {hero.name}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="cs-id" key={at}>
        {hero ? (
          <>
            <div className="cs-plate">
              <Arrows go={go} />
              <h2 className="cs-name">{hero.name}</h2>
            </div>
            {/* (their level and calling on a line of their own, large: the owner could not read them on a big screen) */}
            <p className="cs-line">
              <b className="cs-class" style={{ color: CLASSES[hero.cls].colors.accent }}>
                Level {hero.level} {CLASSES[hero.cls].name}
              </b>
              <HeroPlace engine={engine} hero={hero} />
            </p>
          </>
        ) : (
          <>
            <div className="cs-plate">
              <Arrows go={go} />
              <h2 className="cs-name">A place waits</h2>
            </div>
            <p className="cs-line">Eight callings, six acts, one Crown. Who will you be?</p>
          </>
        )}
        <ol className="cs-dots" aria-label={`Hero ${at + 1} of ${n}`}>
          {heroes.map((h, i) => (
            <li key={i} className={`${i === at ? 'is-on' : ''}${h ? '' : ' is-free'}`} />
          ))}
        </ol>
      </div>

      {/* The ways in. The Ring, the game's first, is the great button at the foot of the hall; the others hang in the hall
          itself as its banners, two either side (the owner, 2026-11-21: "too many buttons, would be nice if those buttons
          are somehow integrated within the screen itself, like banners"). Each says what it is, and where this hero
          stands in it. */}
      <nav className="cs-banners" aria-label="Ways to play">
        <div className="cs-banner-side is-left">
          <Banner kind="story" icon={VIGIL_ICON.story!} name={hero ? 'Campaign' : 'New hero'} sub={hero ? farthest(hero.unlocked).name : 'Eight callings, one Crown'} onClick={primary} />
          {/* (the Trials are the account's, not a hero's: open once any hero has reached level 20, played as a calling's
              own ready champion: progress/trial.ts) */}
          <Banner kind="rift" icon={VIGIL_ICON.rift!} name="Rift Trials" sub={trialsOpen(engine.save) ? `Best stone +${Math.max(1, ...Object.values(engine.save.rift))}` : `Opens at level ${TRIALS_OPEN_AT}`} locked={!trialsOpen(engine.save)} onClick={() => onRift(at)} />
        </div>
        <div className="cs-banner-side is-right">
          <Banner kind="vigil" icon={VIGIL_ICON.vigil!} name="The Vigil" sub={night > 0 ? `Best ${clock(night)}` : 'The endless horde'} onClick={onVigil} />
          <Banner kind="party" glyph="⚑" name="Together" sub={hero ? 'Up to four friends' : 'Make a hero first'} locked={!hero} onClick={() => engine.playTogether(at)} />
        </div>
      </nav>
      <div className="cs-actions">
        <button className="cs-enter is-ring" onClick={onRing} autoFocus>
          <img className="cs-enter-glyph" src={iconPicture(VIGIL_ICON.ring!)} alt="" draggable={false} />
          <span className="cs-enter-words">
            <span>Enter the Ring</span>
            <small>
              Arena duels · {standing.rating} {rankOf(standing.best).name}
            </small>
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

/** Under a hero's level and calling: the title they wear, in its light, or else the farthest land they have reached. */
function HeroPlace({ engine, hero }: { engine: SigilEngine; hero: Character }) {
  const title = wornTitleShown(hero, engine.ringRating());
  return <span className="cs-place">{title ? <TitleFx fx={title.fx}>{title.text}</TitleFx> : farthest(hero.unlocked).name}</span>;
}

/** The arrows either side of the hero's name: the ring of heroes walks round by one. */
function Arrows({ go }: { go: (d: number) => void }) {
  return (
    <>
      <button className="cs-arrow is-left" onClick={() => go(-1)} aria-label="Previous hero">
        <i />
      </button>
      <button className="cs-arrow is-right" onClick={() => go(1)} aria-label="Next hero">
        <i />
      </button>
    </>
  );
}

/**
 * One of the hall's banners, a way in: cloth of its mode's color on a gold rod, its emblem in a gold disc, its name and a
 * line under it, swaying a little. A locked one hangs grey and does nothing.
 */
function Banner({ kind, icon, glyph, name, sub, locked, onClick }: { kind: string; icon?: string; glyph?: string; name: string; sub: string; locked?: boolean; onClick: () => void }) {
  return (
    <button className={`cs-banner is-${kind}${locked ? ' is-locked' : ''}`} disabled={locked} onClick={onClick}>
      <i className="cs-banner-rod" aria-hidden="true" />
      <span className="cs-banner-cloth">
        <span className="cs-banner-emblem" aria-hidden="true">
          {icon ? <img src={iconPicture(icon)} alt="" draggable={false} /> : glyph}
        </span>
        <strong>{name}</strong>
        <small>{sub}</small>
      </span>
    </button>
  );
}
