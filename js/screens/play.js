import { settings, motionLevel } from '../state/settings.js';
import { saveRun } from '../state/store.js';
import { createRenderer } from '../engine/renderer.js';
import { createInput } from '../engine/input.js';
import { createLoop, createClock } from '../engine/loop.js';
import { createParticles } from '../engine/particles.js';
import { audio } from '../engine/audio.js';
import { drawCrosshair } from '../ui/crosshair.js';
import { createHud } from '../ui/hud.js';
import { createRecorder } from '../stats/recorder.js';
import { applyPoints } from '../stats/analyze.js';
import { getMode } from '../modes/index.js';

const COUNTDOWN_MS = 3000;
const HUD_INSET = 84; // px kept clear at the top so targets never sit under the HUD
const EDGE = 24;

export function createPlayScreen(el, app) {
  const canvas = el.querySelector('canvas');
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  const particles = createParticles(512);
  const hud = createHud(el.querySelector('[data-hud]'));
  const countEl = el.querySelector('[data-countdown]');
  const pauseEl = el.querySelector('[data-pause]');
  const clock = createClock();
  const loop = createLoop({ update, render });
  const area = { x: 0, y: 0, w: 0, h: 0 };
  let s = null; // current session
  let goTimer = 0;

  function playArea() {
    area.x = EDGE;
    area.y = HUD_INSET;
    area.w = Math.max(0, renderer.width - EDGE * 2);
    area.h = Math.max(0, renderer.height - HUD_INSET - EDGE);
    return area;
  }

  function newSession(modeId) {
    const def = getMode(modeId);
    const snap = settings.snapshot();
    const duration = snap.run.duration * 1000;
    const motion = motionLevel();
    s = {
      def, snap, duration, motion,
      phase: 'countdown', prevPhase: null, lastCount: null,
      score: 0, hits: 0, shots: 0,
      recorder: createRecorder({ mode: def.id, settings: snap, duration }),
    };
    s.mode = def.create({
      settings: snap,
      motion,
      recorder: s.recorder,
      area: playArea,
      burst(x, y, color) {
        if (motion === 'off') return;
        particles.burst(x, y, motion === 'full' ? 16 : 6, color);
      },
    });
    particles.clear();
    hud.reset(duration);
    setCount('');
    setPaused(false);
    clock.start();
    loop.start();
  }

  function setCount(text, go = false) {
    clearTimeout(goTimer);
    countEl.innerHTML = text ? `<span class="${go ? 'is-go' : ''}">${text}</span>` : '';
    if (go) goTimer = setTimeout(() => setCount(''), 600);
  }

  function setPaused(open) {
    pauseEl.classList.toggle('is-open', open);
    if (open) pauseEl.querySelector('[data-action="resume"]').focus({ preventScroll: true });
  }

  const runTime = () => clock.now() - COUNTDOWN_MS;

  function update(step) {
    if (!s || (s.phase !== 'countdown' && s.phase !== 'running')) return;
    const t = runTime();
    if (s.phase === 'countdown') {
      const n = Math.ceil(-t / 1000);
      if (t < 0) {
        if (n !== s.lastCount) {
          s.lastCount = n;
          setCount(String(n));
          audio.play('count');
        }
        return;
      }
      s.phase = 'running';
      setCount('Go', true);
      audio.play('go');
      s.mode.start(0);
    }
    if (t >= s.duration) {
      finish();
      return;
    }
    s.mode.update(t);
    particles.update(step);
  }

  function render() {
    renderer.begin(s?.snap.background.color ?? '#000');
    if (!s) return;
    const ctx = renderer.ctx;
    const t = runTime();
    if (s.phase !== 'countdown') s.mode.draw(ctx, Math.min(t, s.duration));
    particles.draw(ctx);
    hud.frame(t, s.duration);
    if (input.state.inside && s.phase !== 'paused') {
      drawCrosshair(ctx, input.state.x, input.state.y, s.snap.crosshair, renderer.dpr);
    }
  }

  function onDown(e) {
    if (!s || s.phase !== 'running' || e.button !== 0) return;
    const t = Math.min(Math.max(clock.fromStamp(e.t) - COUNTDOWN_MS, 0), s.duration);
    const res = s.mode.shot(e.x, e.y, t);
    s.shots++;
    if (res.hit) s.hits++;
    s.score = applyPoints(s.score, res.pts);
    audio.play(res.hit ? 'hit' : 'miss');
    hud.stats(s);
  }

  function pause() {
    if (!s || (s.phase !== 'running' && s.phase !== 'countdown')) return;
    s.prevPhase = s.phase;
    s.phase = 'paused';
    clock.pause();
    loop.stop();
    render();
    setPaused(true);
  }

  function resume() {
    if (!s || s.phase !== 'paused') return;
    s.phase = s.prevPhase;
    clock.resume();
    setPaused(false);
    loop.start();
  }

  function finish() {
    s.phase = 'done';
    loop.stop();
    const run = s.recorder.finish({ elapsed: s.duration, area: { w: renderer.width, h: renderer.height } });
    saveRun(run).catch((err) => console.warn('Could not save run', err));
    app.go('results', { run });
  }

  function onKey(e) {
    if (e.key !== 'Escape' || e.repeat) return;
    e.preventDefault();
    if (s?.phase === 'paused') resume();
    else pause();
  }

  const onBlur = () => pause();
  const onVisibility = () => document.hidden && pause();

  input.on('down', onDown);
  pauseEl.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'resume') resume();
    else if (action === 'restart') newSession(s.def.id);
    else if (action === 'quit') app.go('home');
  });

  return {
    el,
    focusTarget: canvas,
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
      setPaused(false);
      setCount('');
      s = null;
    },
  };
}
