import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../platform/account';
import type { AdminCatalog } from '../../platform/apiTypes';
import { setCatalog } from '../../platform/liveCatalog';

/** Sends one change to /api/admin/catalog (admin/useAdminCatalog.ts); resolves to whether it was saved. */
export type Send = (body: Record<string, unknown>, done?: string) => Promise<boolean>;

export interface AdminCatalogState {
  data: AdminCatalog | null;
  error: string;
  busy: boolean;
  /** The last change's outcome, shown for a moment ("Saved", "Not saved: …"). */
  toast: string;
  send: Send;
  reload: () => Promise<void>;
}

/**
 * Everything the admin's site sections edit (GET /api/admin/catalog), and the way to change it. After every
 * change the rest of the site open in this tab follows at once.
 */
export function useAdminCatalog(): AdminCatalogState {
  const [data, setData] = useState<AdminCatalog | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const reload = useCallback(
    () =>
      api<AdminCatalog>('/api/admin/catalog')
        .then((d) => {
          setData(d);
          setError('');
          setCatalog({ settings: d.settings, picks: d.picks, notice: d.notice, layout: d.layout ?? null, season: d.season, party: d.party, flagships: d.flagships ?? null, multiplayer: d.multiplayer ?? null, banner: d.banner ?? null, money: d.money ?? null, shopItems: d.shopItems ?? null });
        })
        .catch((e: unknown) => setError(e instanceof ApiError && e.status === 403 ? 'Only admins can change the site.' : 'Could not load the site settings.')),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const send: Send = useCallback(
    async (body, done = 'Saved') => {
      setBusy(true);
      try {
        await api('/api/admin/catalog', { body });
        await reload();
        setToast(done);
        return true;
      } catch (e) {
        setToast(e instanceof ApiError ? `Not saved: ${e.message ?? e.code}` : 'Not saved: network error');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  return { data, error, busy, toast, send, reload };
}
