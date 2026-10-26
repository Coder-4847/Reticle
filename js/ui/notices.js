// Dismissible banners for environments Reticle isn't built for (touch, small windows).
const KEY = 'reticle.dismissed';

function dismissed() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function banner(id, text) {
  if (dismissed().includes(id) || document.querySelector(`[data-notice="${id}"]`)) return;
  const el = document.createElement('div');
  el.className = 'notice';
  el.dataset.notice = id;
  el.setAttribute('role', 'note');
  el.innerHTML = '<p></p><button type="button" class="btn btn--sm btn--ghost">Dismiss</button>';
  el.querySelector('p').textContent = text;
  el.querySelector('button').onclick = () => {
    try { sessionStorage.setItem(KEY, JSON.stringify([...dismissed(), id])); } catch { /* ignore */ }
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 300);
  };
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
}

export function checkEnvironment() {
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  if (touchOnly) banner('touch', 'Reticle is built for a mouse. Touch works, but timing and precision will feel different.');
  else if (window.innerWidth < 760 || window.innerHeight < 520) banner('small', 'Reticle is best on a desktop-sized window. Some screens are cramped at this size.');
}
