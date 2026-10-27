import type { AdminCatalog } from '../../platform/apiTypes';

const when = (ts: number): string => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Admin › Change log: every change made in the admin, newest first. */
export function ChangeLog({ log }: { log: AdminCatalog['log'] }) {
  return (
    <section className="panel info-block" aria-labelledby="ag-log">
      <h2 id="ag-log">Change log</h2>
      {log.length === 0 ? (
        <p className="info-small">No changes yet.</p>
      ) : (
        <ul className="err-list">
          {log.map((l, i) => (
            <li key={`${l.ts}-${i}`}>
              <span className="err-msg">{l.detail}</span>
              <span className="mono info-small">
                {when(l.ts)} · {l.admin}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
