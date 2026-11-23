import { CLASSES } from '../data/classes';
import { KEY_DEATH } from '../data/keystones';
import { RIFT_ITEMS, setsOf } from '../data/riftgear';
import { modLines } from '../progress/describe';
import type { Character } from '../progress/character';
import { FORGED_LEVEL, stoneRows, WAGER_PRICE } from '../progress/rift';
import { campaignDone } from '../progress/wardrobe';

/**
 * How the Rift works, for someone who has never seen it: where to go, how a run is won, and what each stone gives.
 * It folds away under the Riftstone choice at a waystone and on the Rift Trials screen, and every number in it is
 * read from the rules (progress/rift.ts, data/keystones.ts, data/riftgear.ts), so it can't fall out of step with them.
 */
export function RiftGuide({ hero, open }: { hero: Character; open?: boolean }) {
  const cls = CLASSES[hero.cls];
  const sets = setsOf(hero.cls);
  const legendaries = RIFT_ITEMS.filter((d) => d.rarity === 'legendary' && (!d.cls || d.cls === hero.cls));
  const rows = stoneRows(hero.cls, campaignDone(hero));
  const young = hero.level < FORGED_LEVEL;
  return (
    <details className="rb-rift-guide" open={open}>
      <summary>How the Rift works</summary>
      <div className="rb-rift-guide-body">
        <section>
          <h3>Where to go</h3>
          <p>
            The <b>Riftward</b>, past any waystone: show the Keeper of the Riftgate your stone and choose a dungeon. From the title screen, <b>The Riftstone</b> takes this hero or a champion there. With friends, start it from <b>Play together</b>. Each dungeon keeps its own stone: beat one in time and that one goes deeper.
          </p>
        </section>
        <section>
          <h3>How a run is won</h3>
          <p>
            Clear the dungeon before its clock runs out: the clock by the map says what you are racing for. Every fall costs {KEY_DEATH} seconds. In time, the next stone opens (two for 80% of the clock, three for 60%). Late, the run still pays and nothing is lost. More dungeons
            join the list every other stone, and a new set of affixes comes every week from +2.
          </p>
        </section>
        <section>
          <h3>What each stone gives</h3>
          {young && (
            <p className="rb-dim">
              Until level {FORGED_LEVEL} the Rift meets you at your own level, gives a younger hero a longer clock, and gives levels and ordinary gear. What follows is for a level-{FORGED_LEVEL} hero.
            </p>
          )}
          <ul className="rb-rift-rows">
            {rows.map((r) => (
              <li key={r.stone} className={hero.keystone >= r.stone ? 'is-open' : ''}>
                <b>+{r.stone}</b>
                <span>
                  Item level {r.il} · a cache of {r.cache} · {r.marks} Sigil Marks <span className="rb-dim">({r.late} late)</span>
                </span>
                {r.opens.map((o) => (
                  <em key={o}>{o}</em>
                ))}
              </li>
            ))}
          </ul>
          <p>
            Every new stone you open also gives one <b>Rift-forged</b> piece you don’t have yet, up to three a run.
          </p>
        </section>
        {/* (a set for the class and one for each specialization, six pieces each: the owner, 2026-11-22) */}
        {sets.map((set) => (
          <section key={set.id}>
            <h3>
              <span className="rb-set">{set.name}</span> <span className="rb-dim">({set.spec === undefined ? `the ${cls.name}’s set, any specialization` : `${cls.trees[set.spec]?.name}’s set`})</span>
            </h3>
            {set.bonuses.map((b) => (
              <p key={b.need}>
                <b className="rb-set">({b.need})</b> {b.text}
              </p>
            ))}
          </section>
        ))}
        {legendaries.length > 0 && (
          <section>
            <h3>Legendaries: a power for all your play</h3>
            {legendaries.map((d) => (
              <p key={d.id}>
                <b className="rb-legendary">{d.name}</b> <span className="rb-dim">({d.cls ? cls.name : 'any class'})</span>: {modLines(d.mods).join(' ')}
              </p>
            ))}
          </section>
        )}
        <section>
          <h3>Sigil Marks and the Riftbroker</h3>
          <p>
            The Riftbroker in the Riftward takes wagers: {WAGER_PRICE} Sigil Marks on a slot, and one piece for that slot comes back at your highest stone’s item level, a set piece or a legendary more often than not. A higher stone makes
            both likelier.
          </p>
        </section>
      </div>
    </details>
  );
}
