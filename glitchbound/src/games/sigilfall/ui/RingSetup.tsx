import { useState, type ReactNode } from 'react';
import { ABILITIES, BOONS, combosOf, PRESETS, SLOTS, styleOfBar, ultOf, type Ability, type Playstyle, type Points } from '../arena/abilities';
import { usesOf } from '../arena/advice';
import type { ClassSets, RingSetup } from '../arena/ladder';
import { RANGED } from '../arena/sim';
import { EASE_WORD, presetOfBar, styleOf } from '../arena/styles';
import { cleanTalents, fullTalents, ROW_HINTS, ROW_NAMES, talentsFor, type Talent } from '../arena/talents';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { iconPicture } from '../render/art/gameIcons';

const ROLE_WORD: Record<string, string> = { damage: 'Damage', heal: 'Healing', cc: 'Crowd control', interrupt: 'Interrupt', defense: 'Defense', mobility: 'Movement', dispel: 'Dispel', burst: 'Burst', summon: 'Summon', stealth: 'Stealth' };
/** An ability's place in its playstyle's four, by where it stands on the bar. */
const SLOT_WORD = ['Basic', 'Combo', 'Utility', 'Hold'] as const;

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

/** The points a setup builds and spends, if its playstyle or one of its talents gives it any. */
export const pointsOf = (cls: ClassId, setup: Pick<RingSetup, 'bar' | 'talents'>): Points | null => {
  const style = styleOfBar(cls, setup.bar);
  return cleanTalents(cls, setup.talents, style.id).find((t) => t.points)?.points ?? style.points ?? null;
};

/** The bar as it stands: its playstyle's four, then what every hero has besides (the playstyle's super). */
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
      {[ultOf(cls, ult ?? styleOfBar(cls, bar).ult)].map((ab) => (
        <button key={ab.id} type="button" className={`rb-rs-slot is-token${ab.super ? ' is-super' : ''}`} disabled={!onPick} title={`${ab.super ? 'Super' : ab.name}: ${ab.text}`} onClick={() => onPick?.(ab)} onMouseEnter={() => onHover?.(ab)}>
          <img src={iconPicture(ab.icon)} alt={ab.name} draggable={false} />
        </button>
      ))}
    </div>
  );
}

/** A setup at a glance: its talents, for the Play page. */
export function SetupChips({ cls, setup }: { cls: ClassId; setup: RingSetup }) {
  const talents = cleanTalents(cls, setup.talents, styleOfBar(cls, setup.bar).id);
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
 * An ability read (the owner: "whenever i click on spell, please add a pop up with info about it, best uses, best
 * combos"): what it does, when to press it, what it makes with the rest of its playstyle, and what the talents chosen
 * make of it. A playstyle's abilities are fixed, so there is nothing to take or leave here: it only closes. Opened from
 * the setup page and from the bar on the Ring's main screen ("make the abilities clickable ... so i can see what i
 * have and how to use it").
 */
export function AbilityCard({ ab, cls, bar, talents, onClose }: { ab: Ability; cls: ClassId; bar: string[]; talents?: readonly string[]; onClose: () => void }) {
  const style = styleOfBar(cls, bar);
  const combos = combosOf(cls, ab, bar);
  const slot = bar.indexOf(ab.id);
  // (the talents chosen that work on this ability, each in its own words)
  const mine = cleanTalents(cls, talents, style.id).filter((t) => t.tune && (ab.id in t.tune || (!!ab.super && 'super' in t.tune)));
  const boons = [...(ab.gives ?? []), ...(ab.uses ?? [])].map((x) => BOONS[x.boon]).filter((b, i, all): b is NonNullable<typeof b> => !!b && all.indexOf(b) === i);
  const partner = (x: Ability): ReactNode => (
    <span key={x.id} className="rb-rs-partner is-held">
      <img src={iconPicture(x.icon)} alt="" draggable={false} />
      {x.name}
      <small>{x.super ? 'your super' : 'on your bar'}</small>
    </span>
  );
  return (
    // (over the game's own screen, as its rules are, not over the whole page)
    <div className="rb-ring-dialog-wrap is-card is-local" role="dialog" aria-modal="true" aria-label={ab.name} onClick={onClose}>
      <div className="rb-ring-dialog rb-rs-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <img src={iconPicture(ab.icon)} alt="" draggable={false} />
          <span>
            <strong>{ab.name}</strong>
            <em>{ab.super ? 'Super' : `${slot >= 0 ? `${SLOT_WORD[slot]} · ` : ''}${ROLE_WORD[ab.role]}`}</em>
            <small>{ab.super ? 'Ready when your meter is full' : timing(ab)}</small>
          </span>
        </header>
        <p className="rb-rs-card-text">{ab.text}</p>
        <div className="rb-rs-card-cols">
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
            {boons.map((b) => (
              <p key={b.id}>
                <b>{b.name}.</b> {b.text}
              </p>
            ))}
            {mine.map((t) => (
              <p key={t.id} className="rb-rs-card-talent">
                <b>Talent · {t.name}.</b> {t.text}
              </p>
            ))}
            {!combos.lands && combos.setsUp.length === 0 && boons.length === 0 && mine.length === 0 && <p className="rb-dim">It is not part of a combo. It does its own job.</p>}
          </section>
        </div>
        <footer>
          <button type="button" className="rb-btn is-gold" onClick={onClose} autoFocus>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * The playstyles: a class's two ways to fight, each as a card with what it plays like in a line, how hard it is
 * (arena/styles.ts) and its four abilities and super. Taking one is the whole of choosing abilities (the owner,
 * 2026-11-16: "fixed spells per playstyle, only talents need to be changed").
 */
function StyleCards({ cls, setup, onPick }: { cls: ClassId; setup: RingSetup; onPick: (i: number) => void }) {
  const on = presetOfBar(cls, setup.bar);
  return (
    <div className="rb-rs-styles" data-tut="styles" role="radiogroup" aria-label="Playstyle">
      {PRESETS[cls].map((p, i) => {
        const st = styleOf(cls, p.id);
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

/** How a playstyle's combo goes, in its own short lines, and the points the setup builds if it has any. */
function HowItPlays({ style, points }: { style: Playstyle; points: Points | null }) {
  return (
    <ol className="rb-rs-how" aria-label="How its combo goes" data-tut="combos">
      {style.how.map((line) => (
        <li key={line}>{line}</li>
      ))}
      {points && (
        <li className="is-points" style={{ ['--pt' as string]: points.color }}>
          <b>{points.name}</b>: up to {points.max}, shown over your bar.
        </li>
      )}
    </ol>
  );
}

/** What the tutorial (arena/tutorial.ts) shows of the setup page: it is one page now, so nothing to turn. */
export type SetupGuide = Record<string, never>;

/**
 * Changing what a class brings: three saved setups, each a playstyle and three talents. One page: the playstyles, the
 * chosen one's abilities to read with how its combo goes, and its talents, one from each row. (Until 2026-11-16 the
 * five abilities and the super were chosen one by one, behind Customize and its tabs.)
 */
export function SetupEditor({ cls, sets, onSets }: { cls: ClassId; sets: ClassSets; onSets: (s: ClassSets) => void; guide?: SetupGuide }) {
  const cur = sets.list[sets.active]!;
  const style = styleOfBar(cls, cur.bar);
  /** The ability being read (AbilityCard). */
  const [card, setCard] = useState<Ability | null>(null);
  const put = (next: RingSetup): void => {
    const list = [...sets.list];
    list[sets.active] = next;
    onSets({ ...sets, list });
  };
  const chosen = cleanTalents(cls, cur.talents, style.id);
  /** One from each row, always: choosing another takes its row's place. */
  const pickTalent = (t: Talent): void => {
    put({ ...cur, talents: [...chosen.filter((x) => x.row !== t.row).map((x) => x.id), t.id] });
  };
  /** A playstyle taken: its four and its super, and the talents it comes with (those of the class's own row are kept). */
  const useStyle = (i: number): void => {
    const p = PRESETS[cls][i]!;
    if (p.id === style.id) return;
    put({ bar: [...p.bar], talents: fullTalents(cls, p.id, cur.talents, p.talents), ult: p.ult });
  };
  const options = talentsFor(cls, style.id);
  return (
    <div className="rb-rs is-fixed">
      <div className="rb-rs-top">
        <div className="rb-rs-sets" role="tablist" aria-label="Saved setups" data-tut="sets">
          {sets.list.map((_, i) => (
            <button key={i} role="tab" aria-selected={i === sets.active} className={`rb-rs-set${i === sets.active ? ' is-on' : ''}`} onClick={() => onSets({ ...sets, active: i })}>
              Setup {i + 1}
            </button>
          ))}
        </div>
      </div>

      <p className="rb-rs-hint">Pick a playstyle. Its abilities are its own: what you choose is its talents.</p>
      <StyleCards cls={cls} setup={cur} onPick={useStyle} />

      <div className="rb-rs-kitrow">
        <div className="rb-rs-barrow" data-tut="bar">
          <BarRow bar={cur.bar} cls={cls} ult={style.ult} onPick={setCard} />
          <small className="rb-rs-barhint">Tap one to read it.</small>
        </div>
        <HowItPlays style={style} points={pointsOf(cls, cur)} />
      </div>

      <div className="rb-rs-panel" data-tut="talents">
        {ROW_NAMES.map((name, row) => (
          <div key={name} className="rb-rs-row" role="radiogroup" aria-label={name}>
            <h4>
              {name} <small>{ROW_HINTS[row]}</small>
            </h4>
            <div className="rb-rs-options">
              {options
                .filter((t) => t.row === row)
                .map((t) => {
                  const on = chosen.some((x) => x.id === t.id);
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
      </div>
      {card && <AbilityCard key={card.id} ab={card} cls={cls} bar={cur.bar} talents={cur.talents} onClose={() => setCard(null)} />}
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
                <b>Use your abilities.</b> {touch ? 'The buttons on the right.' : '1 to 4, or click them.'} They go to your target (the nearest enemy until you choose one). A button that glows is at its strongest right now: press it.
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
                <b>Combos.</b> Every playstyle has one, made with its basic ability or its super: an ability hits much harder against a target you have set up, or spends points your basic ability built, or is lit by a boon for one use (light at the edges of the screen says you have one). Their cards say how, and so do your talents.
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
                <b>Healing fades.</b> From 35 seconds in, all healing and every shield gets weaker every second, until none is left: no match drags on.
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
              <dd>1 to 4, or click them. They aim themselves at your target</dd>
              <dt>Placed abilities</dt>
              <dd>A comet, a volley, a globe of rime. With a mouse: press its key, then click where it should land (Esc puts the circle away; the key again drops it on your target). On a touch screen: tap to drop it on your target, or hold the button and push the circle where you want it</dd>
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
