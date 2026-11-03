import { useState } from 'react';
import { ABILITIES, kitOf, OATHS, PRESETS, SLOTS, TOKEN, type Ability } from '../arena/abilities';
import type { ClassSets, RingSetup } from '../arena/ladder';
import { ROW_NAMES, TALENTS, type Talent } from '../arena/talents';
import type { ClassId } from '../data/types';
import { iconPicture } from '../render/art/gameIcons';

const ROLE_WORD: Record<string, string> = { damage: 'Damage', heal: 'Healing', cc: 'Crowd control', interrupt: 'Interrupt', defense: 'Defense', mobility: 'Movement', dispel: 'Dispel', burst: 'Burst' };

function timing(ab: Ability): string {
  const bits: string[] = [];
  if (ab.channel) bits.push(`Channel ${ab.channel}s`);
  else bits.push(ab.cast ? `${ab.cast}s cast` : 'Instant');
  if (ab.cd) bits.push(`${ab.cd}s cooldown`);
  if (ab.range > 40 && ab.aim !== 'near' && ab.aim !== 'self') bits.push('Ranged');
  if (ab.range > 0 && ab.range <= 40) bits.push('Melee');
  if (ab.mana) bits.push(`${ab.mana} mana`);
  return bits.join(' · ');
}

const talentIcon = (t: Talent): string => iconPicture(t.icon ?? ABILITIES[Object.keys(t.tune ?? {})[0] ?? '']?.icon ?? '');

type Info = { kind: 'ability'; ab: Ability } | { kind: 'talent'; t: Talent } | { kind: 'oath'; name: string; text: string };

/** Choosing what a class brings: three saved set ups, each a bar of six, three talents and an oath. */
export function SetupEditor({ cls, sets, onSets }: { cls: ClassId; sets: ClassSets; onSets: (s: ClassSets) => void }) {
  const cur = sets.list[sets.active]!;
  const [info, setInfo] = useState<Info | null>(null);
  const put = (next: RingSetup): void => {
    const list = [...sets.list];
    list[sets.active] = next;
    onSets({ ...sets, list });
  };
  const toggle = (ab: Ability): void => {
    setInfo({ kind: 'ability', ab });
    if (cur.bar.includes(ab.id)) put({ ...cur, bar: cur.bar.filter((x) => x !== ab.id) });
    else if (cur.bar.length < SLOTS) put({ ...cur, bar: [...cur.bar, ab.id] });
  };
  const pickTalent = (t: Talent): void => {
    setInfo({ kind: 'talent', t });
    const others = cur.talents.filter((id) => TALENTS[cls].find((x) => x.id === id)?.row !== t.row);
    put({ ...cur, talents: cur.talents.includes(t.id) ? others : [...others, t.id] });
  };
  const shown: Info = info ?? { kind: 'ability', ab: ABILITIES[cur.bar[0] ?? ''] ?? TOKEN };
  return (
    <div className="rb-rs">
      <div className="rb-rs-head">
        <div className="rb-rs-sets" role="tablist" aria-label="Set ups">
          {sets.list.map((_, i) => (
            <button key={i} role="tab" aria-selected={i === sets.active} className={`rb-rs-set${i === sets.active ? ' is-on' : ''}`} onClick={() => onSets({ ...sets, active: i })}>
              Set {i + 1}
            </button>
          ))}
        </div>
        <div className="rb-rs-presets">
          {PRESETS[cls].map((p) => (
            <button key={p.id} className="rb-btn is-small is-ghost" title={`Fill this set with the ${p.name} build`} onClick={() => put({ ...cur, bar: [...p.bar], talents: [...p.talents] })}>
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="rb-rl-slots">
        {Array.from({ length: SLOTS }, (_, i) => {
          const ab = ABILITIES[cur.bar[i] ?? ''];
          return (
            <button key={i} className={`rb-rl-slot${ab ? '' : ' is-empty'}`} onClick={() => ab && toggle(ab)} onMouseEnter={() => ab && setInfo({ kind: 'ability', ab })} aria-label={ab ? `Take off ${ab.name}` : 'Empty place'}>
              {ab ? <img src={iconPicture(ab.icon)} alt="" draggable={false} /> : <small>{i + 1}</small>}
            </button>
          );
        })}
        <span className="rb-rl-slot is-token" title={`${TOKEN.name}: ${TOKEN.text}`} onMouseEnter={() => setInfo({ kind: 'ability', ab: TOKEN })}>
          <img src={iconPicture(TOKEN.icon)} alt={TOKEN.name} draggable={false} />
        </span>
      </div>
      <div className="rb-rs-scroll">
        <div className="rb-rl-kit">
          {kitOf(cls).map((ab) => {
            const on = cur.bar.includes(ab.id);
            return (
              <button key={ab.id} className={`rb-rl-ab${on ? ' is-on' : ''}${!on && cur.bar.length >= SLOTS ? ' is-full' : ''}`} onClick={() => toggle(ab)} onMouseEnter={() => setInfo({ kind: 'ability', ab })} onFocus={() => setInfo({ kind: 'ability', ab })} aria-pressed={on} aria-label={ab.name}>
                <img src={iconPicture(ab.icon)} alt="" draggable={false} />
                <small>{ab.name}</small>
              </button>
            );
          })}
        </div>
        <div className="rb-rs-talents">
          {ROW_NAMES.map((name, row) => (
            <div key={name} className="rb-rs-row" role="radiogroup" aria-label={`Talent: ${name}`}>
              <h4>{name}</h4>
              <span>
                {TALENTS[cls]
                  .filter((t) => t.row === row)
                  .map((t) => {
                    const needs = Object.keys(t.tune ?? {})[0];
                    const idle = needs && !cur.bar.includes(needs);
                    return (
                      <button key={t.id} role="radio" aria-checked={cur.talents.includes(t.id)} aria-label={t.name} title={`${t.name}: ${t.text}`} className={`rb-rs-talent${cur.talents.includes(t.id) ? ' is-on' : ''}${idle ? ' is-idle' : ''}`} onClick={() => pickTalent(t)} onMouseEnter={() => setInfo({ kind: 'talent', t })} onFocus={() => setInfo({ kind: 'talent', t })}>
                        <img src={talentIcon(t)} alt="" draggable={false} />
                      </button>
                    );
                  })}
              </span>
            </div>
          ))}
          <div className="rb-rs-row" role="radiogroup" aria-label="Oath">
            <h4>Oath</h4>
            <span className="is-oaths">
              {OATHS.map((o) => (
                <button key={o.id} role="radio" aria-checked={o.id === cur.oath} aria-label={o.name} title={`${o.name}: ${o.text}`} className={`rb-rs-talent${o.id === cur.oath ? ' is-on' : ''}`} onClick={() => { setInfo({ kind: 'oath', name: o.name, text: o.text }); put({ ...cur, oath: o.id }); }} onMouseEnter={() => setInfo({ kind: 'oath', name: o.name, text: o.text })}>
                  <img src={iconPicture(o.icon)} alt="" draggable={false} />
                </button>
              ))}
            </span>
          </div>
        </div>
      </div>
      <div className="rb-rl-info">
        {shown.kind === 'ability' ? (
          <>
            <strong>{shown.ab.name}</strong>
            <em>{ROLE_WORD[shown.ab.role]}</em>
            <span>{shown.ab.text}</span>
            <small>{timing(shown.ab)}</small>
          </>
        ) : shown.kind === 'talent' ? (
          <>
            <strong>{shown.t.name}</strong>
            <em>Talent · {ROW_NAMES[shown.t.row]}</em>
            <span>{shown.t.text}</span>
            {Object.keys(shown.t.tune ?? {}).some((id) => !cur.bar.includes(id)) && <small className="is-warn">Does nothing unless {ABILITIES[Object.keys(shown.t.tune ?? {})[0]!]?.name} is on your bar.</small>}
          </>
        ) : (
          <>
            <strong>{shown.name}</strong>
            <em>Oath</em>
            <span>{shown.text}</span>
          </>
        )}
      </div>
    </div>
  );
}
