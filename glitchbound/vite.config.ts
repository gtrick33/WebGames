import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageSpecs, renderPage, robots, sitemap } from './scripts/seo.ts';
import { landMapText } from './scripts/sigilfall-landmap-file.ts';
import { paintError } from './src/games/sigilfall/data/ground.ts';

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

/** A land's file the editor writes: its hand-placed props (data/placed.ts), or its map (data/landmaps.ts). */
const EDITED_FILE = /[\\/]data[\\/](placed|maps)[\\/][a-z0-9-]+\.json$/;

/**
 * A land's map with ground painted on it by hand, checked against its file (src/games/sigilfall/data/ground.ts
 * paintError): the text to write, or why not.
 */
function paintedMap(root: string, land: string, body: unknown): { text: string } | { error: string } {
  const file = join(root, 'src/games/sigilfall/data/maps', `${land}.json`);
  if (!existsSync(file)) return { error: `${land} has no map file` };
  const now = JSON.parse(readFileSync(file, 'utf8')) as { map: string[]; placed: unknown[] };
  const rows = (body as { rows?: unknown } | null)?.rows;
  const error = paintError(now.map, rows);
  // (painted, the land is worked by hand: the generator has no say in it any more)
  return error ? { error } : { text: landMapText({ hand: true, map: rows as string[], placed: now.placed }) };
}

/**
 * Dev server only: Sigilfall's placement editor (src/games/sigilfall/ui/PlaceEditor.tsx, `?place` on the game's page)
 * POSTs a land's hand-placed props here, and they are written to its data file, data/placed/<land>.json, one to a line
 * and in the order of the land's rows, so a change reads as a change. A land with none left has no file. Ground
 * painted on a land is written to its map file, data/maps/<land>.json, its rows as they are now.
 */
function placementEditor(): Plugin {
  const entry = (p: unknown): string | null => {
    if (!p || typeof p !== 'object') return null;
    const o = p as Record<string, unknown>;
    const tile = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1000;
    if (!tile(o.tx) || !tile(o.ty) || typeof o.prop !== 'string' || !/^[a-z0-9-]+(:#[0-9a-f]{6})?$/.test(o.prop)) return null;
    if (o.face !== undefined && o.face !== 'n' && o.face !== 'e' && o.face !== 'w') return null;
    if (o.solid !== undefined && typeof o.solid !== 'boolean') return null;
    return JSON.stringify({ tx: o.tx, ty: o.ty, prop: o.prop, ...(o.face ? { face: o.face } : {}), ...(o.solid ? { solid: true } : {}) });
  };
  return {
    name: 'sigilfall-placement-editor',
    apply: 'serve',
    // (the editor holds the change already, so a land file written or taken away reloads nothing under it: only
    // data/placed.ts, which looks for the files, takes it in, and the next page load reads it. Written again after it
    // was taken away, the file was a module nothing imported any more, and the dev server reloaded the whole page)
    hotUpdate: {
      order: 'post',
      handler({ file, modules }) {
        if (!EDITED_FILE.test(file)) return;
        return modules.filter((m) => !m.file || !EDITED_FILE.test(m.file));
      },
    },
    configureServer(server) {
      server.middlewares.use('/__sigilfall/placed', (req, res) => {
        const land = new URL(req.url ?? '', 'http://x').searchParams.get('land') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9-]+$/.test(land)) {
          res.statusCode = 400;
          res.end('bad request');
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          let list: unknown;
          try {
            list = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            list = null;
          }
          const lines = Array.isArray(list) ? list.map(entry) : null;
          if (!lines || lines.some((l) => l === null)) {
            res.statusCode = 400;
            res.end('bad list');
            return;
          }
          const rows = (list as { tx: number; ty: number }[]).map((p, i) => ({ p, line: lines[i]! })).sort((a, b) => a.p.ty - b.p.ty || a.p.tx - b.p.tx);
          const file = join(server.config.root, 'src/games/sigilfall/data/placed', `${land}.json`);
          if (!rows.length) rmSync(file, { force: true });
          else {
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, `[\n${rows.map((r) => `  ${r.line}`).join(',\n')}\n]\n`);
          }
          res.end('saved');
        });
      });
      server.middlewares.use('/__sigilfall/landmap', (req, res) => {
        const land = new URL(req.url ?? '', 'http://x').searchParams.get('land') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9-]+$/.test(land)) {
          res.statusCode = 400;
          res.end('bad request');
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          let body: unknown = null;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            /* answered below */
          }
          const out = paintedMap(server.config.root, land, body);
          if ('error' in out) {
            res.statusCode = 400;
            res.end(out.error);
            return;
          }
          writeFileSync(join(server.config.root, 'src/games/sigilfall/data/maps', `${land}.json`), out.text);
          res.end('saved');
        });
      });
    },
  };
}

/** Test files that need a page to themselves (see `test.projects` below). */
const ISOLATED = ['tests/ad-rules.test.tsx', 'tests/cloud-save.test.ts', 'tests/looks.test.tsx', 'tests/no-card-blink.test.ts', 'tests/party-room-name.test.tsx', 'tests/stage.test.tsx'];

/**
 * Which build this is, shown small on Sigilfall's title screen (the owner: "make a version please on the main screen
 * somewhere subtle so we can track the latest version"): the CI run that built and deployed it (a number that only
 * goes up), its commit and its day. Built anywhere else it is "dev" and the checkout's commit.
 */
function buildInfo(): { run: string | null; sha: string; day: string } {
  let sha = process.env.GITHUB_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { cwd: HERE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = '';
    }
  }
  return { run: process.env.GITHUB_RUN_NUMBER ?? null, sha: sha.slice(0, 7), day: new Date().toISOString().slice(0, 10) };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || 'https://glitchboundstudio.com').replace(/\/+$/, '');
  return {
    base: '/',
    define: { __BUILD__: JSON.stringify(buildInfo()) },
    plugins: [react(), seoPages(siteUrl, env.VITE_ADSENSE_CLIENT ?? ''), reviewShots(), placementEditor()],
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
