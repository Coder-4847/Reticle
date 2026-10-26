/**
 * Play-area geometry: the full field (keeping clear of the HUD and the edges) or a
 * centered box. Returned objects are reused, so callers must not keep them.
 */
export function createPlayfield(renderer, { top = 84, edge = 24 } = {}) {
  const full = { x: 0, y: 0, w: 0, h: 0 };
  const box = { x: 0, y: 0, w: 0, h: 0 };
  const view = { w: 0, h: 0 };
  return {
    area(kind) {
      full.x = edge;
      full.y = top;
      full.w = Math.max(0, renderer.width - edge * 2);
      full.h = Math.max(0, renderer.height - top - edge);
      if (kind !== 'box') return full;
      box.w = Math.min(full.w, Math.max(320, full.w * 0.55));
      box.h = Math.min(full.h, Math.max(240, full.h * 0.6));
      box.x = full.x + (full.w - box.w) / 2;
      box.y = full.y + (full.h - box.h) / 2;
      return box;
    },
    view() {
      view.w = renderer.width;
      view.h = renderer.height;
      return view;
    },
  };
}
