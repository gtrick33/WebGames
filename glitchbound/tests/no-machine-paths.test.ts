/**
 * No test or source file names a path on one particular machine. A test that wrote a note for its author into a
 * folder under the system's temporary directory passed where it was written and failed on the build machine, where
 * that folder doesn't exist, and so held up a deploy (2026-11-13). Tests that need a file make it under os.tmpdir().
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KINDS = /\.(ts|tsx|mjs|cjs|js)$/;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (KINDS.test(name)) out.push(p);
  }
  return out;
}

describe('no path of one machine', () => {
  it('no test, source file or script reads or writes under a fixed temporary or home folder', () => {
    // (put together here, so this file isn't one of them)
    const fixed = new RegExp(`['"\`]/(${['tmp', 'home', 'root', 'Users'].join('|')})/`);
    const bad: string[] = [];
    for (const dir of ['tests', 'src', 'scripts', 'server', 'functions']) {
      for (const f of files(dir)) {
        const lines = readFileSync(f, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (fixed.test(line)) bad.push(`${f}:${i + 1}`);
        });
      }
    }
    expect(bad).toEqual([]);
  });
});
