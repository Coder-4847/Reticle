/** Owns the canvas: devicePixelRatio-aware sizing and per-frame setup. Draw in CSS pixels. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  let width = 0;
  let height = 0;
  let dpr = 1;
  const listeners = new Set();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    width = rect.width;
    height = rect.height;
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    for (const fn of listeners) fn(width, height);
  }

  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize); // catches DPR changes from zoom
  resize();

  return {
    ctx,
    get width() { return width; },
    get height() { return height; },
    get dpr() { return dpr; },
    onResize(fn) {
      listeners.add(fn);
    },
    begin(background) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    },
  };
}
