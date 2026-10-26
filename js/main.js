import { settings, motionLevel } from './state/settings.js';
import { audio } from './engine/audio.js';
import { hydrateIcons } from './ui/icons.js';
import { backgroundImage } from './ui/backgrounds.js';
import { profiles, profilesWereReset } from './state/profiles.js';
import { mountProfileMenu } from './ui/profileMenu.js';
import { installShortcuts, openCheatSheet } from './ui/shortcuts.js';
import { needsOnboarding, openOnboarding } from './ui/onboarding.js';
import { checkEnvironment } from './ui/notices.js';
import { toast } from './ui/toast.js';
import { createHomeScreen } from './screens/home.js';
import { createPlayScreen } from './screens/play.js';
import { createResultsScreen } from './screens/results.js';
import { createSettingsScreen } from './screens/settings.js';
import { createStatsScreen } from './screens/stats.js';

const root = document.documentElement;
const LEAVE_MS = 400;

// Text color on accent fills: white while it keeps at least 3:1 contrast, otherwise near-black.
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (lum + 0.05) >= 3 ? '#ffffff' : '#0b0c0f';
}

function applyTheme() {
  const accent = settings.get('ui.accent');
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', inkFor(accent));
  root.dataset.motion = motionLevel();
}

// Screen router: crossfades between <section data-screen> elements.
const screens = {};
let current = null;

const app = {
  go(name, params = {}) {
    const next = screens[name];
    if (!next) return;
    const prev = current;
    if (prev && prev !== next) {
      prev.leave?.();
      prev.el.classList.remove('is-active');
      prev.el.classList.add('is-leaving');
      prev.el.inert = true;
      const leaving = prev.el;
      setTimeout(() => leaving.classList.remove('is-leaving'), LEAVE_MS);
    }
    current = next;
    document.body.dataset.screen = name;
    for (const btn of document.querySelectorAll('.nav__item')) {
      if (btn.dataset.nav === name) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
    next.el.classList.remove('is-leaving');
    next.el.inert = false;
    next.el.scrollTop = 0;
    next.enter?.(params);
    requestAnimationFrame(() => {
      next.el.classList.add('is-active');
      (next.focusTarget ?? next.el).focus({ preventScroll: true });
    });
  },
};

function boot() {
  hydrateIcons();
  applyTheme();
  backgroundImage.load();
  settings.subscribe((path) => {
    if (path === '*' || path.startsWith('ui')) applyTheme();
  });

  const el = (name) => document.querySelector(`.screen[data-screen="${name}"]`);
  screens.home = createHomeScreen(el('home'), app);
  screens.play = createPlayScreen(el('play'), app);
  screens.results = createResultsScreen(el('results'), app);
  screens.settings = createSettingsScreen(el('settings'), app);
  screens.stats = createStatsScreen(el('stats'), app);
  for (const s of Object.values(screens)) s.el.inert = true;

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) app.go(nav.dataset.nav);
    if (e.target.closest('[data-action="shortcuts"]')) openCheatSheet();
  });

  profiles.init();
  mountProfileMenu(document.querySelector('[data-profile-menu]'), { onManage: () => app.go('settings', { tab: 'profiles' }) });
  installShortcuts(() => document.body.dataset.screen, {
    home: {
      Space: () => screens.home.quickStart(),
      Enter: () => screens.home.quickStart(),
      ...Object.fromEntries([1, 2, 3, 4, 5].map((n) => [String(n), () => screens.home.pickMode(n - 1)])),
    },
    results: {
      Space: () => screens.results.retry(),
      Enter: () => screens.results.retry(),
      r: () => screens.results.retry(),
    },
    '*': { s: () => app.go('settings') },
  });
  // Browsers only allow audio after a user gesture.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });

  app.go('home');
  if (settings.wasReset || profilesWereReset) toast('Some saved data could not be read and was reset to defaults.', { tone: 'error', duration: 6000 });
  if (needsOnboarding()) setTimeout(() => openOnboarding(), 350);
  checkEnvironment();
}

boot();
