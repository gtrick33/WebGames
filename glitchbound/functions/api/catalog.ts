import { loadCatalog } from '../../server/catalogSettings';
import { json, type Ctx } from '../../server/http';
import { addDays } from '../../src/platform/dates';

/**
 * GET /api/catalog: the admins' game settings, hand-picked daily challenges (a few days back to two
 * months ahead) and the site notice. Public and briefly cached; browsers also keep the last copy.
 */
export async function onRequestGet({ env }: Ctx): Promise<Response> {
  const today = new Date().toISOString().slice(0, 10);
  const cat = await loadCatalog(env, addDays(today, -3), addDays(today, 62));
  return json(cat, 200, { 'cache-control': 'public, max-age=30' });
}
