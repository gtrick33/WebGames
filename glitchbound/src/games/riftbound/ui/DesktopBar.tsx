import { useRef } from 'react';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import type { SlotKey } from '../data/types';
import type { RiftEngine } from '../engine';
import { skillIconUrl } from '../render/sprites';
import { useFrame } from './GameScreen';

/** The desktop action bar: keys on every slot, cooldowns, the ultimate's charge, and the interact prompt. */
export function DesktopBar({ engine }: { engine: RiftEngine }) {
  const ult = engine.settings.ultKey;
  const slots: { slot: SlotKey; key: string }[] = [
    { slot: 'basic', key: 'LMB' },
    { slot: 's1', key: 'Q' },
    { slot: 's2', key: 'E' },
    { slot: 's3', key: 'R' },
    { slot: 'ult', key: ult === 'rmb' ? 'RMB' : ult === 'shift' ? 'Shift' : ult.toUpperCase() },
    { slot: 'dodge', key: 'Space' },
  ];
  const prompt = useRef<HTMLDivElement>(null);
  useFrame(engine, (w) => {
    const el = prompt.current;
    if (!el) return;
    const it = w.interactable;
    el.hidden = !it;
    if (it) el.textContent = `${ult === 'f' ? 'G' : 'F'} · ${it.kind === 'npc' ? 'Talk' : it.label}`;
  });
  return (
    <>
      <div className="rb-prompt" ref={prompt} hidden />
      <div className="rb-bar6" role="toolbar" aria-label="Skills">
        {slots.map((s) => (
          <Slot key={s.slot} engine={engine} slot={s.slot} keyLabel={s.key} />
        ))}
      </div>
    </>
  );
}

function Slot({ engine, slot, keyLabel }: { engine: RiftEngine; slot: SlotKey; keyLabel: string }) {
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
      b.style.setProperty('--fill', `${p.ult}%`);
      b.classList.toggle('is-ready', p.ult >= 100);
      if (num.current) num.current.textContent = p.ult >= 100 ? '' : `${Math.floor(p.ult)}%`;
      return;
    }
    const c = p.cds[slot];
    const empty = c.charges <= 0;
    const share = empty ? Math.max(0, c.t / Math.max(0.01, c.cd)) : 0;
    if (cd.current) cd.current.style.background = empty ? `conic-gradient(rgba(10,6,20,0.72) ${share * 100}%, transparent 0)` : 'transparent';
    if (num.current) num.current.textContent = empty && c.t > 0.95 ? String(Math.ceil(c.t / (1 + world.build.stats.haste / 100))) : c.max > 1 ? String(c.charges) : '';
  });
  const unlock = slot === 'ult' ? SKILLS[CLASSES[h.cls].ult]!.unlock : 0;
  return (
    <button ref={el} className={`rb-slot6 is-${slot}${id ? '' : ' is-locked'}`} title={def ? `${def.name}: ${def.blurb}` : 'Locked'} onClick={() => id && engine.kbm?.queue(slot)} tabIndex={-1}>
      {def ? <img src={skillIconUrl(def.id, 3)} alt="" /> : <span className="rb-sb-lock">{unlock ? `Lv ${unlock}` : '—'}</span>}
      <span className="rb-sb-cd" ref={cd} />
      <span className="rb-sb-num" ref={num} />
      <kbd>{keyLabel}</kbd>
    </button>
  );
}
