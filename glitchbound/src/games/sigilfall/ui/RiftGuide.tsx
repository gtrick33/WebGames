import { CLASSES } from '../data/classes';
import { KEY_DEATH } from '../data/keystones';
import { RIFT_ITEMS, SETS } from '../data/riftgear';
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
  const set = Object.values(SETS).find((s) => s.cls === hero.cls);
  const uniques = RIFT_ITEMS.filter((d) => d.cls === hero.cls && d.forSpec !== undefined);
  const rows = stoneRows(hero.cls, campaignDone(hero));
  const young = hero.level < FORGED_LEVEL;
  return (
    <details className="rb-rift-guide" open={open}>
      <summary>How the Rift works</summary>
      <div className="rb-rift-guide-body">
        <section>
          <h3>Where to go</h3>
          <p>
            Open the map at any waystone, pick a dungeon and choose <b>Riftstone</b>. From the title screen, <b>The Rift Trials</b> does the same with no road to walk first. With friends, start it from <b>Play together</b>.
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
        {set && (
          <section>
            <h3>
              The {cls.name}’s set: {set.name}
            </h3>
            {set.bonuses.map((b) => (
              <p key={b.need}>
                <b className="rb-gold">({b.need})</b> {b.text}
              </p>
            ))}
          </section>
        )}
        {uniques.length > 0 && (
          <section>
            <h3>One for each specialization (from +{uniques[0]!.rift})</h3>
            {uniques.map((d) => (
              <p key={d.id}>
                <b className="rb-gold">{d.name}</b> <span className="rb-dim">({cls.trees[d.forSpec!]?.name})</span>: {modLines(d.mods).join(' ')}
              </p>
            ))}
          </section>
        )}
        <section>
          <h3>Sigil Marks and the Riftbroker</h3>
          <p>
            The Sigil Quartermaster in any town takes wagers: {WAGER_PRICE} Sigil Marks on a slot, and one piece for that slot comes back at your highest stone’s item level. It may be Rift-forged. A higher stone makes a legendary
            likelier.
          </p>
        </section>
      </div>
    </details>
  );
}
