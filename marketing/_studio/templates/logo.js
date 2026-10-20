// Logo set: the mark, horizontal and stacked lockups, light or dark, on transparent or brand paper.
import { markSVG, wordmark, MOTTO } from '../kit/kit.js';

export default async function (stage, d) {
  const { w, h, kind = 'mark', dark = false, bg = null, square = true } = d;
  stage.style.background = bg ?? 'transparent';
  stage.classList.toggle('on-dark', dark);
  const box = document.createElement('div');
  Object.assign(box.style, { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: kind === 'stacked' ? 'column' : 'row' });
  const pad = d.pad ?? 0.08;
  if (kind === 'mark') box.innerHTML = markSVG({ size: Math.min(w, h) * (1 - pad * 2), square });
  if (kind === 'wordmark') box.innerHTML = wordmark(h * 0.62);
  if (kind === 'lockup') {
    const m = h * (1 - pad * 2);
    box.style.gap = `${m * 0.28}px`;
    box.innerHTML = markSVG({ size: m }) + wordmark(m * 0.62);
  }
  if (kind === 'stacked') {
    const m = w * 0.42;
    box.style.gap = `${w * 0.04}px`;
    box.innerHTML = `${markSVG({ size: m })}${wordmark(w * 0.15)}
      ${d.motto === false ? '' : `<div class="display" style="font-size:${w * 0.062}px;text-align:center;line-height:1.05;color:${dark ? '#fff' : 'var(--ink)'}">${MOTTO[0]}<br><span class="grad-text">${MOTTO[1]}</span></div>`}`;
  }
  stage.appendChild(box);
}
