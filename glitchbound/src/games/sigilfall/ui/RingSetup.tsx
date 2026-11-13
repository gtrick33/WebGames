import { useState, type ReactNode } from 'react';
import { ABILITIES, barCombos, combosOf, DASH, kitOf, OATHS, PRESETS, SLOTS, superOf, type Ability } from '../arena/abilities';
import { usesOf } from '../arena/advice';
import type { ClassSets, RingSetup } from '../arena/ladder';
import { RANGED } from '../arena/sim';
import { cleanTalents, ROW_NAMES, TALENTS, type Talent } from '../arena/talents';
import type { ClassId } from '../data/types';
import { iconPicture } from '../render/art/gameIcons';

const ROLE_WORD: Record<string, string> = { damage: 'Damage', heal: 'Healing', cc: 'Crowd control', interrupt: 'Interrupt', defense: 'Defense', mobility: 'Movement', dispel: 'Dispel', burst: 'Burst', summon: 'Summon' };

export function timing(ab: Ability): string {
  const bits: string[] = [];
  if (ab.channel) bits.push(`Channel ${ab.channel}s`);
  else bits.push(ab.cast ? `${ab.cast}s cast` : 'Instant');
  if (ab.cd) bits.push(`${ab.cd}s cooldown`);
  if (ab.aim === 'ground') bits.push('Placed');
  else if (ab.range > 40 && ab.aim !== 'near' && ab.aim !== 'self') bits.push('Ranged');
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
        <button key={ab.id} type="button" className={`rb-rs-slot is-token${ab.super ? ' is-super' : ''}`} disabled={!onPick} title={`${ab.super ? 'Super' : ab.name}: ${ab.text}`} onClick={() => onPick?.(ab)} onMouseEnter={() => onHover?.(ab)}>
          <img src={iconPicture(ab.icon)} alt={ab.name} draggable={false} />
        </button>
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
 * An ability read before it is taken (the owner: "whenever i click on spell, please add a pop up with info about it,
 * best uses, best combos and 2 buttons - equip or cancel"): what it does, when to press it, what it combines with
 * from this class's kit (and whether that is on the bar), and then the choice. On a full bar, Equip asks which of the
 * four it replaces. The Swift Step and the super are always carried: theirs only closes.
 */
function AbilityCard({ ab, cls, bar, onEquip, onSwap, onRemove, onClose }: { ab: Ability; cls: ClassId; bar: string[]; onEquip: () => void; onSwap: (out: string) => void; onRemove: () => void; onClose: () => void }) {
  const [swapping, setSwapping] = useState(false);
  const on = bar.includes(ab.id);
  const carried = !!ab.super || ab.id === DASH.id;
  const full = !on && bar.length >= SLOTS;
  const combos = combosOf(cls, ab);
  const held = (x: Ability): boolean => !!x.super || bar.includes(x.id);
  const partner = (x: Ability): ReactNode => (
    <span key={x.id} className={`rb-rs-partner${held(x) ? ' is-held' : ''}`}>
      <img src={iconPicture(x.icon)} alt="" draggable={false} />
      {x.name}
      <small>{x.super ? 'your super' : held(x) ? 'on your bar' : 'not on your bar'}</small>
    </span>
  );
  return (
    <div className="rb-ring-dialog-wrap is-card" role="dialog" aria-modal="true" aria-label={ab.name} onClick={onClose}>
      <div className="rb-ring-dialog rb-rs-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <img src={iconPicture(ab.icon)} alt="" draggable={false} />
          <span>
            <strong>{ab.name}</strong>
            <em>{ab.super ? 'Super' : ab.id === DASH.id ? 'Movement' : ROLE_WORD[ab.role]}</em>
            <small>{ab.super ? 'Ready when your meter is full' : timing(ab)}</small>
          </span>
        </header>
        <p className="rb-rs-card-text">{ab.text}</p>
        {/* (choosing what it replaces takes the place of the reading: a phone on its side has no room for both) */}
        <div className="rb-rs-card-cols" hidden={swapping}>
          <section>
            <h4>Best used</h4>
            <ul>
              {usesOf(ab, RANGED.has(cls)).map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4>Combos</h4>
            {combos.lands && (
              <p>
                <b>{combos.lands.name}.</b> {combos.lands.text}
                {combos.lands.after.length > 0 && <span className="rb-rs-partners">Set it up with {combos.lands.after.map(partner)}</span>}
              </p>
            )}
            {combos.setsUp.map((c) => (
              <p key={c.then.id}>
                It sets up <b>{c.name}</b>.<span className="rb-rs-partners">Follow it with {partner(c.then)}</span>
              </p>
            ))}
            {!combos.lands && combos.setsUp.length === 0 && <p className="rb-dim">It is not part of a combo. It does its own job.</p>}
          </section>
        </div>
        {swapping && (
          <div className="rb-rs-card-swap">
            <small>Your bar is full. Which one does it replace?</small>
            <div>
              {bar.map((id) => {
                const x = ABILITIES[id];
                return x ? (
                  <button key={id} type="button" className="rb-btn is-small" onClick={() => onSwap(id)}>
                    <img src={iconPicture(x.icon)} alt="" draggable={false} />
                    {x.name}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        )}
        <footer>
          {carried ? (
            <button type="button" className="rb-btn is-gold" onClick={onClose} autoFocus>
              Close
            </button>
          ) : (
            <>
              <button type="button" className="rb-btn" onClick={onClose}>
                Cancel
              </button>
              {on ? (
                <button type="button" className="rb-btn is-gold" onClick={onRemove}>
                  Take it off
                </button>
              ) : full ? (
                !swapping && (
                  <button type="button" className="rb-btn is-gold" onClick={() => setSwapping(true)} autoFocus>
                    Equip
                  </button>
                )
              ) : (
                <button type="button" className="rb-btn is-gold" onClick={onEquip} autoFocus>
                  Equip
                </button>
              )}
            </>
          )}
        </footer>
      </div>
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
  /** The ability being read before it is taken or left (AbilityCard). */
  const [card, setCard] = useState<Ability | null>(null);
  const put = (next: RingSetup): void => {
    const list = [...sets.list];
    list[sets.active] = next;
    onSets({ ...sets, list });
  };
  /** A click on an ability opens it to be read: nothing is taken or dropped until its card says so. */
  const open = (ab: Ability): void => {
    setInfo(ab);
    setCard(ab);
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
            <button
              key={p.id}
              className="rb-rs-build"
              title={`Fill this setup with the ${p.name} build. Its combos: ${barCombos(cls, p.bar).map((c) => `${c.from.name}, then ${c.to.name} (${c.name})`).join('; ') || 'none'}`}
              onClick={() => put({ ...cur, bar: [...p.bar], talents: [...p.talents] })}
            >
              {p.name}
              <small>{barCombos(cls, p.bar).map((c) => c.name).join(' · ')}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="rb-rs-barrow">
        <BarRow bar={cur.bar} cls={cls} onPick={open} onHover={setInfo} />
      </div>
      {/* what to press after what: the combos this bar can make, each as its two abilities in order */}
      <ul className="rb-rs-combos" aria-label="Combos in this setup">
        {barCombos(cls, cur.bar).map((c) => (
          <li key={`${c.from.id}-${c.to.id}`} title={c.text}>
            <img src={iconPicture(c.from.icon)} alt="" draggable={false} />
            <span>{c.from.name}</span>
            <i>then</i>
            <img src={iconPicture(c.to.icon)} alt="" draggable={false} />
            <span>{c.to.name}</span>
            <b>{c.name}</b>
          </li>
        ))}
        {barCombos(cls, cur.bar).length === 0 && <li className="is-none">No combo on this bar yet. Take an ability together with the one that sets it up.</li>}
      </ul>

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
            <p className="rb-rs-hint">Choose four to bring. Open an ability to read it, then equip it.</p>
            <div className="rb-rs-kit">
              {kitOf(cls).map((ab) => {
                const on = cur.bar.includes(ab.id);
                return (
                  <button key={ab.id} className={`rb-rs-ab${on ? ' is-on' : ''}`} onClick={() => open(ab)} onMouseEnter={() => setInfo(ab)} onFocus={() => setInfo(ab)} aria-pressed={on}>
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
            <p className="rb-rs-hint">One from each row. Each works for the whole class, whatever is on your bar.</p>
            {ROW_NAMES.map((name, row) => (
              <div key={name} className="rb-rs-row" role="radiogroup" aria-label={name}>
                <h4>{name}</h4>
                <div className="rb-rs-options">
                  {TALENTS[cls]
                    .filter((t) => t.row === row)
                    .map((t) => {
                      const on = cur.talents.includes(t.id);
                      return (
                        <button key={t.id} role="radio" aria-checked={on} className={`rb-rs-option${on ? ' is-on' : ''}`} onClick={() => pickTalent(t)}>
                          <img src={talentIcon(t)} alt="" draggable={false} />
                          <span>
                            <strong>{t.name}</strong>
                            <small>{t.text}</small>
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
      {card && (
        <AbilityCard
          key={card.id}
          ab={card}
          cls={cls}
          bar={cur.bar}
          onClose={() => setCard(null)}
          onEquip={() => {
            put({ ...cur, bar: [...cur.bar, card.id] });
            setCard(null);
          }}
          onSwap={(out) => {
            put({ ...cur, bar: cur.bar.map((x) => (x === out ? card.id : x)) });
            setCard(null);
          }}
          onRemove={() => {
            put({ ...cur, bar: cur.bar.filter((x) => x !== card.id) });
            setCard(null);
          }}
        />
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
              <dt>Placed abilities</dt>
              <dd>A comet, a volley, a pyre. With a mouse: press its key, then click where it should land (Esc puts the circle away; the key again drops it on your target). On a touch screen: tap to drop it on your target, or hold the button and push the circle where you want it</dd>
              <dt>Swift Step</dt>
              <dd>Space: a quick step the way you’re going, out from under what is about to land on you</dd>
              <dt>Super</dt>
              <dd>Q, once your meter is full: your class’s big one</dd>
              <dt>Choose an enemy</dt>
              <dd>Their nameplate on the right, the fighter themself, or Tab</dd>
              <dt>Choose who to help</dt>
              <dd>Their nameplate on the left, the fighter themself, or F</dd>
              <dt>Nameplates</dt>
              <dd>The ▤ button at the top right of a match puts them away and brings them back. Health and effects stay over every fighter’s head</dd>
            </dl>
          </section>
          <section>
            <h3>The rules</h3>
            <ul>
              <li>
                <b>Keep moving.</b> You can cast on the move: casting only slows you down.
              </li>
              <li>
                <b>Spells land. Circles can be left.</b> What is aimed at someone always hits them: quick ones at once, cast ones after a short flight. What is placed on the ground shows as a circle first, red when it is the other side’s: take a Swift Step out of it before it lands.
              </li>
              <li>
                <b>Healing spheres.</b> Green spheres rise around the ground. Walk into one when you are hurt and it gives back part of your health, then rises again a little later.
              </li>
              <li>
                <b>Bigger fights heal more.</b> Healing is 20% stronger in 2v2 and 35% stronger in 3v3.
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
                <b>Finding a match.</b> The Ring looks for other players for ten seconds. If someone is looking for the same kind of fight, you meet them; if nobody is, you fight the computer’s teams. Both are for rating. Walk out once the gates have lifted and it is a leaver’s loss, half again a loss; against other players the match then ends for everyone else, and their rating stays as it was.
              </li>
              <li>
                <b>Climb for rewards.</b> Every rank gives its title and a suit of Ringforged armor, for good. See them under Rewards in the lobby, and wear them from Title & armor.
              </li>
              <li>
                <b>Pillars block sight.</b> Step behind one before a cast ends and it is lost, and a healer can’t reach who they can’t see. Interrupt a cast to lock that school of magic for a few seconds. Holds are short and wear off faster each time.
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
