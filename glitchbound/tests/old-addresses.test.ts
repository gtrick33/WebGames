import { describe, expect, it } from 'vitest';
import * as oldRiftboundGame from '../functions/games/riftbound/[[path]]';
import * as oldUnhinged from '../functions/games/unhinged/[[path]]';
import * as oldQuizbelief from '../functions/games/wait-what/index';
import * as oldRiftboundTab from '../functions/riftbound';
import type { Ctx } from '../server/http';

const SITE = 'https://glitchboundstudio.com';

describe('old addresses', () => {
  // A HEAD with no handler is a 404 on Pages, so link checkers would report every old link as dead.
  it('redirect a HEAD request the same as a GET', () => {
    const cases: [{ onRequestGet: (c: Ctx) => Response; onRequestHead: (c: Ctx) => Response }, string, string][] = [
      [oldQuizbelief, '/games/wait-what?c=abc', '/games/quizbelief?c=abc'],
      [oldUnhinged, '/games/unhinged', '/games/crass-act'],
      [oldRiftboundGame, '/games/riftbound', '/sigilfall'],
      [oldRiftboundTab, '/riftbound', '/sigilfall'],
    ];
    for (const [fn, from, to] of cases) {
      for (const method of ['GET', 'HEAD']) {
        const handler = method === 'GET' ? fn.onRequestGet : fn.onRequestHead;
        const res = handler({ request: new Request(SITE + from, { method }) } as Ctx);
        expect([from, method, res.status, res.headers.get('location')]).toEqual([from, method, 301, SITE + to]);
      }
    }
  });
});
