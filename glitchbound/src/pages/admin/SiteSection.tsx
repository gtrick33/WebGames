import { useState } from 'react';
import { TEXT_LIMITS, type NoticeTone } from '../../catalog/settings';
import type { AdminCatalog } from '../../platform/apiTypes';
import { SeasonPicker } from '../AdminLayout';
import type { Send } from './useAdminCatalog';

/** Admin › Notice & holidays: the banner under the header on every page, and the holiday look. */
export function SiteSection({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  return (
    <>
      <NoticeEditor data={data} send={send} busy={busy} />
      <SeasonPicker data={data} send={send} busy={busy} />
    </>
  );
}

function NoticeEditor({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const n = data.notice;
  const [text, setText] = useState(n?.text ?? '');
  const [link, setLink] = useState(n?.link ?? '');
  const [tone, setTone] = useState<NoticeTone>(n?.tone ?? 'info');
  return (
    <section className="panel info-block" aria-labelledby="ag-notice">
      <div className="admin-row">
        <h2 id="ag-notice">Site notice</h2>
        <span className="mono info-small">{n ? 'Showing to everyone' : 'Off'}</span>
      </div>
      <p className="info-small">A banner under the header on every page, e.g. a new game, an event or planned maintenance. Players can dismiss it; editing it shows it again.</p>
      <form
        className="ag-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ action: 'notice', notice: { text, link, tone } }, 'Notice published');
        }}
      >
        <label className="ag-field ag-wide">
          <span>Message</span>
          <input className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={TEXT_LIMITS.notice} placeholder="🎉 Wing It is live: one tap to flap!" required />
        </label>
        <label className="ag-field">
          <span>Link (optional)</span>
          <input className="field" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/games/wing-it or https://…" />
        </label>
        <label className="ag-field">
          <span>Style</span>
          <select className="field" value={tone} onChange={(e) => setTone(e.target.value as NoticeTone)}>
            <option value="info">Info (yellow)</option>
            <option value="party">Celebration (rainbow)</option>
            <option value="warning">Heads-up (coral)</option>
          </select>
        </label>
        <div className="reset-row ag-wide">
          <button className="btn btn-sm btn-primary" disabled={busy || !text.trim()}>
            {n ? 'Update notice' : 'Publish notice'}
          </button>
          {n && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={() => {
                setText('');
                setLink('');
                void send({ action: 'notice', notice: null }, 'Notice removed');
              }}
            >
              Remove
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
