import { useState } from 'react';
import { CLASSES, CLASS_IDS } from '../data/classes';
import type { ClassId } from '../data/types';
import { iconPicture } from '../render/art/gameIcons';
import { deedDone, deedProgress, DEEDS, type Deed, type DeedState } from '../vigil/deeds';
import { SPELLS, spellsOf, STRENGTHS } from '../vigil/kit';
import { BOON_IDS, BOON_MAX, BOONS, WILD_COST, WILD_SPELLS } from '../vigil/night';
import { boonCost, buyBoon, buyWild, carryWild, type Returns } from '../vigil/returns';

type Tab = 'fire' | 'deeds' | 'codex';
const GROUPS: [Deed['group'], string][] = [
  ['class', 'With every class'],
  ['land', 'In every land'],
  ['event', 'In the night'],
  ['record', 'The codex'],
];

/**
 * The Watchfire: where the motes a keeper earns in every night are spent on what lasts (vigil/returns.ts), and where
 * what there is still to do is kept. Boons are small strengths carried into every night; a wild spell is one from
 * another class that the cards may then offer; a deed is something to have done, paid once; the codex is every
 * evolution found so far.
 */
export function Watchfire({ cls, ret, state, onChange, onClose }: { cls: ClassId; ret: Returns; state: DeedState; onChange: (r: Returns) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('fire');
  const evolving = CLASS_IDS.flatMap((c) => spellsOf(c).filter((s) => !!s.evolve));
  const found = evolving.filter((s) => state.codex.has(s.id)).length;
  return (
    <div className="rb-vigil-modal rb-vfire" role="dialog" aria-label="The Watchfire">
      <header className="rb-vfire-head">
        <h2>The Watchfire</h2>
        <p className="rb-vfire-motes">
          <b>{ret.motes}</b> motes
        </p>
        <div className="rb-vfire-tabs" role="tablist">
          {(
            [
              ['fire', 'Boons & wild spells'],
              ['deeds', `Deeds ${ret.deeds.length}/${DEEDS.length}`],
              ['codex', `Codex ${found}/${evolving.length}`],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`rb-btn is-small${tab === id ? ' is-gold' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <button className="rb-btn is-small" onClick={onClose}>
          Done
        </button>
      </header>
      {tab === 'fire' && (
        <>
          <p className="rb-dim rb-vfire-how">Every night earns motes: for how long you held, each champion felled, each event won and each deed done. What you light here is yours in every night after.</p>
          <h3>Boons</h3>
          <div className="rb-vfire-grid">
            {BOON_IDS.map((id) => {
              const b = BOONS[id];
              const rank = ret.boons[id] ?? 0;
              const cost = boonCost(ret, id);
              return (
                <button key={id} className={`rb-vfire-item${rank > 0 ? ' is-have' : ''}${cost === null ? ' is-full' : ''}`} disabled={cost === null || ret.motes < cost} onClick={() => onChange(buyBoon(id))}>
                  <img src={iconPicture(STRENGTHS[b.icon].icon)} alt="" draggable={false} />
                  <span>
                    <strong>{b.name}</strong>
                    <small>{b.text}, each rank</small>
                  </span>
                  <span className="rb-vfire-pips" aria-label={`Rank ${rank} of ${BOON_MAX}`}>
                    {Array.from({ length: BOON_MAX }, (_, i) => (
                      <i key={i} className={i < rank ? 'is-on' : ''} />
                    ))}
                  </span>
                  <b>{cost === null ? 'Full' : `${cost} motes`}</b>
                </button>
              );
            })}
          </div>
          <h3>Wild spells</h3>
          <p className="rb-dim rb-vfire-how">A spell from another class that your cards may offer in a night. You carry one at a time.</p>
          <div className="rb-vfire-grid">
            {WILD_SPELLS.map((id) => {
              const def = SPELLS[id]!;
              const own = ret.wilds.includes(id);
              const carried = ret.wild === id;
              const mine = def.cls === cls;
              return (
                <button key={id} className={`rb-vfire-item${carried ? ' is-on' : ''}${own ? ' is-have' : ''}`} disabled={!own && ret.motes < WILD_COST} aria-pressed={own ? carried : undefined} onClick={() => onChange(own ? carryWild(carried ? null : id) : buyWild(id))}>
                  <img src={iconPicture(def.icon)} alt="" draggable={false} />
                  <span>
                    <strong>{def.name}</strong>
                    <small>
                      {CLASSES[def.cls].name}. {def.text}
                    </small>
                  </span>
                  <b>{carried ? (mine ? 'Carried (not as its own class)' : 'Carried') : own ? 'Carry' : `${WILD_COST} motes`}</b>
                </button>
              );
            })}
          </div>
        </>
      )}
      {tab === 'deeds' && (
        <>
          <p className="rb-dim rb-vfire-how">Things to have done. Each is paid once, in motes, when the night that finishes it ends.</p>
          {GROUPS.map(([group, title]) => (
            <section key={group} className="rb-vfire-deeds">
              <h3>{title}</h3>
              <div className="rb-vfire-grid">
                {DEEDS.filter((d) => d.group === group).map((d) => {
                  const paid = ret.deeds.includes(d.id);
                  const [at, of] = d.at(state);
                  return (
                    <div key={d.id} className={`rb-vfire-item is-deed${paid ? ' is-done' : ''}`}>
                      <span>
                        <strong>{d.name}</strong>
                        <small>{d.text}</small>
                        <i className="rb-vfire-bar" aria-hidden="true">
                          <u style={{ width: `${Math.round((Math.min(at, of) / of) * 100)}%` }} />
                        </i>
                      </span>
                      <b>{paid ? 'Done' : deedDone(d, state) ? `+${d.motes} next night` : `${deedProgress(d, state)} · ${d.motes} motes`}</b>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
      {tab === 'codex' && (
        <>
          <p className="rb-dim rb-vfire-how">Every evolution there is. A spell at its top evolves when you hold two levels of the relic it names; the ones you have found are lit.</p>
          {CLASS_IDS.map((c) => (
            <section key={c} className="rb-vfire-codex">
              <h3>{CLASSES[c].name}</h3>
              <div className="rb-vfire-grid">
                {spellsOf(c)
                  .filter((s) => !!s.evolve)
                  .map((s) => {
                    const have = state.codex.has(s.id);
                    return (
                      <div key={s.id} className={`rb-vfire-item is-deed${have ? ' is-done' : ' is-unknown'}`}>
                        <img src={iconPicture(s.evolve!.icon)} alt="" draggable={false} />
                        <span>
                          <strong>{s.evolve!.name}</strong>
                          <small>{have ? s.evolve!.text : `${s.name}, with ${STRENGTHS[s.evolve!.with].name}`}</small>
                        </span>
                        <b>{have ? 'Found' : ''}</b>
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
          <p className="rb-dim rb-vfire-how">
            Wild spells learned: {ret.wilds.length} of {WILD_SPELLS.length}.
          </p>
        </>
      )}
    </div>
  );
}
