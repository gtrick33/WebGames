/**
 * The campaign's keys (Settings › Keys): each action has the keys it answers to, the first of them the one shown on
 * the bar. A player can give any action a key of their own (Settings.keys, by the key's place on the keyboard: its
 * `code`); that key then belongs to that action alone. Movement (WASD and the arrows) and Escape stay as they are, so
 * nobody can lock themselves out of walking or out of the menu.
 */

export type CampAction = 's1' | 's2' | 's3' | 's4' | 'dodge' | 'ult' | 'potion' | 'interact' | 'mount' | 'hero' | 'skills' | 'talents' | 'quests' | 'map' | 'party' | 'pause';

/** The actions in the order Settings lists them, with their names. */
export const CAMP_ACTIONS: readonly { id: CampAction; name: string }[] = [
  { id: 's1', name: 'First skill' },
  { id: 's2', name: 'Second skill' },
  { id: 's3', name: 'Third skill' },
  { id: 's4', name: 'Fourth skill' },
  { id: 'ult', name: 'Ultimate' },
  { id: 'dodge', name: 'Dodge' },
  { id: 'potion', name: 'Potion' },
  { id: 'interact', name: 'Talk / travel' },
  { id: 'mount', name: 'Ride' },
  { id: 'hero', name: 'Hero & bag' },
  { id: 'skills', name: 'Skills' },
  { id: 'talents', name: 'Talents' },
  { id: 'quests', name: 'Quests' },
  { id: 'map', name: 'Map' },
  { id: 'party', name: 'Play together' },
  { id: 'pause', name: 'Pause' },
];

/** Keys that can't be given to an action: walking, and the way out of everything. */
export const RESERVED_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'Tab', 'MetaLeft', 'MetaRight']);

/** The keys each action answers to before the player changes any (the ultimate's and the fourth skill's as chosen). */
export function defaultBinds(ultKey: 'f' | 't' | 'shift' | 'rmb', skill4Key: 'c' | 'v' | 'z' | 'x'): Record<CampAction, string[]> {
  const ult = ultKey === 'f' ? ['KeyF'] : ultKey === 't' ? ['KeyT'] : ultKey === 'shift' ? ['ShiftLeft', 'ShiftRight'] : [];
  return {
    s1: ['KeyQ'],
    s2: ['KeyE'],
    s3: ['KeyR'],
    s4: [`Key${skill4Key.toUpperCase()}`],
    dodge: ['Space'],
    ult,
    potion: ['Digit1', 'KeyH'],
    // (F talks too, when the ultimate isn't on it)
    interact: ultKey === 'f' ? ['KeyG', 'Enter', 'NumpadEnter'] : ['KeyG', 'Enter', 'NumpadEnter', 'KeyF'],
    mount: ['KeyY'],
    hero: ['KeyI', 'KeyB', 'KeyC'],
    skills: ['KeyU'],
    talents: ['KeyK', 'KeyN'],
    quests: ['KeyJ', 'KeyL'],
    map: ['KeyM'],
    party: ['KeyO'],
    pause: ['Escape', 'KeyP'],
  };
}

/**
 * Each action's keys with the player's own: a key they chose is the action's key (in place of the ones it had) and is
 * taken from any other. The defaults are listed in the order above, so where two would share a key (C: the fourth skill, and the bag)
 * the one listed first keeps it, as it always has.
 */
export function resolveBinds(ultKey: 'f' | 't' | 'shift' | 'rmb', skill4Key: 'c' | 'v' | 'z' | 'x', own: Partial<Record<CampAction, string>>): Record<CampAction, string[]> {
  const out = defaultBinds(ultKey, skill4Key);
  const chosen = new Set(Object.values(own).filter((c): c is string => !!c && !RESERVED_CODES.has(c)));
  for (const a of Object.keys(out) as CampAction[]) out[a] = out[a].filter((c) => !chosen.has(c));
  // (a key chosen for an action replaces the ones it had: Escape still pauses whatever Pause is on)
  for (const [a, code] of Object.entries(own) as [CampAction, string | undefined][]) if (code && !RESERVED_CODES.has(code) && out[a]) out[a] = a === 'pause' ? [code, 'Escape'] : [code];
  return out;
}

/** Which action a key is for (the first that lists it), with every action's keys resolved. */
export function codeMap(binds: Record<CampAction, string[]>): Map<string, CampAction> {
  const m = new Map<string, CampAction>();
  for (const { id } of CAMP_ACTIONS) for (const c of binds[id]) if (!m.has(c)) m.set(c, id);
  return m;
}

/** A key's name as it is written on the bar and in Settings. */
export function keyLabel(code: string | undefined): string {
  if (!code) return '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  const names: Record<string, string> = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Esc', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps', Backspace: 'Backspace' };
  return names[code] ?? code;
}

/** The first key an action answers to, as written (empty for none: the ultimate on the right mouse button). */
export const actionLabel = (binds: Record<CampAction, string[]>, a: CampAction): string => keyLabel(binds[a][0]);
