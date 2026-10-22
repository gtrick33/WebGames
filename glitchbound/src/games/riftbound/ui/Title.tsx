import { useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { CLASS_IDS, CLASSES } from '../data/classes';
import { REGIONS } from '../data/regions';
import { SKILLS } from '../data/skills';
import type { ClassId } from '../data/types';
import type { RiftEngine } from '../engine';
import { cleanName } from '../progress/character';
import { Portrait, SkillIcon } from './common';
import { SettingsPanel } from './Panels';

/** The title screen: your heroes (three slots) and the way to make a new one. */
export function TitleScreen({ engine }: { engine: RiftEngine }) {
  const heroes = engine.heroes();
  const [settings, setSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const last = engine.save.last;
  const lastHero = heroes[last];
  return (
    <div className="rb-title">
      <div className="rb-title-top">
        <button className="rb-iconbtn" onClick={() => setSettings(true)} aria-label="Settings">
          ⚙
        </button>
        <GameMenuButton className="rb-iconbtn" />
      </div>
      <div className="rb-title-main">
        <div className="rb-logo">
          <span className="rb-logo-kicker">A GlitchBound adventure</span>
          <h1 className="rb-logo-word">Riftbound</h1>
          <p className="rb-logo-tag">Close the Rift. Find the gear that changes how you fight.</p>
          {lastHero && (
            <button className="rb-btn is-gold is-big" onClick={() => engine.play(last)} autoFocus>
              Continue as {lastHero.name}
            </button>
          )}
        </div>
        <div className="rb-slots" aria-label="Your heroes">
          {heroes.map((h, i) =>
            h ? (
              <div key={i} className="rb-slot">
                <Portrait kind="hero" id={h.cls} size={52} />
                <div className="rb-slot-text">
                  <strong>{h.name}</strong>
                  <span>
                    Level {h.level} {CLASSES[h.cls].name}
                  </span>
                  <span className="rb-dim">{h.unlocked.includes('crypt') ? REGIONS.crypt.name : h.unlocked.includes('whisperwood') ? REGIONS.whisperwood.name : REGIONS.emberwick.name}</span>
                </div>
                <div className="rb-slot-actions">
                  <button className="rb-btn is-small" onClick={() => engine.play(i)}>
                    Play
                  </button>
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
      {engine.ui.notice && <p className="rb-notice" role="status">{engine.ui.notice}</p>}
      {settings && (
        <div className="rb-modal">
          <SettingsPanel engine={engine} onClose={() => setSettings(false)} />
        </div>
      )}
    </div>
  );
}

const DIFFICULTY = ['', 'Easy to learn', 'Some practice', 'Takes skill'];

/** Choosing a class and a name. */
export function CreateScreen({ engine }: { engine: RiftEngine }) {
  const [cls, setCls] = useState<ClassId>('mage');
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
              <Portrait kind="hero" id={id} size={64} />
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
          Talent paths: <b style={{ color: def.trees[0].color }}>{def.trees[0].name}</b> ({def.trees[0].blurb.toLowerCase()}) or <b style={{ color: def.trees[1].color }}>{def.trees[1].name}</b> ({def.trees[1].blurb.toLowerCase()})
        </p>
        <form
          className="rb-create-go"
          onSubmit={(e) => {
            e.preventDefault();
            engine.createHero(engine.ui.createSlot, cls, cleanName(name));
          }}
        >
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
