import { HAIRS, SKINS, type Face } from '../progress/character';
import { heroTitle } from '../progress/wardrobe';
import { RiftScreen } from './RiftScreen';
import { useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { CLASS_IDS, CLASSES } from '../data/classes';
import { REGIONS } from '../data/regions';
import { SKILLS } from '../data/skills';
import { SPEC_LEVEL } from '../data/talents';
import type { ClassId, RegionId } from '../data/types';
import type { SigilEngine } from '../engine';
import { cleanName, type Body } from '../progress/character';
import { heroDollUrl, heroLook } from '../render/sprites';
import { wornLooks } from '../progress/wardrobe';
import { Portrait, SkillIcon } from './common';
import { SettingsPanel } from './Panels';

/** Embers rising from the Rift on the title screen: spread across, each on its own clock. */
const EMBERS = Array.from({ length: 18 }, (_, i) => ({ x: (i * 53) % 100, delay: (i % 6) * 0.9, dur: 6 + (i % 5) * 1.7, size: 2 + (i % 3) }));

/**
 * The world behind the title: a night sky with an aurora and a moon, three ranges of mountains, a castle
 * on the far crag, fog in the valley and embers rising from the Rift. All CSS and one small drawing: it
 * paints at once, scales with the stage, and holds still for players who ask for less motion.
 */
function EpicSky() {
  return (
    <div className="rb-epic-sky" aria-hidden="true">
      <i className="rb-epic-stars" />
      <i className="rb-epic-stars is-far" />
      <i className="rb-epic-aurora" />
      <i className="rb-epic-moon" />
      <svg className="rb-epic-land" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
        <path className="rb-range-3" d="M0 250 L90 190 L170 230 L260 160 L340 215 L430 150 L520 210 L600 170 L690 225 L780 140 L870 205 L935 168 L950 158 L1066 158 L1130 186 L1200 200 L1200 400 L0 400 Z" />
        {/* the castle on the far crag, right of the name and the line under it at every width: keep, towers, banners */}
        <g className="rb-castle" transform="translate(150 0)">
          <path d="M800 160 L812 150 L812 98 L806 98 L806 86 L830 86 L830 98 L824 98 L824 150 L846 150 L846 112 L840 112 L840 100 L866 100 L866 112 L860 112 L860 150 L882 150 L882 92 L876 92 L876 78 L889 64 L902 78 L902 92 L896 92 L896 150 L912 160 Z" />
          <path className="rb-banner" d="M889 64 L889 44 L904 50 L889 56" />
          <rect className="rb-window" x="886" y="104" width="6" height="10" />
          <rect className="rb-window" x="850" y="122" width="5" height="8" />
          <rect className="rb-window" x="815" y="112" width="5" height="8" />
        </g>
        <path className="rb-range-2" d="M0 300 L120 230 L210 280 L330 215 L440 285 L560 240 L650 290 L760 245 L880 300 L990 235 L1100 285 L1200 250 L1200 400 L0 400 Z" />
        <path className="rb-range-1" d="M0 350 L150 300 L260 340 L380 290 L520 345 L640 310 L760 350 L900 300 L1030 345 L1200 305 L1200 400 L0 400 Z" />
      </svg>
      <i className="rb-epic-fog" />
      <i className="rb-epic-fog is-low" />
      {EMBERS.map((e, i) => (
        <i key={i} className="rb-epic-ember" style={{ ['--x' as string]: `${e.x}%`, ['--d' as string]: `${e.delay}s`, ['--t' as string]: `${e.dur}s`, ['--s' as string]: `${e.size}px` }} />
      ))}
    </div>
  );
}

/** The sigil behind the name: three rune rings drawing themselves, then turning slowly. */
function Sigil() {
  return (
    <svg className="rb-sigil" viewBox="0 0 200 200" aria-hidden="true">
      <circle className="rb-sigil-ring" cx="100" cy="100" r="92" />
      <circle className="rb-sigil-runes" cx="100" cy="100" r="80" />
      <circle className="rb-sigil-ring is-inner" cx="100" cy="100" r="62" />
      <path className="rb-sigil-star" d="M100 22 L146 163 L26 76 L174 76 L54 163 Z" />
      <circle className="rb-sigil-core" cx="100" cy="100" r="10" />
    </svg>
  );
}

/**
 * The title screen, as a doorway: first the gate (the world, the crest, and one gold button: begin a
 * legend, or carry on with the last hero), then the roster of heroes (three slots) to pick another, make
 * one or let one go. A friend's invite opens straight on the roster.
 */
export function TitleScreen({ engine }: { engine: SigilEngine }) {
  const heroes = engine.heroes();
  const [settings, setSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [roster, setRoster] = useState(() => !!engine.invite);
  const [rift, setRift] = useState<number | null>(null);
  const last = engine.save.last;
  const lastHero = heroes[last];
  const any = heroes.some(Boolean);
  const firstEmpty = Math.max(0, heroes.findIndex((h) => !h));
  if (rift !== null && heroes[rift]) {
    return (
      <div className="rb-title is-epic is-roster">
        <EpicSky />
        <RiftScreen engine={engine} slot={rift} onBack={() => setRift(null)} />
      </div>
    );
  }
  return (
    <div className={`rb-title is-epic${roster ? ' is-roster' : ''}`}>
      <EpicSky />
      <div className="rb-title-top">
        <button className="rb-iconbtn" onClick={() => setSettings(true)} aria-label="Settings">
          ⚙
        </button>
        <GameMenuButton className="rb-iconbtn" />
      </div>
      {!roster ? (
        <div className="rb-gate">
          <div className="rb-crest">
            <Sigil />
            <span className="rb-logo-kicker">A GlitchBound adventure</span>
            <h1 className="rb-logo-word" data-text="Sigilfall">
              Sigilfall
            </h1>
            <p className="rb-logo-tag">The bell stopped ringing three weeks ago. Tonight, they come for what sleeps under the chapel.</p>
          </div>
          <div className="rb-gate-actions">
            {lastHero ? (
              <button className="rb-btn is-gold is-big rb-gate-go" onClick={() => engine.play(last)} autoFocus>
                <span>Continue as {lastHero.name}</span>
                <small>
                  Level {lastHero.level} {CLASSES[lastHero.cls].name} · {farthest(lastHero.unlocked).name}
                </small>
              </button>
            ) : any ? (
              <button className="rb-btn is-gold is-big rb-gate-go" onClick={() => setRoster(true)} autoFocus>
                <span>Choose your hero</span>
              </button>
            ) : (
              <button className="rb-btn is-gold is-big rb-gate-go" onClick={() => engine.newHeroScreen(firstEmpty)} autoFocus>
                <span>Begin your legend</span>
                <small>Seven heroes · five acts · one Rift</small>
              </button>
            )}
            {lastHero && lastHero.keystone >= 1 && (
              <button className="rb-btn rb-gate-rift" onClick={() => setRift(last)}>
                <span>The Rift Trials</span>
                <small>Riftstone +{lastHero.keystone}</small>
              </button>
            )}
            {lastHero && (
              <button className="rb-btn is-ghost rb-gate-more" onClick={() => setRoster(true)}>
                Your heroes
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rb-roster">
          <div className="rb-roster-head">
            <button className="rb-btn is-small is-ghost" onClick={() => setRoster(false)}>
              ← Back
            </button>
            <h1>Your heroes</h1>
          </div>
          <div className="rb-slots" aria-label="Your heroes">
            {heroes.map((h, i) =>
              h ? (
                <div key={i} className={`rb-slot${i === last ? ' is-last' : ''}`}>
                  <Portrait kind="hero" id={h.cls} equip={h.equip} worn={wornLooks(h)} body={h.body} face={h.face} size={52} />
                  <div className="rb-slot-text">
                    <strong>{h.name}</strong>
                    <span>
                      Level {h.level} {CLASSES[h.cls].name}
                    </span>
                    <span className="rb-dim">{heroTitle(h) ?? farthest(h.unlocked).name}</span>
                  </div>
                  <div className="rb-slot-actions">
                    <button className="rb-btn is-small is-gold" onClick={() => engine.play(i)}>
                      Play
                    </button>
                    {h.keystone >= 1 && (
                      <button className="rb-btn is-small" onClick={() => setRift(i)}>
                        Rift
                      </button>
                    )}
                    {confirmDelete === i ? (
                      <button
                        className="rb-btn is-small is-danger"
                        onClick={() => {
                          engine.deleteHero(i);
                          setConfirmDelete(null);
                        }}
                      >
                        Delete for good?
                      </button>
                    ) : (
                      <button className="rb-btn is-small is-ghost" onClick={() => setConfirmDelete(i)} aria-label={`Delete ${h.name}`}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button key={i} className="rb-slot is-empty" onClick={() => engine.newHeroScreen(i)}>
                  <span className="rb-plus">+</span>
                  <span>New hero</span>
                </button>
              ),
            )}
          </div>
        </div>
      )}
      {engine.ui.notice && <p className="rb-notice" role="status">{engine.ui.notice}</p>}
      {engine.party && !engine.invite && <p className="rb-notice" role="status">You’re still in party {engine.party.link.code}. Choose a hero to go back to it.</p>}
      {engine.invite && (
        <p className="rb-notice is-invite" role="status">
          A friend invited you to their party (code {engine.invite}). Choose a hero, or make one, to join them.
        </p>
      )}
      {settings && (
        <div className="rb-modal">
          <SettingsPanel engine={engine} onClose={() => setSettings(false)} />
        </div>
      )}
    </div>
  );
}

const DIFFICULTY = ['', 'Easy to learn', 'Some practice', 'Takes skill'];

/** How far a hero has come: the highest-level land they have been to. */
const farthest = (unlocked: RegionId[]) => unlocked.map((id) => REGIONS[id]).reduce((a, b) => (b.levels[1] > a.levels[1] ? b : a), REGIONS.emberwick);

/** Choosing a class and a name. */
export function CreateScreen({ engine }: { engine: SigilEngine }) {
  const [cls, setCls] = useState<ClassId>('mage');
  const [body, setBody] = useState<Body>('m');
  const [face, setFace] = useState<Face>({ skin: 1, hair: 1, style: 'short', beard: false });
  const pick = (next: Partial<Face>): void => setFace({ ...face, ...next });
  const [name, setName] = useState(() => cleanName(engine.defaultName));
  const def = CLASSES[cls];
  return (
    <div className="rb-create">
      <div className="rb-create-head">
        <button className="rb-btn is-small is-ghost" onClick={() => engine.toTitle()}>
          ← Back
        </button>
        <h1>Choose your hero</h1>
        <GameMenuButton className="rb-iconbtn" />
      </div>
      <div className="rb-classes" role="radiogroup" aria-label="Class">
        {CLASS_IDS.map((id) => {
          const c = CLASSES[id];
          return (
            <button key={id} role="radio" aria-checked={cls === id} className={`rb-class${cls === id ? ' is-on' : ''}`} style={{ ['--cc' as string]: c.colors.main }} onClick={() => setCls(id)}>
              <img className="rb-class-doll" src={heroDollUrl(heroLook(id, {}, {}, body, face), 'down', 2)} alt="" draggable={false} />
              <strong>{c.name}</strong>
              <span className="rb-dim">{c.role}</span>
              <span className="rb-dots" aria-label={DIFFICULTY[c.difficulty]}>
                {[1, 2, 3].map((n) => (
                  <i key={n} className={n <= c.difficulty ? 'is-on' : ''} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="rb-create-detail">
        <div className="rb-looks" aria-label="Your hero’s look">
          <div className="rb-swatches" role="radiogroup" aria-label="Skin">
            <span>Skin</span>
            {SKINS.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={face.skin === i} aria-label={`Skin ${i + 1}`} className={face.skin === i ? 'is-on' : ''} style={{ background: c }} onClick={() => pick({ skin: i })} />
            ))}
          </div>
          <div className="rb-swatches" role="radiogroup" aria-label="Hair color">
            <span>Hair</span>
            {HAIRS.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={face.hair === i} aria-label={`Hair color ${i + 1}`} className={face.hair === i ? 'is-on' : ''} style={{ background: c }} onClick={() => pick({ hair: i })} />
            ))}
          </div>
          <div className="rb-seg" role="radiogroup" aria-label="Hair style">
            {(['short', 'pony', 'long'] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={face.style === s} className={face.style === s ? 'is-on' : ''} onClick={() => pick({ style: s })}>
                {s === 'pony' ? 'Tied back' : s === 'long' ? 'Long' : 'Short'}
              </button>
            ))}
            {body === 'm' && (
              <button type="button" aria-pressed={face.beard} className={face.beard ? 'is-on' : ''} onClick={() => pick({ beard: !face.beard })}>
                Beard
              </button>
            )}
          </div>
        </div>
        <p>{def.blurb}</p>
        <div className="rb-create-skills">
          {[def.basic, ...def.skills, def.ult].map((id) => (
            <span key={id} className="rb-chip" title={SKILLS[id]!.blurb}>
              <SkillIcon id={id} size={24} />
              {SKILLS[id]!.name}
            </span>
          ))}
        </div>
        <p className="rb-dim">
          At level {SPEC_LEVEL} you choose a specialization:{' '}
          {def.trees.map((t, i) => (
            <span key={t.name}>
              {i > 0 && (i === def.trees.length - 1 ? ' or ' : ', ')}
              <b style={{ color: t.color }}>{t.name}</b> ({t.blurb.replace(/\.$/, '').toLowerCase()})
            </span>
          ))}
        </p>
        <form
          className="rb-create-go"
          onSubmit={(e) => {
            e.preventDefault();
            engine.createHero(engine.ui.createSlot, cls, cleanName(name), body, face);
          }}
        >
          <div className="rb-seg rb-body" role="radiogroup" aria-label="Hero">
            {(['m', 'f'] as const).map((b) => (
              <button key={b} type="button" role="radio" aria-checked={body === b} className={body === b ? 'is-on' : ''} onClick={() => setBody(b)}>
                {b === 'm' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>
          <label>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} maxLength={16} placeholder={def.name} autoComplete="off" spellCheck={false} />
          </label>
          <button className="rb-btn is-gold is-big" type="submit">
            Begin as {def.name}
          </button>
        </form>
      </div>
    </div>
  );
}
