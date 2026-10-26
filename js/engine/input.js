/**
 * Pointer input for the play canvas. Positions are CSS pixels relative to the canvas;
 * `t` is the event timeStamp (performance.now() timebase).
 *
 * With sensitivity 1 and no pointer lock, the crosshair is the OS cursor position.
 * Otherwise it is a virtual position driven by movementX/Y * sensitivity.
 */
export function createInput(el) {
  const state = { x: 0, y: 0, inside: false, down: false, locked: false };
  const cfg = { lock: false, sens: 1 };
  const handlers = { down: new Set(), up: new Set(), move: new Set(), lock: new Set() };
  // Read per event: the canvas can move (screen transitions) without changing size.
  let rect = el.getBoundingClientRect();
  let needsSync = true;
  const evt = { x: 0, y: 0, t: 0, button: 0 }; // reused: no per-event allocation

  const refreshRect = () => { rect = el.getBoundingClientRect(); };

  const useDelta = () => state.locked || cfg.sens !== 1;

  function emit(type, x, y, t, button = 0) {
    evt.x = x; evt.y = y; evt.t = t; evt.button = button;
    for (const fn of handlers[type]) fn(evt);
  }

  function absolute(e) {
    state.x = e.clientX - rect.left;
    state.y = e.clientY - rect.top;
  }

  // pointerrawupdate (Chromium, secure contexts) arrives without waiting for the next frame.
  const MOVE = 'onpointerrawupdate' in el ? 'pointerrawupdate' : 'pointermove';
  el.addEventListener(MOVE, (e) => {
    refreshRect();
    state.inside = true;
    if (!useDelta() || needsSync) {
      if (!state.locked) absolute(e);
      needsSync = false;
      if (!useDelta()) {
        const list = handlers.move.size ? e.getCoalescedEvents?.() ?? [] : [];
        if (list.length > 1) {
          for (const ce of list) emit('move', ce.clientX - rect.left, ce.clientY - rect.top, ce.timeStamp || e.timeStamp);
          return;
        }
      }
    } else {
      state.x = Math.min(rect.width, Math.max(0, state.x + e.movementX * cfg.sens));
      state.y = Math.min(rect.height, Math.max(0, state.y + e.movementY * cfg.sens));
    }
    emit('move', state.x, state.y, e.timeStamp);
  });

  el.addEventListener('pointerdown', (e) => {
    refreshRect();
    if (!useDelta()) absolute(e);
    state.inside = true;
    state.down = true;
    emit('down', state.x, state.y, e.timeStamp, e.button);
  });

  el.addEventListener('pointerup', (e) => {
    state.down = false;
    emit('up', state.x, state.y, e.timeStamp, e.button);
  });

  el.addEventListener('pointerleave', () => {
    if (state.locked) return;
    state.inside = false;
    state.down = false;
    needsSync = true;
  });

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === el;
    if (locked === state.locked) return;
    state.locked = locked;
    if (locked) {
      if (!state.inside) { state.x = rect.width / 2; state.y = rect.height / 2; }
      state.inside = true;
    } else {
      needsSync = true;
      state.down = false;
    }
    for (const fn of handlers.lock) fn(locked);
  });

  return {
    state,
    configure({ lock, sens }) {
      cfg.lock = lock;
      cfg.sens = sens;
      needsSync = true;
    },
    on(type, fn) {
      handlers[type].add(fn);
      return () => handlers[type].delete(fn);
    },
    /** Request pointer lock (raw input where supported). Resolves true once locked. */
    requestLock() {
      if (document.pointerLockElement === el) return Promise.resolve(true);
      return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          document.removeEventListener('pointerlockchange', onChange);
          document.removeEventListener('pointerlockerror', onError);
          resolve(ok);
        };
        const onChange = () => document.pointerLockElement === el && finish(true);
        const onError = () => finish(false);
        const timer = setTimeout(() => finish(false), 2000);
        document.addEventListener('pointerlockchange', onChange);
        const attempt = (opts) => {
          try {
            const p = opts ? el.requestPointerLock(opts) : el.requestPointerLock();
            return p && typeof p.then === 'function' ? p : null;
          } catch {
            return null;
          }
        };
        const p = attempt({ unadjustedMovement: true });
        if (p) {
          // Promise API: retry without raw input if the platform doesn't support it.
          p.then(() => finish(true), () => {
            const p2 = attempt();
            if (p2) p2.then(() => finish(true), () => finish(false));
            else document.addEventListener('pointerlockerror', onError);
          });
        } else {
          document.addEventListener('pointerlockerror', onError);
        }
      });
    },
    exitLock() {
      if (document.pointerLockElement === el) document.exitPointerLock();
    },
  };
}
