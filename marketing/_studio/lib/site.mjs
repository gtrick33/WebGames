// Starts what the studio records from and renders against:
//  - a Vite dev server on a frozen copy of the site (.cache/site, exported from git HEAD), so recorders
//    and templates can import the games' own modules (/src/games/...);
//  - a static server for the production build (NEON RUSH lives at /play/neon-rush/ only there), plus
//    the studio's own folders, with /api stubbed out.
import { spawn, execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

export const STUDIO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = resolve(STUDIO, '../..');
export const MARKETING = resolve(STUDIO, '..');
export const SITE = join(STUDIO, '.cache/site/glitchbound');
export const NODE = process.execPath;

export const DEV_PORT = 7810;
export const NEON_PORT = 7812;
export const NEON = `http://127.0.0.1:${NEON_PORT}`;
export const STATIC_PORT = 7811;
export const DEV = `http://127.0.0.1:${DEV_PORT}`;
export const STATIC = `http://127.0.0.1:${STATIC_PORT}`;

/** Exports git HEAD's site into .cache/site and builds it (once; delete .cache/site to refresh). */
export function ensureSite() {
  if (existsSync(join(SITE, 'dist/index.html'))) return;
  const out = join(STUDIO, '.cache/site');
  execSync(`mkdir -p "${out}" && git -C "${REPO}" archive HEAD glitchbound neon-rush | tar -x -C "${out}"`, { stdio: 'inherit' });
  for (const p of ['glitchbound', 'neon-rush']) {
    if (!existsSync(join(out, p, 'node_modules'))) execSync(`ln -s "${join(REPO, p, 'node_modules')}" "${join(out, p, 'node_modules')}"`);
  }
  const env = { ...process.env, PATH: `${dirname(NODE)}:${process.env.PATH}` };
  execSync('npx vite build && node scripts/build-games.mjs', { cwd: SITE, stdio: 'inherit', env });
}

async function up(url, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not come up`);
}

/** Starts both servers (reusing ones already running) and returns a stop() function. */
export async function startSite({ dev = true, neon = false } = {}) {
  ensureSite();
  const stops = [];
  let staticUp = false;
  try { staticUp = (await fetch(`${STATIC}/index.html`)).ok; } catch { /* free */ }
  if (!staticUp) {
    const s = await serve([join(SITE, 'dist'), MARKETING], STATIC_PORT);
    stops.push(() => s.close());
  }
  if (dev) {
    let devUp = false;
    try { devUp = (await fetch(`${DEV}/`)).ok; } catch { /* free */ }
    if (!devUp) {
      // node_modules is a symlink to the real checkout's, which Vite's fs allow-list would refuse (fonts).
      writeFileSync(join(SITE, 'vite.studio.config.ts'), "import base from './vite.config.ts';\nimport { mergeConfig } from 'vite';\n" +
        "export default (env: any) => mergeConfig((base as any)(env), { server: { fs: { strict: false }, hmr: false } });\n");
      const child = spawn(NODE, ['node_modules/vite/bin/vite.js', '--config', 'vite.studio.config.ts', '--port', String(DEV_PORT), '--strictPort', '--host', '127.0.0.1'], {
        cwd: SITE,
        env: { ...process.env, GB_API: STATIC },
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      stops.push(() => child.kill());
      await up(`${DEV}/`);
    }
  }
  if (neon) {
    let neonUp = false;
    try { neonUp = (await fetch(`${NEON}/`)).ok; } catch { /* free */ }
    if (!neonUp) {
      // NEON RUSH is its own Vite project; its dev build exposes the app as window.__neon for the bot.
      const dir = join(STUDIO, '.cache/site/neon-rush');
      writeFileSync(join(dir, 'vite.studio.config.ts'), "import base from './vite.config.ts';\nimport { mergeConfig } from 'vite';\n" +
        "export default (env: any) => mergeConfig((base as any)(env), { server: { fs: { strict: false }, hmr: false } });\n");
      const child = spawn(NODE, ['node_modules/vite/bin/vite.js', '--config', 'vite.studio.config.ts', '--port', String(NEON_PORT), '--strictPort', '--host', '127.0.0.1'], {
        cwd: dir, stdio: ['ignore', 'ignore', 'inherit'],
      });
      stops.push(() => child.kill());
      await up(`${NEON}/`);
    }
  }
  return () => stops.forEach((f) => f());
}
