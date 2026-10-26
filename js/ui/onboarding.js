import { settings } from '../state/settings.js';
import { openModal } from './modal.js';
import { drawCrosshair } from './crosshair.js';
import { icons } from './icons.js';

const KEY = 'reticle.onboarded';
const ACCENTS = ['#4f8dff', '#7c6cff', '#22c3a6', '#38d996', '#ffb547', '#ff7a45', '#ff4f8b', '#e8eaed'];
const CROSSHAIRS = [
  { name: 'Classic', cfg: { style: 'classic', color: '#4dffa6', length: 7, thickness: 2, gap: 4, dot: false } },
  { name: 'Small dot', cfg: { style: 'dot', color: '#00e5ff', dotSize: 4 } },
  { name: 'T-style', cfg: { style: 't', color: '#ffee00', length: 8, thickness: 2, gap: 3, dot: false } },
  { name: 'Circle + dot', cfg: { style: 'circleDot', color: '#ffffff', length: 10, thickness: 1.5, dotSize: 2.5 } },
];

export const needsOnboarding = () => {
  try { return !localStorage.getItem(KEY); } catch { return false; }
};

function finish() {
  try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
}

/** Three-step first-run flow: welcome, accent color, crosshair. Every step can be skipped. */
export function openOnboarding({ onDone } = {}) {
  const content = document.createElement('div');
  content.className = 'onboarding';
  content.innerHTML = `
    <div class="onboarding__steps" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="onboarding__stage">
      <section class="onboarding__step" data-step="0">
        <span class="onboarding__logo">${icons.logo}</span>
        <h2 class="dialog__title">Welcome to Reticle</h2>
        <p class="dialog__sub">Train flicks, tracking and reflexes, then dig into detailed stats. Two quick choices and you're in.</p>
      </section>
      <section class="onboarding__step" data-step="1" hidden>
        <h2 class="dialog__title">Pick an accent color</h2>
        <p class="dialog__sub">Used for highlights across the app. You can change it any time.</p>
        <div class="swatches swatches--lg" role="radiogroup" aria-label="Accent color">
          ${ACCENTS.map((c) => `<button type="button" class="swatch" role="radio" style="--swatch:${c}" data-accent="${c}" aria-label="${c}"></button>`).join('')}
        </div>
      </section>
      <section class="onboarding__step" data-step="2" hidden>
        <h2 class="dialog__title">Choose a crosshair</h2>
        <p class="dialog__sub">Fine-tune every detail later in Settings.</p>
        <div class="xh-picks" role="radiogroup" aria-label="Crosshair">
          ${CROSSHAIRS.map((x, i) => `<button type="button" class="xh-pick" role="radio" data-xh="${i}" aria-label="${x.name}"><canvas></canvas><span>${x.name}</span></button>`).join('')}
        </div>
      </section>
    </div>
    <div class="dialog__actions dialog__actions--row onboarding__foot">
      <button type="button" class="btn btn--ghost" data-act="skip">Skip</button>
      <button type="button" class="btn" data-act="back" hidden>Back</button>
      <button type="button" class="btn btn--primary" data-act="next" autofocus>Get started</button>
    </div>`;
  let step = 0;
  const steps = [...content.querySelectorAll('.onboarding__step')];
  const dots = [...content.querySelectorAll('.onboarding__steps i')];
  const next = content.querySelector('[data-act="next"]');
  const back = content.querySelector('[data-act="back"]');

  function sync() {
    const accent = settings.get('ui.accent');
    for (const b of content.querySelectorAll('[data-accent]')) b.setAttribute('aria-checked', String(b.dataset.accent === accent));
    const xh = settings.get('crosshair');
    content.querySelectorAll('.xh-pick').forEach((b, i) => {
      const c = CROSSHAIRS[i].cfg;
      b.setAttribute('aria-checked', String(Object.keys(c).every((k) => xh[k] === c[k])));
    });
  }

  function drawPicks() {
    const base = settings.get('crosshair');
    content.querySelectorAll('.xh-pick canvas').forEach((cv, i) => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
      const ctx = cv.getContext('2d');
      drawCrosshair(ctx, cv.clientWidth / 2, cv.clientHeight / 2, { ...base, ...CROSSHAIRS[i].cfg }, dpr);
    });
  }

  function go(n) {
    steps[step].hidden = true;
    step = n;
    steps[step].hidden = false;
    steps[step].classList.remove('is-entering');
    void steps[step].offsetWidth;
    steps[step].classList.add('is-entering');
    dots.forEach((d, i) => d.classList.toggle('is-on', i <= step));
    back.hidden = step === 0;
    next.textContent = step === 0 ? 'Get started' : step === steps.length - 1 ? 'Finish' : 'Next';
    if (step === 2) requestAnimationFrame(drawPicks);
    sync();
  }

  const modal = openModal(content, {
    label: 'Welcome',
    onClose() {
      finish();
      onDone?.();
    },
  });

  content.addEventListener('click', (e) => {
    const accent = e.target.closest('[data-accent]')?.dataset.accent;
    if (accent) {
      settings.set('ui.accent', accent);
      return sync();
    }
    const xh = e.target.closest('[data-xh]');
    if (xh) {
      for (const [k, v] of Object.entries(CROSSHAIRS[Number(xh.dataset.xh)].cfg)) settings.set(`crosshair.${k}`, v);
      return sync();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'skip') modal.close();
    else if (act === 'back') go(step - 1);
    else if (act === 'next') {
      if (step === steps.length - 1) modal.close();
      else go(step + 1);
    }
  });
  go(0);
}
