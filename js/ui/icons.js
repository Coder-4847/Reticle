// Inline SVG icons (24x24, stroke-based, inherit currentColor).
const svg = (body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

export const icons = {
  logo: svg('<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  home: svg('<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  stats: svg('<path d="M5 20V11M12 20V5M19 20v-6"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  retry: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5"/><path d="M4 4v4.5h4.5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  flick: svg('<circle cx="16" cy="8" r="4.5"/><circle cx="16" cy="8" r="1" fill="currentColor"/><path d="M4 20 11.5 12.5M11.5 12.5H7M11.5 12.5V17"/>'),
  gridshot: svg('<circle cx="6.5" cy="7" r="3"/><circle cx="17.5" cy="7" r="3"/><circle cx="12" cy="17" r="3"/>'),
  tracking: svg('<path d="M3 16c2.5-6 5-7 7.5-3s5 4 7.5-2l3-4"/><circle cx="10.5" cy="13" r="2.5"/>'),
  reaction: svg('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'),
  switching: svg('<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M10.5 9.5h3.5l-1.5-1.5M13.5 14.5H10l1.5 1.5"/>'),
};

/** Replace every [data-icon] placeholder inside `root` with its SVG. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    if (!el.firstElementChild) el.innerHTML = icons[el.dataset.icon] ?? '';
  }
}
