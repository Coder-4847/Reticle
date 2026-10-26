import { getShape } from './shapes.js';

/** Resolve the visual style of targets from a settings snapshot. */
export function getLook(snap, dpr = 1) {
  const t = snap.targets;
  return {
    shape: getShape(t.shape),
    color: t.color,
    hitColor: t.colorMode === 'states' ? t.hitColor : t.color,
    outline: t.outline,
    glow: t.glow,
    glowBlur: 18 * dpr,
    opacity: t.opacity,
    variation: t.sizeVariation,
    rotate: t.randomRotation,
  };
}

/** Draw one target. `scale` animates size, `alpha` fades, `color` overrides the fill. */
export function drawTarget(ctx, look, x, y, r, rot, scale, alpha, color = look.color) {
  const s = r * scale;
  if (s <= 0.01 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * look.opacity;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(s, s);
  if (look.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = look.glowBlur;
  }
  ctx.fillStyle = color;
  ctx.fill(look.shape.path);
  if (look.outline) {
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2 / s;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke(look.shape.path);
  }
  ctx.restore();
}
