/**
 * Paints photo levels: the photograph with the tennis ball composited in at the photo's own
 * resolution, lit and tinted to match its surroundings, slightly softened like the rest of the
 * photo, and sometimes partly tucked under nearby texture. Browser only (canvas).
 */
import { PHOTO_DIR } from './photos';
import { W, type Ball, type Scene } from './scene';

const TAU = Math.PI * 2;

/**
 * A photographic tennis ball centerd on (0, 0): soft contact shadow, felt-yellow body with fine
 * speckle, the curved seam, sphere shading lit from the top left, and a fuzzy rim.
 */
function drawPhotoBall(ctx: CanvasRenderingContext2D, b: Ball, seed: number): void {
  const R = b.r;
  let s = (seed % 2147483646) + 1;
  const rnd = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
  // Contact shadow, down and to the right of the light.
  const sx = R * 0.28;
  const sy = R * 0.78;
  const sh = ctx.createRadialGradient(sx, sy, R * 0.05, sx, sy, R * 1.25);
  sh.addColorStop(0, 'rgba(0,0,0,0.5)');
  sh.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(sx, sy, R * 1.25, R * 0.62, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#cfe23b';
  ctx.fillRect(-R, -R, R * 2, R * 2);
  // Felt: fine light and dark speckle.
  const dots = Math.min(900, Math.round(R * R * 1.6));
  for (let i = 0; i < dots; i++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * R;
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,210,0.22)' : 'rgba(90,100,0,0.2)';
    const z = Math.max(0.25, R * 0.035);
    ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, z, z);
  }
  // The seam: two facing curves, slightly narrower towards the edge of the sphere.
  ctx.rotate(b.rot);
  ctx.strokeStyle = 'rgba(245,245,235,0.92)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.6, R * 0.09);
  ctx.beginPath();
  ctx.arc(-R * 1.22, 0, R * 0.92, -0.85, 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(R * 1.22, 0, R * 0.92, Math.PI - 0.85, Math.PI + 0.85);
  ctx.stroke();
  ctx.rotate(-b.rot);
  // Sphere shading: highlight top-left, falling into shadow bottom-right.
  const g = ctx.createRadialGradient(-R * 0.42, -R * 0.45, R * 0.05, -R * 0.1, -R * 0.1, R * 1.25);
  g.addColorStop(0, 'rgba(255,255,235,0.7)');
  g.addColorStop(0.3, 'rgba(255,255,235,0.14)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(0.88, 'rgba(25,30,0,0.45)');
  g.addColorStop(1, 'rgba(15,20,0,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  // Fuzzy rim: short fibres breaking the perfect circle.
  ctx.lineWidth = Math.max(0.3, R * 0.04);
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * TAU + rnd() * 0.05;
    const lit = Math.cos(a + 2.4) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(${170 + lit * 60 | 0},${185 + lit * 55 | 0},${40 + lit * 40 | 0},0.55)`;
    const r0 = R * 0.96;
    const r1 = R * (1.02 + rnd() * 0.05);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a + 0.04) * r1, Math.sin(a + 0.04) * r1);
    ctx.stroke();
  }
}

const images = new Map<string, Promise<HTMLImageElement>>();

/** Loads (and caches) a library photo. Failed loads are forgotten so a retry fetches again. */
export function loadPhoto(id: string): Promise<HTMLImageElement> {
  let p = images.get(id);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`photo ${id} failed to load`));
      img.src = `${PHOTO_DIR}/${id}.webp`;
    }).catch((e: unknown) => {
      images.delete(id);
      throw e;
    });
    images.set(id, p);
  }
  return p;
}

const canvasOf = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d', { willReadFrequently: true })!];
};

/** Average color of a ring around (x, y) in canvas pixels. */
function surroundings(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): [number, number, number] {
  const x0 = Math.max(0, Math.round(x - r));
  const y0 = Math.max(0, Math.round(y - r));
  const size = Math.max(1, Math.round(r * 2));
  const d = ctx.getImageData(x0, y0, size, size).data;
  let R = 0;
  let G = 0;
  let B = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) {
    R += d[i]!;
    G += d[i + 1]!;
    B += d[i + 2]!;
    n++;
  }
  return n ? [R / n, G / n, B / n] : [128, 128, 128];
}

/** The level picture (photo + ball) at the photo's resolution. */
export function buildComposite(img: HTMLImageElement, scene: Scene): HTMLCanvasElement {
  const ph = scene.photo!;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const k = w / W;
  // The (mirrored) photo, then the level's window of it scaled to fill the picture.
  const [full, fctx] = canvasOf(w, h);
  if (ph.mirror) fctx.setTransform(-1, 0, 0, 1, w, 0);
  fctx.drawImage(img, 0, 0, w, h);
  const [base, ctx] = canvasOf(w, h);
  const { x: cx0, y: cy0, s } = ph.crop;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full, cx0 * k, cy0 * k, w * s, h * s, 0, 0, w, h);
  const [orig, octx] = canvasOf(w, h);
  octx.drawImage(base, 0, 0);

  const b = scene.ball;
  const bx = b.x * k;
  const by = b.y * k;
  const br = b.r * k;
  const [sr, sg, sb] = surroundings(octx, bx, by, br * 3);
  const lum = (0.299 * sr + 0.587 * sg + 0.114 * sb) / 255;

  // Draw the ball a little under-sampled, then scale it in: it gets the same softness as the photo.
  // Zoomed-in crops are upscaled photos, so the ball gets the same extra softness.
  const soft = 0.75 * ph.crop.s;
  const pad = br * 2.2;
  const [ballC, bctx] = canvasOf(pad * 2 * soft, pad * 2 * soft);
  bctx.setTransform(soft * k, 0, 0, soft * k, pad * soft, pad * soft);
  drawPhotoBall(bctx, { ...b, x: 0, y: 0 }, scene.seed);
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  // Light the ball like its surroundings: darker in shade, tinted by the local color cast.
  bctx.globalCompositeOperation = 'source-atop';
  const dim = Math.max(0, Math.min(0.55, (0.62 - lum) * 0.9 + b.shade * 0.6));
  bctx.fillStyle = `rgba(10, 16, 24, ${dim})`;
  bctx.fillRect(0, 0, ballC.width, ballC.height);
  bctx.globalCompositeOperation = 'multiply';
  bctx.globalAlpha = 0.22;
  bctx.fillStyle = `rgb(${sr | 0}, ${sg | 0}, ${sb | 0})`;
  bctx.fillRect(0, 0, ballC.width, ballC.height);
  bctx.globalAlpha = 1;
  bctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ballC, bx - pad, by - pad, pad * 2, pad * 2);

  // Grain over the ball so it shares the photo's noise.
  const g0 = Math.max(0, Math.round(bx - br * 1.2));
  const g1 = Math.max(0, Math.round(by - br * 1.2));
  const gs = Math.max(1, Math.round(br * 2.4));
  const patch = ctx.getImageData(g0, g1, gs, gs);
  let seed = (scene.seed % 9973) + 1;
  for (let i = 0; i < patch.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = ((seed / 2147483647) - 0.5) * 18;
    patch.data[i] = patch.data[i]! + n;
    patch.data[i + 1] = patch.data[i + 1]! + n;
    patch.data[i + 2] = patch.data[i + 2]! + n;
  }
  ctx.putImageData(patch, g0, g1);

  // Partly tuck the ball under texture borrowed from beside it (leaves, grass, pebbles...).
  if (ph.cover) {
    const { a, amt } = ph.cover;
    const rc = br * 1.15;
    const dist = br + rc - 2 * amt * br;
    const cx = bx + Math.cos(a) * dist;
    const cy = by + Math.sin(a) * dist;
    const side = a + Math.PI / 2;
    const sx = cx + Math.cos(side) * br * 3.2;
    const sy = cy + Math.sin(side) * br * 3.2;
    const size = rc * 2.4;
    const [pc, pctx] = canvasOf(size, size);
    pctx.drawImage(orig, sx - size / 2, sy - size / 2, size, size, 0, 0, size, size);
    pctx.globalCompositeOperation = 'destination-in';
    const m = pctx.createRadialGradient(size / 2, size / 2, rc * 0.55, size / 2, size / 2, rc);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    pctx.fillStyle = m;
    pctx.fillRect(0, 0, size, size);
    ctx.drawImage(pc, cx - size / 2, cy - size / 2);
  }
  return base;
}

/**
 * Draws the prepared level into the visible canvas. The canvas never gets more pixels than the
 * photo has (zooming in just scales it), which keeps memory low on phones.
 */
export function paintComposite(canvas: HTMLCanvasElement, composite: HTMLCanvasElement, cssWidth: number): void {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.min(composite.width, Math.round(cssWidth * dpr));
  const h = Math.round((w * composite.height) / composite.width);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(composite, 0, 0, w, h);
}
