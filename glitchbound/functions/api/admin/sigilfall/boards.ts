import { logAdmin } from '../../../../server/catalogSettings';
import { bad, json, readJson, sameOrigin, type Ctx } from '../../../../server/http';
import { requireAdmin } from '../../../../server/session';
import { boardRows, campaignOverview, playerBoards, removeRank, setRank, unholdRank, vigilOverview } from '../../../../server/sigilfallAdmin';
import { boardOf } from '../../sigilfall/ranks';

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Admin › Sigilfall: the Campaign's and the Vigil's numbers, and every board of the game's rankings. Admins only.
 *
 * GET  ?view=campaign                       the story across every player's heroes, and its boards
 * GET  ?view=vigil                          the Vigil's nights, land by land, and its boards
 * GET  ?view=board&board=vigil:mire&q=&offset=   one page of a board, with who is kept off it
 * GET  ?view=player&user=                   every board a player is on
 * POST { action: 'remove', userId, board, hold?, note }   take a row off a board (hold: and keep them off it)
 * POST { action: 'unhold', userId, board, note }          let a player back on a board
 * POST { action: 'set', userId, board, score, note }      set a row's score
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const admin = await requireAdmin(env, request);
  if (admin instanceof Response) return admin;
  const p = new URL(request.url).searchParams;
  switch (p.get('view')) {
    case 'campaign':
      return json(await campaignOverview(env));
    case 'vigil':
      return json(await vigilOverview(env));
    case 'board': {
      const b = boardOf(p.get('board'));
      if (!b) return bad('unknown_board', 404, { message: 'There is no such board.' });
      return json({ board: b.board, max: b.max, ...(await boardRows(env, b.board, p.get('q') ?? '', Number(p.get('offset')) || 0)) });
    }
    case 'player':
      return json({ boards: await playerBoards(env, text(p.get('user'), 64)) });
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
  const b = boardOf(body?.board);
  if (!b) return bad('unknown_board', 404, { message: 'There is no such board.' });
  const userId = text(body?.userId, 64);
  const player = userId ? await env.DB.prepare('SELECT id, nickname FROM users WHERE id = ?').bind(userId).first<{ id: string; nickname: string }>() : null;
  if (!player) return bad('not_found', 404, { message: 'No player with that id.' });
  switch (body?.action) {
    case 'remove': {
      const hold = body.hold === true;
      await removeRank(env, userId, b.board, hold, note, by);
      await logAdmin(env, by, 'sigilfall', `Sigilfall rankings, ${b.board}: took ${player.nickname} off${hold ? ' and kept them off' : ''}${why}`.slice(0, 1000));
      return json({ ok: true });
    }
    case 'unhold': {
      if (!(await unholdRank(env, userId, b.board))) return bad('not_held', 409, { message: 'They weren’t kept off that board.' });
      await logAdmin(env, by, 'sigilfall', `Sigilfall rankings, ${b.board}: let ${player.nickname} back on${why}`.slice(0, 1000));
      return json({ ok: true });
    }
    case 'set': {
      const score = typeof body.score === 'number' ? body.score : NaN;
      const err = await setRank(env, userId, b.board, score);
      if (err) return bad('bad_request', 400, { message: err });
      await logAdmin(env, by, 'sigilfall', `Sigilfall rankings, ${b.board}: set ${player.nickname} to ${score}${why}`.slice(0, 1000));
      return json({ ok: true });
    }
    default:
      return bad('unknown_action');
  }
}
