import { useRef } from 'react';
import { markCombo } from './comboMark';
import { slotLevel } from '../progress/character';
import { skillCost } from '../sim/cast';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import type { SlotKey } from '../data/types';
import type { SigilEngine } from '../engine';
import { hasMount } from '../progress/wardrobe';
import { skillIconUrl } from '../render/sprites';
import { slotHaste, SUMMON_TIME } from '../sim/world';
import { useFrame } from './GameScreen';
import { uiIcon } from './uiIcons';
import { hide, part, say } from './hudWrite';
import { actionLabel } from '../input/binds';

/** The desktop action bar: keys on every slot, cooldowns, the ultimate's charge, and the interact prompt. */
export function DesktopBar({ engine }: { engine: SigilEngine }) {
  // (the keys the player has chosen: Settings › Keys)
  const binds = engine.binds();
  const slots: { slot: SlotKey; key: string }[] = [
    { slot: 'basic', key: 'LMB' },
    { slot: 's1', key: actionLabel(binds, 's1') },
    { slot: 's2', key: actionLabel(binds, 's2') },
    { slot: 's3', key: actionLabel(binds, 's3') },
    { slot: 's4', key: actionLabel(binds, 's4') },
    { slot: 'ult', key: actionLabel(binds, 'ult') || (engine.settings.ultKey === 'rmb' ? 'RMB' : '') },
    { slot: 'dodge', key: actionLabel(binds, 'dodge') },
  ];
  const prompt = useRef<HTMLDivElement>(null);
  useFrame(engine, (w) => {
    const el = prompt.current;
    if (!el) return;
    const it = w.interactable;
    hide(el, !it);
    if (it) say(el, `${actionLabel(binds, 'interact')} · ${it.kind === 'npc' ? 'Talk' : it.label}`);
  });
  // indoors is peaceful (sim/world.ts): the bar is put away, and nothing covers a room's door
  const indoors = !!engine.world?.region.interior;
  return (
    <>
      <div className="rb-prompt" ref={prompt} hidden />
      {!indoors && (
        <div className="rb-bar6" role="toolbar" aria-label="Skills">
          {engine.ui.teach && !engine.ui.tip && (
            // over the key it teaches (each slot 52 px and a 6 px gap, after the bar's 9 px of edge)
            <div className="rb-teach" role="status" style={{ left: `${9 + Math.max(0, slots.findIndex((s) => s.slot === engine.ui.teach!.slot)) * 58 + 26}px` }}>
              {engine.ui.teach.text}
            </div>
          )}
          {slots.map((s) => (
            <Slot key={s.slot} engine={engine} slot={s.slot} keyLabel={s.key} />
          ))}
          {!!engine.hero && hasMount(engine.hero) && <MountSlot engine={engine} />}
        </div>
      )}
    </>
  );
}

/** Ride or get down (Y), once riding is open and the hero owns a mount; it fills while the mount is called. */
function MountSlot({ engine }: { engine: SigilEngine }) {
  const el = useRef<HTMLButtonElement>(null);
  useFrame(engine, (w) => {
    const b = el.current;
    if (!b) return;
    b.classList.toggle('is-ready', !!w.player.riding);
    b.style.setProperty('--fill', `${w.player.riding ? 100 : Math.round((w.player.summon / SUMMON_TIME) * 100)}%`);
  });
  return (
    <button ref={el} className="rb-slot6 is-mount" title="Ride your mount (or get down)" onClick={() => engine.toggleMount()} tabIndex={-1}>
      <img src={uiIcon('horseshoe', 3)} alt="" />
      <kbd>Y</kbd>
    </button>
  );
}

function Slot({ engine, slot, keyLabel }: { engine: SigilEngine; slot: SlotKey; keyLabel: string }) {
  const w = engine.world!;
  const h = engine.hero!;
  const id = w.build.bar[slot];
  const def = id ? SKILLS[id] : undefined;
  const cd = useRef<HTMLSpanElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const el = useRef<HTMLButtonElement>(null);
  useFrame(engine, (world) => {
    const b = el.current;
    if (!b || !id) return;
    const p = world.player;
    if (slot === 'ult') {
      b.style.setProperty('--fill', part(p.ult / 100));
      b.classList.toggle('is-ready', p.ult >= 100);
      if (num.current) say(num.current, p.ult >= 100 ? '' : `${Math.floor(p.ult)}%`);
      return;
    }
    const spec = world.build.skills[id]?.spec;
    b.classList.toggle('is-nomana', !!spec && skillCost(world, spec, slot) > p.mana + 1e-6);
    markCombo(b, world, id);
    const c = p.cds[slot];
    const empty = c.charges <= 0;
    const share = empty ? Math.max(0, c.t / Math.max(0.01, c.cd)) : 0;
    if (cd.current) cd.current.style.background = empty ? `conic-gradient(rgba(10,6,20,0.72) ${part(share)}, transparent 0)` : 'transparent';
    if (num.current) say(num.current, empty && c.t > 0.95 ? String(Math.ceil(c.t / slotHaste(slot, world.build.stats.haste))) : c.max > 1 ? String(c.charges) : '');
  });
  const opens = slotLevel(slot);
  const unlock = slot === 'ult' ? SKILLS[CLASSES[h.cls].ult]!.unlock : h.level < opens ? opens : 0;
  return (
    <button ref={el} className={`rb-slot6 is-${slot}${id ? '' : ' is-locked'}${engine.ui.teach?.slot === slot ? ' is-teach' : ''}`} title={def ? `${def.name}: ${def.blurb}` : 'Locked'} onClick={() => id && engine.kbm?.queue(slot)} tabIndex={-1}>
      {def ? <img src={skillIconUrl(def.id, 3)} alt="" /> : <span className="rb-sb-lock">{unlock ? `Lv ${unlock}` : '—'}</span>}
      <span className="rb-sb-cd" ref={cd} />
      <span className="rb-sb-num" ref={num} />
      <kbd>{keyLabel}</kbd>
    </button>
  );
}
