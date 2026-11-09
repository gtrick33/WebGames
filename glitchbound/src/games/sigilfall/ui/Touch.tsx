import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import { toLocalDelta } from './turn';
import { Stick } from './Stick';
import { slotLevel } from '../progress/character';
import { skillCost } from '../sim/cast';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import type { SlotKey } from '../data/types';
import type { SigilEngine } from '../engine';
import type { AimPreview } from '../render/renderer';
import { hasMount } from '../progress/wardrobe';
import { skillHasPicture, skillIconUrl } from '../render/sprites';
import { SUMMON_TIME, type World } from '../sim/world';
import { useFrame } from './GameScreen';
import { uiIcon } from './uiIcons';

/**
 * Two-thumb touch controls. Left: the joystick (ui/Stick.tsx). Right: attack, four skills, the ultimate and dodge. Attack aims at the nearest enemy (no aim
 * line); a tapped spell goes where the hero faces (the facing marker); drag a spell to aim it yourself
 * (drag back to the button to cancel). Every control captures its own finger, so moving and casting at
 * once just works.
 */

const AIM_DEADZONE = 14;
const AIM_RANGE = 70;

export function TouchControls({ engine }: { engine: SigilEngine }) {
  // fingers are let go when the controls go away (a menu opened)
  useEffect(() => () => engine.touch.release(), [engine]);
  // indoors is peaceful (sim/world.ts): only the stick and the Talk button
  if (engine.world?.region.interior) {
    return (
      <>
        <Joystick engine={engine} />
        <InteractButton engine={engine} />
      </>
    );
  }
  return (
    <>
      <Joystick engine={engine} />
      <div className="rb-cluster">
        {/* the lesson sits over the button it teaches (inside the cluster: its size and side follow the cluster's) */}
        {engine.ui.teach && !engine.ui.tip && (
          <div className={`rb-teach is-touch is-at-${engine.ui.teach.slot}`} role="status">
            {engine.ui.teach.text}
          </div>
        )}
        <SkillButton engine={engine} slot="basic" />
        <SkillButton engine={engine} slot="s1" />
        <SkillButton engine={engine} slot="s2" />
        <SkillButton engine={engine} slot="s3" />
        <SkillButton engine={engine} slot="s4" />
        <SkillButton engine={engine} slot="ult" />
        <SkillButton engine={engine} slot="dodge" />
        <PotionButton engine={engine} />
        <MountButton engine={engine} />
      </div>
      <InteractButton engine={engine} />
    </>
  );
}

function Joystick({ engine }: { engine: SigilEngine }) {
  return <Stick settings={engine.settings} onMove={(x, y) => engine.touch.setMove(x, y)} />;
}

/** What a skill's aim looks like on the ground while dragging. */
function previewFor(engine: SigilEngine, slot: SlotKey, angle: number, frac: number, cancel: boolean): AimPreview | null {
  const w = engine.world;
  if (!w) return null;
  const id = w.build.bar[slot];
  const spec = id ? w.build.skills[id]?.spec : undefined;
  if (!spec) return null;
  if (spec.aim === 'ground') return { shape: 'circle', angle, dist: Math.max(16, frac * spec.range), size: spec.area || 20, cancel };
  if (spec.aim === 'self') return { shape: 'ring', angle, dist: 0, size: spec.area, cancel };
  if (spec.cast === 'melee') return { shape: 'cone', angle, dist: spec.arc, size: spec.area + 8, cancel };
  return { shape: 'line', angle, dist: spec.range, size: Math.max(3, spec.radius * 2 + 2), cancel };
}

function SkillButton({ engine, slot }: { engine: SigilEngine; slot: SlotKey }) {
  const h = engine.hero!;
  const w = engine.world!;
  const id = w.build.bar[slot];
  const cls = CLASSES[h.cls];
  const def = id ? SKILLS[id] : slot === 'ult' ? SKILLS[cls.ult] : undefined;
  const btn = useRef<HTMLButtonElement>(null);
  const cdRef = useRef<HTMLSpanElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const chRef = useRef<HTMLSpanElement>(null);
  const press = useRef<{ id: number; cx: number; cy: number; aimed: boolean; angle: number; frac: number; cancel: boolean } | null>(null);
  const locked = !id;

  useFrame(engine, (world: World) => {
    const b = btn.current;
    if (!b || locked) return;
    const p = world.player;
    if (slot === 'ult') {
      const pct = p.ult;
      b.style.setProperty('--fill', `${pct}%`);
      b.classList.toggle('is-ready', pct >= 100);
      if (numRef.current) numRef.current.textContent = pct >= 100 ? '' : `${Math.floor(pct)}%`;
      return;
    }
    const spec = id ? world.build.skills[id]?.spec : undefined;
    b.classList.toggle('is-nomana', !!spec && skillCost(world, spec, slot) > p.mana + 1e-6);
    const cd = p.cds[slot];
    const empty = cd.charges <= 0;
    const share = empty ? Math.max(0, cd.t / Math.max(0.01, cd.cd)) : 0;
    if (cdRef.current) cdRef.current.style.background = empty ? `conic-gradient(rgba(10,6,20,0.72) ${share * 100}%, transparent 0)` : 'transparent';
    if (numRef.current) numRef.current.textContent = empty && cd.t > 0.95 ? String(Math.ceil(cd.t / (1 + world.build.stats.haste / 100))) : '';
    if (chRef.current) chRef.current.textContent = cd.max > 1 ? String(cd.charges) : '';
    b.classList.toggle('is-cooling', empty);
  });

  const center = (): { x: number; y: number } => {
    const r = btn.current!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const cast = (angle: number | null, dist: number | null): void => {
    engine.touch.push({ slot, angle, dist, assist: engine.settings.aimAssist });
  };

  const down = (e: RPointerEvent<HTMLButtonElement>): void => {
    if (locked || press.current || e.pointerType === 'mouse') return;
    e.preventDefault();
    btn.current!.setPointerCapture(e.pointerId);
    const c = center();
    press.current = { id: e.pointerId, cx: c.x, cy: c.y, aimed: false, angle: 0, frac: 0.7, cancel: false };
    btn.current!.classList.add('is-pressed');
    const spec = id ? w.build.skills[id]?.spec : undefined;
    if (slot === 'dodge') {
      // dodging can't wait for a release
      cast(null, null);
      return;
    }
    if (slot === 'basic') {
      cast(null, null);
      engine.touch.setHold({ slot, angle: null, dist: null, assist: engine.settings.aimAssist });
      return;
    }
    if (spec?.aim === 'self') {
      cast(null, null);
      return;
    }
    // ultimates and skills: the aim preview appears once the finger moves
    engine.touch.setAim(null);
  };

  const move = (e: RPointerEvent<HTMLButtonElement>): void => {
    const pr = press.current;
    if (!pr || e.pointerId !== pr.id || slot === 'dodge') return;
    // the drag in the game's own axes (turned to landscape, a finger's "up" on the glass is the game's left)
    const { x: dx, y: dy } = toLocalDelta(e.clientX - pr.cx, e.clientY - pr.cy);
    const d = Math.hypot(dx, dy);
    if (!pr.aimed && d < AIM_DEADZONE) return;
    const spec = id ? w.build.skills[id]?.spec : undefined;
    if (spec?.aim === 'self') return;
    if (d >= AIM_DEADZONE) {
      pr.aimed = true;
      pr.angle = Math.atan2(dy, dx);
      pr.frac = Math.min(1, d / AIM_RANGE);
      pr.cancel = false;
    } else pr.cancel = true;
    if (slot === 'basic') {
      // the attack aims by itself or by the drag, without an aim line in the way
      engine.touch.setHold(pr.cancel ? null : { slot, angle: pr.angle, dist: null, assist: engine.settings.aimAssist });
      return;
    }
    engine.touch.setAim(previewFor(engine, slot, pr.angle, pr.frac, pr.cancel));
  };

  const up = (e: RPointerEvent<HTMLButtonElement>): void => {
    const pr = press.current;
    if (!pr || e.pointerId !== pr.id) return;
    press.current = null;
    btn.current?.classList.remove('is-pressed');
    engine.touch.setAim(null);
    if (slot === 'basic') {
      engine.touch.setHold(null);
      return;
    }
    if (slot === 'dodge') return;
    const spec = id ? w.build.skills[id]?.spec : undefined;
    if (spec?.aim === 'self') return;
    if (e.type === 'pointercancel' || e.type === 'lostpointercapture') return;
    if (pr.aimed && pr.cancel) return;
    if (pr.aimed) cast(pr.angle, pr.frac);
    else cast(null, null);
  };

  // a slot with nothing in it yet (it opens at a later level) is an empty ring on the arc, nothing to press: the shape
  // of the thumbs' side is there from the start, as a phone RPG shows its empty places
  if (locked) return <span className={`rb-sb rb-sb-${slot} is-empty`} aria-hidden="true" />;
  const label = slot === 'basic' ? 'Attack' : slot === 'dodge' ? 'Dodge' : slot === 'ult' ? 'Ultimate' : `Skill ${slot.slice(1)}`;
  // a slot not open yet shows the level it opens at; an open one the level of the next skill to learn
  const opens = slotLevel(slot);
  const unlockAt = !id && slot === 'ult' ? SKILLS[cls.ult]!.unlock : !id && h.level < opens ? opens : !id ? Math.min(...cls.skills.map((s) => SKILLS[s]!.unlock).filter((u) => u > h.level).concat([99])) : 0;
  return (
    <button
      ref={btn}
      className={`rb-sb rb-sb-${slot}${locked ? ' is-locked' : ''}${engine.ui.teach?.slot === slot ? ' is-teach' : ''}`}
      aria-label={def ? `${label}: ${def.name}` : `${label} (locked)`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* (its picture on a disc fills the round button; a painted glyph sits inside it) */}
      {def && !locked && <img className={skillHasPicture(def.id) ? 'is-disc' : undefined} src={skillIconUrl(def.id, 4, true)} alt="" draggable={false} />}
      {locked && <span className="rb-sb-lock">{unlockAt < 99 ? `Lv ${unlockAt}` : '—'}</span>}
      <span className="rb-sb-cd" ref={cdRef} />
      <span className="rb-sb-num" ref={numRef} />
      <span className="rb-sb-charges" ref={chRef} />
    </button>
  );
}

/** A potion within thumb's reach (on touch it lives in the cluster, not the top bar). */
function PotionButton({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  return (
    <button
      className="rb-sb rb-sb-potion"
      aria-label={`Drink a potion (${h.potions} left)`}
      disabled={h.potions <= 0}
      onPointerDown={(e) => {
        e.preventDefault();
        engine.drinkPotion();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img src={uiIcon('potion', 3)} alt="" draggable={false} />
      <span className="rb-sb-charges">{h.potions}</span>
    </button>
  );
}

/** The mount: call it (the ring fills while it comes) or get down. Shown once riding is open and the hero owns one. */
function MountButton({ engine }: { engine: SigilEngine }) {
  const ref = useRef<HTMLButtonElement>(null);
  useFrame(engine, (w) => {
    const b = ref.current;
    if (!b) return;
    const p = w.player;
    b.classList.toggle('is-on', !!p.riding);
    b.style.setProperty('--fill', `${p.riding ? 100 : Math.round((p.summon / SUMMON_TIME) * 100)}%`);
  });
  if (!engine.hero || !hasMount(engine.hero)) return null;
  return (
    <button
      ref={ref}
      className="rb-sb rb-sb-mount"
      aria-label="Ride or get down"
      onPointerDown={(e) => {
        e.preventDefault();
        engine.toggleMount();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img src={uiIcon('horseshoe', 3)} alt="" draggable={false} />
    </button>
  );
}

/**
 * Talk / travel: a big button over the hero when something is in reach, where the eye already is (the
 * open middle of the screen, the hero framed left of it), not in the crowded corner of the menus.
 */
function InteractButton({ engine }: { engine: SigilEngine }) {
  const ref = useRef<HTMLButtonElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useFrame(engine, (w) => {
    const b = ref.current;
    if (!b) return;
    const it = w.interactable;
    b.hidden = !it;
    if (!it) return;
    if (text.current && text.current.textContent !== it.label) text.current.textContent = it.label;
    // pinned over the hero's head, where the eye already is (a person or a door is usually beside them),
    // kept inside the view
    const p = w.player;
    const at = engine.renderer.toScreen(p.x, p.y - 30);
    const host = b.offsetParent as HTMLElement | null;
    const bw = b.offsetWidth;
    const bh = b.offsetHeight;
    const maxX = (host?.clientWidth ?? 800) - bw - 8;
    const maxY = (host?.clientHeight ?? 400) - bh - 8;
    const x = Math.max(8, Math.min(maxX, at.x - bw / 2));
    const y = Math.max(8, Math.min(maxY, at.y - bh));
    // left and top, not a transform: the button bobs with one
    b.style.left = `${Math.round(x)}px`;
    b.style.top = `${Math.round(y)}px`;
  });
  return (
    <button
      ref={ref}
      className="rb-interact"
      hidden
      onClick={() => {
        const it = engine.world?.interactable;
        if (it) engine.interact(it);
      }}
    >
      <img src={uiIcon('hand', 3)} alt="" />
      <span ref={text} />
    </button>
  );
}
