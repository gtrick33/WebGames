import { describe, expect, it } from 'vitest';
import { IMPOSTOR_THEMES, pairs } from '../src/party/content/impostor';
import { dealImpostor, impostorRng, scoreImpostor, votedOut } from '../src/party/impostor';
import { act, AWAY_GRACE_MS, join, leave, newRoom, tick, viewFor, type State } from '../src/party/impostorRoom';

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
    const size = pairs(IMPOSTOR_THEMES.find((t) => t.id === 'animals')!).length;
    let used: string[] = [];
    const words = new Set<string>();
    for (let i = 0; i < size; i++) {
      const d = dealImpostor(players, ['animals'], used, r);
      used = d.used;
      words.add(d.deal.word);
    }
    expect(words.size).toBe(size);
    expect(dealImpostor(players, ['animals'], used, r).used.length).toBeLessThanOrEqual(size);
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
    // They watch this round: they cannot call the vote for the others.
    for (const k of keys) act(s, k, { t: 'seen' }, 1200);
    expect(s.phase).toBe('talk');
    act(s, 'key-eeeeeeeeeeeeeeee5', { t: 'vote_now' }, 1300);
    expect(s.phase).toBe('talk');
  });

  const toVote = (s: State, ks: string[], now: number): void => {
    act(s, ks[0]!, { t: 'start' }, now);
    for (const k of ks) act(s, k, { t: 'seen' }, now);
    act(s, ks[0]!, { t: 'vote_now' }, now);
  };
  const impostorOf = (s: State): number => Number(s.deal!.impostors[0]);

  it('calls the round off, with no points, when fewer than three players are left to vote', () => {
    const s = newRoom('ABCDE', 1000, 7);
    const three = keys.slice(0, 3);
    ['Ana', 'Bo', 'Cy'].forEach((n, i) => join(s, three[i]!, n, 1000));
    toVote(s, three, 1000);
    const imp = impostorOf(s);
    const crewKeys = three.filter((_, i) => i + 1 !== imp);
    const goneKey = crewKeys[0]!;
    leave(s, goneKey, 2000);
    const left = three.filter((k) => k !== goneKey);
    const seatOfKey = (k: string): number => three.indexOf(k) + 1;
    act(s, left[0]!, { t: 'vote', seat: seatOfKey(left[1]!) }, 2100);
    act(s, left[1]!, { t: 'vote', seat: seatOfKey(left[0]!) }, 2100);
    // They might only be reloading: the vote waits for them...
    expect(s.phase).toBe('vote');
    tick(s, 2000 + 76_000);
    // ...but they never came back: no "impostor got away" from a two-player tie.
    expect(s.phase).toBe('lobby');
    expect(s.seats.every((x) => x.score === 0)).toBe(true);
    expect(viewFor(s, left[0]!)!.calledOff).toBe('players');
    join(s, goneKey, 'Back', 80_000);
    act(s, s.seats.find((x) => x.n === s.host)!.key, { t: 'start' }, 80_000);
    expect(s.phase).toBe('reveal');
    expect(viewFor(s, three[0]!)!.calledOff).toBeNull();
  });

  it('a player who reloads mid-vote still votes, and the round counts', () => {
    const s = room();
    toVote(s, keys, 1000);
    const imp = impostorOf(s);
    const crew = keys.filter((_, i) => i + 1 !== imp);
    leave(s, crew[0]!, 1500);
    for (const k of keys.filter((k) => k !== crew[0])) act(s, k, { t: 'vote', seat: keys.indexOf(k) + 1 === imp ? keys.indexOf(crew[1]!) + 1 : imp }, 1600);
    expect(s.phase).toBe('vote');
    join(s, crew[0]!, 'Back', 1500 + AWAY_GRACE_MS / 2);
    act(s, crew[0]!, { t: 'vote', seat: imp }, 1500 + AWAY_GRACE_MS / 2);
    expect(s.phase).toBe('guess');
  });

  it('calls the round off when the host removes the impostor', () => {
    const s = room();
    toVote(s, keys, 1000);
    const imp = impostorOf(s);
    const host = keys[0]!;
    const target = imp === 1 ? 2 : imp;
    if (imp === 1) {
      // The host is the impostor: hand the host role over by leaving and let the new host remove them.
      leave(s, host, 1100);
      act(s, keys[1]!, { t: 'kick', seat: 1 }, 1200);
    } else act(s, host, { t: 'kick', seat: target }, 1200);
    expect(s.phase).toBe('lobby');
    expect(s.seats.every((x) => x.score === 0)).toBe(true);
    expect(viewFor(s, keys[2]!)!.calledOff).toBe('impostor');
  });

  it('gives the host role to whoever comes back first when everyone had gone', () => {
    const s = room();
    act(s, keys[0]!, { t: 'start' }, 1000);
    for (const k of keys) leave(s, k, 1100);
    expect(s.seats.every((x) => !x.online)).toBe(true);
    join(s, keys[2]!, 'Cy', 1200);
    expect(s.host).toBe(3);
    expect(viewFor(s, keys[2]!)!.host).toBe(true);
  });

  it('frees the seat and the name of someone who leaves the lobby', () => {
    const s = room();
    leave(s, keys[1]!, 1100);
    expect(s.seats.map((x) => x.name)).toEqual(['Ana', 'Cy', 'Di']);
    join(s, 'key-ffffffffffffffff6', 'Bo', 1200);
    expect(s.seats.at(-1)!.name).toBe('Bo');
  });

  it('drops the votes of and for a removed player, so the others vote again', () => {
    const s = room();
    act(s, keys[0]!, { t: 'start' }, 1000);
    for (const k of keys) act(s, k, { t: 'seen' }, 1000);
    act(s, keys[0]!, { t: 'vote_now' }, 1000);
    act(s, keys[0]!, { t: 'vote', seat: 4 }, 1000);
    act(s, keys[1]!, { t: 'vote', seat: 3 }, 1000);
    act(s, keys[3]!, { t: 'vote', seat: 2 }, 1000);
    act(s, keys[0]!, { t: 'kick', seat: 4 }, 1000);
    expect(s.phase).toBe('vote');
    expect(s.votes).toEqual({ 2: 3 });
  });
});
