import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pageSpecs, renderPage, robots, sitemap } from './scripts/seo.ts';

/** Adds modulepreload links for the given build files (paths under the site root) that the page doesn't load yet. */
function preload(html: string, files: string[]): string {
  const links = files.filter((f) => !html.includes(`"/${f}"`)).map((f) => `  <link rel="modulepreload" crossorigin href="/${f}">\n  `);
  return html.replace('</head>', `${links.join('')}</head>`);
}

/**
 * Writes the home page head in dev and, after a production build, one HTML file per route plus
 * sitemap.xml, robots.txt, 404.html and (when a publisher id is configured) ads.txt.
 */
function seoPages(siteUrl: string, adsenseClient: string): Plugin {
  let outDir = 'dist';
  // The game page's code is a chunk of its own (src/pages/loadGamePage.ts): its file and the chunks it needs.
  let gamePageCode: string[] = [];
  return {
    name: 'glitchbound-seo',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_, bundle) {
      const files = new Set<string>();
      const add = (file: string): void => {
        const chunk = bundle[file];
        if (files.has(file) || chunk?.type !== 'chunk') return;
        files.add(file);
        chunk.imports.forEach(add);
      };
      const page = Object.values(bundle).find((c) => c.type === 'chunk' && c.isDynamicEntry && c.facadeModuleId?.endsWith('/src/pages/GamePage.tsx'));
      if (page) add(page.fileName);
      else this.warn('the game page chunk was not found: game pages will not preload it');
      gamePageCode = [...files];
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return renderPage(html, pageSpecs(siteUrl)[0]!, siteUrl);
      },
    },
    closeBundle() {
      const indexPath = join(outDir, 'index.html');
      let template: string;
      try {
        template = readFileSync(indexPath, 'utf8');
      } catch {
        return; // not a client build (e.g. vitest)
      }
      for (const page of pageSpecs(siteUrl)) {
        const file = join(outDir, page.file);
        mkdirSync(dirname(file), { recursive: true });
        const html = renderPage(template, page, siteUrl);
        // A game page fetches the game page's code alongside the app's, so it renders in one go (src/main.tsx).
        writeFileSync(file, page.gamePage ? preload(html, gamePageCode) : html);
      }
      writeFileSync(join(outDir, 'sitemap.xml'), sitemap(siteUrl));
      writeFileSync(join(outDir, 'robots.txt'), robots(siteUrl));
      // ads.txt authorizes Google to sell ads on this domain (only when a publisher id is configured).
      if (/^ca-pub-\d{10,20}$/.test(adsenseClient)) {
        writeFileSync(join(outDir, 'ads.txt'), `google.com, ${adsenseClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || 'https://glitchboundstudio.com').replace(/\/+$/, '');
  return {
    base: '/',
    plugins: [react(), seoPages(siteUrl, env.VITE_ADSENSE_CLIENT ?? '')],
    // `npm run dev` proxies /api (and live-room sockets) to the Pages Functions (`npm run dev:api`,
    // port 8788). GB_API points it at another one, e.g. when several copies run side by side.
    server: { proxy: { '/api': { target: process.env.GB_API || 'http://127.0.0.1:8788', ws: true } } },
    build: {
      target: 'es2022',
      outDir: 'dist',
      assetsInlineLimit: 2048,
      reportCompressedSize: false,
    },
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.{ts,tsx}'],
      setupFiles: ['tests/setup.ts'],
    },
  };
});
