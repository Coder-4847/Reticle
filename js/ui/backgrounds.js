import { idb } from '../state/idb.js';

// Background renderer. Static layers are cached in an offscreen canvas and rebuilt
// only when the size or settings change; the starfield is the only per-frame work.
const IMAGE_KEY = 'bg-image';
const STAR_COUNT = 160;
let image = null; // ImageBitmap | HTMLImageElement
let imageVersion = 0;
const imageListeners = new Set();

export const backgroundImage = {
  get: () => image,
  async load() {
    try {
      const blob = await idb.get(IMAGE_KEY);
      if (blob) setImage(await createImageBitmap(blob));
    } catch { /* no image or unsupported */ }
  },
  /** Downscale an uploaded file and persist it. */
  async save(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
    await idb.set(IMAGE_KEY, blob);
    setImage(await createImageBitmap(blob));
  },
  async clear() {
    await idb.del(IMAGE_KEY).catch(() => {});
    setImage(null);
  },
  subscribe(fn) {
    imageListeners.add(fn);
    return () => imageListeners.delete(fn);
  },
};

function setImage(img) {
  image = img;
  imageVersion++;
  for (const fn of imageListeners) fn(img);
}

function drawCover(ctx, img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export function createBackground() {
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  const vig = document.createElement('canvas'); // vignette layer, used above the starfield
  const vctx = vig.getContext('2d');
  const stars = new Float32Array(STAR_COUNT * 3); // x, y (0..1), size
  for (let i = 0; i < STAR_COUNT; i++) {
    stars[i * 3] = Math.random();
    stars[i * 3 + 1] = Math.random();
    stars[i * 3 + 2] = 0.6 + Math.random() * 1.4;
  }
  let key = '';

  function rebuild(w, h, dpr, b) {
    base.width = Math.max(1, Math.round(w * dpr));
    base.height = Math.max(1, Math.round(h * dpr));
    const ctx = bctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = b.color;
    ctx.fillRect(0, 0, w, h);
    if (b.type === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
      g.addColorStop(0, b.color2);
      g.addColorStop(1, b.color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (b.type === 'grid') {
      ctx.strokeStyle = `rgba(255,255,255,${b.gridOpacity})`;
      ctx.lineWidth = 1 / dpr;
      ctx.beginPath();
      const s = b.gridSpacing;
      const ox = (w / 2) % s;
      const oy = (h / 2) % s;
      for (let x = ox; x <= w; x += s) { ctx.moveTo(Math.round(x * dpr) / dpr + 0.5 / dpr, 0); ctx.lineTo(Math.round(x * dpr) / dpr + 0.5 / dpr, h); }
      for (let y = oy; y <= h; y += s) { ctx.moveTo(0, Math.round(y * dpr) / dpr + 0.5 / dpr); ctx.lineTo(w, Math.round(y * dpr) / dpr + 0.5 / dpr); }
      ctx.stroke();
    } else if (b.type === 'image' && image) {
      drawCover(ctx, image, w, h);
      ctx.fillStyle = `rgba(0,0,0,${b.imageDim})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (b.vignette) {
      if (b.type === 'stars') {
        vig.width = base.width;
        vig.height = base.height;
        vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawVignette(vctx, w, h);
      } else {
        drawVignette(ctx, w, h);
      }
    }
    if (b.brightness < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - b.brightness})`;
      ctx.fillRect(0, 0, w, h);
    } else if (b.brightness > 1) {
      ctx.fillStyle = `rgba(255,255,255,${(b.brightness - 1) * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    /** Paint the background. ctx must be in CSS-pixel space (transform = dpr). */
    draw(ctx, w, h, dpr, b, now) {
      const k = `${w}|${h}|${dpr}|${b.type}|${b.color}|${b.color2}|${b.gridSpacing}|${b.gridOpacity}|${b.imageDim}|${b.brightness}|${b.vignette}|${imageVersion}`;
      if (k !== key) {
        key = k;
        rebuild(w, h, dpr, b);
      }
      ctx.drawImage(base, 0, 0, w, h);
      if (b.type === 'stars') {
        const drift = now * 0.000006;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < STAR_COUNT; i++) {
          const s = stars[i * 3 + 2];
          const x = ((stars[i * 3] + drift * s) % 1) * w;
          const y = ((stars[i * 3 + 1] + drift * s * 0.35) % 1) * h;
          ctx.globalAlpha = (0.15 + s * 0.2) * Math.min(1.4, b.brightness);
          ctx.fillRect(x, y, s, s);
        }
        ctx.globalAlpha = 1;
      }
      if (b.type === 'stars' && b.vignette) ctx.drawImage(vig, 0, 0, w, h);
    },
  };
}
