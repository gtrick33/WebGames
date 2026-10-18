import { describe, expect, it } from 'vitest';
import { IMPOSTOR_THEMES, pairs } from '../src/party/content/impostor';
import { dealImpostor, impostorRng, scoreImpostor, votedOut } from '../src/party/impostor';
import { act, join, newRoom, tick, viewFor, type State } from '../src/party/impostorRoom';

describe('Impostor word bank', () => {
  it('has many themes, each with twenty words and a hint that never gives the word away', () => {
    expect(IMPOSTOR_THEMES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(IMPOSTOR_THEMES.map((t) => t.id)).size).toBe(IMPOSTOR_THEMES.length);
    for (const t of IMPOSTOR_THEMES) {
      const list = pairs(t);
      expect(list.length, t.id).toBeGreaterThanOrEqual(20);
      expect(new Set(list.map(([w]) => w.toLowerCase())).size, t.id).toBe(list.length);
      for (const [word, hint] of list) {
        expect(word && hint, `${t.id}: ${word}`).toBeTruthy();
        expect(hint.toLowerCase().includes(word.toLowerCase()), `${t.id}: ${word} / ${hint}`).toBe(false);
        expect(word.toLowerCase().includes(hint.toLowerCase()), `${t.id}: ${word} / ${hint}`).toBe(false);
      }
    }
  });
});

describe('Impostor rules', () => {
  const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  it('deals one impostor (two only when asked and seven or more play), with six guess options', () => {
    const r = impostorRng(42);
    const one = dealImpostor(players.slice(0, 4), ['food'], [], r).deal;
    expect(one.impostors).toHaveLength(1);
    expect(one.options).toHaveLength(6);
    expect(new Set(one.options).size).toBe(6);
    expect(one.options).toContain(one.word);
    expect(dealImpostor(players, [], [], r, 2).deal.impostors).toHaveLength(2);
    expect(dealImpostor(players.slice(0, 5), [], [], r, 2).deal.impostors).toHaveLength(1);
  });

  it('does not repeat a word until the theme runs out', () => {
    const r = impostorRng(7);
    let used: string[] = [];
    const words = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const d = dealImpostor(players, ['animals'], used, r);
      used = d.used;
      words.add(d.deal.word);
    }
    expect(words.size).toBe(20);
    expect(dealImpostor(players, ['animals'], used, r).used.length).toBeLessThanOrEqual(20);
  });

  it('scores: escaped impostor 2, a caught one who guesses the word 1, else everyone else 1', () => {
    const deal = { theme: 'food', word: 'Pizza', hint: 'Italy', impostors: ['b'], starter: 'a', options: [] };
    expect(votedOut({ a: 'b', c: 'b', b: 'a' })).toBe('b');
    expect(votedOut({ a: 'b', b: 'a' })).toBeNull();
    expect(scoreImpostor(deal, ['a', 'b', 'c'], 'a', null)).toEqual({ outcome: 'escaped', points: { b: 2 } });
    expect(scoreImpostor(deal, ['a', 'b', 'c'], 'b', 'pizza')).toEqual({ outcome: 'stole', points: { b: 1 } });
    expect(scoreImpostor(deal, ['a', 'b', 'c'], 'b', 'Sushi')).toEqual({ outcome: 'caught', points: { a: 1, c: 1 } });
  });
});

describe('Impostor live room', () => {
  const keys = ['key-aaaaaaaaaaaaaaaa1', 'key-bbbbbbbbbbbbbbbb2', 'key-cccccccccccccccc3', 'key-dddddddddddddddd4'];
  const room = (): State => {
    const s = newRoom('ABCDE', 1000, 99);
    ['Ana', 'Bo', 'Cy', 'Di'].forEach((n, i) => join(s, keys[i]!, n, 1000));
    return s;
  };

  it('plays a round in sync: secret cards, the vote, the guess and the scores', () => {
    const s = room();
    expect(act(s, keys[1]!, { t: 'start' }, 1100)).toMatch(/host/);
    expect(act(s, keys[0]!, { t: 'start' }, 1100)).toBeNull();
    expect(s.phase).toBe('reveal');
    const views = keys.map((k) => viewFor(s, k)!);
    const impostorView = views.find((v) => v.card?.impostor)!;
    const crew = views.filter((v) => !v.card?.impostor);
    expect(impostorView.card!.word).toBeNull();
    expect(impostorView.card!.hint).toBeTruthy();
    expect(crew).toHaveLength(3);
    for (const v of crew) expect(v.card!.word).toBe(s.deal!.word);
    // Nobody learns who the impostor is before the end.
    for (const v of views) expect(v.result).toBeNull();
    for (const k of keys) act(s, k, { t: 'seen' }, 1200);
    expect(s.phase).toBe('talk');
    act(s, keys[2]!, { t: 'vote_now' }, 1300);
    expect(s.phase).toBe('vote');
    const impostorSeat = impostorView.you;
    keys.forEach((k, i) => {
      const me = i + 1;
      act(s, k, { t: 'vote', seat: me === impostorSeat ? (impostorSeat === 1 ? 2 : 1) : impostorSeat }, 1400);
    });
    expect(s.phase).toBe('guess');
    const impostorKey = keys[impostorSeat - 1]!;
    expect(viewFor(s, impostorKey)!.options).toContain(s.deal!.word);
    act(s, impostorKey, { t: 'guess', word: 'definitely wrong' }, 1500);
    expect(s.phase).toBe('result');
    const end = viewFor(s, keys[0]!)!;
    expect(end.result!.outcome).toBe('caught');
    expect(end.result!.impostors).toEqual([impostorSeat]);
    expect(end.players.filter((p) => p.n !== impostorSeat).every((p) => p.score === 1)).toBe(true);
  });

  it('moves on by itself when the talk timer or the vote runs out', () => {
    const s = room();
    act(s, keys[0]!, { t: 'settings', settings: { talk: 120 } }, 1000);
    act(s, keys[0]!, { t: 'start' }, 1000);
    for (const k of keys) act(s, k, { t: 'seen' }, 1000);
    expect(s.phase).toBe('talk');
    tick(s, 1000 + 121_000);
    expect(s.phase).toBe('vote');
    tick(s, 1000 + 121_000 + 76_000);
    // Nobody voted: a tie, so the impostor escapes.
    expect(s.phase).toBe('result');
    expect(viewFor(s, keys[0]!)!.result!.outcome).toBe('escaped');
  });

  it('lets late joiners wait for the next round', () => {
    const s = room();
    act(s, keys[0]!, { t: 'start' }, 1000);
    join(s, 'key-eeeeeeeeeeeeeeee5', 'Ed', 1100);
    const late = viewFor(s, 'key-eeeeeeeeeeeeeeee5')!;
    expect(late.card).toBeNull();
    expect(late.players.find((p) => p.you)!.waiting).toBe(true);
  });
});
