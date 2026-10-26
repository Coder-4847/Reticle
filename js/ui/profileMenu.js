import { profiles } from '../state/profiles.js';
import { escapeHtml } from './components.js';
import { toast } from './toast.js';

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/** Top-bar profile switcher: a menu button with the profile list and a link to manage them. */
export function mountProfileMenu(host, { onManage }) {
  host.innerHTML = `
    <button type="button" class="menu-btn" aria-haspopup="menu" aria-expanded="false">
      <span class="menu-btn__label"></span><span class="chev" aria-hidden="true"></span>
    </button>
    <div class="menu" role="menu" aria-label="Profiles"></div>`;
  const btn = host.querySelector('.menu-btn');
  const menu = host.querySelector('.menu');
  let open = false;

  function render() {
    btn.querySelector('.menu-btn__label').textContent = profiles.active()?.name ?? 'Profile';
    btn.setAttribute('aria-label', `Profile: ${profiles.active()?.name ?? ''}. Switch profile`);
    const active = profiles.activeId();
    menu.innerHTML = `
      <div class="menu__title">Profiles</div>
      ${profiles.list().map((p) => `<button type="button" class="menu__item" role="menuitemradio" aria-checked="${p.id === active}" data-id="${escapeHtml(p.id)}"><span class="menu__check">${p.id === active ? CHECK : ''}</span>${escapeHtml(p.name)}</button>`).join('')}
      <div class="menu__sep" role="separator"></div>
      <button type="button" class="menu__item" role="menuitem" data-manage><span class="menu__check"></span>Manage profiles…</button>`;
  }

  const items = () => [...menu.querySelectorAll('.menu__item')];

  function setOpen(next, focusFirst = false) {
    open = next;
    btn.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    if (open) {
      render();
      const list = items();
      (focusFirst ? list.find((i) => i.getAttribute('aria-checked') === 'true') ?? list[0] : null)?.focus();
    }
  }

  btn.addEventListener('click', () => setOpen(!open, true));
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.menu__item');
    if (!item) return;
    setOpen(false);
    btn.focus();
    if (item.hasAttribute('data-manage')) return onManage();
    if (item.dataset.id !== profiles.activeId()) {
      profiles.switchTo(item.dataset.id);
      toast(`Switched to ${profiles.active().name}`);
    }
  });
  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      btn.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (open && !host.contains(e.target)) setOpen(false);
  });

  profiles.subscribe(render);
  render();
}
