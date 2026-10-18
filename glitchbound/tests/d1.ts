import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from '../server/http';

// Tests run from the project root (as vite.config.ts assumes).
const MIGRATIONS = join(process.cwd(), 'migrations');

/** A D1 stand-in for server tests: in-memory SQLite with every migration applied. */
export function memoryD1(): D1Database & { sqlite: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  const statement = (sql: string, values: SQLInputValue[] = []): D1PreparedStatement => ({
    bind: (...v) => statement(sql, v as SQLInputValue[]),
    first: async <T>() => (db.prepare(sql).get(...values) as T | undefined) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...values) as T[] }),
    run: async () => db.prepare(sql).run(...values),
  });
  // Like D1, a batch is one transaction, and batches from requests running at once never interleave.
  let queue: Promise<unknown> = Promise.resolve();
  const batch = async (list: D1PreparedStatement[]): Promise<unknown[]> => {
    db.exec('BEGIN');
    try {
      const out: unknown[] = [];
      for (const s of list) out.push(await s.run());
      db.exec('COMMIT');
      return out;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
  return {
    sqlite: db,
    prepare: (sql) => statement(sql),
    batch: (list) => {
      const run = queue.then(() => batch(list));
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
