import { describe, expect, it } from 'vitest';
import { DOORWAYS } from '../src/games/sigilfall/render3d/doorways';
import { stoneGate, timberGate } from '../src/games/sigilfall/render3d/gateways';
import { THEMES } from '../src/games/sigilfall/data/themes';
import { fights, type Fight } from './sigilfall-zfight';

const LOOKS = Object.values(THEMES);

const sum = (f: Fight[]): string => [...new Set(f.map((x) => `${x.plane} near ${x.at.join(',')}`))].slice(0, 8).join(' | ');

describe('Sigilfall: nothing built flickers', () => {
  const found: Record<string, string> = {};
  const check = (name: string, m: { pos: number[]; nor: number[]; idx: number[]; col: number[] }): void => {
    const f = fights(m);
    if (f.length) found[name] = `${f.length}: ${sum(f)}`;
  };

  it('no gate has two faces fighting over one place', () => {
    for (const span of [3, 4, 5, 7]) {
      for (const ends of [undefined, true, 'east', 'west'] as const) {
        for (const shut of [false, true]) {
          check(`stone ${span} ${ends} ${shut}`, stoneGate({ span, body: '#a69e94', trim: '#d8c8a0', light: '#7fe06a', seed: 5, ...(ends ? { ends } : {}), shut }).b.m);
        }
      }
      check(`timber ${span}`, timberGate({ span, body: '#6a4a2a', trim: '#c8a878', light: '#7fe06a', seed: 5 }).b.m);
    }
    expect(found).toEqual({});
  });

  it('no way down (a cave mouth, a stair, a culvert, a barrow) has either', () => {
    const bad: Record<string, string> = {};
    for (const [id, d] of Object.entries(DOORWAYS)) {
      const f = fights(d.build(LOOKS[0]!).m);
      if (f.length) bad[id] = `${f.length}: ${sum(f)}`;
    }
    expect(bad).toEqual({});
  });
});
