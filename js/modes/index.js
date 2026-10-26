import { createFlick } from './flick.js';
import { createGridshot } from './gridshot.js';
import { createTracking } from './tracking.js';
import { createReaction } from './reaction.js';
import { createSwitching } from './switching.js';

// Mode registry. `timed: false` modes end themselves instead of running for a fixed duration.
export const MODES = [
  { id: 'flick', name: 'Flick', blurb: 'Snap to targets the moment they appear. Speed and precision.', create: createFlick },
  { id: 'gridshot', name: 'Gridshot', blurb: 'Three targets on screen at once. Clear them as fast as you can.', create: createGridshot },
  { id: 'tracking', name: 'Tracking', blurb: 'Keep your crosshair glued to a target that never stops moving.', create: createTracking },
  { id: 'reaction', name: 'Reaction', blurb: 'Click the instant the screen turns green. Pure reflex.', create: createReaction, timed: false },
  { id: 'switching', name: 'Switching', blurb: 'Only the highlighted target counts. Re-target instantly.', create: createSwitching },
];

export const getMode = (id) => MODES.find((m) => m.id === id && m.create) ?? MODES[0];
