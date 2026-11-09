import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageSpecs, renderPage, robots, sitemap } from './scripts/seo.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

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
  // The two fonts every page uses: their built files.
  let fonts: string[] = [];
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
      fonts = Object.keys(bundle).filter((f) => /(bricolage-grotesque-latin-wght-normal|space-mono-latin-700-normal)[^/]*\.woff2$/.test(f));
      if (fonts.length !== 2) this.warn(`expected two fonts to preload, found ${fonts.length}`);
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
      // (a chunk of nothing but styles is dropped from the build after the list was made: it has no file to fetch)
      const pageCode = gamePageCode.filter((f) => existsSync(join(outDir, f)));
      for (const page of pageSpecs(siteUrl)) {
        const file = join(outDir, page.file);
        mkdirSync(dirname(file), { recursive: true });
        const fontLinks = fonts.map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${f}">`).join('\n  ');
        const html = renderPage(template, page, siteUrl).replace('</head>', `  ${fontLinks}\n  </head>`);
        // A game page fetches the game page's code alongside the app's, so it renders in one go (src/main.tsx).
        writeFileSync(file, page.gamePage ? preload(html, pageCode) : html);
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

/**
 * Dev server only: Sigilfall's review screenshots (`window.__rbShot` on the dev page) are POSTed here
 * as PNG data and saved under docs/review/, so a phase's screenshots are reproducible files.
 */
function reviewShots(): Plugin {
  return {
    name: 'sigilfall-review-shots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__sigilfall/shot', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9-]+\/[a-z0-9-]+\.(png|jpg)$/.test(name)) {
          res.statusCode = 400;
          res.end('bad request');
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const file = join(server.config.root, 'docs/review', name);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, Buffer.concat(chunks));
          res.end('saved');
        });
      });
    },
  };
}

/** Test files that need a page to themselves (see `test.projects` below). */
const ISOLATED = ['tests/ad-rules.test.tsx', 'tests/looks.test.tsx', 'tests/no-card-blink.test.ts', 'tests/party-room-name.test.tsx', 'tests/stage.test.tsx'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || 'https://glitchboundstudio.com').replace(/\/+$/, '');
  return {
    base: '/',
    plugins: [react(), seoPages(siteUrl, env.VITE_ADSENSE_CLIENT ?? ''), reviewShots()],
    // `npm run dev` proxies /api (and live-room sockets) to the Pages Functions (`npm run dev:api`,
    // port 8788). GB_API points it at another one, e.g. when several copies run side by side.
    server: {
      // A worktree's node_modules is a link to the main checkout's, where the fonts are: without this they don't load in dev.
      fs: { allow: [HERE, realpathSync(join(HERE, 'node_modules'))] },
      proxy: { '/api': { target: process.env.GB_API || 'http://127.0.0.1:8788', ws: true } },
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      assetsInlineLimit: 2048,
      reportCompressedSize: false,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['tests/setup.ts'],
      // Most test files share their workers (a third less time, which is most of the CI bill; tests/setup.ts gives each
      // file fresh modules). The few that leave the page in a state the next would trip on keep a fresh one.
      projects: [
        { extends: true, test: { name: 'shared', isolate: false, include: ['tests/**/*.test.{ts,tsx}'], exclude: ISOLATED } },
        { extends: true, test: { name: 'isolated', include: ISOLATED } },
      ],
    },
  };
});
