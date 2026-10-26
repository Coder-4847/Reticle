import { settings } from '../state/settings.js';
import { audio } from '../engine/audio.js';
import { buildRows } from '../ui/form.js';
import { createPreview } from '../ui/preview.js';
import { encodeCrosshair, decodeCrosshair } from '../ui/crosshair.js';
import { backgroundImage } from '../ui/backgrounds.js';
import { mountShapePicker } from '../targets/shapePicker.js';
import { SECTIONS } from './settingsSections.js';

// Custom rows that aren't a single bound control.
const CUSTOM = {
  crosshairCode(slot) {
    slot.innerHTML = `
      <div class="code-field">
        <input class="input" type="text" spellcheck="false" aria-label="Crosshair code" placeholder="Paste a code (RX1-…)">
        <button type="button" class="btn btn--sm" data-act="copy">Copy mine</button>
        <button type="button" class="btn btn--sm" data-act="apply">Load</button>
      </div>
      <p class="field-msg" aria-live="polite"></p>`;
    const input = slot.querySelector('input');
    const msg = slot.querySelector('.field-msg');
    const say = (text, ok = true) => {
      msg.textContent = text;
      msg.dataset.tone = ok ? 'ok' : 'error';
    };
    slot.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'copy') {
        const code = encodeCrosshair(settings.get('crosshair'));
        input.value = code;
        try {
          await navigator.clipboard.writeText(code);
          say('Copied to clipboard.');
        } catch {
          input.select();
          say('Select the code above and copy it.');
        }
      } else if (act === 'apply') {
        const cfg = decodeCrosshair(input.value);
        if (!cfg) return say('That is not a valid crosshair code.', false);
        settings.importSection('crosshair', cfg);
        say('Crosshair loaded.');
      }
    });
    input.addEventListener('keydown', (e) => e.key === 'Enter' && slot.querySelector('[data-act="apply"]').click());
    return null;
  },

  bgImage(slot) {
    slot.innerHTML = `
      <div class="code-field">
        <input type="file" accept="image/*" hidden>
        <button type="button" class="btn btn--sm" data-act="upload">Upload image</button>
        <button type="button" class="btn btn--sm btn--ghost" data-act="remove">Remove</button>
      </div>
      <p class="field-msg" aria-live="polite"></p>`;
    const file = slot.querySelector('input');
    const msg = slot.querySelector('.field-msg');
    const sync = () => {
      const has = Boolean(backgroundImage.get());
      slot.querySelector('[data-act="remove"]').hidden = !has;
      if (!msg.dataset.busy) msg.textContent = has ? '' : 'No image yet.';
    };
    slot.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'upload') file.click();
      else if (act === 'remove') await backgroundImage.clear();
    });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      msg.dataset.busy = '1';
      msg.textContent = 'Processing…';
      try {
        await backgroundImage.save(f);
        msg.textContent = '';
      } catch {
        msg.textContent = 'Could not read that image.';
      }
      delete msg.dataset.busy;
      file.value = '';
      sync();
    });
    backgroundImage.subscribe(sync);
    return { sync };
  },

  shapes(slot) {
    return mountShapePicker(slot);
  },

  audioTest(slot) {
    slot.innerHTML = `<div class="btn-row">${['hit', 'miss', 'spawn', 'count']
      .map((s) => `<button type="button" class="btn btn--sm" data-sound="${s}">${s === 'count' ? 'Countdown' : s[0].toUpperCase() + s.slice(1)}</button>`)
      .join('')}</div>`;
    slot.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sound]');
      if (b) audio.play(b.dataset.sound);
    });
    return null;
  },
};

export function createSettingsScreen(el) {
  const root = el.querySelector('[data-settings]');
  root.innerHTML = `
    <nav class="settings__nav" role="tablist" aria-label="Setting categories" aria-orientation="vertical">
      ${SECTIONS.map((s, i) => `<button type="button" class="settings__tab" role="tab" id="tab-${s.id}" data-tab="${s.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${s.title}</button>`).join('')}
    </nav>
    <section class="card panel" role="tabpanel" data-panel></section>
    <aside class="settings__aside">
      <div class="card preview">
        <canvas class="preview__canvas" aria-label="Live preview"></canvas>
        <p class="preview__hint">Live preview. Hover to aim, click to test.</p>
      </div>
      <div class="xh-swatches" data-swatches hidden></div>
    </aside>`;

  const panel = root.querySelector('[data-panel]');
  const tabs = [...root.querySelectorAll('.settings__tab')];
  const preview = createPreview(root.querySelector('.preview__canvas'), root.querySelector('[data-swatches]'));
  let form = null;
  let active = SECTIONS[0].id;

  function show(id) {
    const section = SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
    active = section.id;
    for (const t of tabs) {
      const on = t.dataset.tab === active;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    }
    form?.destroy();
    panel.setAttribute('aria-labelledby', `tab-${active}`);
    panel.innerHTML = `
      <header class="panel__head">
        <h2 class="panel__title">${section.title}</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-action="reset">Reset to default</button>
      </header>
      <div class="panel__rows"></div>`;
    panel.classList.remove('is-entering');
    void panel.offsetWidth; // restart the entrance animation
    panel.classList.add('is-entering');
    panel.querySelector('[data-action="reset"]').onclick = () => section.reset.forEach((p) => settings.resetSection(p));
    form = buildRows(panel.querySelector('.panel__rows'), section.rows, { custom: CUSTOM });
    preview.showSwatches(Boolean(section.swatchPreview));
  }

  root.querySelector('.settings__nav').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab && tab.dataset.tab !== active) show(tab.dataset.tab);
  });
  root.querySelector('.settings__nav').addEventListener('keydown', (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = (tabs.findIndex((t) => t.dataset.tab === active) + step + tabs.length) % tabs.length;
    show(tabs[i].dataset.tab);
    tabs[i].focus();
  });

  show(active);
  return {
    el,
    enter() {
      form?.sync();
      preview.start();
    },
    leave() {
      preview.stop();
    },
  };
}
