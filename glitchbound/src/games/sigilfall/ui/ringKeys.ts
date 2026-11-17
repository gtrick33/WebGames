/**
 * The Ring's keys, each one the player's to change (kept in this browser). The arrows always move as well, whatever
 * the movement keys are set to.
 */

export type RingAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'ab1'
  | 'ab2'
  | 'ab3'
  | 'ab4'
  | 'dash'
  | 'super'
  | 'nextFoe'
  | 'nextFriend'
  | 'self'
  | 'foe1'
  | 'foe2'
  | 'foe3'
  | 'friend1'
  | 'friend2';

export const RING_ACTIONS: { id: RingAction; name: string; group: 'Move' | 'Abilities' | 'Targets' }[] = [
  { id: 'up', name: 'Move up', group: 'Move' },
  { id: 'left', name: 'Move left', group: 'Move' },
  { id: 'down', name: 'Move down', group: 'Move' },
  { id: 'right', name: 'Move right', group: 'Move' },
  { id: 'ab1', name: 'Ability 1', group: 'Abilities' },
  { id: 'ab2', name: 'Ability 2', group: 'Abilities' },
  { id: 'ab3', name: 'Ability 3', group: 'Abilities' },
  { id: 'ab4', name: 'Ability 4', group: 'Abilities' },
  // (behind the gates, ready to fight: still `dash`, the Swift Step's id until 2026-11-15, so that keys already set keep
  // working)
  { id: 'dash', name: 'Ready (before a match)', group: 'Abilities' },
  { id: 'super', name: 'Super', group: 'Abilities' },
  { id: 'nextFoe', name: 'Next enemy', group: 'Targets' },
  { id: 'nextFriend', name: 'Next ally', group: 'Targets' },
  { id: 'self', name: 'Help yourself', group: 'Targets' },
  { id: 'foe1', name: 'Enemy 1', group: 'Targets' },
  { id: 'foe2', name: 'Enemy 2', group: 'Targets' },
  { id: 'foe3', name: 'Enemy 3', group: 'Targets' },
  { id: 'friend1', name: 'Ally 1', group: 'Targets' },
  { id: 'friend2', name: 'Ally 2', group: 'Targets' },
];

export type RingKeys = Record<RingAction, string>;

export const DEFAULT_KEYS: RingKeys = {
  up: 'KeyW',
  left: 'KeyA',
  down: 'KeyS',
  right: 'KeyD',
  ab1: 'Digit1',
  ab2: 'Digit2',
  ab3: 'Digit3',
  ab4: 'Digit4',
  dash: 'Space',
  super: 'KeyQ',
  nextFoe: 'Tab',
  nextFriend: 'KeyF',
  self: 'F1',
  foe1: 'KeyZ',
  foe2: 'KeyX',
  foe3: 'KeyC',
  friend1: 'F2',
  friend2: 'F3',
};

const STORE = 'rb-ring-keys';

export function readKeys(): RingKeys {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Record<string, unknown>>;
    const out = { ...DEFAULT_KEYS };
    for (const a of RING_ACTIONS) if (typeof raw[a.id] === 'string' && raw[a.id]) out[a.id] = raw[a.id] as string;
    // an action newer than the saved keys gets its default only if the player hasn't put that key to another use
    for (const a of RING_ACTIONS) {
      if (typeof raw[a.id] === 'string') continue;
      if (RING_ACTIONS.some((b) => b.id !== a.id && typeof raw[b.id] === 'string' && raw[b.id] === out[a.id])) out[a.id] = '';
    }
    return out;
  } catch {
    return { ...DEFAULT_KEYS };
  }
}

export function saveKeys(k: RingKeys): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(k));
  } catch {
    /* (a private window: the keys last until it closes) */
  }
}

/**
 * Sets one action's key. A key already used by another action is taken from it and given the key this one had, so
 * no key ever does two things.
 */
export function bind(k: RingKeys, action: RingAction, code: string): RingKeys {
  const out = { ...k };
  const had = out[action];
  for (const a of RING_ACTIONS) if (a.id !== action && out[a.id] === code) out[a.id] = had;
  out[action] = code;
  return out;
}

/** The action a key does, if any. */
export function actionOf(k: RingKeys, code: string): RingAction | null {
  if (!code) return null;
  for (const a of RING_ACTIONS) if (k[a.id] === code) return a.id;
  return null;
}

/** A key's name as it's printed on it. */
export function keyName(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const names: Record<string, string> = { Space: 'Space', Tab: 'Tab', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps', Enter: 'Enter' };
  return names[code] ?? code;
}
