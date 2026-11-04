import { useState } from 'react';
import { ABILITIES, kitOf, OATHS, PRESETS, SLOTS, TOKEN, type Ability } from '../arena/abilities';
import type { ClassSets, RingSetup } from '../arena/ladder';
import { cleanTalents, ROW_NAMES, TALENTS, type Talent } from '../arena/talents';
import type { ClassId } from '../data/types';
import { iconPicture } from '../render/art/gameIcons';

const ROLE_WORD: Record<string, string> = { damage: 'Damage', heal: 'Healing', cc: 'Crowd control', interrupt: 'Interrupt', defense: 'Defense', mobility: 'Movement', dispel: 'Dispel', burst: 'Burst' };

export function timing(ab: Ability): string {
  const bits: string[] = [];
  if (ab.channel) bits.push(`Channel ${ab.channel}s`);
  else bits.push(ab.cast ? `${ab.cast}s cast` : 'Instant');
  if (ab.cd) bits.push(`${ab.cd}s cooldown`);
  if (ab.range > 40 && ab.aim !== 'near' && ab.aim !== 'self') bits.push('Ranged');
  if (ab.range > 0 && ab.range <= 40) bits.push('Melee');
  if (ab.mana) bits.push(`${ab.mana} mana`);
  return bits.join(' · ');
}

export const talentIcon = (t: Talent): string => iconPicture(t.icon ?? ABILITIES[Object.keys(t.tune ?? {})[0] ?? '']?.icon ?? '');

type Tab = 'abilities' | 'talents' | 'oath';

/** The bar as it stands: six places and the Token. */
export function BarRow({ bar, onPick, onHover }: { bar: string[]; onPick?: (ab: Ability) => void; onHover?: (ab: Ability) => void }) {
  return (
    <div className="rb-rs-slots">
      {Array.from({ length: SLOTS }, (_, i) => {
        const ab = ABILITIES[bar[i] ?? ''];
        return (
          <button key={i} type="button" className={`rb-rs-slot${ab ? '' : ' is-empty'}`} disabled={!ab || !onPick} onClick={() => ab && onPick?.(ab)} onMouseEnter={() => ab && onHover?.(ab)} title={ab ? `${ab.name}: ${ab.text}` : 'An empty place'} aria-label={ab ? ab.name : 'Empty place'}>
            {ab ? <img src={iconPicture(ab.icon)} alt="" draggable={false} /> : <small>{i + 1}</small>}
          </button>
        );
      })}
      <span className="rb-rs-slot is-token" title={`${TOKEN.name}: ${TOKEN.text}`} onMouseEnter={() => onHover?.(TOKEN)}>
        <img src={iconPicture(TOKEN.icon)} alt={TOKEN.name} draggable={false} />
      </span>
    </div>
  );
}

/** A setup at a glance: its talents and oath, for the Play page. */
export function SetupChips({ cls, setup }: { cls: ClassId; setup: RingSetup }) {
  const talents = cleanTalents(cls, setup.talents);
  const oath = OATHS.find((o) => o.id === setup.oath);
  return (
    <div className="rb-rs-chips">
      {talents.map((t) => (
        <span key={t.id} className="rb-rs-chip" title={`${t.name}: ${t.text}`}>
          <img src={talentIcon(t)} alt="" draggable={false} />
          {t.name}
        </span>
      ))}
      {oath && (
        <span className="rb-rs-chip is-oath" title={`${oath.name}: ${oath.text}`}>
          <img src={iconPicture(oath.icon)} alt="" draggable={false} />
          {oath.name}
        </span>
      )}
    </div>
  );
}

/**
 * Changing what a class brings: three saved setups, each a bar of six abilities, three talents and an oath. One thing
 * at a time, on tabs, with what everything does written where it can be read.
 */
export function SetupEditor({ cls, sets, onSets }: { cls: ClassId; sets: ClassSets; onSets: (s: ClassSets) => void }) {
  const cur = sets.list[sets.active]!;
  const [tab, setTab] = useState<Tab>('abilities');
  const [info, setInfo] = useState<Ability | null>(null);
  const [fullNote, setFullNote] = useState(false);
  const put = (next: RingSetup): void => {
    const list = [...sets.list];
    list[sets.active] = next;
    onSets({ ...sets, list });
  };
  const toggle = (ab: Ability): void => {
    setInfo(ab);
    if (cur.bar.includes(ab.id)) {
      setFullNote(false);
      put({ ...cur, bar: cur.bar.filter((x) => x !== ab.id) });
    } else if (cur.bar.length < SLOTS) {
      setFullNote(false);
      put({ ...cur, bar: [...cur.bar, ab.id] });
    } else setFullNote(true);
  };
  const pickTalent = (t: Talent): void => {
    const others = cur.talents.filter((id) => TALENTS[cls].find((x) => x.id === id)?.row !== t.row);
    put({ ...cur, talents: cur.talents.includes(t.id) ? others : [...others, t.id] });
  };
  const shown = info ?? ABILITIES[cur.bar[0] ?? ''] ?? TOKEN;
  const talentCount = cleanTalents(cls, cur.talents).length;
  return (
    <div className="rb-rs">
      <div className="rb-rs-top">
        <div className="rb-rs-sets" role="tablist" aria-label="Saved setups">
          {sets.list.map((_, i) => (
            <button key={i} role="tab" aria-selected={i === sets.active} className={`rb-rs-set${i === sets.active ? ' is-on' : ''}`} onClick={() => onSets({ ...sets, active: i })}>
              Setup {i + 1}
            </button>
          ))}
        </div>
        <div className="rb-rs-builds">
          <small>Start from:</small>
          {PRESETS[cls].map((p) => (
            <button key={p.id} className="rb-rs-build" title={`Fill this setup with the ${p.name} build`} onClick={() => put({ ...cur, bar: [...p.bar], talents: [...p.talents] })}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rb-rs-barrow">
        <BarRow bar={cur.bar} onPick={toggle} onHover={setInfo} />
      </div>

      <div className="rb-rs-tabs" role="tablist" aria-label="What to change">
        <button role="tab" aria-selected={tab === 'abilities'} className={tab === 'abilities' ? 'is-on' : ''} onClick={() => setTab('abilities')}>
          Abilities <b className={cur.bar.length === SLOTS ? 'is-full' : 'is-short'}>{cur.bar.length}/{SLOTS}</b>
        </button>
        <button role="tab" aria-selected={tab === 'talents'} className={tab === 'talents' ? 'is-on' : ''} onClick={() => setTab('talents')}>
          Talents <b className={talentCount === 3 ? 'is-full' : 'is-short'}>{talentCount}/3</b>
        </button>
        <button role="tab" aria-selected={tab === 'oath'} className={tab === 'oath' ? 'is-on' : ''} onClick={() => setTab('oath')}>
          Oath
        </button>
      </div>

      <div className="rb-rs-panel" role="tabpanel">
        {tab === 'abilities' && (
          <>
            <p className={`rb-rs-hint${fullNote ? ' is-warn' : ''}`}>{fullNote ? 'Your bar is full. Click one that’s on it to take it off first.' : 'Choose six to bring. Click to add or remove.'}</p>
            <div className="rb-rs-kit">
              {kitOf(cls).map((ab) => {
                const on = cur.bar.includes(ab.id);
                return (
                  <button key={ab.id} className={`rb-rs-ab${on ? ' is-on' : ''}`} onClick={() => toggle(ab)} onMouseEnter={() => setInfo(ab)} onFocus={() => setInfo(ab)} aria-pressed={on}>
                    <img src={iconPicture(ab.icon)} alt="" draggable={false} />
                    <small>{ab.name}</small>
                    {on && (
                      <i className="rb-rs-check" aria-hidden="true">
                        ✓
                      </i>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {tab === 'talents' && (
          <>
            <p className="rb-rs-hint">One from each row. Most sharpen a single ability, so they need that ability on your bar.</p>
            {ROW_NAMES.map((name, row) => (
              <div key={name} className="rb-rs-row" role="radiogroup" aria-label={name}>
                <h4>{name}</h4>
                <div className="rb-rs-options">
                  {TALENTS[cls]
                    .filter((t) => t.row === row)
                    .map((t) => {
                      const needs = Object.keys(t.tune ?? {})[0];
                      const idle = !!needs && !cur.bar.includes(needs);
                      const on = cur.talents.includes(t.id);
                      return (
                        <button key={t.id} role="radio" aria-checked={on} className={`rb-rs-option${on ? ' is-on' : ''}${idle ? ' is-idle' : ''}`} onClick={() => pickTalent(t)}>
                          <img src={talentIcon(t)} alt="" draggable={false} />
                          <span>
                            <strong>{t.name}</strong>
                            <small>{t.text}</small>
                            {idle && on && <em>{ABILITIES[needs]?.name} isn’t on your bar</em>}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </>
        )}
        {tab === 'oath' && (
          <>
            <p className="rb-rs-hint">One passive bonus for the whole match.</p>
            <div className="rb-rs-options is-oaths" role="radiogroup" aria-label="Oath">
              {OATHS.map((o) => (
                <button key={o.id} role="radio" aria-checked={o.id === cur.oath} className={`rb-rs-option${o.id === cur.oath ? ' is-on' : ''}`} onClick={() => put({ ...cur, oath: o.id })}>
                  <img src={iconPicture(o.icon)} alt="" draggable={false} />
                  <span>
                    <strong>{o.name}</strong>
                    <small>{o.text}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {tab === 'abilities' && (
        <div className="rb-rs-info">
          <img src={iconPicture(shown.icon)} alt="" draggable={false} />
          <span>
            <strong>{shown.name}</strong>
            <em>{ROLE_WORD[shown.role]}</em>
            <small>{timing(shown)}</small>
            <p>{shown.text}</p>
          </span>
        </div>
      )}
    </div>
  );
}

/** How The Ring plays, for whoever asks: on demand, never in the way. */
export function RingHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="rb-ring-dialog-wrap" role="dialog" aria-label="How The Ring works" onClick={onClose}>
      <div className="rb-ring-dialog is-help" onClick={(e) => e.stopPropagation()}>
        <h2>How The Ring works</h2>
        <div className="rb-ring-help">
          <section>
            <h3>Controls</h3>
            <dl>
              <dt>Move</dt>
              <dd>WASD, the arrows, or drag on a touch screen</dd>
              <dt>Abilities</dt>
              <dd>1 to 6, or click them</dd>
              <dt>Token of Will</dt>
              <dd>T: breaks anything holding you</dd>
              <dt>Choose an enemy</dt>
              <dd>Their nameplate on the right, or Tab</dd>
              <dt>Choose who to help</dt>
              <dd>Their nameplate on the left, or F</dd>
            </dl>
          </section>
          <section>
            <h3>The rules</h3>
            <ul>
              <li>
                <b>Stand still to cast.</b> Moving stops a cast. Instant abilities work on the move.
              </li>
              <li>
                <b>Pillars block sight.</b> Step behind one to dodge a cast, or to stop a healer reaching someone.
              </li>
              <li>
                <b>Holds wear off.</b> Each stun, fear or root of the same kind lasts half as long, then does nothing.
              </li>
              <li>
                <b>Interrupt casts.</b> It stops the spell and locks that school of magic for a few seconds.
              </li>
              <li>
                <b>Healing fades.</b> After 1:30 it weakens. At 5:00 the team with more life left wins.
              </li>
            </ul>
          </section>
        </div>
        <button className="rb-btn is-gold" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}
