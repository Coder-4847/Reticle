import { profiles } from '../state/profiles.js';
import { escapeHtml } from './components.js';
import { toast } from './toast.js';

/** Settings row: list, switch, rename, duplicate, delete, share and import profiles. */
export function mountProfileManager(slot) {
  slot.innerHTML = `
    <ul class="profile-list" aria-label="Profiles"></ul>
    <div class="code-field">
      <button type="button" class="btn btn--sm btn--primary" data-act="new">New profile</button>
      <input class="input" type="text" spellcheck="false" aria-label="Profile code" placeholder="Paste a profile code (RP1-…)">
      <button type="button" class="btn btn--sm" data-act="import">Import</button>
    </div>`;
  const list = slot.querySelector('.profile-list');
  const codeInput = slot.querySelector('input');
  let renaming = null;
  let armed = null;

  function render() {
    const active = profiles.activeId();
    const only = profiles.list().length === 1;
    list.innerHTML = profiles.list().map((p, i) => `
      <li class="profile-row${p.id === active ? ' is-active' : ''}" data-id="${escapeHtml(p.id)}" style="--i:${i}">
        ${renaming === p.id
          ? `<input class="input profile-row__rename" value="${escapeHtml(p.name)}" maxlength="32" aria-label="Profile name">`
          : `<span class="profile-row__name">${escapeHtml(p.name)}</span>`}
        ${p.id === active ? '<span class="badge badge--accent">Active</span>' : '<button type="button" class="btn btn--sm" data-act="use">Use</button>'}
        <span class="profile-row__actions">
          <button type="button" class="btn btn--sm btn--ghost" data-act="rename">Rename</button>
          <button type="button" class="btn btn--sm btn--ghost" data-act="duplicate">Duplicate</button>
          <button type="button" class="btn btn--sm btn--ghost" data-act="share">Copy code</button>
          ${only ? '' : `<button type="button" class="btn btn--sm btn--ghost${armed === p.id ? ' is-armed' : ''}" data-act="delete">${armed === p.id ? 'Confirm' : 'Delete'}</button>`}
        </span>
      </li>`).join('');
    const input = list.querySelector('.profile-row__rename');
    if (input) {
      input.focus();
      input.select();
      const done = (save) => {
        if (renaming === null) return;
        const id = renaming;
        renaming = null;
        if (save) profiles.rename(id, input.value);
        else render();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') done(true);
        else if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      });
      input.addEventListener('blur', () => done(true));
    }
  }

  slot.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (!act) return;
    if (act === 'new') {
      renaming = profiles.create(`Profile ${profiles.list().length + 1}`);
      render();
    } else if (act === 'import') {
      const newId = profiles.importCode(codeInput.value);
      if (!newId) return toast('That is not a valid profile code.', { tone: 'error' });
      codeInput.value = '';
      toast('Profile imported. Select "Use" to switch to it.', { tone: 'ok' });
    } else if (act === 'use') {
      profiles.switchTo(id);
      toast(`Switched to ${profiles.active().name}`);
    } else if (act === 'rename') {
      renaming = id;
      render();
    } else if (act === 'duplicate') {
      profiles.duplicate(id);
    } else if (act === 'share') {
      const code = profiles.encode(id);
      try {
        await navigator.clipboard.writeText(code);
        toast('Profile code copied.', { tone: 'ok' });
      } catch {
        codeInput.value = code;
        codeInput.select();
        toast('Copy the code from the field below.');
      }
    } else if (act === 'delete') {
      if (armed !== id) {
        armed = id;
        render();
        setTimeout(() => { if (armed === id) { armed = null; render(); } }, 2500);
        return;
      }
      armed = null;
      profiles.remove(id);
    }
  });
  codeInput.addEventListener('keydown', (e) => e.key === 'Enter' && slot.querySelector('[data-act="import"]').click());

  profiles.subscribe(render);
  render();
  return null;
}
