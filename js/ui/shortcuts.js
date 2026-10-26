import { openModal } from './modal.js';

export const SHORTCUTS = [
  ['Space / Enter', 'Quick start (home) or retry (results)'],
  ['1 – 5', 'Pick a mode on the home screen'],
  ['R', 'Restart the run, or retry from results'],
  ['Esc', 'Pause and resume during a run'],
  ['S', 'Open settings'],
  ['?', 'Show this list'],
];

export function openCheatSheet() {
  if (document.querySelector('.cheatsheet')) return;
  const content = document.createElement('div');
  content.className = 'cheatsheet';
  content.innerHTML = `
    <h2 class="dialog__title">Keyboard shortcuts</h2>
    <dl class="cheatsheet__list">
      ${SHORTCUTS.map(([k, d]) => `<div><dt>${k.split(' / ').map((x) => `<kbd>${x}</kbd>`).join(' ')}</dt><dd>${d}</dd></div>`).join('')}
    </dl>
    <div class="dialog__actions dialog__actions--row"><button type="button" class="btn btn--primary" data-close autofocus>Got it</button></div>`;
  const modal = openModal(content, { label: 'Keyboard shortcuts' });
  content.querySelector('[data-close]').onclick = () => modal.close();
}

const typing = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]');

/**
 * Global shortcuts. `handlers` maps screen name -> { key -> fn }; '*' applies everywhere
 * (except during a run). Ignored while typing or while a dialog is open (apart from '?').
 */
export function installShortcuts(getScreen, handlers) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e.target)) return;
    const dialogOpen = document.querySelector('.overlay--fixed.is-open, .menu.is-open');
    const screen = getScreen();
    if (screen === 'play') return; // the play screen owns its keys
    const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === '?') {
      e.preventDefault();
      openCheatSheet();
      return;
    }
    if (dialogOpen) return;
    // Let focused buttons handle their own Enter/Space.
    if ((key === 'Enter' || key === 'Space') && e.target.closest?.('button, a, [role="slider"], [role="radio"], [role="switch"]')) return;
    const fn = handlers[screen]?.[key] ?? handlers['*']?.[key];
    if (fn) {
      e.preventDefault();
      fn(e);
    }
  });
}
