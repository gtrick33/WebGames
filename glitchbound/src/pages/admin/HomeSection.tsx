import { useEffect, useMemo, useRef, useState } from 'react';
import { settingsFor } from '../../catalog/settings';
import { Icon } from '../../components/Icon';
import type { AdminCatalog } from '../../platform/apiTypes';
import { PREVIEW_KEY } from '../../platform/preview';
import { BestGamesEditor } from '../AdminBest';
import { LayoutEditor } from '../AdminLayout';
import { MultiplayerEditor } from '../AdminMultiplayer';
import { BannerEditor } from './BannerSection';
import { describeChanges, draftCatalog, draftChanges, savedDraft, type HomeDraft } from './homeDraft';
import type { Send } from './useAdminCatalog';

/**
 * Admin › Home page: everything the home page shows, edited as one draft (admin/homeDraft.ts): the Sigilfall banner's
 * words, Our best games, the live games row and the arcade banners, each banner with all of its game's settings. The bar at the top
 * counts the unpublished changes; Preview shows the home page with them, Publish sends them all at once,
 * Discard throws them away. Players see nothing until Publish.
 */
export function HomeEditor({ data, send, busy }: { data: AdminCatalog; send: Send; busy: boolean }) {
  const [draft, setDraft] = useState<HomeDraft>(() => savedDraft(data));
  const [showChanges, setShowChanges] = useState(false);
  const [preview, setPreview] = useState(false);
  // the draft as players would get it: what the editors offer and what the preview shows
  const catalog = useMemo(() => ({ ...draftCatalog(data, draft), log: data.log }) as AdminCatalog, [data, draft]);
  const changes = useMemo(() => draftChanges(data, draft), [data, draft]);
  const lines = useMemo(() => describeChanges(changes, data), [changes, data]);
  const dirty = lines.length > 0;

  // leaving with unpublished changes asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent): void => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const publish = (): void => {
    const body: Record<string, unknown> = { action: 'publish', games: changes.games };
    if ('layout' in changes) body.layout = changes.layout;
    if (changes.flagships) body.flagships = changes.flagships;
    if (changes.multiplayer) body.multiplayer = changes.multiplayer;
    if (changes.banner) body.banner = changes.banner;
    void send(body, `Home page published (${lines.length} change${lines.length === 1 ? '' : 's'})`);
  };

  return (
    <div className="ah">
      <div className={`ah-bar${dirty ? ' is-dirty' : ''}`} role="region" aria-label="Publishing">
        <div className="ah-bar-state">
          <b>{dirty ? `${lines.length} unpublished change${lines.length === 1 ? '' : 's'}` : 'Everything is published'}</b>
          <span className="info-small">{dirty ? 'Players still see the published home page.' : 'Change anything below: players see it once you publish.'}</span>
        </div>
        <div className="ah-bar-actions">
          {dirty && (
            <button className="btn btn-sm btn-ghost" onClick={() => setShowChanges((v) => !v)} aria-expanded={showChanges}>
              {showChanges ? 'Hide changes' : 'Show changes'}
            </button>
          )}
          <button
            className="btn btn-sm"
            onClick={() => {
              writePreview(catalog);
              setPreview(true);
            }}
          >
            <Icon name="expand" size={14} /> Preview
          </button>
          <button className="btn btn-sm btn-ghost" disabled={busy || !dirty} onClick={() => setDraft(savedDraft(data))}>
            Discard
          </button>
          <button className="btn btn-sm btn-primary" disabled={busy || !dirty} onClick={publish}>
            Publish
          </button>
        </div>
        {dirty && showChanges && (
          <ul className="ah-changes" aria-label="Unpublished changes">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>

      <BannerEditor value={draft.banner} live={data.banner ?? {}} on={!settingsFor(data, 'sigilfall').hidden} onChange={(banner) => setDraft((d) => ({ ...d, banner }))} />
      <BestGamesEditor catalog={catalog} value={draft.flagships} onChange={(flagships) => setDraft((d) => ({ ...d, flagships }))} custom={Array.isArray(data.flagships)} busy={busy} />
      <MultiplayerEditor catalog={catalog} value={draft.multiplayer} onChange={(multiplayer) => setDraft((d) => ({ ...d, multiplayer }))} custom={Array.isArray(data.multiplayer)} busy={busy} />
      <LayoutEditor catalog={catalog} draft={draft} onChange={setDraft} live={data} busy={busy} />

      {preview && <HomePreview catalog={catalog} onClose={() => setPreview(false)} />}
    </div>
  );
}

const writePreview = (catalog: AdminCatalog): void => {
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(catalog));
  } catch {
    /* storage blocked: the preview shows the published home page */
  }
};

const WIDTHS = { desktop: 1280, phone: 390 } as const;

/**
 * The home page as players would see it with the draft, in a frame of the site itself (/?preview: platform/
 * preview.ts). It follows the draft as it changes; nothing in it is published or counted.
 */
function HomePreview({ catalog, onClose }: { catalog: AdminCatalog; onClose: () => void }) {
  const [device, setDevice] = useState<keyof typeof WIDTHS>('desktop');
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  useEffect(() => writePreview(catalog), [catalog]);
  useEffect(
    () => () => {
      try {
        localStorage.removeItem(PREVIEW_KEY);
      } catch {
        /* nothing kept */
      }
    },
    [],
  );
  useEffect(() => {
    const close = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  // the desktop page is shown whole, scaled down to the window
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = (): void => setFit(Math.min(1, (el.clientWidth - 16) / WIDTHS[device]));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  const w = WIDTHS[device];
  return (
    <div className="ah-preview" role="dialog" aria-modal="true" aria-label="Preview of the home page">
      <div className="ah-preview-bar">
        <b>Preview · not published</b>
        <div className="seg" role="group" aria-label="Screen">
          {(['desktop', 'phone'] as const).map((d) => (
            <button key={d} className={device === d ? 'is-on' : ''} aria-pressed={device === d} onClick={() => setDevice(d)}>
              {d === 'desktop' ? 'Desktop' : 'Phone'}
            </button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={onClose}>
          <Icon name="close" size={14} /> Close
        </button>
      </div>
      <div className="ah-preview-stage" ref={stage}>
        <div className="ah-preview-frame" style={{ width: w * fit, height: `calc((100% - 16px))` }}>
          <iframe title="Home page preview" src="/?preview" style={{ width: w, height: `calc(100% / ${fit})`, transform: `scale(${fit})` }} />
        </div>
      </div>
    </div>
  );
}
