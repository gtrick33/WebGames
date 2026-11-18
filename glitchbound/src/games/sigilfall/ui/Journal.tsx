import { ACTS } from '../data/acts';
import { SIGIL_LORE, SIGIL_ORDER, TALES } from '../data/chronicle';
import { QUESTS } from '../data/quests';
import type { SigilEngine } from '../engine';
import { questState, sigilCount } from '../progress/character';
import type { CSSProperties } from 'react';
import { FindKindIcon } from './StoryPages';

/**
 * The Journal (a page of the Quests panel): where the tale stands, told as the narrator told it at each act; the crown
 * of seven, each sigil won opening its Rite again; and every letter, order and relic the hero has kept, to be read
 * again. The owner: "make the whole game as one unified experience where you know what the story is, what you're
 * doing and how".
 */
export function Journal({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const acts = ACTS.filter((a) => TALES[a.id] && h.opened.includes(`act:${a.id}`));
  const won = new Set(h.perks);
  const n = sigilCount(h);
  // (a thing is kept once it was found; a quest finished before keepsakes were written down still gave it)
  const kept = QUESTS.filter((q) => q.find && (h.opened.includes(`kept:${q.id}`) || questState(h, q.id) === 'done')).reverse();
  return (
    <div className="rb-journal">
      <section>
        <span className="rb-kicker">The Crown of Starlight · {n} of 7 sigils</span>
        <div className="rb-journal-crown">
          {SIGIL_ORDER.map((id) => {
            const lore = SIGIL_LORE[id];
            const has = won.has(id);
            return has ? (
              <button key={id} className="rb-journal-sigil is-won" onClick={() => engine.reread({ kind: 'sigil', sigil: id })} aria-label={`${lore.name}: read again`}>
                <i className="rb-crown-gem is-won" style={{ '--gem': lore.color } as CSSProperties} />
                {lore.name.replace(/^The /, '')}
              </button>
            ) : (
              <span key={id} className="rb-journal-sigil">
                <i className="rb-crown-gem" />
                Not yet found
              </span>
            );
          })}
        </div>
      </section>
      {acts.length > 0 && (
        <section>
          <span className="rb-kicker">The tale so far</span>
          {acts.map((a, i) => {
            const t = TALES[a.id]!;
            return (
              <details key={a.id} className="rb-journal-tale" open={i === acts.length - 1}>
                <summary>
                  <b>{t.over}</b> · {t.title}
                </summary>
                {t.told.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </details>
            );
          })}
        </section>
      )}
      <section>
        <span className="rb-kicker">Kept · {kept.length}</span>
        {kept.length === 0 ? (
          <p className="rb-small rb-dim">Letters, orders and relics you find on your quests are kept here.</p>
        ) : (
          <ul className="rb-journal-keeps">
            {kept.map((q) => (
              <li key={q.id}>
                <button className="rb-journal-keep" onClick={() => engine.reread({ kind: 'find', quest: q.id })}>
                  <FindKindIcon kind={q.find!.kind} />
                  <span>
                    <b>{q.find!.name}</b>
                    <small>{q.name}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
