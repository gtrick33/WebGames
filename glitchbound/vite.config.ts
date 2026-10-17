import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pageSpecs, renderPage, robots, sitemap } from './scripts/seo.ts';

/**
 * Writes the home page head in dev and, after a production build, one HTML file per route plus
 * sitemap.xml, robots.txt, 404.html and (when a publisher id is configured) ads.txt.
 */
function seoPages(siteUrl: string, adsenseClient: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'glitchbound-seo',
    configResolved(config) {
      outDir = config.build.outDir;
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
        writeFileSync(file, renderPage(template, page, siteUrl));
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
    // `npm run dev` proxies /api to the Pages Functions (`npm run dev:api`, port 8788).
    server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
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
