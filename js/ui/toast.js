// Transient notifications, stacked at the bottom of the screen.
let region = null;

function ensureRegion() {
  if (!region) {
    region = document.createElement('div');
    region.className = 'toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  return region;
}

/** Show a short message. tone: 'info' | 'ok' | 'error'. */
export function toast(message, { tone = 'info', duration = 3200 } = {}) {
  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  el.textContent = message;
  ensureRegion().append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const close = () => {
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 400);
  };
  const timer = setTimeout(close, duration);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    close();
  });
}
