// Records every target and every shot of a run. All times are ms since run start.
export const RUN_VERSION = 1;

const r1 = (v) => Math.round(v * 10) / 10;

export function createRecorder({ mode, settings, duration }) {
  const run = {
    v: RUN_VERSION,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    mode,
    timestamp: Date.now(),
    duration,
    elapsed: 0,
    completed: false,
    area: { w: 0, h: 0 },
    settings,
    targets: [],
    shots: [],
  };
  const byId = new Map();

  return {
    run,
    targetSpawned({ id, x, y, r, spawn, life = null }) {
      life = life || null;
      const rec = {
        id, spawn: r1(spawn), x: r1(x), y: r1(y), r: r1(r), life,
        hit: false, hitT: null, rt: null, cx: null, cy: null, dist: null, endT: null,
      };
      byId.set(id, rec);
      run.targets.push(rec);
    },
    /** (tx, ty) is the target's center at hit time (targets can move). */
    targetHit(id, t, x, y, dist, rt = null, tx = null, ty = null) {
      const rec = byId.get(id);
      if (!rec) return;
      rec.hit = true;
      rec.hitT = r1(t);
      rec.endT = rec.hitT;
      rec.rt = r1(rt ?? t - rec.spawn);
      rec.cx = r1(x);
      rec.cy = r1(y);
      rec.dist = r1(dist);
      rec.hx = tx === null ? rec.x : r1(tx);
      rec.hy = ty === null ? rec.y : r1(ty);
    },
    targetExpired(id, t) {
      const rec = byId.get(id);
      if (rec && rec.endT === null) rec.endT = r1(t);
    },
    /**
     * target: id that was hit, or the nearest live target on a miss (null if none).
     * (tx, ty): that target's center at the moment of the shot.
     */
    shot(t, x, y, hit, target, dist, pts, tx = null, ty = null) {
      run.shots.push({
        t: r1(t), x: r1(x), y: r1(y), hit, target, dist: dist === null ? null : r1(dist), pts,
        tx: tx === null ? null : r1(tx), ty: ty === null ? null : r1(ty),
      });
    },
    finish({ elapsed, area, completed = true }) {
      run.elapsed = r1(elapsed);
      run.area = { w: Math.round(area.w), h: Math.round(area.h) };
      run.completed = completed;
      return run;
    },
  };
}
