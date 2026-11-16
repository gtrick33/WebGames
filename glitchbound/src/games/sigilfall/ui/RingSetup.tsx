import { useState } from 'react';
import { ABILITIES, barCombos, combosOf, PRESETS, SLOTS, styleOfBar, ultOf, type Ability, type BarCombo, type Points } from '../arena/abilities';
import type { ClassSets, RingSetup } from '../arena/ladder';
import { EASE_WORD, presetOfBar, styleOf } from '../arena/styles';
import { cleanTalents, fullTalents, ROW_NAMES, talentsFor, type Talent } from '../arena/talents';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { iconPicture } from '../render/art/gameIcons';

/** An ability's place in its playstyle's four, by where it stands on the bar. */
const SLOT_WORD = ['Basic', 'Combo', 'Utility', 'Control'] as const;

/** How long an ability takes to use, and how it reaches: the left of a tooltip's second line. */
export function castWord(ab: Ability): string {
  const bits = [ab.channel ? 'Channeled' : ab.cast ? `${ab.cast} sec cast` : 'Instant'];
  if (ab.aim === 'ground') bits.push('Placed');
  else if (ab.range > 0 && ab.range <= 40) bits.push('Melee');
  else if (ab.range > 40 && ab.aim !== 'near' && ab.aim !== 'self') bits.push('Ranged');
  return bits.join(' · ');
}

/** How long before it can be used again: the right of that line. A super has its meter instead. */
export const cooldownWord = (ab: Ability): string => (ab.super ? 'Super' : ab.cd ? `${ab.cd} sec cooldown` : '');

/** Both, in one line (the fight's own tooltip is narrow). */
export const timing = (ab: Ability): string => [castWord(ab), cooldownWord(ab)].filter(Boolean).join(' · ');

export const talentIcon = (t: Talent): string => iconPicture(t.icon ?? ABILITIES[Object.keys(t.tune ?? {})[0] ?? '']?.icon ?? '');

/** The points a setup builds and spends, if its playstyle or one of its talents gives it any. */
export const pointsOf = (cls: ClassId, setup: Pick<RingSetup, 'bar' | 'talents'>): Points | null => {
  const style = styleOfBar(cls, setup.bar);
  return cleanTalents(cls, setup.talents, style.id).find((t) => t.points)?.points ?? style.points ?? null;
};

/** The bar as it stands: its playstyle's four, then what every hero has besides (the playstyle's super). */
export function BarRow({ bar, cls, ult, onPick, onHover, on }: { bar: string[]; cls: ClassId; ult?: string; onPick?: (ab: Ability) => void; onHover?: (ab: Ability) => void; on?: string }) {
  return (
    <div className="rb-rs-slots">
      {Array.from({ length: SLOTS }, (_, i) => {
        const ab = ABILITIES[bar[i] ?? ''];
        return (
          <button key={i} type="button" className={`rb-rs-slot${ab ? '' : ' is-empty'}${ab && ab.id === on ? ' is-read' : ''}`} disabled={!ab || !onPick} onClick={() => ab && onPick?.(ab)} onMouseEnter={() => ab && onHover?.(ab)} onFocus={() => ab && onHover?.(ab)} title={ab ? ab.name : 'An empty place'} aria-label={ab ? ab.name : 'An empty place'}>
            {ab ? <img src={iconPicture(ab.icon)} alt="" draggable={false} /> : <small>{i + 1}</small>}
          </button>
        );
      })}
      {[ultOf(cls, ult ?? styleOfBar(cls, bar).ult)].map((ab) => (
        <button key={ab.id} type="button" className={`rb-rs-slot is-token${ab.super ? ' is-super' : ''}${ab.id === on ? ' is-read' : ''}`} disabled={!onPick} title={`${ab.super ? 'Super: ' : ''}${ab.name}`} onClick={() => onPick?.(ab)} onMouseEnter={() => onHover?.(ab)} onFocus={() => onHover?.(ab)}>
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
 * An ability's tooltip, read the same wherever it is opened (the setup page, the bar on the Ring's main screen, the
 * bar in a fight): its name and place on the bar, how it is used and how soon again, what it does in a sentence or
 * two, its combo, and what the talents chosen make of it. The owner, 2026-11-16: "i really dislike the fact that ui is
 * 90% texts, summarize everything in clear terms, remove the redundant text and make it similar to wow's description
 * of the spells". So nothing here says a thing twice, and advice on when to press it is left to the fight's own hints.
 */
export function SpellTip({ ab, cls, bar, talents }: { ab: Ability; cls: ClassId; bar: readonly string[]; talents?: readonly string[] }) {
  const style = styleOfBar(cls, bar);
  const slot = style.bar.indexOf(ab.id);
  const combo = combosOf(cls, ab, bar).lands;
  // (the talents chosen that work on this ability, each in its own words)
  const mine = cleanTalents(cls, talents, style.id).filter((t) => t.tune && (ab.id in t.tune || (!!ab.super && 'super' in t.tune)));
  return (
    <div className="rb-stip" style={{ ['--a' as string]: ab.color }}>
      <header>
        <img src={iconPicture(ab.icon)} alt="" draggable={false} />
        <span>
          <strong>{ab.name}</strong>
          <em>{ab.super ? 'Super' : slot >= 0 ? SLOT_WORD[slot] : ''}</em>
        </span>
      </header>
      <p className="rb-stip-meta">
        <span>{castWord(ab)}</span>
        <span>{ab.super ? 'When your meter is full' : cooldownWord(ab)}</span>
      </p>
      <p className="rb-stip-text">{ab.text}</p>
      {combo && combo.kind === 'combo' && (
        <p className="rb-stip-combo">
          <b>{combo.name}</b> {combo.text}
        </p>
      )}
      {mine.map((t) => (
        <p key={t.id} className="rb-stip-talent">
          <b>{t.name}</b> {t.text}
        </p>
      ))}
    </div>
  );
}

/** A talent's tooltip: its name, the row it is from, and what it does. */
export function TalentTip({ t }: { t: Talent }) {
  return (
    <div className="rb-stip is-talent">
      <header>
        <img src={talentIcon(t)} alt="" draggable={false} />
        <span>
          <strong>{t.name}</strong>
          <em>Talent · {ROW_NAMES[t.row]}</em>
        </span>
      </header>
      <p className="rb-stip-text">{t.text}</p>
    </div>
  );
}

/** What two abilities of a bar make together, in a word for its chip: how much more, or what is built. */
export function linkWord(c: BarCombo): string {
  const k = c.kind === 'combo' ? c.to.combo?.mult : c.kind === 'boon' ? c.to.uses?.find((u) => c.from.gives?.some((g) => g.boon === u.boon))?.mult : undefined;
  if (!k) return c.name;
  return Number.isInteger(k) ? `×${k}` : `+${Math.round((k - 1) * 100)}%`;
}

/** A combo's tooltip: its name, the two abilities, and its one sentence. */
function ComboTip({ c }: { c: BarCombo }) {
  return (
    <div className="rb-stip is-combo">
      <header>
        <img src={iconPicture(c.from.icon)} alt="" draggable={false} />
        <span>
          <strong>{c.name}</strong>
          <em>
            {c.from.name} › {c.to.name}
          </em>
        </span>
      </header>
      <p className="rb-stip-text">{c.text}</p>
    </div>
  );
}

/**
 * An ability read in a window of its own, from the bar on the Ring's main screen (the owner: "make the abilities
 * clickable of the presets so i can see what i have and how to use it"): its tooltip, and a way to close it. A
 * playstyle's abilities are fixed, so there is nothing to take or leave here.
 */
export function AbilityCard({ ab, cls, bar, talents, onClose }: { ab: Ability; cls: ClassId; bar: string[]; talents?: readonly string[]; onClose: () => void }) {
  return (
    // (over the game's own screen, as its rules are, not over the whole page)
    <div className="rb-ring-dialog-wrap is-card is-local" role="dialog" aria-modal="true" aria-label={ab.name} onClick={onClose}>
      <div className="rb-ring-dialog rb-rs-card" onClick={(e) => e.stopPropagation()}>
        <SpellTip ab={ab} cls={cls} bar={bar} talents={talents} />
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
 * The playstyles: a class's two ways to fight, each as a card with its name, how hard it is, what it is in a few words
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

/** What the tutorial (arena/tutorial.ts) shows of the setup page: it is one page now, so nothing to turn. */
export type SetupGuide = Record<string, never>;

/** What the setup page's tooltip is showing: an ability, a talent, or a combo of the bar. */
type Reading = { k: 'ability'; id: string } | { k: 'talent'; id: string } | { k: 'combo'; i: number };

/**
 * Changing what a class brings: three saved setups, each a playstyle and three talents. One page, made of pictures:
 * the playstyles, the chosen one's abilities and the combos they make as icons, its talents as a small tree (three
 * rows of three, one taken in each), and beside them one tooltip that reads whatever is pointed at or tapped. (It was
 * rows of text until the owner, 2026-11-16: "i really dislike the fact that ui is 90% texts"; and until that day's
 * makeover the five abilities and the super were chosen one by one, behind Customize and its tabs.)
 */
export function SetupEditor({ cls, sets, onSets }: { cls: ClassId; sets: ClassSets; onSets: (s: ClassSets) => void; guide?: SetupGuide }) {
  const cur = sets.list[sets.active]!;
  const style = styleOfBar(cls, cur.bar);
  const [reading, setReading] = useState<Reading | null>(null);
  const put = (next: RingSetup): void => {
    const list = [...sets.list];
    list[sets.active] = next;
    onSets({ ...sets, list });
  };
  const chosen = cleanTalents(cls, cur.talents, style.id);
  /** One from each row, always: choosing another takes its row's place. */
  const pickTalent = (t: Talent): void => {
    setReading({ k: 'talent', id: t.id });
    if (chosen.some((x) => x.id === t.id)) return;
    put({ ...cur, talents: [...chosen.filter((x) => x.row !== t.row).map((x) => x.id), t.id] });
  };
  /** A playstyle taken: its four and its super, and the talents it comes with (those of the class's own row are kept). */
  const useStyle = (i: number): void => {
    const p = PRESETS[cls][i]!;
    if (p.id === style.id) return;
    setReading(null);
    put({ bar: [...p.bar], talents: fullTalents(cls, p.id, cur.talents, p.talents), ult: p.ult });
  };
  const options = talentsFor(cls, style.id);
  const ult = ultOf(cls, style.ult);
  const combos = barCombos(cls, cur.bar, style.ult);
  // what the tooltip reads: what was last pointed at, if this playstyle still has it; else its basic ability
  const kit = [...style.bar.map((id) => ABILITIES[id]!), ult];
  const readAb = reading?.k === 'ability' ? kit.find((a) => a.id === reading.id) : undefined;
  const readTalent = reading?.k === 'talent' ? options.find((t) => t.id === reading.id) : undefined;
  const readCombo = reading?.k === 'combo' ? combos[reading.i] : undefined;
  const shownAb = readAb ?? (!readTalent && !readCombo ? kit[0]! : undefined);
  return (
    <div className="rb-rs is-fixed is-tree">
      <div className="rb-rs-top">
        <div className="rb-rs-sets" role="tablist" aria-label="Saved setups" data-tut="sets">
          {sets.list.map((_, i) => (
            <button key={i} role="tab" aria-selected={i === sets.active} className={`rb-rs-set${i === sets.active ? ' is-on' : ''}`} onClick={() => onSets({ ...sets, active: i })}>
              Setup {i + 1}
            </button>
          ))}
        </div>
      </div>

      <StyleCards cls={cls} setup={cur} onPick={useStyle} />

      <div className="rb-rs-tree">
        <div className="rb-rs-pick">
          <div className="rb-rs-kitrow">
            <div className="rb-rs-barrow" data-tut="bar">
              <BarRow bar={cur.bar} cls={cls} ult={style.ult} on={shownAb?.id} onPick={(ab) => setReading({ k: 'ability', id: ab.id })} onHover={(ab) => setReading({ k: 'ability', id: ab.id })} />
            </div>
            {/* the combos the bar makes: what sets it up, what lands it, and how much more it does */}
            <div className="rb-rs-links" data-tut="combos" aria-label="Combos">
              {combos.map((c, i) => (
                <button key={`${c.from.id}-${c.to.id}`} type="button" className={`rb-rs-link is-${c.kind}${readCombo === c ? ' is-read' : ''}`} onClick={() => setReading({ k: 'combo', i })} onMouseEnter={() => setReading({ k: 'combo', i })} onFocus={() => setReading({ k: 'combo', i })} aria-label={`${c.name}: ${c.from.name}, then ${c.to.name}`}>
                  <img src={iconPicture(c.from.icon)} alt="" draggable={false} />
                  <i aria-hidden="true">›</i>
                  <img src={iconPicture(c.to.icon)} alt="" draggable={false} />
                  <b>{linkWord(c)}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="rb-rs-talents" data-tut="talents">
            {ROW_NAMES.map((name, row) => (
              <div key={name} className="rb-rs-row" role="radiogroup" aria-label={name}>
                <h4>{name}</h4>
                <div className="rb-rs-nodes">
                  {options
                    .filter((t) => t.row === row)
                    .map((t) => {
                      const on = chosen.some((x) => x.id === t.id);
                      return (
                        <button key={t.id} role="radio" aria-checked={on} aria-label={t.name} className={`rb-rs-node${on ? ' is-on' : ''}${readTalent === t ? ' is-read' : ''}`} onClick={() => pickTalent(t)} onMouseEnter={() => setReading({ k: 'talent', id: t.id })} onFocus={() => setReading({ k: 'talent', id: t.id })}>
                          <img src={talentIcon(t)} alt="" draggable={false} />
                          <strong>{t.name}</strong>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* one tooltip for the whole page: whatever was last pointed at or tapped */}
        <aside className="rb-rs-read" aria-live="polite">
          {readTalent ? <TalentTip t={readTalent} /> : readCombo ? <ComboTip c={readCombo} /> : <SpellTip ab={shownAb!} cls={cls} bar={cur.bar} talents={cur.talents} />}
        </aside>
      </div>
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
