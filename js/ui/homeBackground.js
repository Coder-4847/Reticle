import { motionLevel } from '../state/settings.js';

// Home backdrop: a faint dot grid that brightens near the pointer, with a few slow,
// drifting target rings. Static under reduced/off motion; only runs while visible.
const GAP = 32;

export function createHomeBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const ptr = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };
  const rings = Array.from({ length: 4 }, (_, i) => ({ x: 0, y: 0, r: 0, born: 0, life: 0, seed: i }));
  let raf = 0;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let accent = '#4f8dff';

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function respawn(ring, now) {
    ring.x = w * (0.15 + Math.random() * 0.7);
    ring.y = h * (0.2 + Math.random() * 0.7);
    ring.r = 18 + Math.random() * 40;
    ring.born = now + Math.random() * 3000;
    ring.life = 5000 + Math.random() * 4000;
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ptr.x += (ptr.tx - ptr.x) * 0.08;
    ptr.y += (ptr.ty - ptr.y) * 0.08;
    ctx.fillStyle = '#ffffff';
    for (let y = GAP / 2; y < h; y += GAP) {
      for (let x = GAP / 2; x < w; x += GAP) {
        const d = Math.hypot(x - ptr.x, y - ptr.y);
        ctx.globalAlpha = 0.05 + Math.max(0, 1 - d / 260) * 0.16;
        ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      }
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    for (const ring of rings) {
      const k = (now - ring.born) / ring.life;
      if (k >= 1) { respawn(ring, now); continue; }
      if (k < 0) continue;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.16;
      ctx.beginPath();
      ctx.arc(ring.x + Math.sin(now / 3000 + ring.seed) * 12, ring.y - k * 30, ring.r * (0.9 + k * 0.2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    draw(now);
  }

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.tx = e.clientX - r.left;
    ptr.ty = e.clientY - r.top;
  };
  new ResizeObserver(() => { resize(); if (!raf) draw(performance.now()); }).observe(canvas);

  return {
    start() {
      accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent;
      resize();
      const now = performance.now();
      for (const ring of rings) respawn(ring, now - Math.random() * 4000);
      if (motionLevel() !== 'full') {
        draw(now);
        return;
      }
      window.addEventListener('pointermove', onMove);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener('pointermove', onMove);
    },
  };
}
