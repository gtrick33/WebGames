// Tiny static server for a built GlitchBound dist (and for the studio's own pages): Pages-style
// clean URLs (/games/x -> games/x.html), SPA fallback, and empty stubs for /api so pages stay quiet.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain', '.xml': 'application/xml', '.gif': 'image/gif', '.ico': 'image/x-icon',
};

async function isFile(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

/** Serves `roots` (first match wins) on `port`; returns the http.Server. */
export function serve(roots, port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (path.startsWith('/api/')) {
      res.writeHead(path === '/api/me' ? 401 : 404, { 'content-type': 'application/json' });
      res.end('{}');
      return;
    }
    path = normalize(path).replace(/^(\.\.[/\\])+/, '');
    for (const root of roots) {
      const base = join(root, path);
      const tries = extname(path) ? [base] : [base, `${base}.html`, join(base, 'index.html')];
      for (const f of tries) {
        if (await isFile(f)) {
          res.writeHead(200, { 'content-type': TYPES[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
          res.end(await readFile(f));
          return;
        }
      }
    }
    if (!extname(path)) {
      for (const root of roots) {
        const f = join(root, 'index.html');
        if (await isFile(f)) {
          res.writeHead(200, { 'content-type': TYPES['.html'] });
          res.end(await readFile(f));
          return;
        }
      }
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [port, ...roots] = process.argv.slice(2);
  await serve(roots, Number(port));
  console.log(`serving ${roots.join(', ')} on http://127.0.0.1:${port}`);
}
