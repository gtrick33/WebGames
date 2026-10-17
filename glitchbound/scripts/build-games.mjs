// Builds every game that lives in this repository into dist/play/<slug>/, so the arcade serves its
// own games (same origin, no external domains). Runs after `vite build`.
// Each game is its own Vite project; it must use a relative base ('./') so it works under /play/<slug>/.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** slug -> project folder (relative to glitchbound/). Add new in-repo games here. */
export const GAME_BUILDS = {
  'neon-rush': '../neon-rush',
};

for (const [slug, dir] of Object.entries(GAME_BUILDS)) {
  const project = resolve(root, dir);
  const out = resolve(root, 'dist', 'play', slug);
  if (!existsSync(resolve(project, 'node_modules'))) {
    console.info(`[games] installing ${slug} dependencies`);
    execSync('npm ci --no-audit --no-fund', { cwd: project, stdio: 'inherit' });
  }
  console.info(`[games] building ${slug} -> dist/play/${slug}/`);
  execSync(`npx vite build --outDir "${out}" --emptyOutDir`, { cwd: project, stdio: 'inherit' });
}
