#!/usr/bin/env node
/**
 * Tiny local server for drawing a game's artwork with canvas in the browser and saving it to disk
 * (no image libraries are installed in this project).
 *
 *   node .claude/skills/create-game/scripts/art-server.mjs <art.html> <outDir> [port]
 *
 * Serves <art.html> at http://127.0.0.1:<port>/ (default 8795) with a `saveArt(canvas, name)` helper
 * injected, and writes PUT /save/<name> to <outDir>/<name>. Only tile.webp, wide.webp and og.jpg are
 * accepted. In art.html:
 *
 *   <canvas id="tile" width="800" height="800"></canvas>
 *   <canvas id="wide" width="1200" height="480"></canvas>
 *   <canvas id="og" width="1200" height="630"></canvas>
 *   <script> draw…; then: await saveArt(tile, 'tile.webp'); await saveArt(wide, 'wide.webp'); await saveArt(og, 'og.jpg'); </script>
 *
 * saveArt picks the format from the name (webp quality 0.82, jpeg 0.85) and resolves to the saved size in bytes.
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [htmlPath, outDir, portArg] = process.argv.slice(2);
if (!htmlPath || !outDir) {
  console.error('usage: art-server.mjs <art.html> <outDir> [port]');
  process.exit(1);
}
const port = Number(portArg ?? 8795);
const out = resolve(outDir);
mkdirSync(out, { recursive: true });
const ALLOWED = new Set(['tile.webp', 'wide.webp', 'og.jpg']);

const helper = `<script>
window.saveArt = (canvas, name) => new Promise((ok, fail) => {
  const type = name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
  canvas.toBlob(async (blob) => {
    if (!blob) return fail(new Error('toBlob failed'));
    const r = await fetch('/save/' + name, { method: 'PUT', body: blob });
    r.ok ? ok(blob.size) : fail(new Error(await r.text()));
  }, type, type === 'image/jpeg' ? 0.85 : 0.82);
});
</script>`;

createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = readFileSync(htmlPath, 'utf8');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html.includes('<head>') ? html.replace('<head>', `<head>${helper}`) : helper + html);
    return;
  }
  const m = req.method === 'PUT' && req.url?.match(/^\/save\/([a-z]+\.(?:webp|jpg))$/);
  if (m && ALLOWED.has(m[1])) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      writeFileSync(join(out, m[1]), buf);
      console.log(`saved ${m[1]} (${Math.round(buf.length / 1024)} KB)`);
      res.writeHead(200).end('ok');
    });
    return;
  }
  res.writeHead(404).end('not found');
}).listen(port, '127.0.0.1', () => console.log(`art server: http://127.0.0.1:${port}/ → ${out}`));
