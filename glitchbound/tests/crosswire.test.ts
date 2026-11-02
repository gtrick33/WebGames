import { describe, expect, it } from 'vitest';
import { editionFor, makePuzzle, wordCells, type Puzzle } from '../src/games/crosswire/grid';
import { backspace, dailyPuzzle, key, mysteryTiles, resultLine, score, solved, toggleDir, typeLetter, withHint, wrongCells, type Entries } from '../src/games/crosswire/logic';
import { LEGACY_WORDS, WORDS } from '../src/games/crosswire/words';

/** Every horizontal and vertical run of 2+ letters must be one of the placed words. */
function runs(p: Puzzle): string[] {
  const out: string[] = [];
  const isL = (r: number, c: number) => p.cells[r]?.[c]?.kind === 'letter';
  const ch = (r: number, c: number) => (p.cells[r]![c] as { ch: string }).ch;
  for (let r = 0; r < p.rows; r++) {
    let s = '';
    for (let c = 0; c <= p.cols; c++) {
      if (c < p.cols && isL(r, c)) s += ch(r, c);
      else {
        if (s.length > 1) out.push(s);
        s = '';
      }
    }
  }
  for (let c = 0; c < p.cols; c++) {
    let s = '';
    for (let r = 0; r <= p.rows; r++) {
      if (r < p.rows && isL(r, c)) s += ch(r, c);
      else {
        if (s.length > 1) out.push(s);
        s = '';
      }
    }
  }
  return out;
}

describe('Crosswire grids', () => {
  it('has a clean word list', () => {
    expect(WORDS.length).toBeGreaterThan(800);
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length);
    // the answer never hides inside its clue (Doormat for MAT), and no two answers of a length share a clue
    for (const w of WORDS) expect(w.clue.toUpperCase().includes(w.word), w.word).toBe(false);
    const clues = new Map<string, string>();
    for (const w of WORDS) {
      const k = `${w.word.length}:${w.clue.toLowerCase()}`;
      expect(clues.get(k), `${w.word} shares "${w.clue}"`).toBeUndefined();
      clues.set(k, w.word);
    }
  });

  it('is in American English', () => {
    const british = /colour|favourite|harbour|theatre|jewell|travell|armour|vapour|flavour|centre|\bcosy|rubbish|lorry|trolley|petrol|\bmum\b|jumper|pavement|banger|jotter|wellies|pushchair|plughole|holidaymaker|queueing|snooker|spanner|fancy dress|trouser|\bgrey\b|mould|ladybird|biscuit|cupboard|christmas bird|round the corner|downwards/i;
    for (const w of WORDS) expect(british.test(`${w.word} ${w.clue}`), `${w.word}:${w.clue}`).toBe(false);
  });

  it('keeps the original answers for older grids, in the same order', () => {
    expect(LEGACY_WORDS.length).toBe(WORDS.length);
    expect(LEGACY_WORDS.filter((e, i) => e.word !== WORDS[i]!.word).map((e) => e.word)).toEqual(['GREY', 'COSY', 'MOULD', 'THEATRE', 'LADYBIRD']);
    expect(editionFor('')).toBe(1);
    expect(editionFor('2026-11-07')).toBe(1);
    expect(editionFor('2026-11-08')).toBe(2);
  });

  it('keeps past dailies exactly as they were', () => {
    // Fingerprints taken before the run-on and word-list changes.
    expect(dailyPuzzle('2026-10-19').words.map((w) => w.word).join(' ')).toBe('PRINCESS PEPPER THRONE PRIDE PLATYPUS EAT EXERCISE COG RED CONCERT EGG WIDE');
    expect(dailyPuzzle('2026-10-20').words.map((w) => w.word).join(' ')).toBe('BALLOON BATHROOM ALPHABET DOLPHIN TEA CRAB TROOP AWAY ALPHA MAGAZINE');
  });

  it('never lets an answer run straight into another one', () => {
    const delimited = (p: Puzzle): string[] => {
      const isL = (r: number, c: number) => p.cells[r]?.[c]?.kind === 'letter';
      return p.words.filter((w) => {
        const [dr, dc] = w.dir === 'across' ? [0, 1] : [1, 0];
        return isL(w.row - dr, w.col - dc) || isL(w.row + dr * w.word.length, w.col + dc * w.word.length);
      }).map((w) => w.word);
    };
    // STICK/STICKY (seed 99), FUN/FUND (daily 2026-11-12), FRIEND/FRIENDLY (daily 2026-12-02)
    expect(delimited(makePuzzle(99, 'medium', 1))).toEqual([]);
    expect(delimited(dailyPuzzle('2026-11-12'))).toEqual([]);
    expect(delimited(dailyPuzzle('2026-12-02'))).toEqual([]);
  }, 30_000);

  it('only ever spells real, clued words, with each clue square right before its answer', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const size of ['small', 'medium', 'large'] as const) {
        const p = makePuzzle(seed * 31, size);
        const placed = new Set(p.words.map((w) => w.word));
        for (const run of runs(p)) expect(placed.has(run), `${seed} ${size}: stray run ${run}`).toBe(true);
        // every answer is a whole run: nothing runs on from its last letter
        expect(runs(p).length, `${seed} ${size}`).toBe(p.words.length);
        for (const w of p.words) {
          wordCells(w).forEach(([r, c], i) => expect((p.cells[r]![c] as { ch: string }).ch).toBe(w.word[i]));
          expect(p.cells[w.cr]![w.cc]!.kind).toBe('clue');
        }
        expect(p.words.length).toBeGreaterThanOrEqual(size === 'small' ? 5 : 9);
      }
    }
  }, 30_000);

  it('is deterministic per seed, and the daily is the same for everyone', () => {
    expect(makePuzzle(7, 'medium')).toEqual(makePuzzle(7, 'medium'));
    expect(dailyPuzzle('2026-10-20').words.map((w) => w.word)).toEqual(dailyPuzzle('2026-10-20').words.map((w) => w.word));
  });

  it('hides a mystery word in circled squares, shuffled', () => {
    const p = makePuzzle(99, 'medium');
    expect(p.mystery).not.toBeNull();
    const circled = p.cells.flat().filter((c) => c.kind === 'letter' && c.mystery !== undefined).map((c) => (c as { ch: string }).ch);
    expect([...circled].sort().join('')).toBe([...p.mystery!.word].sort().join(''));
    expect(mysteryTiles(p).join('')).not.toBe(p.mystery!.word);
  });
});

describe('Crosswire play', () => {
  const p = makePuzzle(5, 'small');
  it('types through a word, backspaces, and knows when the grid is solved', () => {
    let e: Entries = {};
    let cur = { word: 0, pos: 0 };
    const w = p.words[0]!;
    for (const ch of w.word) ({ entries: e, cursor: cur } = typeLetter(p, e, cur, ch));
    expect(wordCells(w).every(([r, c], i) => e[key(r, c)] === w.word[i])).toBe(true);
    ({ entries: e } = backspace(p, e, { word: 0, pos: w.word.length - 1 }));
    expect(e[key(...wordCells(w)[w.word.length - 1]!)]).toBeUndefined();
    const all: Entries = {};
    for (const x of p.words) wordCells(x).forEach(([r, c], i) => (all[key(r, c)] = x.word[i]!));
    expect(solved(p, all)).toBe(true);
    const wrong = { ...all, [key(w.row, w.col)]: w.word[0] === 'Z' ? 'Y' : 'Z' };
    expect(wrongCells(p, wrong)).toEqual([key(w.row, w.col)]);
    expect(toggleDir(p, { word: 0, pos: 0 }).word).toBeGreaterThanOrEqual(0);
  });

  it('scores speed and help, plus the mystery bonus', () => {
    const base = { seconds: 60, checks: 0, letterHints: 0, wordHints: 0, mystery: false };
    expect(score(base)).toBe(1000);
    expect(score({ ...base, mystery: true })).toBe(1250);
    expect(score({ ...base, seconds: 360, letterHints: 2, wordHints: 1 })).toBe(1000 - 100 - 60 - 100);
    expect(score({ ...base, seconds: 99999 })).toBe(100);
  });
});

describe('crosswire share line', () => {
  it('shows a square per word, 8 to a row, with hinted and revealed words and the mystery star', () => {
    const p = dailyPuzzle('2026-10-20');
    let t = { seconds: 100, checks: 0, letterHints: 0, wordHints: 0, mystery: false };
    t = withHint(withHint(withHint(t, 1, 'letter'), 1, 'letter'), 3, 'word');
    expect(t.letterHints).toBe(2);
    expect(t.wordHints).toBe(1);
    const rows = resultLine(p, t).split('\n');
    expect(rows.length).toBe(Math.ceil(p.words.length / 8));
    expect([...rows[0]!].slice(0, 4).join('')).toBe('🟩🟨🟩🟥');
    expect(rows.join('')).not.toMatch(/[A-Z]/);
    if (p.mystery) expect(resultLine(p, { ...t, mystery: true }).endsWith(' ⭐')).toBe(true);
  });
});
