// Ties edits to what happened in a take instead of to raw seconds, so a game can be re-recorded
// (new run, different timing) and every cut and caption still lands on the right moment.
//
// A time is either seconds, 'end', or [markName, index, offset]: the index-th mark of that name
// (negative counts from the last) plus offset seconds. ['end', 0, -5] is five seconds before the end.
// Text may contain {mark.field} tokens, filled from the first mark of that name's data.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STUDIO } from '../lib/site.mjs';

const cache = new Map();
export function take(slug, t = 'a') {
  const key = `${slug}/${t}`;
  if (!cache.has(key)) {
    const f = join(STUDIO, '.cache/footage', slug, `${t}.json`);
    if (!existsSync(f)) {
      // GB_LENIENT=1 lets the plan build while some takes are still being recorded (those videos
      // come out wrong and must not be rendered then).
      if (process.env.GB_LENIENT) return { seconds: 1, marks: [] };
      throw new Error(`no take ${key} (record it with capture/record.mjs)`);
    }
    cache.set(key, JSON.parse(readFileSync(f, 'utf8')));
  }
  return cache.get(key);
}

export function mark(slug, t, name, n = 0) {
  const list = take(slug, t).marks.filter((m) => m.name === name);
  return list[n < 0 ? list.length + n : n];
}

export function time(slug, t, v) {
  const info = take(slug, t);
  if (typeof v === 'number') return Math.max(0, Math.min(info.seconds, v));
  if (v === 'end') return info.seconds;
  if (Array.isArray(v)) {
    const [name, n = 0, off = 0] = v;
    if (name === 'end') return Math.max(0, info.seconds + off);
    const m = mark(slug, t, name, n);
    if (!m && process.env.GB_LENIENT) return 0;
    if (!m) throw new Error(`${slug}/${t}: no mark ${name}[${n}] (has ${[...new Set(info.marks.map((x) => x.name))].join(', ')})`);
    return Math.max(0, Math.min(info.seconds, m.t + off));
  }
  throw new Error(`bad time ${JSON.stringify(v)}`);
}

/** Resolves clip specs ({slug, take, from, to | len, speed}) to seconds. */
export function clips(list, defaults = {}) {
  return list.map((c0) => {
    const c = { take: 'a', ...defaults, ...c0 };
    const from = time(c.slug, c.take, c.from ?? 0);
    const to = c.len !== undefined ? Math.min(take(c.slug, c.take).seconds, from + c.len) : time(c.slug, c.take, c.to ?? 'end');
    return { ...c, from: +from.toFixed(3), to: +Math.max(from + 0.5, to).toFixed(3) };
  });
}

/** Output time of a moment in the source footage, given the resolved clips (or null if cut out). */
export function outputTime(resolved, slug, t, v) {
  const src = time(slug, t, v);
  let at = 0;
  for (const c of resolved) {
    const dur = (c.to - c.from) / (c.speed ?? 1);
    if (c.slug === slug && c.take === t && src >= c.from - 0.01 && src <= c.to + 0.01) return at + (src - c.from) / (c.speed ?? 1);
    at += dur;
  }
  return null;
}

/** Fills {mark.field} tokens from a take's marks. */
export function fill(text, slug, t = 'a') {
  return String(text).replace(/\{(\w+)\.(\w+)\}/g, (_, name, field) => {
    const m = mark(slug, t, name);
    return m?.data?.[field] ?? '';
  });
}
