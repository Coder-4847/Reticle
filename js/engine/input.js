/**
 * Pointer input for the play canvas. Positions are CSS pixels relative to the
 * canvas; `t` is the event timeStamp (performance.now() timebase).
 */
export function createInput(el) {
  const state = { x: 0, y: 0, inside: false, down: false, moveT: 0 };
  const handlers = { down: new Set(), up: new Set(), move: new Set() };
  let rect = el.getBoundingClientRect();
  // Reused event object: no per-event allocation in the hot path.
  const evt = { x: 0, y: 0, t: 0, button: 0 };

  const refreshRect = () => { rect = el.getBoundingClientRect(); };
  new ResizeObserver(refreshRect).observe(el);
  window.addEventListener('resize', refreshRect);

  function emit(type, e) {
    evt.x = e.clientX - rect.left;
    evt.y = e.clientY - rect.top;
    evt.t = e.timeStamp;
    evt.button = e.button;
    for (const fn of handlers[type]) fn(evt);
  }

  el.addEventListener('pointermove', (e) => {
    state.x = e.clientX - rect.left;
    state.y = e.clientY - rect.top;
    state.inside = true;
    state.moveT = e.timeStamp;
    if (handlers.move.size) {
      const list = e.getCoalescedEvents?.() ?? [e];
      for (const ce of list) emit('move', ce.timeStamp ? ce : e);
    }
  });

  el.addEventListener('pointerdown', (e) => {
    state.x = e.clientX - rect.left;
    state.y = e.clientY - rect.top;
    state.inside = true;
    state.down = true;
    emit('down', e);
  });

  el.addEventListener('pointerup', (e) => {
    state.down = false;
    emit('up', e);
  });

  el.addEventListener('pointerleave', () => {
    state.inside = false;
    state.down = false;
  });

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    state,
    on(type, fn) {
      handlers[type].add(fn);
      return () => handlers[type].delete(fn);
    },
  };
}
