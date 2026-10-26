import { settings, motionLevel } from '../state/settings.js';
import { saveRun } from '../state/store.js';
import { createRenderer } from '../engine/renderer.js';
import { createInput } from '../engine/input.js';
import { createLoop, createClock } from '../engine/loop.js';
import { createParticles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';
import { easeOutCubic } from '../engine/ease.js';
import { drawCrosshair, drawHitMarker } from '../ui/crosshair.js';
import { createHud } from '../ui/hud.js';
import { createFx } from '../engine/fx.js';
import { createPlayfield } from '../engine/playfield.js';
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
const MISS_COLOR = '#ff5d6c';

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
  const field = createPlayfield(renderer, { top: HUD_INSET, edge: EDGE });
  const fx = createFx();
  const fps = { frames: 0, since: 0 };
  let s = null; // current session
  let countTimer = 0;

  const playArea = () => field.area(s?.config.area);

  function newSession(modeId) {
    const def = getMode(modeId);
    const snap = settings.snapshot();
    const config = snap.modes[def.id];
    const motion = motionLevel();
    const duration = def.timed === false ? null : snap.run.duration * 1000;
    s = {
      def, snap, config, motion, duration,
      phase: 'ready', prevPhase: null, lastCount: null, pausedAt: 0,
      score: 0, hits: 0, shots: 0, streak: 0, pulseT: -1e9, markerT: -1e9,
      fx: motion === 'off' ? {} : snap.effects,
      lockWanted: snap.pointer.lock,
      trailColor: trailColor(snap),
      recorder: createRecorder({ mode: def.id, settings: snap, duration }),
    };
    s.look = getLook(snap, renderer.dpr);
    s.mode = def.create({
      settings: snap,
      config,
      motion,
      effects: s.fx,
      look: s.look,
      recorder: s.recorder,
      pointer: input.state,
      area: playArea,
      view: field.view,
      burst(x, y, color, r = 20) {
        if (s.fx.hitBurst) particles.burst(x, y, motion === 'full' ? 16 : 6, color);
        if (s.fx.fragments && motion === 'full') fx.fragments(x, y, r, color, performance.now());
      },
      onSpawn: () => audio.play('spawn'),
    });
    input.configure({ lock: snap.pointer.lock, sens: snap.pointer.sensitivity });
    particles.clear();
    trail.clear();
    fx.clear();
    hud.begin(s.mode.hudLabels, { timerBar: snap.effects.timerBar, fps: snap.ui.fps });
    hud.stats(s);
    hud.time(s, 0);
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
    fx.update(step);
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
    const shake = fx.shakeOffset(now);
    ctx.translate(shake.x, shake.y);
    if (started) s.mode.draw(ctx, s.duration === null ? t : Math.min(t, s.duration));
    particles.draw(ctx);
    fx.draw(ctx, now, s.look);
    ctx.translate(-shake.x, -shake.y);
    if (s.phase !== 'ready') hud.time(s, started ? t : 0);
    if (s.snap.ui.fps) countFrame(now);
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
    s.streak = res.hit ? s.streak + 1 : 0;
    const fb = s.snap.pointer.hitFeedback;
    const now = performance.now();
    if (s.fx.clickPing) fx.ping(e.x, e.y, s.snap.crosshair.color, now);
    if (!res.hit) {
      audio.play('miss');
      if (s.fx.missRipple) fx.ripple(e.x, e.y, MISS_COLOR, now);
      if (s.fx.screenShake) fx.shake(now, 3);
    } else {
      if (fb === 'sound' || fb === 'both') audio.play('hit');
      if (fb === 'flash' || fb === 'both') s.markerT = now;
    }
    if (s.fx.streak) hud.streak(s.streak);
    hud.stats(s);
  }

  function countFrame(now) {
    fps.frames++;
    if (now - fps.since >= 500) {
      hud.fps(Math.round((fps.frames * 1000) / (now - fps.since)));
      fps.frames = 0;
      fps.since = now;
    }
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
    if (e.repeat) return;
    if ((e.key === 'r' || e.key === 'R') && s && s.phase !== 'done' && !e.target.closest?.('input')) {
      e.preventDefault();
      newSession(s.def.id);
      return;
    }
    if (e.key !== 'Escape') return;
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
  renderer.onResize(() => s?.mode.onResize?.());
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
