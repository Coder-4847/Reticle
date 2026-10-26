import { settings, motionLevel } from '../state/settings.js';
import { createRenderer } from '../engine/renderer.js';
import { createParticles } from '../engine/particles.js';
import { easeOutBack, easeOutCubic } from '../engine/ease.js';
import { audio } from '../engine/audio.js';
import { createBackground } from './backgrounds.js';
import { createTrail, trailColor } from './trail.js';
import { drawCrosshair, drawHitMarker } from './crosshair.js';
import { getLook, drawTarget } from '../targets/render.js';
import { shapeStore } from '../targets/shapeStore.js';

const CYCLE = 2400;
const SPAWN_MS = 240;
const HIT_AT = 1800;
const HIT_MS = 200;
const SPOTS = [
  { fx: 0.25, fy: 0.56, off: 0, rot: 0.5 },
  { fx: 0.75, fy: 0.44, off: 1200, rot: -0.8 },
];
const SWATCH_BGS = [
  { color: '#0b0c0f', label: 'Dark' },
  { color: '#5b6270', label: 'Gray' },
  { color: '#d9dce1', label: 'Light' },
  { color: '#6aa8e0', label: 'Sky' },
  { color: '#4f7a3a', label: 'Foliage' },
];

/** Settings live preview: background, animated targets, trail and crosshair, all from current settings. */
export function createPreview(canvas, swatchRoot) {
  const r = createRenderer(canvas);
  const bg = createBackground();
  const trail = createTrail();
  const particles = createParticles(160);
  const ptr = { x: 0, y: 0, inside: false };
  const burst = SPOTS.map(() => false);
  let snap;
  let look;
  let tColor;
  let raf = 0;
  let last = 0;
  let pulseT = -1e9;
  let markerT = -1e9;

  swatchRoot.innerHTML = SWATCH_BGS.map((s) => `<figure class="xh-swatch"><canvas style="background:${s.color}"></canvas><figcaption>${s.label}</figcaption></figure>`).join('');
  const swatchCanvases = [...swatchRoot.querySelectorAll('canvas')];

  function drawSwatches() {
    if (swatchRoot.hidden) return;
    const dpr = window.devicePixelRatio || 1;
    swatchCanvases.forEach((c, i) => {
      const w = c.clientWidth;
      const h = c.clientHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext('2d');
      ctx.fillStyle = SWATCH_BGS[i].color;
      ctx.fillRect(0, 0, c.width, c.height);
      drawCrosshair(ctx, w / 2, h / 2, snap.crosshair, dpr);
    });
  }

  function refresh() {
    snap = settings.snapshot();
    look = getLook(snap, r.dpr);
    tColor = trailColor(snap);
    drawSwatches();
  }

  canvas.addEventListener('pointermove', (e) => {
    ptr.x = e.offsetX;
    ptr.y = e.offsetY;
    ptr.inside = true;
    trail.push(ptr.x, ptr.y, e.timeStamp);
  });
  canvas.addEventListener('pointerleave', () => { ptr.inside = false; });
  canvas.addEventListener('pointerdown', () => {
    const fb = snap.pointer.hitFeedback;
    pulseT = performance.now();
    if (fb === 'flash' || fb === 'both') markerT = pulseT;
    if (fb === 'sound' || fb === 'both') audio.play('hit');
  });

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(50, now - last);
    last = now;
    const { ctx, width: w, height: h, dpr } = r;
    const motion = motionLevel();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    bg.draw(ctx, w, h, dpr, snap.background, now);

    const size = Math.min(40, Math.max(12, snap.modes.flick.size));
    SPOTS.forEach((spot, i) => {
      const phase = (now + spot.off) % CYCLE;
      const x = spot.fx * w;
      const y = spot.fy * h;
      let scale = 1;
      let alpha = 1;
      let color = look.color;
      if (phase < HIT_AT) burst[i] = false;
      if (phase < SPAWN_MS) {
        if (motion === 'full') scale = easeOutBack(phase / SPAWN_MS, 2.2);
        else if (motion === 'reduced') alpha = phase / SPAWN_MS;
      } else if (phase < HIT_AT) {
        if (motion === 'full') scale = 1 + 0.04 * Math.sin(now / 450 + i * 2);
      } else {
        const k = (phase - HIT_AT) / HIT_MS;
        if (k >= 1 || motion === 'off') return;
        scale = 1 - easeOutCubic(k);
        alpha = 1 - k;
        color = look.hitColor;
        if (!burst[i]) {
          burst[i] = true;
          particles.burst(x, y, motion === 'full' ? 12 : 5, look.hitColor);
        }
      }
      drawTarget(ctx, look, x, y, size, look.rotate ? spot.rot : 0, scale, alpha, color);
    });
    particles.update(dt);
    particles.draw(ctx);

    if (snap.trail.enabled && ptr.inside) trail.draw(ctx, performance.now(), snap.trail, tColor);
    const c = snap.crosshair;
    const x = ptr.inside ? ptr.x : w / 2;
    const y = ptr.inside ? ptr.y : h / 2;
    const pk = (now - pulseT) / 140;
    drawCrosshair(ctx, x, y, c, dpr, c.pulse && pk < 1 ? c.pulseStrength * (1 - easeOutCubic(pk)) : 0);
    const mk = (now - markerT) / 180;
    if (mk < 1) drawHitMarker(ctx, x, y, mk, dpr);
  }

  settings.subscribe(refresh);
  shapeStore.subscribe(refresh);
  refresh();

  return {
    start() {
      if (raf) return;
      refresh();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    showSwatches(on) {
      swatchRoot.hidden = !on;
      drawSwatches();
    },
  };
}
