import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import type { Character } from '../progress/character';
import { wornTitle } from '../progress/titles';

/**
 * In The Ring and The Vigil, a player with a campaign hero of the class they bring can fight in that hero's looks
 * (their gear and their Wardrobe) and under that hero's title. Which hero, or none, is kept per class in this browser;
 * the first hero of the class is worn until the player says otherwise.
 */

const STORE = 'rb-wear';
/** Fighting in plain clothes. */
export const PLAIN = 'plain';

const readChoices = (): Record<string, string> => {
  try {
    return (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, string>) ?? {};
  } catch {
    return {};
  }
};

export function setWear(cls: ClassId, choice: string): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...readChoices(), [cls]: choice }));
  } catch {
    /* (a private window: it lasts the visit) */
  }
}

/** The campaign heroes of a class. */
export const wearable = (engine: SigilEngine, cls: ClassId): Character[] => engine.heroes().filter((h): h is Character => !!h && h.cls === cls);

const keyOf = (h: Character): string => String(h.created);

/** The hero whose looks and title are worn for a class (null: plain). */
export function wearOf(engine: SigilEngine, cls: ClassId): Character | null {
  const list = wearable(engine, cls);
  const want = readChoices()[cls];
  if (want === PLAIN) return null;
  return list.find((h) => keyOf(h) === want) ?? list[0] ?? null;
}

/** A wearer's title, if they've earned one. */
export const wearTitle = (h: Character | null, rating?: number): string | null => (h ? wornTitle(h, rating) : null);

/** The choice, beside the class: which hero's looks to fight in. Shown only when there's a hero of the class. */
export function WearPicker({ engine, cls, onChange }: { engine: SigilEngine; cls: ClassId; onChange: () => void }) {
  const list = wearable(engine, cls);
  if (!list.length) return null;
  const now = wearOf(engine, cls);
  return (
    <label className="rb-wear">
      <span>Looks</span>
      <select
        value={now ? keyOf(now) : PLAIN}
        onChange={(e) => {
          setWear(cls, e.target.value);
          onChange();
        }}
      >
        {list.map((h) => (
          <option key={keyOf(h)} value={keyOf(h)}>
            {h.name}’s Wardrobe{wornTitle(h) ? `, ${wornTitle(h)}` : ''}
          </option>
        ))}
        <option value={PLAIN}>Plain</option>
      </select>
    </label>
  );
}
