import { CLASSES } from '../data/classes';
import type { ClassId } from '../data/types';
import { iconPicture } from '../render/art/gameIcons';
import { SPELLS, STRENGTHS } from '../vigil/kit';
import { BOON_IDS, BOON_MAX, BOONS, WILD_COST, WILD_SPELLS } from '../vigil/night';
import { boonCost, buyBoon, buyWild, carryWild, type Returns } from '../vigil/returns';

/**
 * The Watchfire: where the motes a keeper earns in every night are spent on what lasts (vigil/returns.ts). Boons are
 * small strengths carried into every night; a wild spell is one from another class that the cards may then offer.
 */
export function Watchfire({ cls, ret, onChange, onClose }: { cls: ClassId; ret: Returns; onChange: (r: Returns) => void; onClose: () => void }) {
  return (
    <div className="rb-vigil-modal rb-vfire" role="dialog" aria-label="The Watchfire">
      <h2>The Watchfire</h2>
      <p className="rb-dim rb-vfire-how">Every night earns motes: for how long you held, each champion felled and each event won. What you light here is yours in every night after.</p>
      <p className="rb-vfire-motes">
        <b>{ret.motes}</b> motes
      </p>
      <h3>Boons</h3>
      <div className="rb-vfire-grid">
        {BOON_IDS.map((id) => {
          const b = BOONS[id];
          const rank = ret.boons[id] ?? 0;
          const cost = boonCost(ret, id);
          return (
            <button key={id} className={`rb-vfire-item${rank > 0 ? ' is-have' : ''}`} disabled={cost === null || ret.motes < cost} onClick={() => onChange(buyBoon(id))}>
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
      <div className="rb-vigil-actions">
        <button className="rb-btn is-gold" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
