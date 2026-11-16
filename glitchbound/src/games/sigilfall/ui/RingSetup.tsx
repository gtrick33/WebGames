import { useState, type ReactNode } from 'react';
import { ABILITIES, barCombos, combosOf, kitOf, TRINKET, PRESETS, SLOTS, ultFor, ultOf, ultsOf, type Ability } from '../arena/abilities';
import { usesOf } from '../arena/advice';
import type { ClassSets, RingSetup } from '../arena/ladder';
import { RANGED } from '../arena/sim';
import { EASE_WORD, presetOfBar, styleOf } from '../arena/styles';
import { cleanTalents, ROW_NAMES, TALENTS, type Talent } from '../arena/talents';
import type { SetupTab } from '../arena/tutorial';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { iconPicture } from '../render/art/gameIcons';

const ROLE_WORD: Record<string, string> = { damage: 'Damage', heal: 'Healing', cc: 'Crowd control', interrupt: 'Interrupt', defense: 'Defense', mobility: 'Movement', dispel: 'Dispel', burst: 'Burst', summon: 'Summon', stealth: 'Stealth' };

export function timing(ab: Ability): string {
  const bits: string[] = [];
  if (ab.channel) bits.push(`Channel ${ab.channel}s`);
  else bits.push(ab.cast ? `${ab.cast}s cast` : 'Instant');
  if (ab.cd) bits.push(`${ab.cd}s cooldown`);
  if (ab.aim === 'ground') bits.push('Placed');
  else if (ab.range > 40 && ab.aim !== 'near' && ab.aim !== 'self') bits.push('Ranged');
  if (ab.range > 0 && ab.range <= 40) bits.push('Melee');
  return bits.join(' · ');
}

export const talentIcon = (t: Talent): string => iconPicture(t.icon ?? ABILITIES[Object.keys(t.tune ?? {})[0] ?? '']?.icon ?? '');


/** The bar as it stands: five places, then what every hero has besides (their class's super). */
export function BarRow({ bar, cls, ult, onPick, onHover }: { bar: string[]; cls: ClassId; ult?: string; onPick?: (ab: Ability) => void; onHover?: (ab: Ability) => void }) {
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
      {[ultOf(cls, ult ?? ultFor(cls, bar))].map((ab) => (
        <button key={ab.id} type="button" className={`rb-rs-slot is-token${ab.super ? ' is-super' : ''}`} disabled={!onPick} title={`${ab.super ? 'Super' : ab.name}: ${ab.text}`} onClick={() => onPick?.(ab)} onMouseEnter={() => onHover?.(ab)}>
          <img src={iconPicture(ab.icon)} alt={ab.name} draggable={false} />
        </button>
      ))}
    </div>
  );
}

/** A setup at a glance: its talents, for the Play page. */
export function SetupChips({ cls, setup }: { cls: ClassId; setup: RingSetup }) {
  const talents = cleanTalents(cls, setup.talents);
  return (
    <div className="rb-rs-chips">
      {talents.map((t) => (
        <span key={t.id} className="rb-rs-chip" title={`${t.name}: ${t.text}`}>
          <img src={talentIcon(t)} alt="" draggable={false} />
          {t.name}
        </span>
      ))}
    </div>
  );
}

/**
 * An ability read before it is taken (the owner: "whenever i click on spell, please add a pop up with info about it,
 * best uses, best combos and 2 buttons - equip or cancel"): what it does, when to press it, what it combines with
 * from this class's kit (and whether that is on the bar), and then the choice. On a full bar, Equip asks which of the
 * five it replaces. The super is always carried: theirs only closes. Without the choice's handlers
 * it is only read, and only closes: the Ring's main screen opens it from the bar (the owner, 2026-11-15: "make the
 * abilities clickable ... so i can see what i have and how to use it").
 */
export function AbilityCard({ ab, cls, bar, onEquip, onSwap, onRemove, onClose }: { ab: Ability; cls: ClassId; bar: string[]; onEquip?: () => void; onSwap?: (out: string) => void; onRemove?: () => void; onClose: () => void }) {
  const [swapping, setSwapping] = useState(false);
  const on = bar.includes(ab.id);
  const carried = !!ab.super || !onEquip;
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
    // (only read, from the Ring's main screen: over the game's own screen, as its rules are, not over the whole page)
    <div className="rb-ring-dialog-wrap is-card is-local" role="dialog" aria-modal="true" aria-label={ab.name} onClick={onClose}>
      <div className="rb-ring-dialog rb-rs-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <img src={iconPicture(ab.icon)} alt="" draggable={false} />
          <span>
            <strong>{ab.name}</strong>
            <em>{ab.super ? 'Super' : `${ROLE_WORD[ab.role]}${ab === TRINKET ? ' · any class' : ''}`}</em>
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
                  <button key={id} type="button" className="rb-btn is-small" onClick={() => onSwap?.(id)}>
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
 * The playstyles: each of the class's ready-made builds as a card, with what it plays like in a line and how hard it is
 * (arena/styles.ts). Taking one fills the setup at once: the first thing a newcomer sees on the setup page, with
 * everything else behind Customize (the owner, 2026-11-14: "i wanna make this game mode accessible for every type of
 * player").
 */
function StyleCards({ cls, setup, onPick }: { cls: ClassId; setup: RingSetup; onPick: (i: number) => void }) {
  const on = presetOfBar(cls, setup.bar);
  return (
    <div className="rb-rs-styles" data-tut="styles" role="radiogroup" aria-label="Playstyle">
      {PRESETS[cls].map((p, i) => {
        const st = styleOf(cls, p.id);
        const combos = barCombos(cls, p.bar, p.ult);
        return (
          <button key={p.id} role="radio" aria-checked={on === i} className={`rb-rs-style${on === i ? ' is-on' : ''}`} onClick={() => onPick(i)}>
            <span className="rb-rs-style-head">
              <strong>{p.name}</strong>
              <em className={`rb-ease is-${st.ease}`}>{EASE_WORD[st.ease]}</em>
            </span>
            <span className="rb-rs-style-line">{st.line}</span>
            <span className="rb-rs-style-bar" aria-hidden="true">
              {p.bar.map((id) => (
                <img key={id} src={iconPicture(ABILITIES[id]?.icon ?? '')} alt="" draggable={false} />
              ))}
              <img className="is-super" src={iconPicture(ultOf(cls, p.ult).icon)} alt="" draggable={false} />
            </span>
            {combos.length > 0 && (
              <small className="rb-rs-style-combos">
                Combos: {combos.map((c) => `${c.from.name} then ${c.to.name}`).join(' · ')}
              </small>
            )}
            {on === i && (
              <i className="rb-rs-check" aria-hidden="true">
                ✓
              </i>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** What the tutorial (arena/tutorial.ts) shows of the setup page: the playstyles, or everything, on which tab. */
export interface SetupGuide {
  mode?: 'styles' | 'custom';
  tab?: SetupTab;
}

/**
 * Changing what a class brings: three saved setups, each a bar of five abilities, three talents and a super (an oath
 * and the Unbinding Charm beside them were taken out on 2026-11-15, the owner: "leave only spells, talents and ults"). It opens on the playstyles, unless the setup in hand is one of the
 * player's own making; Customize opens the rest, one thing at a time, on tabs, with what everything does written where
 * it can be read.
 */
export function SetupEditor({ cls, sets, onSets, guide }: { cls: ClassId; sets: ClassSets; onSets: (s: ClassSets) => void; guide?: SetupGuide }) {
  const cur = sets.list[sets.active]!;
  const [mode, setMode] = useState<'styles' | 'custom'>(() => guide?.mode ?? (cur.bar.length < SLOTS || presetOfBar(cls, cur.bar) >= 0 ? 'styles' : 'custom'));
  const [tab, setTab] = useState<SetupTab>(guide?.tab ?? 'abilities');
  // (the tutorial turns the pages itself: a new step's page and tab are taken as it comes)
  const guideKey = `${guide?.mode ?? ''}/${guide?.tab ?? ''}`;
  const [guided, setGuided] = useState(guideKey);
  if (guideKey !== guided) {
    setGuided(guideKey);
    if (guide?.mode) setMode(guide.mode);
    if (guide?.tab) setTab(guide.tab);
  }
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
  const usePreset = (i: number): void => {
    const p = PRESETS[cls][i]!;
    put({ ...cur, bar: [...p.bar], talents: [...p.talents], ult: p.ult });
  };
  const curUlt = ultOf(cls, cur.ult ?? ultFor(cls, cur.bar));
  const shown = info ?? ABILITIES[cur.bar[0] ?? ''] ?? curUlt;
  const talentCount = cleanTalents(cls, cur.talents).length;
  const combos = barCombos(cls, cur.bar, curUlt.id);
  return (
    <div className={`rb-rs${mode === 'styles' ? ' is-styles' : ''}`}>
      <div className="rb-rs-top">
        <div className="rb-rs-sets" role="tablist" aria-label="Saved setups" data-tut="sets">
          {sets.list.map((_, i) => (
            <button key={i} role="tab" aria-selected={i === sets.active} className={`rb-rs-set${i === sets.active ? ' is-on' : ''}`} onClick={() => onSets({ ...sets, active: i })}>
              Setup {i + 1}
            </button>
          ))}
        </div>
        {mode === 'custom' ? (
          <button className="rb-btn is-small rb-rs-mode" onClick={() => setMode('styles')}>
            ← Playstyles
          </button>
        ) : (
          <button className="rb-btn is-small rb-rs-mode" data-tut="customize" onClick={() => setMode('custom')}>
            Customize →
          </button>
        )}
      </div>

      {mode === 'styles' && (
        <>
          <p className="rb-rs-hint">Pick a playstyle to start from. Each is ready to fight with as it is.</p>
          <StyleCards cls={cls} setup={cur} onPick={usePreset} />
          <div className="rb-rs-barrow" data-tut="bar">
            <BarRow bar={cur.bar} cls={cls} ult={curUlt.id} onPick={open} />
          </div>
          <button className="rb-btn rb-rs-custom" onClick={() => setMode('custom')}>
            Customize abilities, talents and super
          </button>
        </>
      )}

      {mode === 'custom' && (
        <>
          <div className="rb-rs-barrow" data-tut="bar">
            <BarRow bar={cur.bar} cls={cls} ult={curUlt.id} onPick={open} onHover={setInfo} />
          </div>
          {/* what to press after what: the combos this bar can make, each as its two abilities in order */}
          <ul className="rb-rs-combos" aria-label="Combos in this setup" data-tut="combos">
            {combos.map((c) => (
              <li key={`${c.from.id}-${c.to.id}`} title={c.text}>
                <img src={iconPicture(c.from.icon)} alt="" draggable={false} />
                <span>{c.from.name}</span>
                <i>then</i>
                <img src={iconPicture(c.to.icon)} alt="" draggable={false} />
                <span>{c.to.name}</span>
                <b>{c.name}</b>
              </li>
            ))}
            {combos.length === 0 && <li className="is-none">No combo on this bar yet. Take an ability together with the one that sets it up.</li>}
          </ul>

          <div className="rb-rs-tabs" role="tablist" aria-label="What to change" data-tut="tabs">
            <button role="tab" aria-selected={tab === 'abilities'} className={tab === 'abilities' ? 'is-on' : ''} onClick={() => setTab('abilities')}>
              Abilities <b className={cur.bar.length === SLOTS ? 'is-full' : 'is-short'}>{cur.bar.length}/{SLOTS}</b>
            </button>
            <button role="tab" aria-selected={tab === 'talents'} className={tab === 'talents' ? 'is-on' : ''} onClick={() => setTab('talents')}>
              Talents <b className={talentCount === 3 ? 'is-full' : 'is-short'}>{talentCount}/3</b>
            </button>
            <button role="tab" aria-selected={tab === 'super'} className={tab === 'super' ? 'is-on' : ''} onClick={() => setTab('super')}>
              Super
            </button>
          </div>

          <div className="rb-rs-panel" role="tabpanel" data-tut="panel">
            {tab === 'abilities' && (
              <>
                <p className="rb-rs-hint">Choose five to bring. Open an ability to read it, then equip it.</p>
                <div className="rb-rs-kit" data-tut="kit">
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
            {tab === 'super' && (
              <>
                <p className="rb-rs-hint">Your super: a big ability, ready when your meter is full. Dealing damage and healing fill it. Each way your class fights has its own.</p>
                <div className="rb-rs-options is-oaths" role="radiogroup" aria-label="Super">
                  {ultsOf(cls).map((x) => {
                    const on = curUlt === x;
                    const of = PRESETS[cls].find((p) => p.ult === x.id);
                    return (
                      <button key={x.id} role="radio" aria-checked={on} className={`rb-rs-option${on ? ' is-on' : ''}`} onClick={() => put({ ...cur, ult: x.id })}>
                        <img src={iconPicture(x.icon)} alt="" draggable={false} />
                        <span>
                          <strong>
                            {x.name}
                            {of && <em> · the {of.name}’s</em>}
                          </strong>
                          <small>{x.text}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {tab === 'abilities' && (
            <div className="rb-rs-info">
              <img src={iconPicture(shown.icon)} alt="" draggable={false} />
              <span>
                <strong>{shown.name}</strong>
                <em>{shown.super ? 'Super' : ROLE_WORD[shown.role]}</em>
                <small>{shown.super ? 'Ready when your meter is full' : timing(shown)}</small>
                <p>{shown.text}</p>
                {shown.combo && (
                  <p className="rb-rs-combo">
                    <b>Combo · {shown.combo.name}:</b> {shown.combo.text}
                  </p>
                )}
              </span>
            </div>
          )}
        </>
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

/** The Ring's one assist that changes how a press plays, beside the rules where it's read (also in Settings). */
function CloseInToggle({ engine }: { engine: SigilEngine }) {
  const [on, setOn] = useState(engine.settings.ringCloseIn);
  return (
    <label className="rb-check rb-ring-assist">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          engine.setSettings({ ringCloseIn: e.target.checked });
          engine.persist();
          setOn(e.target.checked);
        }}
      />
      <span>
        <b>Close in automatically.</b> Use an ability while your target is out of reach and your hero walks there, then uses it. Moving yourself stops the walk.
      </span>
    </label>
  );
}

/**
 * How The Ring plays, for whoever asks: on demand, never in the way. First the four things a newcomer needs, then the
 * rest of the rules and the controls behind their own headings, folded until opened.
 */
export function RingHelp({ onClose, touch, engine, onTutorial }: { onClose: () => void; touch?: boolean; engine?: SigilEngine; onTutorial?: () => void }) {
  return (
    <div className="rb-ring-dialog-wrap" role="dialog" aria-label="How The Ring works" onClick={onClose}>
      <div className="rb-ring-dialog is-help" onClick={(e) => e.stopPropagation()}>
        <h2>How The Ring works</h2>
        <div className="rb-ring-help">
          <section className="rb-ring-help-four">
            <h3>The four things you need</h3>
            <ol>
              <li>
                <b>Move.</b> {touch ? 'Your left thumb, anywhere on the left side.' : 'W A S D or the arrow keys.'} You can use abilities while you move.
              </li>
              <li>
                <b>Use your abilities.</b> {touch ? 'The buttons on the right.' : '1 to 5, or click them.'} They go to your target (the nearest enemy until you choose one). A button that glows lands a combo.
              </li>
              <li>
                <b>Walk out of red circles.</b> A red circle on the ground is an attack about to land: get out of it before it does.
              </li>
              <li>
                <b>Use your super.</b> When the round gold button is full, {touch ? 'tap it' : 'press Q'}.
              </li>
            </ol>
            {onTutorial && (
              <button className="rb-btn is-small" onClick={onTutorial}>
                Take the tutorial
              </button>
            )}
          </section>
          {engine && <CloseInToggle engine={engine} />}
          <details className="rb-ring-help-more">
            <summary>More rules</summary>
            <ul>
              <li>
                <b>Combos.</b> Many abilities hit much harder against a target you have set up (their cards say how).
              </li>
              <li>
                <b>Spells land. Circles can be left.</b> What is aimed at someone always hits them: quick ones at once, cast ones after a short flight. What is placed on the ground shows as a circle first, red when it is the other side’s.
              </li>
              <li>
                <b>Healing spheres.</b> Green spheres rise around the ground. Walk into one when you are hurt and it gives back part of your health, then rises again a little later.
              </li>
              <li>
                <b>Take the sigil.</b> A sigil rises in the middle now and then: it heals, fills your super by a third and speeds you up.
              </li>
              <li>
                <b>Pillars block sight.</b> Step behind one before a cast ends and it is lost, and a healer can’t reach who they can’t see.
              </li>
              <li>
                <b>Casts, interrupts and holds.</b> Interrupt a cast to lock that school of magic for a few seconds. Stuns, fears, dazes, roots and silences are short and wear off faster each time; enough damage breaks a fear, a daze or a root.
              </li>
              <li>
                <b>The Gloam closes in.</b> Forty seconds in, it starts closing in from the edges and burns whoever is out in it, until there’s nowhere left to stand. Healing also fades the longer a match goes.
              </li>
              <li>
                <b>Bigger fights heal more.</b> Healing is 30% stronger in 2v2 and 45% stronger in 3v3.
              </li>
              <li>
                <b>Finding a match.</b> The Ring looks for other players for ten seconds. If someone is looking for the same kind of fight, you meet them; if nobody is, you fight the computer’s teams. Both are for rating. Walk out once the gates have lifted and it is a leaver’s loss, half again a loss; against other players the match then ends for everyone else, and their rating stays as it was.
              </li>
              <li>
                <b>Climb for rewards.</b> Every rank gives its title and a suit of Ringforged armor, for good. See them under Rewards in the lobby, and wear them from Title & armor.
              </li>
            </ul>
          </details>
          <details className="rb-ring-help-more">
            <summary>All the controls</summary>
            <dl>
              <dt>Move</dt>
              <dd>WASD, the arrows, or drag on a touch screen</dd>
              <dt>Abilities</dt>
              <dd>1 to 5, or click them. They aim themselves at your target</dd>
              <dt>Placed abilities</dt>
              <dd>A comet, a volley, a pyre. With a mouse: press its key, then click where it should land (Esc puts the circle away; the key again drops it on your target). On a touch screen: tap to drop it on your target, or hold the button and push the circle where you want it</dd>
              <dt>Trinket</dt>
              <dd>An ability every class can take as one of its five: breaks you out of every hold (stuns, fears, roots, dazes, silences, slows) and takes off every burn and bleed. Once every 45 seconds</dd>
              <dt>Super</dt>
              <dd>Q, once your meter is full: your class’s big one</dd>
              <dt>Choose an enemy</dt>
              <dd>Their nameplate on the right, the fighter themself, or Tab. On a touch screen against two or more, the ◎ button over your top-right ability: tap for the next, or slide toward one</dd>
              <dt>Choose who to help</dt>
              <dd>Their nameplate on the left, the fighter themself, or F</dd>
              <dt>Match menu</dt>
              <dd>The ⋯ beside the clock: hide or show the nameplates, the keys, these rules, and leaving the match. Health and effects stay over every fighter’s head with the nameplates hidden</dd>
            </dl>
          </details>
        </div>
        <button className="rb-btn is-gold" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}
