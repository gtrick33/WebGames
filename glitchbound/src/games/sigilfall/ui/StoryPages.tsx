import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ordinalOfSeven, SIGIL_LORE, SIGIL_ORDER, TALES } from '../data/chronicle';
import { QUEST_DEFS } from '../data/quests';
import type { Keepsake, SigilId } from '../data/types';
import type { SigilEngine, StoryPage } from '../engine';
import { currentObjective, SIGIL_BONUS, sigilCount, trackedQuest, type Character } from '../progress/character';
import { isMainQuest } from '../progress/handin';
import { questRewards } from '../progress/rewards';
import { rarityColor } from '../render/renderer';

/**
 * The story's pages over the world (engine.ts StoryPage): the narrator's telling as an act begins, a letter or a relic
 * the hero has found (its words as they are written), the Sigil Rite, and what a quest came to. Each waits to be put
 * down: the world stands still behind it.
 */
export function StoryPages({ engine }: { engine: SigilEngine }) {
  const page = engine.ui.story;
  const h = engine.hero;
  if (!page || !h) return null;
  const close = (): void => engine.closeStory();
  const again = engine.rereading;
  switch (page.kind) {
    case 'tale':
      return <TaleView act={page.act} onClose={close} />;
    case 'find': {
      const q = QUEST_DEFS[page.quest];
      return q?.find ? <FindView find={q.find} quest={q.name} onClose={close} again={again} /> : null;
    }
    case 'sigil':
      return <SigilRite hero={h} sigil={page.sigil} onClose={close} again={again} />;
    case 'deed':
      return <DeedView engine={engine} hero={h} page={page} onClose={close} />;
  }
}

/** The narrator, between the acts: the tale so far, and what the hero sets out to do. */
function TaleView({ act, onClose }: { act: string; onClose: () => void }) {
  const t = TALES[act];
  if (!t) return null;
  return (
    <div className="rb-story is-tale" role="dialog" aria-modal="true" aria-label={`${t.over}: ${t.title}`}>
      <div className="rb-tale">
        <span className="rb-tale-over">{t.over}</span>
        <h2 className="rb-tale-title">{t.title}</h2>
        <i className="rb-tale-rule" />
        <div className="rb-tale-told">
          {t.told.map((p, i) => (
            <p key={i} style={{ '--i': i } as CSSProperties}>
              {p}
            </p>
          ))}
        </div>
        <p className="rb-tale-now" style={{ '--i': t.told.length } as CSSProperties}>
          <b>Now</b> {t.now}
        </p>
        <button className="rb-btn is-gold rb-tale-go" onClick={onClose} autoFocus>
          Continue
        </button>
      </div>
    </div>
  );
}

const KIND_WORD: Record<Keepsake['kind'], string> = {
  letter: 'A letter',
  note: 'A note',
  orders: 'Written orders',
  page: 'A page',
  map: 'A map',
  relic: 'A relic',
  token: 'A keepsake',
};

/** A thing found: what it is, and the words on it as they are written. */
export function FindView({ find, quest, onClose, again }: { find: Keepsake; quest: string; onClose: () => void; again?: boolean }) {
  const written = !!find.body?.length;
  return (
    <div className="rb-story is-find" role="dialog" aria-modal="true" aria-label={`Found: ${find.name}`}>
      <div className={`rb-find${written ? ' is-written' : ''}`}>
        <div className="rb-find-head">
          <FindKindIcon kind={find.kind} />
          <div>
            <span className="rb-find-kind">{again ? KIND_WORD[find.kind] : `${KIND_WORD[find.kind]} found`}</span>
            <h2>{find.name}</h2>
            <span className="rb-find-quest">{quest}</span>
          </div>
        </div>
        <p className="rb-find-about">{find.about}</p>
        {written && (
          <div className={`rb-find-paper is-${find.kind}`}>
            {find.body!.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {find.sign && <p className="rb-find-sign">{find.sign}</p>}
          </div>
        )}
        <div className="rb-find-foot">
          {!again && <span className="rb-small rb-dim">Kept in your Journal (J).</span>}
          <button className="rb-btn is-gold" onClick={onClose} autoFocus>
            {again ? 'Close' : 'Keep it'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** What a quest done out in the world came to, as WoW's quest window shows it: the ending, what it paid, what's next. */
function DeedView({ engine, hero, page, onClose }: { engine: SigilEngine; hero: Character; page: Extract<StoryPage, { kind: 'deed' }>; onClose: () => void }) {
  const q = QUEST_DEFS[page.quest];
  if (!q?.reward.text) return null;
  const main = isMainQuest(q.id);
  const rewards = questRewards(hero, q);
  const next = trackedQuest(hero, engine.world?.region.id);
  const nextLine = next && next.id !== q.id && isMainQuest(next.id) ? `${next.name}: ${currentObjective(hero, next).label}` : null;
  return (
    <div className="rb-story is-deed" role="dialog" aria-modal="true" aria-label={`${q.name}: complete`}>
      <div className={`rb-deed${main ? ' is-main' : ''}`}>
        <span className="rb-deed-kind">{main ? 'Story' : 'Quest'} complete</span>
        <h2>{q.name}</h2>
        <p className="rb-deed-text">{q.reward.text}</p>
        {rewards.length > 0 && (
          <div className="rb-qpage-rewards">
            {rewards.map((r, i) => (
              <span key={i} className={`rb-qreward is-${r.kind}`} style={r.rarity ? ({ '--rc': rarityColor(r.rarity) } as CSSProperties) : undefined}>
                {r.text}
              </span>
            ))}
          </div>
        )}
        {nextLine && (
          <p className="rb-deed-next">
            <b>Next</b> {nextLine}
          </p>
        )}
        <button className="rb-btn is-gold" onClick={onClose} autoFocus>
          Continue
        </button>
      </div>
    </div>
  );
}

/**
 * The Sigil Rite: a sigil of the Starlight Crown won. The screen goes dark, the sigil rises in its own light, the
 * crown of seven shows how many are held, and the page says where it lay, what it gives and what it took from Elyra.
 * The way on comes up only once the moment has landed.
 */
export function SigilRite({ hero, sigil, onClose, again }: { hero: Character; sigil: SigilId; onClose: () => void; again?: boolean }) {
  const lore = SIGIL_LORE[sigil];
  const [ready, setReady] = useState(!!again);
  useEffect(() => {
    if (again) return;
    const t = setTimeout(() => setReady(true), 2200);
    return () => clearTimeout(t);
  }, [again]);
  const won = new Set(hero.perks);
  const n = Math.max(1, sigilCount(hero));
  return (
    <div className={`rb-story is-rite${again ? ' is-again' : ''}`} role="dialog" aria-modal="true" aria-label={`${lore.name}: ${ordinalOfSeven(n)}`} style={{ '--sigil': lore.color } as CSSProperties}>
      <div className="rb-rite-rays" aria-hidden="true" />
      <div className="rb-rite">
        <span className="rb-rite-over">{again ? 'A sigil of the Starlight Crown' : 'A sigil of the Starlight Crown is won'}</span>
        <div className="rb-rite-emblem" aria-hidden="true">
          <SigilEmblem sigil={sigil} />
        </div>
        <h2 className="rb-rite-name">{lore.name}</h2>
        <span className="rb-rite-count">{ordinalOfSeven(n)}</span>
        <ol className="rb-rite-crown" aria-label={`${n} of 7 sigils`}>
          {SIGIL_ORDER.map((id) => (
            <li key={id} className={`${won.has(id) ? 'is-won' : ''}${id === sigil ? ' is-new' : ''}`} style={{ '--gem': SIGIL_LORE[id].color } as CSSProperties} title={won.has(id) ? SIGIL_LORE[id].name : 'Not yet found'} />
          ))}
        </ol>
        <i className="rb-tale-rule" />
        <dl className="rb-rite-lines">
          <dt>Hidden</dt>
          <dd>
            In {lore.place}, by {lore.warden}.
          </dd>
          <dt>Its light</dt>
          <dd>
            Elyra binds it, and its light runs into you both: +{SIGIL_BONUS}% health and power (+{SIGIL_BONUS * n}% from {n === 1 ? 'one sigil' : `${n} sigils`}).
          </dd>
          <dt>Its memory</dt>
          <dd>{lore.vision}</dd>
          {lore.price && (
            <>
              <dt>Its price</dt>
              <dd>Every sigil takes a memory from the one who binds it. Elyra has lost {lowerFirst(lore.price)}</dd>
            </>
          )}
        </dl>
        <p className="rb-rite-verse">“{lore.verse}”</p>
        <button className={`rb-btn is-gold rb-rite-go${ready ? ' is-ready' : ''}`} onClick={onClose} disabled={!ready} autoFocus={ready}>
          {again ? 'Close' : n >= 7 ? 'All seven' : `${7 - n} still to find`}
        </button>
      </div>
    </div>
  );
}

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** The pictures of the things found, drawn plain. */
export function FindKindIcon({ kind }: { kind: Keepsake['kind'] }): ReactNode {
  const body: Record<Keepsake['kind'], ReactNode> = {
    letter: (
      <>
        <rect x="6" y="12" width="36" height="25" rx="2" fill="#e8dcc0" stroke="#5a4630" strokeWidth="2" />
        <path d="M7 13 L24 27 L41 13" fill="none" stroke="#5a4630" strokeWidth="2" />
        <circle cx="24" cy="27" r="5" fill="#9a2a2a" stroke="#5a1a1a" strokeWidth="1.5" />
      </>
    ),
    note: (
      <>
        <path d="M10 8 H34 L40 14 V40 H10 Z" fill="#e8dcc0" stroke="#5a4630" strokeWidth="2" />
        <path d="M15 18 H35 M15 24 H35 M15 30 H28" stroke="#8a7458" strokeWidth="2" />
      </>
    ),
    orders: (
      <>
        <rect x="11" y="9" width="26" height="30" fill="#e0d2b0" stroke="#5a4630" strokeWidth="2" />
        <rect x="7" y="6" width="34" height="6" rx="3" fill="#b89a6a" stroke="#5a4630" strokeWidth="2" />
        <rect x="7" y="36" width="34" height="6" rx="3" fill="#b89a6a" stroke="#5a4630" strokeWidth="2" />
        <path d="M16 18 H32 M16 23 H32 M16 28 H26" stroke="#7a6448" strokeWidth="2" />
      </>
    ),
    page: (
      <>
        <path d="M9 7 H38 V30 L34 33 L38 36 L33 41 H9 Z" fill="#e8dcc0" stroke="#5a4630" strokeWidth="2" />
        <path d="M14 15 H33 M14 21 H33 M14 27 H29" stroke="#8a7458" strokeWidth="2" />
      </>
    ),
    map: (
      <>
        <path d="M6 10 L17 7 L31 11 L42 8 V38 L31 41 L17 37 L6 40 Z" fill="#e0d0a8" stroke="#5a4630" strokeWidth="2" />
        <path d="M17 7 V37 M31 11 V41" stroke="#8a7458" strokeWidth="1.5" />
        <path d="M12 26 Q20 18 26 24 T37 19" fill="none" stroke="#9a2a2a" strokeWidth="2" strokeDasharray="3 2" />
        <circle cx="37" cy="19" r="2.5" fill="#9a2a2a" />
      </>
    ),
    relic: (
      <>
        <path d="M24 5 L30 18 L24 43 L18 18 Z" fill="#c8a8ff" stroke="#3a2a5a" strokeWidth="2" />
        <path d="M18 18 H30" stroke="#3a2a5a" strokeWidth="1.5" />
        <circle cx="24" cy="18" r="13" fill="none" stroke="#e9c46a" strokeWidth="2" opacity="0.7" />
      </>
    ),
    token: (
      <>
        <circle cx="24" cy="24" r="16" fill="#b8b4c0" stroke="#4a4654" strokeWidth="2" />
        <circle cx="24" cy="24" r="11" fill="none" stroke="#6a6674" strokeWidth="1.5" />
        <path d="M17 26 L20 19 L24 24 L28 19 L31 26 Z" fill="#6a6674" />
      </>
    ),
  };
  return (
    <svg className="rb-find-icon" viewBox="0 0 48 48" aria-hidden="true">
      {body[kind]}
    </svg>
  );
}

/** A sigil's emblem: a star of the Crown, with its own sign at the heart. */
export function SigilEmblem({ sigil }: { sigil: SigilId }) {
  const c = SIGIL_LORE[sigil].color;
  const sign: Record<SigilId, ReactNode> = {
    'sigil-embers': <path d="M50 30 C58 40 62 46 60 55 C58 63 52 68 50 68 C48 68 42 63 40 55 C39 49 43 45 46 40 C47 46 50 47 52 45 C54 41 52 35 50 30 Z" />,
    'sigil-sun': (
      <>
        <circle cx="50" cy="50" r="10" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={50 + Math.cos(a) * 14} y1={50 + Math.sin(a) * 14} x2={50 + Math.cos(a) * 21} y2={50 + Math.sin(a) * 21} strokeWidth="3.5" stroke="currentColor" />;
        })}
      </>
    ),
    'sigil-thorns': <path d="M50 30 L50 70 M50 38 L42 32 M50 46 L58 40 M50 54 L41 49 M50 62 L59 57" strokeWidth="4" stroke="currentColor" fill="none" strokeLinecap="round" />,
    'sigil-frost': (
      <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
        {[0, 60, 120].map((d) => (
          <line key={d} x1="50" y1="31" x2="50" y2="69" transform={`rotate(${d} 50 50)`} />
        ))}
      </g>
    ),
    'sigil-veil': (
      <>
        <path d="M30 50 Q50 32 70 50 Q50 68 30 50 Z" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <circle cx="50" cy="50" r="6" />
      </>
    ),
    'sigil-tides': <path d="M31 44 Q37 38 43 44 T55 44 T67 44 M31 54 Q37 48 43 54 T55 54 T67 54" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />,
    'sigil-stone': <path d="M50 32 L66 41 L66 59 L50 68 L34 59 L34 41 Z" />,
  };
  const pts = Array.from({ length: 14 }, (_, i) => {
    const r = i % 2 ? 22 : 46;
    const a = (i * Math.PI) / 7 - Math.PI / 2;
    return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" style={{ color: '#1a1020' }}>
      <defs>
        <radialGradient id={`rite-${sigil}`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#fff8e8" />
          <stop offset="55%" stopColor={c} />
          <stop offset="100%" stopColor="#2a1a30" />
        </radialGradient>
      </defs>
      <polygon points={pts} fill={`url(#rite-${sigil})`} stroke="#fff4d8" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="23" fill="#fff8ec" opacity="0.92" />
      <g fill="currentColor">{sign[sigil]}</g>
    </svg>
  );
}
