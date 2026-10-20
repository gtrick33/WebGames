// Channel art and headers: the lockup, motto and URL inside the platform's safe area, with a
// scattered collage of the arcade's real tile art around it (seen where the platform shows more).
import { MOTTO, SITE, hash, markSVG, wordmark } from '../kit/kit.js';

export default async function (stage, d) {
  const { w, h, safe = [0, 0, w, h], games = [], dark = false, align = 'center', count = '19', seed = 1, tileSize = Math.round(h * 0.28), clear = 0.06 } = d;
  const [sx, sy, sw, sh] = safe;
  stage.style.background = dark ? 'radial-gradient(circle at 50% 50%, #2a1a52, #0d0522 75%)' : 'var(--paper)';
  stage.insertAdjacentHTML('beforeend', `<div class="abs ${dark ? '' : 'dots'}" style="inset:0;opacity:.8"></div>`);
  // Soft color blobs behind everything.
  stage.insertAdjacentHTML('beforeend', `<div class="abs" style="inset:0;background:
    radial-gradient(circle at 12% 20%, rgba(42,209,240,.28), transparent 32%),
    radial-gradient(circle at 88% 78%, rgba(255,79,200,.24), transparent 34%),
    radial-gradient(circle at 75% 10%, rgba(255,201,40,.30), transparent 30%),
    radial-gradient(circle at 20% 92%, rgba(182,230,44,.26), transparent 30%)"></div>`);

  // Tile collage: a jittered grid, leaving the safe area (plus a margin) clear.
  const pad = Math.max(w, h) * clear;
  const step = tileSize * 1.18;
  let k = 0;
  let placed = seed * 5;
  for (let y = -tileSize * 0.3; tileSize > 20 && y < h; y += step * 0.92) {
    for (let x = -tileSize * 0.3 + ((Math.round(y / step) % 2) * step) / 2; x < w; x += step) {
      const jx = (hash(k * 3 + seed) - 0.5) * tileSize * 0.35;
      const jy = (hash(k * 5 + seed) - 0.5) * tileSize * 0.35;
      const cx = x + jx + tileSize / 2, cy = y + jy + tileSize / 2;
      k++;
      const r = tileSize / 2;
      if (cx + r > sx - pad && cx - r < sx + sw + pad && cy + r > sy - pad * 0.6 && cy - r < sy + sh + pad * 0.6) continue;
      const g = games[placed++ % games.length];
      if (!g) continue;
      const rot = (hash(k * 7 + seed) - 0.5) * 16;
      const s = 0.82 + hash(k * 11 + seed) * 0.3;
      stage.insertAdjacentHTML('beforeend', `<div class="tile-art abs" style="left:${x + jx}px;top:${y + jy}px;width:${tileSize * s}px;height:${tileSize * s}px;transform:rotate(${rot}deg);border-radius:${tileSize * 0.16}px;border-width:${Math.max(3, tileSize * 0.022)}px;box-shadow:${tileSize * 0.05}px ${tileSize * 0.05}px 0 var(--ink)"><img src="${g.art.tile}"></div>`);
    }
  }

  // The message, scaled to the safe area.
  const u = Math.min(sw / 1546, sh / 423);
  const box = document.createElement('div');
  box.className = `abs ${dark ? 'on-dark' : ''}`;
  Object.assign(box.style, { left: `${sx}px`, top: `${sy}px`, width: `${sw}px`, height: `${sh}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align === 'right' ? 'flex-end' : 'center', textAlign: align === 'right' ? 'right' : 'center', gap: `${18 * u}px` });
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:${30 * u}px">${markSVG({ size: 150 * u })}${wordmark(118 * u)}</div>
    <div class="display" style="font-size:${74 * u}px;color:${dark ? '#fff' : 'var(--ink)'}">${MOTTO[0]} <span class="grad-text">${MOTTO[1]}</span></div>
    <div style="display:flex;gap:${18 * u}px;align-items:center;margin-top:${8 * u}px;flex-wrap:nowrap">
      <span class="sticker" style="font-size:${34 * u}px;padding:${10 * u}px ${26 * u}px;border-width:${4 * u + 1}px;box-shadow:${7 * u}px ${7 * u}px 0 var(--ink);background:var(--cyan)">${count} free browser games</span>
      <span class="sticker" style="font-size:${34 * u}px;padding:${10 * u}px ${26 * u}px;border-width:${4 * u + 1}px;box-shadow:${7 * u}px ${7 * u}px 0 var(--ink);background:var(--yellow)">New dailies every day</span>
      <span class="sticker" style="font-size:${34 * u}px;padding:${10 * u}px ${26 * u}px;border-width:${4 * u + 1}px;box-shadow:${7 * u}px ${7 * u}px 0 var(--ink);background:#fff">${SITE}</span>
    </div>`;
  stage.appendChild(box);
}
