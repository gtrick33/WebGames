// Profile picture: the mark filling a circle-safe square (TikTok, Instagram, YouTube, X crop to a circle).
import { markSVG } from '../kit/kit.js';

export default async function (stage, d) {
  const { w, variant = 'blue' } = d;
  const bgs = {
    blue: 'radial-gradient(circle at 30% 25%, #4a62ff 0%, #2c45ff 45%, #1f30c9 100%)',
    paper: '#fff6ea',
    sunset: 'linear-gradient(135deg, #ff7a1a 0%, #ff5a6c 45%, #a45cff 100%)',
    ink: 'radial-gradient(circle at 30% 25%, #2a1a52 0%, #1d1238 60%, #0d0522 100%)',
  };
  stage.style.background = bgs[variant];
  // The G and corners without the tile, sized to sit inside the inscribed circle.
  const s = w * (variant === 'paper' ? 0.74 : 0.86);
  stage.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${markSVG({ size: s, square: variant === 'paper' })}</div>`;
  if (variant !== 'paper') {
    // A faint scanline sheen for depth.
    stage.insertAdjacentHTML('beforeend', `<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 3px, transparent 3px 9px)"></div>`);
  }
}
