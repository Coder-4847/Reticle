import { settings, motionLevel } from '../state/settings.js';
import { saveRun } from '../state/store.js';
import { createRenderer } from '../engine/renderer.js';
import { createInput } from '../engine/input.js';
import { createLoop, createClock } from '../engine/loop.js';
import { createParticles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';
import { easeOutCubic } from '../engine/ease.js';
import { drawCrosshair, drawHitMarker } from '../ui/crosshair.js';
import { createHud, DEFAULT_LABELS } from '../ui/hud.js';
import { createTrail, trailColor } from '../ui/trail.js';
import { createBackground } from '../ui/backgrounds.js';
import { getLook } from '../targets/render.js';
import { createRecorder } from '../stats/recorder.js';
import { applyPoints } from '../stats/analyze.js';
import { getMode } from '../modes/index.js';

const COUNTDOWN_MS = 3000;
const HUD_INSET = 84; // px kept clear at the top so targets never sit under the HUD
const EDGE = 24;
const PULSE_MS = 140;
const MARKER_MS = 180;
const HUD_EVERY_MS = 100;

export function createPlayScreen(el, app) {
  const canvas = el.querySelector('canvas');
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  const particles = createParticles(512);
  const hud = createHud(el.querySelector('[data-hud]'));
  const background = createBackground();
  const trail = createTrail();
  const countEl = el.querySelector('[data-countdown]');
  const pauseEl = el.querySelector('[data-pause]');
  const pauseSub = el.querySelector('[data-pause-sub]');
  const clock = createClock();
  const loop = createLoop({ update, render });
  const full = { x: 0, y: 0, w: 0, h: 0 };
  const box = { x: 0, y: 0, w: 0, h: 0 };
  const view = { w: 0, h: 0 };
  const hudOut = {};
  let s = null; // current session
  let countTimer = 0;

  function playArea() {
    full.x = EDGE;
    full.y = HUD_INSET;
    full.w = Math.max(0, renderer.width - EDGE * 2);
    full.h = Math.max(0, renderer.height - HUD_INSET - EDGE);
    if (s?.config.area !== 'box') return full;
    box.w = Math.min(full.w, Math.max(320, full.w * 0.55));
    box.h = Math.min(full.h, Math.max(240, full.h * 0.6));
    box.x = full.x + (full.w - box.w) / 2;
    box.y = full.y + (full.h - box.h) / 2;
    return box;
  }

  function viewSize() {
    view.w = renderer.width;
    view.h = renderer.height;
    return view;
  }

  function newSession(modeId) {
    const def = getMode(modeId);
    const snap = settings.snapshot();
    const config = snap.modes[def.id];
    const motion = motionLevel();
    const duration = def.timed === false ? null : snap.run.duration * 1000;
    s = {
      def, snap, config, motion, duration,
      phase: 'ready', prevPhase: null, lastCount: null, pausedAt: 0, hudT: -1e9, tenths: -1,
      score: 0, hits: 0, shots: 0, pulseT: -1e9, markerT: -1e9,
      lockWanted: snap.pointer.lock,
      trailColor: trailColor(snap),
      recorder: createRecorder({ mode: def.id, settings: snap, duration }),
    };
    s.mode = def.create({
      settings: snap,
      config,
      motion,
      look: getLook(snap, renderer.dpr),
      recorder: s.recorder,
      pointer: input.state,
      area: playArea,
      view: viewSize,
      burst(x, y, color) {
        if (motion !== 'off') particles.burst(x, y, motion === 'full' ? 16 : 6, color);
      },
      onSpawn: () => audio.play('spawn'),
    });
    input.configure({ lock: snap.pointer.lock, sens: snap.pointer.sensitivity });
    particles.clear();
    trail.clear();
    hud.configure(s.mode.hudLabels ?? DEFAULT_LABELS);
    updateStats();
    updateTime(0);
    setPaused(false);
    loop.start();
    if (s.lockWanted && !input.state.locked) {
      setCount('Click to start', 'is-prompt');
      input.requestLock(); // works when the click that opened this screen still counts as a gesture
    } else {
      beginCountdown();
    }
  }

  function beginCountdown() {
    s.phase = 'countdown';
    s.lastCount = null;
    setCount('');
    clock.start();
  }

  function setCount(text, cls = '') {
    clearTimeout(countTimer);
    countEl.innerHTML = text ? `<span class="${cls}">${text}</span>` : '';
    if (cls === 'is-go') countTimer = setTimeout(() => setCount(''), 600);
  }

  function setPaused(open) {
    pauseEl.classList.toggle('is-open', open);
    if (!open) return;
    pauseSub.innerHTML = s?.lockWanted ? 'Click <b>Resume</b> to capture the mouse again.' : 'Press <kbd>Esc</kbd> to resume.';
    pauseEl.querySelector('[data-action="resume"]').focus({ preventScroll: true });
  }

  const runTime = () => clock.now() - COUNTDOWN_MS;

  function updateStats() {
    if (s.mode.hud) return;
    hud.set('a', s.score.toLocaleString());
    hud.set('b', String(s.hits));
    hud.set('c', s.shots ? `${Math.round((s.hits / s.shots) * 100)}%` : '—');
    hud.set('d', String(s.shots - s.hits));
  }

  function updateTime(t) {
    if (s.mode.hud && performance.now() - s.hudT >= HUD_EVERY_MS) {
      s.hudT = performance.now();
      hudOut.time = undefined;
      hudOut.progress = undefined;
      s.mode.hud(hudOut, t);
      for (const k of ['a', 'b', 'c', 'd']) if (hudOut[k] !== undefined) hud.set(k, hudOut[k]);
      if (s.duration === null) {
        hud.set('time', hudOut.time ?? '');
        hud.progress(hudOut.progress ?? 1);
      }
    }
    if (s.duration === null) return;
    const remaining = Math.min(s.duration, Math.max(0, s.duration - Math.max(0, t)));
    const tenths = Math.ceil(remaining / 100);
    if (tenths !== s.tenths) {
      s.tenths = tenths;
      hud.set('time', (tenths / 10).toFixed(1));
    }
    hud.progress(remaining / s.duration);
  }

  function update(step) {
    if (!s || (s.phase !== 'countdown' && s.phase !== 'running')) return;
    const t = runTime();
    if (s.phase === 'countdown') {
      if (t < 0) {
        const n = Math.ceil(-t / 1000);
        if (n !== s.lastCount) {
          s.lastCount = n;
          setCount(String(n));
          audio.play('count');
        }
        return;
      }
      s.phase = 'running';
      if (s.mode.quietStart) setCount('');
      else {
        setCount('Go', 'is-go');
        audio.play('go');
      }
      s.mode.start(0);
    }
    if (s.mode.isDone?.(t) || (s.duration !== null && t >= s.duration)) {
      finish(s.duration ?? t);
      return;
    }
    s.mode.update(t, step);
    particles.update(step);
  }

  function render() {
    const ctx = renderer.ctx;
    const { width: w, height: h, dpr } = renderer;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    const now = performance.now();
    background.draw(ctx, w, h, dpr, s ? s.snap.background : settings.get('background'), now);
    if (!s) return;
    const t = runTime();
    const started = s.phase === 'running' || s.phase === 'done' || (s.phase === 'paused' && s.prevPhase === 'running');
    if (started) s.mode.draw(ctx, s.duration === null ? t : Math.min(t, s.duration));
    particles.draw(ctx);
    if (s.phase !== 'ready') updateTime(started ? t : 0);
    if (s.snap.trail.enabled) trail.draw(ctx, now, s.snap.trail, s.trailColor);
    const p = input.state;
    if (p.inside && s.phase !== 'paused') {
      const c = s.snap.crosshair;
      const pk = (now - s.pulseT) / PULSE_MS;
      const extra = c.pulse && pk < 1 ? c.pulseStrength * (1 - easeOutCubic(pk)) : 0;
      drawCrosshair(ctx, p.x, p.y, c, dpr, extra);
      const mk = (now - s.markerT) / MARKER_MS;
      if (mk < 1) drawHitMarker(ctx, p.x, p.y, mk, dpr);
    }
  }

  function onDown(e) {
    audio.unlock();
    if (!s) return;
    if (s.lockWanted && !input.state.locked) {
      if (s.phase === 'ready') input.requestLock();
      return;
    }
    if (s.phase !== 'running' || e.button !== 0) return;
    s.pulseT = performance.now();
    const t = Math.min(Math.max(clock.fromStamp(e.t) - COUNTDOWN_MS, 0), s.duration ?? Infinity);
    const res = s.mode.shot(e.x, e.y, t);
    if (!res) return;
    s.shots++;
    if (res.hit) s.hits++;
    s.score = applyPoints(s.score, res.pts);
    const fb = s.snap.pointer.hitFeedback;
    if (!res.hit) audio.play('miss');
    else {
      if (fb === 'sound' || fb === 'both') audio.play('hit');
      if (fb === 'flash' || fb === 'both') s.markerT = performance.now();
    }
    updateStats();
  }

  function pause() {
    if (!s || (s.phase !== 'running' && s.phase !== 'countdown')) return;
    s.prevPhase = s.phase;
    s.phase = 'paused';
    s.pausedAt = performance.now();
    clock.pause();
    loop.stop();
    render();
    input.exitLock();
    setPaused(true);
  }

  function doResume() {
    if (s?.phase !== 'paused') return;
    s.phase = s.prevPhase;
    clock.resume();
    setPaused(false);
    loop.start();
  }

  function resume() {
    if (s?.phase !== 'paused') return;
    if (s.lockWanted && !input.state.locked) {
      pauseSub.textContent = 'Capturing the mouse…';
      input.requestLock().then((ok) => {
        if (ok) doResume();
        else pauseSub.textContent = 'Could not capture the mouse. Click Resume to try again.';
      });
      return;
    }
    doResume();
  }

  function finish(elapsed) {
    s.phase = 'done';
    loop.stop();
    input.exitLock();
    const run = s.recorder.finish({ elapsed, area: { w: renderer.width, h: renderer.height } });
    saveRun(run).catch((err) => console.warn('Could not save run', err));
    app.go('results', { run });
  }

  function onKey(e) {
    if (e.key !== 'Escape' || e.repeat) return;
    e.preventDefault();
    // Leaving pointer lock with Esc already paused us; don't treat the same press as "resume".
    if (s?.phase === 'paused') {
      if (performance.now() - s.pausedAt > 300) resume();
    } else {
      pause();
    }
  }

  const onBlur = () => pause();
  const onVisibility = () => document.hidden && pause();

  input.on('down', onDown);
  input.on('move', (e) => {
    if (s?.snap.trail.enabled) trail.push(e.x, e.y, e.t);
  });
  input.on('lock', (locked) => {
    if (!s) return;
    if (locked && s.phase === 'ready') beginCountdown();
    else if (!locked && s.lockWanted) pause();
  });
  pauseEl.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'resume') resume();
    else if (action === 'restart') newSession(s.def.id);
    else if (action === 'quit') app.go('home');
  });

  return {
    el,
    enter({ mode } = {}) {
      window.addEventListener('keydown', onKey);
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisibility);
      newSession(mode ?? settings.get('run.mode'));
    },
    leave() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      loop.stop();
      clock.pause();
      input.exitLock();
      setPaused(false);
      setCount('');
      s = null;
    },
  };
}
