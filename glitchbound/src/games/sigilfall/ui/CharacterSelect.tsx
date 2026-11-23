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
import type { BannerSpec } from '../render3d/hallBanners';
import { shieldOf } from '../render3d/worldCast';
import { buildLabel } from '../../../buildLabel';

/** How far apart the others stand, on the stage's own grid. */
/** The others' places either side of the dais (render3d/hall.ts placeOf: 2.05 across), nearer than the banners. */
const PLINTHS = { dx: 150, y: 286 };
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

  /* ------------------------------------------------- the hall, in 3D, with everyone in it */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cast = useMemo<(HallHero | null)[]>(() => heroes.map((h) => (h ? { look: heroLook(h.cls, h.equip, wornLooks(h), h.body, h.face), held: heldWeapon(h.cls, h.equip.weapon, wornLooks(h).weapon), shield: shieldOf(h.cls), color: CLASSES[h.cls].colors.accent, sigils: SIGILS.map((id) => h.perks.includes(id)) } : null)), [heroes]);
  const liveRef = useRef({ cast, at, spin: 0.2 });
  useEffect(() => {
    liveRef.current.cast = cast;
    liveRef.current.at = at;
  }, [cast, at]);
  const hallRef = useRef<Hall3D | null>(null);
  useEffect(() => {
    const c = canvasRef.current!;
    const box = c.parentElement!;
    let hall: Hall3D;
    try {
      hall = new Hall3D(c);
    } catch {
      return undefined;
    }
    hallRef.current = hall;
    // (what the screen keeps for itself at its sides, a phone's island: read off a probe padded by it)
    const probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;padding-left:var(--sa-l,0px);padding-right:var(--sa-r,0px)';
    box.appendChild(probe);
    const fit = (): void => {
      if (box.clientWidth && box.clientHeight) hall.fit(box.clientWidth, box.clientHeight, Math.min(2, window.devicePixelRatio || 1));
      const s = getComputedStyle(probe);
      hall.setSafe(parseFloat(s.paddingLeft) || 0, parseFloat(s.paddingRight) || 0);
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
      probe.remove();
      hallRef.current = null;
      hall.dispose();
    };
  }, [engine]);

  /* ------------------------------------------------- the others' places, clear of the banners */
  // The ring of heroes is drawn over the hall (its plus for an empty place, a name over each one waiting), and the
  // banners hang in the hall: where one of those would lie over a banner it steps down to just under the banner's
  // foot, and the place's own reach stops taking the banner's clicks (the owner, 2026-11-21: "the + buttons are on top
  // of the banners", on a phone, a computer and a 4K screen alike: measured on the screen, whatever its size).
  useEffect(() => {
    const id = window.setInterval(() => {
      const hall = hallRef.current;
      const c = canvasRef.current;
      const box = boxRef.current;
      if (!hall || !c || !box) return;
      const cr = c.getBoundingClientRect();
      const banners: { l: number; t: number; r: number; b: number }[] = [];
      for (let i = 0; i < 4; i++) {
        const b = hall.bannerBox(i);
        if (b) banners.push({ l: cr.left + b.x * cr.width, t: cr.top + b.y * cr.height, r: cr.left + (b.x + b.w) * cr.width, b: cr.top + (b.y + b.h) * cr.height });
      }
      for (const fig of box.querySelectorAll<HTMLElement>('.cs-figure')) {
        const away = fig.classList.contains('is-away');
        for (const part of fig.querySelectorAll<HTMLElement>('.cs-body')) {
          const rect = part.getBoundingClientRect();
          const k = rect.height / (part.offsetHeight || 1) || 1;
          const was = Number(part.dataset.dy ?? 0);
          // (where it would be without the step it has taken)
          const top = rect.top - was * k;
          const bottom = rect.bottom - was * k;
          const over = away ? banners.filter((b) => rect.left < b.r && rect.right > b.l && top < b.b && bottom > b.t) : [];
          if (part.classList.contains('cs-body')) {
            part.style.pointerEvents = over.length ? 'none' : '';
            continue;
          }
          const dy = over.length ? Math.max(...over.map((b) => (b.b + 6 - top) / k)) : 0;
          if (Math.abs(dy - was) < 0.5) continue;
          part.dataset.dy = String(dy);
          part.style.translate = dy ? `0 ${dy}px` : '';
        }
      }
    }, 120);
    return () => window.clearInterval(id);
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

  /* ------------------------------------------------- the hall's four banners: the ways in */
  // (render3d/hallBanners.ts hangs them in the hall itself; these say what each says and does, left to right. The Vigil
  // first and the Ring third since the owner, 2026-11-22: "switch the vigil and the ring banners")
  const trials = trialsOpen(engine.save);
  // (a hero of the player's own who has reached the Riftward can take the Riftstone from here too: ui/RiftScreen.tsx)
  const riftward = heroes.some((x) => !!x && x.unlocked.includes('riftward'));
  const ways: (BannerSpec & { go: () => void })[] = [
    { id: 'vigil', name: 'The Vigil', sub: night > 0 ? `The endless horde · best ${clock(night)}` : 'Hold out against the endless horde', color: '#d0602a', icon: iconPicture(VIGIL_ICON.vigil!), go: onVigil },
    { id: 'story', name: hero ? 'Campaign' : 'New hero', sub: hero ? `The story · ${farthest(hero.unlocked).name}` : 'Eight callings, one Crown', color: '#3a6ad8', icon: iconPicture(VIGIL_ICON.story!), go: primary },
    { id: 'ring', name: 'The Ring', sub: `Arena duels · ${standing.rating} ${rankOf(standing.best).name}`, color: '#d8304a', icon: iconPicture(VIGIL_ICON.ring!), go: onRing },
    // (the Trials are the account's, not a hero's: open once any hero has reached level 20, played as a calling's own
    // ready champion: progress/trial.ts)
    { id: 'rift', name: 'The Riftstone', sub: riftward ? `Your heroes or a champion · best +${Math.max(1, ...heroes.map((x) => x?.keystone ?? 0), ...Object.values(engine.save.rift))}` : trials ? `Champions against the clock · best +${Math.max(1, ...Object.values(engine.save.rift))}` : `Opens when a hero reaches level ${TRIALS_OPEN_AT}`, color: '#8a5ae8', icon: iconPicture(VIGIL_ICON.rift!), locked: !trials && !riftward, go: () => onRift(at) },
  ];
  const specs = ways.map(({ go: _go, ...s }) => s);
  const specKey = JSON.stringify(specs);
  useEffect(() => {
    hallRef.current?.setBanners(JSON.parse(specKey) as BannerSpec[]);
  }, [specKey]);
  const [lit, setLit] = useState(-1);
  const light = (i: number): void => {
    setLit(i);
    hallRef.current?.hoverBanner(i);
  };
  /** The banner under the pointer, or -1 (the canvas's own corner is the hall's). */
  const bannerAt = (e: ReactPointerEvent): number => {
    const c = canvasRef.current;
    if (!c || !hallRef.current) return -1;
    if ((e.target as HTMLElement).closest('button, a, [role="menu"]')) return -1;
    const r = c.getBoundingClientRect();
    return hallRef.current.pickBanner(e.clientX - r.left, e.clientY - r.top);
  };

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
    // a tap or a click on one of the hall's banners: its way in
    else if (Math.abs(dx) < 10) {
      const i = bannerAt(e);
      const way = ways[i];
      if (way && !way.locked) {
        engine.sound.play('quest', 0.3);
        way.go();
      }
    }
  };
  const dragMove = (e: ReactPointerEvent): void => {
    move(e);
    if (!drag.current && e.pointerType === 'mouse') {
      const i = bannerAt(e);
      if (i !== lit) light(i);
    }
    const d = drag.current;
    if (!d?.onHero) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.turned = true;
    d.x = e.clientX;
    liveRef.current.spin += dx * 0.016;
  };

  return (
    <div className={`cs${lit >= 0 && !ways[lit]?.locked ? ' is-pointing' : ''}`} ref={boxRef} onPointerMove={dragMove} onPointerDown={(e) => down(e, false)} onPointerUp={up} onPointerLeave={() => light(-1)} style={{ ['--cc' as string]: color }}>
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
        {/* (each of the hall's own things a button of its own, in sight: the owner, 2026-11-23, "the options for the rankings
            shop etc are hidden behind the cogwheel, make them visible separate buttons". They were in one cog's menu
            since 2026-11-21's "too many buttons": small, with a word under each where there is room) */}
        <div className="cs-top-btns">
          <button className="rb-iconbtn cs-topbtn" onClick={onRanks} aria-label="Rankings" title="Rankings">
            <span aria-hidden="true">♛</span>
            <small>Rankings</small>
          </button>
          {onStore && (
            <button className="rb-iconbtn cs-topbtn" onClick={onStore} aria-label="Shop" title="Shop">
              <img src={uiIcon('store', 2)} alt="" draggable={false} />
              <small>Shop</small>
            </button>
          )}
          {hero && (
            <button className="rb-iconbtn cs-topbtn" onClick={() => engine.playTogether(at)} aria-label="Play together" title="Play together">
              <span aria-hidden="true">⚑</span>
              <small>Together</small>
            </button>
          )}
          <button className="rb-iconbtn cs-topbtn" onClick={onSettings} aria-label="Settings" title="Settings">
            <span aria-hidden="true">⚙</span>
            <small>Settings</small>
          </button>
          {hero && (
            <button className="rb-iconbtn cs-topbtn is-danger" onClick={() => setConfirmDelete(at)} aria-label={`Delete ${hero.name}`} title={`Delete ${hero.name}`}>
              <span aria-hidden="true">🗑</span>
              <small>Delete</small>
            </button>
          )}
          <GameMenuButton className="rb-iconbtn" />
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
        {/* the places, one each: tapped, the ring walks to it (on a phone the only way to an empty place: the others
            standing in the hall aren't buttons there) */}
        <ol className="cs-dots" aria-label={`Hero ${at + 1} of ${n}`}>
          {heroes.map((h, i) => (
            <li key={i} className={`${i === at ? 'is-on' : ''}${h ? '' : ' is-free'}`}>
              <button type="button" onClick={() => i !== at && go(((i - at + n + Math.floor(n / 2)) % n) - Math.floor(n / 2))} aria-label={h ? `Choose ${h.name}` : 'Choose an empty place'} title={h ? h.name : 'New hero'} aria-current={i === at}>
                {!h && <span aria-hidden="true">+</span>}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* The ways in hang in the hall itself (render3d/hallBanners.ts): four banners of the same weight, the Ring, the
          Campaign, the Vigil and the Rift Trials, pointed at and clicked in the picture. These buttons are theirs for the
          keyboard and for a screen reader: unseen, they light their banner up as they take the focus. */}
      <nav className="cs-ways" aria-label="Ways to play">
        {ways.map((w, i) => (
          <button key={w.id} disabled={w.locked} onClick={w.go} onFocus={() => light(i)} onBlur={() => light(-1)} aria-label={`${w.name}: ${w.sub}`}>
            {w.name}
          </button>
        ))}
      </nav>

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
