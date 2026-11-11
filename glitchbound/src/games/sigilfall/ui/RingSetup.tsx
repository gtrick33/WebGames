import { useState } from 'react';
import { ABILITIES, DASH, kitOf, OATHS, PRESETS, SLOTS, superOf, type Ability } from '../arena/abilities';
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

/** The bar as it stands: four places, then what every hero has besides (the Swift Step, and their class's super). */
export function BarRow({ bar, cls, onPick, onHover }: { bar: string[]; cls: ClassId; onPick?: (ab: Ability) => void; onHover?: (ab: Ability) => void }) {
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
      {[DASH, superOf(cls)].map((ab) => (
        <span key={ab.id} className={`rb-rs-slot is-token${ab.super ? ' is-super' : ''}`} title={`${ab.super ? 'Super' : ab.name}: ${ab.text}`} onMouseEnter={() => onHover?.(ab)}>
          <img src={iconPicture(ab.icon)} alt={ab.name} draggable={false} />
        </span>
      ))}
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
 * Changing what a class brings: three saved setups, each a bar of four abilities, three talents and an oath. One thing
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
  const shown = info ?? ABILITIES[cur.bar[0] ?? ''] ?? superOf(cls);
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
        <BarRow bar={cur.bar} cls={cls} onPick={toggle} onHover={setInfo} />
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
            <p className={`rb-rs-hint${fullNote ? ' is-warn' : ''}`}>{fullNote ? 'Your bar is full. Click one that’s on it to take it off first.' : 'Choose four to bring. Click to add or remove.'}</p>
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
            {shown.combo && (
              <p className="rb-rs-combo">
                <b>Combo · {shown.combo.name}:</b> {shown.combo.text}
              </p>
            )}
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
              <dd>1 to 4, or click them. They aim themselves at your target</dd>
              <dt>Swift Step</dt>
              <dd>Space: a quick step the way you’re going, out of the way of a shot</dd>
              <dt>Super</dt>
              <dd>Q, once your meter is full: your class’s big one</dd>
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
                <b>Keep moving.</b> You can cast on the move: casting only slows you down.
              </li>
              <li>
                <b>Shots fly, and can be dodged.</b> Most ranged spells fly at where your target is heading. Change direction or take a Swift Step to make them miss.
              </li>
              <li>
                <b>Land combos, and weave them.</b> Many abilities hit much harder against a target you have set up (their cards say how). Each different combo in a row builds Momentum, up to ×4: your combos hit harder still and your super fills faster. Seven seconds without one and it’s gone.
              </li>
              <li>
                <b>Fill your super.</b> Dealing damage and healing fill the meter (taking hits fills it a little). When it’s full, let it go.
              </li>
              <li>
                <b>Take the sigil.</b> A sigil rises in the middle now and then: it heals, fills your super by a third and speeds you up.
              </li>
              <li>
                <b>The Gloam closes in.</b> Forty seconds in, it starts closing in from the edges and burns whoever is out in it, until there’s nowhere left to stand.
              </li>
              <li>
                <b>Climb for rewards.</b> Every rank gives its title and a suit of Ringforged armor, for good. See them under Rewards in the lobby, and wear them from Title & armor.
              </li>
              <li>
                <b>Pillars block sight.</b> Step behind one to dodge a cast, or to stop a healer reaching someone. Interrupt a cast to lock that school of magic for a few seconds. Holds are short and wear off faster each time.
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
