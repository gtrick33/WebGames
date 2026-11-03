import { describe, expect, it } from 'vitest';
import { accuracy, isBull, makeShot, makeShots, mark, MAX_POINTS, partners, percentRight, pointsFor, ratioText, rng, SHOTS } from '../src/games/to-scale/logic';
import { artBox, DIM_QUESTION, measured, sizeText, THINGS, usText } from '../src/games/to-scale/objects';
import { levelTurn, principalAxis } from '../src/games/to-scale/glyphs';
import { labelWidth, layoutLabels } from '../src/games/to-scale/layout';

describe('to-scale objects', () => {
  it('every thing has a name, a positive size, a fact and a partner', () => {
    const names = new Set<string>();
    for (const [i, t] of THINGS.entries()) {
      expect(t.size, t.name).toBeGreaterThan(0);
      expect(t.fact.length, t.name).toBeGreaterThan(10);
      expect(t.fact.length, t.name).toBeLessThan(140);
      expect(names.has(t.name), t.name).toBe(false);
      names.add(t.name);
      expect(partners(i).length, t.name).toBeGreaterThan(0);
    }
  });
  it('sizes read well', () => {
    expect(sizeText(0.006)).toBe('6 mm');
    expect(sizeText(0.067)).toBe('6.7 cm');
    expect(sizeText(1.7)).toBe('1.7 m');
    expect(sizeText(333)).toBe('333 m');
    expect(sizeText(12_742_000)).toBe('12,742 km');
  });
});

describe('to-scale shots', () => {
  it('the same seed gives the same five shots', () => {
    expect(makeShots(1234)).toEqual(makeShots(1234));
    expect(makeShots(1234)).not.toEqual(makeShots(4321));
  });
  it('shots are fair: the answer is inside the range and the start is well off', () => {
    for (let seed = 0; seed < 400; seed++) {
      const shots = makeShots(seed);
      expect(shots).toHaveLength(SHOTS);
      expect(new Set(shots.map((s) => s.target)).size).toBe(SHOTS);
      for (const s of shots) {
        expect(s.ref).not.toBe(s.target);
        const off = Math.max(s.ratio, 1 / s.ratio);
        expect(off).toBeGreaterThanOrEqual(1.8 - 1e-9);
        expect(off).toBeLessThanOrEqual(8 + 1e-9);
        expect(s.min).toBeLessThan(s.ratio);
        expect(s.max).toBeGreaterThan(s.ratio);
        expect(s.start).toBeGreaterThanOrEqual(s.min);
        expect(s.start).toBeLessThanOrEqual(s.max);
        expect(1 / accuracy(s.start, s.ratio)).toBeGreaterThanOrEqual(1.7 - 1e-9);
      }
    }
  });
  it('endless shots avoid used targets', () => {
    const r = rng(7);
    const used = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 0; i < 50; i++) expect(used.has(makeShot(r, used).target)).toBe(false);
  });
  it('always guessing the middle of the slider scores badly', () => {
    let total = 0;
    let n = 0;
    for (let seed = 0; seed < 300; seed++)
      for (const s of makeShots(seed)) {
        total += pointsFor(1, s.ratio);
        n++;
      }
    expect(total / n).toBeLessThan(250);
  });
});

describe('to-scale scoring', () => {
  it('exact is 1000, half and double are equal, 2.8x off is 0', () => {
    expect(pointsFor(3, 3)).toBe(MAX_POINTS);
    expect(pointsFor(1.5, 3)).toBe(pointsFor(6, 3));
    expect(pointsFor(3 * 2.83, 3)).toBe(0);
    expect(pointsFor(3 / 100, 3)).toBe(0);
    expect(pointsFor(3.2, 3)).toBeGreaterThan(900);
  });
  it('marks and ratios read well', () => {
    expect(mark(1000)).toBe('🎯');
    expect(mark(0)).toBe('🟥');
    expect(ratioText(2.44)).toBe('2.4×');
    expect(ratioText(15.4)).toBe('15×');
    expect(ratioText(1 / 3)).toBe('1/3');
    expect(ratioText(1 / 1.4)).toBe('0.71×');
  });
});

describe('to-scale real sizes (TS-01)', () => {
  // Every thing's size, what it measures, and which side of its picture shows it. A change here
  // changes what players are asked; the sizes also pick the daily pairs.
  const PINNED: Record<string, string> = {
    'an ant': '0.006 m long, art w (leveled)',
    'a honeybee': '0.015 m long, art w',
    'a die': '0.016 m across, art w (original art)',
    'a garden snail': '0.03 m long, art w',
    'a paperclip': '0.033 m long, art w (leveled)',
    'a strawberry': '0.035 m long, art h (leveled)',
    'a door key': '0.06 m long, art w (leveled)',
    'a hen’s egg': '0.06 m tall, art h',
    'a tennis ball': '0.067 m across, art w (original art)',
    'an apple': '0.08 m across, art w',
    'a monarch butterfly': '0.095 m wide, art w',
    'a light bulb': '0.11 m tall, art h',
    'a smartphone': '0.15 m tall, art h',
    'a house mouse': '0.17 m long, art w (leveled)',
    'a pencil': '0.19 m long, art w (leveled)',
    'a banana': '0.19 m long, art h (leveled)',
    'a soccer ball': '0.22 m across, art w',
    'a basketball': '0.24 m across, art w',
    'a birthday cake': '0.25 m across, art w',
    'a sneaker': '0.29 m long, art w',
    'a party balloon': '0.3 m tall, art h (original art)',
    'a pineapple': '0.35 m tall, art h',
    'a teddy bear': '0.35 m tall, art h',
    'a barn owl': '0.35 m tall, art h',
    'a house cat': '0.75 m long, art w (original art)',
    'a guitar': '1 m long, art h (leveled)',
    'a Labrador': '1.1 m long, art w (original art)',
    'an emperor penguin': '1.15 m tall, art h',
    'a giant tortoise': '1.3 m long, art w',
    'a person': '1.7 m tall, art h',
    'a bicycle': '1.75 m long, art w',
    'a sofa': '2 m wide, art w (original art)',
    'a door': '2 m tall, art h',
    'a horse': '2.4 m long, art w',
    'a moai statue': '4 m tall, art h',
    'a car': '4.5 m long, art w',
    'a saltwater crocodile': '4.5 m long, art w (original art)',
    'a great white shark': '4.6 m long, art w (original art)',
    'a canoe': '4.8 m long, art w',
    'a Formula 1 car': '5.6 m long, art w',
    'an African elephant': '6.5 m long, art w',
    'a sailing yacht': '10 m long, art w',
    'a family house': '10 m wide, art w',
    'a city bus': '12 m long, art w',
    'a T. rex': '12 m long, art w',
    'a humpback whale': '15 m long, art w',
    'a helicopter': '17 m long, art w',
    'an oak tree': '20 m tall, art h',
    'a steam locomotive': '20 m long, art w (original art)',
    'a jumbo jet': '70 m long, art w (original art)',
    'the Statue of Liberty': '93 m tall, art h (original art)',
    'a Saturn V rocket': '110 m tall, art h (original art)',
    'the London Eye': '135 m tall, art h',
    'a cruise ship': '300 m long, art w (original art)',
    'Tokyo Tower': '333 m tall, art h',
    'the Moon': '3474000 m across, art w',
    'the Earth': '12742000 m across, art w',
  };
  const pin = (t: (typeof THINGS)[number]): string => `${t.size} m ${t.dim}, art ${t.axis}${t.level ? ' (leveled)' : ''}${t.art ? ' (original art)' : ''}`;
  it('pins every thing’s measured dimension', () => {
    expect(Object.fromEntries(THINGS.map((t) => [t.name, pin(t)]))).toEqual(PINNED);
  });
  it('heights are drawn as heights, everything else along the width', () => {
    for (const t of THINGS) expect(t.axis, t.name).toBe(t.dim === 'tall' || (t.level && t.axis === 'h') ? 'h' : 'w');
  });
  it('the measured side of the drawn box is the thing’s size, whatever the picture’s shape', () => {
    for (const t of THINGS)
      for (const aspect of [0.4, 1, 2.5]) {
        const b = artBox(t, t.size, aspect);
        expect(measured(t, b), t.name).toBeCloseTo(t.size, 12);
        expect(b.w / b.h).toBeCloseTo(aspect, 9);
      }
  });
  it('original art has real proportions along its measured side', () => {
    // [measured side over the other side of the frame, at least, at most]
    const want: Record<string, [number, number]> = {
      'a die': [1, 1], 'a tennis ball': [1, 1], 'a party balloon': [1.15, 1.35], 'a house cat': [2.2, 2.8], 'a Labrador': [1.4, 1.9],
      'a saltwater crocodile': [7, 10], 'a sofa': [2, 2.6], 'a steam locomotive': [4, 5], 'a jumbo jet': [3.3, 4], 'a cruise ship': [4.5, 5.5],
      'a great white shark': [2.6, 3.2], 'a Saturn V rocket': [5.5, 7], 'the Statue of Liberty': [2.8, 3.4],
    };
    const drawn = THINGS.filter((t) => t.art);
    expect(drawn.map((t) => t.name).sort()).toEqual(Object.keys(want).sort());
    for (const t of drawn) {
      const r = t.axis === 'w' ? t.art!.w / t.art!.h : t.art!.h / t.art!.w;
      expect(r, t.name).toBeGreaterThanOrEqual(want[t.name]![0]);
      expect(r, t.name).toBeLessThanOrEqual(want[t.name]![1]);
    }
  });
  it('diagonal art is turned level along its measured side', () => {
    // A 45° bar from bottom-left to top-right, like a pencil emoji.
    const size = 40;
    const px = new Uint8ClampedArray(size * size * 4);
    for (let i = 4; i < 36; i++)
      for (let d = -1; d <= 1; d++) px[((size - 1 - i + d) * size + i) * 4 + 3] = 255;
    const { angle, elongation } = principalAxis(px, size);
    expect(elongation).toBeGreaterThan(3);
    expect(Math.abs(angle)).toBeCloseTo(Math.PI / 4, 1);
    // Turned so the axis lies flat (pencil) or stands up (rocket): a quarter turn at most, either way.
    expect(Math.abs(angle + levelTurn(angle, 'w'))).toBeCloseTo(0, 9);
    expect(Math.abs(angle + levelTurn(angle, 'h'))).toBeCloseTo(Math.PI / 2, 9);
    expect(levelTurn(0.02, 'w')).toBeCloseTo(-0.02, 9);
  });
});

describe('to-scale wording', () => {
  it('uses American English', () => {
    const text = THINGS.map((t) => `${t.name} ${t.fact}`).join(' ');
    for (const word of [/\bdice\b/, /\bfootball\b/, /\btrainer\b/, /\bdetached\b/, /colour/, /metre/]) expect(text).not.toMatch(word);
  });
});

describe('to-scale bullseyes (TS-08)', () => {
  it('a bullseye is within 10%, and “% right” never rounds up into one', () => {
    expect(isBull(0.9 * 3, 3)).toBe(true);
    expect(isBull(3 / 0.9, 3)).toBe(true);
    expect(mark(pointsFor(0.9 * 3, 3), isBull(0.9 * 3, 3))).toBe('🎯');
    expect(isBull(0.8995 * 3, 3)).toBe(false);
    expect(percentRight(0.8995 * 3, 3)).toBe(89);
    expect(percentRight(0.9 * 3, 3)).toBe(90);
    expect(mark(950, false)).toBe('🟩');
  });
});

describe('to-scale labels (TS-04)', () => {
  it('never overlap and stay on the stage', () => {
    const cases: [number, number, number, string, string][] = [
      [360, 60, 80, 'steam locomotive', 'Statue of Liberty'],
      [390, 120, 140, 'humpback whale', 'Saturn V rocket'],
      [360, 20, 345, 'emperor penguin', 'saltwater crocodile'],
      [300, 150, 152, 'Formula 1 car', 'African elephant'],
    ];
    for (const [W, a, b, n1, n2] of cases) {
      const { ref, target } = layoutLabels(W, a, b, Math.min(W * 0.46, labelWidth(n1, '20 m')), Math.min(W * 0.46, labelWidth(n2, '93 m')));
      expect(ref.mid + ref.width / 2 + 8).toBeLessThanOrEqual(target.mid - target.width / 2 + 1e-9);
      expect(ref.mid - ref.width / 2).toBeGreaterThanOrEqual(4 - 1e-9);
      expect(target.mid + target.width / 2).toBeLessThanOrEqual(W - 4 + 1e-9);
    }
  });
});

describe('to-scale dimensions and US units (design)', () => {
  it('every dimension has a question', () => {
    for (const t of THINGS) expect(DIM_QUESTION[t.dim], t.name).toMatch(/^How /);
  });
  it('US units read well', () => {
    expect(usText(0.006)).toBe('0.24 in');
    expect(usText(0.067)).toBe('2.6 in');
    expect(usText(2)).toBe('6.6 ft');
    expect(usText(333)).toBe('1,093 ft');
    expect(usText(12_742_000)).toBe('7,918 mi');
  });
});
