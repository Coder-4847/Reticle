import { createFlick } from './flick.js';

// Mode registry. A mode with `create` is playable; the rest show as "coming soon".
export const MODES = [
  { id: 'flick', name: 'Flick', blurb: 'Snap to targets the moment they appear. Speed and precision.', create: createFlick },
  { id: 'gridshot', name: 'Gridshot', blurb: 'Three targets on screen at once. Clear them as fast as you can.' },
  { id: 'tracking', name: 'Tracking', blurb: 'Keep your crosshair glued to a target that never stops moving.' },
  { id: 'reaction', name: 'Reaction', blurb: 'Click the instant the screen changes. Pure reflex.' },
  { id: 'switching', name: 'Switching', blurb: 'Only the highlighted target counts. Re-target instantly.' },
];

export const getMode = (id) => MODES.find((m) => m.id === id && m.create) ?? MODES[0];
