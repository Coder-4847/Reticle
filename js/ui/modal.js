const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Open a modal dialog. `content` is an element placed inside the dialog.
 * Returns { root, close }. Esc and backdrop clicks close it; focus is trapped and restored.
 */
export function openModal(content, { label, wide = false, onClose } = {}) {
  const returnFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = 'overlay overlay--fixed';
  root.innerHTML = `<div class="dialog${wide ? ' dialog--wide' : ''}" role="dialog" aria-modal="true" aria-label="${label ?? ''}"></div>`;
  const dialog = root.firstElementChild;
  dialog.append(content);
  document.body.append(root);
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    root.classList.remove('is-open');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => root.remove(), 400);
    onClose?.();
    returnFocus?.focus?.({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (document.querySelector('.cp.is-open')) return; // the color picker closes first
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) close();
  });
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => {
    root.classList.add('is-open');
    (dialog.querySelector('[autofocus]') ?? dialog.querySelector(FOCUSABLE))?.focus({ preventScroll: true });
  });
  return { root, dialog, close };
}
