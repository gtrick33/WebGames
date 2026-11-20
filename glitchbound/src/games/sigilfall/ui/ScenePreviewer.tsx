import { useId, useState } from 'react';
import { SCENES } from '../data/scenes';
import { REGIONS } from '../data/regions';
import type { SigilEngine } from '../engine';
import type { SceneStep } from '../sim/scene';

/** A step of a scene in a few words, for the previewer's scrubber. */
export function stepLabel(step: SceneStep | undefined): string {
  if (!step) return '';
  if ('say' in step) return `${step.say}: “${step.line.length > 60 ? `${step.line.slice(0, 57)}…` : step.line}”`;
  if ('look' in step) return `camera to ${step.look}${step.jump ? ' (cut)' : ''}`;
  if ('ghost' in step) return `a memory of ${step.as}`;
  if ('fx' in step) return `${step.fx} at ${step.at}`;
  if ('at' in step) return 'camera to a spot';
  if ('follow' in step) return `camera follows ${step.follow}`;
  if ('cut' in step) return 'cut';
  if ('move' in step) return `${step.move} walks to ${step.to}${step.run ? ' (running)' : ''}`;
  if ('face' in step) return `${step.face} turns to ${step.to}`;
  if ('act' in step) return `${step.act}: ${step.does}${step.hold ? ' (held)' : ''}`;
  if ('zoom' in step) return `zoom ${step.zoom}`;
  if ('emote' in step) return `${step.emote}: ${step.icon}`;
  if ('sfx' in step) return `sound ${step.sfx}`;
  if ('shake' in step) return 'the screen shakes';
  if ('title' in step) return `title “${step.title}”`;
  if ('wait' in step) return `wait ${step.wait}s`;
  if ('fade' in step) return `fade ${step.fade}`;
  if ('vision' in step) return step.vision ? `vision: ${step.vision}` : 'vision ends';
  if ('music' in step) return `music ${step.music}`;
  return '';
}

/**
 * The scene previewer (POLISH_PLAN.md piece 12), with the review tools only: any scene of the story, from any of its
 * steps, in its own land. For staging a scene and seeing it again without playing the story up to it.
 */
export function ScenePreviewer({ engine }: { engine: SigilEngine }) {
  const [id, setId] = useState(SCENES[0]?.id ?? '');
  const [from, setFrom] = useState(0);
  const [note, setNote] = useState('');
  const pick = useId();
  const scrub = useId();
  const def = SCENES.find((d) => d.id === id);
  const last = Math.max(0, (def?.steps.length ?? 1) - 1);
  return (
    <section className="rb-scenes-preview">
      <span className="rb-kicker">Scene previewer</span>
      <span className="rb-small rb-dim">Plays a scene from any step, in its land. The steps before it are run through at once.</span>
      <label htmlFor={pick} className="rb-small">
        Scene
      </label>
      <select
        id={pick}
        value={id}
        onChange={(e) => {
          setId(e.target.value);
          setFrom(0);
          setNote('');
        }}
      >
        {SCENES.map((d) => (
          <option key={d.id} value={d.id}>
            {REGIONS[d.region]?.name ?? d.region} · {d.id} ({d.steps.length} steps)
          </option>
        ))}
      </select>
      <label htmlFor={scrub} className="rb-small">
        From step {from + 1} of {last + 1}: {stepLabel(def?.steps[from])}
      </label>
      <input id={scrub} type="range" min={0} max={last} value={Math.min(from, last)} onChange={(e) => setFrom(Number(e.target.value))} />
      <button className="rb-btn is-small" onClick={() => setNote(engine.previewScene(id, from) ? '' : 'That step is past the end of the scene, or its land could not be reached.')}>
        Play from here
      </button>
      {note && <span className="rb-small rb-dim">{note}</span>}
    </section>
  );
}
