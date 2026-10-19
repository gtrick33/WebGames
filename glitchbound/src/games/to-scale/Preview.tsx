import type { GamePreviewProps } from '../../platform/contract';
import { ease, fit, label, usePreviewCanvas } from '../../platform/previewLoop';
import { glyph } from './glyphs';
import { sizeText, THINGS, type Thing } from './objects';

/** Pairs worth comparing: a known thing beside one a few times bigger or smaller. */
const PAIRS: [string, string][] = [
  ['a person', 'a city bus'],
  ['a person', 'a horse'],
  ['a car', 'an African elephant'],
  ['a house cat', 'a bicycle'],
];
const byName = (n: string): Thing => THINGS.find((t) => t.name === n) ?? THINGS[0]!;

function image(src: string | undefined): HTMLImageElement | null {
  if (!src) return null;
  const i = new Image();
  i.src = src;
  return i;
}

/** To Scale's attract mode: a silhouette stretches and shrinks until it sits at its real size. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let n = Math.floor(Math.random() * PAIRS.length);
    let t = 0;
    let pics: [HTMLImageElement | null, HTMLImageElement | null, number, number] = [null, null, 1, 1];
    const load = (): void => {
      const [a, b] = PAIRS[n % PAIRS.length]!;
      const ga = glyph(byName(a).emoji, '#f4f7ff');
      const gb = glyph(byName(b).emoji, '#ffd23f');
      pics = [image(ga?.silhouette), image(gb?.silhouette), ga?.aspect ?? 1, gb?.aspect ?? 1];
    };
    load();
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#123a7a';
        ctx.fillRect(0, 0, w, h);
        // Blueprint grid.
        ctx.strokeStyle = 'rgba(185,200,236,0.16)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 14) {
          ctx.beginPath();
          ctx.moveTo(gx + 0.5, 0);
          ctx.lineTo(gx + 0.5, h);
          ctx.stroke();
        }
        for (let gy = 0; gy < h; gy += 14) {
          ctx.beginPath();
          ctx.moveTo(0, gy + 0.5);
          ctx.lineTo(w, gy + 0.5);
          ctx.stroke();
        }
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const [a, b] = PAIRS[n % PAIRS.length]!.map(byName) as [Thing, Thing];
        const ground = 150;
        // Meters to design units: the bigger of the two is about 100 units long (130 at the top of a wobble).
        const m = 100 / Math.max(a.size, b.size);
        const wobble = t < 2.6 ? 1 + Math.sin(t * 3.2) * 0.3 * (1 - ease(t / 2.6)) : 1;
        const box = (aspect: number, size: number): [number, number] => {
          // A thing's size is its longest side.
          const long = size * m;
          return aspect >= 1 ? [long, long / aspect] : [long * aspect, long];
        };
        const [aw, ah] = box(pics[2], a.size);
        const [bw, bh] = box(pics[3], b.size * wobble);
        const ax = 12;
        const bx = Math.max(ax + aw + 10, 100 - bw / 2 + 20);
        if (pics[0]?.complete) ctx.drawImage(pics[0], ax, ground - ah, aw, ah);
        if (pics[1]?.complete) ctx.drawImage(pics[1], Math.min(bx, 192 - bw), ground - bh, bw, bh);
        ctx.strokeStyle = '#f4f7ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(6, ground + 0.5);
        ctx.lineTo(194, ground + 0.5);
        ctx.stroke();
        // Ruler ticks.
        for (let i = 0; i <= 10; i++) {
          ctx.beginPath();
          ctx.moveTo(10 + i * 18, ground + 6);
          ctx.lineTo(10 + i * 18, ground + (i % 5 ? 10 : 14));
          ctx.stroke();
        }
        label(ctx, t > 2.6 ? `✓ ${sizeText(b.size)}` : 'How big?', 100, 182, 13, t > 2.6 ? '#ffd23f' : '#f4f7ff');
        ctx.restore();
        if (t > 4.4) {
          n++;
          load();
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
