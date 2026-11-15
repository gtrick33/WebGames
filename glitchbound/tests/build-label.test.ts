import { describe, expect, it } from 'vitest';
import { buildLabel } from '../src/buildLabel';

describe('the build label on the title screen', () => {
  it('names a deployed build by its CI run and commit, and any other as dev', () => {
    expect(buildLabel({ run: '660', sha: '76c4db7' })).toBe('v660 · 76c4db7');
    expect(buildLabel({ run: null, sha: 'abc1234' })).toBe('dev · abc1234');
    expect(buildLabel({ run: null, sha: '' })).toBe('dev');
  });

  it('is built in', () => {
    expect(buildLabel()).toMatch(/^(v\d+|dev)( · [0-9a-f]{7})?$/);
  });
});
