import { useEffect, useState } from 'react';
import { bind, DEFAULT_KEYS, keyName, RING_ACTIONS, type RingAction, type RingKeys } from './ringKeys';

/** Setting The Ring's keys: click an action, press its new key (Escape leaves it as it was). */
export function KeysDialog({ keys, onKeys, onBinding, onClose }: { keys: RingKeys; onKeys: (k: RingKeys) => void; onBinding: (on: boolean) => void; onClose: () => void }) {
  const [waiting, setWaiting] = useState<RingAction | null>(null);
  useEffect(() => {
    onBinding(waiting !== null);
    if (!waiting) {
      const shut = (e: KeyboardEvent): void => {
        if (e.code === 'Escape') {
          e.stopImmediatePropagation();
          onClose();
        }
      };
      window.addEventListener('keydown', shut, true);
      return () => window.removeEventListener('keydown', shut, true);
    }
    const take = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== 'Escape') onKeys(bind(keys, waiting, e.code));
      setWaiting(null);
    };
    window.addEventListener('keydown', take, true);
    return () => window.removeEventListener('keydown', take, true);
  }, [waiting, keys, onKeys, onBinding, onClose]);
  useEffect(() => () => onBinding(false), [onBinding]);
  const groups = ['Move', 'Abilities', 'Targets'] as const;
  return (
    <div className="rb-ring-dialog-wrap" role="dialog" aria-label="Keys" onClick={onClose}>
      <div className="rb-ring-dialog is-keys" onClick={(e) => e.stopPropagation()}>
        <h2>Keys</h2>
        <p className="rb-ring-keys-hint">{waiting ? `Press a key for ${RING_ACTIONS.find((a) => a.id === waiting)!.name}. Escape to keep it as it is.` : 'Click one to change its key. The arrow keys always move too.'}</p>
        <div className="rb-ring-keys">
          {groups.map((g) => (
            <section key={g}>
              <h3>{g}</h3>
              {RING_ACTIONS.filter((a) => a.group === g).map((a) => (
                <button key={a.id} type="button" className={`rb-ring-key${waiting === a.id ? ' is-waiting' : ''}`} onClick={() => setWaiting(a.id)}>
                  <span>{a.name}</span>
                  <kbd>{waiting === a.id ? '…' : keyName(keys[a.id])}</kbd>
                </button>
              ))}
            </section>
          ))}
        </div>
        <div className="rb-ring-keys-foot">
          <button type="button" className="rb-btn" onClick={() => onKeys({ ...DEFAULT_KEYS })}>
            Reset to defaults
          </button>
          <button type="button" className="rb-btn is-gold" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
