import { defineConfig, type Plugin } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pkg from './package.json' with { type: 'json' };

/** Emit sw.js with every built file precached, so the game works offline after the very first visit. */
function serviceWorker(): Plugin {
  return {
    name: 'neon-rush-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !/icon-512|_headers/.test(f));
      files.push('manifest.webmanifest', 'icon.svg', 'icon-192.png');
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const template = readFileSync(new URL('./scripts/sw-template.js', import.meta.url), 'utf8');
      const source = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files.map((f) => `./${f}`)));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 2048,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 900,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
