import { logAdmin } from '../../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { requireAdmin } from '../../../../server/session';
import { findUser, resetStanding, ringLadder, ringMatch, ringMatches, ringOverview, ringPlayer, setStanding, voidMatch } from '../../../../server/sigilfallAdmin';
import { isFormat, MATCH_ID } from '../../../../src/games/sigilfall/arena/ranked';

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const FORMAT_NAME: Record<number, string> = { 1: '1v1', 2: '2v2', 3: '3v3' };

/**
 * Admin › Sigilfall › The Ring. Admins only.
 *
 * GET  ?view=overview                                        the numbers: players, matches, how they end, each class
 * GET  ?view=ladder&format=1&q=&offset=                      one page of a format's ladder
 * GET  ?view=matches&format=&kind=&result=&note=&player=&offset=   one page of rated matches, newest first
 * GET  ?view=match&id=                                       one match
 * GET  ?view=player&user=                                    one player's standings and matches
 * POST { action: 'standing', userId, format, rating?, mmr?, best?, wins?, losses?, streak?, note }   set a standing
 * POST { action: 'reset', userId, format, note }             start a standing over at 1000
 * POST { action: 'void', id, note }                          take a match back, and the rating it moved
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const p = new URL(request.url).searchParams;
  const offset = Number(p.get('offset')) || 0;
  switch (p.get('view') ?? 'overview') {
    case 'overview':
      return json(await ringOverview(env));
    case 'ladder': {
      const format = Number(p.get('format'));
      if (!isFormat(format)) return bad('bad_request');
      return json(await ringLadder(env, format, p.get('q') ?? '', offset));
    }
    case 'matches': {
      const asked = text(p.get('player'), 120);
      const who = asked ? await findUser(env, asked) : null;
      if (asked && !who) return json({ rows: [], total: 0, page: 30, player: null });
      const out = await ringMatches(env, { format: Number(p.get('format')) || 0, kind: p.get('kind') ?? '', result: p.get('result') ?? '', note: p.get('note') ?? '', ...(who ? { user: who.id } : {}) }, offset);
      return json({ ...out, player: who });
    }
    case 'match': {
      const id = p.get('id') ?? '';
      const m = MATCH_ID.test(id) ? await ringMatch(env, id) : null;
      return m ? json({ match: m }) : bad('not_found', 404, { message: 'No match with that id.' });
    }
    case 'player': {
      const out = await ringPlayer(env, text(p.get('user'), 64));
      return out ? json(out) : bad('not_found', 404, { message: 'No player with that id.' });
    }
    default:
      return bad('bad_request');
  }
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!sameOrigin(request)) return bad('bad_origin', 403);
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const body = await readJson(request);
  const by = admin.email || admin.nickname;
  const note = text(body?.note, 300);
  const why = note ? `. Why: ${note}` : '';
  if (body?.action === 'void') {
    const id = text(body.id, 80);
    if (!MATCH_ID.test(id)) return bad('bad_request');
    const out = await voidMatch(env, id);
    if (typeof out === 'string') return bad('not_possible', 409, { message: out });
    const moved = out.undone.length ? `, ${out.undone.length} rating${out.undone.length === 1 ? '' : 's'} given back` : '';
    await logAdmin(env, by, 'sigilfall', `Sigilfall, the Ring: took back match ${id}${moved}${why}`.slice(0, 1000));
    return json({ ok: true, ...out });
  }
  const userId = text(body?.userId, 64);
  const player = userId ? await env.DB.prepare('SELECT id, nickname FROM users WHERE id = ?').bind(userId).first<{ id: string; nickname: string }>() : null;
  if (!player) return bad('not_found', 404, { message: 'No player with that id.' });
  const format = Number(body?.format);
  if (!isFormat(format)) return bad('bad_request', 400, { message: 'Pick a format.' });
  switch (body?.action) {
    case 'standing': {
      const out = await setStanding(env, userId, format, { rating: body.rating, mmr: body.mmr, best: body.best, wins: body.wins, losses: body.losses, streak: body.streak });
      if (typeof out === 'string') return bad('bad_request', 400, { message: out });
      const { before: b, after: a } = out;
      await logAdmin(
        env,
        by,
        'sigilfall',
        `Sigilfall, the Ring, ${player.nickname} (${FORMAT_NAME[format]}): rating ${b.rating} → ${a.rating}, hidden ${b.mmr} → ${a.mmr}, best ${b.best} → ${a.best}, ${b.wins}–${b.losses} → ${a.wins}–${a.losses}${why}`.slice(0, 1000),
      );
      return json({ ok: true, standing: a });
    }
    case 'reset': {
      await resetStanding(env, userId, format);
      await logAdmin(env, by, 'sigilfall', `Sigilfall, the Ring, ${player.nickname} (${FORMAT_NAME[format]}): started over at 1000${why}`.slice(0, 1000));
      return json({ ok: true });
    }
    default:
      return bad('unknown_action');
  }
}
